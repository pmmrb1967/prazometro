import { readDeathCertificate, type DeathCertificateReading } from '@prazometro/ai';
import { useRef, useState } from 'react';
import { OcrError, type OcrProgress } from '../cartas/ocr';
import { PdfError } from '../cartas/pdf';
import { readDocumentText } from '../cartas/readDocument';

// Certidão de óbito no topo do "Começar": lê o nome e as datas para preencher o formulário.
// Tudo no dispositivo, sem IA, e a certidão não é guardada. O que for preenchido é para
// confirmar.

export function CertificateAutofill({ onFill }: { onFill: (r: DeathCertificateReading) => void }) {
  const [file, setFile] = useState<File>();
  const [progress, setProgress] = useState<OcrProgress>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  function pick(f: File | undefined) {
    if (!f) return;
    setFile(f);
    void read(f);
  }

  async function read(f: File) {
    setError(undefined);
    setDone(undefined);
    setBusy(true);
    setProgress({ fase: 'A preparar a leitura', progresso: 0 });
    try {
      const r = readDeathCertificate(await readDocumentText(f, setProgress));
      const found = [
        r.data_obito && 'a data do óbito',
        r.data_registo_obito && 'a data do registo',
        r.nome && 'o nome',
      ].filter(Boolean) as string[];
      if (found.length) {
        onFill(r);
        setDone(
          `Preenchido: ${found.join(', ')}. Confirme tudo com a certidão${found.length < 3 ? ' e escreva o que falta' : ''}.`,
        );
      } else {
        setError(
          'Não foi possível encontrar os dados na certidão. Tire outra fotografia, direita e com boa luz, ou preencha os campos à mão.',
        );
      }
    } catch (err) {
      // Só o tipo de erro, nunca o conteúdo da certidão.
      console.warn('Leitura da certidão falhou:', (err as Error)?.name, (err as Error)?.message);
      setError(
        err instanceof PdfError || err instanceof OcrError
          ? err.message
          : 'Não foi possível ler a certidão. Na primeira vez, a leitura precisa de internet para descarregar o português. Pode tentar outra vez ou preencher os campos à mão.',
      );
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  }

  return (
    <section className="invoice-autofill" aria-labelledby="certidao-titulo">
      <h2 id="certidao-titulo">
        Tem a certidão de óbito? <span className="optional">(opcional)</span>
      </h2>
      <p>
        Fotografe a certidão ou escolha o PDF: a app preenche as datas e o nome. A leitura é feita
        só neste dispositivo e a certidão não é enviada nem guardada.
      </p>

      <div className="actions">
        <button
          type="button"
          className="primary"
          onClick={() => camera.current?.click()}
          disabled={busy}
        >
          Fotografar a certidão
        </button>
        <button type="button" onClick={() => picker.current?.click()} disabled={busy}>
          Escolher fotografia ou PDF
        </button>
      </div>

      {progress && (
        <div className="ocr-progress">
          <label htmlFor="certidao-progresso">{progress.fase}…</label>
          <progress id="certidao-progresso" max={1} value={progress.progresso} />
        </div>
      )}

      {done && (
        <p className="ok" role="status">
          {done}
        </p>
      )}
      {error && (
        <div className="errors" role="alert">
          <p>{error}</p>
          {file && !busy && (
            <div className="actions">
              <button type="button" onClick={() => void read(file)}>
                Tentar ler outra vez
              </button>
            </div>
          )}
        </div>
      )}

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*,application/pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </section>
  );
}
