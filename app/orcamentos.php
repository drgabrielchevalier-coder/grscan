<?php
/* Registro dos orçamentos do site: valida, recalcula com a tabela vigente,
   grava com a cópia da tabela aplicada e devolve o número. */
declare(strict_types=1);
require_once __DIR__ . '/precos.php';
require_once __DIR__ . '/calculo.php';

const ORC_LIMITES = [
    'dentes' => 300, 'elementos' => 10, 'data_desejada' => 10, 'obs' => 1200,
    'nome' => 100, 'clinica' => 120, 'cro' => 30, 'telefone' => 20, 'email' => 120, 'preferencia' => 30,
];

/* Limpa e valida os dados de contato. Devolve [dados, erro|null]. */
function orcamento_dados(array $d): array {
    $v = [];
    foreach (ORC_LIMITES as $k => $max) {
        $x = $d[$k] ?? '';
        if (is_array($x)) $x = implode(', ', array_map('strval', $x));
        $x = str_replace(["\r", "\0"], '', trim((string)$x));
        $v[$k] = mb_substr($x, 0, $max);
    }
    if ($v['nome'] === '') return [$v, 'Informe o nome do dentista responsável.'];
    if (strlen(preg_replace('/\D/', '', $v['telefone'])) < 10) return [$v, 'Informe um WhatsApp com DDD.'];
    if (!filter_var($v['email'], FILTER_VALIDATE_EMAIL)) return [$v, 'E-mail inválido.'];
    if ($v['data_desejada'] !== '') {
        $dt = DateTime::createFromFormat('!Y-m-d', $v['data_desejada']);
        if (!$dt || $dt->format('Y-m-d') !== $v['data_desejada'] || $v['data_desejada'] < date('Y-m-d')) return [$v, 'Data desejada inválida.'];
    }
    if (($d['aceite_privacidade'] ?? false) !== true) return [$v, 'Confirme o aceite do aviso de privacidade.'];
    return [$v, null];
}

/* Mantém só o que o cálculo usa, para gravar o pedido sem campos estranhos */
function orcamento_pedido(array $d): array {
    $pac = [];
    foreach (is_array($d['pacientes'] ?? null) ? $d['pacientes'] : [] as $p) {
        if (!is_array($p)) { $pac[] = []; continue; }
        $x = ['procedimento' => is_string($p['procedimento'] ?? null) ? mb_substr($p['procedimento'], 0, 40) : ''];
        foreach (['implantes', 'transfers', 'tibases'] as $k) if (array_key_exists($k, $p)) $x[$k] = is_scalar($p[$k]) ? $p[$k] : null;
        $pac[] = $x;
    }
    return ['regiao' => is_string($d['regiao'] ?? null) ? mb_substr($d['regiao'], 0, 40) : '', 'pacientes' => $pac];
}

/* Devolve [status HTTP, resposta pública, registro interno|null] */
function orcamento_processar(array $d, string $ip): array {
    if (!empty($d['website'])) return [200, ['ok' => true, 'numero' => null, 'total' => null, 'subtotal' => null, 'pendente' => false, 'message' => ''], null];
    [$dados, $erro] = orcamento_dados($d);
    if ($erro) return [400, ['ok' => false, 'message' => $erro], null];
    $pedido = orcamento_pedido($d);
    $cfg = precos_vigentes();
    $calc = orcamento_calcular($cfg, $pedido);
    if ($calc['erros']) return [400, ['ok' => false, 'message' => $calc['erros'][0]], null];

    $assinatura = hash('sha256', json_enc($pedido) . '|' . mb_strtolower($dados['email']) . '|' . $dados['nome']);
    $pdo = db();
    $pdo->exec('BEGIN IMMEDIATE');
    try {
        $rep = $pdo->prepare('SELECT * FROM orcamentos WHERE assinatura = ? AND criado_em >= ? ORDER BY id DESC LIMIT 1');
        $rep->execute([$assinatura, date('Y-m-d H:i:s', time() - 60)]);
        if ($ja = $rep->fetch()) {
            $pdo->exec('COMMIT');
            return [200, orcamento_resposta($ja['numero'], json_decode($ja['calculo_json'], true)), null];
        }
        $ano = date('Y');
        $ult = $pdo->prepare("SELECT numero FROM orcamentos WHERE numero LIKE ? ORDER BY numero DESC LIMIT 1");
        $ult->execute(["GRS-$ano-%"]);
        $seq = ($n = $ult->fetchColumn()) ? (int)substr($n, -5) + 1 : 1;
        $numero = sprintf('GRS-%s-%05d', $ano, $seq);
        $calcGravar = $calc + ['tabela' => $cfg];
        $ins = $pdo->prepare('INSERT INTO orcamentos (numero, criado_em, dados_json, pedido_json, calculo_json, precos_versao_id,
            total_centavos, subtotal_centavos, pendente, status, assinatura, ip) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
        $ins->execute([$numero, agora(), json_enc($dados), json_enc($pedido), json_enc($calcGravar), precos_versao_vigente(),
            $calc['total'], $calc['subtotal'], $calc['pendente'] ? 1 : 0, 'solicitado', $assinatura, mb_substr($ip, 0, 45)]);
        $pdo->exec('COMMIT');
    } catch (Throwable $e) {
        $pdo->exec('ROLLBACK');
        throw $e;
    }
    return [200, orcamento_resposta($numero, $calc), ['numero' => $numero, 'dados' => $dados, 'calculo' => $calc, 'pedido' => $pedido]];
}

function orcamento_resposta(string $numero, array $calc): array {
    return ['ok' => true, 'numero' => $numero, 'total' => $calc['total'], 'subtotal' => $calc['subtotal'],
            'pendente' => (bool)$calc['pendente'], 'message' => ''];
}

function brl(?int $c): string {
    if ($c === null) return 'sob consulta';
    return 'R$ ' . number_format($c / 100, 2, ',', '.');
}
