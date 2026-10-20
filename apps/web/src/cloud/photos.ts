import type { StoredFile } from '../db';

// Comprime as fotografias das faturas antes de irem para a cópia na nuvem (WebP, até 1600 px).
// Os PDF e o que não for imagem seguem como estão. O original no dispositivo não muda.

const MAX_SIDE = 1600;
const QUALITY = 0.7;

export async function compressPhoto(f: StoredFile): Promise<StoredFile> {
  if (!f.tipo.startsWith('image/') || f.tipo === 'image/svg+xml') return f;
  try {
    const bitmap = await createImageBitmap(f.blob);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
    // Alguns navegadores não geram WebP e devolvem PNG, que pode ficar maior.
    if (blob.type !== 'image/webp' || blob.size >= f.blob.size) return f;
    return { ...f, nome: f.nome.replace(/\.\w+$/, '') + '.webp', tipo: 'image/webp', blob };
  } catch {
    return f;
  }
}
