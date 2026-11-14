// OCR no dispositivo com Tesseract.js (língua "por"). A fotografia nunca sai do telemóvel.
// Pré-processamento num canvas: rotação, recorte, redução de tamanho, tons de cinzento e
// contraste. Os ficheiros do Tesseract são servidos pelo próprio site, em /ocr/.

export type Crop = { x: number; y: number; w: number; h: number }; // frações de 0 a 1
export type Rotation = 0 | 90 | 180 | 270;

const MAX_SIDE = 2400;

/** Erro com uma mensagem já pronta para mostrar à pessoa. */
export class OcrError extends Error {}

/**
 * Abre a fotografia, já direita (orientação EXIF). Alguns navegadores não aceitam as opções do
 * createImageBitmap, por isso tenta-se sem elas e, por fim, com um <img>. Formatos que o
 * navegador não sabe abrir (por exemplo, HEIC no Android) dão um OcrError com explicação.
 */
export async function loadImage(file: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    // tenta a seguir
  }
  try {
    return await createImageBitmap(file);
  } catch {
    // tenta a seguir
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return await createImageBitmap(img);
  } catch {
    throw new OcrError(
      /heic|heif/i.test(file.type) || (file instanceof File && /\.hei[cf]$/i.test(file.name))
        ? 'Esta fotografia está no formato HEIC, que este navegador não consegue abrir. Use o botão de fotografar ou guarde a fotografia como JPEG.'
        : 'Não foi possível abrir esta fotografia. Experimente tirar outra.',
    );
  } finally {
    URL.revokeObjectURL(url);
  }
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

  // Um só canvas já do tamanho final: rodar, recortar e reduzir com uma transformação. Um
  // canvas intermédio do tamanho da fotografia (12 a 50 MP) passa o limite de memória de alguns
  // telemóveis e a leitura falha.
  const out = document.createElement('canvas');
  out.width = Math.max(1, Math.round(srcW * scale));
  out.height = Math.max(1, Math.round(srcH * scale));
  const o = out.getContext('2d', { willReadFrequently: true })!;
  o.fillStyle = '#fff';
  o.fillRect(0, 0, out.width, out.height);
  o.scale(scale, scale);
  o.translate(-Math.round(c.x * fullW) + fullW / 2, -Math.round(c.y * fullH) + fullH / 2);
  o.rotate((rotation * Math.PI) / 180);
  o.drawImage(image, -image.width / 2, -image.height / 2);
  o.setTransform(1, 0, 0, 1, 0, 0);
  if (enhance) grayscaleAndStretch(o, out.width, out.height);
  return out;
}

/**
 * Limites para o contraste automático: estica entre os percentis 2 e 98. Devolve undefined se a
 * imagem for quase toda de um só tom (papel branco com pouco texto): esticar aí punha tudo a preto.
 */
export function contrastRange(
  hist: ArrayLike<number>,
  total: number,
): [number, number] | undefined {
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]!) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]!) < total * 0.02; hi--);
  return hi - lo >= 32 ? [lo, hi] : undefined;
}

/** Tons de cinzento e contraste automático. */
function grayscaleAndStretch(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!);
    d[i] = g;
    hist[g]!++;
  }
  const range = contrastRange(hist, w * h);
  const [lo, hi] = range ?? [0, 255];
  const span = hi - lo;
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i]! - lo) * 255) / span));
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

/** Lê uma ou mais imagens (por exemplo, as páginas de um PDF digitalizado) pela ordem dada. */
export async function recognize(
  canvases: HTMLCanvasElement | HTMLCanvasElement[],
  onProgress: (p: OcrProgress) => void,
): Promise<string> {
  const pages = Array.isArray(canvases) ? canvases : [canvases];
  let page = 0;
  const { createWorker, OEM } = await import('tesseract.js');
  const worker = await createWorker('por', OEM.LSTM_ONLY, {
    workerPath: '/ocr/worker.min.js',
    corePath: '/ocr/core',
    langPath: '/ocr/lang',
    logger: (m: { status: string; progress: number }) => {
      const fase = PHASES[m.status] ?? 'A ler o texto';
      onProgress(
        m.status === 'recognizing text' && pages.length > 1
          ? {
              fase: `${fase} (página ${page + 1} de ${pages.length})`,
              progresso: (page + m.progress) / pages.length,
            }
          : { fase, progresso: m.progress },
      );
    },
  });
  try {
    const texts: string[] = [];
    for (; page < pages.length; page++) {
      const { data } = await worker.recognize(pages[page]!, { rotateAuto: true });
      texts.push(tidy(data.text));
    }
    return texts.join('\n\n');
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
