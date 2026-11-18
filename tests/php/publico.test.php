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
afirmar(array_keys($pub) === ['ok', 'versao', 'agora', 'procedimentos', 'componentes', 'regioes', 'faixas_desconto', 'limite_pacientes', 'promocao_deslocamento'], 'público: só as seções comerciais', array_keys($pub));
afirmar($pub['promocao_deslocamento'] === null && strtotime($pub['agora']) !== false, 'público: sem oferta = null; hora do servidor presente');
$imp = array_values(array_filter($pub['procedimentos'], fn($p) => $p['id'] === 'implantes_multiplos'))[0];
afirmar($imp['implantes'] === ['min' => 2, 'max' => 4] && $imp['grupo'] === 'implante', 'público: faixa de implantes preservada');

// Oferta de deslocamento
$cfg = precos_padrao();
$cfg['promocao_deslocamento'] = ['fim' => date('c', time() + 3600), 'aberta_por' => 'admin@interno'];
$pub = precos_publicos($cfg, 1);
afirmar($pub['promocao_deslocamento'] === ['fim' => $cfg['promocao_deslocamento']['fim']], 'público: oferta ativa expõe só o término', $pub['promocao_deslocamento']);
afirmar(strpos(json_enc($pub), 'admin@interno') === false, 'público: oferta não leva dados internos');
$cfg['promocao_deslocamento'] = ['fim' => date('c', time() - 1)];
afirmar(precos_publicos($cfg, 1)['promocao_deslocamento'] === null, 'público: oferta vencida não aparece');

// Validação e histórico
$cfg = precos_padrao();
$cfg['promocao_deslocamento'] = ['fim' => 'amanhã'];
afirmar(count(precos_validar($cfg)) > 0, 'tabela: término da oferta inválido é recusado');
$cfg['promocao_deslocamento'] = null;
afirmar(precos_validar($cfg) === [], 'tabela: sem oferta (null) é válido');
$b = $cfg; $b['promocao_deslocamento'] = ['fim' => '2026-11-18T18:00:00-03:00'];
afirmar(in_array('Oferta de deslocamento grátis: aberta até 18/11/2026 18:00', precos_diferencas($cfg, $b), true), 'histórico: abertura da oferta', precos_diferencas($cfg, $b));
afirmar(in_array('Oferta de deslocamento grátis: encerrada', precos_diferencas($b, $cfg), true), 'histórico: encerramento da oferta');
