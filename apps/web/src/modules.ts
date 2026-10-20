export type ModuleInfo = {
  id: 'garantia' | 'sns' | 'cartas' | 'pos-obito';
  title: string;
  summary: string;
  available: boolean;
};

export const MODULES: ModuleInfo[] = [
  {
    id: 'garantia',
    title: 'Garantia de uma compra',
    summary: 'Registe a compra e saiba até quando pode reclamar. A garantia legal é de 3 anos.',
    available: true,
  },
  {
    id: 'sns',
    title: 'Espera no SNS',
    summary: 'Veja se a espera por uma consulta ou cirurgia já passou o tempo máximo garantido.',
    available: true,
  },
  {
    id: 'cartas',
    title: 'Perceber uma carta',
    summary: 'Fotografe uma carta oficial e veja, em palavras simples, o que pede e até quando.',
    available: false,
  },
  {
    id: 'pos-obito',
    title: 'Depois de um falecimento',
    summary: 'Os passos, prazos e custos a tratar, por ordem, com as cartas necessárias.',
    available: false,
  },
];
