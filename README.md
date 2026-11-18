# GR Scan — Landing page

Landing page estática (HTML/CSS/JS puro), visual escuro com dourado, para o serviço de escaneamento digital odontológico, com agendamento online via Google Agenda.

## Configuração
Edite o bloco `CONFIG` no início de `script.js`:

- `googleCalendarUrl`: link da sua *Agenda de agendamentos* do Google Agenda
  (Google Agenda → Criar → Agenda de agendamentos → Compartilhar → Incorporar no site → copie o `src` do iframe).
- `whatsapp`: número com DDI + DDD, só dígitos (ex.: `5511999999999`).
- `email` e `instagram`.
- `regiao`: região atendida, mostrada no texto (hoje: Rio de Janeiro e Região Metropolitana).
- `mapaLocais`: cidades/bairros marcados no mapa (nome, latitude, longitude e lado do rótulo). O mapa se ajusta para mostrar todos.
- `mapaRaioKm`: raio do círculo dourado em volta de cada local (0 = sem círculo).
- `horario`: horário de atendimento.

Itens não preenchidos ficam ocultos automaticamente.

## Publicar
Envie `index.html`, `styles.css`, `script.js`, `robots.txt`, `sitemap.xml`, `.htaccess`, os arquivos `.php` e a pasta `assets/`
(incluindo `assets/vendor/`, com o Leaflet e o decodificador Draco servidos pelo próprio site).
Cada deploy sobe a versão em 0,1 (2.0 → 2.1 → 2.2…) nos três arquivos, nos `?v=` e no `CHANGELOG.md`
(regra completa no `CLAUDE.md`); o `?v=` novo faz os navegadores baixarem os arquivos atualizados.

## Conferir a versão publicada
Abra `https://grscan.implantstore.com.br/?versao`. Aparece no topo uma barra (só para quem usar esse endereço):
- **Escura com ponto dourado:** `index.html`, `styles.css` e `script.js` estão na mesma versão — o deploy subiu inteiro.
- **Vermelha, "deploy incompleto":** algum arquivo está em outra versão (✗) ou não carregou. Envie de novo o arquivo marcado
  e recarregue a página (se continuar, limpe o cache do navegador ou da Hostinger).
O botão "fechar" tira a barra. Sem `?versao` no endereço, os visitantes não veem nada.

## Painel administrativo e orçamento automático
O orçamento do site usa a tabela de preços cadastrada no painel `/admin/`. Os dados ficam num banco
SQLite na pasta `grscan-dados/`, **ao lado** do `public_html` (nunca dentro), criada automaticamente.

**Primeiro acesso (uma vez só):**
1. Abra `https://grscan.implantstore.com.br/admin/instalar.php`.
2. No Gerenciador de Arquivos da Hostinger, abra `grscan-dados/grscan-config.php` (pasta acima de
   `public_html`) e copie a `chave_instalacao`.
3. Preencha a chave, seu nome, e-mail e uma senha de 12 caracteres ou mais.
4. Ative o aplicativo autenticador (Google Authenticator, Microsoft Authenticator…) com a chave mostrada
   e digite o código. Depois disso `instalar.php` deixa de existir (404).

**No dia a dia:** `/admin/` → Preços (cada gravação vira uma versão no Histórico e vale na hora no site),
Orçamentos (os recebidos pelo site, com número e tabela aplicada) e Administradores.

**Backup:** copie a pasta `grscan-dados/` inteira (o backup da Hostinger já inclui a conta toda).
Nunca coloque essa pasta nem arquivos `.sqlite` dentro do `public_html`.

## Links de convite (prospecção pelo WhatsApp)
Mande para o dentista o link da região da clínica dele. No WhatsApp aparece uma prévia própria (imagem
`assets/convite-og.jpg`, gerada por `node tests/gerar-og-convite.js`) e, ao tocar, abre o orçamento já com a
região escolhida. Os orçamentos que vierem daí aparecem no painel com o selo **convite** (filtro "Origem").

| Região da clínica | Link para a mensagem |
|---|---|
| Barra da Tijuca | `https://grscan.implantstore.com.br/convite/?r=barra` |
| Jacarepaguá | `https://grscan.implantstore.com.br/convite/?r=jacarepagua` |
| Recreio dos Bandeirantes | `https://grscan.implantstore.com.br/convite/?r=recreio` |
| Zona Sul | `https://grscan.implantstore.com.br/convite/?r=zona_sul` |
| Tijuca | `https://grscan.implantstore.com.br/convite/?r=tijuca` |
| Centro do Rio | `https://grscan.implantstore.com.br/convite/?r=centro` |
| Duque de Caxias | `https://grscan.implantstore.com.br/convite/?r=duque_de_caxias` |
| Nova Iguaçu | `https://grscan.implantstore.com.br/convite/?r=nova_iguacu` |
| Niterói | `https://grscan.implantstore.com.br/convite/?r=niteroi` |
| Outras localidades | `https://grscan.implantstore.com.br/convite/` (sem região) |

Se uma região mudar de identificador no painel, o link antigo continua abrindo o orçamento, só que sem a região escolhida.

## Testes de regressão
Com o site rodando localmente (`GRSCAN_DADOS=/tmp/grscan-dados GRSCAN_SEM_EMAIL=1 php -S 127.0.0.1:8090`), execute
`node tests/regressao.js http://127.0.0.1:8090`. Também: `php tests/php/executar.php` (regras, banco e TOTP),
`node tests/orcamento-calculo.node.js` (cálculo no navegador) e `node tests/admin.js` (painel, sobe o próprio servidor).
O teste usa o Playwright, intercepta os PHP (nenhum e-mail é enviado) e verifica agendamento, orçamento, odontograma,
mapa, modelos 3D, links diretos e responsividade. Histórico de mudanças em `CHANGELOG.md`.

## Agendamento direto (formulário)
O formulário da seção "Agende seu escaneamento" pede trabalho, arcadas, local, data, horário e dados do dentista.

1. Em `script.js`, ajuste `agenda` (dias da semana, primeiro e último horário, intervalo, datas bloqueadas).
2. Em `agendar.php`, preencha `$DESTINO` (seu e-mail) e `$REMETENTE` (um e-mail do domínio, criado na Hostinger em E-mails).
3. Envie `agendar.php` e `.htaccess` junto com os outros arquivos.

Cada pedido chega por e-mail com um convite `.ics` (um clique adiciona ao Google Agenda), o dentista recebe uma confirmação
e uma cópia fica em `agendamentos-grscan.csv`, fora da pasta pública. Sem o PHP configurado, o pedido segue pelo WhatsApp.

## Página de reservas do Google Agenda (em uso)

O botão "Agendar escaneamento" abre a **página de reservas do Google Agenda** dentro do site
(`googleAgendamentoUrl` em `script.js`). Disponibilidade, duração, intervalo e perguntas do formulário
são configurados no próprio Google Agenda, na agenda de agendamentos "GR Scan".
Para voltar ao formulário próprio do site, deixe `googleAgendamentoUrl: ""`.

## Alternativa: formulário próprio conectado ao Google Agenda (avançado)

Com isso você marca os horários livres no Google Agenda e o site mostra e reserva sozinho.

**Como funciona**
- Uma agenda separada, por exemplo **"GR Scan – Disponível"**, guarda os **blocos em que você atende** (ex.: seg a sex, 8h–12h e 14h–18h; pode usar eventos repetidos ou de dia inteiro).
- A sua **agenda principal** guarda os compromissos. Qualquer evento nela **bloqueia** o horário (com folga de deslocamento).
- Quando um dentista agenda pelo site, o evento é **criado na agenda principal** com todos os dados e o horário some do site.

**1. Google Cloud (uma vez só, ~10 min)**
1. Acesse console.cloud.google.com e crie um projeto (ex.: "GR Scan Site").
2. Em **APIs e serviços → Biblioteca**, ative a **Google Calendar API**.
3. Em **APIs e serviços → Credenciais → Criar credenciais → Conta de serviço**, dê um nome (ex.: "site-agenda") e conclua.
4. Abra a conta de serviço → aba **Chaves → Adicionar chave → JSON**. Um arquivo `.json` será baixado. Guarde com cuidado: ele é a senha do site para a sua agenda.
5. Copie o e-mail da conta de serviço (termina em `@...iam.gserviceaccount.com`).

**2. Google Agenda**
1. Crie uma agenda nova: **Outras agendas → + → Criar nova agenda** → "GR Scan – Disponível".
2. Nas configurações de **cada uma das duas agendas** (a "Disponível" e a principal), em **Compartilhar com pessoas específicas**,
   adicione o e-mail da conta de serviço com a permissão **"Fazer alterações nos eventos"**.
3. Na agenda "Disponível", em **Integrar agenda**, copie o **ID da agenda** (`...@group.calendar.google.com`).
   O ID da agenda principal é o seu Gmail.
4. Crie na agenda "Disponível" os blocos em que você atende.

**3. Hospedagem**
1. Renomeie o arquivo `.json` para `grscan-google.json` e envie para a pasta **acima** de `public_html` (a pasta do domínio, que não é pública).
2. Em `agenda-config.php`, preencha `AGENDA_DISPONIVEL` e `AGENDA_COMPROMISSOS` e ajuste duração, intervalo e folga.
3. Envie `agenda-config.php`, `agenda-google.php`, `disponibilidade.php`, `agendar.php` e `.htaccess` junto com o site.
4. Teste abrindo `https://seu-site/disponibilidade.php`: deve aparecer `"ok":true` com os dias e horários.

## Deslocamento automático
O dentista informa o endereço da clínica (passo 2). O site localiza o endereço (OpenStreetMap), calcula a rota de carro
a partir de `ORIGEM` (Xerém) e só oferece horários em que cabem a ida antes e a volta depois.
Ex.: agenda livre a partir das 14:00 e 40 min de viagem → primeiro horário 14:40.
Ao reservar, são criados 3 eventos: "🚗 Deslocamento (ida)", "Escaneamento" e "🚗 Deslocamento (volta)".
Ajustes em `agenda-config.php`: `ORIGEM`, `FATOR_TRANSITO` (+30% por padrão, pois a rota gratuita não considera trânsito),
`MARGEM_DESLOCAMENTO_MIN`, `DESLOCAMENTO_PADRAO_MIN` e, opcionalmente, `GOOGLE_MAPS_API_KEY` (Routes API, com trânsito real).

## Solicitar orçamento
O botão "Solicitar orçamento" abre um formulário próprio (tipo de trabalho, dentes no odontograma FDI, arcadas,
nº de pacientes, prazo, frequência, laboratório, formato, local, observações e contato).
O pedido é enviado por `orcamento.php` para o e-mail definido em `email-config.php` (o mesmo usado pelo agendamento),
com cópia de confirmação para o dentista e registro em `orcamentos-grscan.csv` fora da pasta pública.
