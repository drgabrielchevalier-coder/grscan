# Link de convite para prospecção pelo WhatsApp — desenho curto
**Status:** aprovado pelo dono do site em 18/11/2026.

## Por quê
Prospectar dentistas que já conhecem o dono da GR Scan, por mensagem pessoal no WhatsApp, com um link
que chame atenção na conversa e leve direto ao orçamento com valores na hora.

## Abordagens
- **A. Endereço próprio de convite com prévia própria (escolhida pelo dono).**
- B. Só melhorar o link do site: prévia igual para todo compartilhamento e sem separar o que veio da prospecção.

## Desenho
- **Endereço:** `grscan.implantstore.com.br/convite/?r=<região>` (ex.: `?r=niteroi`). Sem a região, também funciona.
- **Prévia no WhatsApp** (metatags da página de convite):
  - imagem própria de 1200×630 em preto e dourado, com o logotipo e o texto
    "Escaneamento iTero no seu consultório · Veja o valor para a sua clínica";
  - título "Veja o valor do escaneamento iTero para a sua clínica";
  - descrição "Monte o orçamento em poucos toques. Arquivos STL/PLY direto para o seu laboratório."
- **Ao tocar:** a página de convite manda o dentista na mesma hora para o orçamento do site, já aberto, com a
  região escolhida e a faixa da oferta, se estiver aberta. Sem JavaScript, mostra um botão "Ver o valor".
- **Origem no painel:** orçamentos enviados a partir do convite ficam marcados como "convite" (selo na lista
  e no detalhe, com filtro), para medir a prospecção.
- **Sem dados pessoais no link:** nada de nome ou telefone na URL; a personalização fica na mensagem.
- **Entrega junto:** lista pronta dos links por região e as mensagens de WhatsApp já escritas.
- Versão 2.3.

## Decisões do Claude (podem ser corrigidas)
- O site guarda a origem "convite" só durante a visita (na aba do navegador) e a envia com o orçamento.
- O endereço do navegador é limpo depois de aplicar a região, para não confundir quem compartilhar a página.
- A imagem da prévia é gerada a partir de um HTML com a identidade do site (a mesma tipografia e o logotipo
  original); nenhuma foto de paciente.

## Fora de escopo
Envio em massa, encurtador de links externo, nome do dentista no link.
