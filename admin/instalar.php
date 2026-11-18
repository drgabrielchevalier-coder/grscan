<?php
/* Primeiro acesso: cria o primeiro administrador.
   Só funciona enquanto não existe administrador e com a chave gravada FORA do public_html,
   que só quem tem acesso à hospedagem consegue ler. Depois disso responde 404. */
require __DIR__ . '/../app/painel.php';
cabecalhos_painel();

if ((int)db()->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0) {
    http_response_code(404);
    exit('Página não encontrada.');
}

$arqCfg = pasta_dados() . '/grscan-config.php';
$cfg = config_local();
if (empty($cfg['chave_instalacao'])) {
    $chave = bin2hex(random_bytes(16));
    $cfg['chave_instalacao'] = $chave;
    file_put_contents($arqCfg, "<?php\n/* GR Scan: configuração local. NÃO publicar nem enviar ao Git. */\nreturn " . var_export($cfg, true) . ";\n", LOCK_EX);
    @chmod($arqCfg, 0600);
}

sessao_iniciar();
$erro = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verificar();
    $email = trim((string)($_POST['email'] ?? ''));
    $nome = trim((string)($_POST['nome'] ?? ''));
    $senha = (string)($_POST['senha'] ?? '');
    if (login_bloqueado('instalacao', ip_cliente())) $erro = 'Muitas tentativas. Aguarde 15 minutos.';
    elseif (!hash_equals((string)$cfg['chave_instalacao'], trim((string)($_POST['chave'] ?? '')))) { $erro = 'Chave de instalação incorreta.'; login_registrar_falha('instalacao', ip_cliente()); }
    elseif ($nome === '' || mb_strlen($nome) > 80) $erro = 'Informe o nome.';
    elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) $erro = 'E-mail inválido.';
    elseif ($e = senha_valida($senha)) $erro = $e;
    elseif ($senha !== (string)($_POST['senha2'] ?? '')) $erro = 'As senhas não conferem.';
    else {
        db()->prepare('INSERT INTO admins (email, nome, senha_hash, totp_segredo, totp_ativo, ativo, criado_em) VALUES (?, ?, ?, ?, 0, 1, ?)')
            ->execute([$email, $nome, senha_gerar_hash($senha), totp_novo_segredo(), agora()]);
        $id = (int)db()->lastInsertId();
        auditar($id, 'instalacao', ['email' => $email]);
        session_regenerate_id(true);
        $_SESSION = ['pre_admin' => $id, 'etapa' => 'totp_config', 'visto' => time(), 'csrf' => bin2hex(random_bytes(32))];
        header('Location: entrar.php', true, 303);
        exit;
    }
}

painel_inicio('Primeiro acesso');
?>
<section class="cartao estreito">
  <h1>Primeiro acesso ao painel</h1>
  <p>Para provar que você administra a hospedagem, abra no Gerenciador de Arquivos da Hostinger o arquivo
     <code>grscan-dados/grscan-config.php</code> (na pasta <b>acima</b> de <code>public_html</code>) e copie a <b>chave_instalacao</b>.</p>
  <?= $erro ? aviso($erro) : '' ?>
  <form method="post" class="form">
    <?= csrf_campo() ?>
    <label>Chave de instalação<input name="chave" required autocomplete="off"></label>
    <label>Seu nome<input name="nome" required maxlength="80" autocomplete="name" value="<?= h($_POST['nome'] ?? '') ?>"></label>
    <label>E-mail<input name="email" type="email" required autocomplete="username" value="<?= h($_POST['email'] ?? '') ?>"></label>
    <label>Senha (12 caracteres ou mais)<input name="senha" type="password" required minlength="12" autocomplete="new-password"></label>
    <label>Repita a senha<input name="senha2" type="password" required minlength="12" autocomplete="new-password"></label>
    <button type="submit" class="btn btn--gold">Criar administrador</button>
  </form>
</section>
<?php painel_fim();
