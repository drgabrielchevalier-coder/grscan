<?php
/* Administradores: criar, desativar/reativar e trocar a própria senha.
   Cada novo administrador ativa o próprio aplicativo autenticador no primeiro acesso. */
require __DIR__ . '/../app/painel.php';
$admin = exigir_admin();
$msg = ''; $tipo = 'ok';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_verificar();
    $acao = $_POST['acao'] ?? '';
    if ($acao === 'criar') {
        $nome = trim((string)($_POST['nome'] ?? '')); $email = trim((string)($_POST['email'] ?? '')); $senha = (string)($_POST['senha'] ?? '');
        $st = db()->prepare('SELECT COUNT(*) FROM admins WHERE email = ?'); $st->execute([$email]);
        if ($nome === '' || mb_strlen($nome) > 80) { $msg = 'Informe o nome.'; $tipo = 'erro'; }
        elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) { $msg = 'E-mail inválido.'; $tipo = 'erro'; }
        elseif ((int)$st->fetchColumn() > 0) { $msg = 'Já existe um administrador com este e-mail.'; $tipo = 'erro'; }
        elseif ($e = senha_valida($senha)) { $msg = $e; $tipo = 'erro'; }
        else {
            db()->prepare('INSERT INTO admins (email, nome, senha_hash, totp_segredo, totp_ativo, ativo, criado_em) VALUES (?, ?, ?, ?, 0, 1, ?)')
                ->execute([$email, $nome, senha_gerar_hash($senha), totp_novo_segredo(), agora()]);
            auditar((int)$admin['id'], 'admin_criado', ['email' => $email]);
            $msg = "Administrador criado. Passe a senha para $nome por um canal seguro; no primeiro acesso ele ativa o aplicativo autenticador.";
        }
    } elseif ($acao === 'ativo') {
        $id = (int)($_POST['id'] ?? 0); $ativar = ($_POST['valor'] ?? '') === '1';
        $ativos = (int)db()->query('SELECT COUNT(*) FROM admins WHERE ativo = 1')->fetchColumn();
        if ($id === (int)$admin['id']) { $msg = 'Você não pode desativar a si mesmo.'; $tipo = 'erro'; }
        elseif (!$ativar && $ativos <= 1) { $msg = 'É preciso manter ao menos um administrador ativo.'; $tipo = 'erro'; }
        else {
            db()->prepare('UPDATE admins SET ativo = ? WHERE id = ?')->execute([$ativar ? 1 : 0, $id]);
            auditar((int)$admin['id'], $ativar ? 'admin_reativado' : 'admin_desativado', ['id' => $id]);
            $msg = $ativar ? 'Administrador reativado.' : 'Administrador desativado. Ele não consegue mais entrar.';
        }
    } elseif ($acao === 'senha') {
        $atual = (string)($_POST['atual'] ?? ''); $nova = (string)($_POST['nova'] ?? '');
        if (!password_verify($atual, $admin['senha_hash'])) { $msg = 'Senha atual incorreta.'; $tipo = 'erro'; }
        elseif ($e = senha_valida($nova)) { $msg = $e; $tipo = 'erro'; }
        else {
            db()->prepare('UPDATE admins SET senha_hash = ? WHERE id = ?')->execute([senha_gerar_hash($nova), $admin['id']]);
            auditar((int)$admin['id'], 'senha_trocada');
            $msg = 'Senha alterada.';
        }
    }
}

$admins = db()->query('SELECT id, nome, email, ativo, totp_ativo, criado_em FROM admins ORDER BY ativo DESC, nome')->fetchAll();
painel_inicio('Administradores', $admin); ?>
<h1>Administradores</h1>
<?= $msg ? aviso($msg, $tipo) : '' ?>
<section class="cartao">
  <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Autenticador</th><th>Situação</th><th></th></tr></thead><tbody>
  <?php foreach ($admins as $a): ?>
    <tr><td><?= h($a['nome']) ?></td><td><?= h($a['email']) ?></td>
      <td><?= $a['totp_ativo'] ? 'ativo' : 'pendente (1º acesso)' ?></td>
      <td><span class="status"><?= $a['ativo'] ? 'ativo' : 'inativo' ?></span></td>
      <td><?php if ((int)$a['id'] !== (int)$admin['id']): ?>
        <form method="post" class="confirmar" data-pergunta="<?= $a['ativo'] ? 'Desativar ' . h($a['nome']) . '?' : '' ?>"><?= csrf_campo() ?>
          <input type="hidden" name="acao" value="ativo"><input type="hidden" name="id" value="<?= (int)$a['id'] ?>">
          <input type="hidden" name="valor" value="<?= $a['ativo'] ? '0' : '1' ?>">
          <button type="submit" class="btn <?= $a['ativo'] ? 'btn--perigo' : 'btn--line' ?>"><?= $a['ativo'] ? 'Desativar' : 'Reativar' ?></button>
        </form><?php else: ?><span class="dica">você</span><?php endif; ?></td></tr>
  <?php endforeach; ?>
  </tbody></table></div>
</section>
<div class="grade2">
<section class="cartao">
  <h2>Novo administrador</h2>
  <form method="post" class="form"><?= csrf_campo() ?><input type="hidden" name="acao" value="criar">
    <label>Nome<input name="nome" required maxlength="80"></label>
    <label>E-mail<input name="email" type="email" required autocomplete="off"></label>
    <label>Senha inicial (12 caracteres ou mais)<input name="senha" type="password" required minlength="12" autocomplete="new-password"></label>
    <button type="submit" class="btn btn--gold">Criar administrador</button>
  </form>
</section>
<section class="cartao">
  <h2>Trocar minha senha</h2>
  <form method="post" class="form"><?= csrf_campo() ?><input type="hidden" name="acao" value="senha">
    <label>Senha atual<input name="atual" type="password" required autocomplete="current-password"></label>
    <label>Nova senha (12 caracteres ou mais)<input name="nova" type="password" required minlength="12" autocomplete="new-password"></label>
    <button type="submit" class="btn btn--line">Trocar minha senha</button>
  </form>
</section>
</div>
<script src="painel.js?v=1"></script>
<?php painel_fim();
