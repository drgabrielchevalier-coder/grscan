<?php
require_once __DIR__ . '/../../app/publico.php';

$cfg = precos_padrao();
// Campos internos plantados: não podem sair no público
$cfg['procedimentos'][0]['custo'] = 6000;
$cfg['procedimentos'][0]['margem'] = 0.4;
$cfg['componentes'][1]['fornecedor'] = 'Fornecedor X';
$cfg['custos_fixos'] = ['aluguel' => 210000];
$cfg['procedimentos'][1]['disponivel'] = false;
$cfg['componentes'][0]['disponivel'] = false;
$pub = precos_publicos($cfg, 7);
$txt = json_enc($pub);

afirmar($pub['ok'] === true && $pub['versao'] === 7, 'público: ok e versão');
foreach (['custo', 'margem', 'fornecedor', 'custos_fixos', 'aluguel', 'disponivel'] as $k)
    afirmar(strpos($txt, $k) === false, "público: não contém '$k'");
afirmar(!in_array('placas', array_column($pub['procedimentos'], 'id'), true), 'público: procedimento indisponível fica fora');
afirmar(!in_array('transfer', array_column($pub['componentes'], 'id'), true), 'público: componente indisponível fica fora');
afirmar(array_keys($pub['procedimentos'][0]) === ['id', 'nome', 'preco', 'desconto_volume', 'sob_avaliacao', 'grupo', 'implantes'], 'público: procedimento só com os campos comerciais', array_keys($pub['procedimentos'][0]));
afirmar(array_keys($pub['regioes'][0]) === ['id', 'nome', 'taxa', 'sob_consulta'], 'público: região só com os campos comerciais');
afirmar(array_keys($pub) === ['ok', 'versao', 'procedimentos', 'componentes', 'regioes', 'faixas_desconto', 'limite_pacientes'], 'público: só as seções comerciais', array_keys($pub));
$imp = array_values(array_filter($pub['procedimentos'], fn($p) => $p['id'] === 'implantes_multiplos'))[0];
afirmar($imp['implantes'] === ['min' => 2, 'max' => 4] && $imp['grupo'] === 'implante', 'público: faixa de implantes preservada');
