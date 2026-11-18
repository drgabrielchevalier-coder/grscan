<?php
require_once __DIR__ . '/../../app/totp.php';

// RFC 6238, apêndice B (SHA1, segredo ASCII "12345678901234567890"), últimos 6 dígitos
$seg = base32_codificar('12345678901234567890');
afirmar($seg === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'base32 do segredo da RFC', $seg);
afirmar(base32_decodificar($seg) === '12345678901234567890', 'base32 ida e volta');
foreach ([59 => '287082', 1111111109 => '081804', 1111111111 => '050471', 1234567890 => '005924', 2000000000 => '279037'] as $t => $esp)
    afirmar(totp_codigo($seg, $t) === $esp, "TOTP RFC 6238 em t=$t", totp_codigo($seg, $t));
afirmar(totp_verificar($seg, '287082', 59), 'verifica o código do momento');
afirmar(totp_verificar($seg, '287082', 59 + 30), 'aceita o código do intervalo anterior');
afirmar(!totp_verificar($seg, '287082', 59 + 90), 'recusa código antigo');
afirmar(!totp_verificar($seg, '28708', 59) && !totp_verificar($seg, 'abcdef', 59), 'recusa formato inválido');
$novo = totp_novo_segredo();
afirmar(strlen(base32_decodificar($novo)) === 20 && preg_match('/^[A-Z2-7]+$/', $novo), 'segredo novo: 20 bytes em base32');
afirmar(totp_passo($seg, '287082', 59) === 1 && totp_passo($seg, '287082', 89) === 1 && totp_passo($seg, '000000', 59) === null, 'passo do código (para impedir reuso)');
