<?php
/* GR Scan — devolve os horários livres lidos do Google Agenda (JSON).
   Diagnóstico: abra disponibilidade.php?diagnostico=1 para testar cada etapa da conexão. */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/agenda-google.php';

if (isset($_GET['diagnostico'])) {
    $c = ag_config(); $r = [];
    $r['1_arquivo_chave'] = is_readable($c['ARQUIVO_CHAVE']) ? 'ok' : 'NÃO ENCONTRADO em ' . $c['ARQUIVO_CHAVE'];
    $r['2_php'] = (function_exists('curl_init') ? 'curl ok' : 'SEM curl') . ', ' . (function_exists('openssl_sign') ? 'openssl ok' : 'SEM openssl');
    if (is_readable($c['ARQUIVO_CHAVE'])) {
        $k = json_decode((string)file_get_contents($c['ARQUIVO_CHAVE']), true);
        $r['3_conta_servico'] = $k['client_email'] ?? 'arquivo .json inválido';
        $tz = new DateTimeZone($c['FUSO']); $de = new DateTimeImmutable('today', $tz); $ate = $de->modify('+7 days');
        try { ag_token(); $r['4_login_google'] = 'ok'; }
        catch (Throwable $e) { $r['4_login_google'] = 'ERRO: ' . $e->getMessage(); }
        if (($r['4_login_google'] ?? '') === 'ok') {
            try { $r['5_agenda_disponivel'] = 'ok (' . count(ag_janelas($de, $ate)) . ' blocos nos próximos 7 dias)'; }
            catch (Throwable $e) { $r['5_agenda_disponivel'] = 'ERRO: ' . $e->getMessage(); }
            try { $r['6_agenda_principal'] = 'ok (' . count(ag_ocupados($de, $ate)) . ' compromissos nos próximos 7 dias)'; }
            catch (Throwable $e) { $r['6_agenda_principal'] = 'ERRO: ' . $e->getMessage(); }
        }
    }
    $r['hora_do_servidor'] = date('c');
    echo json_encode($r, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

if (!ag_ativa()) {
    echo json_encode(['ok' => false, 'motivo' => 'nao_configurado']);
    exit;
}

// cache curto (60 s) para não consultar o Google a cada visitante
$c = ag_config();
$cache = sys_get_temp_dir() . '/grscan_disp_' . md5($c['AGENDA_DISPONIVEL'] . $c['AGENDA_COMPROMISSOS']);
if (is_file($cache) && filemtime($cache) > time() - 60) {
    readfile($cache);
    exit;
}

try {
    $out = json_encode(['ok' => true, 'fuso' => $c['FUSO'], 'duracao' => $c['DURACAO_MIN'], 'dias' => ag_horarios_livres()], JSON_UNESCAPED_UNICODE);
    @file_put_contents($cache, $out);
    echo $out;
} catch (Throwable $e) {
    error_log('[GR Scan] disponibilidade: ' . $e->getMessage());
    http_response_code(502);
    echo json_encode(['ok' => false, 'motivo' => 'erro_google', 'dica' => 'Abra disponibilidade.php?diagnostico=1 para ver o detalhe.']);
}
