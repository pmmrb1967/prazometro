import { anonymize, describeRemoved, extract, type ExtractResult } from '@prazometro/ai';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { db, newId, type ReceivedLetter } from '../../db';
import { Link, navigate, usePageHeading } from '../../router';
import { loadSettings, PROVIDER_LABELS, providerCall, recordUse } from './aiConfig';
import { loadImage, prepare, recognize, type Crop, type OcrProgress, type Rotation } from './ocr';

type Step = 'fonte' | 'imagem' | 'texto' | 'confirmar';

/** Data da carta: a que a leitura diz ser a da carta, da emissão ou da notificação. */
function letterDate(r: ExtractResult['resultado']): string | undefined {
  return r.datas.find((d) => /notifica|carta|emiss|documento|expedi/i.test(d.descricao))?.data;
}

export default function NewLetter() {
  const heading = usePageHeading<HTMLHeadingElement>('Ler uma carta nova');
  const settings = useLiveQuery(() => db.ia.get('ia'));
  const profile = useLiveQuery(() => db.perfil.get('perfil'));
  const [step, setStep] = useState<Step>('fonte');
  const [image, setImage] = useState<ImageBitmap>();
  const [rotation, setRotation] = useState<Rotation>(0);
  const [crop, setCrop] = useState<Crop>();
  const [progress, setProgress] = useState<OcrProgress>();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileInput = useRef<HTMLInputElement>(null);

  const provider = settings?.fornecedor ?? 'none';
  const names = profile?.nome ? [profile.nome] : [];

  async function pickFile(file: File | undefined) {
    if (!file) return;
    setError(undefined);
    try {
      setImage(await loadImage(file));
      setRotation(0);
      setCrop(undefined);
      setStep('imagem');
    } catch {
      setError('Não foi possível abrir esta imagem. Experimente outra fotografia.');
    }
  }

  async function readImage() {
    if (!image) return;
    setBusy(true);
    setError(undefined);
    setProgress({ fase: 'A preparar a leitura', progresso: 0 });
    try {
      const result = await recognize(prepare(image, rotation, crop), setProgress);
      if (result.length < 20) {
        setError(
          'Quase não foi possível ler texto. Tire outra fotografia com mais luz, de frente e com a carta inteira, ou escreva o texto.',
        );
      }
      setText(result);
      setStep('texto');
    } catch {
      setError('A leitura falhou. Verifique a ligação à internet na primeira utilização.');
    } finally {
      setBusy(false);
      setProgress(undefined);
    }
  }

  async function understand() {
    setBusy(true);
    setError(undefined);
    try {
      const s = await loadSettings();
      const call = await providerCall(s);
      const r = await extract(text, s.fornecedor, call, { nomes: names });
      if (r.fornecedor !== 'none') await recordUse(r.fornecedor);
      const letter: ReceivedLetter = {
        ...r.resultado,
        id: newId(),
        texto: text,
        data_carta: letterDate(r.resultado),
        fornecedor: r.fornecedor,
        criado_em: new Date().toISOString(),
      };
      await db.cartas.add(letter);
      const query = r.aviso ? `?aviso=${encodeURIComponent(r.aviso)}` : '';
      navigate(`/cartas/${letter.id}${query}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const tooShort = text.trim().length < 20;

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/cartas">Perceber uma carta</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Ler uma carta nova
      </h1>

      {step === 'fonte' && (
        <>
          <p className="lead">
            Fotografe a carta de frente, com boa luz e com a folha inteira. Se a carta tiver várias
            páginas, comece pela que tem o prazo ou o pedido.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={() => fileInput.current?.click()}>
              Fotografar ou escolher a carta
            </button>
            <button type="button" onClick={() => setStep('texto')}>
              Escrever ou colar o texto
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <p className="hint">
            A fotografia é lida no seu telemóvel e não é enviada para lado nenhum. Na primeira vez,
            a app descarrega cerca de 13 MB para conseguir ler texto em português.
          </p>
        </>
      )}

      {step === 'imagem' && image && (
        <>
          <p>
            Se precisar, rode a imagem. Pode também arrastar o dedo sobre a imagem para escolher só
            a parte com texto.
          </p>
          <CropPreview image={image} rotation={rotation} crop={crop} onCrop={setCrop} />
          <div className="actions">
            <button
              type="button"
              onClick={() => {
                setRotation(((rotation + 90) % 360) as Rotation);
                setCrop(undefined);
              }}
              disabled={busy}
            >
              Rodar
            </button>
            {crop && (
              <button type="button" onClick={() => setCrop(undefined)} disabled={busy}>
                Usar a imagem inteira
              </button>
            )}
            <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}>
              Outra fotografia
            </button>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          <div className="actions">
            <button type="button" className="primary" onClick={readImage} disabled={busy}>
              {busy ? 'A ler…' : 'Ler o texto'}
            </button>
          </div>
          {progress && (
            <div className="ocr-progress">
              <label htmlFor="ocr-progress">{progress.fase}…</label>
              <progress id="ocr-progress" max={1} value={progress.progresso} />
            </div>
          )}
        </>
      )}

      {step === 'texto' && (
        <form
          className="form"
          onSubmit={(e) => {
            e.preventDefault();
            if (provider === 'none') understand();
            else setStep('confirmar');
          }}
        >
          <label className="field">
            Texto da carta
            <span className="hint">
              Confira o texto e corrija o que foi mal lido, sobretudo as datas e os valores.
            </span>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} required />
          </label>
          <div className="actions">
            <button type="submit" className="primary" disabled={busy || tooShort}>
              {busy ? 'A ler…' : 'Perceber a carta'}
            </button>
            {image && (
              <button type="button" onClick={() => setStep('imagem')}>
                Voltar à fotografia
              </button>
            )}
          </div>
          <p className="hint">
            Leitura: {PROVIDER_LABELS[provider]}. <Link to="/cartas/ia">Mudar</Link>
          </p>
        </form>
      )}

      {step === 'confirmar' && (
        <SendPreview
          text={text}
          names={names}
          providerLabel={PROVIDER_LABELS[provider]}
          busy={busy}
          onSend={understand}
          onBack={() => setStep('texto')}
        />
      )}

      {error && (
        <p className="errors" role="alert">
          {error}
        </p>
      )}

      <LegalNotice />
    </>
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
    <section aria-labelledby="enviar">
      <h2 id="enviar">Antes de enviar</h2>
      <p>
        Para perceber a carta, o texto vai ser enviado para: <strong>{providerLabel}</strong>. A app
        retirou: {describeRemoved(a.contagem)}. Confira se ficou algum dado pessoal (nome, morada,
        NIF, saúde) e, se ficou, volte atrás e apague-o.
      </p>
      <details className="sources" open>
        <summary>Texto que vai ser enviado</summary>
        <pre className="anonymized">{a.texto}</pre>
      </details>
      <div className="actions">
        <button type="button" className="primary" onClick={onSend} disabled={busy}>
          {busy ? 'A ler…' : 'Enviar e perceber a carta'}
        </button>
        <button type="button" onClick={onBack} disabled={busy}>
          Voltar ao texto
        </button>
      </div>
    </section>
  );
}

/** Pré-visualização da fotografia, com recorte por arrasto (rato, dedo ou caneta). */
function CropPreview({
  image,
  rotation,
  crop,
  onCrop,
}: {
  image: ImageBitmap;
  rotation: Rotation;
  crop?: Crop;
  onCrop: (c: Crop | undefined) => void;
}) {
  const [src, setSrc] = useState<string>();
  const start = useRef<{ x: number; y: number }>(undefined);
  const [drag, setDrag] = useState<Crop>();

  useEffect(() => {
    let url: string | undefined;
    let cancelled = false;
    prepare(image, rotation, undefined, { enhance: false }).toBlob(
      (blob) => {
        if (!blob || cancelled) return;
        url = URL.createObjectURL(blob);
        setSrc(url);
      },
      'image/jpeg',
      0.8,
    );
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [image, rotation]);

  const point = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): Crop => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  });
  const shown = drag ?? crop;

  return (
    <div
      className="crop"
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = point(e);
        setDrag(undefined);
      }}
      onPointerMove={(e) => start.current && setDrag(rect(start.current, point(e)))}
      onPointerUp={(e) => {
        if (!start.current) return;
        const r = rect(start.current, point(e));
        start.current = undefined;
        setDrag(undefined);
        if (r.w > 0.05 && r.h > 0.05) onCrop(r);
      }}
    >
      {src && <img src={src} alt="Fotografia da carta" draggable={false} />}
      {shown && (
        <div
          className="crop-box"
          style={{
            left: `${shown.x * 100}%`,
            top: `${shown.y * 100}%`,
            width: `${shown.w * 100}%`,
            height: `${shown.h * 100}%`,
          }}
        />
      )}
    </div>
  );
}
