<?php
/* ============================================================
   GR Scan — base do sistema de orçamentos e do painel
   Banco SQLite FORA do public_html (pasta grscan-dados, ao lado dele).
   Nenhum arquivo desta pasta é servido pela web (app/.htaccess).
   ============================================================ */
declare(strict_types=1);
date_default_timezone_set('America/Sao_Paulo');

function raiz_site(): string { return dirname(__DIR__); }

/* Pasta dos dados: GRSCAN_DADOS (testes) ou ../grscan-dados, criada no primeiro uso */
function pasta_dados(): string {
    $p = getenv('GRSCAN_DADOS') ?: dirname(raiz_site()) . '/grscan-dados';
    if (!is_dir($p) && !@mkdir($p, 0700, true) && !is_dir($p)) {
        throw new RuntimeException('Não foi possível criar a pasta de dados.');
    }
    return $p;
}

/* Configuração local (fora do Git): chave de instalação etc. */
function config_local(): array {
    $arq = pasta_dados() . '/grscan-config.php';
    return is_file($arq) ? (array)require $arq : [];
}

function db(): PDO {
    if (isset($GLOBALS['__grscan_db'])) return $GLOBALS['__grscan_db'];
    $pdo = new PDO('sqlite:' . pasta_dados() . '/grscan.sqlite', null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    db_migrar($pdo);
    return $GLOBALS['__grscan_db'] = $pdo;
}

/* Testes: descarta a conexão para reabrir um banco novo */
function db_resetar(): void { unset($GLOBALS['__grscan_db']); }

function db_migrar(PDO $pdo): void {
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        nome TEXT NOT NULL,
        senha_hash TEXT NOT NULL,
        totp_segredo TEXT,
        totp_ativo INTEGER NOT NULL DEFAULT 0,
        ativo INTEGER NOT NULL DEFAULT 1,
        criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS precos_versoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        json TEXT NOT NULL,
        criado_em TEXT NOT NULL,
        admin_id INTEGER REFERENCES admins(id),
        nota TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS auditoria (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER REFERENCES admins(id),
        acao TEXT NOT NULL,
        detalhe_json TEXT NOT NULL DEFAULT '{}',
        ip TEXT NOT NULL DEFAULT '',
        criado_em TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS orcamentos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        numero TEXT NOT NULL UNIQUE,
        criado_em TEXT NOT NULL,
        dados_json TEXT NOT NULL,
        pedido_json TEXT NOT NULL,
        calculo_json TEXT NOT NULL,
        precos_versao_id INTEGER REFERENCES precos_versoes(id),
        total_centavos INTEGER,
        subtotal_centavos INTEGER NOT NULL,
        pendente INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'solicitado',
        assinatura TEXT NOT NULL,
        ip TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS orcamentos_assinatura ON orcamentos(assinatura, criado_em);
    CREATE TABLE IF NOT EXISTS tentativas_login (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chave TEXT NOT NULL,
        criado_em INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tentativas_chave ON tentativas_login(chave, criado_em);
    ");
}

function agora(): string { return date('Y-m-d H:i:s'); }

function json_enc($v): string { return json_encode($v, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); }

/* Inteiro estrito: aceita int, ou string só de dígitos (com sinal opcional); senão null */
function inteiro_ou_null($v): ?int {
    if (is_int($v)) return $v;
    if (is_string($v) && preg_match('/^-?\d{1,9}$/', trim($v))) return (int)$v;
    if (is_float($v) && floor($v) === $v && abs($v) < 1e9) return (int)$v;
    return null;
}
