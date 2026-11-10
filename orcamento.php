<?php
/* ============================================================
   GR Scan — recebe as solicitações de orçamento e envia por e-mail
   Os endereços de e-mail ficam em email-config.php.
   ============================================================ */
header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Sao_Paulo');
$cfg = require __DIR__ . '/email-config.php';

function responder($ok, $msg = '', $code = null) {
    http_response_code($code ?? ($ok ? 200 : 400));
    echo json_encode(['ok' => $ok, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(false, 'Método inválido.');
if (strpos($cfg['DESTINO'], 'exemplo.com') !== false) responder(false, 'Envio por e-mail ainda não configurado.', 503);

$d = json_decode(file_get_contents('php://input'), true);
if (!is_array($d)) $d = $_POST;
if (!empty($d['website'])) responder(true); // robô

$limites = [
    'trabalhos' => 300, 'outro_trabalho' => 120, 'arcadas' => 60, 'dentes' => 300, 'elementos' => 10,
    'pacientes' => 10, 'frequencia' => 60, 'prazo' => 60, 'laboratorio' => 120, 'formato' => 60,
    'local' => 160, 'obs' => 1200,
    'nome' => 100, 'clinica' => 120, 'cro' => 30, 'telefone' => 20, 'email' => 120, 'preferencia' => 30,
];
$v = [];
foreach ($limites as $k => $max) {
    $x = $d[$k] ?? '';
    if (is_array($x)) $x = implode(', ', $x);
    $x = str_replace(["\r", "\0"], '', trim((string)$x));
    $v[$k] = mb_substr($x, 0, $max);
}

if ($v['trabalhos'] === '') responder(false, 'Escolha ao menos um tipo de trabalho.');
foreach (['nome', 'telefone', 'email'] as $k) if ($v[$k] === '') responder(false, 'Preencha seus dados de contato.');
if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) responder(false, 'E-mail inválido.');
if (strlen(preg_replace('/\D/', '', $v['telefone'])) < 10) responder(false, 'Informe um WhatsApp com DDD.');

// Limite contra abuso: 5 envios por IP a cada 10 minutos
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$lock = sys_get_temp_dir() . '/grscan_orc_' . md5($ip);
$hist = is_file($lock) ? array_filter(explode(',', (string)@file_get_contents($lock)), fn($t) => $t > time() - 600) : [];
if (count($hist) >= 5) responder(false, 'Muitas tentativas. Tente novamente em alguns minutos.', 429);
$hist[] = time(); @file_put_contents($lock, implode(',', $hist));

$trab = $v['trabalhos'] . ($v['outro_trabalho'] !== '' ? ' (' . $v['outro_trabalho'] . ')' : '');
$linhas = [
    'TRABALHO' => null,
    'Tipo(s)'            => $trab,
    'Arcadas'            => $v['arcadas'] ?: '—',
    'Dentes / elementos' => $v['dentes'] ?: '—',
    'Nº de pacientes'    => $v['pacientes'] ?: '1',
    'Frequência'         => $v['frequencia'] ?: '—',
    'Prazo desejado'     => $v['prazo'] ?: '—',
    'Laboratório'        => $v['laboratorio'] ?: '—',
    'Formato do arquivo' => $v['formato'] ?: '—',
    'Local (bairro/cidade)' => $v['local'] ?: '—',
    'Observações'        => $v['obs'] ?: '—',
    'CONTATO' => null,
    'Dentista'           => $v['nome'],
    'Clínica'            => $v['clinica'] ?: '—',
    'CRO'                => $v['cro'] ?: '—',
    'WhatsApp'           => $v['telefone'],
    'E-mail'             => $v['email'],
    'Prefere contato por' => $v['preferencia'] ?: '—',
];
$texto = "Nova solicitação de ORÇAMENTO — GR Scan\nRecebida em " . date('d/m/Y H:i') . "\n";
foreach ($linhas as $k => $x) $texto .= $x === null ? "\n== $k ==\n" : "$k: $x\n";
$fone = preg_replace('/\D/', '', $v['telefone']);
if (strlen($fone) <= 11) $fone = '55' . $fone;
$texto .= "\nResponder pelo WhatsApp: https://wa.me/{$fone}\nOu responda este e-mail (vai direto para o solicitante).\n";

require __DIR__ . '/email-template.php';

/* ---------- E-mail para a GR Scan (HTML organizado) ---------- */
$traco = '<span style="color:#9a8f7f">—</span>';
$val = fn($x) => $x !== '' ? em_e($x) : $traco;
$tipos = array_map('trim', explode(',', $v['trabalhos']));
if ($v['outro_trabalho'] !== '') $tipos = array_map(fn($t) => $t === 'Outro' ? 'Outro: ' . $v['outro_trabalho'] : $t, $tipos);
$dentesLista = preg_split('/\s*[,;]\s*/', $v['dentes'], -1, PREG_SPLIT_NO_EMPTY);
$dentesHtml = $v['dentes'] === '' ? $traco
    : (count($dentesLista) > 1 || preg_match('/^\d{2}$/', $v['dentes'])
        ? em_chips($dentesLista, true) . ($v['elementos'] !== '' ? '<span style="font-size:12px;color:#8a7f6e;">' . (int)$v['elementos'] . ' elemento(s)</span>' : '')
        : em_e($v['dentes']));
$urgente = preg_match('/urgente|48/i', $v['prazo']);
$prazoHtml = $urgente
    ? '<span style="display:inline-block;padding:3px 10px;border-radius:6px;background:#fdecea;color:#b3261e;font-weight:700;">' . em_e($v['prazo']) . '</span>'
    : $val($v['prazo']);
$foneFmt = em_fone($v['telefone']);
$waMsg = 'Olá, ' . $v['nome'] . '! Aqui é da GR Scan, sobre o seu pedido de orçamento de escaneamento intraoral.';

$corpo =
    // resumo em destaque
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background:#faf6ee;border:1px solid #efe3c8;border-radius:12px;">'
  . '<tr><td style="padding:16px 18px;">'
  . '<div style="font-size:12px;color:#8a7f6e;margin-bottom:8px;">Tipo de trabalho</div>' . em_chips($tipos)
  . '<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>'
  . '<td style="padding-right:22px;font-size:12px;color:#8a7f6e;">Pacientes<br><b style="font-size:18px;color:#1d1813;">' . em_e($v['pacientes'] ?: '1') . '</b></td>'
  . '<td style="padding-right:22px;font-size:12px;color:#8a7f6e;">Arcadas<br><b style="font-size:14px;color:#1d1813;">' . $val($v['arcadas']) . '</b></td>'
  . '<td style="font-size:12px;color:#8a7f6e;">Prazo<br><b style="font-size:14px;color:#1d1813;">' . $prazoHtml . '</b></td>'
  . '</tr></table></td></tr></table>'
    // trabalho
  . em_bloco('Detalhes do trabalho', '🦷', [
        'Dentes / elementos'  => $dentesHtml,
        'Frequência'          => $val($v['frequencia']),
        'Formato do arquivo'  => $val($v['formato']),
        'Laboratório'         => $val($v['laboratorio']),
        'Local (bairro/cidade)' => $val($v['local']),
        'Observações'         => $v['obs'] !== '' ? nl2br(em_e($v['obs'])) : $traco,
    ])
    // contato
  . em_bloco('Contato', '👤', [
        'Dentista'      => '<b>' . em_e($v['nome']) . '</b>',
        'Clínica'       => $val($v['clinica']),
        'CRO'           => $val($v['cro']),
        'WhatsApp'      => '<a href="' . em_e(em_wa($v['telefone'])) . '" style="color:#1d1813;text-decoration:none;">' . em_e($foneFmt) . '</a>',
        'E-mail'        => '<a href="mailto:' . em_e($v['email']) . '" style="color:#1d1813;">' . em_e($v['email']) . '</a>',
        'Prefere contato por' => '<b style="color:#b07c3c;">' . $val($v['preferencia']) . '</b>',
    ])
    // ações
  . '<div style="margin:4px 0 18px;">'
  . em_botao('Responder no WhatsApp', em_wa($v['telefone'], $waMsg), 'gold')
  . em_botao('Responder por e-mail', 'mailto:' . $v['email'] . '?subject=' . rawurlencode('Orçamento GR Scan'), 'line')
  . '</div>';

$html = em_layout(
    'Novo pedido de orçamento de ' . $v['nome'] . ' — ' . implode(', ', $tipos),
    'Novo pedido de orçamento',
    'Recebido em ' . date('d/m/Y \à\s H:i') . ($urgente ? ' &nbsp;·&nbsp; <b style="color:#ffb4a8;">prioridade</b>' : ''),
    $corpo,
    'Responder a este e-mail envia a resposta direto para ' . em_e($v['email']) . '.<br>GR Scan · formulário de orçamento do site'
);

$assunto = ($urgente ? '[URGENTE] ' : '') . 'Orçamento: ' . ($v['clinica'] ?: $v['nome']) . ' — ' . mb_strimwidth(implode(', ', $tipos), 0, 60, '…');
if (!em_enviar($cfg['DESTINO'], $cfg['REMETENTE'], $v['email'], $assunto, $html, $texto)) {
    responder(false, 'Não foi possível enviar agora. Tente novamente em instantes.', 502);
}

/* ---------- Confirmação para o solicitante ---------- */
$primeiroNome = preg_split('/\s+/', preg_replace('/^(dra?\.?|dr\.)\s+/i', '', $v['nome']))[0];
$corpoConf =
    '<p style="margin:0 0 14px;font-size:15px;color:#1d1813;">Olá, <b>' . em_e($primeiroNome) . '</b>!</p>'
  . '<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b4238;">Recebemos sua solicitação de orçamento de escaneamento intraoral. '
  . 'Nossa equipe vai analisar e responder em breve' . ($v['preferencia'] ? ' por <b>' . em_e($v['preferencia']) . '</b>' : '') . '.</p>'
  . em_bloco('Resumo do pedido', '📋', [
        'Trabalho'  => em_chips($tipos),
        'Dentes'    => $dentesHtml,
        'Pacientes' => em_e($v['pacientes'] ?: '1'),
        'Prazo'     => $val($v['prazo']),
    ])
  . '<p style="margin:0 0 18px;font-size:13px;color:#8a7f6e;">Precisa complementar alguma informação? É só responder este e-mail.</p>';
$htmlConf = em_layout('Recebemos seu pedido de orçamento', 'Recebemos seu pedido!', 'Orçamento de escaneamento intraoral', $corpoConf);
$textoConf = "Olá, {$primeiroNome}!\n\nRecebemos sua solicitação de orçamento de escaneamento intraoral. " .
        "Vamos analisar e responder em breve" . ($v['preferencia'] ? " por {$v['preferencia']}" : '') . ".\n\n" .
        "Resumo:\nTrabalho: $trab\nDentes: " . ($v['dentes'] ?: '—') . "\nPacientes: " . ($v['pacientes'] ?: '1') .
        "\n\nGR Scan — Digital Scan";
em_enviar($v['email'], $cfg['REMETENTE'], $cfg['DESTINO'], 'Recebemos seu pedido de orçamento — GR Scan', $htmlConf, $textoConf);

// Registro em planilha, fora da pasta pública quando possível
$dir = is_writable(dirname(__DIR__)) ? dirname(__DIR__) : __DIR__;
$csv = $dir . '/orcamentos-grscan.csv';
$novo = !is_file($csv);
if ($f = @fopen($csv, 'a')) {
    if ($novo) fputcsv($f, array_merge(['recebido_em'], array_keys($limites)), ';');
    fputcsv($f, array_merge([date('Y-m-d H:i:s')], array_values($v)), ';');
    fclose($f);
}

responder(true);
