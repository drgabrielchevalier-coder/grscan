<?php
require_once __DIR__ . '/../../app/precos.php';

foreach (['180,00' => 18000, '180' => 18000, '1.234,56' => 123456, ' 25,5 ' => 2550, '0' => 0, 'R$ 90,00' => 9000] as $txt => $esp)
    afirmar(dinheiro_para_centavos($txt) === $esp, "dinheiro: '$txt' → $esp", dinheiro_para_centavos($txt));
foreach (['abc', '-10', '1,234', '10,999', '1.2.3'] as $txt)
    afirmar(dinheiro_para_centavos($txt) === false, "dinheiro: '$txt' é recusado");
afirmar(dinheiro_para_centavos('') === null, 'dinheiro: vazio = sem preço');

$a = precos_padrao(); $b = $a;
$b['procedimentos'][0]['preco'] = 18500;
$b['componentes'][1]['disponivel'] = false;
$b['regioes'][] = ['id' => 'petropolis', 'nome' => 'Petrópolis', 'taxa' => 15000, 'sob_consulta' => false];
$b['faixas_desconto'][0]['preco'] = 16500;
$d = precos_diferencas($a, $b);
afirmar(in_array('Ortodontia / alinhadores · preço: R$ 180,00 → R$ 185,00', $d, true), 'diferenças: preço alterado', $d);
afirmar(in_array('TiBase padrão elegível · disponível: sim → não', $d, true), 'diferenças: disponibilidade', $d);
afirmar(in_array('Região incluída: Petrópolis (R$ 150,00)', $d, true), 'diferenças: região nova', $d);
afirmar(in_array('Faixa a partir de 2 pacientes · preço: R$ 170,00 → R$ 165,00', $d, true), 'diferenças: faixa de desconto', $d);
afirmar(precos_diferencas($a, $a) === [], 'diferenças: tabela igual = nenhuma');
afirmar(id_de_nome('Pilar Personalizado 4,5 mm', ['pilar_personalizado_4_5_mm']) === 'pilar_personalizado_4_5_mm_2', 'id a partir do nome, sem repetir');
afirmar(id_de_nome('Coroa sobre implante', []) === 'coroa_sobre_implante', 'id: acentos e espaços');
