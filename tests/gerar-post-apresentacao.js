/* Gera o post de apresentação da GR Scan para o Instagram (feed 4:5, 3200×4000 px).
   Monta a arte com foto real do scanner, o logotipo oficial (arquivo, sem redesenho) e tipografia.
   Foto: entregas/imagens-portfolio/<arquivo> (fora do Git). Sem foto em alta, usa a provisória e avisa.
   Uso: node tests/gerar-post-apresentacao.js [saida.png] [foto.png] */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");

const RAIZ = path.join(__dirname, "..");
const SAIDA = path.resolve(process.argv[2] || path.join(RAIZ, "entregas/post-apresentacao-4x5.png"));
const FOTO = path.resolve(process.argv[3] || path.join(RAIZ, "entregas/imagens-portfolio/lumina-mao.png"));
const W = 1600, H = 2000, ESCALA = 2; // 3200×4000 px

const uri = (f) => `data:image/${path.extname(f) === ".jpg" ? "jpeg" : "png"};base64,` + fs.readFileSync(f).toString("base64");

const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300&family=Manrope:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --preto: #171717; --grafite: #211C19; --ouro: #C49B59; --off: #F3F0EA; --taupe: #A99B8A; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; background: var(--preto); }
  .post { position: relative; width: ${W}px; height: ${H}px; overflow: hidden; font-family: Manrope, sans-serif; font-weight: 300; color: var(--off);
    background: radial-gradient(ellipse 70% 30% at 30% 72%, rgba(196,155,89,.07), transparent 70%), linear-gradient(180deg, #0a0909 0%, #0a0909 48%, var(--preto) 72%, var(--grafite) 100%); }
  .rotulo { position: absolute; left: 130px; top: 130px; font-size: 22px; font-weight: 500; letter-spacing: .32em; color: var(--ouro); text-transform: uppercase; z-index: 2; }
  .foto { position: absolute; left: 0; right: 0; top: 0; }
  .foto img { display: block; width: 100%; -webkit-mask-image: linear-gradient(180deg, #000 62%, transparent 97%); mask-image: linear-gradient(180deg, #000 62%, transparent 97%); }
  .legenda { position: absolute; z-index: 2; right: 130px; top: 1040px; font-size: 20px; letter-spacing: .14em; color: var(--taupe); }
  .texto { position: absolute; left: 130px; right: 130px; top: 1150px; }
  h1 { font-family: "Cormorant Garamond", serif; font-weight: 300; font-size: 158px; line-height: .98; letter-spacing: -.01em; }
  .sub { margin-top: 48px; font-size: 42px; line-height: 1.4; color: var(--taupe); max-width: 1000px; }
  .base { position: absolute; left: 130px; right: 130px; bottom: 130px; display: flex; align-items: flex-end; justify-content: space-between; padding-top: 48px; border-top: 1px solid rgba(196,155,89,.38); }
  .base img { width: 240px; display: block; }
  .cta { text-align: right; }
  .cta b { display: block; font-weight: 400; font-size: 32px; letter-spacing: .02em; }
  .cta span { display: block; margin-top: 14px; font-size: 23px; letter-spacing: .16em; color: var(--ouro); }
  sup { font-size: .55em; line-height: 0; vertical-align: .6em; }
</style></head><body><div class="post">
  <p class="rotulo">Escaneamento intraoral · Rio de Janeiro</p>
  <div class="foto"><img src="${uri(FOTO)}" alt=""></div>
  <p class="legenda">Tecnologia iTero<sup>®</sup> Lumina<sup>™</sup></p>
  <div class="texto">
    <h1>Sua clínica<br>pode ser digital.</h1>
    <p class="sub">Sem precisar investir em um scanner próprio.</p>
  </div>
  <div class="base">
    <img src="${uri(path.join(RAIZ, "assets/logo-completa.png"))}" alt="GR Scan">
    <p class="cta"><b>Solicite informações</b><span>grscan.implantstore.com.br</span></p>
  </div>
</div></body></html>`;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: ESCALA });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const fontes = await p.evaluate(() => [document.fonts.check('300 100px "Cormorant Garamond"'), document.fonts.check("300 40px Manrope")]);
  // Nenhum bloco de texto pode encostar em outro nem sair da arte
  const caixas = await p.evaluate(() => Object.fromEntries([".rotulo", ".foto img", ".legenda", ".texto", ".base"].map((s) => {
    const r = document.querySelector(s).getBoundingClientRect(); return [s, { top: Math.round(r.top), bottom: Math.round(r.bottom), right: Math.round(r.right) }];
  })));
  const avisos = [];
  if (caixas[".texto"].bottom > caixas[".base"].top - 60) avisos.push("texto encosta na assinatura");
  if (caixas[".legenda"].bottom > caixas[".texto"].top - 40) avisos.push("legenda encosta no título");
  const nat = await p.evaluate(() => { const i = document.querySelector(".foto img"); return { nat: i.naturalWidth, exib: Math.round(i.getBoundingClientRect().width) }; });
  const ampliacao = (nat.exib * ESCALA / nat.nat).toFixed(1);
  fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
  await p.screenshot({ path: SAIDA, type: "png" });
  await b.close();
  console.log(avisos.length ? "AVISO: " + avisos.join("; ") : "layout ok", "·", fontes.every(Boolean) ? "fontes ok" : "AVISO: fonte do sistema",
    "· foto ampliada " + ampliacao + "x" + (ampliacao > 1.05 ? " (precisa de foto em alta)" : ""), "·", SAIDA);
})();
