<?php
/* ============================================================
   GR Scan — configuração da integração com o Google Agenda
   ============================================================
   Passo a passo completo no README.md ("Conectar ao Google Agenda").
   Enquanto ARQUIVO_CHAVE não existir, o site usa os dias/horários fixos
   definidos em script.js (CONFIG.agenda) e envia os pedidos só por e-mail.
*/
return [
    // Arquivo .json da conta de serviço do Google. Por padrão o site procura o arquivo
    // "grscan-google.json" na pasta ACIMA de public_html (que não é acessível pela internet).
    // Só mude se você guardou o arquivo em outro lugar.
    'ARQUIVO_CHAVE' => dirname(__DIR__) . '/grscan-google.json',

    // Como o site descobre os horários livres:
    //  'livre'  = todo horário VAZIO na sua agenda principal, dentro do EXPEDIENTE abaixo (padrão).
    //  'blocos' = só os blocos marcados como eventos na agenda AGENDA_DISPONIVEL.
    'MODO' => 'livre',

    // Expediente (usado no modo 'livre'). 1 = segunda … 6 = sábado, 7 = domingo.
    // Cada dia aceita um ou mais períodos. Para ter intervalo de almoço: [['08:00','12:00'], ['13:00','18:00']]
    // Dia que não aparece aqui = sem atendimento.
    'EXPEDIENTE' => [
        1 => [['08:00', '18:00']],
        2 => [['08:00', '18:00']],
        3 => [['08:00', '18:00']],
        4 => [['08:00', '18:00']],
        5 => [['08:00', '18:00']],
        6 => [['08:00', '13:00']],
    ],

    // Dias sem atendimento (feriados, férias). Formato 'AAAA-MM-DD'.
    // Dica: você também pode só criar um evento de dia inteiro na agenda principal para bloquear o dia.
    'DATAS_BLOQUEADAS' => ['2026-12-25', '2027-01-01'],

    // (modo 'blocos') ID da agenda onde você marca os horários DISPONÍVEIS.
    // Google Agenda > Configurações da agenda "GR Scan – Disponível" > Integrar agenda > ID da agenda
    'AGENDA_DISPONIVEL' => 'de2a2c3598689aea2746ebe0557aa6954c595c694956b667a839819a9668c7c2@group.calendar.google.com',

    // ID da agenda onde os agendamentos são criados e que bloqueia horários ocupados
    // (normalmente o seu Gmail, que é o ID da agenda principal).
    'AGENDA_COMPROMISSOS' => 'drgabrielchevalier@gmail.com',

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
