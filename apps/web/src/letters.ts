import { parseTemplate, type Template } from '@prazometro/engine';
import latin400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-400-normal.woff?url';
import latinExt400 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-400-normal.woff?url';
import latin700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-700-normal.woff?url';
import latinExt700 from '@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-ext-700-normal.woff?url';

// Modelos de carta de templates/<modulo>/, lidos no build. A geração do PDF corre no dispositivo.

const sources = import.meta.glob<string>('../../../templates/*/*.md', {
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
