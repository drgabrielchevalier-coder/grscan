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
Basta enviar `index.html`, `styles.css`, `script.js` e a pasta `assets/` para qualquer hospedagem estática (Hostinger, GitHub Pages, Netlify etc.).

## Agendamento direto (formulário)
O formulário da seção "Agende seu escaneamento" pede trabalho, arcadas, local, data, horário e dados do dentista.

1. Em `script.js`, ajuste `agenda` (dias da semana, primeiro e último horário, intervalo, datas bloqueadas).
2. Em `agendar.php`, preencha `$DESTINO` (seu e-mail) e `$REMETENTE` (um e-mail do domínio, criado na Hostinger em E-mails).
3. Envie `agendar.php` e `.htaccess` junto com os outros arquivos.

Cada pedido chega por e-mail com um convite `.ics` (um clique adiciona ao Google Agenda), o dentista recebe uma confirmação
e uma cópia fica em `agendamentos-grscan.csv`, fora da pasta pública. Sem o PHP configurado, o pedido segue pelo WhatsApp.

## Conectar ao Google Agenda (horários automáticos)

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
1. Envie o arquivo `.json` para uma pasta **fora** de `public_html` (ex.: `/home/SEU_USUARIO/grscan-google.json`).
2. Em `agenda-config.php`, preencha `ARQUIVO_CHAVE`, `AGENDA_DISPONIVEL` e `AGENDA_COMPROMISSOS` e ajuste duração, intervalo e folga.
3. Envie `agenda-config.php`, `agenda-google.php`, `disponibilidade.php`, `agendar.php` e `.htaccess` junto com o site.
4. Teste abrindo `https://seu-site/disponibilidade.php`: deve aparecer `"ok":true` com os dias e horários.
