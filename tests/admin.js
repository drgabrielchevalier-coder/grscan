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

// O painel não aceita o mesmo código duas vezes: espera o próximo intervalo de 30 s quando preciso
const usados = {};
async function codigo(seg) {
  let passo = Math.floor(Date.now() / 30000);
  if (usados[seg] !== undefined && usados[seg] >= passo) { await new Promise((r) => setTimeout(r, (passo + 1) * 30000 - Date.now() + 400)); passo++; }
  usados[seg] = passo;
  return totp(seg);
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
    await p.fill("[name=codigo]", await codigo(segredo)); await p.click("button[type=submit]");
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
    await p.fill("[name=codigo]", await codigo(segredo)); await p.click("button[type=submit]");
    await p.waitForURL(/admin\/(index\.php)?$/);
    ok("login: senha + código entram no painel", (await p.textContent("h1")).includes("Painel"));
    {
      const c3 = await b.newContext(); const p3 = await c3.newPage();
      await p3.goto(BASE + "/admin/entrar.php");
      await p3.fill("[name=email]", EMAIL); await p3.fill("[name=senha]", SENHA); await p3.click("button[type=submit]");
      await p3.waitForSelector("[name=codigo]");
      await p3.fill("[name=codigo]", totp(segredo)); await p3.click("button[type=submit]");
      ok("login: o mesmo código não vale duas vezes", (await p3.isVisible(".aviso--erro")) && /entrar\.php/.test(p3.url()));
      await c3.close();
    }

    // ---------- Preços (Tarefa 6) ----------
    const precoPublico = async (id) => (await (await p.request.get(BASE + "/precos-publicos.php")).json()).procedimentos.find((x) => x.id === id);
    await p.click("nav >> text=Preços"); await p.waitForURL(/precos\.php/);
    await p.fill('[name="proc[orto][preco]"]', "185,00");
    await p.fill('[name="nota"]', "Reajuste de teste");
    await p.click("button[type=submit] >> text=Salvar");
    ok("preços: salvar mostra confirmação", (await p.textContent(".aviso--ok")).includes("versão"));
    ok("preços: público passa a usar o valor novo", (await precoPublico("orto")).preco === 18500);
    const pub = await ctx.newPage();
    await pub.goto(BASE + "/#orcamento"); await pub.waitForSelector("#qt-conteudo:not([hidden])");
    await pub.selectOption("#qt-regiao", "barra"); await pub.selectOption(".qt-paciente [data-campo=procedimento]", "orto");
    ok("preços: orçamento público mostra R$ 185,00", (await pub.textContent("#qt-total")).includes("R$ 185,00"), await pub.textContent("#qt-total"));
    await p.click("nav >> text=Histórico"); await p.waitForURL(/historico\.php/);
    const hist = await p.textContent("main");
    ok("histórico: mostra a mudança, a nota e o administrador", hist.includes("Ortodontia / alinhadores · preço: R$ 180,00 → R$ 185,00") && hist.includes("Reajuste de teste") && hist.includes("Admin Teste"), hist.slice(0, 400));
    await p.click("nav >> text=Preços");
    await p.fill('[name="proc[orto][preco]"]', "-5");
    await p.click("button[type=submit] >> text=Salvar");
    ok("preços: valor negativo é recusado", (await p.isVisible(".aviso--erro")) && (await precoPublico("orto")).preco === 18500);
    await p.goto(BASE + "/admin/precos.php");
    await p.uncheck('[name="comp[tibase][disponivel]"]');
    await p.fill('[name="novo_comp[nome]"]', "Pilar personalizado"); await p.check('[name="novo_comp[sob_avaliacao]"]');
    await p.click("button[type=submit] >> text=Salvar");
    const comps = (await (await p.request.get(BASE + "/precos-publicos.php")).json()).componentes;
    ok("preços: TiBase indisponível some do público e componente especial entra", !comps.some((c) => c.id === "tibase") && comps.some((c) => c.nome === "Pilar personalizado" && c.sob_avaliacao), JSON.stringify(comps));
    await pub.reload(); await pub.waitForSelector("#qt-conteudo:not([hidden])");
    await pub.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
    ok("preços: campo de TiBase some do orçamento público", !(await pub.isVisible("[data-campo=tibases]")) && (await pub.isVisible("[data-campo=transfers]")));
    await pub.close();
    await p.goto(BASE + "/admin/precos.php");
    await p.check('[name="comp[tibase][disponivel]"]'); await p.click("button[type=submit] >> text=Salvar");


    // ---------- Oferta de deslocamento grátis ----------
    const oferta = async () => (await (await p.request.get(BASE + "/precos-publicos.php")).json()).promocao_deslocamento;
    ok("oferta: fechada por padrão", (await oferta()) === null);
    await p.goto(BASE + "/admin/precos.php");
    await p.selectOption("[name=horas]", "4"); await p.click("button >> text=Abrir oferta");
    const of = await oferta();
    const resta = of ? (Date.parse(of.fim) - Date.now()) / 3600000 : 0;
    ok("oferta: aberta por 4 h aparece no público com o término real", of && resta > 3.9 && resta <= 4.01, JSON.stringify(of));
    ok("oferta: painel mostra a oferta aberta e o botão de encerrar", (await p.textContent("#oferta")).includes("aberta até") && (await p.isVisible("button >> text=Encerrar agora")));
    {
      const s2 = await ctx.newPage();
      await s2.goto(BASE + "/#orcamento"); await s2.waitForSelector("#qt-conteudo:not([hidden])");
      await s2.selectOption("#qt-regiao", "niteroi"); await s2.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
      await s2.fill("[data-campo=transfers]", "1"); await s2.fill("[data-campo=tibases]", "1");
      await s2.fill('#qt [name="nome"]', "Dr. Oferta"); await s2.fill('#qt [name="telefone"]', "21977776666"); await s2.fill('#qt [name="email"]', "oferta@exemplo.test");
      await s2.check('#qt [name="aceite_privacidade"]'); await s2.click("#qt-submit"); await s2.waitForSelector("#qt-done:not([hidden])");
      const txt = await s2.textContent("#qt-numero");
      ok("oferta: orçamento enviado grava o deslocamento grátis (R$ 295,00)", txt.includes("R$ 295,00"), txt);
      const num = (txt.match(/GRS-\d{4}-\d{5}/) || [""])[0];
      await s2.close();
      await p.goto(BASE + "/admin/orcamentos.php"); await p.click(`a >> text=${num}`);
      ok("oferta: detalhe no painel mostra grátis (oferta) e o valor original", (await p.textContent("main")).includes("grátis (oferta)") && (await p.textContent("main")).includes("de R$ 90,00"));
    }
    await p.goto(BASE + "/admin/historico.php");
    ok("oferta: abertura registrada no histórico", (await p.textContent("main")).includes("Oferta de deslocamento grátis: aberta até"));
    await p.goto(BASE + "/admin/precos.php");
    await p.click("button >> text=Encerrar agora");
    ok("oferta: encerrar tira a oferta do público", (await oferta()) === null && (await p.textContent("#oferta")).includes("fechada"));
    await p.goto(BASE + "/admin/precos.php");
    await p.fill("[name=fim]", "2020-01-01T10:00"); await p.click("button >> text=Abrir oferta");
    ok("oferta: término no passado é recusado", (await p.isVisible(".aviso--erro")) && (await oferta()) === null);

    // ---------- Orçamentos recebidos (Tarefa 7) ----------
    const site = await ctx.newPage();
    await site.goto(BASE + "/#orcamento"); await site.waitForSelector("#qt-conteudo:not([hidden])");
    await site.selectOption("#qt-regiao", "niteroi"); await site.selectOption(".qt-paciente [data-campo=procedimento]", "implante");
    await site.fill("[data-campo=transfers]", "1"); await site.fill("[data-campo=tibases]", "1");
    await site.fill('#qt [name="nome"]', "Dra. Paula Teste"); await site.fill('#qt [name="clinica"]', "Clínica Sorriso Teste");
    await site.fill('#qt [name="telefone"]', "21988887777"); await site.fill('#qt [name="email"]', "paula@exemplo.test");
    await site.check('#qt [name="aceite_privacidade"]'); await site.click("#qt-submit");
    await site.waitForSelector("#qt-done:not([hidden])");
    const numero = ((await site.textContent("#qt-numero")).match(/GRS-\d{4}-\d{5}/) || [""])[0];
    ok("site → servidor: orçamento gravado com número", /GRS-\d{4}-\d{5}/.test(numero) && (await site.textContent("#qt-numero")).includes("R$ 385,00"), await site.textContent("#qt-numero"));
    await site.close();
    await p.goto(BASE + "/admin/orcamentos.php");
    const lista = await p.textContent("main");
    ok("orçamentos: aparece na lista com clínica, valor e status", lista.includes(numero) && lista.includes("Clínica Sorriso Teste") && lista.includes("R$ 385,00") && lista.includes("solicitado"), lista.slice(0, 500));
    await p.fill("[name=busca]", "Sorriso"); await p.click("button >> text=Filtrar");
    ok("orçamentos: busca por clínica", (await p.textContent("main")).includes(numero));
    await p.fill("[name=busca]", "nao-existe-xyz"); await p.click("button >> text=Filtrar");
    ok("orçamentos: busca sem resultado", !(await p.textContent("main")).includes(numero));
    await p.goto(BASE + "/admin/orcamentos.php"); await p.click(`a >> text=${numero}`);
    const det = await p.textContent("main");
    ok("orçamento: detalhe com itens, total, contato e versão da tabela", det.includes("TiBase padrão elegível") && det.includes("R$ 385,00") && det.includes("paula@exemplo.test") && /tabela de preços: versão \d+/i.test(det), det.slice(0, 600));
    r = await p.goto(BASE + "/admin/orcamentos.php?id=999999");
    ok("orçamento: id inexistente → 404", r.status() === 404, r.status());

    // ---------- Administradores (Tarefa 7) ----------
    const EMAIL2 = "segundo@grscan.test", SENHA2 = "outra-senha-forte-456";
    await p.goto(BASE + "/admin/administradores.php");
    await p.fill("[name=nome]", "Segundo Admin"); await p.fill("[name=email]", EMAIL2); await p.fill("[name=senha]", SENHA2);
    await p.click("button >> text=Criar administrador");
    ok("administradores: novo administrador criado", (await p.textContent("main")).includes(EMAIL2));
    await p.click("button.sair"); await p.waitForURL(/entrar\.php/);
    await p.fill("[name=email]", EMAIL2); await p.fill("[name=senha]", SENHA2); await p.click("button[type=submit]");
    await p.waitForSelector("#totp-segredo");
    const seg2 = (await p.textContent("#totp-segredo")).replace(/\s/g, "");
    await p.fill("[name=codigo]", await codigo(seg2)); await p.click("button[type=submit]");
    await p.waitForURL(/admin\/(index\.php)?$/);
    ok("administradores: novo administrador ativa o próprio autenticador no 1º acesso", (await p.textContent(".quem")).includes("Segundo Admin"));
    await p.click("button.sair"); await p.waitForURL(/entrar\.php/);
    await p.fill("[name=email]", EMAIL); await p.fill("[name=senha]", SENHA); await p.click("button[type=submit]");
    await p.waitForSelector("[name=codigo]");
    await p.fill("[name=codigo]", await codigo(segredo)); await p.click("button[type=submit]");
    await p.waitForURL(/admin\/(index\.php)?$/);
    await p.goto(BASE + "/admin/administradores.php");
    p.once("dialog", (d) => d.accept());
    await p.click(`tr:has-text("${EMAIL2}") button >> text=Desativar`);
    ok("administradores: desativar", (await p.textContent(`tr:has-text("${EMAIL2}")`)).includes("inativo"));
    ok("administradores: não há botão para desativar a si mesmo", (await p.locator(`tr:has-text("${EMAIL}") button >> text=Desativar`).count()) === 0);
    const ctx2 = await b.newContext(); const p2 = await ctx2.newPage();
    await p2.goto(BASE + "/admin/entrar.php");
    await p2.fill("[name=email]", EMAIL2); await p2.fill("[name=senha]", SENHA2); await p2.click("button[type=submit]");
    ok("administradores: inativo não consegue entrar", (await p2.isVisible(".aviso--erro")) && !(await p2.isVisible("[name=codigo]")));
    await ctx2.close();
    await p.fill("[name=atual]", "senha-errada-qualquer"); await p.fill("[name=nova]", "nova-senha-forte-789"); await p.click("button >> text=Trocar minha senha");
    ok("trocar senha: exige a senha atual", await p.isVisible(".aviso--erro"));

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
