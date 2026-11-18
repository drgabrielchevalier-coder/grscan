<?php
/* Editor da tabela comercial. Cada gravação cria uma nova versão (histórico) e vale na hora no site. */
require __DIR__ . '/../app/painel.php';
require __DIR__ . '/../app/precos.php';
$admin = exigir_admin();

$atual = precos_vigentes();
$erros = [];
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
$P = fn(...$k) => array_reduce($k, fn($a, $x) => is_array($a) && array_key_exists($x, $a) ? $a[$x] : null, $_POST);

if ($post) {
    csrf_verificar();
    $novo = $atual;
    $din = function ($txt, string $onde, bool $podeVazio) use (&$erros) {
        $c = dinheiro_para_centavos((string)$txt);
        if ($c === false) { $erros[] = "$onde: valor inválido (ex.: 180,00)."; return 0; }
        if ($c === null && !$podeVazio) { $erros[] = "$onde: informe o valor ou marque como sob consulta."; return 0; }
        return $c;
    };
    $txt = fn($v, int $max = 80) => mb_substr(trim((string)$v), 0, $max);

    foreach ($novo['procedimentos'] as &$p) {
        $f = $P('proc', $p['id']) ?? [];
        $p['nome'] = $txt($f['nome'] ?? $p['nome']) ?: $p['nome'];
        $p['sob_avaliacao'] = !empty($f['sob_avaliacao']);
        $p['disponivel'] = !empty($f['disponivel']);
        $p['desconto_volume'] = !empty($f['desconto_volume']);
        $p['preco'] = $din($f['preco'] ?? '', 'Procedimento ' . $p['nome'], $p['sob_avaliacao']);
        if (isset($p['implantes'])) {
            $min = inteiro_ou_null($f['imp_min'] ?? null); $max = trim((string)($f['imp_max'] ?? ''));
            $p['implantes'] = ['min' => $min ?? 0, 'max' => $max === '' ? null : inteiro_ou_null($max) ?? -1];
        }
    }
    unset($p);

    $comps = [];
    foreach ($novo['componentes'] as $c) {
        $f = $P('comp', $c['id']) ?? [];
        if (!empty($f['remover']) && !in_array($c['id'], ['transfer', 'tibase'], true)) continue;
        $c['nome'] = $txt($f['nome'] ?? $c['nome']) ?: $c['nome'];
        $c['sob_avaliacao'] = !empty($f['sob_avaliacao']);
        $c['disponivel'] = !empty($f['disponivel']);
        $c['preco'] = $din($f['preco'] ?? '', 'Componente ' . $c['nome'], $c['sob_avaliacao']);
        $comps[] = $c;
    }
    $nc = $P('novo_comp') ?? [];
    if (trim((string)($nc['nome'] ?? '')) !== '') {
        $sob = !empty($nc['sob_avaliacao']);
        $comps[] = ['id' => id_de_nome($nc['nome'], array_column($comps, 'id')), 'nome' => $txt($nc['nome']),
                    'preco' => $din($nc['preco'] ?? '', 'Novo componente', $sob), 'disponivel' => true, 'sob_avaliacao' => $sob];
    }
    $novo['componentes'] = $comps;

    $regs = [];
    foreach ($novo['regioes'] as $r) {
        $f = $P('reg', $r['id']) ?? [];
        if (!empty($f['remover'])) continue;
        $r['nome'] = $txt($f['nome'] ?? $r['nome']) ?: $r['nome'];
        $r['sob_consulta'] = !empty($f['sob_consulta']);
        $r['taxa'] = $r['sob_consulta'] ? null : $din($f['taxa'] ?? '', 'Região ' . $r['nome'], false);
        $regs[] = $r;
    }
    $nr = $P('nova_reg') ?? [];
    if (trim((string)($nr['nome'] ?? '')) !== '') {
        $sob = !empty($nr['sob_consulta']);
        $regs[] = ['id' => id_de_nome($nr['nome'], array_column($regs, 'id')), 'nome' => $txt($nr['nome']),
                   'taxa' => $sob ? null : $din($nr['taxa'] ?? '', 'Nova região', false), 'sob_consulta' => $sob];
    }
    $novo['regioes'] = $regs;

    $faixas = [];
    foreach ((array)($P('faixa') ?? []) as $f) {
        if (trim((string)($f['min'] ?? '')) === '' && trim((string)($f['preco'] ?? '')) === '') continue;
        $faixas[] = ['min' => inteiro_ou_null($f['min'] ?? '') ?? 0, 'preco' => $din($f['preco'] ?? '', 'Faixa de desconto', false)];
    }
    usort($faixas, fn($a, $b) => $a['min'] <=> $b['min']);
    $novo['faixas_desconto'] = $faixas;
    $novo['limite_pacientes'] = inteiro_ou_null($P('limite_pacientes')) ?? 0;

    if (!$erros) $erros = precos_validar($novo);
    if (!$erros) {
        $mud = precos_diferencas($atual, $novo);
        if (!$mud) { header('Location: precos.php?igual=1', true, 303); exit; }
        $v = precos_salvar($novo, (int)$admin['id'], $txt($P('nota') ?? '', 300));
        auditar((int)$admin['id'], 'precos_salvos', ['versao' => $v, 'mudancas' => $mud]);
        header('Location: precos.php?salvo=' . $v, true, 303);
        exit;
    }
}

/* Valor para exibir: o enviado (se houve erro) ou o da tabela */
$val = function (array $caminho, $padrao) use ($post, $P) {
    if ($post) { $v = $P(...$caminho); return $v === null ? '' : (string)$v; }
    return $padrao;
};
$din = fn($c) => $c === null ? '' : number_format($c / 100, 2, ',', '.');
$marcado = function (array $caminho, bool $padrao) use ($post, $P) { return ($post ? !empty($P(...$caminho)) : $padrao) ? ' checked' : ''; };

painel_inicio('Preços', $admin);
?>
<h1>Tabela de preços comerciais</h1>
<?php
if (isset($_GET['salvo'])) echo aviso('Tabela salva como versão ' . (int)$_GET['salvo'] . '. O orçamento do site já usa os novos valores.', 'ok');
if (isset($_GET['igual'])) echo aviso('Nenhuma alteração para salvar.', 'ok');
if ($erros) echo aviso("Não foi possível salvar:\n" . implode("\n", $erros));
?>
<p class="dica">Valores em reais (ex.: 180,00). Itens indisponíveis não aparecem no orçamento do site. "Sob avaliação" mostra o item sem preço, e o total fica sujeito à confirmação.</p>
<form method="post">
<?= csrf_campo() ?>
<section class="cartao">
  <h2>Escaneamentos</h2>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Procedimento</th><th class="num">Preço</th><th>Desconto por volume</th><th>Sob avaliação</th><th>Disponível</th><th>Implantes (mín.–máx.)</th></tr></thead><tbody>
    <?php foreach ($atual['procedimentos'] as $p): $id = $p['id']; ?>
      <tr>
        <td><input name="proc[<?= h($id) ?>][nome]" value="<?= h($val(['proc', $id, 'nome'], $p['nome'])) ?>" maxlength="80" aria-label="Nome"></td>
        <td class="num"><input class="dinheiro" name="proc[<?= h($id) ?>][preco]" value="<?= h($val(['proc', $id, 'preco'], $din($p['preco']))) ?>" inputmode="decimal" aria-label="Preço de <?= h($p['nome']) ?>"></td>
        <td><input type="checkbox" name="proc[<?= h($id) ?>][desconto_volume]" value="1"<?= $marcado(['proc', $id, 'desconto_volume'], !empty($p['desconto_volume'])) ?> aria-label="Desconto por volume em <?= h($p['nome']) ?>"></td>
        <td><input type="checkbox" name="proc[<?= h($id) ?>][sob_avaliacao]" value="1"<?= $marcado(['proc', $id, 'sob_avaliacao'], !empty($p['sob_avaliacao'])) ?> aria-label="<?= h($p['nome']) ?> sob avaliação"></td>
        <td><input type="checkbox" name="proc[<?= h($id) ?>][disponivel]" value="1"<?= $marcado(['proc', $id, 'disponivel'], !empty($p['disponivel'])) ?> aria-label="<?= h($p['nome']) ?> disponível"></td>
        <td><?php if (isset($p['implantes'])): ?>
          <input name="proc[<?= h($id) ?>][imp_min]" value="<?= h($val(['proc', $id, 'imp_min'], (string)$p['implantes']['min'])) ?>" inputmode="numeric" class="curto" aria-label="Mínimo de implantes">
          <input name="proc[<?= h($id) ?>][imp_max]" value="<?= h($val(['proc', $id, 'imp_max'], (string)($p['implantes']['max'] ?? ''))) ?>" inputmode="numeric" class="curto" aria-label="Máximo de implantes (vazio = sem limite)">
        <?php else: ?>—<?php endif; ?></td>
      </tr>
    <?php endforeach; ?>
  </tbody></table></div>
</section>

<div class="grade2">
<section class="cartao">
  <h2>Componentes</h2>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Componente</th><th class="num">Preço/unid.</th><th>Sob avaliação</th><th>Disponível</th><th></th></tr></thead><tbody>
    <?php foreach ($atual['componentes'] as $c): $id = $c['id']; ?>
      <tr>
        <td><input name="comp[<?= h($id) ?>][nome]" value="<?= h($val(['comp', $id, 'nome'], $c['nome'])) ?>" maxlength="80" aria-label="Nome"></td>
        <td class="num"><input class="dinheiro" name="comp[<?= h($id) ?>][preco]" value="<?= h($val(['comp', $id, 'preco'], $din($c['preco']))) ?>" inputmode="decimal" aria-label="Preço de <?= h($c['nome']) ?>"></td>
        <td><input type="checkbox" name="comp[<?= h($id) ?>][sob_avaliacao]" value="1"<?= $marcado(['comp', $id, 'sob_avaliacao'], !empty($c['sob_avaliacao'])) ?> aria-label="<?= h($c['nome']) ?> sob avaliação"></td>
        <td><input type="checkbox" name="comp[<?= h($id) ?>][disponivel]" value="1"<?= $marcado(['comp', $id, 'disponivel'], !empty($c['disponivel'])) ?> aria-label="<?= h($c['nome']) ?> disponível"></td>
        <td><?php if (!in_array($id, ['transfer', 'tibase'], true)): ?><label class="dica"><input type="checkbox" name="comp[<?= h($id) ?>][remover]" value="1"> remover</label><?php endif; ?></td>
      </tr>
    <?php endforeach; ?>
      <tr>
        <td><input name="novo_comp[nome]" placeholder="Novo componente especial" maxlength="80" aria-label="Nome do novo componente" value="<?= h($val(['novo_comp', 'nome'], '')) ?>"></td>
        <td class="num"><input class="dinheiro" name="novo_comp[preco]" placeholder="0,00" inputmode="decimal" aria-label="Preço do novo componente" value="<?= h($val(['novo_comp', 'preco'], '')) ?>"></td>
        <td><input type="checkbox" name="novo_comp[sob_avaliacao]" value="1"<?= $marcado(['novo_comp', 'sob_avaliacao'], false) ?> aria-label="Novo componente sob avaliação"></td>
        <td colspan="2" class="dica">entra disponível</td>
      </tr>
  </tbody></table></div>
  <p class="dica">Os componentes especiais ficam guardados para uso futuro; o orçamento do site oferece transfers e TiBases.</p>
</section>

<section class="cartao">
  <h2>Deslocamento por região</h2>
  <div class="tabela-wrap"><table class="tabela">
    <thead><tr><th>Região</th><th class="num">Taxa por visita</th><th>Sob consulta</th><th></th></tr></thead><tbody>
    <?php foreach ($atual['regioes'] as $r): $id = $r['id']; ?>
      <tr>
        <td><input name="reg[<?= h($id) ?>][nome]" value="<?= h($val(['reg', $id, 'nome'], $r['nome'])) ?>" maxlength="80" aria-label="Nome da região"></td>
        <td class="num"><input class="dinheiro" name="reg[<?= h($id) ?>][taxa]" value="<?= h($val(['reg', $id, 'taxa'], $din($r['taxa']))) ?>" inputmode="decimal" aria-label="Taxa de <?= h($r['nome']) ?>"></td>
        <td><input type="checkbox" name="reg[<?= h($id) ?>][sob_consulta]" value="1"<?= $marcado(['reg', $id, 'sob_consulta'], !empty($r['sob_consulta'])) ?> aria-label="<?= h($r['nome']) ?> sob consulta"></td>
        <td><label class="dica"><input type="checkbox" name="reg[<?= h($id) ?>][remover]" value="1"> remover</label></td>
      </tr>
    <?php endforeach; ?>
      <tr>
        <td><input name="nova_reg[nome]" placeholder="Nova região" maxlength="80" aria-label="Nome da nova região" value="<?= h($val(['nova_reg', 'nome'], '')) ?>"></td>
        <td class="num"><input class="dinheiro" name="nova_reg[taxa]" placeholder="0,00" inputmode="decimal" aria-label="Taxa da nova região" value="<?= h($val(['nova_reg', 'taxa'], '')) ?>"></td>
        <td><input type="checkbox" name="nova_reg[sob_consulta]" value="1"<?= $marcado(['nova_reg', 'sob_consulta'], false) ?> aria-label="Nova região sob consulta"></td>
        <td></td>
      </tr>
  </tbody></table></div>
</section>
</div>

<section class="cartao">
  <h2>Desconto por volume (pacientes na mesma visita)</h2>
  <p class="dica">Vale só para os procedimentos marcados com "desconto por volume". Com 1 paciente vale o preço da tabela; aqui ficam os preços a partir de 2 pacientes. Se o preço da faixa for maior que o da tabela, vale o da tabela.</p>
  <table class="tabela estreita">
    <thead><tr><th>A partir de (pacientes)</th><th class="num">Preço por escaneamento</th></tr></thead><tbody>
    <?php $fx = $atual['faixas_desconto']; $fx[] = ['min' => null, 'preco' => null];
    foreach ($fx as $i => $f): ?>
      <tr>
        <td><input name="faixa[<?= $i ?>][min]" value="<?= h($val(['faixa', (string)$i, 'min'], $f['min'] === null ? '' : (string)$f['min'])) ?>" inputmode="numeric" aria-label="Quantidade mínima de pacientes"<?= $f['min'] === null ? ' placeholder="nova faixa"' : '' ?>></td>
        <td class="num"><input class="dinheiro" name="faixa[<?= $i ?>][preco]" value="<?= h($val(['faixa', (string)$i, 'preco'], $din($f['preco']))) ?>" inputmode="decimal" aria-label="Preço da faixa"></td>
      </tr>
    <?php endforeach; ?>
  </tbody></table>
  <p class="dica">Para remover uma faixa, apague a quantidade e o preço.</p>
  <label class="campo limite">Limite de pacientes por orçamento
    <input name="limite_pacientes" value="<?= h($val(['limite_pacientes'], (string)$atual['limite_pacientes'])) ?>" inputmode="numeric"></label>
</section>

<section class="cartao">
  <label class="campo">Nota desta alteração (opcional, aparece no histórico)
    <input name="nota" maxlength="300" placeholder="Ex.: reajuste anual" value="<?= h($val(['nota'], '')) ?>"></label>
  <div class="acoes"><button type="submit" class="btn btn--gold">Salvar nova versão</button>
    <a class="btn btn--line" href="historico.php">Ver histórico</a></div>
</section>
</form>
<?php painel_fim();
