/* Testes de regressão funcional da landing page GR Scan.
   Uso: node tests/regressao.js http://127.0.0.1:8090 [saida.json]
   Os endpoints PHP são interceptados (nenhum e-mail real é enviado). */
const { chromium } = require("playwright");
const BASE = process.argv[2] || "http://127.0.0.1:8090";
const OUT = process.argv[3];
const results = [];
// Versão e data do deploy lidas do próprio index.html (os testes não mudam a cada versão)
const META = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8").match(/<meta name="grscan-versao" content="([^"]*)" data-data="(\d{4})-(\d{2})-(\d{2})"/) || [];
const VERSAO = META[1], DATA_BR = META[4] + "/" + META[3] + "/" + META[2];
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
  // Testes partem de "sem oferta aberta", mesmo rodando contra o site ao vivo (os testes de oferta simulam a sua)
  await p.route("**/precos-publicos.php*", async (r) => { const res = await r.fetch(); const j = await res.json().catch(() => null); if (!j) return r.fulfill({ response: res }); j.promocao_deslocamento = null; await r.fulfill({ json: j }); });
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
  await p.context().close();
  const abrirOrc = async (pg) => { await pg.goto(BASE + "/#orcamento", { waitUntil: "load" }); await pg.waitForSelector("#qt-conteudo:not([hidden])", { timeout: 8000 }); };
  const totalOrc = (pg) => pg.textContent("#qt-total");
  p = await newPage(b, { width: 1280, height: 800 });
  await p.route("**/orcamento.php", async (r) => { p.payloads.orcamento = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ json: { ok: true, numero: "GRS-2026-00042", total: 39999, subtotal: 39999, pendente: false } }); });
  await abrirOrc(p);
  ok("botão de orçamento abre o modal com a tabela", await p.evaluate(() => document.getElementById("qt-modal").open));
  await p.selectOption("#qt-regiao", "niteroi");
  await p.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
  await p.fill(".qt-paciente [data-campo=transfers]", "1"); await p.fill(".qt-paciente [data-campo=tibases]", "1");
  ok("orçamento: exemplo Niterói = R$ 385,00", (await totalOrc(p)).includes("R$ 385,00"), await totalOrc(p));
  ok("resumo no formato do e-mail: Paciente 1 | item | valor e linha de Total", (await p.textContent(".qt-itens li:first-child .qt-item__quem")) === "Paciente 1" && (await p.textContent(".qt-item--total")).includes("Total") && (await p.textContent(".qt-item--total .qt-item__valor")) === "R$ 385,00", await p.textContent("#qt-resumo"));
  await p.selectOption(".qt-paciente [data-campo=procedimento]", "orto");
  ok("orçamento: trocar implante por orto zera componentes", (await p.inputValue(".qt-paciente [data-campo=transfers]")) === "0" && (await totalOrc(p)).includes("R$ 270,00"), await totalOrc(p));
  await p.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
  await p.fill(".qt-paciente [data-campo=transfers]", "1"); await p.fill(".qt-paciente [data-campo=tibases]", "1");
  await p.click('.tooth[data-t="36"]'); await p.click('.tooth[data-t="11"]');
  ok("odontograma preenche dentes", ["11, 36", "36, 11"].includes(await p.inputValue('#qt [name="dentes"]')), await p.inputValue('#qt [name="dentes"]'));
  ok("odontograma conta elementos", (await p.inputValue('#qt [name="elementos"]')) === "2");
  ok("odontograma aria-pressed", (await p.getAttribute('.tooth[data-t="36"]', "aria-pressed")) === "true");
  await p.click("#qt-submit"); await p.waitForTimeout(200);
  ok("validação do orçamento", (await p.textContent("#qt-error")).length > 0);
  await p.fill('#qt [name="nome"]', "Dr. Teste"); await p.fill('#qt [name="telefone"]', "21999990000"); await p.fill('#qt [name="email"]', "t@exemplo.org");
  await p.click("#qt-submit"); await p.waitForTimeout(200);
  ok("orçamento: exige aceite de privacidade", (await p.textContent("#qt-error")).includes("dados") && !p.payloads.orcamento);
  await p.check('#qt [name="aceite_privacidade"]');
  await p.context().route("https://wa.me/**", (r) => r.fulfill({ body: "ok", contentType: "text/plain" }));
  const [popup] = await Promise.all([p.waitForEvent("popup"), p.click("#qt-whatsapp")]);
  const waUrl = decodeURIComponent(popup.url()); await popup.close();
  ok("orçamento: WhatsApp leva o orçamento", waUrl.includes("wa.me") && waUrl.includes("R$ 385,00"), waUrl.slice(0, 160));
  await p.click("#qt-submit"); await p.waitForTimeout(600);
  const po = p.payloads.orcamento || {};
  ok("orçamento: envio ao orcamento.php com o pedido", po.regiao === "niteroi" && Array.isArray(po.pacientes) && po.pacientes[0].procedimento === "implante" && po.aceite_privacidade === true, JSON.stringify(po).slice(0, 200));
  ok("orçamento: dados de contato e dentes no envio", ["dentes", "elementos", "data_desejada", "obs", "nome", "clinica", "cro", "telefone", "email", "preferencia", "website"].every((k) => k in po), Object.keys(po).join(","));
  ok("orçamento: confirmação mostra número e total do servidor", (await p.isVisible("#qt-done")) && (await p.textContent("#qt-numero")).includes("GRS-2026-00042") && (await p.textContent("#qt-numero")).includes("R$ 399,99"), await p.textContent("#qt-numero"));
  await p.context().close();

  p = await newPage(b, { width: 1280, height: 800 });
  await abrirOrc(p);
  await p.selectOption("#qt-regiao", "zona_sul");
  await p.selectOption(".qt-paciente [data-campo=procedimento]", "orto");
  await p.click("#qt-add"); await p.click("#qt-add");
  await p.selectOption(".qt-paciente:nth-child(2) [data-campo=procedimento]", "facetas");
  await p.selectOption(".qt-paciente:nth-child(3) [data-campo=procedimento]", "implante");
  ok("orçamento: 3 pacientes com desconto só nos elegíveis", (await totalOrc(p)).includes("R$ 580,00") && (await p.textContent("#qt-desconto")).includes("R$ 170,00"), await totalOrc(p));
  await p.click(".qt-paciente:nth-child(3) .qt-remover");
  ok("orçamento: remover paciente recalcula", (await p.locator(".qt-paciente").count()) === 2 && (await totalOrc(p)).includes("R$ 390,00"), await totalOrc(p));
  await p.selectOption("#qt-regiao", "outras");
  ok("orçamento: outras localidades = sob confirmação", (await totalOrc(p)).includes("sob confirmação"), await totalOrc(p));
  ok("orçamento: sem erros de JS", p.errors.length === 0, p.errors.join(" | "));
  await p.context().close();

  // ---------- Link de convite: região e origem ----------
  p = await newPage(b, { width: 1280, height: 800 });
  await p.route("**/orcamento.php", async (r) => { p.payloads.orcamento = JSON.parse(r.request().postData() || "{}"); await r.fulfill({ json: { ok: true, numero: "GRS-2026-00077", total: 18000, subtotal: 18000, pendente: false } }); });
  await p.goto(BASE + "/?r=niteroi&origem=convite#orcamento", { waitUntil: "load" }); await p.waitForSelector("#qt-conteudo:not([hidden])", { timeout: 8000 });
  ok("convite: região do link já escolhida", (await p.inputValue("#qt-regiao")) === "niteroi");
  ok("convite: endereço limpo, mantendo #orcamento", (await p.evaluate(() => location.search)) === "" && (await p.evaluate(() => location.hash)) === "#orcamento", await p.evaluate(() => location.href));
  await p.fill('#qt [name="nome"]', "Dr. Convite"); await p.fill('#qt [name="telefone"]', "21999990000"); await p.fill('#qt [name="email"]', "c@exemplo.org");
  await p.check('#qt [name="aceite_privacidade"]'); await p.click("#qt-submit"); await p.waitForTimeout(600);
  ok("convite: orçamento enviado com origem convite", (p.payloads.orcamento || {}).origem === "convite", JSON.stringify(p.payloads.orcamento || {}).slice(0, 200));
  await p.context().close();
  p = await newPage(b, { width: 1280, height: 800 });
  await p.goto(BASE + "/?r=%3Cscript%3E&origem=hack#orcamento", { waitUntil: "load" }); await p.waitForSelector("#qt-conteudo:not([hidden])", { timeout: 8000 });
  ok("convite: região inválida é ignorada sem erro", (await p.inputValue("#qt-regiao")) === "" && p.errors.length === 0, p.errors.join(" | "));
  ok("convite: origem desconhecida não é guardada", (await p.evaluate(() => { try { return sessionStorage.getItem("grscan_origem"); } catch (e) { return null; } })) === null);
  await p.context().close();

  // ---------- Página /convite/ (prévia no WhatsApp) ----------
  {
    const html = await (await fetch(BASE + "/convite/")).text();
    const meta = (prop) => (html.match(new RegExp('<meta (?:property|name)="' + prop + '" content="([^"]*)"')) || [])[1] || "";
    ok("convite: metatags da prévia (título, descrição, imagem 1200×630)", meta("og:title").includes("escaneamento iTero") && meta("og:description").length > 20 &&
      /^https:\/\/.+\/assets\/convite-og\.jpg$/.test(meta("og:image")) && meta("og:image:width") === "1200" && meta("og:image:height") === "630" && meta("twitter:card") === "summary_large_image");
    const img = await fetch(BASE + "/assets/convite-og.jpg"); const buf = Buffer.from(await img.arrayBuffer());
    let w = 0, h = 0; for (let i = 2; i < buf.length - 9; ) { if (buf[i] !== 0xff) break; const m = buf[i + 1], len = buf.readUInt16BE(i + 2); if (m >= 0xc0 && m <= 0xc2) { h = buf.readUInt16BE(i + 5); w = buf.readUInt16BE(i + 7); break; } i += 2 + len; }
    ok("convite: imagem da prévia em JPEG 1200×630 e leve", img.status === 200 && w === 1200 && h === 630 && buf.length < 300 * 1024, `${img.status} ${w}x${h} ${buf.length}`);
  }
  p = await newPage(b, { width: 390, height: 844 }, { mobile: true });
  await p.goto(BASE + "/convite/?r=niteroi", { waitUntil: "load" }); await p.waitForSelector("#qt-conteudo:not([hidden])", { timeout: 8000 });
  ok("convite: /convite/?r=niteroi abre o orçamento com Niterói", (await p.inputValue("#qt-regiao")) === "niteroi" && (await p.evaluate(() => document.getElementById("qt-modal").open)));
  ok("convite: origem guardada na aba", (await p.evaluate(() => sessionStorage.getItem("grscan_origem"))) === "convite");
  await p.context().close();
  p = await newPage(b, { width: 390, height: 844 }, { mobile: true });
  await p.goto(BASE + "/convite/?r=%3Cscript%3Ealert(1)%3C/script%3E", { waitUntil: "load" }); await p.waitForSelector("#qt-conteudo:not([hidden])", { timeout: 8000 });
  ok("convite: região maliciosa no link é ignorada", (await p.inputValue("#qt-regiao")) === "" && p.errors.length === 0, p.errors.join(" | "));
  await p.context().close();
  {
    const ctxSemJs = await b.newContext({ javaScriptEnabled: false }); const pj = await ctxSemJs.newPage();
    await pj.goto(BASE + "/convite/?r=niteroi");
    ok("convite: sem JavaScript mostra o botão para o orçamento", await pj.isVisible("text=Ver o valor para a minha clínica"));
    await ctxSemJs.close();
  }

  // ---------- Oferta de deslocamento grátis ----------
  const comOferta = (pg, fimMs, agoraMs) => pg.route("**/precos-publicos.php*", async (r) => {
    const res = await r.fetch(); const j = await res.json();
    j.agora = new Date(agoraMs).toISOString(); j.promocao_deslocamento = { fim: new Date(fimMs).toISOString() };
    await r.fulfill({ json: j });
  });
  const montarNiteroi = async (pg) => {
    await pg.selectOption("#qt-regiao", "niteroi"); await pg.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
    await pg.fill(".qt-paciente [data-campo=transfers]", "1"); await pg.fill(".qt-paciente [data-campo=tibases]", "1");
  };
  p = await newPage(b, { width: 1280, height: 800 });
  await comOferta(p, Date.now() + 4 * 3600e3, Date.now());
  await abrirOrc(p); await montarNiteroi(p);
  ok("oferta: faixa com contagem regressiva", (await p.isVisible("#qt-oferta")) && /0[34]:\d\d:\d\d/.test(await p.textContent("#qt-oferta-tempo")), await p.textContent("#qt-oferta"));
  ok("oferta: taxa riscada e GRÁTIS no resumo", (await p.textContent(".qt-item--desloc s")).includes("R$ 90,00") && (await p.textContent(".qt-item--desloc")).includes("GRÁTIS"));
  ok("oferta: total sem deslocamento (R$ 295,00)", (await totalOrc(p)).includes("R$ 295,00"), await totalOrc(p));
  ok("listas sem valores: regiões e procedimentos mostram só o nome", !(await p.textContent("#qt-regiao")).includes("R$") && !(await p.textContent(".qt-paciente [data-campo=procedimento]")).includes("R$") && (await p.textContent('#qt-regiao option[value="niteroi"]')).trim() === "Niterói");
  await p.context().route("https://wa.me/**", (r) => r.fulfill({ body: "ok", contentType: "text/plain" }));
  const [pop2] = await Promise.all([p.waitForEvent("popup"), p.click("#qt-whatsapp")]);
  const wa2 = decodeURIComponent(pop2.url()); await pop2.close();
  ok("oferta: WhatsApp informa a oferta", wa2.includes("grátis (oferta, de R$ 90,00)"), wa2.slice(0, 300));
  {
    const fs2 = require("fs"), path2 = require("path");
    const axePath = process.env.AXE_PATH;
    if (axePath && fs2.existsSync(axePath)) {
      await p.addScriptTag({ content: fs2.readFileSync(axePath, "utf8") });
      const v = await p.evaluate(async () => (await axe.run(document.getElementById("qt-modal"))).violations.map((x) => x.id));
      ok("oferta: axe-core sem violações no modal", v.length === 0, v.join(","));
    }
  }
  ok("oferta: sem erros de JS", p.errors.length === 0, p.errors.join(" | "));
  await p.context().close();

  p = await newPage(b, { width: 1280, height: 800 });
  await comOferta(p, Date.now() + 3000, Date.now());
  await abrirOrc(p); await montarNiteroi(p);
  const antes = await totalOrc(p);
  await p.waitForTimeout(4500);
  ok("oferta: ao terminar, a faixa some e a taxa volta", antes.includes("R$ 295,00") && !(await p.isVisible("#qt-oferta")) && (await totalOrc(p)).includes("R$ 385,00"), antes + " → " + (await totalOrc(p)));
  await p.context().close();

  p = await newPage(b, { width: 1280, height: 800 });
  const servidor = Date.now() - 2 * 3600e3; // relógio do aparelho 2 h adiantado em relação ao servidor
  await comOferta(p, servidor + 4 * 3600e3, servidor);
  await abrirOrc(p); await montarNiteroi(p);
  ok("oferta: contagem usa a hora do servidor (relógio do aparelho errado)", /^0(3:5\d|4:00)/.test(await p.textContent("#qt-oferta-tempo")) && (await totalOrc(p)).includes("R$ 295,00"), await p.textContent("#qt-oferta-tempo"));
  await p.context().close();

  p = await newPage(b, { width: 320, height: 640 }, { mobile: true });
  await comOferta(p, Date.now() + 4 * 3600e3, Date.now());
  await abrirOrc(p); await montarNiteroi(p);
  ok("oferta 320px: sem rolagem horizontal e faixa visível", (await p.isVisible("#qt-oferta")) && await p.evaluate(() => { const bx = document.querySelector("#qt-modal .bk-modal__box"); return bx.scrollWidth <= bx.clientWidth + 1; }));
  await p.context().close();

  p = await newPage(b, { width: 1280, height: 800 });
  await p.route("**/precos-publicos.php*", (r) => r.fulfill({ status: 500, body: "" }));
  await p.goto(BASE + "/#orcamento", { waitUntil: "load" }); await p.waitForSelector("#qt-falha:not([hidden])", { timeout: 8000 });
  ok("orçamento: falha na tabela mostra aviso sem valores", (await p.isVisible("#qt-falha")) && !(await p.isVisible("#qt-conteudo")) && !(await p.textContent("#qt-falha")).includes("R$"));
  await p.context().close();

  p = await newPage(b, { width: 320, height: 640 }, { mobile: true });
  await abrirOrc(p);
  await p.selectOption("#qt-regiao", "barra");
  ok("orçamento 320px: sem rolagem horizontal no modal", await p.evaluate(() => { const bx = document.querySelector("#qt-modal .bk-modal__box"); return bx.scrollWidth <= bx.clientWidth + 1; }));
  ok("orçamento 320px: total visível", await p.isVisible("#qt-total") && (await totalOrc(p)).includes("R$ 180,00"), await totalOrc(p));
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

  // ---------- Barra de versão (/?versao) ----------
  {
    const barra = async (p) => p.evaluate(() => {
      const el = document.getElementById("versao-barra");
      if (!el) return null;
      const item = (k) => (el.querySelector('[data-arquivo="' + k + '"]') || {}).textContent || "";
      return { estado: el.dataset.estado, texto: el.textContent, role: el.getAttribute("role"), estilos: item("estilos"), scripts: item("scripts") };
    });
    const trocaCss = (p, valor) => p.route("**/styles.css*", async (r) => {
      const res = await r.fetch(); const body = (await res.text()).replace(/--grscan-versao:[^;]*;/, "--grscan-versao: " + valor + ";");
      await r.fulfill({ response: res, body });
    });
    const abre = async (p, url) => { await p.goto(BASE + url, { waitUntil: "load" }); await p.waitForTimeout(600); };

    p = await newPage(b, { width: 1280, height: 800 });
    await abre(p, "/");
    ok("versão: sem ?versao não há barra", (await p.locator("#versao-barra").count()) === 0);
    await abre(p, "/?versao");
    let r = await barra(p);
    ok("versão: com ?versao mostra a versão atual ok", r && r.estado === "ok" && r.texto.includes("Versão " + VERSAO) && r.texto.includes(DATA_BR) && r.role === "status", JSON.stringify(r));
    await abre(p, "/?versao=1&x=y");
    ok("versão: ?versao=1&x=y também abre", (await p.locator("#versao-barra").count()) === 1);
    ok("versão: barra sem erros de JS", p.errors.length === 0, p.errors.join(" | "));
    await p.context().close();

    p = await newPage(b, { width: 1280, height: 800 });
    await trocaCss(p, '"1.9"');
    await abre(p, "/?versao");
    r = await barra(p);
    ok("versão: CSS de outra versão → incompleto", r && r.estado === "incompleto" && r.estilos.includes("1.9 ✗") && r.texto.includes("deploy incompleto"), JSON.stringify(r));
    await p.context().close();

    p = await newPage(b, { width: 1280, height: 800 });
    await trocaCss(p, " '" + VERSAO + "' ");
    await abre(p, "/?versao");
    r = await barra(p);
    ok("versão: aspas e espaços normalizados", r && r.estado === "ok", JSON.stringify(r));
    await p.context().close();

    p = await newPage(b, { width: 1280, height: 800 });
    await p.route("**/script.js*", (rt) => rt.fulfill({ status: 404, body: "" }));
    await abre(p, "/?versao");
    r = await barra(p);
    ok("versão: script.js 404 → incompleto", r && r.estado === "incompleto" && r.scripts.includes("não carregado ✗"), JSON.stringify(r));
    await p.context().close();

    p = await newPage(b, { width: 1280, height: 800 });
    await p.goto(BASE + "/?versao#agendar", { waitUntil: "load" }); await p.waitForTimeout(1200);
    ok("versão: /?versao#agendar abre o agendamento", await p.evaluate(() => document.getElementById("bk-modal").open));
    await p.context().close();

    p = await newPage(b, { width: 320, height: 640 }, { mobile: true });
    await abre(p, "/?versao");
    ok("versão: 320px com barra sem rolagem horizontal", (await p.locator("#versao-barra").count()) === 1 && !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)), await p.evaluate(() => document.documentElement.scrollWidth));
    if (await p.locator("#versao-fechar").count()) await p.click("#versao-fechar");
    ok("versão: fechar remove a barra", (await p.locator("#versao-fechar").count()) === 0 && (await p.locator("#versao-barra").count()) === 0);
    await p.context().close();
  }

  await b.close();
  const fails = results.filter((r) => !r.pass);
  results.forEach((r) => console.log((r.pass ? "PASS " : "FAIL ") + r.name + (r.pass ? "" : "  -> " + r.info)));
  console.log(`\n${results.length - fails.length}/${results.length} passaram`);
  if (OUT) require("fs").writeFileSync(OUT, JSON.stringify(results, null, 1));
  process.exit(fails.length ? 1 : 0);
})();
