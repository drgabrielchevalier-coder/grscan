# Link de convite para o WhatsApp — plano

> Execução pelo próprio Claude nesta sessão, um commit por tarefa, testando cada uma.

**Desenho:** `docs/superpowers/specs/2026-11-18-convite-whatsapp-design.md`

## Pontos de atenção (com teste)
1. Região inválida ou com caracteres estranhos no link (`?r=<script>`) → ignorada; o orçamento abre sem região e sem erro.
2. Origem diferente de "convite" enviada ao servidor → gravada vazia.
3. Quem abre o convite e depois navega pelo site → a origem continua "convite" só naquela aba.
4. Navegador sem JavaScript → `/convite/` mostra um botão "Ver o valor para a minha clínica".

### Tarefa 1: região e origem no site, no servidor e no painel
- **`script.js`:**
  - ao carregar, lê `r` e `origem` da URL;
  - guarda a origem no `sessionStorage` (`grscan_origem`), protegido com try/catch;
  - limpa o endereço com `history.replaceState`, mantendo o `#orcamento`;
  - quando a tabela chega, preseleciona a região se o id existir;
  - envia `origem` com o orçamento.
- **`app/orcamentos.php`:** `origem` só aceita `''` ou `'convite'` e é gravada em `dados_json`.
- **Painel:**
  - selo "convite" na lista, no início e no detalhe;
  - filtro "Origem" na lista (`?origem=convite`).
- **Testes:**
  - regressão: `/?r=niteroi&origem=convite#orcamento` → Niterói selecionado, URL limpa, envio com `origem: "convite"`; `?r=xyz` é ignorado;
  - PHP: uma origem qualquer é gravada vazia;
  - `admin.js`: orçamento vindo do convite aparece com o selo e no filtro.

### Tarefa 2: página `/convite/` e imagem da prévia
- **`convite/index.html`:**
  - metatags `og:title`, `og:description`, `og:url`, `og:image` (URL absoluta, 1200×630), `og:image:alt`, `twitter:card summary_large_image`;
  - `meta robots noindex`;
  - script que valida `r` (`^[a-z_]{1,40}$`) e faz `location.replace("/?r=…&origem=convite#orcamento")`;
  - em `<noscript>`, o botão "Ver o valor para a minha clínica".
- **`assets/convite-og.png`:** gerada pelo `tests/gerar-og-convite.js` (Playwright, a partir de um HTML com o logotipo original, Montserrat, preto e dourado). Pasta `tests/` já bloqueada na web.
- **Testes de regressão:**
  - `/convite/` tem as metatags e a imagem responde 200 em PNG 1200×630;
  - `/convite/?r=niteroi` termina no orçamento aberto, com Niterói;
  - `/convite/?r=<script>` termina no orçamento sem região e sem erro de JS.

### Tarefa 3: entrega
- Versão 2.3 (marcadores e `CHANGELOG.md`).
- `README.md`: seção "Links de convite", com a tabela de links por região.
- Arquivo `entregas/prospeccao-whatsapp.md` (fora do Git): mensagens e links prontos para copiar.
- Suítes completas e PR para publicar com a sua autorização.
