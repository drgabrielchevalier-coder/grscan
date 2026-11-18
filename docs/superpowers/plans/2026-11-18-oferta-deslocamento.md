# Oferta de deslocamento grátis — plano

> Execução pelo próprio Claude nesta sessão, um commit por tarefa, testando cada uma.

**Desenho:** `docs/superpowers/specs/2026-11-18-oferta-deslocamento-design.md`

**Formato na tabela de preços:** `"promocao_deslocamento": {"fim": "2026-11-18T18:00:00-03:00"}` ou `null`.
Ativa quando `fim` > agora. Validação: `null` ou `fim` em ISO 8601 válido.

## Pontos de atenção (com teste)
1. Relógio do celular errado → a contagem usa a diferença para a hora do servidor (`agora` no endpoint público).
2. Oferta termina com o modal aberto → faixa some, taxa volta, total recalculado.
3. Orçamento enviado no último segundo → vale o que o servidor calcular no envio, e a confirmação mostra esse total.
4. "Outras localidades" com oferta aberta → continua "sob consulta", sem riscado.

### Tarefa 1: regras (PHP e JS) e endpoint público
- `orcamento_calcular($cfg, $pedido, ?int $agora = null)` e `GRSCAN_CALC.calcular(cfg, pedido, agoraMs)`:
  - com a oferta ativa e a região com taxa, o item de deslocamento fica com `total 0`, `preco_base` = taxa, `desconto` = taxa e `promocao: true`;
  - a saída ganha `promocao: {fim} | null`.
- `precos_validar` aceita a chave; `precos_diferencas` registra "Oferta de deslocamento grátis: aberta até dd/mm hh:mm" ou "encerrada".
- `precos-publicos.php` ganha `agora` (ISO, hora do servidor) e `promocao_deslocamento: {fim}` só quando a oferta está ativa.
- **Casos novos em `tests/orcamento-casos.json`** (campo `agora`):
  - Niterói com oferta ativa → `[19000, 2500, 8000, 0]`, total 29500;
  - oferta vencida → 38500;
  - "outras localidades" com oferta → continua pendente.
- **Testes do endpoint público:** a oferta só aparece quando está ativa, e o endpoint continua sem campos internos.

### Tarefa 2: painel
- `admin/precos.php`, quadro "Oferta de deslocamento grátis", com dois botões (POST com CSRF):
  - `acao=oferta_abrir`: horas (1, 2, 4, 8 ou 24) ou `fim` (datetime-local, no futuro);
  - `acao=oferta_encerrar`.
- Cada ação grava uma nova versão da tabela e um registro de auditoria.
- Detalhe do orçamento: "grátis (oferta), de R$ X".
- **Testes (`tests/admin.js`):**
  - abrir a oferta por 4 h → o endpoint público mostra `fim` cerca de 4 h à frente, e um orçamento enviado de Niterói fica em R$ 295,00;
  - o histórico mostra a abertura;
  - encerrar → o público fica sem oferta.

### Tarefa 3: orçamento do site e e-mail
- `#qt-oferta`: faixa com contagem `hh:mm:ss`, atualizada a cada segundo pela hora do servidor.
- O item de deslocamento mostra `<s>R$ 90,00</s> GRÁTIS`; a região aparece como "Niterói · grátis (oferta)".
- Ao terminar a oferta: `tabela.promocao_deslocamento = null`, as regiões são remontadas e o total recalculado.
- O texto do WhatsApp e o e-mail (`em_itens`) dizem "grátis (oferta, de R$ 90,00)".
- **Testes (`tests/regressao.js`, com o endpoint simulado):**
  - oferta de 4 h → faixa visível, "R$ 90,00" riscado e total R$ 295,00;
  - oferta de 3 s → depois de 4 s a faixa some e o total volta a R$ 385,00;
  - relógio do navegador adiantado 2 h (`agora` do servidor no passado) → a contagem continua correta;
  - axe-core sem violações;
  - 320 px sem rolagem horizontal.
