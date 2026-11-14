import { useState } from 'react';
import { useObjectUrl } from '../../useObjectUrl';

/** Miniatura da fatura (fotografia) ou ligação para o PDF. Ao tocar, abre em tamanho real. */
export function InvoicePreview({ blob, label }: { blob?: Blob | null; label: string }) {
  const url = useObjectUrl(blob);
  // Formatos que o navegador não mostra (por exemplo, HEIC): fica só a ligação.
  const [broken, setBroken] = useState<string>();
  if (!blob || !url) return null;
  const isImage = blob.type.startsWith('image/');
  const showImage = isImage && broken !== url;
  return (
    <figure className="invoice-preview">
      {showImage ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} onError={() => setBroken(url)} />
        </a>
      ) : null}
      <figcaption>
        <a href={url} target="_blank" rel="noreferrer">
          {isImage ? 'Ver a fotografia em tamanho real' : 'Abrir o PDF da fatura'}
        </a>
      </figcaption>
    </figure>
  );
}
