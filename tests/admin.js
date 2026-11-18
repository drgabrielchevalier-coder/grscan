/* Testes do painel administrativo (/admin/) e da ligação com o orçamento público.
   Sobe o próprio servidor PHP numa porta livre, com banco temporário.
   Uso: node tests/admin.js [pasta-temporaria]  (Playwright instalado) */
const { chromium } = require("playwright");
const { spawn } = require("child_process");
const crypto = require("crypto"), fs = require("fs"), os = require("os"), path = require("path");

const RAIZ = path.join(__dirname, "..");
const DADOS = path.join(process.argv[2] || os.tmpdir(), "grscan-admin-" + process.pid);
const PORTA = 8191, BASE = "http://127.0.0.1:" + PORTA;
const EMAIL = "admin@grscan.test", SENHA = "senha-forte-do-teste-123";
const results = [];
const ok = (name, cond, info = "") => { results.push({ name, pass: !!cond }); console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  -> " + String(info).slice(0, 300))); };

function base32dec(s) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = "";
  for (const c of s.replace(/[\s=]/g, "").toUpperCase()) bits += A.indexOf(c).toString(2).padStart(5, "0");
  const bytes = []; for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}
function totp(segredo, t = Date.now() / 1000) {
  const cont = Buffer.alloc(8); cont.writeBigUInt64BE(BigInt(Math.floor(t / 30)));
  const h = crypto.createHmac("sha1", base32dec(segredo)).update(cont).digest();
  const o = h[19] & 15, n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1e6).padStart(6, "0");
}

(async () => {
  fs.rmSync(DADOS, { recursive: true, force: true }); fs.mkdirSync(DADOS, { recursive: true });
  const srv = spawn("php", ["-S", "127.0.0.1:" + PORTA, "-t", RAIZ], { env: { ...process.env, GRSCAN_DADOS: DADOS, GRSCAN_SEM_EMAIL: "1", GRSCAN_SEM_LIMITE: "1" }, stdio: "ignore" });
  await new Promise((r) => setTimeout(r, 800));
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  const erros = []; p.on("pageerror", (e) => erros.push(e.message));
  let segredo = "";
  try {
    // ---------- Instalação ----------
    let r = await p.goto(BASE + "/admin/instalar.php");
    ok("instalação: cria a chave fora do public_html", fs.existsSync(path.join(DADOS, "grscan-config.php")) && (await p.content()).includes("grscan-config.php"));
    const chave = fs.readFileSync(path.join(DADOS, "grscan-config.php"), "utf8").match(/'chave_instalacao'\s*=>\s*'([^']+)'/)[1];
    await p.fill("[name=chave]", "chave-errada"); await p.fill("[name=nome]", "Admin Teste"); await p.fill("[name=email]", EMAIL);
    await p.fill("[name=senha]", SENHA); await p.fill("[name=senha2]", SENHA); await p.click("button[type=submit]");
    ok("instalação: chave errada é recusada", (await p.textContent(".aviso--erro")).includes("Chave"), await p.content());
    await p.fill("[name=chave]", chave); await p.fill("[name=senha]", SENHA); await p.fill("[name=senha2]", SENHA); await p.click("button[type=submit]");
    await p.waitForSelector("#totp-segredo");
    segredo = (await p.textContent("#totp-segredo")).replace(/\s/g, "");
    ok("instalação: mostra o segredo do autenticador", /^[A-Z2-7]{32}$/.test(segredo), segredo);
    await p.fill("[name=codigo]", "000000"); await p.click("button[type=submit]");
    ok("ativação: código errado é recusado", await p.isVisible(".aviso--erro"));
    await p.fill("[name=codigo]", totp(segredo)); await p.click("button[type=submit]");
    await p.waitForURL(/admin\/(index\.php)?$/);
    ok("ativação: código certo entra no painel", (await p.textContent("h1")).length > 0);
    r = await p.request.get(BASE + "/admin/instalar.php");
    ok("instalação: desativada depois do primeiro administrador", r.status() === 404, r.status());

    // ---------- Sessão, cookie e CSRF ----------
    const ck = (await ctx.cookies()).find((c) => c.name === "grscan_admin");
    ok("cookie de sessão HttpOnly e SameSite=Strict", ck && ck.httpOnly && ck.sameSite === "Strict", JSON.stringify(ck));
    r = await p.request.post(BASE + "/admin/sair.php", { form: {} });
    ok("POST sem token CSRF: 403", r.status() === 403, r.status());
    await p.click("button.sair"); await p.waitForURL(/entrar\.php/);
    r = await p.goto(BASE + "/admin/index.php");
    ok("sem sessão: painel redireciona para o login", /entrar\.php/.test(p.url()), p.url());
    r = await p.request.get(BASE + "/admin/index.php", { maxRedirects: 0 });
    ok("sem sessão: resposta 302 sem conteúdo do painel", r.status() === 302 && !(await r.text()).includes("Orçamentos"), r.status());
    const hdr = (await p.request.get(BASE + "/admin/entrar.php")).headers();
    ok("painel: noindex e no-store", (hdr["x-robots-tag"] || "").includes("noindex") && (hdr["cache-control"] || "").includes("no-store"), JSON.stringify(hdr));

    // ---------- Login ----------
    await p.goto(BASE + "/admin/entrar.php");
    await p.fill("[name=email]", EMAIL); await p.fill("[name=senha]", "errada"); await p.click("button[type=submit]");
    ok("login: senha errada com mensagem genérica", (await p.textContent(".aviso--erro")).includes("inválid"));
    await p.fill("[name=email]", EMAIL); await p.fill("[name=senha]", SENHA); await p.click("button[type=submit]");
    await p.waitForSelector("[name=codigo]");
    await p.fill("[name=codigo]", totp(segredo)); await p.click("button[type=submit]");
    await p.waitForURL(/admin\/(index\.php)?$/);
    ok("login: senha + código entram no painel", (await p.textContent("h1")).includes("Painel"));

    // (as tarefas seguintes acrescentam testes aqui, com a sessão aberta)
    if (global.testesComSessao) await global.testesComSessao({ p, ctx, BASE, ok, totp, segredo, EMAIL, SENHA });

    // ---------- Bloqueio (por último: bloqueia este e-mail por 15 min) ----------
    await p.click("button.sair"); await p.waitForURL(/entrar\.php/);
    for (let i = 0; i < 5; i++) { await p.fill("[name=email]", EMAIL); await p.fill("[name=senha]", "errada" + i); await p.click("button[type=submit]"); }
    await p.fill("[name=email]", EMAIL); await p.fill("[name=senha]", SENHA); await p.click("button[type=submit]");
    ok("bloqueio: 5 erros bloqueiam até a senha certa", (await p.textContent(".aviso--erro")).includes("Muitas tentativas") && !(await p.isVisible("[name=codigo]")));
    ok("painel: sem erros de JS", erros.length === 0, erros.join(" | "));
  } catch (e) {
    ok("execução sem exceções", false, e.stack);
  }
  await b.close(); srv.kill();
  fs.rmSync(DADOS, { recursive: true, force: true });
  const f = results.filter((x) => !x.pass).length;
  console.log(`\n${results.length - f}/${results.length} passaram`);
  process.exit(f ? 1 : 0);
})();
