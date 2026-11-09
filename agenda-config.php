<?php
/* ============================================================
   GR Scan — configuração da integração com o Google Agenda
   ============================================================
   Passo a passo completo no README.md ("Conectar ao Google Agenda").
   Enquanto ARQUIVO_CHAVE não existir, o site usa os dias/horários fixos
   definidos em script.js (CONFIG.agenda) e envia os pedidos só por e-mail.
*/
return [
    // Caminho do arquivo .json da conta de serviço do Google (FORA da pasta public_html).
    // Ex.: '/home/u123456789/grscan-google.json'
    'ARQUIVO_CHAVE' => '/home/SEU_USUARIO/grscan-google.json',

    // ID da agenda onde você marca os horários DISPONÍVEIS.
    // Google Agenda > Configurações da agenda "GR Scan – Disponível" > Integrar agenda > ID da agenda
    'AGENDA_DISPONIVEL' => 'xxxxxxxx@group.calendar.google.com',

    // ID da agenda onde os agendamentos são criados e que bloqueia horários ocupados
    // (normalmente o seu Gmail, que é o ID da agenda principal).
    'AGENDA_COMPROMISSOS' => 'seu-email@gmail.com',

    // Outras agendas suas que também devem bloquear horários (opcional). Ex.: ['familia@group.calendar.google.com']
    'AGENDAS_EXTRAS_OCUPADO' => [],

    'FUSO'               => 'America/Sao_Paulo',
    'DURACAO_MIN'        => 60,  // duração reservada para cada escaneamento
    'INTERVALO_MIN'      => 60,  // de quanto em quanto tempo os horários começam (30 = 8:00, 8:30, 9:00…)
    'DESLOCAMENTO_MIN'   => 30,  // folga antes e depois de cada compromisso, para deslocamento
    'ANTECEDENCIA_HORAS' => 12,  // não oferece horários que começam antes disso
    'DIAS_NO_FUTURO'     => 45,  // até quantos dias à frente o site mostra

    // Horário usado quando você marca um dia inteiro como disponível (evento "dia inteiro").
    'DIA_INTEIRO_INICIO' => '08:00',
    'DIA_INTEIRO_FIM'    => '18:00',

    // Cor do evento criado no seu Google Agenda (1 a 11). 5 = amarelo/banana.
    'COR_EVENTO' => '5',
];
