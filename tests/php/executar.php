<?php
/* Executor dos testes PHP. Uso: GRSCAN_DADOS=/pasta/temporaria php tests/php/executar.php
   Roda todos os arquivos *.test.php desta pasta. Cada teste usa afirmar(). */
error_reporting(E_ALL);
ini_set('display_errors', '1');
if (!getenv('GRSCAN_DADOS')) {
    $tmp = sys_get_temp_dir() . '/grscan-testes-' . getmypid();
    putenv('GRSCAN_DADOS=' . $tmp);
}
putenv('GRSCAN_SEM_EMAIL=1');

$GLOBALS['__falhas'] = 0;
$GLOBALS['__total'] = 0;
function afirmar($cond, string $nome, $info = ''): void {
    $GLOBALS['__total']++;
    if ($cond) { echo "PASS $nome\n"; return; }
    $GLOBALS['__falhas']++;
    echo "FAIL $nome" . ($info !== '' ? '  -> ' . (is_string($info) ? $info : json_encode($info, JSON_UNESCAPED_UNICODE)) : '') . "\n";
}
/* Apaga a pasta de dados dos testes para cada arquivo começar do zero */
function limpar_dados(): void {
    $d = getenv('GRSCAN_DADOS');
    if ($d && is_dir($d)) { foreach (glob($d . '/{,.}[!.]*', GLOB_BRACE) ?: [] as $f) if (is_file($f)) unlink($f); }
    if (function_exists('db_resetar')) db_resetar();
}

$filtro = $argv[1] ?? '';
foreach (glob(__DIR__ . '/*.test.php') as $arq) {
    if ($filtro && strpos(basename($arq), $filtro) === false) continue;
    echo "== " . basename($arq) . "\n";
    limpar_dados();
    require $arq;
}
echo "\n" . ($GLOBALS['__total'] - $GLOBALS['__falhas']) . "/" . $GLOBALS['__total'] . " passaram\n";
exit($GLOBALS['__falhas'] ? 1 : 0);
