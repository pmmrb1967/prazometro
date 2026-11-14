import { prepare, tidy } from './ocr';

// Cartas em PDF, lidas no dispositivo com o pdf.js. Um PDF digital (com texto) é lido
// diretamente, sem OCR. Um PDF digitalizado (só imagens) é desenhado página a página e
// passa pelo OCR. A biblioteca só é descarregada quando a pessoa escolhe um PDF.

/** Páginas lidas no máximo: as cartas importantes cabem nas primeiras. */
export const MAX_PAGES = 5;
/** Abaixo disto, por página, considera-se que o PDF não tem texto (é digitalizado). */
const MIN_CHARS_PER_PAGE = 40;
/** Largura das páginas desenhadas para o OCR, em píxeis. */
const RENDER_WIDTH = 2000;

export type PdfContent =
  | { tipo: 'texto'; texto: string; paginas: number; total: number }
  | { tipo: 'imagens'; paginas: HTMLCanvasElement[]; total: number };

export class PdfError extends Error {}

export async function readPdf(file: Blob): Promise<PdfContent> {
  const pdfjs = await import('pdfjs-dist');
  const { default: workerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // Descodificadores de imagens JBIG2 e JPEG 2000 (PDFs digitalizados), servidos pelo site.
    wasmUrl: '/ocr/pdfjs/',
  });
  let doc;
  try {
    doc = await task.promise;
  } catch (err) {
    if (err instanceof pdfjs.PasswordException) {
      throw new PdfError(
        'Este PDF tem palavra-passe. Abra-o noutra aplicação, copie o texto e cole-o aqui.',
      );
    }
    throw new PdfError('Não foi possível abrir este PDF. Experimente fotografar a carta.');
  }

  try {
    const count = Math.min(doc.numPages, MAX_PAGES);
    const texts: string[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      texts.push(
        content.items
          .map((item) => ('str' in item ? item.str + (item.hasEOL ? '\n' : '') : ''))
          .join(''),
      );
    }
    const texto = tidy(texts.join('\n\n'));
    if (texto.replace(/\s/g, '').length >= MIN_CHARS_PER_PAGE * count) {
      return { tipo: 'texto', texto, paginas: count, total: doc.numPages };
    }

    // Sem texto: desenhar as páginas para o OCR.
    const paginas: HTMLCanvasElement[] = [];
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      await page.render({ canvas, viewport }).promise;
      paginas.push(prepare(await createImageBitmap(canvas), 0));
    }
    return { tipo: 'imagens', paginas, total: doc.numPages };
  } finally {
    await task.destroy();
  }
}
