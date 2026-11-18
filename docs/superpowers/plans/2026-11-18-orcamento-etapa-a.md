# Orçamento automático e painel — Etapa A · plano de implementação

> **Execução:** o próprio Claude executa nesta sessão (regra do `CLAUDE.md`), um commit por tarefa, testando cada uma. Passos com `- [ ]`.

**Objetivo:** substituir o "Solicitar orçamento" por um orçamento com preços e cálculo automático, gravado no servidor, e criar o painel `/admin/` com login de dois fatores, editor de preços versionado e lista de orçamentos.

**Arquitetura:**
- PHP puro com SQLite (PDO), num arquivo fora do `public_html`. O código compartilhado fica em `app/`, bloqueado ao acesso direto.
- A tabela de preços é um JSON versionado, guardado no banco. O público lê só uma lista fechada de campos comerciais.
- As regras de cálculo existem em PHP e em JS e passam pelos mesmos casos de teste. O servidor recalcula tudo antes de gravar.

**Tecnologia:** PHP 8 (PDO SQLite, `password_hash`, sessões), JS puro, Playwright, `php -S` local.

**Desenho:** `docs/superpowers/specs/2026-11-18-orcamento-e-gestao-design.md`

## Restrições globais
- **Dinheiro:** sempre em centavos, como inteiro. Exibição em `R$ 1.234,56` (`pt-BR`).
- **Pasta de dados:** padrão `dirname(<raiz do site>) . '/grscan-dados'`, que pode ser trocada pela variável de ambiente `GRSCAN_DADOS` (usada nos testes). O PHP cria a pasta e o banco no primeiro uso.
- **Nada interno no público.** Nenhum arquivo servido ao público contém custo, margem, fornecedor ou dado de administrador. `precos-publicos.php` responde só com os campos listados na Tarefa 2.
- **Funcionalidades atuais:** agendamento, odontograma, mapa, 3D, barra de versão e links `#agendar` e `#orcamento` continuam funcionando. A regressão atual passa, com os testes do formulário antigo trocados pelos do novo orçamento.
- **Identidade:** preto e dourado, Montserrat, cantos do logotipo, sem caixa alta.
- **Textos fixos do orçamento:**
  - "Valores sujeitos à confirmação da disponibilidade, da compatibilidade dos componentes e da viabilidade técnica."
  - "Total definitivo depende de confirmação da GR Scan."
- **Segurança do painel:**
  - Cookie de sessão com `Secure` (em HTTPS), `HttpOnly` e `SameSite=Strict`; ID trocado ao entrar; expiração após 30 min sem uso.
  - CSRF em todo POST; 5 erros de login em 15 min bloqueiam por 15 min, por e-mail e por IP.
  - TOTP obrigatório (RFC 6238, 30 s, 6 dígitos, janela ±1).
- **Versão:** a entrega final sobe o site para a versão 2.1 (regra do `CLAUDE.md`).

## Pontos de atenção (cada um com teste na tarefa dona)
1. **Clique duplo em "Enviar" grava dois orçamentos.** Esperado: o botão fica desabilitado durante o envio e o servidor recusa um envio idêntico em menos de 60 s. Teste na Tarefa 3.
2. **O painel muda um preço com o modal aberto.** Esperado: o servidor grava o valor da tabela vigente, a resposta traz o total gravado e a tela de confirmação mostra esse total. Teste na Tarefa 4.
3. **Paciente com implante e componentes trocado para procedimento sem implante.** Esperado: transfers e TiBases daquele paciente voltam a 0 e saem do total. Teste na Tarefa 4.
4. **Falha ao carregar os preços** (rede ou erro no servidor). Esperado: o modal mostra "Não foi possível carregar a tabela de preços" com a opção de falar com a GR Scan, e nunca exibe valores inventados. Teste na Tarefa 4.
5. **Acesso direto a `app/`, à pasta de dados ou a `*.sqlite` pela web.** Esperado: 403 ou 404 no Apache. Teste na Tarefa 8.

---

### Tarefa 1: base de dados, tabela padrão e regras de cálculo (PHP + JS)

**Arquivos:**
- Criar:
  - `app/.htaccess` (`Require all denied`)
  - `app/base.php` (pastas, PDO, migração)
  - `app/precos.php` (tabela padrão, vigente, salvar)
  - `app/calculo.php`
  - `assets/orcamento-calculo.js`
- Testes:
  - `tests/php/executar.php` (executor simples: `afirmar($cond, $nome)`; termina com código 1 se algo falhar)
  - `tests/php/calculo.test.php`
  - `tests/orcamento-casos.json`
  - `tests/orcamento-calculo.node.js`

**Interfaces (produz):**
- `pasta_dados(): string` · `db(): PDO`, que cria as tabelas na primeira chamada:
  - `precos_versoes(id, json, criado_em, admin_id NULL, nota)`
  - `admins(id, email UNIQUE, nome, senha_hash, totp_segredo, totp_ativo, ativo, criado_em)`
  - `auditoria(id, admin_id, acao, detalhe_json, ip, criado_em)`
  - `orcamentos(id, numero UNIQUE, criado_em, dados_json, pedido_json, calculo_json, precos_versao_id, total_centavos, pendente, status, assinatura, ip)`
  - `tentativas_login(id, chave, criado_em)`
- `precos_padrao(): array` · `precos_vigentes(): array` (a mais recente; se não houver nenhuma, grava a padrão) · `precos_versao_vigente(): int` · `precos_salvar(array $cfg, ?int $adminId, string $nota): int` (valida antes)
- `orcamento_calcular(array $cfg, array $pedido): array` → `{itens:[{paciente, tipo:'escaneamento'|'transfer'|'tibase'|'deslocamento', id, descricao, qtd, unitario, total, preco_base, desconto, sob_avaliacao}], faixa:{min, preco}|null, deslocamento:int|null, subtotal:int, total:int|null, pendente:bool, erros:string[]}`
- JS: `window.GRSCAN_CALC.calcular(cfg, pedido)`, com a mesma saída. Também `formatarBRL(centavos)`.

**Formato da tabela** (valores da especificação, em centavos):
```json
{"procedimentos":[{"id":"orto","nome":"Ortodontia / alinhadores","preco":18000,"desconto_volume":true,"disponivel":true,"sob_avaliacao":false},
  …placas, coroas, inlay, facetas, fixa, removivel (18000, desconto_volume:true)…,
  {"id":"total","nome":"Prótese total / arcada edêntula","preco":21000,"desconto_volume":false,…},
  {"id":"implante_unitario","nome":"Implante unitário","preco":19000,"implantes":{"min":1,"max":1},…},
  {"id":"implantes_multiplos","nome":"Múltiplos implantes (2 a 4)","preco":22000,"implantes":{"min":2,"max":4},…},
  {"id":"protocolo","nome":"Protocolo total sobre implantes","preco":null,"sob_avaliacao":true,"implantes":{"min":1,"max":null},…},
  {"id":"reescaneamento","nome":"Reescaneamento por alteração clínica","preco":9000,"desconto_volume":false,…}],
 "componentes":[{"id":"transfer","nome":"Transfer digital / scanbody","preco":2500,"disponivel":true,"sob_avaliacao":false},
  {"id":"tibase","nome":"TiBase padrão elegível","preco":8000,"disponivel":true,"sob_avaliacao":false}],
 "regioes":[{"id":"barra","nome":"Barra da Tijuca","taxa":0},{"id":"jacarepagua","nome":"Jacarepaguá","taxa":3000},…,
  {"id":"niteroi","nome":"Niterói","taxa":9000},{"id":"outras","nome":"Outras localidades","taxa":null,"sob_consulta":true}],
 "faixas_desconto":[{"min":1,"preco":18000},{"min":2,"preco":17000},{"min":5,"preco":16000}],
 "limite_pacientes":30}
```

**Pedido:** `{regiao:"niteroi", pacientes:[{procedimento:"implante", implantes:1, transfers:1, tibases:1}, {procedimento:"orto"}]}`.
- `"implante"` é a escolha pública: o procedimento é resolvido pela faixa `implantes` (1 → unitário; 2 a 4 → múltiplos; acima de 4 → sob avaliação).

**Regras (do desenho, §5):**
- A faixa de desconto vem do total de pacientes do pedido e vale só para os procedimentos com `desconto_volume`.
- O deslocamento entra uma vez.
- Componentes só em procedimentos com implante, de 0 até o número de implantes.
- Item sob avaliação: `pendente: true`, `total: null`, `subtotal` = soma dos itens com preço.
- Um pedido inválido devolve `erros`, sem lançar exceção.

- [ ] **Passo 1:** escrever `tests/orcamento-casos.json`, com no mínimo estes casos, cada um com `entrada` e `esperado`:
  - Niterói, implante 1 + 1 transfer + 1 TiBase → itens 19000, 2500, 8000, 9000; `total` 38500.
  - Barra, 1 orto → 18000; deslocamento 0; total 18000.
  - Zona Sul, 3 pacientes (orto, facetas, implante 1) → 17000 + 17000 + 19000 + 5000 = 58000; o implante sem desconto.
  - Tijuca, 5 orto → 5 × 16000 + 6000 = 86000.
  - Outras localidades, 1 orto → `pendente`, `subtotal` 18000, `total` null.
  - Implante com 5 implantes → sob avaliação, pendente.
  - Protocolo → pendente.
  - Componentes sem implante → erro.
  - Transfers acima do número de implantes → erro.
  - 0 pacientes → erro.
  - 31 pacientes → erro.
  - Procedimento indisponível → erro.
  - Reescaneamento com 2 pacientes → 9000 sem desconto.
- [ ] **Passo 2:** `tests/php/calculo.test.php` (percorre os casos com `orcamento_calcular` e testa `precos_salvar` recusando preço negativo e id duplicado) e `tests/orcamento-calculo.node.js` (carrega o JS com `vm` e percorre os mesmos casos). Rodar os dois: FAIL.
- [ ] **Passo 3:** implementar `app/base.php`, `app/precos.php`, `app/calculo.php` e `assets/orcamento-calculo.js`.
- [ ] **Passo 4:** `GRSCAN_DADOS=<scratch> php tests/php/executar.php` e `node tests/orcamento-calculo.node.js`: todos PASS.
- [ ] **Passo 5:** commit "Add pricing table, database and quote calculation rules".

### Tarefa 2: endpoint público de preços

**Arquivos:** criar `precos-publicos.php`; testes em `tests/php/publico.test.php`.

**Interface:**
- `GET precos-publicos.php` → `{ok:true, versao:int, procedimentos:[{id, nome, preco, desconto_volume, sob_avaliacao, implantes}], componentes:[{id, nome, preco, sob_avaliacao}], regioes:[{id, nome, taxa, sob_consulta}], faixas_desconto, limite_pacientes}`.
- Itens com `disponivel:false` ficam fora. Os campos são copiados um a um de uma lista fechada, nunca o objeto inteiro.
- Cabeçalhos: `Cache-Control: no-store` e `X-Content-Type-Options: nosniff`.

- [ ] **Passo 1:** teste
  - Inserir na tabela vigente um campo `custo` e um procedimento `disponivel:false`.
  - Chamar o endpoint com `php-cgi` ou com servidor `php -S` de teste.
  - Verificar que `custo` não aparece em lugar nenhum da resposta e que o procedimento indisponível também não. FAIL.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** PASS.
- [ ] **Passo 4:** commit "Add public price endpoint with an explicit field allowlist".

### Tarefa 3: `orcamento.php` grava e envia o orçamento calculado no servidor

**Arquivos:** reescrever `orcamento.php`; criar `app/orcamentos.php`; mudar `email-template.php` só para acrescentar `em_itens(array $calc): string`, a tabela de itens do e-mail. Testes em `tests/php/orcamento.test.php`.

**Interfaces:**
- `orcamento_registrar(array $dados, array $pedido): array` → `{numero, total, subtotal, pendente, calculo}`.
  - Número `GRS-AAAA-NNNNN`, sequencial por ano.
  - Grava `precos_versao_id` e a tabela usada (dentro de `calculo_json`). Status `solicitado`.
- `POST orcamento.php` com JSON `{regiao, pacientes[], dentes, elementos, data_desejada (AAAA-MM-DD, opcional, não pode ser passada), obs, nome, clinica, cro, telefone, email, preferencia, aceite_privacidade:true, website}`.
  - Resposta: `{ok, numero, total, subtotal, pendente, message}`.
- **Validação:** a de hoje para nome, telefone e e-mail, mais `aceite_privacidade` obrigatório e os `erros` do cálculo (400).
- **Proteções:** o limite de 5 envios por IP a cada 10 min continua; um envio repetido (mesma `assinatura` = sha256 do pedido + e-mail) em menos de 60 s devolve o mesmo número, sem gravar de novo.
- **E-mail:** grava ANTES de enviar. Se o e-mail não estiver configurado ou falhar, a resposta continua `ok:true` com o número, e o painel mostra o orçamento. Os dois e-mails de hoje (para a GR Scan e a confirmação ao dentista) passam a levar o número e a tabela de itens. A planilha CSV sai: o registro passa a ser o banco.
- Variável de ambiente `GRSCAN_SEM_EMAIL=1` desliga o envio (testes).

- [ ] **Passo 1:** testes
  - Envio válido do caso Niterói → `ok`, número `GRS-2026-00001`, total 38500, linha no banco com a tabela copiada.
  - Mudar o preço depois: o orçamento gravado continua 38500.
  - Sem aceite → 400.
  - `website` preenchido → `ok`, nada gravado.
  - Envio idêntico em 60 s → mesmo número, 1 linha só.
  - Total enviado pelo navegador é ignorado.
  - Rodar: FAIL.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** PASS, e a regressão atual sem erros de PHP.
- [ ] **Passo 4:** commit "Record quotes server-side with a price snapshot".

### Tarefa 4: novo modal "Solicitar orçamento"

**Arquivos:** `index.html` (conteúdo de `#qt-modal`; o resto da página não muda; carrega `assets/orcamento-calculo.js?v=` antes do `script.js`), `script.js` (seção "Janela de orçamento"; a abertura e o fechamento pelos `data-open-quote` e `data-close-quote` atuais continuam), `styles.css` (componentes novos na camada `components`). Testes em `tests/regressao.js`.

**Estrutura** (ids para os testes):
- `#qt-regiao` (select).
- `#qt-pacientes`, com um `.qt-paciente` por paciente:
  - `select[name=procedimento]`, com uma opção "Implante(s)" de valor `implante` e o protocolo marcado "sob avaliação";
  - `input[name=implantes]`, `input[name=transfers]` e `input[name=tibases]`, visíveis só para implante;
  - botão `.qt-remover`.
- `#qt-add` (adicionar paciente).
- `#qt-resumo`: lista de itens e `#qt-desconto` (ex.: "Desconto clínica: 3 pacientes → R$ 170,00 por escaneamento elegível").
- `#qt-total`, fixo no rodapé do modal no celular; com pendência mostra "Subtotal: R$ … · total sob confirmação".
- `#qt-aviso` com os textos fixos.
- Odontograma, dentes e elementos atuais; `input[name=data_desejada]` (type date); obs.
- Dados de contato atuais (mesmos `name`); checkbox `name=aceite_privacidade` com o texto "Concordo com o uso destes dados para responder a este orçamento".
- `#qt-submit` ("Enviar orçamento para a GR Scan") e `#qt-whatsapp` ("Compartilhar no WhatsApp").
- `#qt-done` mostra `#qt-numero` e o total gravado.

**Comportamento:**
- Ao abrir o modal pela primeira vez: `fetch("precos-publicos.php")`.
  - Enquanto carrega: "Carregando a tabela de preços…".
  - Em caso de falha: a mensagem do ponto de atenção 4 e um botão para WhatsApp ou e-mail; os campos de preço ficam ocultos.
- Começa com 1 paciente.
- Qualquer mudança recalcula com `GRSCAN_CALC.calcular` e renderiza o resumo.
- Mudar o procedimento para um sem implante zera os componentes.
- Transfers e TiBases: `min=0`, `max=implantes`, ajustados ao mudar a quantidade de implantes.
- **WhatsApp:**
  - Texto com região, cada paciente e seus itens, deslocamento, total ou subtotal com aviso, e dados do dentista se preenchidos.
  - Abre `waLink()` quando `CONFIG.whatsapp` existe; senão `https://wa.me/?text=`.
- **Envio:** valida (região escolhida, ao menos 1 paciente, contato, aceite); botão desabilitado durante o envio; mostra o número e o total devolvidos pelo servidor.

- [ ] **Passo 1:** testes Playwright no lugar dos atuais do formulário de orçamento (`tests/regressao.js`, bloco "Modal de orçamento"):
  - Niterói + implante com 1 transfer e 1 TiBase → `#qt-total` contém "R$ 385,00".
  - 3 pacientes na Zona Sul → mostra o desconto de R$ 170,00 e não aplica no implante.
  - "Outras localidades" → "sob confirmação".
  - Trocar implante por orto zera os componentes (ponto de atenção 3).
  - Falha em `precos-publicos.php` (route 500) → mensagem do ponto de atenção 4, sem "R$".
  - Envio → payload com `regiao`, `pacientes` e `aceite_privacidade`; a confirmação mostra o número devolvido pelo mock.
  - Mock que devolve um total diferente → a confirmação mostra o total do servidor (ponto de atenção 2).
  - Botão WhatsApp → abre um popup com URL `wa.me` contendo "R$ 385,00".
  - 320 px: sem rolagem horizontal e com o total visível.
  - Odontograma ainda preenche os dentes.
  - `#orcamento` ainda abre o modal.
  - axe-core sem violações com o modal aberto.
  - Rodar: FAIL.
- [ ] **Passo 2:** implementar HTML, JS e CSS.
- [ ] **Passo 3:** a suíte inteira passa.
- [ ] **Passo 4:** capturas de tela do celular e do computador para o dono do site.
- [ ] **Passo 5:** commit "Replace the quote form with the automatic price quote".

### Tarefa 5: autenticação do painel (senha + TOTP, sessão, CSRF, bloqueio)

**Arquivos:**
- Criar:
  - `app/auth.php`
  - `app/totp.php`
  - `app/painel.php` (layout HTML do painel: `painel_inicio(string $titulo)`, `painel_fim()`, escape `h()`)
  - `admin/.htaccess` (`Header set X-Robots-Tag "noindex, nofollow"`, `Header set Cache-Control "no-store"`)
  - `admin/entrar.php`
  - `admin/sair.php`
  - `admin/instalar.php`
  - `admin/index.php`
  - `admin/painel.css`
- Modificar: `robots.txt` (`Disallow: /admin/`).
- Testes:
  - `tests/php/totp.test.php`
  - `tests/admin.js` (Playwright, com servidor e pasta de dados próprios)

**Interfaces:**
- `totp_codigo(string $segredoBase32, int $tempo): string` · `totp_verificar(string $segredo, string $codigo, int $tempo = null): bool` (janela ±1) · `totp_novo_segredo(): string` (20 bytes, Base32)
- `sessao_iniciar(): void` · `admin_atual(): ?array` · `exigir_admin(): array` (sem sessão: redireciona para `entrar.php`; numa requisição `fetch`: 401) · `csrf_token(): string` · `csrf_verificar(): void` (403 se falhar) · `login_bloqueado(string $email, string $ip): bool` · `login_registrar_falha(string $email, string $ip): void` · `auditar(int $adminId, string $acao, array $detalhe = []): void`

**Fluxo:**
- `instalar.php`:
  - Funciona só sem nenhum administrador.
  - Se faltar `<dados>/grscan-config.php`, cria esse arquivo com `chave_instalacao` aleatória e pede que o dono a copie pelo Gerenciador de Arquivos.
  - Com a chave certa: cria o administrador (nome, e-mail, senha de 12+ caracteres), mostra o segredo TOTP (texto e link `otpauth://`) e exige um código válido para ativar.
  - Depois disso, responde 404.
- `entrar.php`: e-mail + senha, depois o código TOTP; mensagens genéricas ("E-mail, senha ou código inválidos").

- [ ] **Passo 1:** testes
  - TOTP com os vetores da RFC 6238 (SHA1, segredo "12345678901234567890"; t=59 → 94287082, comparando os 6 últimos dígitos 287082).
  - Playwright:
    - instalação com chave errada → recusa;
    - instalação certa → administrador criado, `instalar.php` passa a dar 404;
    - login com senha errada 5 vezes → bloqueio;
    - login certo + TOTP calculado no teste → `admin/index.php`;
    - `admin/index.php` sem sessão → vai para `entrar.php`;
    - POST sem CSRF → 403;
    - cookie `HttpOnly` e `SameSite=Strict`;
    - `sair.php` encerra a sessão.
  - Rodar: FAIL.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** PASS.
- [ ] **Passo 4:** commit "Add admin authentication with TOTP, CSRF and lockout".

### Tarefa 6: editor de preços com versões e histórico

**Arquivos:** criar `admin/precos.php` e `admin/historico.php`; testes em `tests/admin.js`.

**Comportamento:**
- Formulário com todos os campos da tabela:
  - procedimentos: nome, preço (`180,00`), desconto por volume, disponível, sob avaliação, faixa de implantes;
  - componentes: os mesmos campos, mais "Adicionar componente especial";
  - regiões: nome, taxa ou sob consulta, adicionar e remover;
  - faixas de desconto;
  - limite de pacientes.
- Salvar converte os valores para centavos, valida com `precos_salvar` e grava uma versão com nota opcional e auditoria.
- O histórico lista as versões (data, administrador, nota) e o que mudou em relação à anterior (campo, de, para).

- [ ] **Passo 1:** testes
  - Mudar "Ortodontia" para 185,00 e salvar → `precos-publicos.php` devolve 18500 → o orçamento público mostra R$ 185,00.
  - O histórico mostra "Ortodontia · preço: R$ 180,00 → R$ 185,00" com o nome do administrador.
  - Preço negativo → erro, nenhuma versão nova.
  - Marcar TiBase como indisponível → some do orçamento público.
  - Rodar: FAIL.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** PASS.
- [ ] **Passo 4:** commit "Add versioned price editor and change history".

### Tarefa 7: orçamentos recebidos e administradores

**Arquivos:** criar `admin/orcamentos.php` (lista com filtro por período e busca por número ou clínica; detalhe com itens, totais, tabela usada, dados de contato e dentes) e `admin/administradores.php` (criar administrador com TOTP próprio no primeiro login, desativar, trocar a própria senha). Testes em `tests/admin.js`.

- [ ] **Passo 1:** testes
  - Orçamento enviado pelo site aparece na lista com número, clínica, total e status "solicitado".
  - O detalhe mostra a versão da tabela usada.
  - Administrador desativado não consegue entrar.
  - Uma página de detalhe com id inexistente → 404.
  - Rodar: FAIL.
- [ ] **Passo 2:** implementar.
- [ ] **Passo 3:** PASS.
- [ ] **Passo 4:** commit "Add received quotes list and admin user management".

### Tarefa 8: segurança final, versão 2.1 e documentação

**Arquivos:** `.htaccess` (negar `*.sqlite`, `*.db`, `*.php.bak`), `README.md` (seção "Painel administrativo: primeiro acesso" e "Backup dos dados"), marcadores 2.1 (`index.html`, `styles.css`, `script.js`, `?v=`, `CHANGELOG.md`), `tests/regressao.js` (o teste de versão já cobre os marcadores).

- [ ] **Passo 1:** testes no Apache local, configurado como na Hostinger:
  - `app/base.php`, `app/.htaccess`, `tests/` e um `teste.sqlite` na raiz → 403;
  - `admin/index.php` sem sessão → redireciona;
  - `precos-publicos.php` → 200, sem a palavra "custo".
- [ ] **Passo 2:** busca em todo arquivo público (HTML, JS, CSS e as respostas dos endpoints públicos) pelas palavras `custo`, `margem`, `fornecedor` e `senha_hash`: nenhuma ocorrência.
- [ ] **Passo 3:** subir para a versão 2.1 com o resumo "Orçamento automático e painel".
- [ ] **Passo 4:** suíte completa (regressão, PHP, Node e admin): tudo PASS. Capturas de tela do painel.
- [ ] **Passo 5:** commit "Release 2.1: automatic quote and admin panel"; push no branch da sessão. Publicar só com a sua autorização (PR para `claude/loving-volta-tf920j`).
