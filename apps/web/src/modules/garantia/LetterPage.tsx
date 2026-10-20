import { fillTemplate } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { db, type Profile, type Purchase } from '../../db';
import { downloadBlob, slug } from '../../download';
import { Link, usePageHeading } from '../../router';
import { CHOICES, letterPdf, prefill, TEMPLATES } from './letters';

// Campos que se escrevem em várias linhas.
const MULTILINE = new Set(['morada', 'loja_morada', 'descricao_defeito']);

export default function LetterPage({ id, template }: { id: string; template: string }) {
  const p = useLiveQuery(() => db.compras.get(id), [id]);
  const profile = useLiveQuery(() => db.perfil.get('perfil'), [], null);
  if (p === undefined || profile === null) return null;
  return <LetterForm key={template} p={p} profile={profile} templateId={template} />;
}

function LetterForm({
  p,
  profile,
  templateId,
}: {
  p: Purchase;
  profile?: Profile;
  templateId: string;
}) {
  const t = TEMPLATES[templateId];
  const heading = usePageHeading<HTMLHeadingElement>(t?.meta.titulo ?? 'Carta');
  const choices = CHOICES[templateId] ?? {};
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v = prefill(p, profile);
    for (const [field, options] of Object.entries(choices)) v[field] = options[0]!;
    return v;
  });
  const [remember, setRemember] = useState(!!profile);
  const [status, setStatus] = useState<{ kind: 'ok' | 'erro'; text: string }>();
  const [busy, setBusy] = useState(false);

  if (!t) {
    return (
      <>
        <h1 ref={heading} tabIndex={-1}>
          Carta não encontrada
        </h1>
        <Link to={`/garantia/${p.id}/reclamar`}>Voltar</Link>
      </>
    );
  }

  const { texto, em_falta } = fillTemplate(t, values);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  async function download() {
    setStatus(undefined);
    if (em_falta.length) {
      setStatus({ kind: 'erro', text: 'Preencha os campos assinalados antes de descarregar.' });
      return;
    }
    setBusy(true);
    try {
      if (remember) {
        await db.perfil.put({
          id: 'perfil',
          nome: values.nome ?? '',
          morada: values.morada ?? '',
          local: values.local ?? '',
        });
      } else if (profile) {
        await db.perfil.delete('perfil');
      }
      const blob = await letterPdf(texto, t!.meta.titulo);
      downloadBlob(blob, `carta-${slug(p.produto)}.pdf`);
      setStatus({
        kind: 'ok',
        text: 'Carta descarregada. Envie-a por carta registada com aviso de receção ou por email, e depois registe a data de envio.',
      });
    } catch (e) {
      const chars = (e as { chars?: string[] }).chars;
      setStatus({
        kind: 'erro',
        text: chars
          ? `A carta não consegue mostrar estes caracteres: ${chars.join(' ')}. Escreva esses dados com letras do alfabeto latino.`
          : 'Não foi possível criar o PDF. Tente outra vez.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/garantia">Garantias</Link> ›{' '}
        <Link to={`/garantia/${p.id}`}>{p.produto}</Link> ›{' '}
        <Link to={`/garantia/${p.id}/reclamar`}>Reclamar</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {t.meta.titulo}
      </h1>
      <p className="lead">
        Confirme os dados. A carta é um modelo: leia-a antes de enviar e adapte-a se for preciso.
      </p>

      <div className="letter-layout">
        <form className="form" onSubmit={(e) => e.preventDefault()}>
          {t.meta.campos.map((c) => {
            const options = choices[c.id];
            const missing = em_falta.includes(c.id);
            if (options) {
              return (
                <fieldset key={c.id} className="choice">
                  <legend>{c.rotulo}</legend>
                  {options.map((o) => (
                    <label key={o}>
                      <input
                        type="radio"
                        name={c.id}
                        checked={values[c.id] === o}
                        onChange={() => set(c.id, o)}
                      />
                      {o.charAt(0).toUpperCase() + o.slice(1)}
                    </label>
                  ))}
                </fieldset>
              );
            }
            const props = {
              id: `campo-${c.id}`,
              value: values[c.id] ?? '',
              'aria-invalid': missing || undefined,
              onChange: (e: { target: { value: string } }) => set(c.id, e.target.value),
            };
            return (
              <label key={c.id} className={`field${missing ? ' missing' : ''}`}>
                {c.rotulo}
                {MULTILINE.has(c.id) ? <textarea rows={3} {...props} /> : <input {...props} />}
                {missing && <span className="field-error">Falta preencher.</span>}
              </label>
            );
          })}

          <label className="check">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Guardar o meu nome e morada neste dispositivo, para as próximas cartas
          </label>

          <div className="actions">
            <button type="button" className="primary" onClick={download} disabled={busy}>
              {busy ? 'A preparar a carta…' : 'Descarregar a carta em PDF'}
            </button>
          </div>
          {status && (
            <p className={status.kind === 'ok' ? 'ok' : 'errors'} role="status">
              {status.text}
            </p>
          )}
        </form>

        <section className="letter-preview" aria-labelledby="previa">
          <h2 id="previa">Pré-visualização</h2>
          <pre>{texto.replace(/^#+\s*/gm, '')}</pre>
        </section>
      </div>

      <LegalNotice />
    </>
  );
}
