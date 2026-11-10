# Barra de versão do deploy — desenho curto
**Status:** aprovado pelo dono do site em 10/11/2026.

## Por quê
Ter controle das atualizações: a cada deploy, conferir no site ao vivo se a versão nova
realmente subiu (inclusive no deploy manual por `.zip`, que troca só os arquivos alterados).

## Abordagens consideradas
- **A. Barra só para a equipe, aberta com `?versao` no endereço** — escolhida: dá o controle sem
  mostrar "versão 2.3" aos visitantes (dentistas e clínicas).
- B. Versão discreta no rodapé, pública — mais simples, mas expõe um dado interno.
- C. Aviso temporário "site atualizado" para todos — é comunicação de novidade, não controle.

## Desenho
- Ao abrir `https://grscan.implantstore.com.br/?versao` aparece uma barra fixa no topo:
  `● Versão 2.1 · publicada em 12/11/2026 · "Correção do mapa"` e, abaixo,
  `página 2.1 ✓  estilos 2.1 ✓  scripts 2.1 ✓  [fechar]`.
- Se algum dos três arquivos estiver em outra versão (ou sem versão), a barra fica vermelha:
  `estilos 2.0 ✗ — deploy incompleto`.
- Sem `?versao`, nada aparece e nada muda para o visitante.
- A versão fica gravada em `index.html` (versão, data e resumo), `styles.css` e `script.js`.
- **Contagem:** cada deploy soma 0,1 (2.0 → 2.1 → … → 2.9 → 2.10). 3.0 só para mudança grande,
  por decisão do dono do site.
- **Responsável:** o Claude sobe o número nos três arquivos e registra a versão no `CHANGELOG.md`
  em todo pacote `.zip` ou commit de produção.
- **Ponto de partida:** entra junto com a v2.0 (PR #1). O site antigo não tem a barra; quando a
  v2.0 subir, ver "2.0" na barra confirma o deploy.

## Decisões do Claude (podem ser corrigidas)
- O código da barra fica **dentro do `index.html`** (o único arquivo que o navegador nunca guarda
  em cache), com estilos próprios, para funcionar mesmo quando `styles.css` ou `script.js` forem
  de outra versão — que é justamente o caso que a barra precisa denunciar.
- Os `?v=` de `styles.css` e `script.js` passam a ser iguais à versão (`?v=2.0`), para o navegador
  baixar os arquivos novos a cada deploy.
- Não aparece o número do commit: um arquivo não consegue conter o identificador do próprio commit.
- A regra de contagem entra no `CLAUDE.md`, para valer em todas as sessões futuras.
- Um teste confere, antes de cada deploy, que os três arquivos e o `CHANGELOG.md` têm a mesma versão.

## Fora de escopo
Mostrar versões a visitantes, histórico de versões na barra, aviso automático por e-mail.
