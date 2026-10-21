import { formatDateShort, verificationStatus, type Rule } from '@prazometro/engine';
import { todayInLisbon } from '@prazometro/engine';
import { useState, type FormEvent } from 'react';
import { api } from '../cloud/api';

/** Fonte legal e data de verificação de cada regra usada (princípio 4). */
export function RuleSources({ rules }: { rules: Rule[] }) {
  const today = todayInLisbon();
  return (
    <details className="sources">
      <summary>De onde vêm estas datas</summary>
      <ul>
        {rules.map((r) => {
          const status = verificationStatus(r, today);
          return (
            <li key={r.id}>
              <p>
                <strong>{r.titulo}.</strong> {r.descricao}
              </p>
              <ul>
                {r.fontes.map((f) => (
                  <li key={f.artigo}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.titulo}
                    </a>
                    , artigo {f.artigo}
                  </li>
                ))}
              </ul>
              <p className="muted">
                Verificada em {formatDateShort(r.verificado_em)}.{' '}
                {status === 'a_verificar' && (
                  <strong>A verificar: passaram mais de 6 meses desde a última verificação.</strong>
                )}
                {status === 'a_rever' && (
                  <strong>
                    Em revisão: esta regra ainda está a ser confirmada por um jurista.
                  </strong>
                )}
              </p>
              <ReportRule ruleId={r.id} />
            </li>
          );
        })}
      </ul>
    </details>
  );
}

/** "Esta regra parece desatualizada": aviso anónimo ao admin, sem conta. */
function ReportRule({ ruleId }: { ruleId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(undefined);
    try {
      await api('/reports', { json: { rule_id: ruleId, message: text } });
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  if (state === 'sent') return <p className="ok">Obrigado. Vamos verificar esta regra.</p>;
  if (!open) {
    return (
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        Esta regra parece desatualizada?
      </button>
    );
  }
  return (
    <form className="form" onSubmit={submit}>
      <label className="field">
        O que mudou? Se souber, indique a lei nova ou a ligação.
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          minLength={10}
          maxLength={1000}
          required
        />
      </label>
      <p className="hint">Não escreva dados pessoais (nome, NIF, morada, saúde).</p>
      <div className="actions">
        <button type="submit" className="primary" disabled={state === 'sending'}>
          {state === 'sending' ? 'A enviar…' : 'Enviar aviso'}
        </button>
        <button type="button" onClick={() => setOpen(false)}>
          Cancelar
        </button>
      </div>
      {error && <p className="errors">{error}</p>}
    </form>
  );
}
