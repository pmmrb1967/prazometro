import { formatDateShort, isValidDate, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { LegalNotice } from '../../components/LegalNotice';
import { db } from '../../db';
import { Link, usePageHeading } from '../../router';
import { GARANTIA_RULES } from './rules';
import { warrantyStatus } from './warranty';

const LIVRO_RECLAMACOES = 'https://www.livroreclamacoes.pt/Inicio/';
const CNIACC = 'https://www.cniacc.pt/pt/';
const DGC = 'https://www.consumidor.gov.pt/';

function DateRecorder({
  label,
  value,
  onSave,
}: {
  label: string;
  value?: string;
  onSave: (date: string) => void;
}) {
  const [date, setDate] = useState(value ?? todayInLisbon());
  const [error, setError] = useState('');
  return (
    <form
      className="inline-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isValidDate(date) || date > todayInLisbon()) {
          setError('Escolha uma data até hoje.');
          return;
        }
        setError('');
        onSave(date);
      }}
    >
      <label className="field">
        {label}
        <input
          type="date"
          value={date}
          max={todayInLisbon()}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <button type="submit">Guardar a data</button>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

export function Complaint({ id }: { id: string }) {
  const p = useLiveQuery(() => db.compras.get(id), [id]);
  const heading = usePageHeading<HTMLHeadingElement>('Reclamar');
  if (p === undefined) return null;

  const today = todayInLisbon();
  const s = warrantyStatus(p, GARANTIA_RULES, today);
  const marcos = s.principal?.result.marcos ?? [];
  const rejeicao = marcos.find((m) => m.id === 'rejeicao');
  const presuncao = marcos.find((m) => m.id === 'fim-presuncao');
  const inRejectionWindow = !!rejeicao && today <= rejeicao.data;
  const afterPresumption = !!presuncao && today > presuncao.data;
  const presumptionDef = s.principal?.rule.marcos?.find((m) => m.id === 'fim-presuncao');
  const UNIT_SINGULAR = { dias: 'dia', meses: 'mês', anos: 'ano' } as const;
  const presumptionPassed = !presumptionDef
    ? ''
    : presumptionDef.quantidade === 1
      ? `Já passou o primeiro ${UNIT_SINGULAR[presumptionDef.unidade]}`
      : `Já passaram os primeiros ${presumptionDef.quantidade} ${presumptionDef.unidade}`;
  const reparacao = s.aposComunicacao.find((e) => e.rule.id === 'garantia.prazo-reparacao');
  const letter = (template: string) => `/garantia/${p.id}/carta/${template}`;

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/garantia">Garantias</Link> ›{' '}
        <Link to={`/garantia/${p.id}`}>{p.produto}</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Tenho um problema com: {p.produto}
      </h1>

      {s.estado === 'terminada' && (
        <div className="notice">
          <p>
            A garantia legal terminou em {formatDateShort(s.fim!)}. Se o defeito apareceu antes
            dessa data, ainda pode reclamar e deve dizê-lo na carta. Veja também se o fabricante dá
            uma garantia comercial mais longa.
          </p>
        </div>
      )}
      {afterPresumption && s.estado !== 'terminada' && (
        <div className="notice">
          <p>
            {presumptionPassed} depois da entrega, o tempo em que a lei presume que o defeito vinha
            de origem. A loja pode pedir-lhe que mostre que o defeito já existia quando recebeu o
            bem. Guarde fotografias, faturas de reparação e outros comprovativos.
          </p>
        </div>
      )}

      <ol className="steps">
        <li>
          <h2>Escreva à loja</h2>
          <p>
            Comunique o defeito por escrito, por carta registada com aviso de receção ou por email,
            e guarde o comprovativo. A app prepara a carta com os dados da compra.
          </p>
          {inRejectionWindow && (
            <p>
              <strong>
                O bem foi entregue há menos de 30 dias (até {formatDateShort(rejeicao!.data)}).
              </strong>{' '}
              Pode pedir logo a troca do bem ou a devolução do dinheiro, sem ter de aceitar uma
              reparação.
            </p>
          )}
          <div className="actions">
            {inRejectionWindow && (
              <Link to={letter('garantia.rejeicao')} className="button primary">
                Carta: pedir a troca ou o dinheiro de volta
              </Link>
            )}
            <Link
              to={letter('garantia.reparacao-substituicao')}
              className={`button${inRejectionWindow ? '' : ' primary'}`}
            >
              Carta: pedir a reparação ou a troca
            </Link>
          </div>
          <DateRecorder
            label="Em que dia enviou a carta ou o email?"
            value={p.data_comunicacao}
            onSave={(date) => db.compras.update(p.id, { data_comunicacao: date })}
          />
          {p.data_comunicacao && (
            <p>
              Data guardada: {formatDateShort(p.data_comunicacao)}.{' '}
              {reparacao && (
                <>
                  A loja deve reparar ou trocar o bem até{' '}
                  <strong>{formatDateShort(reparacao.result.prazo!)}</strong>.
                </>
              )}
            </p>
          )}
        </li>

        <li>
          <h2>Se a loja trocou o bem</h2>
          <p>Registe o dia em que recebeu o bem novo, para a app acompanhar a garantia dele.</p>
          <DateRecorder
            label="Em que dia recebeu o bem dado em troca?"
            value={p.data_entrega_substituto}
            onSave={(date) => db.compras.update(p.id, { data_entrega_substituto: date })}
          />
        </li>

        <li>
          <h2>Se a loja não resolveu</h2>
          <p>
            Se a loja não reparou nem trocou o bem em 30 dias, recusou, ou o defeito voltou, pode
            pedir uma redução do preço ou devolver o bem e receber o dinheiro de volta.
          </p>
          <div className="actions">
            <Link to={letter('garantia.reducao-resolucao')} className="button">
              Carta: pedir a redução do preço ou o dinheiro de volta
            </Link>
          </div>
        </li>

        <li>
          <h2>Se continuar sem resposta</h2>
          <ul className="links">
            <li>
              <a href={LIVRO_RECLAMACOES} target="_blank" rel="noreferrer">
                Livro de Reclamações Eletrónico
              </a>
              : faça a reclamação online contra a loja.
            </li>
            <li>
              <a href={CNIACC} target="_blank" rel="noreferrer">
                Centro Nacional de Informação e Arbitragem de Conflitos de Consumo (CNIACC)
              </a>{' '}
              ou o centro de arbitragem da sua região: ajudam a resolver o conflito com a loja, sem
              ir a tribunal. A lista oficial dos centros está no site da{' '}
              <a href={DGC} target="_blank" rel="noreferrer">
                Direção-Geral do Consumidor
              </a>
              .
            </li>
          </ul>
        </li>
      </ol>

      <LegalNotice />
    </>
  );
}
