<?php
require_once __DIR__ . '/../../app/calculo.php';
require_once __DIR__ . '/../../app/precos.php';

function caso_expandir(array $pedido): array {
    if (is_string($pedido['pacientes'] ?? null) && preg_match('/^(\d+)x (\w+)$/', $pedido['pacientes'], $m)) {
        $pedido['pacientes'] = array_fill(0, (int)$m[1], ['procedimento' => $m[2]]);
    }
    return $pedido;
}

$casos = json_decode(file_get_contents(__DIR__ . '/../orcamento-casos.json'), true);
foreach ($casos as $c) {
    $cfg = precos_padrao();
    if (!empty($c['publico'])) foreach (['procedimentos', 'componentes'] as $g) foreach ($cfg[$g] as &$x) { unset($x['disponivel']); } unset($x);
    foreach ($c['ajuste_preco'] ?? [] as $pid => $pv) foreach ($cfg['procedimentos'] as &$x) { if ($x['id'] === $pid) $x['preco'] = $pv; } unset($x);
    if (!empty($c['indisponivel'])) foreach ($cfg['procedimentos'] as &$p) { if ($p['id'] === $c['indisponivel']) $p['disponivel'] = false; } unset($p);
    if (!empty($c['promocao'])) $cfg['promocao_deslocamento'] = ['fim' => $c['promocao']];
    $r = orcamento_calcular($cfg, caso_expandir($c['pedido']), isset($c['agora']) ? strtotime($c['agora']) : null);
    $e = $c['esperado'];
    $ok = (count($r['erros']) > 0) === $e['erro'];
    if (!$e['erro']) {
        if (array_key_exists('totais', $e)) $ok = $ok && array_column($r['itens'], 'total') === $e['totais'];
        foreach (['subtotal', 'total', 'pendente', 'deslocamento'] as $k) if (array_key_exists($k, $e)) $ok = $ok && $r[$k] === $e[$k];
        if (array_key_exists('promocao', $e)) $ok = $ok && (count(array_filter($r['itens'], fn($i) => !empty($i['promocao']))) > 0) === $e['promocao'];
        if (array_key_exists('faixa', $e)) $ok = $ok && ($r['faixa']['preco'] ?? null) === $e['faixa'];
    }
    afirmar($ok, 'cálculo: ' . $c['nome'], ['totais' => array_column($r['itens'], 'total'), 'subtotal' => $r['subtotal'], 'total' => $r['total'], 'pendente' => $r['pendente'], 'erros' => $r['erros']]);
}

// Validação da tabela de preços
$cfg = precos_padrao();
afirmar(precos_validar($cfg) === [], 'tabela padrão é válida', precos_validar($cfg));
$ruim = $cfg; $ruim['procedimentos'][0]['preco'] = -100;
afirmar(count(precos_validar($ruim)) > 0, 'tabela: preço negativo é recusado');
$ruim = $cfg; $ruim['procedimentos'][1]['id'] = $ruim['procedimentos'][0]['id'];
afirmar(count(precos_validar($ruim)) > 0, 'tabela: id duplicado é recusado');
$ruim = $cfg; $ruim['regioes'][0]['taxa'] = 12.5;
afirmar(count(precos_validar($ruim)) > 0, 'tabela: valor fracionado é recusado');

// Versões
afirmar(precos_versao_vigente() >= 1, 'banco: grava a tabela padrão na primeira leitura');
$novo = precos_vigentes(); $novo['procedimentos'][0]['preco'] = 18500;
$id = precos_salvar($novo, null, 'teste');
afirmar($id === precos_versao_vigente() && precos_vigentes()['procedimentos'][0]['preco'] === 18500, 'banco: salvar cria versão vigente');
$erro = null; try { precos_salvar($ruim, null, 'ruim'); } catch (InvalidArgumentException $ex) { $erro = $ex; }
afirmar($erro !== null && precos_versao_vigente() === $id, 'banco: tabela inválida não cria versão');
