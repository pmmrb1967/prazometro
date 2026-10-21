import { isValidDate, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { db, newId, type DeathProcess } from '../../db';
import { Link, navigate, usePageHeading } from '../../router';
import { DevelopmentBanner } from './DevelopmentBanner';

type Draft = { nome: string; data_obito: string; data_registo_obito: string };

function validate(d: Draft): string[] {
  const errors: string[] = [];
  const today = todayInLisbon();
  if (!isValidDate(d.data_obito)) errors.push('Indique a data do óbito.');
  else if (d.data_obito > today) errors.push('A data do óbito não pode ser no futuro.');
  if (d.data_registo_obito) {
    if (!isValidDate(d.data_registo_obito)) errors.push('A data do registo não é válida.');
    else if (isValidDate(d.data_obito) && d.data_registo_obito < d.data_obito)
      errors.push('A data do registo não pode ser antes do óbito.');
    else if (d.data_registo_obito > today) errors.push('A data do registo não pode ser no futuro.');
  }
  return errors;
}

export function ProcessForm({ id }: { id?: string }) {
  const existing = useLiveQuery(() => (id ? db.processos_obito.get(id) : undefined), [id]);
  if (id && existing === undefined) return null;
  return <ProcessFormInner key={id ?? 'novo'} existing={existing} />;
}

function ProcessFormInner({ existing }: { existing?: DeathProcess }) {
  const editing = !!existing;
  const heading = usePageHeading<HTMLHeadingElement>(editing ? 'Alterar dados' : 'Começar');
  const [d, setD] = useState<Draft>({
    nome: existing?.nome ?? '',
    data_obito: existing?.data_obito ?? '',
    data_registo_obito: existing?.data_registo_obito ?? '',
  });
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(d);
    setErrors(errs);
    if (errs.length) {
      document.getElementById('form-errors')?.focus();
      return;
    }
    const p: DeathProcess = {
      ...(existing ?? { id: newId(), passos: {}, bens: [], criado_em: todayInLisbon() }),
      nome: d.nome.trim() || undefined,
      data_obito: d.data_obito,
      data_registo_obito: d.data_registo_obito || undefined,
    };
    await db.processos_obito.put(p);
    navigate(`/pos-obito/${p.id}`, { replace: !editing });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/pos-obito">Depois de um falecimento</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {editing ? 'Alterar dados' : 'Começar'}
      </h1>
      <DevelopmentBanner />

      <form className="form" onSubmit={onSubmit} noValidate>
        {errors.length > 0 && (
          <div id="form-errors" className="errors" tabIndex={-1} role="alert">
            <p>Falta corrigir:</p>
            <ul>
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="field">
          Data do óbito
          <input
            id="data_obito"
            type="date"
            value={d.data_obito}
            max={todayInLisbon()}
            onChange={(e) => set('data_obito', e.target.value)}
          />
        </label>

        <label className="field">
          Data do registo do óbito{' '}
          <span className="optional">(opcional, está na certidão de óbito)</span>
          <input
            id="data_registo_obito"
            type="date"
            value={d.data_registo_obito}
            max={todayInLisbon()}
            onChange={(e) => set('data_registo_obito', e.target.value)}
          />
        </label>
        <p className="hint">
          Alguns prazos da Segurança Social contam a partir do registo. Se não souber a data, a app
          conta a partir da data do óbito, que é a mais cedo.
        </p>

        <label className="field">
          Nome da pessoa que faleceu{' '}
          <span className="optional">(opcional, serve para as cartas)</span>
          <input
            id="nome"
            value={d.nome}
            onChange={(e) => set('nome', e.target.value)}
            autoComplete="off"
          />
        </label>

        <div className="actions">
          <button type="submit" className="primary">
            {editing ? 'Guardar' : 'Ver os passos'}
          </button>
          <Link to={editing ? `/pos-obito/${existing.id}` : '/pos-obito'} className="button">
            Cancelar
          </Link>
        </div>
      </form>

      <LegalNotice />
    </>
  );
}
