# Registro de alterações — GR Scan

## 2.1 — 18/11/2026 — Orçamento automático e painel
Etapa A do sistema de orçamentos e gestão (desenho em `docs/superpowers/specs/2026-11-18-orcamento-e-gestao-design.md`).

### Orçamento automático (site)
- "Solicitar orçamento" passa a montar o orçamento com preços: região, pacientes, procedimento de cada
  um, implantes, transfers digitais e TiBases (sempre opcionais), desconto por volume, deslocamento uma
  vez por visita e total recalculado na hora. Itens sob avaliação mostram subtotal e aviso de confirmação.
- Envio para a GR Scan com número do orçamento (GRS-AAAA-NNNNN) e e-mail com o detalhamento;
  compartilhamento pelo WhatsApp. O odontograma e os dados de contato continuam no formulário.
- O servidor recalcula tudo com a tabela vigente e guarda a cópia da tabela aplicada em cada orçamento.
- Preços vêm de `precos-publicos.php`, que devolve só campos comerciais.

- Oferta "Deslocamento grátis" com prazo real: aberta e encerrada pelo painel (1 a 24 h ou até data/hora);
  no orçamento, faixa dourada com contagem regressiva pela hora do servidor e a taxa riscada com "GRÁTIS".
  O servidor aplica a oferta de verdade e registra no orçamento; ao terminar, tudo volta ao normal sozinho.

### Painel administrativo (`/admin/`)
- Login com senha e código do aplicativo autenticador (obrigatório), bloqueio após tentativas erradas,
  proteção CSRF, sessão com expiração por inatividade e código de uso único.
- Editor de preços com versões e histórico (quem, quando, o que mudou); vale na hora no site.
- Lista e detalhe dos orçamentos recebidos; cadastro de administradores; registro de auditoria.
- Dados em SQLite fora do `public_html` (`grscan-dados/`); `app/`, testes e bancos bloqueados na web.

### Mudanças de comportamento
- O formulário antigo de orçamento (tipos de trabalho em chips, arcadas, prazo, frequência,
  laboratório, formato) foi substituído; laboratório e formato podem ir nas observações.
- A planilha `orcamentos-grscan.csv` deixa de ser gravada: os orçamentos ficam no banco.


## 2.0 — 10/11/2026 — Linha de Precisão
Etapa 3, primeira entrega: estrutura, navegação, hierarquia, tipografia e organização das seções
na direção "Linha de Precisão". Animações 3D avançadas ficam para a próxima etapa.

### Preservado sem mudança de comportamento
- Formulários de agendamento e orçamento: mesmos campos (`name`), mesmos IDs e mesmo envio para os PHP.
- Três modos de agendamento (horários fixos, Google Agenda com deslocamento, página de reservas do Google).
- Odontograma FDI, links diretos `#agendar` e `#orcamento`, bloco `CONFIG` do `script.js`.
- Mapa de cobertura (municípios do `municipios.geojson`) e os dois modelos 3D de escaneamentos reais.
- Todos os arquivos PHP (nenhuma alteração).

### Estrutura e conteúdo
- Cabeçalho com navegação por seções, menu no celular e indicação da seção atual.
- Hero reorganizado: título, proposta de valor e os dois CTAs aparecem na primeira tela do celular.
- Faixa "Fale com a gente agora para:" (não clicável) substituída por um resumo factual do serviço.
- Nova seção "Como funciona" em 4 passos, usando apenas informações já presentes no site.
- "Como atuamos" virou "Fluxo digital na sua clínica, sem comprar equipamento".
- Seção de agendamento com dois acessos lado a lado: agendar e solicitar orçamento.
- Rodapé com navegação. Aviso sobre o uso dos dados nos dois formulários.
- Sem WhatsApp configurado, os botões "Entrar em contato" passam a dizer "Solicitar orçamento"
  e abrem esse formulário (antes abriam o agendamento com ícone de WhatsApp). Com o número em
  `CONFIG.whatsapp`, voltam a abrir o WhatsApp.

### Visual
- Novo sistema de estilos em camadas (`@layer`), tokens de cor, escala tipográfica 1,25 e corpo mínimo de 16 px.
- Títulos sem caixa alta; cantos inspirados no logotipo (superior direito e inferior esquerdo).
- Removidos: brilho infinito nos botões, anéis orbitais, logo gigante ao fundo, linhas de gráfico decorativas,
  quadro com o logo em Aplicações e pulsação do botão de agenda.
- Ilustrações do bento grid passam a animar uma vez ao aparecer.
- Verde-água reservado para a luz de captura do scanner.

### Desempenho
- Leaflet e decodificador Draco servidos pelo próprio site (`assets/vendor/`).
- Mapa e cena Three.js carregam só quando se aproximam da tela.
- Logo do FAQ em WebP redimensionado (88 KB → 18 KB).
- Cache do navegador e versão nos arquivos CSS/JS.

### SEO, acessibilidade e segurança
- `canonical`, Open Graph completo com imagem absoluta, JSON-LD `ProfessionalService` e `FAQPage`.
- `robots.txt` e `sitemap.xml`.
- Link "Pular para o conteúdo", foco visível em todos os controles, rótulos nos grupos de opções,
  alvos de toque de 44 px ou mais.
- `.htaccess`: bloqueio de `.md` (o README estava público), cabeçalhos de segurança e tipos MIME.

### Testes
- `tests/regressao.js`: 50 verificações funcionais e responsivas (Playwright). PHP interceptado, sem e-mail real.
