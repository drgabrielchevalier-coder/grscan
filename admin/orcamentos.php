<?php
/* Orçamentos recebidos pelo site: lista com filtros e detalhe (somente leitura na Etapa A). */
require __DIR__ . '/../app/painel.php';
require __DIR__ . '/../app/orcamentos.php';
$admin = exigir_admin();

if (isset($_GET['id'])) {
    $st = db()->prepare('SELECT * FROM orcamentos WHERE id = ?');
    $st->execute([(int)$_GET['id']]);
    $o = $st->fetch();
    if (!$o) { http_response_code(404); painel_inicio('Não encontrado', $admin); echo '<h1>Orçamento não encontrado</h1><p><a href="orcamentos.php">Voltar à lista</a></p>'; painel_fim(); exit; }
    $d = json_decode($o['dados_json'], true);
    $c = json_decode($o['calculo_json'], true);
    auditar((int)$admin['id'], 'orcamento_visto', ['numero' => $o['numero']]);
    painel_inicio($o['numero'], $admin); ?>
<p><a href="orcamentos.php">← Orçamentos</a></p>
<h1>Orçamento <?= h($o['numero']) ?> <span class="status"><?= h($o['status']) ?></span></h1>
<p class="dica">Recebido em <?= h(date('d/m/Y H:i', strtotime($o['criado_em']))) ?> · tabela de preços: versão <?= (int)$o['precos_versao_id'] ?> (<a href="historico.php">histórico</a>)</p>
<div class="grade2">
<section class="cartao">
  <h2>Itens</h2>
  <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Paciente</th><th>Item</th><th class="num">Qtd.</th><th class="num">Unitário</th><th class="num">Total</th></tr></thead><tbody>
  <?php foreach ($c['itens'] as $it): ?>
    <tr><td><?= $it['paciente'] ? (int)$it['paciente'] : '—' ?></td>
      <td><?= h($it['descricao']) ?><?= $it['desconto'] > 0 ? '<br><small class="dica">desconto clínica: de ' . brl_painel($it['preco_base']) . '</small>' : '' ?></td>
      <td class="num"><?= (int)$it['qtd'] ?></td>
      <td class="num"><?= $it['unitario'] === null ? 'sob avaliação' : brl_painel($it['unitario']) ?></td>
      <td class="num"><?= $it['total'] === null ? 'sob avaliação' : brl_painel($it['total']) ?></td></tr>
  <?php endforeach; ?>
  </tbody><tfoot><tr><th colspan="4"><?= $o['pendente'] ? 'Subtotal (total sob confirmação)' : 'Total' ?></th>
    <th class="num"><?= brl_painel($o['pendente'] ? (int)$o['subtotal_centavos'] : (int)$o['total_centavos']) ?></th></tr></tfoot></table></div>
  <?php if (!empty($c['faixa'])): ?><p class="dica">Faixa de desconto aplicada: <?= (int)$c['pacientes'] ?> pacientes → <?= brl_painel((int)$c['faixa']['preco']) ?> por escaneamento elegível.</p><?php endif; ?>
</section>
<section class="cartao">
  <h2>Solicitante</h2>
  <dl class="chave">
    <dt>Dentista</dt><dd><?= h($d['nome']) ?></dd>
    <dt>Clínica</dt><dd><?= h($d['clinica'] ?: '—') ?></dd>
    <dt>CRO</dt><dd><?= h($d['cro'] ?: '—') ?></dd>
    <dt>WhatsApp</dt><dd><?php $fone = preg_replace('/\D/', '', $d['telefone']); if (strlen($fone) <= 11) $fone = '55' . $fone; ?><a href="https://wa.me/<?= h($fone) ?>" rel="noopener" target="_blank"><?= h($d['telefone']) ?></a></dd>
    <dt>E-mail</dt><dd><a href="mailto:<?= h($d['email']) ?>"><?= h($d['email']) ?></a></dd>
    <dt>Prefere</dt><dd><?= h($d['preferencia'] ?: '—') ?></dd>
    <dt>Dentes</dt><dd><?= h($d['dentes'] ?: '—') ?></dd>
    <dt>Data desejada</dt><dd><?= $d['data_desejada'] ? h(date('d/m/Y', strtotime($d['data_desejada']))) : '—' ?></dd>
    <dt>Observações</dt><dd><?= nl2br(h($d['obs'] ?: '—')) ?></dd>
  </dl>
</section>
</div>
<?php painel_fim(); exit;
}

// ---------- Lista ----------
$de = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['de'] ?? '') ? $_GET['de'] : '';
$ate = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['ate'] ?? '') ? $_GET['ate'] : '';
$busca = mb_substr(trim((string)($_GET['busca'] ?? '')), 0, 80);
$where = []; $par = [];
if ($de) { $where[] = 'criado_em >= ?'; $par[] = "$de 00:00:00"; }
if ($ate) { $where[] = 'criado_em <= ?'; $par[] = "$ate 23:59:59"; }
if ($busca !== '') { $where[] = '(numero LIKE ? OR dados_json LIKE ?)'; $like = '%' . str_replace(['%', '_'], ['\%', '\_'], $busca) . '%'; array_push($par, $like, $like); }
$sql = 'SELECT id, numero, criado_em, dados_json, total_centavos, subtotal_centavos, pendente, status FROM orcamentos'
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '') . ' ORDER BY id DESC LIMIT 200';
$sql = str_replace('LIKE ?', "LIKE ? ESCAPE '\\'", $sql);
$st = db()->prepare($sql); $st->execute($par);
$lista = $st->fetchAll();

painel_inicio('Orçamentos', $admin); ?>
<h1>Orçamentos recebidos</h1>
<form class="filtros" method="get">
  <label>De<input type="date" name="de" value="<?= h($de) ?>"></label>
  <label>Até<input type="date" name="ate" value="<?= h($ate) ?>"></label>
  <label>Busca (número, clínica, dentista)<input name="busca" value="<?= h($busca) ?>" maxlength="80"></label>
  <button type="submit" class="btn btn--line">Filtrar</button>
  <?php if ($de || $ate || $busca !== ''): ?><a class="btn btn--line" href="orcamentos.php">Limpar</a><?php endif; ?>
</form>
<section class="cartao">
<?php if (!$lista): ?><p class="vazio">Nenhum orçamento encontrado.</p><?php else: ?>
  <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Número</th><th>Data</th><th>Clínica</th><th>Dentista</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>
  <?php foreach ($lista as $o): $d = json_decode($o['dados_json'], true); ?>
    <tr><td><a href="?id=<?= (int)$o['id'] ?>"><?= h($o['numero']) ?></a></td>
      <td><?= h(date('d/m/Y H:i', strtotime($o['criado_em']))) ?></td>
      <td><?= h($d['clinica'] ?: '—') ?></td><td><?= h($d['nome']) ?></td>
      <td class="num"><?= $o['pendente'] ? brl_painel((int)$o['subtotal_centavos']) . ' <small>+ a confirmar</small>' : brl_painel((int)$o['total_centavos']) ?></td>
      <td><span class="status"><?= h($o['status']) ?></span></td></tr>
  <?php endforeach; ?>
  </tbody></table></div>
  <?php if (count($lista) === 200): ?><p class="dica">Mostrando os 200 mais recentes. Use os filtros para refinar.</p><?php endif; ?>
<?php endif; ?>
</section>
<?php painel_fim();
