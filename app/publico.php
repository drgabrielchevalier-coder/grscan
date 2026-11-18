<?php
/* Visão pública da tabela: copia campo a campo de uma lista fechada.
   Nunca devolve o objeto inteiro, para que campos internos (custos, margens,
   fornecedores) nunca cheguem ao navegador do visitante. */
declare(strict_types=1);
require_once __DIR__ . '/precos.php';

function precos_publicos(array $cfg, int $versao, ?int $agora = null): array {
    require_once __DIR__ . '/calculo.php';
    $agora ??= time();
    $disp = fn(array $x) => !empty($x['disponivel']);
    $procs = [];
    foreach (array_filter($cfg['procedimentos'] ?? [], $disp) as $p) {
        $procs[] = [
            'id' => (string)$p['id'],
            'nome' => (string)$p['nome'],
            'preco' => isset($p['preco']) ? (int)$p['preco'] : null,
            'desconto_volume' => !empty($p['desconto_volume']),
            'sob_avaliacao' => !empty($p['sob_avaliacao']),
            'grupo' => isset($p['grupo']) ? (string)$p['grupo'] : null,
            'implantes' => isset($p['implantes']) ? [
                'min' => (int)$p['implantes']['min'],
                'max' => isset($p['implantes']['max']) ? (int)$p['implantes']['max'] : null,
            ] : null,
        ];
    }
    $comps = [];
    foreach (array_filter($cfg['componentes'] ?? [], $disp) as $c) {
        $comps[] = [
            'id' => (string)$c['id'],
            'nome' => (string)$c['nome'],
            'preco' => isset($c['preco']) ? (int)$c['preco'] : null,
            'sob_avaliacao' => !empty($c['sob_avaliacao']),
        ];
    }
    $regs = [];
    foreach ($cfg['regioes'] ?? [] as $r) {
        $regs[] = [
            'id' => (string)$r['id'],
            'nome' => (string)$r['nome'],
            'taxa' => isset($r['taxa']) ? (int)$r['taxa'] : null,
            'sob_consulta' => !empty($r['sob_consulta']),
        ];
    }
    $faixas = [];
    foreach ($cfg['faixas_desconto'] ?? [] as $f) $faixas[] = ['min' => (int)$f['min'], 'preco' => (int)$f['preco']];
    return [
        'ok' => true,
        'versao' => $versao,
        'agora' => date('c', $agora),
        'procedimentos' => $procs,
        'componentes' => $comps,
        'regioes' => $regs,
        'faixas_desconto' => $faixas,
        'limite_pacientes' => (int)($cfg['limite_pacientes'] ?? 30),
        'promocao_deslocamento' => ($fim = oferta_deslocamento_ativa($cfg, $agora)) !== null ? ['fim' => $fim] : null,
    ];
}
