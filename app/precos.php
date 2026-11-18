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
        if (!is_int($min) || $min < 1) $e[] = 'Faixa de desconto: quantidade mínima inválida.';
        elseif (in_array($min, $mins, true)) $e[] = "Faixa de desconto repetida ($min pacientes).";
        $mins[] = $min;
        $preco($f['preco'] ?? null, 'Faixa de desconto', false);
    }
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
