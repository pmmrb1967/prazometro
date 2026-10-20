import { formatDateLong, todayInLisbon } from '@prazometro/engine';
import type { Purchase } from '../../db';

/** Respostas prontas para os campos de escolha de cada modelo (o texto entra na carta). */
export const CHOICES: Record<string, Record<string, string[]>> = {
  'garantia.reparacao-substituicao': {
    pedido: ['a reparação', 'a substituição'],
  },
  'garantia.rejeicao': {
    pedido: [
      'a imediata substituição do bem',
      'a resolução do contrato, com a devolução do valor pago',
    ],
  },
  'garantia.reducao-resolucao': {
    situacao: [
      'o bem não foi reparado nem substituído.',
      'a loja recusou reparar ou substituir o bem.',
      'o bem foi reparado, mas o defeito voltou a aparecer.',
      'apareceu um novo defeito depois da reparação.',
    ],
    pedido: [
      'resolver o contrato de compra e venda, devolvendo o bem e pedindo o reembolso do preço pago',
      'pedir a redução proporcional do preço',
    ],
  },
};

/** Campos já preenchidos com os dados da compra. */
export function prefill(p: Purchase): Record<string, string> {
  return {
    loja_nome: p.loja,
    loja_morada: p.loja_morada ?? '',
    data_carta: formatDateLong(todayInLisbon()),
    produto: p.produto,
    data_compra: formatDateLong(p.data_compra),
    data_entrega: formatDateLong(p.data_entrega),
    data_comunicacao: p.data_comunicacao ? formatDateLong(p.data_comunicacao) : '',
  };
}
