import { CODIGO_CIVIL_URL, OBITO_AT_URL } from './rules';

// Passos depois de um falecimento, por ordem. Os prazos vêm sempre das regras em
// rules/pos-obito/ (campo `regra`); aqui só há texto, ligações e custos com fonte.
// Todo este conteúdo está à espera de revisão por um jurista.

export type Phase =
  'primeiros-dias' | 'primeiras-semanas' | 'ate-3-meses' | 'ate-6-meses' | 'depois';

export const PHASES: [Phase, string][] = [
  ['primeiros-dias', 'Nos primeiros dias'],
  ['primeiras-semanas', 'Nas primeiras semanas'],
  ['ate-3-meses', 'Até ao fim do 3.º mês'],
  ['ate-6-meses', 'Nos primeiros 6 meses'],
  ['depois', 'Sem prazo fixo'],
];

export type Step = {
  id: string;
  fase: Phase;
  titulo: string;
  /** Texto em linguagem simples, um parágrafo por elemento. */
  texto: string[];
  /** Id da regra que dá o prazo (calculado pelo motor). */
  regra?: string;
  custo?: string;
  /** Modelos de carta de templates/pos-obito/. */
  cartas?: string[];
  ligacoes: { titulo: string; url: string }[];
};

export const STEPS: Step[] = [
  {
    id: 'declaracao-obito',
    fase: 'primeiros-dias',
    titulo: 'Declarar o óbito e tratar do funeral',
    regra: 'pos-obito.declaracao-obito',
    texto: [
      'O óbito tem de ser declarado numa conservatória do registo civil. Normalmente é a agência funerária que o faz, ao mesmo tempo que trata do funeral.',
      'Peça a certidão de óbito: vai precisar dela em quase todos os passos seguintes. Guarde também a fatura e o recibo do funeral, com o nome de quem pagou.',
    ],
    ligacoes: [
      { titulo: 'gov.pt: Declarar um óbito', url: 'https://www.gov.pt/servicos/declarar-um-obito' },
    ],
  },
  {
    id: 'cabeca-de-casal',
    fase: 'primeiras-semanas',
    titulo: 'Saber quem é o cabeça de casal',
    texto: [
      'O cabeça de casal administra a herança até à partilha e é quem trata das Finanças. Em regra, é o cônjuge que sobreviveu; se não houver, segue-se a ordem prevista na lei (Código Civil, artigo 2080.º).',
    ],
    ligacoes: [{ titulo: 'Código Civil, artigo 2080.º', url: CODIGO_CIVIL_URL }],
  },
  {
    id: 'subsidio-morte',
    fase: 'primeiras-semanas',
    titulo: 'Pedir o subsídio por morte',
    regra: 'pos-obito.subsidio-morte',
    texto: [
      'Se a pessoa descontava para a Segurança Social, o cônjuge, o unido de facto, os filhos ou outros familiares podem ter direito a um pagamento único.',
      'Pode pedir na Segurança Social Direta, num balcão ou por correio.',
    ],
    custo: 'Gratuito. Valor do subsídio em 2026: 1611,39 euros.',
    ligacoes: [
      {
        titulo: 'gov.pt: Requerer o subsídio por morte',
        url: 'https://www.gov.pt/servicos/requerer-o-subsidio-por-morte',
      },
    ],
  },
  {
    id: 'reembolso-funeral',
    fase: 'primeiras-semanas',
    titulo: 'Pedir o reembolso das despesas de funeral',
    regra: 'pos-obito.reembolso-funeral',
    texto: [
      'Quem pagou o funeral pode pedir o reembolso à Segurança Social, com a fatura e o recibo em seu nome e com o nome da pessoa que faleceu. Não se acumula com o subsídio por morte: confirme na Segurança Social qual dos dois se aplica.',
    ],
    custo: 'Gratuito. Reembolso até 1611,39 euros em 2026.',
    ligacoes: [
      {
        titulo: 'Segurança Social: requerimento de reembolso (RP 5076)',
        url: 'https://seg-social.pt/documents/10152/21738/RP_5076/df2a273d-d88e-41eb-a47b-cf6dd8cf0a9c',
      },
    ],
  },
  {
    id: 'bancos',
    fase: 'primeiras-semanas',
    titulo: 'Comunicar o falecimento aos bancos',
    texto: [
      'Avise cada banco e peça a lista das contas, aplicações e créditos, com os saldos à data do óbito. Precisa desses valores para a participação às Finanças.',
      'Se não souber em que bancos a pessoa tinha contas, os herdeiros podem pedir essa informação ao Banco de Portugal. Os certificados de aforro e do Tesouro são tratados à parte, no IGCP.',
    ],
    cartas: ['pos-obito.comunicacao-banco'],
    ligacoes: [{ titulo: 'Banco de Portugal', url: 'https://www.bportugal.pt' }],
  },
  {
    id: 'seguros',
    fase: 'primeiras-semanas',
    titulo: 'Saber se havia seguros de vida',
    texto: [
      'Qualquer interessado pode pedir à Autoridade de Supervisão de Seguros e Fundos de Pensões (ASF) a lista dos seguros de vida e de acidentes pessoais em nome da pessoa que faleceu. Depois, contacte cada seguradora.',
    ],
    cartas: ['pos-obito.comunicacao-seguradora'],
    ligacoes: [
      {
        titulo: 'Decreto-Lei n.º 384/2007 (registo central de seguros de vida)',
        url: 'https://diariodarepublica.pt/dr/detalhe/decreto-lei/384-2007-628369',
      },
      { titulo: 'ASF', url: 'https://www.asf.com.pt' },
    ],
  },
  {
    id: 'contratos',
    fase: 'primeiras-semanas',
    titulo: 'Cancelar ou mudar o titular dos contratos',
    texto: [
      'Telemóvel, internet, eletricidade, gás, água, televisão e subscrições continuam a ser cobrados até alguém os cancelar ou mudar para outro nome. Junte-os no inventário, em baixo, para não esquecer nenhum.',
      'Antes de cancelar, pergunte se há valores a pagar até ao fim do contrato.',
    ],
    cartas: ['pos-obito.cancelamento-contrato'],
    ligacoes: [],
  },
  {
    id: 'participacao-imposto-selo',
    fase: 'ate-3-meses',
    titulo: 'Participar o óbito às Finanças',
    regra: 'pos-obito.participacao-imposto-selo',
    texto: [
      'O cabeça de casal entrega a participação do óbito e a relação de bens (modelo 1 do Imposto do Selo), no Portal das Finanças ou num serviço de finanças. Também pede o NIF da herança.',
      'O cônjuge ou unido de facto, os filhos, os netos, os pais e os avós não pagam Imposto do Selo sobre a herança. Os outros herdeiros pagam 10% sobre os bens sujeitos a imposto. Mesmo sem imposto a pagar, a participação é obrigatória se havia bens em Portugal.',
    ],
    cartas: ['pos-obito.comunicacao-banco'],
    ligacoes: [{ titulo: 'Portal das Finanças: Óbito', url: OBITO_AT_URL }],
  },
  {
    id: 'pensao-sobrevivencia',
    fase: 'ate-6-meses',
    titulo: 'Pedir a pensão de sobrevivência',
    regra: 'pos-obito.pensao-sobrevivencia',
    texto: [
      'O cônjuge, o unido de facto, os ex-cônjuges com pensão de alimentos, os filhos e, em certos casos, os pais podem ter direito a uma pensão mensal.',
      'Pode ser pedida a qualquer momento, mas quem pede nos primeiros 6 meses recebe desde o mês seguinte ao falecimento.',
    ],
    custo: 'Gratuito.',
    ligacoes: [
      {
        titulo: 'gov.pt: Pedir a pensão de sobrevivência',
        url: 'https://www.gov.pt/servicos/requerer-a-pensao-de-sobrevivencia',
      },
    ],
  },
  {
    id: 'habilitacao-herdeiros',
    fase: 'depois',
    titulo: 'Habilitação de herdeiros e partilha',
    texto: [
      'A habilitação de herdeiros é o documento que diz quem são os herdeiros. Os bancos e as conservatórias pedem-na. Faz-se num cartório notarial ou num Balcão das Heranças, que pode tratar também da partilha e do registo dos bens (casas e carros).',
    ],
    custo:
      'No Balcão das Heranças, a habilitação com partilha e registos custa 425 euros de base, mais emolumentos que dependem do número de bens. Nos notários, o preço varia.',
    ligacoes: [
      {
        titulo: 'gov.pt: Habilitação de herdeiros, partilha e registo dos bens',
        url: 'https://www.gov.pt/servicos/realizar-a-habilitacao-de-herdeiros-partilha-e-registo-dos-bens',
      },
    ],
  },
  {
    id: 'aceitacao-heranca',
    fase: 'depois',
    titulo: 'Aceitar ou repudiar a herança',
    regra: 'pos-obito.aceitacao-heranca',
    texto: [
      'As dívidas da pessoa que faleceu são pagas pela herança, e não ultrapassam o valor dos bens herdados. Mas, se a herança for aceite sem inventário, cabe ao herdeiro provar que os bens não chegam (Código Civil, artigo 2071.º).',
      'Se houver mais dívidas do que bens, pode fazer sentido repudiar. Antes de decidir, peça aconselhamento a um advogado ou solicitador.',
    ],
    ligacoes: [{ titulo: 'Código Civil, artigos 2059.º e 2071.º', url: CODIGO_CIVIL_URL }],
  },
];
