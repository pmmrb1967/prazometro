import { fillTemplate } from '@prazometro/engine';
import { useState, type ReactNode } from 'react';
import { db, type Profile } from '../db';
import { downloadBlob } from '../download';
import { letterPdf, TEMPLATES } from '../letters';
import { Link, usePageHeading } from '../router';
import { LegalNotice } from './LegalNotice';

// Campos que se escrevem em várias linhas.
const MULTILINE = new Set([
  'morada',
  'loja_morada',
  'entidade_morada',
  'descricao_defeito',
  'situacao',
]);

type Props = {
  templateId: string;
  /** Valores já preenchidos a partir dos dados do módulo. */
  initial: Record<string, string>;
  /** Respostas prontas para campos de escolha (o texto entra na carta). */
  choices?: Record<string, string[]>;
  profile?: Profile;
  filename: string;
  crumbs: ReactNode;
  backTo: string;
};

/** Formulário e pré-visualização de uma carta, com descarga em PDF gerado no dispositivo. */
export function LetterForm({
  templateId,
  initial,
  choices = {},
  profile,
  filename,
  crumbs,
  backTo,
}: Props) {
  const t = TEMPLATES[templateId];
  const heading = usePageHeading<HTMLHeadingElement>(t?.meta.titulo ?? 'Carta');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {
      nome: profile?.nome ?? '',
      morada: profile?.morada ?? '',
      local: profile?.local ?? '',
      numero_utente: profile?.numero_utente ?? '',
      ...initial,
    };
    for (const [field, options] of Object.entries(choices)) v[field] ??= options[0]!;
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
        <Link to={backTo}>Voltar</Link>
      </>
    );
  }

  const { texto, em_falta } = fillTemplate(t, values);
  const set = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));
  const usesUtente = t.meta.campos.some((c) => c.id === 'numero_utente');

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
          numero_utente: usesUtente ? values.numero_utente : profile?.numero_utente,
        });
      } else if (profile) {
        await db.perfil.delete('perfil');
      }
      downloadBlob(await letterPdf(texto, t!.meta.titulo), filename);
      setStatus({
        kind: 'ok',
        text: 'Carta descarregada. Envie-a por carta registada com aviso de receção ou por email, e guarde o comprovativo.',
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
        {crumbs}
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
            {usesUtente
              ? 'Guardar o meu nome, morada e número de utente neste dispositivo, para as próximas cartas'
              : 'Guardar o meu nome e morada neste dispositivo, para as próximas cartas'}
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
