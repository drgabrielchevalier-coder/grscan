<?php
/* GR Scan — funções de acesso ao Google Agenda (conta de serviço, sem bibliotecas externas). */

function ag_config() {
    static $c = null;
    if ($c === null) $c = require __DIR__ . '/agenda-config.php';
    return $c;
}

/** A integração está configurada (arquivo de chave presente e IDs preenchidos)? */
function ag_ativa() {
    $c = ag_config();
    return is_readable($c['ARQUIVO_CHAVE'])
        && strpos($c['AGENDA_DISPONIVEL'], 'xxxxxxxx') === false
        && strpos($c['AGENDA_COMPROMISSOS'], 'seu-email') === false;
}

function ag_b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function ag_http($method, $url, $token = null, $body = null, $form = false) {
    // Só para testes locais: aponta as chamadas para um simulador da API (ignorado em produção).
    if ($base = getenv('GRSCAN_TEST_API')) $url = preg_replace('#^https://[a-z0-9.]+googleapis\.com#', rtrim($base, '/'), $url);
    $ch = curl_init($url);
    $h = [];
    if ($token) $h[] = 'Authorization: Bearer ' . $token;
    if ($body !== null) {
        if ($form) { $h[] = 'Content-Type: application/x-www-form-urlencoded'; $payload = http_build_query($body); }
        else { $h[] = 'Content-Type: application/json'; $payload = json_encode($body, JSON_UNESCAPED_UNICODE); }
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
    }
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $h, CURLOPT_TIMEOUT => 15,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $json = json_decode((string)$res, true);
    if ($code < 200 || $code >= 300) {
        $msg = $json['error']['message'] ?? $json['error_description'] ?? ('HTTP ' . $code);
        throw new RuntimeException('Google: ' . $msg);
    }
    return $json;
}

/** Token de acesso da conta de serviço (guardado em cache por ~55 min). */
function ag_token() {
    $c = ag_config();
    $cache = sys_get_temp_dir() . '/grscan_gtoken_' . md5($c['ARQUIVO_CHAVE']);
    if (is_file($cache)) {
        $t = json_decode((string)file_get_contents($cache), true);
        if ($t && $t['exp'] > time() + 60) return $t['token'];
    }
    $k = json_decode((string)file_get_contents($c['ARQUIVO_CHAVE']), true);
    if (!$k || empty($k['private_key']) || empty($k['client_email'])) throw new RuntimeException('Arquivo de chave do Google inválido.');
    $agora = time();
    $jwt = ag_b64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT'])) . '.' . ag_b64url(json_encode([
        'iss' => $k['client_email'], 'scope' => 'https://www.googleapis.com/auth/calendar',
        'aud' => 'https://oauth2.googleapis.com/token', 'iat' => $agora, 'exp' => $agora + 3600,
    ]));
    if (!openssl_sign($jwt, $sig, $k['private_key'], 'sha256WithRSAEncryption')) throw new RuntimeException('Falha ao assinar o token.');
    $jwt .= '.' . ag_b64url($sig);
    $r = ag_http('POST', 'https://oauth2.googleapis.com/token', null, [
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion' => $jwt,
    ], true);
    @file_put_contents($cache, json_encode(['token' => $r['access_token'], 'exp' => $agora + (int)$r['expires_in']]));
    @chmod($cache, 0600);
    return $r['access_token'];
}

/** Janelas de disponibilidade [inicio, fim] (DateTimeImmutable) marcadas na agenda "Disponível". */
function ag_janelas(DateTimeImmutable $de, DateTimeImmutable $ate) {
    $c = ag_config(); $tz = new DateTimeZone($c['FUSO']);
    $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($c['AGENDA_DISPONIVEL']) . '/events?' . http_build_query([
        'timeMin' => $de->format(DATE_RFC3339), 'timeMax' => $ate->format(DATE_RFC3339),
        'singleEvents' => 'true', 'orderBy' => 'startTime', 'maxResults' => 2500, 'timeZone' => $c['FUSO'],
    ]);
    $r = ag_http('GET', $url, ag_token());
    $out = [];
    foreach ($r['items'] ?? [] as $ev) {
        if (($ev['status'] ?? '') === 'cancelled') continue;
        if (isset($ev['start']['dateTime'])) {
            $out[] = [new DateTimeImmutable($ev['start']['dateTime']), new DateTimeImmutable($ev['end']['dateTime'])];
        } elseif (isset($ev['start']['date'])) {
            // evento de dia inteiro: usa o horário padrão em cada dia coberto
            $d = new DateTimeImmutable($ev['start']['date'], $tz);
            $fimDia = new DateTimeImmutable($ev['end']['date'], $tz);
            for (; $d < $fimDia; $d = $d->modify('+1 day')) {
                $out[] = [
                    new DateTimeImmutable($d->format('Y-m-d') . ' ' . $c['DIA_INTEIRO_INICIO'], $tz),
                    new DateTimeImmutable($d->format('Y-m-d') . ' ' . $c['DIA_INTEIRO_FIM'], $tz),
                ];
            }
        }
    }
    return $out;
}

/** Períodos ocupados [inicio, fim] nas agendas de compromissos (consulta livre/ocupado). */
function ag_ocupados(DateTimeImmutable $de, DateTimeImmutable $ate) {
    $c = ag_config();
    $ids = array_merge([$c['AGENDA_COMPROMISSOS']], $c['AGENDAS_EXTRAS_OCUPADO'] ?? []);
    $r = ag_http('POST', 'https://www.googleapis.com/calendar/v3/freeBusy', ag_token(), [
        'timeMin' => $de->format(DATE_RFC3339), 'timeMax' => $ate->format(DATE_RFC3339),
        'timeZone' => $c['FUSO'], 'items' => array_map(fn($id) => ['id' => $id], $ids),
    ]);
    $out = [];
    foreach ($r['calendars'] ?? [] as $id => $cal) {
        if (!empty($cal['errors'])) throw new RuntimeException('Sem acesso à agenda ' . $id . '. Compartilhe-a com a conta de serviço.');
        foreach ($cal['busy'] ?? [] as $b) $out[] = [new DateTimeImmutable($b['start']), new DateTimeImmutable($b['end'])];
    }
    return $out;
}

/**
 * Calcula os horários livres. Função pura (testável): recebe janelas e ocupados.
 * Retorna ['Y-m-d' => ['HH:MM', ...], ...]
 */
function ag_calcular_horarios(array $janelas, array $ocupados, DateTimeImmutable $agora, array $c) {
    $tz = new DateTimeZone($c['FUSO']);
    $dur = $c['DURACAO_MIN'] * 60; $passo = $c['INTERVALO_MIN'] * 60; $folga = $c['DESLOCAMENTO_MIN'] * 60;
    $minInicio = $agora->getTimestamp() + $c['ANTECEDENCIA_HORAS'] * 3600;
    $occ = array_map(fn($o) => [$o[0]->getTimestamp() - $folga, $o[1]->getTimestamp() + $folga], $ocupados);
    $dias = [];
    foreach ($janelas as [$ini, $fim]) {
        $a = $ini->getTimestamp(); $b = $fim->getTimestamp();
        for ($t = $a; $t + $dur <= $b; $t += $passo) {
            if ($t < $minInicio) continue;
            $livre = true;
            foreach ($occ as [$oa, $ob]) { if ($t < $ob && $t + $dur > $oa) { $livre = false; break; } }
            if (!$livre) continue;
            $dt = (new DateTimeImmutable('@' . $t))->setTimezone($tz);
            $dias[$dt->format('Y-m-d')][$dt->format('H:i')] = true;
        }
    }
    ksort($dias);
    foreach ($dias as $d => $hs) { $hs = array_keys($hs); sort($hs); $dias[$d] = $hs; }
    return $dias;
}

/** Horários livres consultando o Google Agenda. */
function ag_horarios_livres() {
    $c = ag_config(); $tz = new DateTimeZone($c['FUSO']);
    $agora = new DateTimeImmutable('now', $tz);
    $de = $agora->setTime(0, 0); $ate = $de->modify('+' . (int)$c['DIAS_NO_FUTURO'] . ' days');
    return ag_calcular_horarios(ag_janelas($de, $ate), ag_ocupados($de, $ate), $agora, $c);
}

/** Cria o evento do agendamento na agenda de compromissos. */
function ag_criar_evento(DateTimeImmutable $inicio, DateTimeImmutable $fim, $titulo, $local, $descricao) {
    $c = ag_config();
    $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($c['AGENDA_COMPROMISSOS']) . '/events';
    return ag_http('POST', $url, ag_token(), [
        'summary' => $titulo, 'location' => $local, 'description' => $descricao, 'colorId' => $c['COR_EVENTO'],
        'start' => ['dateTime' => $inicio->format(DATE_RFC3339), 'timeZone' => $c['FUSO']],
        'end'   => ['dateTime' => $fim->format(DATE_RFC3339), 'timeZone' => $c['FUSO']],
        'reminders' => ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => 120]]],
    ]);
}
