# GR Scan 2.0 — Experiência interativa "Captura"
**Especificação de desenho** · versão 1 · 10/11/2026 · status: **aguardando aprovação**

> Documento de desenho. Não autoriza implementação, deploy ou publicação.
> Após aprovação, o próximo passo é o plano técnico (writing-plans); a implementação depende da aprovação desse plano.

---

## 1. Contexto e decisões já tomadas

| Decisão | Origem |
|---|---|
| Direção "Linha de Precisão": preto e dourado, Montserrat + Cinzel, cantos do logotipo (superior direito e inferior esquerdo), logotipo original intacto | Aprovada (Etapa 3) |
| Verde-água (`#3ff0de`) apenas como luz de captura do scanner | Aprovada |
| Celular: título, proposta de valor e CTAs visíveis na primeira tela | Aprovada e implementada |
| **Abordagem B — "Captura" (cinematográfica controlada)** | Aprovada conceitualmente |
| Barra de CTA fixa no celular | Aprovada |
| Jornada "Como funciona" horizontal e fixada no desktop | Aprovada |
| Preservar 100% das funcionalidades (agendamento, orçamento, odontograma, PHP, mapa, modelos 3D, formulários, `CONFIG`, acessibilidade, segurança) | Requisito permanente |

**Base técnica atual:** branch `claude/wonderful-brown-n36zeo` (commit `f33519e`), HTML/CSS/JS puro + PHP, Three.js r160 via import map, `<model-viewer>` no hero, Leaflet e Draco servidos localmente, suíte `tests/regressao.js` (50/50).

**Skills:** `frontend-design`, `gr-scan-brand-guidelines`, `copywriting`, `cro` e `webapp-testing` foram carregadas e aplicadas (ver §3 e §15). As skills `brainstorming` e `writing-plans` **não estão instaladas nesta sessão**; este documento segue o processo delas (alternativas → escolha → desenho formal → aprovação → plano), mas sem as instruções originais. Não há `CLAUDE.md` no repositório.

---

## 2. Achados técnicos que condicionam o desenho

Verificação feita em cópia temporária, sem alterar arquivos do projeto:

| Arquivo | Conteúdo | Implicação |
|---|---|---|
| `arcada-hero.glb` | Arcada inferior, cores por vértice + normais, ~295 KB | Usada no hero. **Escaneamento diferente** dos demais |
| `arcadas.glb` (não usado hoje) | Arcadas superior e inferior do **mesmo** escaneamento, com cor; paciente com aparelho ortodôntico | Exportadas na relação espacial registrada (distância mínima amostrada ≈ 0,06 mm) |
| `arcada-inferior.glb` | Arcada inferior; mesmas dimensões da inferior de `arcadas.glb` | Provavelmente o mesmo escaneamento (confirmar na implementação). Pode ser substituída por `arcadas.glb` |
| `scanner-branco.glb` | Scanner genérico, 7 partes | Sempre rotulado "representação ilustrativa" |

**Regras derivadas:**
1. Nunca combinar arcadas de escaneamentos diferentes na mesma cena.
2. A proximidade geométrica entre as arcadas **não é apresentada como validação clínica de contatos oclusais** (ver §8).
3. Todos os escaneamentos são material clínico de paciente; o uso depende de autorização (ver §12).

---

## 3. Aplicação da skill frontend-design

**Assunto, público e função da página:** serviço móvel de escaneamento intraoral iTero; dentistas e gestores de clínicas no RJ; transformar visitantes em agendamentos e pedidos de orçamento.

**Plano de tokens (mantém o sistema aprovado):**

| Papel | Token | Valor |
|---|---|---|
| Espaço | `--bg` | `#0a0907` |
| Superfície | `--panel` | `#15130f` |
| Texto | `--text` | `#efe9df` |
| Texto secundário | `--text-soft` | `#aba193` |
| Marca | `--gold-2` / `--gold-1` | `#d9a441` / `#fbe3a0` |
| Captura (apenas o que está sendo capturado) | `--scan` | `#3ff0de` |
| Tipografia de exibição e texto | Montserrat 400–700 | Títulos 600, sem caixa alta |
| Assinatura | Cinzel 500 | Somente "GR SCAN" |

**Conceito de layout:** uma página única costurada por um fio dourado, o **Fio de Captura**. Ele nasce no escaneamento do hero e percorre a página, conduzindo o visitante pela história de uma captura.

**Princípios aplicados:**
- **Uma única ousadia:** o Fio de Captura e a malha que se constrói. Todo o resto é silencioso: tipografia limpa, muito espaço livre, nenhum efeito ambiente.
- **Movimento só quando explica algo.** Cada animação responde a uma de três perguntas: o que é capturado, para onde vai, o que se faz com isso. Fora disso, só há movimento em resposta a uma ação do visitante (hover, foco, clique).
- **Estrutura é informação.** Numeração aparece somente onde a ordem importa: a jornada (01–04) e os capítulos da Tecnologia (1–4). Nada de rótulos em caixa alta acima de títulos, nada de cards idênticos com a mesma sombra e nada de gradientes como decoração.
- **Padrões genéricos recusados:** brilho girando em bordas, feixes de luz de fundo, partículas, cursor personalizado, rotação 3D de "container" e glitch.

---

## 4. Conceito narrativo: "O percurso de uma captura"

A página conta, em sequência, a vida de um escaneamento:
**capturar → levar até você → entregar o arquivo → o que o arquivo permite → como a captura funciona → por que contratar → onde atendemos → agendar.**

### 4.1 Nova ordem das seções
Os IDs e âncoras atuais são mantidos. Só muda a ordem no HTML.

| # | Seção (id) | Papel na narrativa |
|---|---|---|
| 1 | Hero | A captura acontece |
| 2 | Como funciona (`#como-funciona`) | O percurso até o arquivo |
| 3 | Aplicações (`#aplicacoes`) | O que o arquivo permite |
| 4 | Tecnologia (`#tecnologia`) | Por dentro da captura |
| 5 | Para a sua clínica (`#como-atuamos`, com `#por-que` incorporado) | Argumento comercial |
| 6 | Área de atendimento (`#atendimento`) | Onde |
| 7 | Agendar e orçamento (`#agendar`) | Ação |
| 8 | Dúvidas (`#faq`) e rodapé | Objeções |

Hoje "Para a sua clínica" e "Por que escolher" ficam entre Como funciona e Aplicações. Elas passam para depois da Tecnologia. Assim a experiência imersiva (seções 1–4) fica contínua e a parte comercial vem logo antes do mapa e do CTA.

### 4.2 O Fio de Captura (elemento de continuidade)
- **Forma:** traço de 1 px dourado (`--gold-2`, 70%), com uma "cabeça" curta em verde-água (16–24 px) **somente** no trecho que está sendo desenhado naquele momento.
- **Comportamento:** é desenhado pela rolagem (`stroke-dashoffset` ligado ao scroll). Parado, fica apenas o traço dourado.
- **Passagem entre seções:** cada seção tem seu próprio trecho de SVG. O ponto final de um trecho coincide, na tela, com o ponto inicial do próximo, o que dá a sensação de um fio contínuo sem um SVG gigante sobre a página.
- **Passagem do 3D para o 2D:** no fim do hero, a posição na tela da frente de captura 3D é projetada para coordenadas de tela. O trecho SVG da jornada nasce exatamente ali, enquanto a faixa 3D se apaga.
- **Celular:** o fio corre na vertical, na margem esquerda (x = 20 px).

---

## 5. Storyboard — desktop (≥ 1024 px)

Cada seção é descrita em três momentos: **entrada → transformação → conexão com a próxima**.

### 5.1 Hero — "A captura"
- **Entrada (0–2,4 s, automática e uma vez):**
  - H1, subtítulo e CTAs aparecem no primeiro quadro. O H1 é o maior elemento da página e não depende do 3D.
  - A malha real da arcada surge como pontos verde-água ao longo da curva da arcada, de molar a molar, e se solidifica nas cores reais do escaneamento.
  - Luz de estúdio quente; câmera em perspectiva 3/4 com aproximação lenta de 4°.
- **Transformação (seção fixada por ~120% da altura da tela, rolagem ligada à animação):**

| Progresso | Câmera | Malha | Texto e interface |
|---|---|---|---|
| 0–30% | 3/4 → vista oclusal | Completa | H1 e CTAs fixos à esquerda |
| 30–65% | Aproximação suave da região posterior | Faixa de captura percorre as superfícies (só material, sem mudar geometria) | Legenda discreta: "Captura intraoral" |
| 65–100% | Recuo; o modelo encolhe para o canto inferior esquerdo | Faixa 3D converge num ponto | H1 sobe e esmaece; "Como funciona" começa a entrar |

- **Conexão:** o ponto de captura vira a cabeça do Fio de Captura, que segue para a direita e se torna o trilho horizontal da jornada.
- **Sempre acessível:** "Agendar" no cabeçalho; o canvas aceita arrastar para girar, sem rotação automática contínua.

### 5.2 Como funciona — "O percurso" (jornada horizontal fixada)
- **Entrada:** o trilho dourado chega pela esquerda. O título "Como funciona" revela-se linha a linha por máscara.
- **Transformação:** a seção fica fixa por cerca de 300% da altura da tela. A rolagem vertical desloca 4 painéis na horizontal, e um **marcador** viaja na cabeça do fio, mudando de forma a cada etapa:

| Etapa | Marcador | Visual próprio do painel | Interação |
|---|---|---|---|
| 01 Agendamento | Quadrado de horário (canto do logotipo) | Grade de calendário em linhas finas; um horário acende quando o marcador passa | Botões reais "Agendar escaneamento" e "Solicitar orçamento" |
| 02 Atendimento na clínica | Ponto que percorre uma rota | Contornos reais da área atendida (`municipios.geojson`) em linha; a rota dourada é desenhada da base até um ponto genérico, sem endereço real | — |
| 03 Escaneamento digital | Pequena silhueta oclusal | Silhueta em linha da arcada (ver §12 para o caso sem autorização) com a faixa de captura passando | — |
| 04 Fluxo digital | Etiqueta "STL · PLY" | A etiqueta viaja do nó "Clínica" ao nó "Laboratório" (evolução do bloco atual "Direto para o laboratório") | — |

- **Controles:** 01–04 e Anterior/Próximo (ver §9).
- **Conexão:** a etiqueta chega ao "Laboratório"; o trilho dobra para baixo e entra em Aplicações.

### 5.3 Aplicações — "O que o arquivo permite"
- **Entrada:** o fio desce e **desenha o contorno de cada bloco do bento**, em sequência.
- **Transformação:** quando o contorno de um bloco se fecha, a ilustração dele roda uma vez (as atuais, refinadas). Ao passar o mouse ou focar, ela roda de novo. Não há loops.
- **Mensagem:** o mesmo arquivo atende cada aplicação clínica (texto atual mantido).
- **Conexão:** o fio sai do bloco "Fluxo CAD/CAM" (o do arquivo STL/PLY) e segue até a moldura do visualizador da Tecnologia, que se acende quando o fio fecha o contorno ("abrindo o arquivo").

### 5.4 Tecnologia — "Por dentro da captura" (scrollytelling)
- **Entrada:** o visualizador 3D fixo ocupa a metade esquerda. O fio desenha a moldura dele e a cena acende.
- **Transformação:** 4 capítulos à direita, cada um com cerca de 80% da altura da tela de rolagem. Detalhes em §8.
- **Conexão:** ao fim do capítulo 4, o visualizador se solta, o fio vira um divisor de seção e a página "descomprime": daqui em diante o movimento é mínimo.

### 5.5 Para a sua clínica (com "Por que escolher")
- **Entrada:** a tela do visualizador iTero é revelada por máscara na direção do canto do logotipo, com parallax de no máximo 24 px dentro da moldura.
- **Transformação:** os três diferenciais aparecem como faixa de três colunas (não cards idênticos). Inclinação de no máximo 4° só na foto do scanner, no desktop.
- **Conexão:** divisor dourado estático.

### 5.6 Área de atendimento
- **Entrada e transformação:** comportamento atual (desenho dos municípios ao entrar na tela), agora sincronizado com a rolagem até 60% da seção, depois fixo.
- **Conexão:** divisor estático.

### 5.7 Agendar e orçamento
- **Entrada:** os dois botões de entrada com o traço da borda percorrendo os cantos do logotipo uma vez.
- **Interação:** atração magnética leve (máx. 6 px) nos dois botões, só no desktop. Modais e formulários sem nenhuma mudança funcional.

### 5.8 Dúvidas e rodapé
- Accordion com animação de altura e rotação do indicador. `<details>` nativo é mantido.

### 5.9 Elementos globais
- **Cabeçalho:** barra de leitura de 1 px na base e indicador deslizante sob o item ativo do menu.
- **Botões:** traço que percorre a borda no hover; ao pressionar, encolhem para 98%.
- **Links "Pular animação":** cada seção fixada tem um link visível ao foco que leva à seção seguinte.

---

## 6. Storyboard — celular (< 768 px) e tablet (768–1023 px)

| Seção | Celular | Tablet |
|---|---|---|
| Hero | Título, subtítulo e 2 CTAs na primeira tela (sem mudança). Abaixo, o 3D faz só a entrada de 2,4 s, **sem fixação**. O fio nasce sob o modelo e desce pela margem esquerda | Igual ao celular, com o modelo ao lado do texto se couber |
| Como funciona | Coluna vertical: o fio desce pela margem, o marcador passa por 01→04 e cada painel entra quando o fio chega | Coluna vertical (a jornada horizontal é exclusiva de ≥ 1024 px) |
| Aplicações | Blocos empilhados; o fio desenha só a borda esquerda de cada bloco | Grade de 2 colunas; o fio contorna o bloco inteiro |
| Tecnologia | Visualizador fixo no topo (~40% da altura da tela, `svh`); capítulos rolam por baixo; controles compactos sob o visualizador | Visualizador fixo à esquerda, 45% da largura |
| Demais seções | Como hoje, com revelações discretas | Idem |
| Barra de CTA | Aparece depois do hero: "Agendar" + "Orçamento", dentro da área segura. Some quando a seção de agendamento ou o rodapé estão visíveis, ou quando um modal ou o menu estão abertos | Não aparece (o "Agendar" do cabeçalho basta) |

---

## 7. Hero — especificação do efeito de captura

- **Parametrização (em memória, sem alterar o arquivo):** ao carregar, calcula-se para cada vértice um valor `s` de 0 a 1 ao longo da curva da arcada, a partir do ângulo em torno do centro da arcada no plano oclusal. As posições dos vértices não mudam.
- **Material:** `MeshStandardMaterial` com cores por vértice, estendido por `onBeforeCompile`:
  - vértices com `s` atrás da frente de captura: material final;
  - na faixa da frente: emissão verde-água, mais uma camada de pontos (`THREE.Points` sobre a mesma geometria);
  - à frente: invisíveis.
- **Câmera:** uma única curva de câmera interpolada, controlada pelo progresso da rolagem, com suavização de 0,6 s.
- **Renderização:** só quando a cena está visível e algo mudou. Resolução máxima de 2× no desktop e 1,5× no celular.

---

## 8. Tecnologia — capítulos e regras de geometria

### 8.1 Regras invioláveis
1. As posições dos vértices dos escaneamentos nunca são alteradas: sem deformar, sem escalar só um eixo, sem morph.
2. **A transformação relativa entre as arcadas superior e inferior é sempre a original do arquivo.** As duas fazem parte de um único grupo; câmera, rotação do grupo inteiro, visibilidade e material podem mudar, mas a posição de uma em relação à outra nunca muda. A arcada superior **não desce nem se afasta**: ela é revelada no lugar.
3. Não há mapa de contatos, cores por proximidade, medidas em milímetros nem setas de "contato". A legenda diz: **"Posição relativa das arcadas como registrada no escaneamento. Ilustração do registro de mordida; não representa análise de contatos oclusais."**
4. Não se combinam arcadas de escaneamentos diferentes.
5. Legenda permanente: **"Escaneamentos reais (com autorização). Scanner em representação ilustrativa."** Sem autorização, valem as regras de §12.

### 8.2 Capítulos

| # | Título (texto já aprovado) | Cena (sempre `arcadas.glb`, mesmo escaneamento) | Câmera |
|---|---|---|---|
| 1 | Captura intraoral | Arcada inferior; scanner ilustrativo sobre ela; a frente de captura percorre a arcada (mesmo efeito do hero) | 3/4 posterior |
| 2 | Visualização 3D em tempo real | Arcada inferior completa; o visitante pode girar | Órbita lenta ligada à rolagem; arrastar suspende a órbita |
| 3 | Registro de mordida e arcadas completas | A arcada superior é **revelada no lugar** pela mesma frente de captura; botão "Mostrar/ocultar arcada superior" (só visibilidade) | Vista lateral, depois frontal |
| 4 | Arquivos STL e PLY | Alterna entre **PLY** (cores reais por vértice) e **STL** (material monocromático); a geometria é a mesma, só muda o material | Vista oclusal superior |

O texto do capítulo 4 explica o ponto técnico real: STL guarda geometria sem cor; PLY pode guardar cor. A ideia já está aprovada ("Arquivos STL/PLY compatíveis…"); a formulação final passa por revisão sua.

---

## 9. Controles de navegação (sem depender só da rolagem)

**Princípio:** a rolagem continua sendo a fonte da verdade. Os controles levam a página até a posição de rolagem do capítulo ou etapa. Assim o 3D, o texto e o fio ficam sempre sincronizados.

| Controle | Onde | Comportamento | Acessibilidade |
|---|---|---|---|
| Capítulos 1–4 | Abaixo do visualizador da Tecnologia | Botões com indicador deslizante; clique leva ao capítulo | `<nav aria-label="Capítulos">`, botões com `aria-current="step"`; setas ← → movem entre botões (foco itinerante); Enter/Espaço ativa |
| Anterior / Próximo | Tecnologia e jornada | Avança ou volta um capítulo/etapa | Rótulos completos ("Próximo capítulo: Registro de mordida"); desabilitados nas pontas |
| Etapas 01–04 | Jornada (desktop) | Leva ao painel | Igual aos capítulos; com o foco dentro de um painel, a página rola até ele |
| Pular animação | Início de cada seção fixada | Leva à seção seguinte | Visível ao receber foco |
| Movimento: completo / reduzido | Rodapé e menu | Liga ou desliga a camada animada; por padrão segue a preferência do sistema; fica salvo no navegador (com tratamento de erro) | `role="switch"` com `aria-checked` |
| Girar modelo | Canvas do hero e da Tecnologia | Arrastar; com o canvas em foco, setas giram 15° por toque; botão "Restaurar vista" | Canvas focável com contorno visível; texto alternativo por capítulo |

**Leitores de tela:** cada capítulo e cada etapa é conteúdo real no HTML (título e texto), na ordem natural. O canvas é decorativo (`aria-hidden`), e o texto ao lado conta o que a cena mostra. Mudanças feitas pelos controles anunciam só o título do novo capítulo, uma vez (`aria-live="polite"`).

**Movimento reduzido (sistema ou chave):** nenhuma seção é fixada; o fio aparece completo; o 3D mostra o estado final de cada capítulo sem transição; os controles trocam o estado na hora; a jornada fica vertical.

---

## 10. Sistema de movimento

| Item | Valor |
|---|---|
| Durações | 200 ms (microinterações), 400 ms (componentes), 800 ms (revelações) |
| Curva de aceleração | `cubic-bezier(.16, 1, .3, 1)` para tudo (já está no CSS) |
| Suavização das animações de rolagem | 0,6 s |
| Propriedades animadas no DOM | Somente `transform`, `opacity`, `clip-path` e `stroke-dashoffset` |
| Loops | Nenhum loop infinito. Exceção: a faixa de captura do hero enquanto a seção está fixada e em movimento, que para quando a rolagem para |
| Parallax | No máximo 24 px, só em imagens dentro de molduras |
| Atração magnética | No máximo 6 px, só com dispositivo apontador |
| Inclinação 3D de card | No máximo 4°, só com dispositivo apontador |

---

## 11. Componentes da 21st.dev

Pesquisa feita pelo MCP 21st.dev. Os componentes são **padrões de referência**: serão reescritos em HTML/CSS/JS puros, sem React, sem Framer Motion e sem baixar código pago.

### 11.1 Adaptados

| Necessidade | Referência 21st.dev | O que aproveitamos | O que muda para a GR Scan |
|---|---|---|---|
| Jornada horizontal | Horizontal Scroll Gallery (pulkitxm); Scroll Horizontal Gallery (motiondotdev) | Seção fixa + trilho deslocado pela rolagem | Marcador que muda de forma; fio contínuo; controles 01–04 |
| Fio de Captura | Line Draw SVG (pulkitxm); Tracing Beam (manuarora700); Svg follow scroll (reuno-ui) | Traço desenhado pela rolagem | Sem gradiente brilhante; cabeça de captura verde-água; passagem 3D→SVG |
| Tecnologia | Sticky Scroll Reveal (manuarora700); Scroll 01 (felipemenezes098) | Mídia fixa + texto rolando | Cena 3D real; capítulos com controles |
| Controles de capítulo e menu | Animated Tabs (educalvolpz); Segmented Tabs (micka_design) | Indicador deslizante e navegação por teclado | Indicador com canto do logotipo |
| Anterior / Próximo e progresso | Onboarding Steps Carousel (cnippet-dev); Reshaped Progress indicator | Botões de passo + indicador | Ligados à posição de rolagem |
| Revelação de imagens | Mask Reveal (balick) | Máscara com `clip-path` ao entrar na tela | Máscara no formato dos cantos do logotipo |
| Títulos | Text Reveal (Mask) (soralabs) | Linhas sobem por trás de uma máscara | Só títulos de seção; o H1 aparece desde o primeiro quadro |
| Botões | Border-Trace Button (purnavu-12); Dot Border Button (mengto) | Traço percorrendo a borda no hover | O traço segue os cantos do logotipo e para no fim (sem loop) |
| CTAs | Magnetic Button (mohammadshehadeh) | Atração ao cursor com mola, respeitando movimento reduzido | Máx. 6 px; só agendar e orçar |
| Cards | Optimized Tilt Card (sh20raj) | Inclinação com reflexo, desempenho otimizado | Máx. 4°; desligado em telas de toque |
| Progresso de leitura | Progress Indicator (su2491251) | Barra fixa no topo | 1 px dourado na base do cabeçalho |

### 11.2 Recusados
Container Scroll Animation, Beams Background, Shader Hero, Hover Border Gradient (brilho girando sem parar), SVG Mask Effect (revelação por cursor, um truque), Floating Card Gallery (partículas), 3D Stacked Website Cards e Circular Split Roll. Motivo: decorativos, reconhecíveis como template ou com loops infinitos, contrários aos princípios de §3.

---

## 12. Conteúdo clínico e autorização de uso

**Inventário atual (status da autorização: desconhecido):**

| Arquivo | Tipo de conteúdo | Já está em produção? |
|---|---|---|
| `arcada-hero.glb`, `arcadas-poster.png` | Escaneamento intraoral de paciente | Sim |
| `arcadas.glb`, `arcada-inferior.glb` | Escaneamento intraoral de paciente (aparelho ortodôntico visível) | `arcada-inferior.glb` sim |
| `itero-visualizador.webp` | Captura de tela com escaneamento de paciente | Sim |
| `scanner-mao.webp` | Foto de mão de pessoa | Sim |

Escaneamentos intraorais associáveis a uma pessoa são dado de saúde. **O uso depende de autorização documentada do paciente ou do titular.** A orientação jurídica fica com a GR Scan. O site atual já usa parte desse material; recomendo confirmar isso independentemente desta etapa.

**Mecanismo:** uma chave no `CONFIG`, `conteudoClinico: "autorizado" | "substituto"`. Por padrão, **"substituto"** até haver confirmação por escrito.

**Conteúdo substituto, em ordem de preferência:**
1. **Escaneamento de modelo de treino (manequim odontológico / typodont)** feito pela GR Scan com o próprio iTero e exportado em STL/PLY. É um escaneamento real sem paciente, e mantém toda a experiência 3D. **Material a fornecer.** Eu converto para GLB com Draco.
2. **Enquanto o item 1 não existir:** representação **em linhas** (SVG e traço 3D estilizado) da curva da arcada, sem anatomia detalhada, rotulada "Ilustração". O efeito de captura e o fio funcionam iguais. O capítulo 3 da Tecnologia vira um diagrama de duas curvas e o capítulo 4 mostra só a diferença STL × PLY em texto e diagrama.
3. **Tela do visualizador iTero:** usar uma captura feita com o escaneamento do manequim; sem ela, a moldura mostra o diagrama em linhas.
4. **Foto da mão:** manter só com confirmação de direito de imagem; sem ela, usar uma ilustração do scanner em linhas.

Em nenhum modo aparece geometria inventada apresentada como escaneamento real.

---

## 13. Níveis de experiência e alternativas

| Nível | Quando | O que o visitante vê |
|---|---|---|
| Completo | WebGL2 disponível, sem economia de dados, `deviceMemory` ≥ 4 (quando informado) e movimento completo | Tudo descrito acima |
| Estático | Sem WebGL, economia de dados ativa, pouca memória, falha no carregamento do 3D, ou `CONFIG.experiencia = "estatica"` | Imagens geradas a partir dos modelos (ou do substituto) por estado e capítulo; fio, revelações e controles funcionando |
| Reduzido | `prefers-reduced-motion` ou chave de movimento | Estados finais, sem fixação nem transições; jornada vertical |

Em todos os níveis o conteúdo completo existe no HTML e funciona sem JavaScript.

---

## 14. Tecnologias

| Tecnologia | Papel | Observação |
|---|---|---|
| Three.js r160 (já no projeto) | Um único renderizador WebGL, que passa do hero para a Tecnologia | **Substitui o `<model-viewer>`** e elimina a cópia duplicada do Three.js |
| GSAP core + ScrollTrigger (+ SplitText para títulos) | Fixações, animações ligadas à rolagem, linha do tempo única para DOM e câmera | Servidos pelo site, versão fixa. Licença gratuita da GSAP para uso comercial; termos e versão conferidos na implementação |
| Animações CSS guiadas por rolagem | Barra de leitura e revelações simples | O IntersectionObserver assume onde não houver suporte |
| IntersectionObserver | Carregamento sob demanda e troca de cena | Já em uso |
| Rolagem nativa | Página inteira | Sem rolagem "suavizada" (Lenis/ScrollSmoother) |
| Não usar | React, Framer Motion, bibliotecas de partículas | — |

**Novos arquivos previstos** (detalhados no plano técnico): `assets/experiencia/diretor.js`, `cena.js`, `captura.js`, `fio.js`, `jornada.js`, `capitulos.js`, `cta-movel.js`, `micro.js`, `assets/vendor/gsap/`, mais as imagens do nível estático.

---

## 15. Metas de desempenho (a verificar nos testes, não garantias)

Valores-alvo medidos nos testes; o relatório de validação mostrará o valor obtido em cada um. Se alguma meta não for atingida, aplicam-se as reduções listadas ao lado, nesta ordem, e o resultado é reportado.

| Meta | Como medir | Se não for atingida |
|---|---|---|
| Maior elemento visível ≤ 2,5 s em celular simulado (4G lento, CPU 4×) | Playwright + PerformanceObserver | Adiar ainda mais o 3D; reduzir o peso de fontes |
| Deslocamento de layout ≤ 0,05 durante carregamento e rolagem | PerformanceObserver de `layout-shift` com rolagem automática | Reservar espaço para os elementos que se movem |
| Resposta a cliques ≤ 200 ms | Event Timing API nos botões e controles | Dividir tarefas longas; mover o processamento do Draco para fora da thread principal (já ocorre) |
| ~60 fps no desktop e ≥ 30 fps em celular intermediário durante a rolagem do hero e da Tecnologia | Amostragem de `requestAnimationFrame` com CPU desacelerada | Resolução 1×; desligar a camada de pontos; nível estático em tablets |
| JavaScript novo ≤ ~70 KB compactado (sem o 3D) | Soma dos arquivos novos | Remover SplitText; simplificar módulos |
| 3D carregado só depois que a página aparece; o da Tecnologia, só ao se aproximar | Linha do tempo de rede | — |

---

## 16. Preservação funcional e testes

**Não mudam:**
- `name`, `id` e `data-*` de formulários e modais;
- os PHP;
- os links `#agendar` e `#orcamento`;
- os 3 modos de agendamento;
- o odontograma;
- o mapa (dados e comportamento);
- o `.htaccess`;
- o bloco `CONFIG`, que só ganha `experiencia` e `conteudoClinico`.

**Testes (webapp-testing):**
- Os 50 atuais (`tests/regressao.js`), ajustados apenas à nova ordem das seções.
- Novos:
  1. três níveis de experiência, incluindo Chromium com WebGL desligado;
  2. movimento reduzido (sistema e chave);
  3. teclado atravessando a jornada e os capítulos, com foco sempre visível e nunca escondido sob seções fixadas;
  4. controles de capítulo e etapa levando ao estado certo;
  5. barra de CTA no celular aparecendo e sumindo nos momentos certos e sem cobrir conteúdo;
  6. metas de §15;
  7. axe-core sem violações;
  8. regra de geometria: a transformação relativa entre as arcadas é idêntica à original em todos os capítulos;
  9. modo substituto sem nenhum arquivo clínico carregado.
- **Processo:** branch novo a partir de `claude/wonderful-brown-n36zeo` → prévia → homologação → produção somente com autorização.

---

## 17. Riscos, pendências e fora de escopo

**Riscos:**
- Seções fixadas no Safari iOS (variações de altura da tela) → usar `svh`/`lvh`; no celular, só a Tecnologia fica fixada.
- Uso de GPU em aparelhos fracos → níveis de experiência e reduções de §15.
- A experiência no modo substituto será menos impactante até o escaneamento do manequim existir.

**Pendências com a GR Scan:**
- Autorização de uso dos escaneamentos e imagens (§12).
- Escaneamento de um manequim, se possível.
- Opção do H1 (A, B ou C).
- Afirmações aguardando confirmação.
- Contatos e política de privacidade.
- Revisão do texto do capítulo 4.

**Fora de escopo:** novos serviços, preços, depoimentos e alterações nos PHP.

---

## 18. Critérios de aceite do desenho
1. As seções 1–4 formam uma sequência contínua ligada pelo Fio de Captura, sem animações soltas.
2. Toda animação responde a "o que é capturado", "para onde vai" ou "o que se faz com isso", ou responde a uma ação do visitante.
3. Geometria e relação entre as arcadas idênticas às originais; nenhuma afirmação sobre contatos oclusais.
4. Capítulos e etapas navegáveis sem rolagem, por mouse, toque e teclado.
5. Funcionalidades preservadas e verificadas por teste.
6. Nenhum material de paciente publicado sem autorização; existe um modo substituto.
7. Metas de desempenho medidas e reportadas.
