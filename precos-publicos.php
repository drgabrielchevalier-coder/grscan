<?php
/* GR Scan — tabela comercial para o orçamento do site (somente preços públicos). */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require __DIR__ . '/app/publico.php';
if ($_SERVER['REQUEST_METHOD'] !== 'GET') { http_response_code(405); echo '{"ok":false}'; exit; }
try {
    echo json_enc(precos_publicos(precos_vigentes(), precos_versao_vigente()));
} catch (Throwable $e) {
    error_log('precos-publicos: ' . $e->getMessage());
    http_response_code(503);
    echo json_enc(['ok' => false, 'message' => 'Tabela de preços indisponível no momento.']);
}
