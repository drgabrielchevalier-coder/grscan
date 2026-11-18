<?php
/* Layout das páginas do painel administrativo */
declare(strict_types=1);
require_once __DIR__ . '/auth.php';

function painel_inicio(string $titulo, ?array $admin = null): void {
    header('Content-Type: text/html; charset=utf-8');
    $nav = '';
    if ($admin) {
        $atual = basename($_SERVER['SCRIPT_NAME'] ?? '');
        $itens = ['index.php' => 'Início', 'orcamentos.php' => 'Orçamentos', 'precos.php' => 'Preços', 'historico.php' => 'Histórico', 'administradores.php' => 'Administradores'];
        $links = '';
        foreach ($itens as $arq => $nome) {
            $links .= '<a href="' . $arq . '"' . ($arq === $atual ? ' aria-current="page"' : '') . '>' . $nome . '</a>';
        }
        $nav = '<nav class="nav" aria-label="Painel">' . $links . '</nav>'
             . '<form method="post" action="sair.php" class="sair-form">' . csrf_campo()
             . '<span class="quem">' . h($admin['nome']) . '</span><button type="submit" class="btn btn--line sair">Sair</button></form>';
    }
    echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
       . '<meta name="viewport" content="width=device-width, initial-scale=1">'
       . '<meta name="robots" content="noindex, nofollow">'
       . '<title>' . h($titulo) . ' · Painel GR Scan</title>'
       . '<link rel="icon" href="../assets/favicon.svg" type="image/svg+xml">'
       . '<link rel="stylesheet" href="painel.css?v=4">'
       . '</head><body><header class="topo"><a class="marca" href="index.php"><img src="../assets/logo.svg" alt="" width="34" height="31"><span>GR Scan <small>painel</small></span></a>'
       . $nav . '</header><main class="conteudo">';
}

function painel_fim(): void {
    echo '</main></body></html>';
}

function aviso(string $txt, string $tipo = 'erro'): string {
    return '<p class="aviso aviso--' . $tipo . '" role="' . ($tipo === 'erro' ? 'alert' : 'status') . '">' . h($txt) . '</p>';
}

function brl_painel(?int $c): string {
    return $c === null ? 'sob consulta' : 'R$ ' . number_format($c / 100, 2, ',', '.');
}
