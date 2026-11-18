<?php
/* ============================================================
   GR Scan — recebe o orçamento do site.
   O servidor recalcula tudo com a tabela vigente, grava o orçamento
   (com a cópia da tabela aplicada) e só então envia os e-mails.
   Os endereços de e-mail ficam em email-config.php.
   ============================================================ */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/app/orcamentos.php';

function responder(int $code, array $resp) {
    http_response_code($code);
    echo json_enc($resp);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(405, ['ok' => false, 'message' => 'Método inválido.']);
$d = json_decode(file_get_contents('php://input'), true);
if (!is_array($d)) responder(400, ['ok' => false, 'message' => 'Dados inválidos.']);

// Limite contra abuso: 5 envios por IP a cada 10 minutos
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
if (!getenv('GRSCAN_SEM_LIMITE')) {
    $lock = sys_get_temp_dir() . '/grscan_orc_' . md5($ip);
    $hist = is_file($lock) ? array_filter(explode(',', (string)@file_get_contents($lock)), fn($t) => $t > time() - 600) : [];
    if (count($hist) >= 5) responder(429, ['ok' => false, 'message' => 'Muitas tentativas. Tente novamente em alguns minutos.']);
    $hist[] = time(); @file_put_contents($lock, implode(',', $hist));
}

try {
    [$status, $resp, $reg] = orcamento_processar($d, $ip);
} catch (Throwable $e) {
    error_log('orcamento: ' . $e->getMessage());
    responder(503, ['ok' => false, 'message' => 'Não foi possível registrar o orçamento agora. Tente novamente em instantes.']);
}
if ($status !== 200 || !$reg) responder($status, $resp);

/* ---------- E-mails (o orçamento já está gravado; falha de e-mail não perde o pedido) ---------- */
$cfg = require __DIR__ . '/email-config.php';
if (!getenv('GRSCAN_SEM_EMAIL') && strpos($cfg['DESTINO'], 'exemplo.com') === false) {
    require __DIR__ . '/email-template.php';
    $v = $reg['dados']; $calc = $reg['calculo']; $numero = $reg['numero'];
    $traco = '<span style="color:#9a8f7f">—</span>';
    $val = fn($x) => $x !== '' ? em_e($x) : $traco;
    $regiao = '';
    foreach ($calc['itens'] as $it) if ($it['tipo'] === 'deslocamento') $regiao = preg_replace('/^Deslocamento · /', '', $it['descricao']);
    $dataFmt = $v['data_desejada'] !== '' ? date('d/m/Y', strtotime($v['data_desejada'])) : '';
    $valorTxt = $calc['pendente'] ? 'Subtotal ' . brl($calc['subtotal']) . ' (total sob confirmação)' : 'Total ' . brl($calc['total']);
    $aviso = '<p style="margin:0 0 18px;font-size:12px;color:#8a7f6e;">Valores sujeitos à confirmação da disponibilidade, da compatibilidade dos componentes e da viabilidade técnica.</p>';

    $texto = "Novo ORÇAMENTO $numero — GR Scan\nRecebido em " . date('d/m/Y H:i') . "\n\n";
    foreach ($calc['itens'] as $it) $texto .= ($it['paciente'] ? 'Paciente ' . $it['paciente'] . ': ' : '') . $it['descricao'] . ($it['qtd'] > 1 ? ' x' . $it['qtd'] : '') . ' — ' . (!empty($it['promocao']) ? 'grátis (oferta, de ' . brl($it['preco_base']) . ')' : brl($it['total'])) . "\n";
    $texto .= "\n$valorTxt\n\nDentes: " . ($v['dentes'] ?: '—') . "\nData desejada: " . ($dataFmt ?: '—') . "\nObservações: " . ($v['obs'] ?: '—') .
        "\n\nDentista: {$v['nome']}\nClínica: " . ($v['clinica'] ?: '—') . "\nCRO: " . ($v['cro'] ?: '—') .
        "\nWhatsApp: {$v['telefone']}\nE-mail: {$v['email']}\nPrefere contato por: " . ($v['preferencia'] ?: '—') . "\n";

    $corpo = em_itens($calc) . $aviso
      . em_bloco('Detalhes', '🦷', [
            'Região' => $val($regiao),
            'Dentes / elementos' => $val($v['dentes']),
            'Data desejada' => $val($dataFmt),
            'Observações' => $v['obs'] !== '' ? nl2br(em_e($v['obs'])) : $traco,
        ])
      . em_bloco('Contato', '👤', [
            'Dentista' => '<b>' . em_e($v['nome']) . '</b>',
            'Clínica' => $val($v['clinica']),
            'CRO' => $val($v['cro']),
            'WhatsApp' => '<a href="' . em_e(em_wa($v['telefone'])) . '" style="color:#1d1813;text-decoration:none;">' . em_e(em_fone($v['telefone'])) . '</a>',
            'E-mail' => '<a href="mailto:' . em_e($v['email']) . '" style="color:#1d1813;">' . em_e($v['email']) . '</a>',
            'Prefere contato por' => '<b style="color:#b07c3c;">' . $val($v['preferencia']) . '</b>',
        ])
      . '<div style="margin:4px 0 18px;">'
      . em_botao('Responder no WhatsApp', em_wa($v['telefone'], 'Olá, ' . $v['nome'] . '! Aqui é da GR Scan, sobre o orçamento ' . $numero . '.'), 'gold')
      . em_botao('Responder por e-mail', 'mailto:' . $v['email'] . '?subject=' . rawurlencode('Orçamento GR Scan ' . $numero), 'line')
      . '</div>';
    $html = em_layout("Orçamento $numero de " . $v['nome'] . " — $valorTxt", "Novo orçamento $numero",
        'Recebido em ' . date('d/m/Y \à\s H:i'), $corpo,
        'Responder a este e-mail envia a resposta direto para ' . em_e($v['email']) . '.<br>GR Scan · orçamento do site');
    $assunto = "Orçamento $numero: " . ($v['clinica'] ?: $v['nome']) . " — $valorTxt";
    if (!em_enviar($cfg['DESTINO'], $cfg['REMETENTE'], $v['email'], $assunto, $html, $texto)) {
        error_log("orcamento: e-mail para a GR Scan falhou ($numero)");
    }

    $primeiro = preg_split('/\s+/', preg_replace('/^(dra?\.?|dr\.)\s+/i', '', $v['nome']))[0];
    $corpoConf = '<p style="margin:0 0 14px;font-size:15px;color:#1d1813;">Olá, <b>' . em_e($primeiro) . '</b>!</p>'
      . '<p style="margin:0 0 20px;font-size:14px;line-height:1.6;color:#4b4238;">Recebemos o seu orçamento <b>' . em_e($numero) . '</b>. '
      . 'Vamos confirmar disponibilidade e responder em breve' . ($v['preferencia'] ? ' por <b>' . em_e($v['preferencia']) . '</b>' : '') . '.</p>'
      . em_itens($calc) . $aviso
      . '<p style="margin:0 0 18px;font-size:13px;color:#8a7f6e;">Precisa complementar alguma informação? É só responder este e-mail.</p>';
    $textoConf = "Olá, $primeiro!\n\nRecebemos o seu orçamento $numero.\n\n" . $texto;
    em_enviar($v['email'], $cfg['REMETENTE'], $cfg['DESTINO'], "Recebemos seu orçamento $numero — GR Scan",
        em_layout("Orçamento $numero recebido", 'Recebemos seu orçamento!', $numero . ' · ' . $valorTxt, $corpoConf), $textoConf);
}

responder(200, $resp);
