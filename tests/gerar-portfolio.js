/* Gera o PDF "Portfólio de serviços · Tabela" da GR Scan (páginas verticais 9:16, 810×1440 pt).
   Os preços vêm da tabela vigente do site (precos-publicos.php); sem internet, usa app/precos-padrao.json.
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
const SCANNER = "data:image/png;base64," + b64("assets/scanner-render.png");

const reais = (c) => Math.floor(c / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const cent = (c) => String(c % 100).padStart(2, "0");
const esc = (s) => String(s).replace(/[&<>"]/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));

function preco(c, legenda) {
  if (c === null || c === undefined) return `<div class="preco"><span class="sob">sob avaliação</span>${legenda ? `<small>${esc(legenda)}</small>` : ""}</div>`;
  if (c === 0) return `<div class="preco"><span class="valor">grátis</span>${legenda ? `<small>${esc(legenda)}</small>` : ""}</div>`;
  return `<div class="preco"><span class="rs">R$</span><span class="valor">${reais(c)}</span><span class="cent">,${cent(c)}</span>${legenda ? `<small>${esc(legenda)}</small>` : ""}</div>`;
}
const linha = (nome, c, legenda, detalhe) =>
  `<div class="linha"><div class="nome">${esc(nome)}${detalhe ? `<em>${esc(detalhe)}</em>` : ""}</div>${preco(c, legenda)}</div>`;

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
  const qr = await QR.toDataURL(SITE + "/convite/", { margin: 1, width: 520, color: { dark: "#0a0907", light: "#efe9df" } });

  const rodape = `<div class="rodape"><span>GR Scan · Tabela ${ANO}</span><span>${CONTATO.whatsapp} · ${CONTATO.site}</span></div>`;
  const topo = `<img class="logo-topo" src="${LOGO}" alt="GR Scan">`;
  const titulo = (txt) => `<h2 class="titulo"><i class="seta"></i>${txt}</h2>`;

  const faixaTxt = faixas.map((f, i) => {
    const prox = faixas[i + 1];
    const qtd = prox ? (prox.min - 1 > f.min ? `${f.min} a ${prox.min - 1}` : `${f.min}`) : `${f.min} ou mais`;
    return `<div class="fx"><b>${qtd} pacientes</b>${preco(f.preco, "por escaneamento")}</div>`;
  }).join("");

  const paginas = [
    // 1. Capa
    `<section class="pg capa">
      <img class="logo-capa" src="${LOGO}" alt="GR Scan — Digital Scan">
      <p class="sub-capa">Escaneamento intraoral iTero no seu consultório</p>
      <div class="meio-capa">
        <p class="kicker">Rio de Janeiro e Região Metropolitana</p>
        <h1>Portfólio de serviços</h1>
        <p class="ano">Tabela ${ANO}</p>
      </div>
      <img class="mono-capa" src="${MONO}" alt="">
      <div class="contatos-capa">
        <b>GR SCAN</b><i></i>
        <div><p>WhatsApp ${CONTATO.whatsapp}</p><p>${CONTATO.email}</p><p>${CONTATO.site}</p></div>
      </div>
    </section>`,

    // 2. O serviço
    `<section class="pg conteudo">${topo}
      ${titulo("Escaneamento intraoral iTero")}
      <p class="texto">Vamos até o seu consultório com o scanner iTero e um operador especializado, no horário agendado. Você atende o paciente na sua cadeira e recebe o modelo digital, sem moldeira e sem gesso.</p>
      <p class="destaque-curto">Necessário agendamento</p>
      <figure class="scanner"><img src="${SCANNER}" alt="Ilustração de scanner intraoral"><figcaption>Imagem ilustrativa</figcaption></figure>
      <h3 class="sub">Como funciona</h3>
      <ol class="passos">
        <li><b>Agende o horário</b><span>Pelo orçamento online ou pelo WhatsApp. Confirmamos o agendamento com você.</span></li>
        <li><b>Vamos até a sua clínica</b><span>Levamos o scanner iTero e o operador até o seu consultório.</span></li>
        <li><b>Escaneamento e conferência</b><span>Escaneamento intraoral e revisão do modelo digital antes do envio.</span></li>
        <li><b>Arquivos para o laboratório</b><span>STL/PLY por link seguro para você ou direto ao laboratório indicado.</span></li>
      </ol>
      ${rodape}
    </section>`,

    // 3. Tabela de escaneamentos
    `<section class="pg conteudo">${topo}
      ${titulo("Escaneamentos")}
      <p class="texto">Duas arcadas (inclusive a antagonista) e registro oclusal, quando clinicamente viáveis, com arquivos STL/PLY.</p>
      <div class="linhas">
        ${conv.map((p) => linha(p.nome, p.sob_avaliacao ? null : p.preco, "por paciente")).join("")}
        ${rees ? linha(rees.nome, rees.preco, "por paciente") : ""}
      </div>
      ${faixas.length ? `<div class="barra"></div>
      <h3 class="sub">Valor clínica: vários pacientes na mesma visita</h3>
      <p class="texto pequeno">Escaneamentos convencionais, pelo total de pacientes da visita. Com 1 paciente vale o preço da tabela.</p>
      <div class="faixas">${faixaTxt}</div>` : ""}
      ${rodape}
    </section>`,

    // 4. Implantes e componentes
    `<section class="pg conteudo">${topo}
      ${titulo("Implantes e componentes")}
      <p class="texto">Com corpo de escaneamento (scanbody): posição dos implantes, antagonista e registro oclusal na mesma visita.</p>
      <div class="faixa">Escaneamento de implantes</div>
      <div class="linhas">
        ${imp.map((p) => linha(p.nome, p.sob_avaliacao ? null : p.preco, p.sob_avaliacao ? "conforme o caso" : "por paciente")).join("")}
      </div>
      <div class="barra"></div>
      <div class="faixa">Componentes (só quando solicitados)</div>
      <div class="linhas">
        ${comp("transfer") ? linha(comp("transfer").nome, comp("transfer").sob_avaliacao ? null : comp("transfer").preco, "por unidade") : ""}
        ${comp("tibase") ? linha("Fornecimento de " + comp("tibase").nome, comp("tibase").sob_avaliacao ? null : comp("tibase").preco, "por unidade", "Disponibilidade e compatibilidade confirmadas pela GR Scan") : ""}
      </div>
      <h3 class="sub">Arquivos necessários</h3>
      <p class="texto pequeno">Informe no agendamento a marca, a conexão e a plataforma de cada implante, para separarmos o scanbody compatível.</p>
      ${rodape}
    </section>`,

    // 5. Deslocamento + observações
    `<section class="pg conteudo">${topo}
      ${titulo("Deslocamento")}
      <p class="texto">Uma taxa por visita, qualquer que seja o número de pacientes atendidos.</p>
      <div class="linhas regioes">
        ${t.regioes.map((r) => linha(r.nome, r.sob_consulta ? null : r.taxa, "", "").replace("sob avaliação", "sob consulta")).join("")}
      </div>
      <div class="barra"></div>
      ${titulo("Observações")}
      <ul class="obs">
        <li>Valores sujeitos à confirmação da disponibilidade, da compatibilidade dos componentes e da viabilidade técnica.</li>
        <li>Itens sob avaliação recebem orçamento individual.</li>
        <li>Formas de pagamento e prazos são informados na confirmação do agendamento.</li>
        <li>Tabela válida para ${ANO}; valores atualizados sempre no orçamento online.</li>
      </ul>
      ${rodape}
    </section>`,

    // 6. Contato
    `<section class="pg contato">
      <img class="logo-contato" src="${LOGO}" alt="GR Scan">
      <h2>Monte seu orçamento online</h2>
      <p class="texto">Aponte a câmera do celular e veja o valor para a sua clínica na hora.</p>
      <img class="qr" src="${qr}" alt="QR Code para o orçamento online">
      <p class="link">${CONTATO.site}/convite</p>
      <div class="linha-contato"></div>
      <h3>Entre em contato</h3>
      <div class="itens-contato"><p><b>WhatsApp</b>${CONTATO.whatsapp}</p><p><b>E-mail</b>${CONTATO.email}</p><p><b>Site</b>${CONTATO.site}</p></div>
    </section>`,
  ];

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: 1080px 1920px; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Montserrat, system-ui, sans-serif; color: #efe9df; background: #0a0907; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .pg { position: relative; width: 1080px; height: 1920px; overflow: hidden; page-break-after: always; background: #0f0d0a; }
  .pg:last-child { page-break-after: auto; }
  /* faixa lateral dourada (páginas de conteúdo) */
  .conteudo::before, .contato::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 120px; background: linear-gradient(180deg, #f5cf6e, #d99a2b 55%, #a06a22); }
  .conteudo { padding: 84px 96px 150px 200px; }
  .logo-topo { display: block; width: 200px; margin: 0 auto 44px; }
  .titulo { position: relative; font-size: 60px; line-height: 1.08; font-weight: 800; margin: 0 0 22px; }
  .seta { position: absolute; left: -80px; top: 50%; transform: translateY(-50%); width: 0; height: 0; border-top: 34px solid transparent; border-bottom: 34px solid transparent; border-left: 46px solid #d99a2b; }
  .texto { font-size: 27px; line-height: 1.5; letter-spacing: .5px; color: #c9bfae; margin-bottom: 26px; max-width: 780px; }
  .texto.pequeno { font-size: 23px; margin-bottom: 18px; }
  .destaque-curto { font-size: 30px; font-weight: 700; color: #fbe3a0; margin-bottom: 20px; }
  .sub { font-size: 32px; font-weight: 700; color: #fbe3a0; margin: 6px 0 14px; }
  .faixa { background: linear-gradient(90deg, #d99a2b, #f5cf6e); color: #1a1206; font-weight: 700; font-size: 25px; padding: 14px 24px; border-radius: 4px 26px 4px 26px; margin-bottom: 14px; }
  .linhas { display: flex; flex-direction: column; gap: 8px; margin-bottom: 22px; }
  .linha { display: flex; align-items: center; justify-content: space-between; gap: 24px; background: #1d1a16; padding: 12px 24px; border-left: 4px solid #a06a22; }
  .nome { font-size: 27px; font-weight: 700; line-height: 1.25; }
  .nome em { display: block; font-style: normal; font-weight: 500; font-size: 21px; color: #aba193; margin-top: 4px; }
  .preco { text-align: right; white-space: nowrap; line-height: 1; }
  .preco .rs { font-size: 26px; font-weight: 700; color: #fbe3a0; margin-right: 4px; }
  .preco .valor { font-size: 46px; font-weight: 800; color: #fbe3a0; }
  .preco .cent { font-size: 26px; font-weight: 700; color: #fbe3a0; vertical-align: top; position: relative; top: 4px; }
  .preco .sob { font-size: 30px; font-weight: 700; color: #fbe3a0; }
  .preco small { display: block; font-size: 18px; font-weight: 600; color: #aba193; margin-top: 6px; }
  .regioes .linha { padding: 8px 24px; }
  .regioes .nome { font-size: 26px; }
  .regioes .preco .valor { font-size: 36px; }
  .barra { height: 10px; background: linear-gradient(90deg, #d99a2b, #f5cf6e); margin: 14px 0 30px; border-radius: 0 10px 0 10px; }
  .faixas { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .fx { background: #1d1a16; border: 2px solid #3a2f1f; border-radius: 4px 26px 4px 26px; padding: 18px 22px; display: flex; flex-direction: column; gap: 10px; }
  .fx b { font-size: 26px; }
  .fx .preco { text-align: left; }
  .scanner { margin: 0 -60px 26px -10px; position: relative; height: 330px; }
  .scanner img { width: 100%; height: 330px; object-fit: contain; display: block; filter: drop-shadow(0 30px 40px rgba(0,0,0,.6)); }
  .scanner figcaption { position: absolute; right: 70px; bottom: -10px; font-size: 18px; color: #7d7466; }
  .passos { list-style: none; counter-reset: p; display: flex; flex-direction: column; gap: 16px; }
  .passos li { counter-increment: p; position: relative; padding-left: 92px; min-height: 64px; }
  .passos li::before { content: counter(p, decimal-leading-zero); position: absolute; left: 0; top: 0; width: 66px; height: 58px; display: grid; place-items: center; font-weight: 800; font-size: 26px; color: #1a1206; background: linear-gradient(180deg, #f5cf6e, #d99a2b); border-radius: 4px 18px 4px 18px; }
  .passos b { display: block; font-size: 28px; margin-bottom: 2px; }
  .passos span { font-size: 23px; color: #c9bfae; line-height: 1.4; }
  .obs { list-style: none; display: flex; flex-direction: column; gap: 12px; }
  .obs li { font-size: 24px; line-height: 1.45; color: #c9bfae; padding-left: 34px; position: relative; }
  .obs li::before { content: ""; position: absolute; left: 0; top: 14px; width: 14px; height: 14px; background: #d99a2b; border-radius: 2px 7px 2px 7px; }
  .rodape { position: absolute; left: 200px; right: 96px; bottom: 60px; display: flex; justify-content: space-between; font-size: 20px; color: #7d7466; border-top: 1px solid #3a2f1f; padding-top: 18px; }
  /* capa */
  .capa { background: radial-gradient(ellipse at 80% 15%, rgba(217,164,65,.14), transparent 55%), #0a0907; padding: 150px 110px 0; text-align: center; }
  .logo-capa { width: 470px; display: block; margin: 0 auto 30px; }
  .sub-capa { font-size: 30px; font-weight: 600; color: #d9a441; }
  .meio-capa { margin-top: 300px; }
  .kicker { font-size: 26px; letter-spacing: 6px; color: #aba193; margin-bottom: 26px; }
  .capa h1 { font-size: 104px; line-height: 1.02; font-weight: 800; letter-spacing: 1px; }
  .ano { margin-top: 30px; display: inline-block; font-size: 34px; font-weight: 700; color: #1a1206; background: linear-gradient(180deg, #f5cf6e, #d99a2b); padding: 12px 34px; border-radius: 4px 24px 4px 24px; }
  .mono-capa { position: absolute; right: 90px; bottom: 300px; width: 380px; opacity: .22; }
  .contatos-capa { position: absolute; left: 110px; right: 110px; bottom: 110px; border-top: 2px solid #3a2f1f; padding-top: 50px; display: flex; align-items: center; gap: 50px; text-align: left; }
  .contatos-capa b { font-size: 34px; letter-spacing: 6px; color: #efe9df; }
  .contatos-capa i { width: 3px; height: 110px; background: #d99a2b; }
  .contatos-capa p { font-size: 27px; letter-spacing: 1.5px; font-weight: 600; line-height: 1.6; }
  /* contato */
  .contato { padding: 200px 110px 0 220px; text-align: center; }
  .logo-contato { width: 400px; margin: 0 auto 90px; display: block; }
  .contato h2 { font-size: 62px; font-weight: 800; margin-bottom: 24px; }
  .contato .texto { margin: 0 auto 50px; }
  .qr { width: 380px; height: 380px; border-radius: 12px; border: 10px solid #efe9df; }
  .link { font-size: 26px; color: #d9a441; margin-top: 22px; font-weight: 600; }
  .linha-contato { height: 3px; background: #d99a2b; margin: 90px auto 60px; width: 70%; }
  .contato h3 { font-size: 40px; letter-spacing: 6px; font-weight: 600; margin-bottom: 40px; }
  .itens-contato { display: inline-flex; flex-direction: column; gap: 22px; text-align: left; }
  .itens-contato p { font-size: 30px; font-weight: 600; letter-spacing: 1px; }
  .itens-contato b { display: inline-block; width: 190px; color: #d9a441; font-weight: 700; }
</style></head><body>${paginas.join("")}</body></html>`;

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const fonte = await p.evaluate(() => document.fonts.check("800 60px Montserrat"));
  // Nada pode encostar no rodapé nem sair da página
  const sobras = await p.evaluate(() => [...document.querySelectorAll(".pg")].map((pg, i) => {
    const lim = pg.querySelector(".rodape") ? pg.querySelector(".rodape").getBoundingClientRect().top - 16 : pg.getBoundingClientRect().bottom;
    const fundo = Math.max(...[...pg.children].filter((c) => !c.classList.contains("rodape")).map((c) => c.getBoundingClientRect().bottom));
    return { pagina: i + 1, folga: Math.round(lim - fundo) };
  }));
  const ruins = sobras.filter((x) => x.folga < 0);
  if (ruins.length) console.log("AVISO: conteúdo passando do limite:", JSON.stringify(ruins));
  else console.log("layout ok · folga por página (px):", sobras.map((x) => x.folga).join(", "));
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  await p.pdf({ path: SAIDA, width: "1080px", height: "1920px", printBackground: true, preferCSSPageSize: true });
  // Prévias em PNG de cada página (para conferência)
  const n = await p.locator(".pg").count();
  for (let i = 0; i < n; i++) await p.locator(".pg").nth(i).screenshot({ path: SAIDA.replace(/\.pdf$/, `-p${i + 1}.png`) });
  await b.close();
  console.log("ok", SAIDA, "preços:", t.fonte, fonte ? "· Montserrat" : "· AVISO: fonte do sistema");
})();
