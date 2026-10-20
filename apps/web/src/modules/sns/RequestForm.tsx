import { isValidDate, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Choice } from '../../components/Choice';
import { LegalNotice } from '../../components/LegalNotice';
import { db, newId, type Area, type Priority, type WaitRequest, type WaitType } from '../../db';
import { Link, navigate, usePageHeading } from '../../router';
import {
  AREAS,
  EXAMS,
  needsArea,
  priorityOptions,
  PRIORITIES,
  startField,
  startLabel,
  TYPE_SHORT,
  TYPES,
} from './labels';

type Draft = {
  tipo: WaitType;
  descricao: string;
  instituicao: string;
  area: Area;
  prioridade: Priority;
  exame: string;
  data_inicio: string;
  data_marcada: string;
  notas: string;
};

function draftFrom(r?: WaitRequest): Draft {
  return {
    tipo: r?.tipo ?? 'consulta_hospitalar',
    descricao: r?.descricao ?? '',
    instituicao: r?.instituicao ?? '',
    area: r?.area ?? 'geral',
    prioridade: r?.prioridade ?? 'nao_sei',
    exame: r?.exame ?? 'tac',
    data_inicio: (r?.data_indicacao ?? r?.data_pedido) || todayInLisbon(),
    data_marcada: r?.data_marcada ?? '',
    notas: r?.notas ?? '',
  };
}

function validate(d: Draft): string[] {
  const errors: string[] = [];
  const today = todayInLisbon();
  if (!isValidDate(d.data_inicio))
    errors.push(`Indique a ${startLabel(d.tipo).label.toLowerCase()}.`);
  else if (d.data_inicio > today) errors.push('A data do pedido não pode ser no futuro.');
  if (d.data_marcada && !isValidDate(d.data_marcada)) errors.push('A data marcada não é válida.');
  else if (d.data_marcada && d.data_marcada < d.data_inicio)
    errors.push('A data marcada não pode ser antes do pedido.');
  return errors;
}

export function RequestForm({ id }: { id?: string }) {
  const existing = useLiveQuery(() => (id ? db.pedidos_sns.get(id) : undefined), [id]);
  if (id && existing === undefined) return null;
  return <RequestFormInner key={id ?? 'novo'} existing={existing} />;
}

function RequestFormInner({ existing }: { existing?: WaitRequest }) {
  const editing = !!existing;
  const heading = usePageHeading<HTMLHeadingElement>(editing ? 'Alterar pedido' : 'Novo pedido');
  const [d, setD] = useState<Draft>(() => draftFrom(existing));
  const [errors, setErrors] = useState<string[]>([]);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  const priorities = priorityOptions(d.tipo);
  const start = startLabel(d.tipo);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(d);
    setErrors(errs);
    if (errs.length) {
      document.getElementById('form-errors')?.focus();
      return;
    }
    const field = startField(d.tipo);
    const prioridade = priorities.includes(d.prioridade) ? d.prioridade : 'nao_sei';
    const exame = d.tipo === 'exame' ? EXAMS.find(([v]) => v === d.exame) : undefined;
    const request: WaitRequest = {
      ...(existing ?? { id: newId(), criado_em: todayInLisbon() }),
      tipo: d.tipo,
      descricao:
        d.descricao.trim() || (exame && exame[0] !== 'outro' ? exame[1] : TYPE_SHORT[d.tipo]),
      instituicao: d.instituicao.trim() || undefined,
      area: needsArea(d.tipo) ? d.area : undefined,
      prioridade: priorities.length ? prioridade : undefined,
      exame: d.tipo === 'exame' ? d.exame : undefined,
      data_pedido: field === 'data_pedido' ? d.data_inicio : undefined,
      data_indicacao: field === 'data_indicacao' ? d.data_inicio : undefined,
      data_marcada: d.data_marcada || undefined,
      notas: d.notas.trim() || undefined,
    };
    await db.pedidos_sns.put(request);
    navigate(`/sns/${request.id}`, { replace: !editing });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/sns">Espera no SNS</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {editing ? 'Alterar pedido' : 'Registar um pedido'}
      </h1>

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

        <Choice
          legend="O que está à espera?"
          name="tipo"
          value={d.tipo}
          options={TYPES}
          onChange={(v) => set('tipo', v)}
        />

        {d.tipo === 'exame' && (
          <Choice
            legend="Que exame ou tratamento?"
            name="exame"
            value={d.exame}
            options={EXAMS}
            onChange={(v) => set('exame', v)}
          />
        )}

        {needsArea(d.tipo) && (
          <Choice
            legend="É por causa de alguma destas doenças?"
            hint="Para estas doenças, os tempos máximos são diferentes."
            name="area"
            value={d.area}
            options={AREAS}
            onChange={(v) => set('area', v)}
          />
        )}

        {priorities.length > 0 && (
          <Choice
            legend="Que prioridade foi atribuída?"
            hint="A prioridade é decidida pelo médico do hospital. Pode vê-la na App SNS, na área pessoal do SNS 24 ou na mensagem de marcação. Se não souber, escolha «Não sei»: a app mostra os tempos de cada prioridade."
            name="prioridade"
            value={priorities.includes(d.prioridade) ? d.prioridade : 'nao_sei'}
            options={priorities.map((p) => [p, PRIORITIES[p]])}
            onChange={(v) => set('prioridade', v)}
          />
        )}

        <label className="field">
          {start.label}
          <input
            id="data_inicio"
            type="date"
            value={d.data_inicio}
            max={todayInLisbon()}
            onChange={(e) => set('data_inicio', e.target.value)}
          />
        </label>
        <p className="hint">{start.hint}</p>

        <label className="field">
          Descrição{' '}
          <span className="optional">(opcional, por exemplo «consulta de Ortopedia»)</span>
          <input
            id="descricao"
            value={d.descricao}
            onChange={(e) => set('descricao', e.target.value)}
            autoComplete="off"
          />
        </label>

        <label className="field">
          Hospital ou centro de saúde{' '}
          <span className="optional">(opcional, serve para as cartas)</span>
          <input
            id="instituicao"
            value={d.instituicao}
            onChange={(e) => set('instituicao', e.target.value)}
          />
        </label>

        <label className="field">
          Data já marcada <span className="optional">(opcional, se já tiver)</span>
          <input
            id="data_marcada"
            type="date"
            value={d.data_marcada}
            min={d.data_inicio}
            onChange={(e) => set('data_marcada', e.target.value)}
          />
        </label>

        <label className="field">
          Notas <span className="optional">(opcional)</span>
          <textarea
            id="notas"
            rows={3}
            value={d.notas}
            onChange={(e) => set('notas', e.target.value)}
          />
        </label>

        <div className="actions">
          <button type="submit" className="primary">
            Guardar
          </button>
          <Link to={existing ? `/sns/${existing.id}` : '/sns'} className="button">
            Cancelar
          </Link>
        </div>
      </form>
      <LegalNotice />
    </>
  );
}
