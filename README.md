# GR Scan — Landing page

Landing page estática (HTML/CSS/JS puro), visual escuro com dourado, para o serviço de escaneamento digital odontológico, com agendamento online via Google Agenda.

## Configuração
Edite o bloco `CONFIG` no início de `script.js`:

- `googleCalendarUrl`: link da sua *Agenda de agendamentos* do Google Agenda
  (Google Agenda → Criar → Agenda de agendamentos → Compartilhar → Incorporar no site → copie o `src` do iframe).
- `whatsapp`: número com DDI + DDD, só dígitos (ex.: `5511999999999`).
- `email` e `instagram`.
- `regiao`: cidade/região atendida (mostra no texto e no mapa). Ex.: `Recife e Região Metropolitana`.
- `horario`: horário de atendimento.

Itens não preenchidos ficam ocultos automaticamente.

## Publicar
Basta enviar `index.html`, `styles.css`, `script.js` e a pasta `assets/` para qualquer hospedagem estática (Hostinger, GitHub Pages, Netlify etc.).
