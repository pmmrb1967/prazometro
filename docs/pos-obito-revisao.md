# Pós-óbito: pontos para a revisão jurídica

O módulo está aberto a todos em https://app.prazometro.workers.dev/pos-obito, com o aviso
"Em desenvolvimento" em todas as páginas, até esta revisão estar feita.

Todas as regras (`rules/pos-obito/`) e cartas (`templates/pos-obito/`) estão com
`estado: "a_rever"`. Os textos dos passos estão em `apps/web/src/modules/pos-obito/steps.ts`.

## Regras: pesquisa de 14/11/2026

Em 14/11/2026, os seis prazos foram confirmados por pesquisa do Claude (assistente de IA da
Anthropic) nas leis consolidadas do Diário da República e nos sites oficiais. As fontes, com
ligação, estão em cada regra e aparecem na app em «De onde vêm estas datas». Falta a revisão
por um jurista.

| Regra                       | Prazo na app                                                   | Resultado da pesquisa                                                                                                                                                                                                                                      |
| --------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declaracao-obito`          | 2 dias a contar do óbito                                       | Código do Registo Civil, art. 192.º, n.º 1: 48 horas, em qualquer conservatória (contadas da morte, do achamento do corpo, da autópsia ou da sua dispensa).                                                                                                |
| `reembolso-funeral`         | 90 dias a contar do registo do óbito (ou do óbito, se faltar)  | DL 322/90 em vigor e Guia Prático da Segurança Social (2025): 90 dias seguidos a contar do registo. O gov.pt ainda conta da morte (redação do DL 133/2012). Não se acumula com o subsídio por morte; vai para quem provar que pagou o funeral (art. 54.º). |
| `subsidio-morte`            | 180 dias a contar do registo do óbito (ou do óbito, se faltar) | DL 322/90, art. 48.º, n.º 2, e gov.pt: 180 dias a contar do registo. CGA: também 180 dias a contar do registo para óbitos depois de 30-09-2019 (1 ano antes disso).                                                                                        |
| `pensao-sobrevivencia`      | 6 meses a contar do óbito                                      | DL 322/90, art. 36.º, n.º 1: «seis meses imediatos ao evento» (a morte). Pode pedir-se a todo o tempo (art. 48.º, n.º 1), mas depois só é paga desde o pedido. CGA: 180 dias a contar da morte (regime desde 2006).                                        |
| `participacao-imposto-selo` | Fim do 3.º mês seguinte ao óbito; domingo ou feriado passa     | CIS, art. 26.º. O Código Civil (art. 279.º, e)) só fala em domingo e feriado, mas as Finanças passam os prazos de sábado para o dia útil seguinte (exemplo no Portal das Finanças) e o STA decide no mesmo sentido. A app mantém a data mais cedo.         |
| `aceitacao-heranca`         | 10 anos a contar do óbito                                      | Código Civil, art. 2059.º, n.º 1: dez anos desde que o sucessível tem conhecimento de ter sido chamado (texto citado no Acórdão do TC n.º 541/2004). A app conta do óbito, a data mais cedo.                                                               |

Pontos que ainda pedem um jurista:

- Confirmar a versão em vigor dos arts. 48.º e 54.º do DL 322/90 (contagem a partir do registo), porque o gov.pt do reembolso ainda conta da morte.
- Decidir se a participação do Imposto do Selo deve transitar ao sábado (a app não transita, por prudência).
- Decidir se a app deve ter regras próprias para a CGA (subsídio por morte e pensão de sobrevivência) em vez de notas.

Quando a data do registo não é indicada, a app conta os prazos a partir da data do óbito, que dá
sempre a data mais cedo.

## Textos sem fonte oficial direta

- Pedido ao Banco de Portugal da lista de contas do falecido: só confirmado por fontes secundárias.
- Lista de seguros de vida pedida à ASF: confirmado pelo Decreto-Lei n.º 384/2007 e por fontes secundárias.
- Responsabilidade pelas dívidas até ao valor da herança (Código Civil, art. 2071.º).
- Custo da habilitação de herdeiros no Balcão das Heranças: 425 euros de base, segundo o gov.pt.
- Não incluído: o IRS do ano do óbito, o testamento e os veículos (por falta de fonte oficial verificada).

## Cartas

- `comunicacao-banco`: pede a lista de produtos e os saldos à data do óbito.
- `comunicacao-seguradora`: pede a lista de seguros e os documentos para participar o sinistro.
- `cancelamento-contrato`: pede a cessação ou a mudança de titular. Não afirma direito a cessar sem encargos, porque não foi encontrada fonte.
