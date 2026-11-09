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
