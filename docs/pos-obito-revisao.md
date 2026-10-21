# Pós-óbito: pontos para a revisão jurídica

O módulo está aberto a todos em https://app.prazometro.workers.dev/pos-obito, com o aviso
"Em desenvolvimento" em todas as páginas, até esta revisão estar feita.

Todas as regras (`rules/pos-obito/`) e cartas (`templates/pos-obito/`) estão com
`estado: "a_rever"`. Os textos dos passos estão em `apps/web/src/modules/pos-obito/steps.ts`.

## Regras e divergências entre fontes

| Regra                       | Prazo na app                                                                        | Ponto a confirmar                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `declaracao-obito`          | 2 dias a contar do óbito                                                            | A lei fala em 48 horas; falta indicar o artigo do Código do Registo Civil                                                                                 |
| `reembolso-funeral`         | 90 dias a contar do registo do óbito                                                | Um folheto de 2013 conta da morte, e o formulário atual (RP 5076) conta do registo. Quando se aplica o reembolso e quando se aplica o subsídio por morte? |
| `subsidio-morte`            | 180 dias a contar do registo do óbito                                               | Regime da Caixa Geral de Aposentações não tratado                                                                                                         |
| `pensao-sobrevivencia`      | 6 meses a contar do óbito                                                           | O gov.pt conta da morte; uma fonte secundária conta do registo                                                                                            |
| `participacao-imposto-selo` | Fim do 3.º mês seguinte ao óbito; domingo ou feriado passa para o dia útil seguinte | Confirmar se um prazo que termina num sábado transita                                                                                                     |
| `aceitacao-heranca`         | 10 anos a contar do óbito                                                           | Legalmente conta do conhecimento de ter sido chamado à herança; a app mostra a data mais cedo. Texto do art. 2059.º confirmado só por acórdãos            |

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
