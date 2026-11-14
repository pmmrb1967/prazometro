import { anonymize, describeRemoved, readInvoice, type InvoiceResult } from '@prazometro/ai';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '../../db';
import { Link } from '../../router';
import { InvoicePreview } from './InvoicePreview';
import { loadSettings, PROVIDER_LABELS, providerCall, recordUse } from '../cartas/aiConfig';
import { loadImage, OcrError, prepare, recognize, type OcrProgress } from '../cartas/ocr';
import { PdfError, readPdf } from '../cartas/pdf';

// Fatura no topo do registo da compra: fica guardada só no dispositivo e, se a pessoa quiser,
// preenche o formulário. A leitura sem IA corre toda no telemóvel; com IA, mostra antes o
// texto anonimizado que vai sair. Tudo o que for preenchido é para confirmar.

type Step = 'inicio' | 'lido' | 'confirmar';

export function InvoiceAutofill({
  file,
  storedId,
  onFile,
  onFill,
}: {
  file: File | null;
  /** Fatura já guardada na compra (ao alterar). */
  storedId?: string;
  onFile: (f: File) => void;
  onFill: (r: InvoiceResult) => void;
}) {
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const profile = useLiveQuery(() => db.perfil.get('perfil'));
  const stored = useLiveQuery(
    () => (storedId ? db.ficheiros.get(storedId) : undefined),
    [storedId],
  );
  const [step, setStep] = useState<Step>('inicio');
  const [text, setText] = useState('');
  const [progress, setProgress] = useState<OcrProgress>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState<string>();
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const provider = settings?.fornecedor ?? 'none';
  const names = profile?.nome ? [profile.nome] : [];

  function pick(f: File | undefined) {
    if (!f) return;
    onFile(f);
    void read(f);
  }

  async function read(f: File) {
    setError(undefined);
    setDone(undefined);
    setBusy(true);
    setProgress({ fase: 'A preparar a leitura', progresso: 0 });
    try {
      let read: string;
      if (f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) {
        const pdf = await readPdf(f);
        read = pdf.tipo === 'texto' ? pdf.texto : await recognize(pdf.paginas, setProgress);
      } else {
        read = await recognize(prepare(await loadImage(f), 0), setProgress);
      }
      setText(read);
      if (read.trim().length < 20) {
        setError(
          'Quase não foi possível ler a fatura. A fatura fica guardada, mas preencha os campos à mão (ou tire outra fotografia com mais luz).',
        );
        setStep('inicio');
      } else {
        setStep('lido');
      }
    } catch (err) {
      // Só o tipo de erro, nunca o conteúdo da fatura.
      console.warn('Leitura da fatura falhou:', (err as Error)?.name, (err as Error)?.message);
      setError(
        err instanceof PdfError || err instanceof OcrError
          ? `${err.message} A fatura fica guardada na mesma.`
          : 'Não foi possível ler a fatura. Na primeira vez, a leitura precisa de internet para descarregar o português. Pode tentar outra vez ou preencher os campos à mão: a fatura fica guardada na mesma.',
      );
      setStep('inicio');
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  }

  async function fill(withAi: boolean) {
    setBusy(true);
    setError(undefined);
    try {
      const s = await loadSettings();
      const call = withAi ? await providerCall(s) : undefined;
      const r = await readInvoice(text, withAi ? s.fornecedor : 'none', call, { nomes: names });
      if (r.fornecedor !== 'none') await recordUse(r.fornecedor);
      onFill(r);
      const found = [
        r.resultado.produto && 'o produto',
        r.resultado.loja && 'a loja',
        r.resultado.data_compra && 'a data da compra',
        r.resultado.preco && 'o preço',
      ].filter(Boolean) as string[];
      setDone(
        (r.aviso ? `${r.aviso} ` : '') +
          (found.length
            ? `Preenchido: ${found.join(', ')}. Confirme tudo e escreva o que falta.${r.resultado.data_compra ? ' A data em que recebeu o bem ficou igual à da compra: se o recebeu noutro dia, mude-a, porque é dessa data que conta a garantia.' : ''}`
            : 'Não foi possível tirar dados da fatura. Preencha os campos à mão.'),
      );
      setStep('inicio');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const withAi = provider !== 'none';

  return (
    <section className="invoice-autofill" aria-labelledby="fatura-titulo">
      <h2 id="fatura-titulo">
        Tem a fatura? <span className="optional">(opcional)</span>
      </h2>
      <p>
        Fotografe a fatura ou escolha o PDF: a app preenche o que conseguir e guarda a fatura só
        neste dispositivo.
      </p>

      {step === 'inicio' && (
        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => camera.current?.click()}
            disabled={busy}
          >
            Fotografar a fatura
          </button>
          <button type="button" onClick={() => picker.current?.click()} disabled={busy}>
            Escolher fotografia ou PDF
          </button>
        </div>
      )}

      {progress && (
        <div className="ocr-progress">
          <label htmlFor="fatura-progresso">{progress.fase}…</label>
          <progress id="fatura-progresso" max={1} value={progress.progresso} />
        </div>
      )}

      {step === 'lido' && (
        <>
          <p>A fatura foi lida. Como quer preencher?</p>
          <div className="actions">
            {withAi && (
              <button
                type="button"
                className="primary"
                onClick={() => setStep('confirmar')}
                disabled={busy}
              >
                Preencher com IA ({PROVIDER_LABELS[provider]})
              </button>
            )}
            <button
              type="button"
              className={withAi ? undefined : 'primary'}
              onClick={() => fill(false)}
              disabled={busy}
            >
              {busy ? 'A preencher…' : 'Preencher sem IA'}
            </button>
            <button type="button" onClick={() => setStep('inicio')} disabled={busy}>
              Não preencher
            </button>
          </div>
          <p className="hint">
            Sem IA, a leitura fica no telemóvel e tenta a loja, a data e o preço. Com IA, também o
            produto. {!withAi && 'Para usar a IA, '}
            <Link to="/cartas/ia">{withAi ? 'Mudar a IA' : 'escolha-a nas definições'}</Link>.
          </p>
          <details className="sources">
            <summary>Ver o texto lido</summary>
            <pre className="anonymized">{text}</pre>
          </details>
        </>
      )}

      {step === 'confirmar' && (
        <SendPreview
          text={text}
          names={names}
          providerLabel={PROVIDER_LABELS[provider]}
          busy={busy}
          onSend={() => fill(true)}
          onBack={() => setStep('lido')}
        />
      )}

      {(file || stored) && step === 'inicio' && (
        <>
          <InvoicePreview
            blob={file ?? stored?.blob}
            label={file ? 'Fatura que vai ficar guardada' : 'Fatura guardada'}
          />
          <p className="hint">
            {file
              ? 'Esta é a fatura que fica guardada quando carregar em Guardar. Para a trocar, fotografe ou escolha outra.'
              : 'Já tem esta fatura guardada. Para a trocar, fotografe ou escolha outra.'}
          </p>
        </>
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
        id="fatura"
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

/** Mostra exatamente o que vai sair do dispositivo, já anonimizado, antes de enviar. */
function SendPreview({
  text,
  names,
  providerLabel,
  busy,
  onSend,
  onBack,
}: {
  text: string;
  names: string[];
  providerLabel: string;
  busy: boolean;
  onSend: () => void;
  onBack: () => void;
}) {
  const a = anonymize(text, { nomes: names });
  return (
    <>
      <p>
        Para preencher, o texto da fatura vai ser enviado para: <strong>{providerLabel}</strong>. A
        app retirou: {describeRemoved(a.contagem)}. A fotografia nunca é enviada.
      </p>
      <details className="sources">
        <summary>Texto que vai ser enviado</summary>
        <pre className="anonymized">{a.texto}</pre>
      </details>
      <div className="actions">
        <button type="button" className="primary" onClick={onSend} disabled={busy}>
          {busy ? 'A preencher…' : 'Enviar e preencher'}
        </button>
        <button type="button" onClick={onBack} disabled={busy}>
          Voltar
        </button>
      </div>
    </>
  );
}
