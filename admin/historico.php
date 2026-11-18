<?php
/* Histórico das versões da tabela de preços: quem, quando, nota e o que mudou. */
require __DIR__ . '/../app/painel.php';
require __DIR__ . '/../app/precos.php';
$admin = exigir_admin();
precos_vigentes(); // garante a versão inicial

$pagina = max(1, (int)($_GET['p'] ?? 1));
$porPagina = 30;
$total = (int)db()->query('SELECT COUNT(*) FROM precos_versoes')->fetchColumn();
$st = db()->prepare('SELECT v.id, v.json, v.criado_em, v.nota, a.nome AS admin FROM precos_versoes v LEFT JOIN admins a ON a.id = v.admin_id ORDER BY v.id DESC LIMIT ? OFFSET ?');
$st->execute([$porPagina + 1, ($pagina - 1) * $porPagina]);
$versoes = $st->fetchAll();
$temMais = count($versoes) > $porPagina;
$versoes = array_slice($versoes, 0, $porPagina);
// a versão anterior à última da página, para comparar
$ultimaId = $versoes ? (int)end($versoes)['id'] : 0;
$ant = db()->prepare('SELECT json FROM precos_versoes WHERE id < ? ORDER BY id DESC LIMIT 1');
$ant->execute([$ultimaId]);
$anteriorDaPagina = ($r = $ant->fetch()) ? json_decode($r['json'], true) : null;

painel_inicio('Histórico de preços', $admin);
?>
<h1>Histórico da tabela de preços</h1>
<p class="dica"><?= $total ?> versões. Cada orçamento guarda a tabela que estava vigente quando foi emitido.</p>
<?php foreach ($versoes as $i => $v):
    $tab = json_decode($v['json'], true);
    $antes = isset($versoes[$i + 1]) ? json_decode($versoes[$i + 1]['json'], true) : $anteriorDaPagina;
    $mud = $antes ? precos_diferencas($antes, $tab) : []; ?>
  <section class="cartao">
    <h2>Versão <?= (int)$v['id'] ?><?= $i === 0 && $pagina === 1 ? ' · vigente' : '' ?></h2>
    <p class="dica"><?= h(date('d/m/Y H:i', strtotime($v['criado_em']))) ?> · <?= h($v['admin'] ?? 'sistema') ?><?= $v['nota'] !== '' ? ' · “' . h($v['nota']) . '”' : '' ?></p>
    <?php if (!$antes): ?><p class="dica">Tabela inicial.</p>
    <?php elseif (!$mud): ?><p class="dica">Sem diferenças em relação à versão anterior.</p>
    <?php else: ?><ul class="mudancas"><?php foreach ($mud as $m): ?><li><b><?= h($m) ?></b></li><?php endforeach; ?></ul><?php endif; ?>
  </section>
<?php endforeach; ?>
<div class="acoes">
  <?php if ($pagina > 1): ?><a class="btn btn--line" href="?p=<?= $pagina - 1 ?>">Mais recentes</a><?php endif; ?>
  <?php if ($temMais): ?><a class="btn btn--line" href="?p=<?= $pagina + 1 ?>">Mais antigas</a><?php endif; ?>
</div>
<?php painel_fim();
