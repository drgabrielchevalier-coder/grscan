/* Gera assets/convite-og.jpg (1200×630), a imagem da prévia do link de convite no WhatsApp.
   Uso: node tests/gerar-og-convite.js   (Playwright instalado; usa o logotipo original do site) */
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path");
const RAIZ = path.join(__dirname, "..");
const logo = "data:image/png;base64," + fs.readFileSync(path.join(RAIZ, "assets/logo-completa.png")).toString("base64");
const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; background: #0a0907; font-family: Montserrat, system-ui, sans-serif; color: #efe9df; overflow: hidden; }
  .moldura { position: absolute; inset: 36px; border: 2px solid rgba(217,164,65,.55); border-radius: 6px 64px 6px 64px; }
  .brilho { position: absolute; right: -180px; top: -220px; width: 760px; height: 760px; border-radius: 50%;
            background: radial-gradient(circle, rgba(217,164,65,.16), rgba(217,164,65,0) 65%); }
  .conteudo { position: absolute; inset: 36px; display: flex; align-items: center; gap: 56px; padding: 0 72px; }
  .logo { width: 330px; flex: 0 0 auto; }
  .texto { display: flex; flex-direction: column; gap: 22px; }
  .kicker { font-size: 26px; font-weight: 600; color: #d9a441; letter-spacing: .5px; }
  h1 { font-size: 64px; line-height: 1.06; font-weight: 700; }
  .cta { display: inline-flex; align-items: center; gap: 14px; align-self: flex-start; font-size: 28px; font-weight: 700; color: #1a1206;
         background: linear-gradient(180deg, #f5cf6e, #d99a2b); padding: 16px 28px; border-radius: 4px 22px 4px 22px; }
  .cta span { font-size: 30px; }
  .site { font-size: 22px; color: #aba193; }
  sup.reg { font-size: .5em; line-height: 0; vertical-align: .75em; margin-left: .04em; font-weight: 500; }
</style></head><body>
  <div class="brilho"></div><div class="moldura"></div>
  <div class="conteudo">
    <img class="logo" src="${logo}" alt="">
    <div class="texto">
      <p class="kicker">Escaneamento intraoral iTero<sup class="reg">®</sup></p>
      <h1>No seu consultório, com o valor na hora</h1>
      <p class="cta">Veja o valor para a sua clínica <span>→</span></p>
      <p class="site">grscan.implantstore.com.br</p>
    </div>
  </div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.setContent(html, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready);
  const fonte = await p.evaluate(() => document.fonts.check("700 64px Montserrat"));
  const saida = path.join(RAIZ, "assets/convite-og.jpg");
  await p.screenshot({ path: saida, type: "jpeg", quality: 88 });
  await b.close();
  console.log("ok", saida, Math.round(fs.statSync(saida).size / 1024) + " KB", fonte ? "Montserrat" : "AVISO: fonte do sistema (Montserrat não carregou)");
})();
