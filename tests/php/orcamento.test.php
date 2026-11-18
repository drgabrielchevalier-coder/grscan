<?php
require_once __DIR__ . '/../../app/orcamentos.php';

$base = [
    'regiao' => 'niteroi',
    'pacientes' => [['procedimento' => 'implante', 'implantes' => 1, 'transfers' => 1, 'tibases' => 1]],
    'dentes' => '36', 'elementos' => '1', 'data_desejada' => '', 'obs' => '',
    'nome' => 'Dra. Ana Teste', 'clinica' => 'Clínica Teste', 'cro' => 'RJ-1', 'telefone' => '(21) 99999-0000',
    'email' => 'ana@exemplo.test', 'preferencia' => 'WhatsApp', 'aceite_privacidade' => true, 'website' => '',
    'total' => 1, // valor vindo do navegador: deve ser ignorado
];

[$st, $r] = orcamento_processar($base, '127.0.0.1');
$ano = date('Y');
afirmar($st === 200 && $r['ok'] && $r['numero'] === "GRS-$ano-00001" && $r['total'] === 38500, 'envio válido: número e total calculados no servidor', $r);
$row = db()->query('SELECT * FROM orcamentos')->fetch();
afirmar($row && (int)$row['total_centavos'] === 38500 && $row['status'] === 'solicitado', 'envio válido: gravado no banco com status solicitado');
$calc = json_decode($row['calculo_json'], true);
afirmar(isset($calc['tabela']['procedimentos']) && (int)$row['precos_versao_id'] === precos_versao_vigente(), 'envio válido: cópia da tabela aplicada');
afirmar(!isset(json_decode($row['dados_json'], true)['total']), 'envio: total do navegador não é gravado');

// Repetição imediata do mesmo pedido: mesmo número, uma linha só
[$st2, $r2] = orcamento_processar($base, '127.0.0.1');
afirmar($r2['numero'] === $r['numero'] && (int)db()->query('SELECT COUNT(*) FROM orcamentos')->fetchColumn() === 1, 'clique duplo: não grava duas vezes');

// Mudança de preço depois não altera o orçamento gravado
$t = precos_vigentes(); $t['procedimentos'][8]['preco'] = 25000; precos_salvar($t, null, 'teste');
$row = db()->query('SELECT total_centavos FROM orcamentos WHERE numero = ' . db()->quote($r['numero']))->fetch();
afirmar((int)$row['total_centavos'] === 38500, 'tabela nova não altera orçamento antigo');

// Novo pedido usa a tabela nova e recebe o próximo número
$outro = $base; $outro['email'] = 'b@exemplo.test';
[, $r3] = orcamento_processar($outro, '127.0.0.1');
afirmar($r3['numero'] === "GRS-$ano-00002" && $r3['total'] === 44500, 'próximo pedido: número sequencial e preço vigente', $r3);

// Validações
$sem = $base; $sem['aceite_privacidade'] = false;
[$s, $x] = orcamento_processar($sem, '127.0.0.1');
afirmar($s === 400 && !$x['ok'], 'sem aceite de privacidade: 400');
$sem = $base; $sem['email'] = 'nao-e-email';
[$s] = orcamento_processar($sem, '127.0.0.1');
afirmar($s === 400, 'e-mail inválido: 400');
$sem = $base; $sem['regiao'] = '';
[$s, $x] = orcamento_processar($sem, '127.0.0.1');
afirmar($s === 400 && strpos($x['message'], 'região') !== false, 'sem região: 400 com a mensagem do cálculo', $x);
$sem = $base; $sem['data_desejada'] = '2000-01-01';
[$s] = orcamento_processar($sem, '127.0.0.1');
afirmar($s === 400, 'data desejada no passado: 400');
$antes = (int)db()->query('SELECT COUNT(*) FROM orcamentos')->fetchColumn();
$robo = $base; $robo['website'] = 'spam'; $robo['email'] = 'robo@exemplo.test';
[$s, $x] = orcamento_processar($robo, '127.0.0.1');
afirmar($s === 200 && $x['ok'] && (int)db()->query('SELECT COUNT(*) FROM orcamentos')->fetchColumn() === $antes, 'robô (campo isca): ok sem gravar');

// Pendente: outras localidades
$pend = $base; $pend['regiao'] = 'outras'; $pend['email'] = 'c@exemplo.test';
[$s, $x] = orcamento_processar($pend, '127.0.0.1');
afirmar($s === 200 && $x['pendente'] === true && $x['total'] === null && $x['subtotal'] === 35500, 'pendente: subtotal e total nulo', $x);
