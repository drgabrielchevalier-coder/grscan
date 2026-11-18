/* Roda os mesmos casos de tests/orcamento-casos.json na versão JS das regras.
   Uso: node tests/orcamento-calculo.node.js */
const fs = require("fs"), path = require("path"), vm = require("vm");
const raiz = path.join(__dirname, "..");
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(raiz, "assets/orcamento-calculo.js"), "utf8"), ctx);
const calc = ctx.window.GRSCAN_CALC;
const padrao = JSON.parse(fs.readFileSync(path.join(raiz, "app/precos-padrao.json"), "utf8"));
const casos = JSON.parse(fs.readFileSync(path.join(__dirname, "orcamento-casos.json"), "utf8"));
let falhas = 0;
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
for (const c of casos) {
  const cfg = JSON.parse(JSON.stringify(padrao));
  if (c.publico) ["procedimentos", "componentes"].forEach((g) => cfg[g].forEach((x) => { delete x.disponivel; }));
  Object.entries(c.ajuste_preco || {}).forEach(([id, v]) => cfg.procedimentos.forEach((x) => { if (x.id === id) x.preco = v; }));
  if (c.indisponivel) cfg.procedimentos.forEach((p) => { if (p.id === c.indisponivel) p.disponivel = false; });
  const pedido = JSON.parse(JSON.stringify(c.pedido));
  const m = typeof pedido.pacientes === "string" && pedido.pacientes.match(/^(\d+)x (\w+)$/);
  if (m) pedido.pacientes = Array.from({ length: +m[1] }, () => ({ procedimento: m[2] }));
  if (c.promocao) cfg.promocao_deslocamento = { fim: c.promocao };
  const r = calc.calcular(cfg, pedido, c.agora ? Date.parse(c.agora) : undefined), e = c.esperado;
  let ok = (r.erros.length > 0) === e.erro;
  if (!e.erro) {
    if ("totais" in e) ok = ok && igual(r.itens.map((i) => i.total), e.totais);
    for (const k of ["subtotal", "total", "pendente", "deslocamento"]) if (k in e) ok = ok && r[k] === e[k];
    if ("promocao" in e) ok = ok && r.itens.some((i) => i.promocao) === e.promocao;
    if ("faixa" in e) ok = ok && (r.faixa && r.faixa.preco) === e.faixa;
  }
  if (!ok) falhas++;
  console.log((ok ? "PASS " : "FAIL ") + "cálculo JS: " + c.nome + (ok ? "" : "  -> " + JSON.stringify({ totais: r.itens.map((i) => i.total), subtotal: r.subtotal, total: r.total, erros: r.erros })));
}
const fmt = calc.formatarBRL(38500) === "R$ 385,00" && calc.formatarBRL(123456) === "R$ 1.234,56" && calc.formatarBRL(0) === "R$ 0,00";
if (!fmt) falhas++;
console.log((fmt ? "PASS" : "FAIL") + " formatarBRL");
console.log(`\n${casos.length + 1 - falhas}/${casos.length + 1} passaram`);
process.exit(falhas ? 1 : 0);
