<?php
require __DIR__ . '/../app/painel.php';
require __DIR__ . '/../app/precos.php';
$admin = exigir_admin();

$hoje = date('Y-m-d');
$mes = date('Y-m-01');
$q = fn(string $sql, array $p = []) => (function () use ($sql, $p) { $st = db()->prepare($sql); $st->execute($p); return $st->fetchColumn(); })();
$novos = (int)$q("SELECT COUNT(*) FROM orcamentos WHERE status = 'solicitado'");
$noMes = (int)$q('SELECT COUNT(*) FROM orcamentos WHERE criado_em >= ?', [$mes]);
$valorMes = (int)$q('SELECT COALESCE(SUM(subtotal_centavos), 0) FROM orcamentos WHERE criado_em >= ?', [$mes]);
$versao = precos_versao_vigente();
$ultimos = db()->query('SELECT id, numero, criado_em, dados_json, total_centavos, subtotal_centavos, pendente, status FROM orcamentos ORDER BY id DESC LIMIT 5')->fetchAll();

painel_inicio('Início', $admin);
?>
<h1>Painel GR Scan</h1>
<div class="kpis">
  <div class="kpi"><span>Orçamentos aguardando resposta</span><b><?= $novos ?></b></div>
  <div class="kpi"><span>Orçamentos no mês</span><b><?= $noMes ?></b></div>
  <div class="kpi"><span>Valor orçado no mês (comercial)</span><b><?= brl_painel($valorMes) ?></b></div>
  <div class="kpi"><span>Tabela de preços vigente</span><b>versão <?= $versao ?></b></div>
</div>
<section class="cartao">
  <h2>Últimos orçamentos</h2>
  <?php if (!$ultimos): ?><p class="vazio">Nenhum orçamento recebido ainda.</p><?php else: ?>
  <table class="tabela"><thead><tr><th>Número</th><th>Data</th><th>Clínica / dentista</th><th class="num">Valor</th><th>Status</th></tr></thead><tbody>
  <?php foreach ($ultimos as $o): $d = json_decode($o['dados_json'], true); ?>
    <tr><td><a href="orcamentos.php?id=<?= (int)$o['id'] ?>"><?= h($o['numero']) ?></a></td>
      <td><?= h(date('d/m/Y H:i', strtotime($o['criado_em']))) ?></td>
      <td><?= h($d['clinica'] ?: $d['nome']) ?></td>
      <td class="num"><?= $o['pendente'] ? brl_painel((int)$o['subtotal_centavos']) . ' <small>+ a confirmar</small>' : brl_painel((int)$o['total_centavos']) ?></td>
      <td><span class="status"><?= h($o['status']) ?></span><?= ($d['origem'] ?? '') === 'convite' ? ' <span class="status status--convite">convite</span>' : '' ?></td></tr>
  <?php endforeach; ?>
  </tbody></table><?php endif; ?>
</section>
<?php painel_fim();
