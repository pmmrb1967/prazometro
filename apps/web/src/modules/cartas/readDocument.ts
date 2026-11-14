import { loadImage, prepare, recognize, type OcrProgress } from './ocr';
import { readPdf } from './pdf';

/**
 * Texto de uma fotografia ou de um PDF, lido no dispositivo. Um PDF com texto é lido
 * diretamente; um PDF digitalizado e as fotografias passam pelo OCR.
 */
export async function readDocumentText(
  file: File,
  onProgress: (p: OcrProgress) => void,
): Promise<string> {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
    const pdf = await readPdf(file);
    return pdf.tipo === 'texto' ? pdf.texto : recognize(pdf.paginas, onProgress);
  }
  return recognize(prepare(await loadImage(file), 0), onProgress);
}
