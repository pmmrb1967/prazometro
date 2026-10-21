import type { LetterType } from '@prazometro/ai';

// "O que fazer", por tipo de carta. Informação geral, nunca opinião sobre o caso concreto.

export type Guidance = { passos: string[]; ajuda?: { texto: string; url: string } };

export const GUIDANCE: Record<LetterType, Guidance> = {
  contraordenacao_transito: {
    passos: [
      'Confirme os dados do auto: matrícula, local, data e hora da infração.',
      'Se concordar, pode pagar a coima pelo valor mínimo dentro do prazo. Pagar não impede de apresentar defesa sobre a gravidade da infração ou a sanção acessória.',
      'Se não concordar, apresente defesa por escrito dentro do prazo, com o número do auto, os factos e o que pede. Pode juntar provas e testemunhas.',
      'Pode também pedir para pagar em prestações, se cumprir os requisitos.',
    ],
    ajuda: {
      texto: 'Contraordenações rodoviárias na ANSR (pagar, defesa e prestações)',
      url: 'https://ansr.pt/contraordenacoes',
    },
  },
  audicao_previa_at: {
    passos: [
      'Leia o projeto de decisão e a fundamentação que vem com a carta.',
      'Se não concordar, responda por escrito dentro do prazo, pelo e-balcão do Portal das Finanças ou por carta, explicando porquê e juntando documentos.',
      'Se concordar, não precisa de responder. As Finanças decidem depois e notificam a decisão final.',
    ],
    ajuda: {
      texto: 'e-balcão do Portal das Finanças',
      url: 'https://sitfiscal.portaldasfinancas.gov.pt/ebalcao/',
    },
  },
  citacao_tribunal: {
    passos: [
      'Não ignore a carta: o prazo para contestar começa a contar com a citação.',
      'Procure um advogado quanto antes. Na maior parte das ações é obrigatório.',
      'Se não tiver meios para pagar a um advogado, peça apoio judiciário na Segurança Social. O pedido deve ser feito logo, e deve informar o tribunal de que o fez.',
    ],
    ajuda: {
      texto: 'Pedir proteção jurídica (apoio judiciário) na Segurança Social',
      url: 'https://www.seg-social.pt/protecao-juridica',
    },
  },
  cobranca: {
    passos: [
      'Confirme se a dívida é sua e se o valor está certo (faturas, contrato, pagamentos já feitos).',
      'Se estiver certa, pague ou peça um plano de pagamento à entidade.',
      'Se não concordar, responda por escrito a explicar porquê, e guarde uma cópia. Se for uma injunção ou uma execução, o prazo para se opor é curto: procure ajuda jurídica.',
    ],
  },
  liquidacao_imposto: {
    passos: [
      'Confirme os valores no Portal das Finanças.',
      'Se houver valor a pagar, pague até à data limite indicada na carta, com a referência de pagamento.',
      'Se não concordar com o cálculo, pode apresentar reclamação graciosa nas Finanças.',
    ],
    ajuda: {
      texto: 'Portal das Finanças',
      url: 'https://www.portaldasfinancas.gov.pt/',
    },
  },
  informacao: {
    passos: ['Guarde a carta e confirme se as datas indicadas lhe convêm.'],
  },
  outro: {
    passos: [
      'Veja na carta o que é pedido e até quando.',
      'Se tiver dúvidas, contacte a entidade que enviou a carta, ou peça ajuda num balcão de atendimento, numa junta de freguesia ou a um jurista.',
    ],
  },
};
