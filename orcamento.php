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

function enviar($para, $de, $responderPara, $assunto, $texto) {
    $h = "From: GR Scan <{$de}>\r\nReply-To: {$responderPara}\r\nMIME-Version: 1.0\r\n" .
         "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n";
    return mail($para, '=?UTF-8?B?' . base64_encode($assunto) . '?=', $texto, $h, '-f' . $de);
}

$assunto = 'Orçamento: ' . ($v['clinica'] ?: $v['nome']) . ' — ' . mb_strimwidth($trab, 0, 60, '…');
if (!enviar($cfg['DESTINO'], $cfg['REMETENTE'], $v['email'], $assunto, $texto)) {
    responder(false, 'Não foi possível enviar agora. Tente novamente em instantes.', 502);
}

// Confirmação para o solicitante
$conf = "Olá, {$v['nome']}!\n\nRecebemos sua solicitação de orçamento de escaneamento intraoral. " .
        "Vamos analisar e responder em breve" . ($v['preferencia'] ? " por {$v['preferencia']}" : '') . ".\n\n" .
        "Resumo:\nTrabalho: $trab\nDentes: " . ($v['dentes'] ?: '—') . "\nPacientes: " . ($v['pacientes'] ?: '1') .
        "\n\nGR Scan — Digital Scan";
enviar($v['email'], $cfg['REMETENTE'], $cfg['DESTINO'], 'Recebemos seu pedido de orçamento — GR Scan', $conf);

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
