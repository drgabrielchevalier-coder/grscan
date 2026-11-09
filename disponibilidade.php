<?php
/* GR Scan — devolve os horários livres lidos do Google Agenda (JSON). */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
require __DIR__ . '/agenda-google.php';

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
    echo json_encode(['ok' => false, 'motivo' => 'erro_google']);
}
