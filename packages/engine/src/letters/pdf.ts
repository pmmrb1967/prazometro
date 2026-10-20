import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

// Gera o PDF de uma carta no dispositivo (nunca no Worker: gasta CPU).
// Markdown simples, linha a linha, porque nas cartas as quebras de linha contam (moradas):
//   "# Título" e "## Subtítulo" a negrito; linha vazia = espaço entre parágrafos;
//   as restantes linhas são texto, com quebra automática quando não cabem na largura.
// Sem `font`, usa Helvetica, que só tem caracteres da Europa Ocidental (WinAnsi). Para nomes
// com outras letras (Ł, Ș, cirílico...) a app deve passar uma fonte TTF/OTF.

export type LetterPdfOptions = {
  titulo?: string;
  font?: Uint8Array;
  boldFont?: Uint8Array;
};

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 72;
const SIZE = { body: 11, h1: 15, h2: 12.5 };
const LEADING = 1.45;

export class UnsupportedCharactersError extends Error {
  constructor(public readonly chars: string[]) {
    super(
      `A letra por defeito não tem estes caracteres: ${chars.join(' ')}. Passe uma fonte com suporte (opção "font").`,
    );
  }
}

function unsupportedChars(font: PDFFont, text: string): string[] {
  const bad = new Set<string>();
  for (const ch of text) {
    if (ch === '\n' || ch === '\r') continue;
    try {
      font.encodeText(ch);
    } catch {
      bad.add(ch);
    }
  }
  return [...bad];
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  lines.push(line);
  return lines;
}

export async function renderLetterPdf(
  markdown: string,
  options: LetterPdfOptions = {},
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular = options.font
    ? await doc.embedFont(options.font, { subset: true })
    : await doc.embedFont(StandardFonts.Helvetica);
  const bold = options.boldFont
    ? await doc.embedFont(options.boldFont, { subset: true })
    : options.font
      ? regular
      : await doc.embedFont(StandardFonts.HelveticaBold);

  const bad = [
    ...new Set([...unsupportedChars(regular, markdown), ...unsupportedChars(bold, markdown)]),
  ];
  if (bad.length) throw new UnsupportedCharactersError(bad);

  if (options.titulo) doc.setTitle(options.titulo);
  doc.setLanguage('pt-PT');
  doc.setProducer('Prazómetro');
  doc.setCreator('Prazómetro');

  const maxWidth = A4.width - 2 * MARGIN;
  let page = doc.addPage([A4.width, A4.height]);
  let y = A4.height - MARGIN;

  const ensureSpace = (height: number) => {
    if (y - height < MARGIN) {
      page = doc.addPage([A4.width, A4.height]);
      y = A4.height - MARGIN;
    }
  };

  for (const raw of markdown.replace(/\r\n/g, '\n').split('\n')) {
    const heading = /^(#{1,2})\s+(.*)$/.exec(raw);
    const size = heading ? (heading[1] === '#' ? SIZE.h1 : SIZE.h2) : SIZE.body;
    const font = heading ? bold : regular;
    const text = heading ? heading[2]! : raw;
    const lineHeight = size * LEADING;

    if (!text.trim()) {
      y -= SIZE.body * 0.8;
      continue;
    }
    if (heading) y -= size * 0.4;
    for (const line of wrap(text, font, size, maxWidth)) {
      ensureSpace(lineHeight);
      y -= lineHeight;
      page.drawText(line, { x: MARGIN, y, size, font, color: rgb(0.08, 0.1, 0.14) });
    }
  }

  return doc.save();
}
