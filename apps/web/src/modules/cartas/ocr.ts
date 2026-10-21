// OCR no dispositivo com Tesseract.js (língua "por"). A fotografia nunca sai do telemóvel.
// Pré-processamento num canvas: rotação, recorte, redução de tamanho, tons de cinzento e
// contraste. Os ficheiros do Tesseract são servidos pelo próprio site, em /ocr/.

export type Crop = { x: number; y: number; w: number; h: number }; // frações de 0 a 1
export type Rotation = 0 | 90 | 180 | 270;

const MAX_SIDE = 2400;

export async function loadImage(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

/** Desenha a imagem rodada e recortada num canvas, já pronta para o OCR. */
export function prepare(
  image: ImageBitmap,
  rotation: Rotation,
  crop?: Crop,
  { enhance = true } = {},
): HTMLCanvasElement {
  const turned = rotation === 90 || rotation === 270;
  const fullW = turned ? image.height : image.width;
  const fullH = turned ? image.width : image.height;
  const c = crop ?? { x: 0, y: 0, w: 1, h: 1 };
  const srcW = Math.max(1, Math.round(c.w * fullW));
  const srcH = Math.max(1, Math.round(c.h * fullH));
  const scale = Math.min(1, MAX_SIDE / Math.max(srcW, srcH));

  // 1. Imagem inteira rodada.
  const rotated = document.createElement('canvas');
  rotated.width = fullW;
  rotated.height = fullH;
  const r = rotated.getContext('2d')!;
  r.translate(fullW / 2, fullH / 2);
  r.rotate((rotation * Math.PI) / 180);
  r.drawImage(image, -image.width / 2, -image.height / 2);

  // 2. Recorte e redução.
  const out = document.createElement('canvas');
  out.width = Math.round(srcW * scale);
  out.height = Math.round(srcH * scale);
  const o = out.getContext('2d', { willReadFrequently: true })!;
  o.drawImage(
    rotated,
    Math.round(c.x * fullW),
    Math.round(c.y * fullH),
    srcW,
    srcH,
    0,
    0,
    out.width,
    out.height,
  );
  if (enhance) grayscaleAndStretch(o, out.width, out.height);
  return out;
}

/** Tons de cinzento e contraste automático (estica entre os percentis 2 e 98). */
function grayscaleAndStretch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = g;
    hist[g]!++;
  }
  const total = w * h;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i]! - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
}

export type OcrProgress = { fase: string; progresso: number };

const PHASES: Record<string, string> = {
  'loading tesseract core': 'A preparar a leitura',
  'initializing tesseract': 'A preparar a leitura',
  'loading language traineddata': 'A carregar o português',
  'initializing api': 'A preparar a leitura',
  'recognizing text': 'A ler o texto',
};

export async function recognize(
  canvas: HTMLCanvasElement,
  onProgress: (p: OcrProgress) => void,
): Promise<string> {
  const { createWorker, OEM } = await import('tesseract.js');
  const worker = await createWorker('por', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    logger: (m: { status: string; progress: number }) =>
      onProgress({ fase: PHASES[m.status] ?? 'A ler o texto', progresso: m.progress }),
  });
  try {
    const { data } = await worker.recognize(canvas, { rotateAuto: true });
    return tidy(data.text);
  } finally {
    await worker.terminate();
  }
}

/** Junta linhas partidas a meio de uma frase e tira espaços a mais. */
export function tidy(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
