# GR Scan — instruções para o Claude

Site institucional da GR Scan (escaneamento intraoral iTero no Rio de Janeiro e região).
HTML/CSS/JS puro + PHP na Hostinger. Responda sempre em português do Brasil.

## Como trabalhar em qualquer pedido novo (obrigatório)

Antes de criar ou mudar algo no site (seção, componente, formulário, integração,
texto, visual), siga este fluxo. Pedidos pequenos e totalmente claros
(ex.: "troque esta cor", "corrija este texto") podem ser feitos direto, dizendo o que foi feito.

1. **Carregar as skills de processo** no início da sessão, lendo a saída inteira:
   ```bash
   npx -y skills use "https://github.com/obra/superpowers" --skill "brainstorming" > /tmp/brainstorming.txt 2>&1 < /dev/null
   npx -y skills use "https://github.com/obra/superpowers" --skill "writing-plans" > /tmp/writing-plans.txt 2>&1 < /dev/null
   ```
   Se não for possível carregar, siga os passos abaixo mesmo assim.
2. **Entender (brainstorming):** primeiro ler o projeto; depois perguntar uma coisa
   por vez, só o que muda o que será construído, começando pelo porquê.
3. **Caminhos:** apresentar 2–3 formas de fazer, com prós e contras, e recomendar uma.
   O usuário escolhe.
4. **Desenho:** escrever um desenho curto (ou completo, se for um projeto) em
   `docs/superpowers/specs/AAAA-MM-DD-<assunto>-design.md` e **esperar a aprovação**.
   Nada é construído antes disso.
5. **Plano (writing-plans):** transformar o desenho aprovado em plano passo a passo em
   `docs/superpowers/plans/AAAA-MM-DD-<assunto>.md` e mandar para revisão.
6. **Execução:** o próprio Claude executa o plano nesta sessão (não usar as skills
   `executing-plans` nem `subagent-driven-development`), testando cada etapa
   (Playwright para o visual, servidor PHP local para os formulários) e com um commit por etapa.

## Entrega

- Desenvolver e enviar no branch indicado pela sessão.
- O site em produção fica em outra conta da Hostinger que o Claude não acessa:
  ao terminar, gerar um `.zip` só com os arquivos alterados e dizer onde substituir
  (`public_html` do site grscan.implantstore.com.br).
- **Versão de cada deploy:** todo deploy (pacote `.zip` ou commit no branch de produção) sobe a
  versão em 0,1 (2.0 → 2.1 → … → 2.9 → 2.10; 3.0 só por decisão do dono do site) em `index.html`
  (meta `grscan-versao` + `data-data` + `data-resumo`), `styles.css` (`--grscan-versao`),
  `script.js` (`GRSCAN_VERSAO`), nos `?v=` e no `CHANGELOG.md`. Depois de publicar, conferir em
  `/?versao` (barra verde = os três arquivos na mesma versão).
- Nunca gravar chaves, senhas ou o `.json` da conta de serviço no repositório.
- Escaneamentos de pacientes: publicar sem nome/número do caso e lembrar da autorização (LGPD).
