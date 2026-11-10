/* Testes de regressão funcional da landing page GR Scan.
   Uso: node tests/regressao.js http://127.0.0.1:8090 [saida.json]
   Os endpoints PHP são interceptados (nenhum e-mail real é enviado). */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8090";
const OUT = process.argv[3];
const results = [];
const ok = (name, cond, info = "") => results.push({ name, pass: !!cond, info: String(info).slice(0, 300) });

async function newPage(b, vp, opts = {}) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, reducedMotion: opts.reduce ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(e.message));
  p.on("console", (m) => { if (m.type() === "error") p.errors.push(m.text()); });
  p.payloads = {};
  await p.route("**/agendar.php", async (r) => { p.payloads.agendar = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ json: { ok: true } }); });
  await p.route("**/orcamento.php", async (r) => { p.payloads.orcamento = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ json: { ok: true } }); });
  await p.route("**/disponibilidade.php*", (r) => r.fulfill({ json: opts.dispo || { ok: false, motivo: "nao_configurado" } }));
  return p;
}
const pick = (p, sel) => p.locator(sel).locator("xpath=..").click();
const isoPlus = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const nextWeekday = () => { for (let i = 1; i < 10; i++) { const d = new Date(); d.setDate(d.getDate() + i); if (d.getDay() >= 1 && d.getDay() <= 5) return isoPlus(i); } };

(async () => {
  // ---------- Versão do deploy (arquivos do repositório) ----------
  {
    const fs = require("fs"), path = require("path");
    const raiz = path.join(__dirname, "..");
    const ler = (f) => fs.readFileSync(path.join(raiz, f), "utf8");
    const html = ler("index.html"), css = ler("styles.css"), js = ler("script.js"), log = ler("CHANGELOG.md");
    const vHtml = (html.match(/<meta name="grscan-versao" content="([^"]*)"/) || [])[1];
    const vCss = ((css.match(/--grscan-versao:\s*([^;]*);/) || [])[1] || "").trim().replace(/^['"]|['"]$/g, "");
    const vJs = (js.match(/var GRSCAN_VERSAO = "([^"]*)"/) || [])[1];
    const vQueryCss = (html.match(/styles\.css\?v=([^"]*)"/) || [])[1];
    const vQueryJs = (html.match(/script\.js\?v=([^"]*)"/) || [])[1];
    const changelogPrimeiroTitulo = (log.match(/^## .*$/m) || [""])[0];
    ok("versão: index.html, styles.css e script.js iguais", vHtml && vHtml === vCss && vCss === vJs, [vHtml, vCss, vJs]);
    ok("versão: ?v= de styles.css e script.js igual à versão", vQueryCss === vHtml && vQueryJs === vHtml, [vQueryCss, vQueryJs]);
    ok("versão: CHANGELOG começa pela versão atual", changelogPrimeiroTitulo.startsWith("## " + vHtml + " "), changelogPrimeiroTitulo);
    ok("versão: formato MAIOR.MENOR", /^\d+\.\d+$/.test(vHtml || ""), vHtml);
  }

  const b = await chromium.launch();

  // ---------- Carregamento e estrutura (desktop) ----------
  let p = await newPage(b, { width: 1440, height: 900 });
  await p.goto(BASE + "/", { waitUntil: "load" });
  await p.waitForTimeout(3500);
  ok("sem erros de JS no carregamento (desktop)", p.errors.length === 0, p.errors.join(" | "));
  ok("um único h1", (await p.locator("h1").count()) === 1);
  ok("model-viewer do hero com GLB real", await p.locator('model-viewer[src="assets/arcada-hero.glb"]').count());
  await p.locator("#scanscene").scrollIntoViewIfNeeded(); await p.waitForTimeout(5000); // a cena carrega sob demanda
  ok("cena 3D de escaneamento inicializada", await p.locator("#scanscene canvas").count(), await p.getAttribute("#scanscene", "class"));
  await p.locator("#mapa").scrollIntoViewIfNeeded(); await p.waitForTimeout(3000);
  ok("mapa de cobertura (Leaflet) renderizado", await p.locator("#mapa .leaflet-container").count());
  ok("contornos dos municípios no mapa", (await p.locator("#mapa path.cov-area").count()) > 0);
  for (const id of ["como-atuamos", "aplicacoes", "atendimento", "tecnologia", "agendar", "faq"]) ok("seção #" + id + " existe", await p.locator("#" + id).count());
  ok("FAQ com 7+ perguntas", (await p.locator("#faq details").count()) >= 7);
  ok("ano no rodapé", (await p.textContent("#ano")) == String(new Date().getFullYear()));

  // ---------- Modal de agendamento ----------
  await p.evaluate(() => scrollTo(0, 0));
  await p.locator('a[href="#agendar"]:visible').first().click();
  await p.waitForTimeout(500);
  ok("link #agendar abre o modal de agendamento", await p.evaluate(() => document.getElementById("bk-modal").open));
  await p.click("#bk-submit"); await p.waitForTimeout(200);
  ok("validação: tipo de trabalho", (await p.textContent("#bk-error")).includes("tipo de trabalho"));
  await pick(p, '#bk input[name="trabalho"][value="Prótese sobre implante"]');
  await p.fill('#bk [name="clinica"]', "Clínica Teste"); await p.fill('#bk [name="endereco"]', "Rua Teste, 10"); await p.fill('#bk [name="cidade"]', "Niterói");
  const dia = nextWeekday();
  await p.fill('#bk [name="data"]', dia); await p.dispatchEvent('#bk [name="data"]', "change"); await p.waitForTimeout(200);
  ok("horários gerados para dia útil", (await p.locator('#slots input[name="hora"]').count()) > 0);
  await p.locator('#slots label.tslot').first().click();
  await p.fill('#bk [name="nome"]', "Dra. Teste"); await p.fill('#bk [name="telefone"]', "(21) 99999-0000"); await p.fill('#bk [name="email"]', "teste@exemplo.org");
  await p.click("#bk-submit"); await p.waitForTimeout(800);
  ok("agendamento: envio ao agendar.php", p.payloads.agendar, JSON.stringify(p.payloads.agendar));
  ok("agendamento: campos esperados", p.payloads.agendar && ["trabalho","arcadas","pacientes","laboratorio","clinica","endereco","cidade","data","hora","nome","telefone","email","obs","website"].every((k) => k in p.payloads.agendar), Object.keys(p.payloads.agendar || {}).join(","));
  ok("agendamento: tela de confirmação", await p.isVisible("#bk-done"));
  await p.click("#bk-new"); await p.waitForTimeout(300);
  ok("agendamento: 'Novo agendamento' volta ao formulário", await p.isVisible("#bk"));
  await p.keyboard.press("Escape"); await p.waitForTimeout(300);
  ok("Esc fecha o modal de agendamento", !(await p.evaluate(() => document.getElementById("bk-modal").open)));

  // ---------- Modal de orçamento + odontograma ----------
  await p.locator("[data-open-quote]:visible").first().click(); await p.waitForTimeout(400);
  ok("botão de orçamento abre o modal", await p.evaluate(() => document.getElementById("qt-modal").open));
  await p.click("#qt-submit"); await p.waitForTimeout(200);
  ok("validação do orçamento", (await p.textContent("#qt-error")).length > 0);
  await pick(p, '#qt input[name="trabalhos"][value="Outro"]');
  ok("'Outro' mostra campo de descrição", await p.isVisible("#qt-outro"));
  await pick(p, '#qt input[name="trabalhos"][value="Prótese sobre implante"]');
  await p.click('.tooth[data-t="36"]'); await p.click('.tooth[data-t="11"]');
  ok("odontograma preenche dentes", (await p.inputValue('#qt [name="dentes"]')) === "11, 36" || (await p.inputValue('#qt [name="dentes"]')) === "36, 11", await p.inputValue('#qt [name="dentes"]'));
  ok("odontograma conta elementos", (await p.inputValue('#qt [name="elementos"]')) === "2");
  ok("odontograma aria-pressed", (await p.getAttribute('.tooth[data-t="36"]', "aria-pressed")) === "true");
  await p.fill('#qt [name="nome"]', "Dr. Teste"); await p.fill('#qt [name="telefone"]', "21999990000"); await p.fill('#qt [name="email"]', "t@exemplo.org");
  await p.click("#qt-submit"); await p.waitForTimeout(600);
  ok("orçamento: envio ao orcamento.php", p.payloads.orcamento, JSON.stringify(p.payloads.orcamento));
  ok("orçamento: campos esperados", p.payloads.orcamento && ["trabalhos","outro_trabalho","arcadas","pacientes","prazo","dentes","elementos","frequencia","laboratorio","formato","local","obs","nome","clinica","cro","telefone","email","preferencia","website"].every((k) => k in p.payloads.orcamento), Object.keys(p.payloads.orcamento || {}).join(","));
  ok("orçamento: confirmação", await p.isVisible("#qt-done"));
  await p.context().close();

  // ---------- Links diretos ----------
  for (const [hash, id] of [["#agendar", "bk-modal"], ["#orcamento", "qt-modal"]]) {
    p = await newPage(b, { width: 1280, height: 800 });
    await p.goto(BASE + "/" + hash, { waitUntil: "load" }); await p.waitForTimeout(1200);
    ok("link direto " + hash + " abre " + id, await p.evaluate((i) => document.getElementById(i).open, id));
    await p.context().close();
  }

  // ---------- Modo Google Agenda (disponibilidade com deslocamento) ----------
  const d1 = isoPlus(3);
  p = await newPage(b, { width: 1280, height: 800 }, { dispo: { ok: true, dias: { [d1]: ["09:00", "14:40"] }, deslocamento: { estimado: true, origem: "Xerém", min: 40, km: 30 } } });
  await p.goto(BASE + "/#agendar", { waitUntil: "load" }); await p.waitForTimeout(1500);
  ok("modo Google: dias livres exibidos", (await p.locator('#days input[name="dia"]').count()) === 1);
  ok("modo Google: aviso de deslocamento", (await p.textContent(".bk__travel")).includes("40 min"));
  await p.locator('#days label.tslot').first().click(); await p.waitForTimeout(200);
  ok("modo Google: horários do dia", (await p.locator('#slots input[name="hora"]').count()) === 2);
  ok("modo Google: botão 'Reservar horário'", (await p.textContent("#bk-submit")).includes("Reservar"));
  await p.context().close();

  // ---------- Responsividade ----------
  for (const [name, vp, mobile] of [["320", { width: 320, height: 640 }, true], ["390", { width: 390, height: 844 }, true], ["768", { width: 768, height: 1024 }, true], ["1440", { width: 1440, height: 900 }, false]]) {
    p = await newPage(b, vp, { mobile });
    await p.goto(BASE + "/", { waitUntil: "load" }); await p.waitForTimeout(1500);
    ok(name + "px: sem rolagem horizontal", !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), await p.evaluate(() => document.documentElement.scrollWidth));
    const r = await p.evaluate(() => { const h = document.querySelector("h1").getBoundingClientRect(); const c = document.querySelector('.hero a[href="#agendar"], .hero [data-open-booking]'); const cb = c && c.getBoundingClientRect(); return { h1: h.top, cta: cb && cb.bottom, vh: innerHeight }; });
    ok(name + "px: H1 e CTA principal na primeira tela", r.cta && r.cta <= r.vh, JSON.stringify(r));
    ok(name + "px: sem erros de JS", p.errors.length === 0, p.errors.join(" | "));
    await p.context().close();
  }

  // ---------- Movimento reduzido ----------
  p = await newPage(b, { width: 1280, height: 800 }, { reduce: true });
  await p.goto(BASE + "/", { waitUntil: "load" }); await p.waitForTimeout(800);
  ok("movimento reduzido: conteúdo visível sem animação", await p.evaluate(() => [...document.querySelectorAll(".reveal, .fade-up")].every((e) => getComputedStyle(e).opacity === "1")));
  await p.context().close();

  await b.close();
  const fails = results.filter((r) => !r.pass);
  results.forEach((r) => console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.info)));
  console.log(`\n${results.length - fails.length}/${results.length} passaram`);
  if (OUT) require("fs").writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
