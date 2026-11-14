import type { Issuer, LetterType } from '../schema';

// Conjunto de teste: 30 cartas FICTÍCIAS, escritas à imagem de cartas reais, com nomes,
// NIF, moradas e números inventados. Servem para medir o acerto do emissor e das datas.
// Falta juntar cartas reais anonimizadas (ver planning/plan.md, fase 6).

export type TestLetter = {
  id: string;
  texto: string;
  emissor: Issuer;
  tipo: LetterType;
  /** Todas as datas escritas na carta (AAAA-MM-DD). */
  datas: string[];
};

export const TEST_LETTERS: TestLetter[] = [
  {
    id: 'at-audicao-1',
    emissor: 'at',
    tipo: 'audicao_previa_at',
    datas: ['2026-09-14'],
    texto: `AUTORIDADE TRIBUTÁRIA E ADUANEIRA
Serviço de Finanças de Lisboa-7

Exmo. Senhor
Joaquim Ferreira Antunes
Rua das Flores, 12, 2.º Esq.
1200-195 Lisboa

Lisboa, 14/09/2026
Assunto: Notificação para exercício do direito de audição
NIF: 123456789

Fica V. Ex.ª notificado, nos termos do artigo 60.º da Lei Geral Tributária, do projeto de decisão de indeferimento do pedido de isenção de IMI, para, querendo, exercer o direito de audição no prazo de 15 dias, por escrito ou oralmente.`,
  },
  {
    id: 'at-audicao-2',
    emissor: 'at',
    tipo: 'audicao_previa_at',
    datas: ['2026-03-02', '2025-12-31'],
    texto: `Direção de Finanças do Porto
Notificação — Audição prévia

Nome: MARIA DA CONCEIÇÃO PINTO
NIF 234567891

Data: 2 de março de 2026

Foi elaborado projeto de decisão relativo à correção do IRS do ano terminado em 31-12-2025. Nos termos do art. 60.º da LGT, pode pronunciar-se no prazo de 15 dias a contar da notificação.`,
  },
  {
    id: 'at-liquidacao-1',
    emissor: 'at',
    tipo: 'liquidacao_imposto',
    datas: ['2026-04-01', '2026-05-31'],
    texto: `Autoridade Tributária e Aduaneira
IMPOSTO MUNICIPAL SOBRE IMÓVEIS — NOTA DE COBRANÇA
Ano: 2025   Prestação: 1/2

Contribuinte: António Manuel Sousa
Data de emissão: 01.04.2026
Valor a pagar: 312,45 €
Data limite de pagamento: 31.05.2026
Referência para pagamento: 123 456 789 012 345`,
  },
  {
    id: 'at-liquidacao-2',
    emissor: 'at',
    tipo: 'liquidacao_imposto',
    datas: ['2026-07-15', '2026-08-31'],
    texto: `AT - Autoridade Tributária e Aduaneira
Demonstração de liquidação de IRS — Ano 2025

Sujeito passivo A: [nome]
Data da liquidação: 15/07/2026
Valor a pagar: 1.245,30 €
Pagar até 31/08/2026, através da referência indicada, no Portal das Finanças ou num multibanco.`,
  },
  {
    id: 'at-execucao-1',
    emissor: 'at',
    tipo: 'cobranca',
    datas: ['2026-06-10'],
    texto: `Serviço de Finanças de Braga-1
CITAÇÃO — Processo de execução fiscal n.º 0361202601234567

Fica citado de que foi instaurado contra si o processo de execução fiscal acima identificado, por dívida de IUC no valor de 186,20 €, acrescido de juros de mora e custas.
Braga, 10 de junho de 2026
Pode, no prazo de 30 dias a contar da citação, pagar a quantia exequenda ou deduzir oposição (art. 203.º do CPPT).`,
  },
  {
    id: 'at-iuc-1',
    emissor: 'at',
    tipo: 'liquidacao_imposto',
    datas: ['2026-02-01', '2026-02-28'],
    texto: `Portal das Finanças
Imposto Único de Circulação — Documento único de cobrança
Matrícula: 45-AB-12
Data de emissão: 2026-02-01
Data limite de pagamento: 2026-02-28
Montante: 52,07 €`,
  },
  {
    id: 'ss-divida-1',
    emissor: 'seguranca_social',
    tipo: 'cobranca',
    datas: ['2026-05-20', '2026-01-01', '2026-03-31'],
    texto: `INSTITUTO DA SEGURANÇA SOCIAL, I.P.
Centro Distrital de Setúbal

Exma. Senhora
Ana Rita Carvalho
NISS: 12345678901

Setúbal, 20/05/2026
Assunto: Contribuições em falta

Verificámos que existem contribuições em dívida relativas ao período de 01/01/2026 a 31/03/2026, no valor de 412,88 €. Solicitamos a regularização da situação através da Segurança Social Direta.`,
  },
  {
    id: 'ss-prestacao-1',
    emissor: 'seguranca_social',
    tipo: 'informacao',
    datas: ['2026-08-03', '2026-09-01'],
    texto: `Segurança Social
Deferimento do subsídio de desemprego

Caro(a) beneficiário(a),
Informamos que o seu pedido de prestação foi deferido em 3 de agosto de 2026. O primeiro pagamento será feito a partir de 1 de setembro de 2026 por transferência bancária para o IBAN PT50 0035 0123 4567 8901 2345 6.`,
  },
  {
    id: 'ss-reposicao-1',
    emissor: 'seguranca_social',
    tipo: 'cobranca',
    datas: ['2026-04-22'],
    texto: `ISS, I.P. — Segurança Social
Notificação para reposição de prestações indevidamente pagas

Data: 22-04-2026
Foi apurado o montante de 980,00 € de subsídio de doença pago indevidamente. Pode pagar de uma vez ou pedir o pagamento em prestações. Se não pagar, a dívida será participada para cobrança coerciva pela secção de processo executivo (IGFSS).`,
  },
  {
    id: 'ss-audiencia-1',
    emissor: 'seguranca_social',
    tipo: 'outro',
    datas: ['2026-10-05'],
    texto: `Instituto da Segurança Social
Audiência dos interessados

Lisboa, 5 de outubro de 2026
Nos termos dos artigos 121.º e 122.º do Código do Procedimento Administrativo, fica notificado de que é intenção destes serviços indeferir o pedido de complemento solidário para idosos. Pode pronunciar-se por escrito no prazo de 10 dias úteis.`,
  },
  {
    id: 'tribunal-citacao-1',
    emissor: 'tribunal',
    tipo: 'citacao_tribunal',
    datas: ['2026-09-30'],
    texto: `Tribunal Judicial da Comarca de Lisboa
Juízo Local Cível de Lisboa - Juiz 3
Processo: 12345/26.4T8LSB

CITAÇÃO
Fica V. Ex.ª citado para, no prazo de 30 dias, contestar, querendo, a ação declarativa de condenação que lhe move Imobiliária Exemplo, Lda., com a advertência de que a falta de contestação importa a confissão dos factos articulados pelo autor.
Data de expedição: 30/09/2026`,
  },
  {
    id: 'tribunal-citacao-2',
    emissor: 'tribunal',
    tipo: 'citacao_tribunal',
    datas: ['2026-07-08'],
    texto: `Tribunal Judicial da Comarca do Porto
Juízo Central Cível do Porto
Proc. n.º 4567/26.0T8PRT

Exmo. Sr. Carlos Alberto Mendes
Fica citado para contestar no prazo de 30 dias, a que acresce uma dilação de 5 dias. É obrigatória a constituição de mandatário judicial.
Porto, 8 de julho de 2026`,
  },
  {
    id: 'tribunal-execucao-1',
    emissor: 'tribunal',
    tipo: 'citacao_execucao',
    datas: ['2026-04-09'],
    texto: `Agente de Execução Fictício — Cédula 9999
CITAÇÃO PRÉVIA - 728.º CPC
Processo: 1234/26.5T8LOU
Tribunal Judicial da Comarca do Porto Este, Lousada - Juízo de Execução - Juiz 2
Exequente(s): Banco Fictício, S.A.
Data: 09-04-2026
FUNDAMENTO DA CITAÇÃO
Fica citado, nos termos do artigo 728.º do Código de Processo Civil (CPC), para o processo de execução à margem referenciado, tendo o prazo de 20 (vinte) dias para pagar ou se opor (através de embargos de executado).`,
  },
  {
    id: 'tribunal-penhora-1',
    emissor: 'tribunal',
    tipo: 'cobranca',
    datas: ['2026-06-18'],
    texto: `Agente de Execução — Cédula 1234
Processo executivo n.º 987/25.3T8SNT

Notificação de penhora
Fica notificado de que foi penhorado um terço do seu vencimento, nos termos do Código de Processo Civil.
Sintra, 18.06.2026`,
  },
  {
    id: 'tribunal-injuncao-1',
    emissor: 'tribunal',
    tipo: 'cobranca',
    datas: ['2026-05-12'],
    texto: `BALCÃO NACIONAL DE INJUNÇÕES
Notificação de requerimento de injunção n.º 34567/26.1YIPRT

Requerente: Operadora Fictícia, S.A.
Requerido: Rui Miguel Santos
Data: 12/05/2026
Pode, no prazo de 15 dias, pagar a quantia pedida ou deduzir oposição.`,
  },
  {
    id: 'transito-auto-1',
    emissor: 'transito',
    tipo: 'contraordenacao_transito',
    datas: ['2026-08-21', '2026-09-10'],
    texto: `AUTORIDADE NACIONAL DE SEGURANÇA RODOVIÁRIA
Notificação de auto de contraordenação n.º 912345678

Arguido: Paulo Jorge Ribeiro
Veículo: AA-12-BC
Infração: excesso de velocidade (art. 27.º do Código da Estrada), verificada em 21/08/2026 na A1, km 12.
Data da notificação: 10/09/2026

No prazo de 15 dias úteis a contar da notificação pode pagar voluntariamente a coima pelo mínimo (60,00 €) ou apresentar defesa.`,
  },
  {
    id: 'transito-auto-2',
    emissor: 'transito',
    tipo: 'contraordenacao_transito',
    datas: ['2026-07-03'],
    texto: `Polícia de Segurança Pública
Divisão de Trânsito
AUTO DE CONTRAORDENAÇÃO

Estacionamento em lugar reservado a pessoas com deficiência, em 3 de julho de 2026.
Matrícula 12-34-XY
Pode apresentar defesa ou pagar a coima no prazo de 15 dias úteis, nos termos do art. 175.º do Código da Estrada.`,
  },
  {
    id: 'transito-gnr-1',
    emissor: 'transito',
    tipo: 'contraordenacao_transito',
    datas: ['2026-05-30', '2026-06-15'],
    texto: `GNR — Unidade Nacional de Trânsito
Notificação de contraordenação rodoviária

Radar fixo — infração de 30/05/2026
Data de emissão: 15/06/2026
Pagamento voluntário pelo mínimo ou defesa no prazo de 15 dias úteis. ANSR, Apartado 12, Oeiras.`,
  },
  {
    id: 'transito-municipal-1',
    emissor: 'transito',
    tipo: 'contraordenacao_transito',
    datas: ['2026-10-02'],
    texto: `Polícia Municipal de Lisboa
Aviso de contraordenação ao Código da Estrada
Data da infração: 02-10-2026
Veículo de matrícula 98-XZ-76 estacionado em segunda fila. Valor da coima: 30,00 €.`,
  },
  {
    id: 'banco-atraso-1',
    emissor: 'banco',
    tipo: 'cobranca',
    datas: ['2026-09-05', '2026-09-20'],
    texto: `Banco Exemplo, S.A.
Crédito Habitação — Contrato n.º 0001234567

Exmo. Senhor Fernando Lopes,
À data de 05/09/2026 regista uma prestação em atraso no valor de 645,10 €. Solicitamos a regularização até 20/09/2026, para evitar a integração no PERSI e a comunicação à Central de Responsabilidades de Crédito do Banco de Portugal.`,
  },
  {
    id: 'banco-cartao-1',
    emissor: 'banco',
    tipo: 'cobranca',
    datas: ['2026-08-12'],
    texto: `Caixa Geral de Depósitos
Cartão de crédito — Aviso de pagamento em falta

Lisboa, 12 de agosto de 2026
O pagamento mínimo do extrato do seu cartão de crédito não foi efetuado. Valor em dívida: 89,50 €. TAEG: 15,9%.`,
  },
  {
    id: 'banco-persi-1',
    emissor: 'banco',
    tipo: 'informacao',
    datas: ['2026-06-01'],
    texto: `Novo Banco
Integração no PERSI — Procedimento Extrajudicial de Regularização de Situações de Incumprimento

Data: 2026-06-01
Informamos que o seu contrato de crédito pessoal foi integrado no PERSI. Durante o procedimento não podemos avançar com ações judiciais.`,
  },
  {
    id: 'operadora-fatura-1',
    emissor: 'operadora',
    tipo: 'cobranca',
    datas: ['2026-07-25', '2026-08-10'],
    texto: `MEO - Serviços de Comunicações e Multimédia, S.A.
Aviso de pagamento em falta

Cliente n.º 123456789
A fatura de 25/07/2026, no valor de 54,99 €, não foi paga. Se não pagar até 10/08/2026, o serviço poderá ser suspenso.`,
  },
  {
    id: 'operadora-fidelizacao-1',
    emissor: 'operadora',
    tipo: 'informacao',
    datas: ['2026-11-30'],
    texto: `Vodafone Portugal
Alteração de tarifário

Caro Cliente,
O seu período de fidelização termina em 30 de novembro de 2026. Após essa data, o tarifário passa a ter um preço mensal de 49,99 €. Pode consultar as condições ou reclamar junto da ANACOM.`,
  },
  {
    id: 'operadora-nos-1',
    emissor: 'operadora',
    tipo: 'cobranca',
    datas: ['2026-04-15'],
    texto: `NOS Comunicações, S.A.
Cobrança de penalização por rescisão antecipada

Data: 15.04.2026
Valor em dívida: 240,00 € relativos ao incumprimento do período de fidelização. Contacte-nos através do 16990.`,
  },
  {
    id: 'sns-consulta-1',
    emissor: 'sns',
    tipo: 'informacao',
    datas: ['2026-11-12'],
    texto: `SNS — Serviço Nacional de Saúde
Unidade Local de Saúde de Santa Maria

Utente: Maria Helena Costa
Número de utente: 123456789
Consulta de Ortopedia marcada para 12/11/2026, às 10h30. Em caso de impossibilidade, avise com antecedência.`,
  },
  {
    id: 'sns-taxa-1',
    emissor: 'sns',
    tipo: 'cobranca',
    datas: ['2026-03-10', '2026-04-09'],
    texto: `Unidade Local de Saúde do Algarve
Notificação para pagamento de taxa moderadora

Episódio de urgência de 10/03/2026, sem referenciação do SNS 24.
Valor: 18,00 €. Pague até 09/04/2026 para evitar a cobrança coerciva.`,
  },
  {
    id: 'camara-licenca-1',
    emissor: 'camara',
    tipo: 'outro',
    datas: ['2026-09-08'],
    texto: `CÂMARA MUNICIPAL DE SINTRA
Divisão de Licenciamento

Sintra, 8 de setembro de 2026
Assunto: Pedido de licenciamento de obras
Fica notificado para, no prazo de 10 dias, juntar ao processo os elementos em falta, sob pena de rejeição liminar do pedido.`,
  },
  {
    id: 'camara-agua-taxa-1',
    emissor: 'camara',
    tipo: 'cobranca',
    datas: ['2026-06-30'],
    texto: `Município de Loures
Junta de Freguesia de Sacavém

Aviso: a taxa municipal de ocupação da via pública, no valor de 75,00 €, deve ser paga até 30/06/2026.`,
  },
  {
    id: 'energia-edp-1',
    emissor: 'energia_agua',
    tipo: 'cobranca',
    datas: ['2026-08-18', '2026-09-02'],
    texto: `EDP Comercial
Aviso prévio de interrupção do fornecimento de eletricidade

CPE: PT0002000012345678AB
Fatura de 18/08/2026 por pagar: 112,40 €.
Se o pagamento não for feito até 02/09/2026, o fornecimento pode ser interrompido, nos termos do Regulamento de Relações Comerciais da ERSE.`,
  },
  {
    id: 'energia-agua-1',
    emissor: 'energia_agua',
    tipo: 'cobranca',
    datas: ['2026-05-05'],
    texto: `Águas de Gaia
Serviços de abastecimento de água

Leitura do contador: 1234 m3
Fatura emitida em 05-05-2026 com acerto de consumos. Valor: 38,20 €.`,
  },
];
