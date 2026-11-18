<?php
require __DIR__ . '/../app/painel.php';
cabecalhos_painel();
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); exit; }
csrf_verificar();
$a = admin_atual();
if ($a) auditar((int)$a['id'], 'logout');
$_SESSION = [];
$p = session_get_cookie_params();
setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
session_destroy();
header('Location: entrar.php', true, 303);
