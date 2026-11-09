<?php
/* ============================================================
   GR Scan — recebe as solicitações de agendamento do site
   ============================================================
   CONFIGURAÇÃO: edite as 3 linhas abaixo.
   - $DESTINO: e-mail que recebe os agendamentos (pode ser o seu Gmail).
   - $REMETENTE: um e-mail do PRÓPRIO domínio do site, criado na Hostinger
     (ex.: agenda@implantstore.com.br). Usar Gmail aqui faz o e-mail cair no spam.
   - $DURACAO_MIN: duração reservada para cada atendimento, em minutos.
*/
$DESTINO     = 'seu-email@exemplo.com';
$REMETENTE   = 'agenda@implantstore.com.br';
$DURACAO_MIN = 60;
/* ============================================================ */

header('Content-Type: application/json; charset=utf-8');
date_default_timezone_set('America/Sao_Paulo');

function responder($ok, $msg = '') {
    http_response_code($ok ? 200 : 400);
    echo json_encode(['ok' => $ok, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') responder(false, 'Método inválido.');
if (strpos($DESTINO, 'exemplo.com') !== false) responder(false, 'Agendamento por e-mail ainda não configurado.');

$d = json_decode(file_get_contents('php://input'), true);
if (!is_array($d)) $d = $_POST;

// Robôs preenchem o campo escondido "website".
if (!empty($d['website'])) responder(true);

$campos = ['trabalho','arcadas','pacientes','laboratorio','clinica','endereco','cidade','data','hora','nome','telefone','email','obs'];
$v = [];
foreach ($campos as $c) {
    $x = isset($d[$c]) ? trim((string)$d[$c]) : '';
    $x = str_replace(["\r", "\0"], '', $x);
    $v[$c] = mb_substr($x, 0, $c === 'obs' ? 800 : 200);
}

foreach (['trabalho','clinica','endereco','cidade','data','hora','nome','telefone','email'] as $c) {
    if ($v[$c] === '') responder(false, 'Preencha todos os campos obrigatórios.');
}
if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) responder(false, 'E-mail inválido.');
if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $v['data']) || !preg_match('/^\d{2}:\d{2}$/', $v['hora'])) responder(false, 'Data ou horário inválido.');

$inicio = DateTime::createFromFormat('Y-m-d H:i', $v['data'] . ' ' . $v['hora'], new DateTimeZone('America/Sao_Paulo'));
if (!$inicio || $inicio < new DateTime()) responder(false, 'Escolha uma data futura.');
$fim = clone $inicio; $fim->modify("+{$DURACAO_MIN} minutes");

// Limite simples contra abuso: 5 envios por IP a cada 10 minutos.
$ip = $_SERVER['REMOTE_ADDR'] ?? '0';
$lock = sys_get_temp_dir() . '/grscan_' . md5($ip);
$hist = is_file($lock) ? array_filter(explode(',', (string)@file_get_contents($lock)), fn($t) => $t > time() - 600) : [];
if (count($hist) >= 5) responder(false, 'Muitas tentativas. Tente novamente em alguns minutos.');
$hist[] = time(); @file_put_contents($lock, implode(',', $hist));

$dataBR = $inicio->format('d/m/Y');
$linhas = [
    'Trabalho'     => $v['trabalho'] . ' — ' . $v['arcadas'] . ((int)$v['pacientes'] > 1 ? ' — ' . (int)$v['pacientes'] . ' pacientes' : ''),
    'Laboratório'  => $v['laboratorio'] ?: '—',
    'Clínica'      => $v['clinica'],
    'Endereço'     => $v['endereco'] . ', ' . $v['cidade'],
    'Data'         => $dataBR . ' às ' . $v['hora'],
    'Dentista'     => $v['nome'],
    'WhatsApp'     => $v['telefone'],
    'E-mail'       => $v['email'],
    'Observações'  => $v['obs'] ?: '—',
];
$texto = "Nova solicitação de agendamento — GR Scan\n\n";
foreach ($linhas as $k => $x) $texto .= $k . ': ' . $x . "\n";
$fone = preg_replace('/\D/', '', $v['telefone']);
if (strlen($fone) <= 11) $fone = '55' . $fone;
$texto .= "\nResponder pelo WhatsApp: https://wa.me/{$fone}\n";
$texto .= "Abra o anexo .ics para adicionar ao Google Agenda.\n";

// Convite de calendário (.ics)
$esc = fn($s) => addcslashes(str_replace("\n", ' ', $s), ',;\\');
$uid = bin2hex(random_bytes(8)) . '@grscan';
$ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GR Scan//Agendamento//PT\r\nMETHOD:PUBLISH\r\nBEGIN:VEVENT\r\n" .
    "UID:{$uid}\r\nDTSTAMP:" . gmdate('Ymd\THis\Z') . "\r\n" .
    "DTSTART;TZID=America/Sao_Paulo:" . $inicio->format('Ymd\THis') . "\r\n" .
    "DTEND;TZID=America/Sao_Paulo:" . $fim->format('Ymd\THis') . "\r\n" .
    "SUMMARY:" . $esc('Escaneamento — ' . $v['clinica'] . ' (' . $v['trabalho'] . ')') . "\r\n" .
    "LOCATION:" . $esc($v['endereco'] . ', ' . $v['cidade']) . "\r\n" .
    "DESCRIPTION:" . $esc(str_replace("\n", ' | ', trim($texto))) . "\r\n" .
    "END:VEVENT\r\nEND:VCALENDAR\r\n";

function enviar($para, $de, $responderPara, $assunto, $texto, $ics = null) {
    $b = 'b' . bin2hex(random_bytes(8));
    $h = "From: GR Scan <{$de}>\r\nReply-To: {$responderPara}\r\nMIME-Version: 1.0\r\n" .
         "Content-Type: multipart/mixed; boundary=\"{$b}\"\r\n";
    $corpo = "--{$b}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: 8bit\r\n\r\n{$texto}\r\n";
    if ($ics) {
        $corpo .= "--{$b}\r\nContent-Type: text/calendar; charset=UTF-8; method=PUBLISH; name=\"agendamento.ics\"\r\n" .
                  "Content-Disposition: attachment; filename=\"agendamento.ics\"\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
                  chunk_split(base64_encode($ics)) . "\r\n";
    }
    $corpo .= "--{$b}--";
    $assunto = '=?UTF-8?B?' . base64_encode($assunto) . '?=';
    return mail($para, $assunto, $corpo, $h, '-f' . $de);
}

$ok = enviar($DESTINO, $REMETENTE, $v['email'],
    "Agendamento: {$v['clinica']} — {$dataBR} {$v['hora']}", $texto, $ics);
if (!$ok) responder(false, 'Não foi possível enviar agora.');

// Cópia para o dentista
$conf = "Olá, {$v['nome']}!\n\nRecebemos sua solicitação de escaneamento intraoral. " .
        "Vamos confirmar o horário com você em breve.\n\n";
foreach (['Trabalho','Clínica','Endereço','Data'] as $k) $conf .= $k . ': ' . $linhas[$k] . "\n";
$conf .= "\nGR Scan — Digital Scan";
enviar($v['email'], $REMETENTE, $DESTINO, 'Recebemos sua solicitação — GR Scan', $conf);

// Registro em planilha, fora da pasta pública quando possível
$dir = is_writable(dirname(__DIR__)) ? dirname(__DIR__) : __DIR__;
$csv = $dir . '/agendamentos-grscan.csv';
$novo = !is_file($csv);
if ($f = @fopen($csv, 'a')) {
    if ($novo) fputcsv($f, array_merge(['recebido_em'], $campos), ';');
    fputcsv($f, array_merge([date('Y-m-d H:i:s')], array_map(fn($c) => $v[$c], $campos)), ';');
    fclose($f);
}

responder(true);
