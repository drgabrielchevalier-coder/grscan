<?php
/* Login do painel: e-mail + senha, depois o código do aplicativo autenticador.
   Administrador sem autenticador ativado configura o app aqui antes de entrar. */
require __DIR__ . '/../app/painel.php';
cabecalhos_painel();
sessao_iniciar();
if (admin_atual()) { header('Location: index.php', true, 303); exit; }

$erro = '';
$GENERICO = 'E-mail, senha ou código inválidos.';
$etapa = $_SESSION['etapa'] ?? '';
$pre = isset($_SESSION['pre_admin']) ? admin_por_id((int)$_SESSION['pre_admin']) : null;
if ($pre && !$pre['ativo']) { $pre = null; $_SESSION = []; $etapa = ''; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verificar();
    $ip = ip_cliente();
    if (isset($_POST['senha'])) {
        $email = trim((string)($_POST['email'] ?? ''));
        if (login_bloqueado($email, $ip)) {
            $erro = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
        } else {
            $st = db()->prepare('SELECT * FROM admins WHERE email = ?');
            $st->execute([$email]);
            $a = $st->fetch();
            // password_verify roda mesmo sem usuário, para o tempo de resposta não revelar e-mails
            $okSenha = password_verify((string)$_POST['senha'], $a['senha_hash'] ?? '$2y$10$QPD/v.vPtNSHKwfpX6m9VOeFoydt5w1roorc0I2msdOPYWZuDDfc.');
            if ($a && $a['ativo'] && $okSenha) {
                if (password_needs_rehash($a['senha_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_DEFAULT)) {
                    db()->prepare('UPDATE admins SET senha_hash = ? WHERE id = ?')->execute([senha_gerar_hash((string)$_POST['senha']), $a['id']]);
                }
                session_regenerate_id(true);
                $_SESSION = ['pre_admin' => (int)$a['id'], 'etapa' => $a['totp_ativo'] ? 'totp' : 'totp_config', 'visto' => time(), 'csrf' => bin2hex(random_bytes(32))];
                header('Location: entrar.php', true, 303);
                exit;
            }
            login_registrar_falha($email, $ip);
            $erro = $GENERICO;
        }
    } elseif (isset($_POST['codigo']) && $pre && in_array($etapa, ['totp', 'totp_config'], true)) {
        if (login_bloqueado($pre['email'], $ip)) {
            $erro = 'Muitas tentativas. Aguarde 15 minutos e tente de novo.';
        } elseif (totp_verificar((string)$pre['totp_segredo'], (string)$_POST['codigo'])) {
            if ($etapa === 'totp_config') {
                db()->prepare('UPDATE admins SET totp_ativo = 1 WHERE id = ?')->execute([$pre['id']]);
                auditar((int)$pre['id'], 'autenticador_ativado');
            }
            login_limpar($pre['email']);
            login_concluir($pre);
            header('Location: index.php', true, 303);
            exit;
        } else {
            login_registrar_falha($pre['email'], $ip);
            $erro = $etapa === 'totp_config' ? 'Código inválido. Confira o horário do celular e digite o código atual.' : $GENERICO;
        }
    }
}

painel_inicio('Entrar');
echo '<section class="cartao estreito">';
if ($pre && $etapa === 'totp_config') { ?>
  <h1>Ative o aplicativo autenticador</h1>
  <p>No Google Authenticator, Microsoft Authenticator ou similar, escolha <b>adicionar conta</b> → <b>inserir chave de configuração</b> e use:</p>
  <dl class="chave">
    <dt>Conta</dt><dd><?= h('GR Scan · ' . $pre['email']) ?></dd>
    <dt>Chave</dt><dd><code id="totp-segredo"><?= h(trim(chunk_split((string)$pre['totp_segredo'], 4, ' '))) ?></code></dd>
    <dt>Tipo</dt><dd>Baseada em tempo</dd>
  </dl>
  <p class="dica">No celular, você também pode tocar em <a href="<?= h(totp_uri((string)$pre['totp_segredo'], $pre['email'])) ?>">abrir no aplicativo</a>.</p>
  <?= $erro ? aviso($erro) : '' ?>
  <form method="post" class="form"><?= csrf_campo() ?>
    <label>Código de 6 dígitos<input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="\d{6}" maxlength="6" required autofocus></label>
    <button type="submit" class="btn btn--gold">Ativar e entrar</button>
  </form>
<?php } elseif ($pre && $etapa === 'totp') { ?>
  <h1>Código de verificação</h1>
  <p>Digite o código de 6 dígitos do aplicativo autenticador.</p>
  <?= $erro ? aviso($erro) : '' ?>
  <form method="post" class="form"><?= csrf_campo() ?>
    <label>Código<input name="codigo" inputmode="numeric" autocomplete="one-time-code" pattern="\d{6}" maxlength="6" required autofocus></label>
    <button type="submit" class="btn btn--gold">Entrar</button>
  </form>
<?php } else { ?>
  <h1>Entrar no painel</h1>
  <?= $erro ? aviso($erro) : '' ?>
  <form method="post" class="form"><?= csrf_campo() ?>
    <label>E-mail<input name="email" type="email" required autocomplete="username" value="<?= h($_POST['email'] ?? '') ?>"></label>
    <label>Senha<input name="senha" type="password" required autocomplete="current-password"></label>
    <button type="submit" class="btn btn--gold">Continuar</button>
  </form>
<?php }
echo '</section>';
painel_fim();
