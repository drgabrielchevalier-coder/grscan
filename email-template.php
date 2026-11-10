<?php
/* ============================================================
   GR Scan — modelo de e-mail em HTML (compatível com Gmail, Outlook e celular)
   Usa tabelas e estilos inline, porque os leitores de e-mail ignoram CSS externo.
   ============================================================ */

function em_e($s) { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }

/** Endereço do site (para a logo e links). */
function em_site() {
    $host = preg_replace('/[^a-z0-9.\-:]/i', '', $_SERVER['HTTP_HOST'] ?? 'grscan.implantstore.com.br');
    return 'https://' . ($host ?: 'grscan.implantstore.com.br');
}

/** Telefone legível: 5521967329133 -> (21) 96732-9133 */
function em_fone($tel) {
    $d = preg_replace('/\D/', '', $tel);
    if (strlen($d) > 11 && substr($d, 0, 2) === '55') $d = substr($d, 2);
    if (strlen($d) === 11) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 5) . '-' . substr($d, 7);
    if (strlen($d) === 10) return '(' . substr($d, 0, 2) . ') ' . substr($d, 2, 4) . '-' . substr($d, 6);
    return $tel;
}

/** Link do WhatsApp com DDI 55. */
function em_wa($tel, $texto = '') {
    $d = preg_replace('/\D/', '', $tel);
    if (strlen($d) <= 11) $d = '55' . $d;
    return 'https://wa.me/' . $d . ($texto !== '' ? '?text=' . rawurlencode($texto) : '');
}

/** "Etiquetas" (ex.: tipos de trabalho, dentes). */
function em_chips(array $itens, $destaque = false) {
    $out = '';
    foreach ($itens as $i) {
        $i = trim($i); if ($i === '') continue;
        $st = $destaque
            ? 'background:#f3d27a;color:#1a1206;border:1px solid #d9a441;'
            : 'background:#f6f1e7;color:#3b3226;border:1px solid #e6dcc8;';
        $out .= '<span style="display:inline-block;margin:0 6px 6px 0;padding:5px 11px;border-radius:999px;font-size:13px;font-weight:600;' . $st . '">' . em_e($i) . '</span>';
    }
    return $out ?: '<span style="color:#9a8f7f">—</span>';
}

/** Bloco com título e linhas rótulo/valor. Valores já em HTML seguro (use em_e). */
function em_bloco($titulo, $icone, array $linhas) {
    $rows = '';
    foreach ($linhas as $rotulo => $valorHtml) {
        $rows .= '<tr>'
            . '<td style="padding:9px 0;border-bottom:1px solid #efe8db;width:38%;vertical-align:top;font-size:13px;color:#8a7f6e;">' . em_e($rotulo) . '</td>'
            . '<td style="padding:9px 0;border-bottom:1px solid #efe8db;vertical-align:top;font-size:14px;color:#1d1813;font-weight:500;">' . $valorHtml . '</td>'
            . '</tr>';
    }
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">'
        . '<tr><td style="padding:0 0 8px;font-size:12px;letter-spacing:.14em;text-transform:uppercase;font-weight:700;color:#b07c3c;">'
        . $icone . '&nbsp; ' . em_e($titulo) . '</td></tr>'
        . '<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">' . $rows . '</table></td></tr></table>';
}

/** Botão. $tipo: 'gold' ou 'line' */
function em_botao($texto, $url, $tipo = 'gold') {
    $st = $tipo === 'gold'
        ? 'background:#e0aa45;background-image:linear-gradient(180deg,#f7cf6a,#d99a2b);color:#1a1206;border:1px solid #d99a2b;'
        : 'background:#ffffff;color:#1d1813;border:1px solid #d8ccb6;';
    return '<a href="' . em_e($url) . '" style="display:inline-block;margin:0 8px 8px 0;padding:12px 22px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none;' . $st . '">' . em_e($texto) . '</a>';
}

/** Página completa do e-mail. */
function em_layout($preheader, $titulo, $subtitulo, $corpoHtml, $rodape = '') {
    $logo = em_site() . '/assets/logo-completa.png';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        . '<meta name="color-scheme" content="light"><title>' . em_e($titulo) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#ece7de;font-family:Montserrat,Segoe UI,Helvetica,Arial,sans-serif;">'
        . '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' . em_e($preheader) . '</div>'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7de;"><tr><td align="center" style="padding:24px 12px;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,.08);">'
        // cabeçalho
        . '<tr><td style="background:#0e0c0a;background-image:linear-gradient(135deg,#171310,#0a0907);padding:26px 30px 22px;border-bottom:3px solid #d9a441;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>'
        . '<td style="vertical-align:middle;"><img src="' . em_e($logo) . '" width="120" alt="GR SCAN · Digital Scan" style="display:block;border:0;max-width:120px;height:auto;color:#efe6d6;font-size:18px;font-weight:700;"></td>'
        . '</tr></table>'
        . '<div style="margin-top:18px;font-size:22px;line-height:1.25;font-weight:800;color:#ffffff;">' . em_e($titulo) . '</div>'
        . '<div style="margin-top:6px;font-size:13px;color:#c9bca6;">' . $subtitulo . '</div>'
        . '</td></tr>'
        // corpo
        . '<tr><td style="padding:28px 30px 10px;">' . $corpoHtml . '</td></tr>'
        // rodapé
        . '<tr><td style="padding:18px 30px 24px;background:#faf7f1;border-top:1px solid #efe8db;font-size:12px;color:#9a8f7f;line-height:1.6;">'
        . ($rodape ?: 'GR Scan · Escaneamento intraoral digital · <a href="' . em_e(em_site()) . '" style="color:#b07c3c;">' . em_e(preg_replace('#^https?://#', '', em_site())) . '</a>')
        . '</td></tr>'
        . '</table></td></tr></table></body></html>';
}

/** Envia e-mail HTML + texto (multipart/alternative). */
function em_enviar($para, $de, $responderPara, $assunto, $html, $texto) {
    $b = 'alt' . bin2hex(random_bytes(8));
    $h = "From: GR Scan <{$de}>\r\nReply-To: {$responderPara}\r\nMIME-Version: 1.0\r\n" .
         "Content-Type: multipart/alternative; boundary=\"{$b}\"\r\n";
    $corpo = "--{$b}\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
             chunk_split(base64_encode($texto)) .
             "--{$b}\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" .
             chunk_split(base64_encode($html)) . "--{$b}--";
    return mail($para, '=?UTF-8?B?' . base64_encode($assunto) . '?=', $corpo, $h, '-f' . $de);
}
