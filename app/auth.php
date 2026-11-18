<?php
/* Autenticação do painel: sessão segura, CSRF, bloqueio por tentativas, auditoria.
   Tudo é verificado no servidor; nenhuma página do painel funciona sem sessão válida. */
declare(strict_types=1);
require_once __DIR__ . '/base.php';
require_once __DIR__ . '/totp.php';

const SESSAO_INATIVIDADE = 1800;       // 30 min
const BLOQUEIO_JANELA = 900;           // 15 min
const BLOQUEIO_POR_EMAIL = 5;
const BLOQUEIO_POR_IP = 20;

function https(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function ip_cliente(): string { return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45); }

function cabecalhos_painel(): void {
    header('X-Robots-Tag: noindex, nofollow');
    header('Cache-Control: no-store, max-age=0');
    header('X-Frame-Options: DENY');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: same-origin');
    header("Content-Security-Policy: default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'");
}

function sessao_iniciar(): void {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $dir = pasta_dados() . '/sessoes';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    session_save_path($dir);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string)SESSAO_INATIVIDADE);
    session_name('grscan_admin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/admin/', 'secure' => https(), 'httponly' => true, 'samesite' => 'Strict']);
    session_start();
    $agora = time();
    if (isset($_SESSION['visto']) && $agora - $_SESSION['visto'] > SESSAO_INATIVIDADE) {
        $_SESSION = [];
        session_regenerate_id(true);
    }
    $_SESSION['visto'] = $agora;
}

function admin_por_id(int $id): ?array {
    $st = db()->prepare('SELECT id, email, nome, senha_hash, totp_segredo, totp_ativo, totp_ultimo, ativo, criado_em FROM admins WHERE id = ?');
    $st->execute([$id]);
    return $st->fetch() ?: null;
}

function admin_atual(): ?array {
    sessao_iniciar();
    if (($_SESSION['etapa'] ?? '') !== 'ok' || empty($_SESSION['admin_id'])) return null;
    $a = admin_por_id((int)$_SESSION['admin_id']);
    if (!$a || !$a['ativo']) { $_SESSION = []; return null; }
    return $a;
}

function exigir_admin(): array {
    cabecalhos_painel();
    $a = admin_atual();
    if ($a) return $a;
    $json = str_contains($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json');
    if ($json) { http_response_code(401); header('Content-Type: application/json'); echo '{"ok":false}'; exit; }
    header('Location: entrar.php', true, 302);
    exit;
}

function csrf_token(): string {
    sessao_iniciar();
    return $_SESSION['csrf'] ??= bin2hex(random_bytes(32));
}

function csrf_campo(): string { return '<input type="hidden" name="csrf" value="' . h(csrf_token()) . '">'; }

function csrf_verificar(): void {
    sessao_iniciar();
    $t = (string)($_POST['csrf'] ?? $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $t)) {
        http_response_code(403);
        exit('Sessão expirada ou formulário inválido. Recarregue a página.');
    }
}

function login_bloqueado(string $email, string $ip): bool {
    $st = db()->prepare('SELECT chave, COUNT(*) n FROM tentativas_login WHERE chave IN (?, ?) AND criado_em > ? GROUP BY chave');
    $st->execute(['e:' . mb_strtolower($email), 'i:' . $ip, time() - BLOQUEIO_JANELA]);
    foreach ($st->fetchAll() as $r) {
        if ($r['chave'][0] === 'e' && $r['n'] >= BLOQUEIO_POR_EMAIL) return true;
        if ($r['chave'][0] === 'i' && $r['n'] >= BLOQUEIO_POR_IP) return true;
    }
    return false;
}

function login_registrar_falha(string $email, string $ip): void {
    $st = db()->prepare('INSERT INTO tentativas_login (chave, criado_em) VALUES (?, ?)');
    $st->execute(['e:' . mb_strtolower($email), time()]);
    $st->execute(['i:' . $ip, time()]);
    db()->prepare('DELETE FROM tentativas_login WHERE criado_em < ?')->execute([time() - 86400]);
}

function login_limpar(string $email): void {
    db()->prepare('DELETE FROM tentativas_login WHERE chave = ?')->execute(['e:' . mb_strtolower($email)]);
}

function senha_gerar_hash(string $senha): string {
    return password_hash($senha, defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT);
}

function senha_valida(string $senha): ?string {
    if (mb_strlen($senha) < 12) return 'A senha precisa de pelo menos 12 caracteres.';
    if (mb_strlen($senha) > 200) return 'Senha longa demais.';
    return null;
}

function auditar(?int $adminId, string $acao, array $detalhe = []): void {
    db()->prepare('INSERT INTO auditoria (admin_id, acao, detalhe_json, ip, criado_em) VALUES (?, ?, ?, ?, ?)')
        ->execute([$adminId, $acao, json_enc($detalhe), ip_cliente(), agora()]);
}

/* Conclui o login (depois da senha e do código): nova sessão e marca como autenticado */
function login_concluir(array $admin): void {
    session_regenerate_id(true);
    $_SESSION = ['admin_id' => (int)$admin['id'], 'etapa' => 'ok', 'visto' => time(), 'csrf' => bin2hex(random_bytes(32))];
    auditar((int)$admin['id'], 'login');
}

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
