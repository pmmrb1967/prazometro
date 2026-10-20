import type { Rule } from './schema';

// Regra FICTÍCIA, só para testes do motor. Não é informação jurídica e não pode ser publicada:
// as regras reais vivem em rules/ e são recolhidas e verificadas a partir da Fase 2.
export const exampleRule: Rule = {
  id: 'garantia.exemplo-de-teste',
  modulo: 'garantia',
  titulo: 'Regra de exemplo para testes',
  descricao: 'Regra fictícia usada apenas nos testes do motor.',
  condicoes: { estado: 'novo', vendedor: 'profissional' },
  prazo: {
    quantidade: 3,
    unidade: 'anos',
    contagem: 'corridos',
    transita_dia_util: false,
    alertas_dias_antes: [30, 0],
  },
  marcos: [
    {
      id: 'fim-presuncao',
      quantidade: 2,
      unidade: 'anos',
      alerta_dias_antes: 30,
      texto: 'Marco de exemplo aos 2 anos.',
    },
  ],
  fontes: [{ titulo: 'Fonte de exemplo', url: 'https://example.org/', artigo: '1.º' }],
  modelos_carta: [],
  verificado_em: '2026-10-20',
  verificado_por: 'testes',
  estado: 'publicada',
};
