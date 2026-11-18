<?php
/* Segundo fator por código de aplicativo autenticador (TOTP, RFC 6238: SHA1, 30 s, 6 dígitos). */
declare(strict_types=1);

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32_codificar(string $bin): string {
    $bits = '';
    foreach (str_split($bin) as $c) $bits .= str_pad(decbin(ord($c)), 8, '0', STR_PAD_LEFT);
    $out = '';
    foreach (str_split($bits, 5) as $grupo) $out .= B32[bindec(str_pad($grupo, 5, '0'))];
    return $out;
}

function base32_decodificar(string $txt): string {
    $txt = strtoupper(preg_replace('/[\s=-]/', '', $txt));
    $bits = '';
    foreach (str_split($txt) as $c) {
        $v = strpos(B32, $c);
        if ($v === false) return '';
        $bits .= str_pad(decbin($v), 5, '0', STR_PAD_LEFT);
    }
    $out = '';
    foreach (str_split($bits, 8) as $byte) if (strlen($byte) === 8) $out .= chr(bindec($byte));
    return $out;
}

function totp_codigo(string $segredoBase32, int $tempo): string {
    $chave = base32_decodificar($segredoBase32);
    $contador = pack('J', intdiv($tempo, 30));
    $h = hash_hmac('sha1', $contador, $chave, true);
    $o = ord($h[19]) & 0x0f;
    $n = ((ord($h[$o]) & 0x7f) << 24) | (ord($h[$o + 1]) << 16) | (ord($h[$o + 2]) << 8) | ord($h[$o + 3]);
    return str_pad((string)($n % 1000000), 6, '0', STR_PAD_LEFT);
}

/* Aceita o intervalo atual e um antes/depois (relógio do celular adiantado ou atrasado) */
function totp_verificar(string $segredo, string $codigo, ?int $tempo = null): bool {
    $codigo = preg_replace('/\s/', '', $codigo);
    if (!preg_match('/^\d{6}$/', $codigo) || $segredo === '') return false;
    $tempo ??= time();
    foreach ([-30, 0, 30] as $d) if (hash_equals(totp_codigo($segredo, $tempo + $d), $codigo)) return true;
    return false;
}

/* Intervalo (passo de 30 s) a que o código pertence, ou null; usado para não aceitar o mesmo código duas vezes */
function totp_passo(string $segredo, string $codigo, ?int $tempo = null): ?int {
    $codigo = preg_replace('/\s/', '', $codigo);
    if (!preg_match('/^\d{6}$/', $codigo) || $segredo === '') return null;
    $tempo ??= time();
    foreach ([0, -30, 30] as $d) if (hash_equals(totp_codigo($segredo, $tempo + $d), $codigo)) return intdiv($tempo + $d, 30);
    return null;
}

function totp_novo_segredo(): string { return base32_codificar(random_bytes(20)); }

function totp_uri(string $segredo, string $email): string {
    return 'otpauth://totp/' . rawurlencode('GR Scan:' . $email) . '?secret=' . $segredo . '&issuer=' . rawurlencode('GR Scan') . '&algorithm=SHA1&digits=6&period=30';
}
