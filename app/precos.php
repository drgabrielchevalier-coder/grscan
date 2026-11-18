<?php
/* Tabela comercial de preços: versões no banco, a mais recente é a vigente. Valores em centavos. */
declare(strict_types=1);
require_once __DIR__ . '/base.php';

function precos_padrao(): array {
    return json_decode(file_get_contents(__DIR__ . '/precos-padrao.json'), true, 32, JSON_THROW_ON_ERROR);
}

/* Lista de erros (vazia = tabela válida) */
function precos_validar(array $c): array {
    $e = [];
    $preco = function ($v, string $onde, bool $podeNulo) use (&$e) {
        if ($v === null) { if (!$podeNulo) $e[] = "$onde: preço obrigatório."; return; }
        if (!is_int($v) || $v < 0 || $v > 100000000) $e[] = "$onde: valor inválido (use centavos, sem negativos).";
    };
    $ids = function (array $lista, string $grupo) use (&$e) {
        $vistos = [];
        foreach ($lista as $i => $x) {
            $id = $x['id'] ?? '';
            if (!is_string($id) || !preg_match('/^[a-z0-9_]{1,40}$/', $id)) $e[] = "$grupo #" . ($i + 1) . ': identificador inválido.';
            elseif (isset($vistos[$id])) $e[] = "$grupo: identificador repetido ($id).";
            $vistos[$id] = true;
            $nome = $x['nome'] ?? '';
            if (!is_string($nome) || trim($nome) === '' || mb_strlen($nome) > 80) $e[] = "$grupo: nome inválido ($id).";
        }
    };
    foreach (['procedimentos', 'componentes', 'regioes', 'faixas_desconto'] as $k) {
        if (!isset($c[$k]) || !is_array($c[$k]) || !array_is_list($c[$k])) $e[] = "Seção $k ausente.";
    }
    if ($e) return $e;
    if (!$c['procedimentos']) $e[] = 'Cadastre ao menos um procedimento.';
    if (!$c['regioes']) $e[] = 'Cadastre ao menos uma região.';
    $ids($c['procedimentos'], 'Procedimentos');
    $ids($c['componentes'], 'Componentes');
    $ids($c['regioes'], 'Regiões');
    foreach ($c['procedimentos'] as $p) {
        $sob = !empty($p['sob_avaliacao']);
        $preco($p['preco'] ?? null, 'Procedimento ' . ($p['nome'] ?? ''), $sob);
        if (isset($p['implantes'])) {
            $min = $p['implantes']['min'] ?? null; $max = $p['implantes']['max'] ?? null;
            if (!is_int($min) || $min < 1 || ($max !== null && (!is_int($max) || $max < $min))) $e[] = 'Procedimento ' . ($p['nome'] ?? '') . ': faixa de implantes inválida.';
        }
    }
    foreach ($c['componentes'] as $p) $preco($p['preco'] ?? null, 'Componente ' . ($p['nome'] ?? ''), !empty($p['sob_avaliacao']));
    foreach ($c['regioes'] as $r) $preco($r['taxa'] ?? null, 'Região ' . ($r['nome'] ?? ''), !empty($r['sob_consulta']));
    $mins = [];
    foreach ($c['faixas_desconto'] as $f) {
        $min = $f['min'] ?? null;
        if (!is_int($min) || $min < 2) $e[] = 'Faixa de desconto: a partir de 2 pacientes (com 1 paciente vale o preço da tabela).';
        elseif (in_array($min, $mins, true)) $e[] = "Faixa de desconto repetida ($min pacientes).";
        $mins[] = $min;
        $preco($f['preco'] ?? null, 'Faixa de desconto', false);
    }
    $of = $c['promocao_deslocamento'] ?? null;
    if ($of !== null && (!is_array($of) || !is_string($of['fim'] ?? null) || strtotime($of['fim']) === false)) $e[] = 'Oferta de deslocamento: data de término inválida.';
    $lim = $c['limite_pacientes'] ?? null;
    if (!is_int($lim) || $lim < 1 || $lim > 200) $e[] = 'Limite de pacientes inválido (1 a 200).';
    return $e;
}

function precos_vigentes(): array {
    $row = db()->query('SELECT json FROM precos_versoes ORDER BY id DESC LIMIT 1')->fetch();
    if (!$row) { precos_salvar(precos_padrao(), null, 'Tabela inicial'); return precos_vigentes(); }
    return json_decode($row['json'], true);
}

function precos_versao_vigente(): int {
    $id = db()->query('SELECT MAX(id) FROM precos_versoes')->fetchColumn();
    if (!$id) { precos_vigentes(); return precos_versao_vigente(); }
    return (int)$id;
}

function precos_salvar(array $cfg, ?int $adminId, string $nota): int {
    $erros = precos_validar($cfg);
    if ($erros) throw new InvalidArgumentException(implode("\n", $erros));
    $st = db()->prepare('INSERT INTO precos_versoes (json, criado_em, admin_id, nota) VALUES (?, ?, ?, ?)');
    $st->execute([json_enc($cfg), agora(), $adminId, mb_substr($nota, 0, 300)]);
    return (int)db()->lastInsertId();
}

/* "1.234,56", "180", "R$ 90,00" → centavos; vazio → null; inválido → false */
function dinheiro_para_centavos(string $txt) {
    $t = trim(str_replace(['R$', ' ', "\u{a0}"], '', $txt));
    if ($t === '') return null;
    if (!preg_match('/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/', $t)) return false;
    [$int, $dec] = array_pad(explode(',', $t), 2, '');
    $c = (int)str_replace('.', '', $int) * 100 + (int)str_pad($dec, 2, '0');
    return $c <= 100000000 ? $c : false;
}

/* Identificador a partir do nome, sem repetir os existentes */
function id_de_nome(string $nome, array $existentes): string {
    $base = strtolower(trim(preg_replace('/[^a-z0-9]+/i', '_', iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $nome) ?: ''), '_'));
    $base = substr($base !== '' ? $base : 'item', 0, 36);
    $id = $base; $n = 2;
    while (in_array($id, $existentes, true)) $id = $base . '_' . $n++;
    return $id;
}

/* Lista legível do que mudou entre duas versões da tabela */
function precos_diferencas(array $a, array $b): array {
    $brl = fn($c) => $c === null ? 'sob consulta' : 'R$ ' . number_format($c / 100, 2, ',', '.');
    $sn = fn($v) => $v ? 'sim' : 'não';
    $out = [];
    $campos = ['nome' => ['nome', fn($v) => (string)$v], 'preco' => ['preço', $brl], 'disponivel' => ['disponível', $sn],
               'sob_avaliacao' => ['sob avaliação', $sn], 'desconto_volume' => ['desconto por volume', $sn],
               'taxa' => ['taxa', $brl], 'sob_consulta' => ['sob consulta', $sn]];
    foreach (['procedimentos' => 'Procedimento', 'componentes' => 'Componente', 'regioes' => 'Região'] as $sec => $rotulo) {
        $va = array_column($a[$sec] ?? [], null, 'id'); $vb = array_column($b[$sec] ?? [], null, 'id');
        foreach ($vb as $id => $x) {
            if (!isset($va[$id])) {
                $valor = $sec === 'regioes' ? ($x['taxa'] ?? null) : ($x['preco'] ?? null);
                $out[] = ($sec === 'regioes' ? 'Região incluída' : "$rotulo incluído") . ': ' . $x['nome'] . ' (' . $brl($valor) . ')';
                continue;
            }
            foreach ($campos as $k => [$nomeCampo, $fmt]) {
                if (!array_key_exists($k, $x) && !array_key_exists($k, $va[$id])) continue;
                $de = $va[$id][$k] ?? null; $para = $x[$k] ?? null;
                if (in_array($k, ['disponivel', 'sob_avaliacao', 'desconto_volume', 'sob_consulta'], true)) { $de = !empty($de); $para = !empty($para); }
                if ($de !== $para) $out[] = $va[$id]['nome'] . " · $nomeCampo: " . $fmt($de) . ' → ' . $fmt($para);
            }
            if (($va[$id]['implantes'] ?? null) != ($x['implantes'] ?? null)) $out[] = $x['nome'] . ' · faixa de implantes alterada';
        }
        foreach ($va as $id => $x) if (!isset($vb[$id])) $out[] = ($sec === 'regioes' ? 'Região removida' : "$rotulo removido") . ': ' . $x['nome'];
    }
    $fa = array_column($a['faixas_desconto'] ?? [], 'preco', 'min'); $fb = array_column($b['faixas_desconto'] ?? [], 'preco', 'min');
    foreach ($fb as $min => $p) {
        if (!isset($fa[$min])) $out[] = "Faixa incluída: a partir de $min pacientes (" . $brl($p) . ')';
        elseif ($fa[$min] !== $p) $out[] = "Faixa a partir de $min pacientes · preço: " . $brl($fa[$min]) . ' → ' . $brl($p);
    }
    foreach ($fa as $min => $p) if (!isset($fb[$min])) $out[] = "Faixa removida: a partir de $min pacientes";
    $oa = $a['promocao_deslocamento']['fim'] ?? null; $ob = $b['promocao_deslocamento']['fim'] ?? null;
    if ($oa !== $ob) $out[] = $ob === null ? 'Oferta de deslocamento grátis: encerrada' : 'Oferta de deslocamento grátis: aberta até ' . date('d/m/Y H:i', strtotime($ob));
    if (($a['limite_pacientes'] ?? null) !== ($b['limite_pacientes'] ?? null)) $out[] = 'Limite de pacientes: ' . ($a['limite_pacientes'] ?? '—') . ' → ' . ($b['limite_pacientes'] ?? '—');
    return $out;
}
