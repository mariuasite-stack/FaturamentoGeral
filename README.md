# DRE Gerencial Consolidado · Mariuá

Painel de uma tela (notebook ou monitor) que mostra, em linguagem simples, o faturamento, os gastos e o lucro da Mariuá de janeiro a junho de 2025.

## O que aparece na tela
- **Frase do período:** resume em uma frase quanto entrou, quanto saiu e quanto sobrou. Ela traz também um alerta, uma comparação com o mês anterior ou o maior gasto, conforme o filtro.
- **Faturou − Impostos − Gastou → Sobrou:** os quatro números da conta, com o termo contábil pequeno ao lado.
- **Do faturamento ao lucro:** cascata mostrando para onde foi cada real faturado.
- **Faturamento × gastos por mês:** em cada mês, a barra verde (faturou) ao lado da laranja (impostos + gastos).
- **Onde gastamos:** custos e despesas agrupados por natureza (pessoal, combustível, manutenção…). Passando o mouse, aparecem as maiores contas de cada grupo.
- **Lucro por mês:** lucro ou prejuízo de cada mês, com a linha do EBITDA.

## Modo apresentação (4 telas)
O botão **Modo apresentação**, na frase do topo, divide o painel em 4 telas. Cada tela responde a uma pergunta:
1. **Resumo:** a frase do período, os 4 números e a cascata em tamanho grande.
2. **Faturamento** ("Estamos vendendo bem?"): faturamento por mês com a linha da média, os números principais e os impostos por tipo.
3. **Gastos** ("Por que sobrou pouco?"): faturamento × gastos, onde gastamos e o que mais mudou entre o primeiro e o último mês.
4. **Resultado** ("Para onde estamos indo?"): lucro e EBITDA por mês e os pontos de atenção do semestre.

Para navegar, use as abas, as setas ← → do teclado (ou o passador de slides) e Home/End. **Voltar ao painel único** (ou Esc) volta para a tela única. Os filtros funcionam nos dois modos, e as frases e os pontos de atenção são calculados a partir dos dados.

## Publicar no GitHub Pages
1. Suba para um repositório estes arquivos: `index.html`, a pasta `assets/` e este README.
2. No GitHub, vá em **Settings → Pages**, escolha **Deploy from a branch**, a branch `main` e a pasta `/ (root)`.
3. O painel fica em `https://<usuario>.github.io/<repositorio>/`.

Não tem etapa de build: é HTML, CSS e JavaScript puro. O ECharts 5.5.1 e a fonte Manrope vêm de CDN.

## Filtros
No painel: clique num mês para ver só ele, Shift+clique ou arraste para um intervalo, Ctrl+clique para adicionar ou remover um mês, **Semestre** volta ao total, e **Acumulado** soma desde janeiro.

Os filtros também funcionam pela URL:
- `?meses=JUN`
- `?meses=JAN-MAR`
- `?meses=JAN-ABR&visao=acumulado`
- `?modo=apresentacao&tela=3`: abre direto na tela 3 da apresentação
- `?animacao=off`: desliga os efeitos

O endereço é atualizado sozinho conforme você navega. Recarregar a página volta para o mesmo ponto.

## Dados
`assets/js/data.js` foi gerado a partir de `DRE_GERENCIAL_06-2025_CONSOLIDADO.xlsx`. A soma de cada mês foi conferida com a linha "Total Geral".
O EBITDA é recalculado a partir da DRE: resultado + depreciação − resultado financeiro + IR/CS. Em junho, a planilha original traz −1.394.826,97, valor com erro de fórmula já apontado no comentário da própria planilha; o painel mostra o valor correto, −1.151.484,60.
