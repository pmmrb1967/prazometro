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

## Textos dos passos: pesquisa de 14/11/2026

Confirmados por pesquisa do Claude nas fontes oficiais (ligações em `apps/web/src/modules/pos-obito/steps.ts`):

- **Lista de contas no Banco de Portugal** (Base de Dados de Contas): o herdeiro pede, sem custos, num posto de atendimento ou por correio, com a habilitação de herdeiros ou, se for descendente direto, a certidão de óbito e a prova da filiação. Mostra os bancos, não os saldos. Fonte: páginas do Banco de Portugal (bportugal.pt), lidas através dos excertos da pesquisa, porque o site bloqueia a leitura automática.
- **Seguros de vida na ASF** (Decreto-Lei n.º 384/2007, registo central): qualquer interessado, depois do óbito, recebe um certificado em 10 dias úteis no máximo, com os seguros de vida, de acidentes pessoais e as operações de capitalização com beneficiários em caso de morte. Ficam de fora os seguros ligados a créditos e alguns seguros de grupo. Fonte: portal do consumidor da ASF e DECO (o site da ASF pede verificação por imagem).
- **Dívidas até ao valor da herança**: Código Civil, art. 2071.º, n.os 1 e 2, texto lido e transcrito nos passos.
- **Custos do Balcão das Heranças**: 150 € (habilitação), 375 € (habilitação com registos), 425 € (habilitação, partilha e registos), mais 125 € por registo de imóvel a mais, 30 € por imóvel ou quota a mais, 20 € por móvel registado a mais, as consultas às bases de dados e os impostos. Fonte: perguntas frequentes do IRN, lidas diretamente.

## Passos novos: pesquisa de 15/11/2026

Acrescentados três passos, sem regra de prazo própria (o texto indica as datas):

- **Testamento**: depois do óbito, qualquer pessoa pede ao IRN (online ou na Conservatória dos Registos Centrais) a certidão sobre a existência de testamento, que diz o cartório e a data, mas não o conteúdo. Custa 25 €, pagos em 48 horas no pedido online; chega em papel pelo correio. Fontes: gov.pt («Saber se uma pessoa que morreu deixou testamento», lida diretamente: quem pode pedir) e DECO (dados do pedido, custo e envio, porque o formulário do IRN não se lê sem o abrir).
- **IRS do ano do óbito**: a declaração da pessoa falecida cobre de 1 de janeiro até ao óbito e é apresentada pelo administrador da herança (Código do IRS, art. 57.º, n.º 2) ou, se era casada ou unida de facto, pelo cônjuge sobrevivo, que pode optar pela tributação conjunta (art. 63.º). Entrega no prazo normal, de 1 de abril a 30 de junho do ano seguinte (art. 60.º). Depois do óbito, cada herdeiro declara a sua quota-parte dos rendimentos da herança (Portal das Finanças, página Óbito). Fontes: Portal das Finanças (arts. 57.º e 63.º, lidos diretamente) e Caixa Geral de Depósitos (Saldo Positivo), para o resumo prático.
- **Veículos**: a herança indivisa, representada pelo cabeça de casal, é sujeito passivo do IUC (Código do IUC, art. 3.º, n.º 3, lido diretamente). Registo de propriedade: 65 € (subsequente), menos 15% online (55,25 €), valor igual ao emolumento se fora de prazo (Regulamento Emolumentar, arts. 25.º, n.os 1.2 e 1.8, e 28.º, n.º 25, na página de custos do IRN); 20 € por móvel registado a mais no Balcão das Heranças. Prazo de 60 dias para o novo dono registar (gov.pt, Registar um automóvel).

Pontos para o jurista:

- Veículos: a partir de quando contam os 60 dias numa herança (habilitação, partilha ou relação de bens às Finanças) e se o registo a favor dos herdeiros é obrigatório quando os próprios herdeiros vendem o carro. Não encontrei fonte oficial; o texto da app manda confirmar na conservatória.
- Testamento: confirmar o custo e o procedimento no formulário do IRN (só confirmado através do gov.pt e da DECO).

## Cartas

- `comunicacao-banco`: pede a lista de produtos e os saldos à data do óbito.
- `comunicacao-seguradora`: pede a lista de seguros e os documentos para participar o sinistro.
- `cancelamento-contrato`: pede a cessação ou a mudança de titular. Não afirma direito a cessar sem encargos, porque não foi encontrada fonte.
