# Orçamento automático e painel administrativo — desenho
**Status:** aguardando aprovação · 18/11/2026

## 1. Por quê
Permitir que dentistas e clínicas montem sozinhos um orçamento com preços comerciais e que a GR Scan
controle preços, operação e rentabilidade num ambiente interno, sem expor nenhuma informação
estratégica ao público. Especificação completa do dono do site: mensagem de 18/11/2026
("GR SCAN — Sistema de orçamentos e gestão financeira"), que este desenho segue.

## 2. Decisões já tomadas
- O orçamento automático **substitui** o formulário "Solicitar orçamento" atual: o mesmo botão,
  o mesmo link `#orcamento`, agora com preços. Odontograma, dados de contato e envio por e-mail
  continuam dentro dele.
- Entrega em três etapas, cada uma funcionando sozinha:
  - **Etapa A:** tabela de preços administrável, orçamento público, registro dos orçamentos,
    login seguro e editor de preços com histórico.
  - **Etapa B:** gestão de orçamentos e atendimentos (status, histórico, conversão em atendimento).
  - **Etapa C:** custos fixos e variáveis, controle de componentes, indicadores, gráficos e
    exportação de relatórios.
- Este documento detalha a Etapa A e fixa a arquitetura que B e C usam. B e C terão desenho curto
  próprio antes de começar.

## 3. Abordagens consideradas (decisão do Claude, pode ser corrigida)
| Abordagem | Prós | Contras |
|---|---|---|
| **PHP + SQLite num arquivo fora do `public_html` (escolhida)** | Nada a criar no hPanel; o mesmo banco roda nos testes locais; backup = copiar um arquivo; o PHP do site já existe | Um só servidor (adequado ao volume da GR Scan) |
| PHP + MySQL da Hostinger | Backup pelo hPanel; mais robusto para muitos acessos simultâneos | O dono precisa criar banco e usuário; senha num arquivo de configuração |
| Serviço externo (Supabase, Firebase) | Painel pronto | Dado de saúde e de clientes fora do servidor da GR Scan (LGPD); mais uma conta e custo |

O acesso a dados fica numa camada PDO única, de modo que trocar SQLite por MySQL depois muda
só a configuração.

## 4. Arquitetura
```
public_html/
  index.html, script.js, styles.css   orçamento público (substitui o modal atual)
  orcamento.php                        recebe o orçamento: recalcula no servidor, grava, envia e-mail
  precos-publicos.php                  GET: só preços comerciais e disponibilidade (sem custos)
  admin/                               painel (login, preços, orçamentos recebidos)
  app/                                 código PHP compartilhado; acesso direto bloqueado (.htaccess)
../grscan-dados/                       FORA do public_html, criado pelo próprio PHP
  grscan.sqlite                        banco de dados
  grscan-config.php                    chave de instalação e ajustes (não vai para o Git)
```
- **Preços em centavos (inteiros)** em todo o sistema.
- **O servidor recalcula tudo.** O navegador calcula para mostrar o total ao vivo, mas o valor gravado
  é o que o PHP calcula com a tabela vigente. As regras de cálculo existem em JS e em PHP, com os
  mesmos casos de teste nos dois lados (inclusive o exemplo de Niterói: R$ 385,00).
- **Separação do público:** `precos-publicos.php` monta a resposta a partir de uma lista fechada
  de campos comerciais. Custos, margens e fornecedores (Etapa C) ficam em tabelas que nenhum
  endpoint público lê.
- **Cópia dos preços no orçamento:** cada orçamento guarda a tabela aplicada e os itens calculados
  (JSON), para que mudanças futuras não alterem orçamentos antigos.

## 5. Orçamento público (Etapa A)
**Fluxo no modal "Solicitar orçamento"** (otimizado para celular, um passo por bloco):
1. **Região da clínica** (lista de regiões com taxa; "Outras localidades" = sob consulta).
2. **Pacientes:** botão "Adicionar paciente"; para cada paciente:
   - procedimento (lista da tabela; itens indisponíveis não aparecem; "Protocolo total" mostra "sob avaliação");
   - para implantes: quantidade de implantes (1 = unitário; 2 a 4 = múltiplos; 5 ou mais = sob avaliação);
   - transfers digitais e TiBases: quantidade de 0 até o número de implantes, começando em 0.
3. **Resumo ao vivo:** item a item, desconto aplicado (com a faixa), deslocamento uma vez, total.
   Se houver item sob avaliação: "Subtotal dos itens com preço" + aviso de que o total depende de
   confirmação. Aviso fixo: valores sujeitos a disponibilidade, compatibilidade dos componentes e
   viabilidade técnica; TiBase sujeita a confirmação de compatibilidade.
4. **Dados e envio:** dentes envolvidos (odontograma atual, opcional), data desejada, observações,
   nome, clínica, CRO, WhatsApp, e-mail, preferência de contato e aceite do aviso de privacidade.
   Botões: **Enviar para a GR Scan** (registra, mostra o número do orçamento e envia e-mail) e
   **Compartilhar no WhatsApp** (texto do orçamento; abre o número de `CONFIG.whatsapp` quando
   configurado, senão o compartilhamento genérico).

**Regras de cálculo**
- Cada paciente é calculado individualmente.
- Desconto por volume: só nos procedimentos marcados como elegíveis (hoje, os de R$ 180,00); a faixa
  é escolhida pelo **total de pacientes da visita** (1 = R$ 180; 2 a 4 = R$ 170; 5 ou mais = R$ 160).
  Faixas e elegibilidade são editáveis no painel.
- Implantes, arcada edêntula, reescaneamento e componentes nunca recebem desconto automático.
- Deslocamento: uma taxa por visita, pela região.
- Total = escaneamentos + transfers + TiBases + deslocamento.
- Validações: ao menos 1 paciente; até 30 por orçamento; quantidades inteiras, sem negativos;
  componentes só em procedimentos com implante.

## 6. Painel administrativo (Etapa A)
- Endereço `/admin/`, com `noindex` e fora do `sitemap.xml`.
- **Autenticação no servidor:** senha com `password_hash` (Argon2id quando disponível), sessão PHP
  com cookie `Secure`, `HttpOnly` e `SameSite=Strict`, troca de ID ao entrar, expiração por
  inatividade (30 min), token CSRF em toda alteração e bloqueio temporário após 5 tentativas
  erradas. **Segundo fator (TOTP, app autenticador) obrigatório.**
- **Primeiro acesso:** página de instalação que só funciona com a chave gravada em
  `grscan-config.php` (fora do Git) e se desativa depois de criar o primeiro administrador.
- **Telas da Etapa A:**
  - **Preços:** escaneamentos, componentes, regiões, faixas de desconto e elegibilidade,
    disponibilidade de procedimentos e componentes, "sob avaliação". Salvar cria uma nova versão.
    O orçamento público passa a usar a versão nova na hora.
  - **Histórico de preços:** quem mudou, quando e o que mudou.
  - **Orçamentos recebidos:** lista e detalhe (somente leitura nesta etapa).
  - **Administradores:** criar, desativar e trocar senha.
- Toda ação administrativa vai para um registro de auditoria.

## 7. LGPD
- Coleta só o necessário para o orçamento; aviso de privacidade e aceite no envio.
- Dados pessoais só no servidor (banco fora do `public_html`); nada pessoal no navegador além do
  formulário em uso.
- Prazo de guarda e exclusão a pedido: funções no painel na Etapa B. O texto da política de
  privacidade continua pendente do dono do site.

## 8. Fora da Etapa A
Status e atendimentos (B); custos, componentes, indicadores, gráficos e relatórios (C); integração
com sistemas de gestão; mudança da origem do agendamento.

## 9. Pontos em aberto, com a decisão provisória do Claude
- **Origem do deslocamento:** o orçamento usa as regiões com taxa fixa (origem Barra da Tijuca). O
  agendamento com Google Agenda continua calculando a rota a partir de Xerém, até o dono confirmar
  a mudança.
- **Transfers e TiBases por paciente:** limitados ao número de implantes daquele paciente.
- **E-mail:** o orçamento continua sendo enviado para o endereço de `email-config.php`, agora com o
  número do orçamento e o detalhamento.

## 10. Testes e entrega
- Testes PHP (linha de comando) das regras de cálculo e da separação público/interno; testes
  Playwright do orçamento no celular e no computador, do login com segundo fator e da edição de
  preços refletindo no público; regressão atual sem falhas.
- Verificar que `precos-publicos.php` e o HTML público não contêm nenhum campo interno.
- Deploy como versão 2.1, com instruções de primeiro acesso.
