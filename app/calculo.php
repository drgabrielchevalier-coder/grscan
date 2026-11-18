<?php
/* ============================================================
   Regras de cálculo do orçamento (espelhadas em assets/orcamento-calculo.js).
   Mesmos casos de teste nos dois lados: tests/orcamento-casos.json.
   Valores em centavos. Nunca lança exceção: problemas vão em 'erros'.
   ============================================================ */
declare(strict_types=1);
require_once __DIR__ . '/base.php';

/* Oferta de deslocamento grátis ativa no instante $agora? Devolve o término (ISO) ou null */
function oferta_deslocamento_ativa(array $cfg, ?int $agora = null): ?string {
    $fim = $cfg['promocao_deslocamento']['fim'] ?? null;
    if (!is_string($fim) || ($t = strtotime($fim)) === false) return null;
    return $t > ($agora ?? time()) ? $fim : null;
}

function orcamento_calcular(array $cfg, array $pedido, ?int $agora = null): array {
    $erros = []; $itens = [];
    $porId = fn(array $lista) => array_column($lista, null, 'id');
    $procs = $porId($cfg['procedimentos'] ?? []);
    $comps = $porId($cfg['componentes'] ?? []);
    $regs = $porId($cfg['regioes'] ?? []);
    $limite = (int)($cfg['limite_pacientes'] ?? 30);

    $pacientes = $pedido['pacientes'] ?? null;
    if (!is_array($pacientes) || !array_is_list($pacientes) || count($pacientes) === 0) {
        $erros[] = 'Adicione ao menos um paciente.';
        $pacientes = [];
    } elseif (count($pacientes) > $limite) {
        $erros[] = "Até $limite pacientes por orçamento. Para mais, fale com a GR Scan.";
        $pacientes = [];
    }
    $n = count($pacientes);

    // Faixa de desconto pelo total de pacientes da visita
    $faixa = null;
    $faixas = $cfg['faixas_desconto'] ?? [];
    usort($faixas, fn($a, $b) => $a['min'] <=> $b['min']);
    foreach ($faixas as $f) if ($n >= $f['min']) $faixa = $f;

    foreach ($pacientes as $i => $p) {
        $num = $i + 1;
        if (!is_array($p)) { $erros[] = "Paciente $num: dados inválidos."; continue; }
        $escolha = is_string($p['procedimento'] ?? null) ? $p['procedimento'] : '';
        $proc = null; $implantes = null; $descricao = '';

        if ($escolha === 'implante' || isset($procs[$escolha]['implantes'])) {
            $implantes = inteiro_ou_null($p['implantes'] ?? ($escolha === 'implante' ? null : ($procs[$escolha]['implantes']['min'] ?? 1)));
            if ($implantes === null || $implantes < 1 || $implantes > 32) { $erros[] = "Paciente $num: informe a quantidade de implantes (1 a 32)."; continue; }
        }
        if ($escolha === 'implante') {
            foreach ($procs as $x) {
                $r = $x['implantes'] ?? null;
                if (($x['grupo'] ?? '') === 'implante' && ($x['disponivel'] ?? true) !== false && $r
                    && $implantes >= $r['min'] && ($r['max'] === null || $implantes <= $r['max'])) { $proc = $x; break; }
            }
            $descricao = $proc ? $proc['nome'] : 'Implantes';
            $descricao .= ' · ' . $implantes . ($implantes === 1 ? ' implante' : ' implantes');
        } elseif (isset($procs[$escolha]) && ($procs[$escolha]['disponivel'] ?? true) !== false) {
            $proc = $procs[$escolha];
            $descricao = $proc['nome'] . ($implantes !== null && $implantes > 1 ? ' · ' . $implantes . ' implantes' : '');
        } else {
            $erros[] = "Paciente $num: procedimento indisponível."; continue;
        }

        // Escaneamento
        if (!$proc || !empty($proc['sob_avaliacao']) || $proc['preco'] === null) {
            $itens[] = ['paciente' => $num, 'tipo' => 'escaneamento', 'id' => $proc['id'] ?? 'implante', 'descricao' => $descricao,
                        'qtd' => 1, 'unitario' => null, 'total' => null, 'preco_base' => null, 'desconto' => 0, 'sob_avaliacao' => true];
        } else {
            $base = (int)$proc['preco'];
            $unit = (!empty($proc['desconto_volume']) && $faixa) ? min($base, (int)$faixa['preco']) : $base;
            $itens[] = ['paciente' => $num, 'tipo' => 'escaneamento', 'id' => $proc['id'], 'descricao' => $descricao,
                        'qtd' => 1, 'unitario' => $unit, 'total' => $unit, 'preco_base' => $base, 'desconto' => $base - $unit, 'sob_avaliacao' => false];
        }

        // Componentes (só com seleção, só em implantes, até o nº de implantes)
        foreach (['transfer' => 'transfers', 'tibase' => 'tibases'] as $cid => $campo) {
            if (!array_key_exists($campo, $p) || $p[$campo] === '' || $p[$campo] === null) continue;
            $q = inteiro_ou_null($p[$campo]);
            if ($q === null || $q < 0) { $erros[] = "Paciente $num: quantidade inválida de {$campo}."; continue; }
            if ($q === 0) continue;
            if ($implantes === null) { $erros[] = "Paciente $num: transfers e TiBases só para implantes."; continue; }
            if ($q > $implantes) { $erros[] = "Paciente $num: no máximo $implantes $campo (um por implante)."; continue; }
            $c = $comps[$cid] ?? null;
            if (!$c || ($c['disponivel'] ?? true) === false) { $erros[] = "Paciente $num: componente indisponível."; continue; }
            $sob = !empty($c['sob_avaliacao']) || $c['preco'] === null;
            $itens[] = ['paciente' => $num, 'tipo' => $cid, 'id' => $cid, 'descricao' => $c['nome'], 'qtd' => $q,
                        'unitario' => $sob ? null : (int)$c['preco'], 'total' => $sob ? null : $q * (int)$c['preco'],
                        'preco_base' => $sob ? null : (int)$c['preco'], 'desconto' => 0, 'sob_avaliacao' => $sob];
        }
    }

    // Deslocamento: uma taxa por visita
    $regiaoId = is_string($pedido['regiao'] ?? null) ? $pedido['regiao'] : '';
    $deslocamento = null;
    $oferta = oferta_deslocamento_ativa($cfg, $agora);
    if (!isset($regs[$regiaoId])) {
        $erros[] = 'Escolha a região da clínica.';
    } else {
        $r = $regs[$regiaoId];
        $sob = !empty($r['sob_consulta']) || $r['taxa'] === null;
        $taxa = $sob ? null : (int)$r['taxa'];
        $promo = $oferta !== null && $taxa !== null && $taxa > 0;
        $deslocamento = $promo ? 0 : $taxa;
        $itens[] = ['paciente' => null, 'tipo' => 'deslocamento', 'id' => $r['id'], 'descricao' => 'Deslocamento · ' . $r['nome'],
                    'qtd' => 1, 'unitario' => $deslocamento, 'total' => $deslocamento, 'preco_base' => $taxa,
                    'desconto' => $promo ? $taxa : 0, 'sob_avaliacao' => $sob, 'promocao' => $promo];
    }

    $subtotal = 0; $pendente = false;
    foreach ($itens as $it) { if ($it['total'] === null) $pendente = true; else $subtotal += $it['total']; }

    return [
        'itens' => $itens,
        'faixa' => $faixa ? ['min' => (int)$faixa['min'], 'preco' => (int)$faixa['preco']] : null,
        'pacientes' => $n,
        'promocao' => $oferta !== null ? ['fim' => $oferta] : null,
        'deslocamento' => $deslocamento,
        'subtotal' => $subtotal,
        'total' => $pendente ? null : $subtotal,
        'pendente' => $pendente,
        'erros' => $erros,
    ];
}
