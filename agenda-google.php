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
        && (ag_modo() === 'livre' || strpos($c['AGENDA_DISPONIVEL'], 'xxxxxxxx') === false)
        && strpos($c['AGENDA_COMPROMISSOS'], 'seu-email') === false;
}

function ag_modo() { return (ag_config()['MODO'] ?? 'livre') === 'blocos' ? 'blocos' : 'livre'; }

/** Janelas do expediente padrão (modo 'livre'), dia a dia. */
function ag_janelas_expediente(DateTimeImmutable $de, DateTimeImmutable $ate, array $c) {
    $tz = new DateTimeZone($c['FUSO']); $out = [];
    $bloq = $c['DATAS_BLOQUEADAS'] ?? [];
    for ($d = $de->setTimezone($tz)->setTime(0, 0); $d < $ate; $d = $d->modify('+1 day')) {
        $ymd = $d->format('Y-m-d');
        if (in_array($ymd, $bloq, true)) continue;
        foreach ($c['EXPEDIENTE'][(int)$d->format('N')] ?? [] as [$i, $f]) {
            $out[] = [new DateTimeImmutable("$ymd $i", $tz), new DateTimeImmutable("$ymd $f", $tz)];
        }
    }
    return $out;
}

function ag_b64url($s) { return rtrim(strtr(base64_encode($s), '+/', '-_'), '='); }

function ag_http($method, $url, $token = null, $body = null, $form = false, $extraHeaders = []) {
    // Só para testes locais: aponta as chamadas para um simulador da API (ignorado em produção).
    if ($base = getenv('GRSCAN_TEST_API')) $url = preg_replace('#^https://[a-z0-9.]+(googleapis\.com|openstreetmap\.org|project-osrm\.org)#', rtrim($base, '/'), $url);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_USERAGENT, 'GRScan-agenda/1.0 (+https://grscan.implantstore.com.br)');
    $h = $extraHeaders;
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
 * Sem $deslocMin: usa a folga fixa DESLOCAMENTO_MIN antes/depois de cada compromisso.
 * Com $deslocMin (minutos de viagem até o local do atendimento): o horário só aparece se couber
 * a ida antes e a volta depois, sem encostar em nenhum compromisso. Ex.: livre a partir das 14:00
 * e 40 min de viagem => primeiro horário 14:40.
 * Retorna ['Y-m-d' => ['HH:MM', ...], ...]
 */
function ag_calcular_horarios(array $janelas, array $ocupados, DateTimeImmutable $agora, array $c, $deslocMin = null) {
    $tz = new DateTimeZone($c['FUSO']);
    $dur = $c['DURACAO_MIN'] * 60; $passo = $c['INTERVALO_MIN'] * 60;
    $minInicio = $agora->getTimestamp() + $c['ANTECEDENCIA_HORAS'] * 3600;
    $dias = [];
    $add = function ($t) use (&$dias, $tz) {
        $dt = (new DateTimeImmutable('@' . $t))->setTimezone($tz);
        $dias[$dt->format('Y-m-d')][$dt->format('H:i')] = true;
    };

    if ($deslocMin !== null) {
        $T = (int)$deslocMin * 60;
        $occ = array_map(fn($o) => [$o[0]->getTimestamp(), $o[1]->getTimestamp()], $ocupados);
        usort($occ, fn($x, $y) => $x[0] <=> $y[0]);
        foreach ($janelas as [$ini, $fim]) {
            // intervalos livres dentro da janela
            $livres = []; $cur = $ini->getTimestamp(); $b = $fim->getTimestamp();
            foreach ($occ as [$oa, $ob]) {
                if ($ob <= $cur || $oa >= $b) continue;
                if ($oa > $cur) $livres[] = [$cur, $oa];
                $cur = max($cur, $ob);
            }
            if ($cur < $b) $livres[] = [$cur, $b];
            foreach ($livres as [$g0, $g1]) {
                $t = (int)(ceil(($g0 + $T) / 300) * 300); // chegada, arredondada para 5 min
                for (; $t + $dur + $T <= $g1; $t += $passo) {
                    if ($t >= $minInicio) $add($t);
                }
            }
        }
    } else {
        $folga = $c['DESLOCAMENTO_MIN'] * 60;
        $occ = array_map(fn($o) => [$o[0]->getTimestamp() - $folga, $o[1]->getTimestamp() + $folga], $ocupados);
        foreach ($janelas as [$ini, $fim]) {
            $a = $ini->getTimestamp(); $b = $fim->getTimestamp();
            for ($t = $a; $t + $dur <= $b; $t += $passo) {
                if ($t < $minInicio) continue;
                $livre = true;
                foreach ($occ as [$oa, $ob]) { if ($t < $ob && $t + $dur > $oa) { $livre = false; break; } }
                if ($livre) $add($t);
            }
        }
    }
    ksort($dias);
    foreach ($dias as $d => $hs) { $hs = array_keys($hs); sort($hs); $dias[$d] = $hs; }
    return $dias;
}

/** Horários livres consultando o Google Agenda. $deslocMin = minutos de viagem até o local (ou null). */
function ag_horarios_livres($deslocMin = null) {
    $c = ag_config(); $tz = new DateTimeZone($c['FUSO']);
    $agora = new DateTimeImmutable('now', $tz);
    $de = $agora->setTime(0, 0); $ate = $de->modify('+' . (int)$c['DIAS_NO_FUTURO'] . ' days');
    $janelas = ag_modo() === 'blocos' ? ag_janelas($de, $ate) : ag_janelas_expediente($de, $ate, $c);
    return ag_calcular_horarios($janelas, ag_ocupados($de, $ate), $agora, $c, $deslocMin);
}

/* ---------------- Deslocamento (a partir da ORIGEM) ---------------- */

function ag_cache_get($chave, $validadeSeg) {
    $f = sys_get_temp_dir() . '/grscan_' . md5($chave);
    if (is_file($f) && filemtime($f) > time() - $validadeSeg) return json_decode((string)file_get_contents($f), true);
    return null;
}
function ag_cache_set($chave, $valor) { @file_put_contents(sys_get_temp_dir() . '/grscan_' . md5($chave), json_encode($valor)); }

/** Localiza um endereço (OpenStreetMap/Nominatim). Retorna ['lat','lng','nome','aproximado'] ou null. */
function ag_geocodificar($endereco, $cidade) {
    $chave = 'geo|' . mb_strtolower(trim($endereco) . '|' . trim($cidade));
    if ($r = ag_cache_get($chave, 30 * 86400)) return $r ?: null;
    $tentativas = [[trim("$endereco, $cidade, RJ, Brasil"), false], [trim("$cidade, RJ, Brasil"), true]];
    foreach ($tentativas as [$q, $aprox]) {
        if ($q === '' || $q === ', RJ, Brasil') continue;
        $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
            'format' => 'jsonv2', 'limit' => 1, 'countrycodes' => 'br', 'accept-language' => 'pt-BR', 'q' => $q,
        ]);
        try { $res = ag_http('GET', $url); } catch (Throwable $e) { $res = []; }
        if (!empty($res[0]['lat'])) {
            $r = ['lat' => (float)$res[0]['lat'], 'lng' => (float)$res[0]['lon'], 'nome' => $res[0]['display_name'] ?? $q, 'aproximado' => $aprox];
            ag_cache_set($chave, $r);
            return $r;
        }
        usleep(1100000); // política do Nominatim: no máximo 1 consulta por segundo
    }
    return null;
}

/** Tempo de viagem de carro (minutos, sem trânsito) e distância (km) entre dois pontos. */
function ag_rota($o, $d) {
    $c = ag_config();
    $chave = 'rota|' . round($o['lat'], 4) . ',' . round($o['lng'], 4) . '|' . round($d['lat'], 4) . ',' . round($d['lng'], 4);
    if ($r = ag_cache_get($chave, 30 * 86400)) return $r;
    if (!empty($c['GOOGLE_MAPS_API_KEY'])) {
        // Google Routes API (considera o trânsito típico)
        $res = ag_http('POST', 'https://routes.googleapis.com/directions/v2:computeRoutes', null, [
            'origin' => ['location' => ['latLng' => ['latitude' => $o['lat'], 'longitude' => $o['lng']]]],
            'destination' => ['location' => ['latLng' => ['latitude' => $d['lat'], 'longitude' => $d['lng']]]],
            'travelMode' => 'DRIVE', 'routingPreference' => 'TRAFFIC_AWARE',
        ], false, ['X-Goog-Api-Key: ' . $c['GOOGLE_MAPS_API_KEY'], 'X-Goog-FieldMask: routes.duration,routes.distanceMeters']);
        $r = ['min' => (int)ceil(((int)rtrim($res['routes'][0]['duration'] ?? '0s', 's')) / 60), 'km' => round(($res['routes'][0]['distanceMeters'] ?? 0) / 1000), 'fonte' => 'google'];
    } else {
        // OSRM (OpenStreetMap), gratuito, sem trânsito
        $res = ag_http('GET', "https://router.project-osrm.org/route/v1/driving/{$o['lng']},{$o['lat']};{$d['lng']},{$d['lat']}?overview=false");
        if (($res['code'] ?? '') !== 'Ok') throw new RuntimeException('Rota não encontrada.');
        $r = ['min' => (int)ceil($res['routes'][0]['duration'] / 60), 'km' => round($res['routes'][0]['distance'] / 1000), 'fonte' => 'osm'];
    }
    ag_cache_set($chave, $r);
    return $r;
}

/**
 * Deslocamento estimado da ORIGEM até o endereço do atendimento, já com fator de trânsito e margem,
 * arredondado para 5 min. Se não conseguir calcular, usa DESLOCAMENTO_PADRAO_MIN.
 */
function ag_deslocamento($endereco, $cidade) {
    $c = ag_config();
    $padrao = ['min' => (int)$c['DESLOCAMENTO_PADRAO_MIN'], 'km' => null, 'destino' => trim("$endereco, $cidade"), 'estimado' => false, 'aproximado' => true];
    $dest = ag_geocodificar($endereco, $cidade);
    if (!$dest) return $padrao;
    try { $rota = ag_rota($c['ORIGEM'], $dest); } catch (Throwable $e) { return $padrao; }
    $fator = $rota['fonte'] === 'google' ? 1.0 : (float)$c['FATOR_TRANSITO'];
    $min = (int)(ceil(($rota['min'] * $fator + $c['MARGEM_DESLOCAMENTO_MIN']) / 5) * 5);
    return ['min' => max($min, (int)$c['DESLOCAMENTO_MINIMO_MIN']), 'km' => $rota['km'], 'destino' => $dest['nome'], 'estimado' => true, 'aproximado' => $dest['aproximado']];
}

/** Cria um evento na agenda de compromissos. */
function ag_criar_evento(DateTimeImmutable $inicio, DateTimeImmutable $fim, $titulo, $local, $descricao, $cor = null) {
    $c = ag_config();
    $url = 'https://www.googleapis.com/calendar/v3/calendars/' . rawurlencode($c['AGENDA_COMPROMISSOS']) . '/events';
    return ag_http('POST', $url, ag_token(), [
        'summary' => $titulo, 'location' => $local, 'description' => $descricao, 'colorId' => $cor ?? $c['COR_EVENTO'],
        'start' => ['dateTime' => $inicio->format(DATE_RFC3339), 'timeZone' => $c['FUSO']],
        'end'   => ['dateTime' => $fim->format(DATE_RFC3339), 'timeZone' => $c['FUSO']],
        'reminders' => ['useDefault' => false, 'overrides' => [['method' => 'popup', 'minutes' => 120]]],
    ]);
}
