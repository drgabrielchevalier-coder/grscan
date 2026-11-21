/* Gera o PDF "Portfólio · Tabela" da GR Scan (páginas verticais 9:16, 810×1440 pt), estilo premium e minimalista.
   Os preços vêm da tabela vigente do site (precos-publicos.php); sem internet, usa app/precos-padrao.json.
   Não mostra valores de deslocamento (informados no orçamento online).
   Uso: NODE_PATH=<node_modules com playwright e qrcode> node tests/gerar-portfolio.js entregas/GR-Scan-Portfolio-2026.pdf */
const { chromium } = require("playwright");
const QR = require("qrcode");
const fs = require("fs"), path = require("path");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.resolve(process.argv[2] || path.join(RAIZ, "entregas/GR-Scan-Portfolio-2026.pdf"));
const SITE = "https://grscan.implantstore.com.br";
const CONTATO = { whatsapp: "(21) 99292-1042", email: "grscan@implantstore.com.br", site: "grscan.implantstore.com.br" };
const ANO = new Date().getFullYear();

const b64 = (f) => fs.readFileSync(path.join(RAIZ, f)).toString("base64");
const LOGO = "data:image/png;base64," + b64("assets/logo-completa.png");
const MONO = "data:image/svg+xml;base64," + b64("assets/logo.svg");
// Fotos reais do scanner (fora do Git, em entregas/imagens-portfolio); sem elas, usa a ilustração do site
const FOTOS = path.join(RAIZ, "entregas/imagens-portfolio");
const foto = (f) => fs.existsSync(path.join(FOTOS, f)) ? "data:image/png;base64," + fs.readFileSync(path.join(FOTOS, f)).toString("base64") : null;
const FOTO_MAO = foto("scanner-mao.png"), FOTO_PONTEIRAS = foto("scanner-ponteiras.png");
const SCANNER = FOTO_MAO || "data:image/png;base64," + b64("assets/scanner-render.png");

const reais = (c) => Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cent = (c) => String(c % 100).padStart(2, "0");
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

const valor = (c) => c === null || c === undefined
  ? `<span class="v sob">sob avaliação</span>`
  : `<span class="v"><small>R$</small>${reais(c)}<sup>,${cent(c)}</sup></span>`;
/* Item de cardápio: nome · linha pontilhada · valor */
const item = (nome, c, nota) =>
  `<div class="item"><div class="item__linha"><span class="n">${esc(nome)}</span><i></i>${valor(c)}</div>${nota ? `<p class="nota">${esc(nota)}</p>` : ""}</div>`;

async function tabela() {
  try {
    const r = await fetch(SITE + "/precos-publicos.php", { signal: AbortSignal.timeout(8000) });
    const j = await r.json();
    if (j.ok) return { ...j, fonte: "site" };
  } catch (_) { /* sem internet: usa a tabela padrão */ }
  const p = JSON.parse(fs.readFileSync(path.join(RAIZ, "app/precos-padrao.json"), "utf8"));
  return { ...p, procedimentos: p.procedimentos.filter((x) => x.disponivel !== false), componentes: p.componentes.filter((x) => x.disponivel !== false), fonte: "padrão" };
}

(async () => {
  const t = await tabela();
  const procs = t.procedimentos;
  const conv = procs.filter((p) => !p.grupo && !p.implantes && p.id !== "reescaneamento");
  const imp = procs.filter((p) => p.grupo === "implante" || p.implantes);
  const rees = procs.find((p) => p.id === "reescaneamento");
  const comp = (id) => t.componentes.find((c) => c.id === id);
  const faixas = t.faixas_desconto.slice().sort((a, b) => a.min - b.min);
  const qr = await QR.toDataURL(SITE + "/convite/", { margin: 1, width: 520, color: { dark: "#0a0907", light: "#f3ede3" } });

  const cabecalho = (n) => `<header class="cab"><img src="${MONO}" alt=""><span>GR Scan</span><span class="num">${String(n).padStart(2, "0")}</span></header>`;
  const rodape = `<footer class="rod"><span>Portfólio ${ANO}</span><span>${CONTATO.site}</span></footer>`;
  const rotulo = (txt) => `<p class="rotulo">${txt}</p>`;

  const faixaHtml = faixas.map((f, i) => {
    const prox = faixas[i + 1];
    const qtd = prox ? (prox.min - 1 > f.min ? `${f.min} a ${prox.min - 1}` : `${f.min}`) : `${f.min}+`;
    return `<div class="fx"><span class="fx__q">${qtd}</span><span class="fx__l">pacientes na<br>mesma visita</span>${valor(f.preco)}<span class="fx__p">por escaneamento</span></div>`;
  }).join("");

  const paginas = [
    // 1. Capa
    `<section class="pg capa">
      <div class="capa__topo"><img class="capa__logo" src="${LOGO}" alt="GR Scan — Digital Scan"></div>
      ${FOTO_PONTEIRAS ? `<img class="capa__foto" src="${FOTO_PONTEIRAS}" alt="Scanner intraoral iTero">` : ""}
      <div class="capa__meio">
        ${rotulo("Portfólio de serviços")}
        <h1>O escaneamento<br>iTero vai<br>até você.</h1>
        <p class="capa__sub">Fluxo digital na sua cadeira, sem investir em um scanner.</p>
      </div>
      <div class="capa__base"><span>Tabela ${ANO}</span><span>Rio de Janeiro e Região Metropolitana</span></div>
    </section>`,

    // 2. Proposta
    `<section class="pg">${cabecalho(2)}
      ${rotulo("A experiência GR Scan")}
      <h2>Você atende.<br>Nós levamos o digital.</h2>
      <p class="lead">Vamos até o seu consultório com o scanner iTero e um operador especializado, no horário agendado. O modelo digital segue direto para o seu laboratório.</p>
      <figure class="scanner${FOTO_MAO ? " scanner--foto" : ""}"><img src="${SCANNER}" alt="${FOTO_MAO ? "Scanner intraoral iTero" : "Ilustração de scanner intraoral"}"><figcaption>${FOTO_MAO ? "Scanner iTero" : "Imagem ilustrativa"}</figcaption></figure>
      <div class="beneficios">
        <div><span class="b__n">01</span><h3>Sem investir em equipamento</h3><p>O scanner vem com a GR Scan. Você paga só pelo escaneamento.</p></div>
        <div><span class="b__n">02</span><h3>Sem moldeira e sem gesso</h3><p>Duas arcadas e registro oclusal capturados no próprio consultório.</p></div>
        <div><span class="b__n">03</span><h3>Arquivos STL/PLY</h3><p>Por link seguro para você ou direto ao laboratório indicado.</p></div>
      </div>
      ${rodape}
    </section>`,

    // 3. Escaneamentos
    `<section class="pg">${cabecalho(3)}
      ${rotulo("Tabela de escaneamentos")}
      <h2>Escaneamento<br>intraoral</h2>
      <p class="lead">Cada escaneamento inclui as duas arcadas, inclusive a antagonista, e o registro oclusal, quando clinicamente viáveis.</p>
      <div class="lista">
        ${conv.map((p) => item(p.nome, p.sob_avaliacao ? null : p.preco)).join("")}
        ${rees ? item(rees.nome, rees.preco) : ""}
      </div>
      ${rodape}
    </section>`,

    // 4. Implantes, componentes e valor clínica
    `<section class="pg">${cabecalho(4)}
      ${rotulo("Prótese sobre implante")}
      <h2>Implantes e<br>componentes</h2>
      <div class="lista">
        ${imp.map((p) => item(p.nome, p.sob_avaliacao ? null : p.preco, p.sob_avaliacao ? "Orçamento conforme o caso" : "")).join("")}
        ${comp("transfer") ? item(comp("transfer").nome + " · por unidade", comp("transfer").sob_avaliacao ? null : comp("transfer").preco, "Somente quando solicitado") : ""}
        ${comp("tibase") ? item(comp("tibase").nome + " · por unidade", comp("tibase").sob_avaliacao ? null : comp("tibase").preco, "Fornecimento opcional; compatibilidade confirmada pela GR Scan") : ""}
      </div>
      ${faixas.length ? `<div class="clinica">
        ${rotulo("Valor clínica")}
        <h3 class="clinica__t">Mais pacientes na mesma visita, menor valor por escaneamento.</h3>
        <div class="fxs">${faixaHtml}</div>
        <p class="nota">Válido para escaneamentos convencionais. Com 1 paciente vale o preço da tabela.</p>
      </div>` : ""}
      ${rodape}
    </section>`,

    // 5. Contato
    `<section class="pg contato">
      <img class="contato__logo" src="${LOGO}" alt="GR Scan">
      ${rotulo("Orçamento online")}
      <h2>Veja o valor para<br>a sua clínica.</h2>
      <img class="qr" src="${qr}" alt="QR Code para o orçamento online">
      <p class="qr__link">${CONTATO.site}/convite</p>
      <div class="contato__lista">
        <p><span>WhatsApp</span>${CONTATO.whatsapp}</p>
        <p><span>E-mail</span>${CONTATO.email}</p>
        <p><span>Site</span>${CONTATO.site}</p>
      </div>
      <p class="fino">Valores sujeitos à confirmação da disponibilidade, da compatibilidade dos componentes e da viabilidade técnica. Atendimento com agendamento; taxa de deslocamento conforme a região, informada no orçamento online. iTero é marca registrada da Align Technology, Inc.</p>
    </section>`,
  ];

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@200;300;400;500;600&display=swap" rel="stylesheet">
<style>
  @page { size: 1080px 1920px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --bg: #0b0a08; --tx: #f3ede3; --soft: #a59b8c; --dim: #6f675b; --gold: #d6a548; --gold-l: #f0d494; --hair: rgba(214,165,72,.32); }
  body { font-family: Montserrat, system-ui, sans-serif; font-weight: 300; color: var(--tx); background: var(--bg); -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { position: relative; width: 1080px; height: 1920px; overflow: hidden; page-break-after: always; background: var(--bg); padding: 120px 120px 170px; }
  .pg:last-child { page-break-after: auto; }

  .cab { display: flex; align-items: center; gap: 16px; padding-bottom: 28px; border-bottom: 1px solid var(--hair); margin-bottom: 96px; }
  .cab img { width: 34px; }
  .cab span { font-size: 20px; letter-spacing: 6px; font-weight: 400; color: var(--soft); }
  .cab .num { margin-left: auto; color: var(--gold); letter-spacing: 2px; }
  .rod { position: absolute; left: 120px; right: 120px; bottom: 80px; display: flex; justify-content: space-between; font-size: 19px; letter-spacing: 3px; color: var(--dim); border-top: 1px solid rgba(255,255,255,.07); padding-top: 26px; }

  .rotulo { font-size: 21px; letter-spacing: 7px; font-weight: 500; color: var(--gold); margin-bottom: 34px; }
  h1, h2 { font-weight: 200; line-height: 1.08; letter-spacing: -1px; }
  h2 { font-size: 86px; margin-bottom: 36px; }
  .lead { font-size: 30px; line-height: 1.6; color: var(--soft); max-width: 800px; margin-bottom: 52px; }

  /* lista de preços em estilo cardápio */
  .lista { display: flex; flex-direction: column; }
  .item { padding: 25px 0; border-top: 1px solid rgba(255,255,255,.08); }
  .item:last-child { border-bottom: 1px solid rgba(255,255,255,.08); }
  .item__linha { display: flex; align-items: baseline; gap: 18px; }
  .n { font-size: 31px; font-weight: 400; white-space: nowrap; }
  .item__linha i { flex: 1; border-bottom: 2px dotted rgba(214,165,72,.35); transform: translateY(-8px); min-width: 30px; }
  .v { font-size: 40px; font-weight: 300; color: var(--gold-l); white-space: nowrap; }
  .v small { font-size: 20px; letter-spacing: 2px; margin-right: 8px; color: var(--gold); font-weight: 400; }
  .v sup { font-size: 20px; vertical-align: top; position: relative; top: 4px; margin-left: 2px; }
  .v.sob { font-size: 28px; font-style: italic; color: var(--gold); }
  .nota { font-size: 21px; color: var(--dim); margin-top: 10px; letter-spacing: .3px; }

  /* capa */
  .capa { padding: 0; background: radial-gradient(ellipse 70% 45% at 50% 30%, rgba(214,165,72,.10), transparent 70%), var(--bg); }
  .capa__mono { position: absolute; right: -330px; top: 330px; width: 820px; opacity: .06; }
  .capa__topo { position: absolute; top: 170px; left: 0; right: 0; text-align: center; }
  .capa__logo { width: 420px; }
  .capa__meio { position: absolute; left: 120px; right: 120px; top: 1080px; }
  .capa__foto { position: absolute; left: 60px; top: 560px; width: 960px; height: 540px; object-fit: contain; }
  .capa h1 { font-size: 100px; margin-bottom: 44px; }
  .capa__sub { font-size: 32px; color: var(--soft); line-height: 1.5; max-width: 760px; }
  .capa__base { position: absolute; left: 120px; right: 120px; bottom: 120px; display: flex; justify-content: space-between; padding-top: 30px; border-top: 1px solid var(--hair); font-size: 21px; letter-spacing: 4px; color: var(--soft); }
  .capa__base span:first-child { color: var(--gold); }

  /* proposta */
  .scanner { position: relative; margin: -20px -140px 40px -40px; height: 300px; }
  .scanner img { width: 100%; height: 300px; object-fit: contain; filter: drop-shadow(0 40px 50px rgba(0,0,0,.7)); }
  .scanner--foto { margin: -10px -120px 40px 120px; height: 400px; }
  .scanner--foto img { height: 400px; object-position: right center; filter: none; }
  .scanner figcaption { position: absolute; right: 150px; bottom: -14px; font-size: 17px; color: var(--dim); letter-spacing: 1px; }
  .beneficios { display: flex; flex-direction: column; }
  .beneficios div { display: grid; grid-template-columns: 90px 1fr; column-gap: 10px; padding: 26px 0; border-top: 1px solid rgba(255,255,255,.08); }
  .b__n { grid-row: span 2; font-size: 24px; color: var(--gold); letter-spacing: 2px; padding-top: 6px; }
  .beneficios h3 { font-size: 32px; font-weight: 400; margin-bottom: 8px; }
  .beneficios p { font-size: 25px; color: var(--soft); line-height: 1.5; }

  /* valor clínica */
  .clinica { margin-top: 64px; }
  .clinica .rotulo { margin-bottom: 20px; }
  .clinica__t { font-size: 36px; font-weight: 300; line-height: 1.3; margin-bottom: 30px; max-width: 760px; }
  .fxs { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 18px; }
  .fx { border: 1px solid var(--hair); border-radius: 4px 40px 4px 40px; padding: 34px 34px 30px; display: grid; grid-template-columns: auto 1fr; column-gap: 18px; align-items: center; }
  .fx__q { font-size: 76px; font-weight: 200; color: var(--gold-l); line-height: 1; }
  .fx__l { font-size: 21px; color: var(--soft); line-height: 1.35; }
  .fx .v { grid-column: 1 / -1; margin-top: 26px; font-size: 46px; }
  .fx__p { grid-column: 1 / -1; font-size: 19px; color: var(--dim); margin-top: 4px; }

  /* contato */
  .contato { text-align: center; padding-top: 170px; background: radial-gradient(ellipse 70% 40% at 50% 62%, rgba(214,165,72,.08), transparent 70%), var(--bg); }
  .contato__logo { width: 300px; margin-bottom: 130px; }
  .contato h2 { margin-bottom: 70px; }
  .qr { width: 330px; height: 330px; border-radius: 6px; }
  .qr__link { font-size: 22px; letter-spacing: 2px; color: var(--gold); margin: 26px 0 110px; }
  .contato__lista { display: inline-flex; flex-direction: column; gap: 22px; text-align: left; border-top: 1px solid var(--hair); padding-top: 50px; min-width: 700px; }
  .contato__lista p { font-size: 29px; font-weight: 400; }
  .contato__lista span { display: inline-block; width: 200px; font-size: 20px; letter-spacing: 5px; color: var(--gold); font-weight: 500; }
  .fino { position: absolute; left: 160px; right: 160px; bottom: 90px; font-size: 18px; line-height: 1.6; color: var(--dim); }
</style></head><body>${paginas.join("")}</body></html>`;

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const fonte = await p.evaluate(() => document.fonts.check("200 60px Montserrat"));
  // Nada pode encostar no rodapé nem sair da página
  const sobras = await p.evaluate(() => [...document.querySelectorAll(".pg")].map((pg, i) => {
    const rod = pg.querySelector(".rod, .fino");
    const lim = rod ? rod.getBoundingClientRect().top - 24 : pg.getBoundingClientRect().bottom;
    const fundo = Math.max(...[...pg.children].filter((c) => c !== rod && !c.classList.contains("capa__mono") && !c.classList.contains("capa__base")).map((c) => c.getBoundingClientRect().bottom));
    return { pagina: i + 1, folga: Math.round(lim - fundo) };
  }));
  const ruins = sobras.filter((x) => x.folga < 0);
  if (ruins.length) console.log("AVISO: conteúdo passando do limite:", JSON.stringify(ruins));
  else console.log("layout ok · folga por página (px):", sobras.map((x) => x.folga).join(", "));
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  await p.pdf({ path: SAIDA, width: "1080px", height: "1920px", printBackground: true, preferCSSPageSize: true });
  await b.close();
  console.log("ok", SAIDA, "preços:", t.fonte, fonte ? "· Montserrat" : "· AVISO: fonte do sistema");
})();
