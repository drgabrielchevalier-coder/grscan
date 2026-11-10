# Barra de versão do deploy — plano de implementação

> **Execução:** o próprio Claude executa este plano nesta sessão (regra do `CLAUDE.md`), um commit por tarefa. Passos com `- [ ]`.

**Objetivo:** abrir `/?versao` e ver se `index.html`, `styles.css` e `script.js` publicados estão na mesma versão.

**Arquitetura:** cada um dos três arquivos guarda a versão num marcador. Um script dentro do `index.html` lê os três e monta a barra com estilos próprios. Assim a barra funciona mesmo quando o CSS ou o JS forem de outra versão. Um teste em Node confere, antes de cada deploy, se os marcadores, os `?v=` e o `CHANGELOG.md` batem.

**Tecnologia:** HTML/CSS/JS puro; testes em `tests/regressao.js` (Playwright + servidor PHP local).

**Desenho:** `docs/superpowers/specs/2026-11-10-barra-de-versao-design.md`

## Restrições globais
- Versão inicial: `2.0`. Formato `MAIOR.MENOR`, sem terceiro número. Cada deploy soma 1 ao MENOR (2.9 → 2.10).
- Sem `?versao` na URL: nenhum elemento novo no DOM, nenhuma mudança visual, nenhum pedido de rede a mais.
- Não mudar PHP, nomes de campos, IDs existentes nem o bloco `CONFIG`.
- Textos em português do Brasil; data exibida como `dd/mm/aaaa`.
- Preto e dourado: barra com fundo `#15130f` e texto `#efe9df`. Estado ok com ponto `#d9a441`; incompleto com fundo `#5a1414` e ponto `#ff6b6b`.

## Pontos de atenção (testes em cada tarefa)
1. `script.js` não carrega (404) → item "scripts" mostra `não carregado ✗` e a barra fica vermelha (Tarefa 2).
2. `?versao=1`, `?versao=` ou `?versao` junto com outros parâmetros → a barra aparece igual (Tarefa 2).
3. `/?versao#agendar` → o modal de agendamento continua abrindo pelo link direto (Tarefa 2).
4. Celular de 320 px com a barra aberta → sem rolagem horizontal, e o botão "fechar" remove a barra (Tarefa 2).
5. Valor da variável CSS com aspas e espaços (`"2.0"`, ` '2.0' `) → é normalizado para `2.0` antes de comparar (Tarefa 2).

---

### Tarefa 1: marcadores de versão, teste de consistência e regra no CLAUDE.md

**Arquivos:**
- Modificar: `index.html` (`<head>`; linhas 25 e 649 `?v=2.0.0` → `?v=2.0`)
- Modificar: `styles.css` (`@layer tokens` → `:root`)
- Modificar: `script.js` (antes do bloco CONFIG)
- Modificar: `CHANGELOG.md` (primeiro título `##`)
- Modificar: `CLAUDE.md` (seção "Entrega")
- Testes: `tests/regressao.js`

**Interfaces (produz):**
- `<meta name="grscan-versao" content="2.0" data-data="2026-11-10" data-resumo="Linha de Precisão">`
- CSS: `--grscan-versao: "2.0";` em `:root`
- JS: `var GRSCAN_VERSAO = "2.0";` no topo do `script.js`, com o comentário "Versão do deploy: não editar à mão (ver CLAUDE.md)". É `var` para ficar em `window.GRSCAN_VERSAO`.
- CHANGELOG: o primeiro título passa a ser `## 2.0 — 10/11/2026 — Linha de Precisão`

- [ ] **Passo 1:** no começo de `tests/regressao.js`, antes de abrir o navegador, escrever o teste `versão: marcadores consistentes`. Ele lê os arquivos com `fs` a partir de `path.join(__dirname, "..")` e verifica:
  ```js
  ok("versão: index.html, styles.css e script.js iguais", vHtml && vHtml === vCss && vCss === vJs, [vHtml, vCss, vJs]);
  ok("versão: ?v= de styles.css e script.js igual à versão", vQueryCss === vHtml && vQueryJs === vHtml, [vQueryCss, vQueryJs]);
  ok("versão: CHANGELOG começa pela versão atual", changelogPrimeiroTitulo.startsWith("## " + vHtml + " "), changelogPrimeiroTitulo);
  ok("versão: formato MAIOR.MENOR", /^\d+\.\d+$/.test(vHtml), vHtml);
  ```
- [ ] **Passo 2:** rodar `node tests/regressao.js http://127.0.0.1:8090`. Esperado: FAIL nos 4 testes de versão.
- [ ] **Passo 3:** gravar os marcadores e os `?v=2.0` acima e mudar o título do CHANGELOG.
- [ ] **Passo 4:** no `CLAUDE.md`, em "Entrega", acrescentar a regra: "Todo deploy (pacote `.zip` ou commit no branch de produção) sobe a versão em 0,1 em `index.html` (meta `grscan-versao` + data + resumo), `styles.css`, `script.js`, nos `?v=` e no `CHANGELOG.md`; conferir em `/?versao` depois de publicar."
- [ ] **Passo 5:** rodar a suíte. Esperado: os 4 testes passam e os 50 anteriores continuam passando (54/54).
- [ ] **Passo 6:** commit "Add version markers to index, styles and script".

### Tarefa 2: barra de versão com `?versao`

**Arquivos:**
- Modificar: `index.html`, com um `<script>` inline logo depois de `<script src="script.js?v=2.0">`
- Testes: `tests/regressao.js`

**Interfaces:**
- Consome: os três marcadores da Tarefa 1.
- Produz: `#versao-barra` com `role="status"` e `data-estado="ok" | "incompleto"`; três itens `[data-arquivo="pagina" | "estilos" | "scripts"]`; botão `#versao-fechar` (`aria-label="Fechar barra de versão"`).

**Comportamento:**
- Roda no evento `load` da janela, e só se `new URLSearchParams(location.search).has("versao")`.
- Versão de referência: a do `meta`. Estilos: `getComputedStyle(document.documentElement).getPropertyValue("--grscan-versao")`, sem espaços e sem aspas. Scripts: `window.GRSCAN_VERSAO`.
- Item sem valor: `não carregado ✗`. Valor diferente: `<valor> ✗`. Se algum item falhar, a barra fica vermelha e a primeira linha termina com `— deploy incompleto`.
- Primeira linha: `Versão 2.0 · publicada em 10/11/2026 · "Linha de Precisão"`.
- Estilos inline no elemento: `position: fixed; inset: 0 0 auto 0; z-index: 2147483000`; fonte do sistema. A barra quebra linha em vez de gerar rolagem horizontal.

- [ ] **Passo 1:** escrever os testes (desktop 1280×800, salvo indicação):
  ```js
  ok("versão: sem ?versao não há barra", await p.locator("#versao-barra").count() === 0);
  ok("versão: com ?versao mostra 2.0 ok", estado === "ok" && texto.includes("Versão 2.0") && texto.includes("10/11/2026"));
  ok("versão: ?versao=1&x=y também abre", count === 1);
  ok("versão: CSS de outra versão → incompleto", estado === "incompleto" && estilos.includes("1.9 ✗"));      // route styles.css trocando o valor por "1.9"
  ok("versão: script.js 404 → incompleto", estado === "incompleto" && scripts.includes("não carregado ✗")); // route script.js → 404
  ok("versão: aspas e espaços normalizados", estado === "ok");                                              // route styles.css trocando por ` '2.0' `
  ok("versão: /?versao#agendar abre o agendamento", await p.evaluate(() => document.getElementById("bk-modal").open));
  ok("versão: 320px com barra sem rolagem horizontal", scrollWidth <= innerWidth);
  ok("versão: fechar remove a barra", (await p.locator("#versao-barra").count()) === 0);
  ok("versão: barra sem erros de JS", p.errors.length === 0, p.errors.join(" | "));                     // exceto no caso do 404 forçado
  ```
- [ ] **Passo 2:** rodar a suíte. Esperado: FAIL nos testes da barra, exceto "sem ?versao não há barra".
- [ ] **Passo 3:** escrever o script inline com o comportamento acima.
- [ ] **Passo 4:** rodar a suíte. Esperado: todos passam (64/64).
- [ ] **Passo 5:** rodar axe-core em `/?versao` e confirmar que não há violações. Tirar capturas de tela (desktop e 320 px, estados ok e incompleto) para mostrar ao dono do site.
- [ ] **Passo 6:** commit "Show deploy version bar on ?versao".

### Tarefa 3: entrega

**Arquivos:** `README.md` (uma seção curta "Conferir a versão publicada") e `entregas/public_html_grscan_v2.zip`, que não vai para o repositório.

- [ ] **Passo 1:** no `README.md`, explicar como abrir `/?versao` e o que significam o estado verde e o vermelho.
- [ ] **Passo 2:** gerar `entregas/public_html_grscan_v2.zip` com a v2.0 completa. Ficam de fora: `.git`, `.agents`, `.claude`, `CLAUDE.md`, `skills-lock.json`, `docs`, `tests`, `entregas`, `.mcp.json` e `.hostinger`. Listar o conteúdo do zip e conferir que não há nada desses itens.
- [ ] **Passo 3:** rodar a suíte inteira. Esperado: 64/64.
- [ ] **Passo 4:** commit "Document how to check the deployed version" e push para `claude/modest-goldberg-izmyjz`, o que atualiza o PR #1.
