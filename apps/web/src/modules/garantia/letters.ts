import { formatDateLong, parseTemplate, todayInLisbon, type Template } from '@prazometro/engine';
import latin400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff?url';
import latinExt400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-400-normal.woff?url';
import latin700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff?url';
import latinExt700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-700-normal.woff?url';
import type { Profile, Purchase } from '../../db';

// Modelos de carta de templates/garantia/, lidos no build. A geração do PDF corre no dispositivo.

const sources = import.meta.glob<string>('../../../../../templates/garantia/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
});

export const TEMPLATES: Record<string, Template> = Object.fromEntries(
  Object.values(sources).map((src) => {
    const t = parseTemplate(src);
    return [t.meta.id, t];
  }),
);

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

/** Campos já preenchidos com os dados da compra e do perfil guardado. */
export function prefill(p: Purchase, profile?: Profile): Record<string, string> {
  return {
    nome: profile?.nome ?? '',
    morada: profile?.morada ?? '',
    local: profile?.local ?? '',
    loja_nome: p.loja,
    loja_morada: p.loja_morada ?? '',
    data_carta: formatDateLong(todayInLisbon()),
    produto: p.produto,
    data_compra: formatDateLong(p.data_compra),
    data_entrega: formatDateLong(p.data_entrega),
    data_comunicacao: p.data_comunicacao ? formatDateLong(p.data_comunicacao) : '',
  };
}

async function bytes(url: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

export async function letterPdf(text: string, titulo: string): Promise<Blob> {
  const { renderLetterPdf } = await import('@prazometro/engine/pdf');
  const [r1, r2, b1, b2] = await Promise.all(
    [latin400, latinExt400, latin700, latinExt700].map(bytes),
  );
  const pdf = await renderLetterPdf(text, {
    titulo,
    fonts: { regular: [r1!, r2!], bold: [b1!, b2!] },
  });
  return new Blob([pdf as BlobPart], { type: 'application/pdf' });
}
