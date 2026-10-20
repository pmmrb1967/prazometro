import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

// Gera o PDF de uma carta no dispositivo (nunca no Worker: gasta CPU).
// Markdown simples, linha a linha, porque nas cartas as quebras de linha contam (moradas):
//   "# Título" e "## Subtítulo" a negrito; linha vazia = espaço entre parágrafos;
//   as restantes linhas são texto, com quebra automática quando não cabem na largura.
// Sem `fonts`, usa Helvetica, que só tem caracteres da Europa Ocidental (WinAnsi).
// Com `fonts`, recebe uma cadeia de ficheiros de letra (TTF, OTF, WOFF ou WOFF2): cada carácter
// usa o primeiro ficheiro que o tiver. Assim podem juntar-se os subconjuntos "latin" e
// "latin-ext" de uma letra. Um carácter que nenhum tenha dá erro, em vez de sair um quadrado.

export type FontChain = { regular: Uint8Array[]; bold?: Uint8Array[] };

export type LetterPdfOptions = {
  titulo?: string;
  fonts?: FontChain;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 72;
const SIZE = { body: 11, h1: 15, h2: 12.5 };
const LEADING = 1.45;
const COLOR = rgb(0.08, 0.1, 0.14);

export class UnsupportedCharactersError extends Error {
  constructor(public readonly chars: string[]) {
    super(`A letra da carta não tem estes caracteres: ${chars.join(' ')}`);
  }
}

type ChainFont = { pdf: PDFFont; has: (ch: string) => boolean };
type Run = { text: string; font: PDFFont };

async function embedChain(doc: PDFDocument, files: Uint8Array[]): Promise<ChainFont[]> {
  return Promise.all(
    files.map(async (bytes) => {
      const parsed = fontkit.create(bytes);
      const pdf = await doc.embedFont(bytes, { subset: true });
      return { pdf, has: (ch: string) => parsed.glyphForCodePoint(ch.codePointAt(0)!).id !== 0 };
    }),
  );
}

async function embedStandard(doc: PDFDocument, name: StandardFonts): Promise<ChainFont[]> {
  const pdf = await doc.embedFont(name);
  return [
    {
      pdf,
      has: (ch: string) => {
        try {
          pdf.encodeText(ch);
          return true;
        } catch {
          return false;
        }
      },
    },
  ];
}

/** Divide o texto em troços, cada um com a primeira letra da cadeia que tem os caracteres. */
function toRuns(text: string, chain: ChainFont[], missing: Set<string>): Run[] {
  const runs: Run[] = [];
  for (const ch of text) {
    const font = /\s/.test(ch)
      ? (runs.at(-1)?.font ?? chain[0]!.pdf)
      : chain.find((f) => f.has(ch))?.pdf;
    if (!font) {
      missing.add(ch);
      continue;
    }
    const last = runs.at(-1);
    if (last && last.font === font) last.text += ch;
    else runs.push({ text: ch, font });
  }
  return runs;
}

function width(runs: Run[], size: number): number {
  return runs.reduce((sum, r) => sum + r.font.widthOfTextAtSize(r.text, size), 0);
}

function wrap(text: string, chain: ChainFont[], size: number, maxWidth: number): Run[][] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: Run[][] = [];
  let line = '';
  const ignore = new Set<string>();
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || width(toRuns(candidate, chain, ignore), size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(toRuns(line, chain, ignore));
      line = word;
    }
  }
  if (line) lines.push(toRuns(line, chain, ignore));
  return lines;
}

function drawRuns(page: PDFPage, runs: Run[], x: number, y: number, size: number) {
  let cursor = x;
  for (const r of runs) {
    page.drawText(r.text, { x: cursor, y, size, font: r.font, color: COLOR });
    cursor += r.font.widthOfTextAtSize(r.text, size);
  }
}

export async function renderLetterPdf(
  markdown: string,
  options: LetterPdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const { fonts } = options;
  const regular = fonts
    ? await embedChain(doc, fonts.regular)
    : await embedStandard(doc, StandardFonts.Helvetica);
  const bold = fonts
    ? fonts.bold
      ? await embedChain(doc, fonts.bold)
      : regular
    : await embedStandard(doc, StandardFonts.HelveticaBold);

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const missing = new Set<string>();
  for (const raw of lines) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(raw);
    toRuns(heading ? heading[2]! : raw, heading ? bold : regular, missing);
  }
  if (missing.size) throw new UnsupportedCharactersError([...missing]);

  if (options.titulo) doc.setTitle(options.titulo);
  doc.setLanguage('pt-PT');
  doc.setProducer('Prazómetro');
  doc.setCreator('Prazómetro');

  const maxWidth = A4.width - 2 * MARGIN;
  let page = doc.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  for (const raw of lines) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(raw);
    const size = heading ? (heading[1] === '#' ? SIZE.h1 : SIZE.h2) : SIZE.body;
    const text = heading ? heading[2]! : raw;
    const lineHeight = size * LEADING;

    if (!text.trim()) {
      y -= SIZE.body * 0.8;
      continue;
    }
    if (heading) y -= size * 0.4;
    for (const runs of wrap(text, heading ? bold : regular, size, maxWidth)) {
      if (y - lineHeight < MARGIN) {
        page = doc.addPage([A4.width, A4.height]);
        y = A4.height - MARGIN;
      }
      y -= lineHeight;
      drawRuns(page, runs, MARGIN, y, size);
    }
  }

  return doc.save();
}
