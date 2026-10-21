import { useEffect, useState } from 'react';
import { db, type ShareData, type ShareScope } from '../db';
import { Link, navigate, usePageHeading } from '../router';
import { parseInvite } from './shareCrypto';
import { fetchShare, SCOPE_LABELS } from './shares';

type State =
  | { kind: 'loading' }
  | { kind: 'error'; text: string }
  | {
      kind: 'ready';
      id: string;
      chave: string;
      ambito: ShareScope;
      versao: number;
      dados: ShareData;
      de?: string;
    };

function count(d: ShareData): string {
  const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
  if (d.compras) return n(d.compras.length, 'compra', 'compras');
  if (d.pedidos_sns) return n(d.pedidos_sns.length, 'pedido', 'pedidos');
  if (d.cartas) return n(d.cartas.length, 'carta', 'cartas');
  if (d.processos_obito) return n(d.processos_obito.length, 'processo', 'processos');
  return '';
}

/** Página aberta pela ligação de convite: /partilha#id.chave */
export default function AcceptShare() {
  const heading = usePageHeading<HTMLHeadingElement>('Partilha recebida');
  const [invite] = useState(() => parseInvite(location.hash));
  const [state, setState] = useState<State>(() =>
    invite
      ? { kind: 'loading' }
      : {
          kind: 'error',
          text: 'A ligação não está completa. Peça à pessoa que a envie outra vez, sem cortar nenhuma parte.',
        },
  );

  useEffect(() => {
    // A chave não fica no histórico do navegador.
    if (location.hash) history.replaceState(null, '', '/partilha');
    if (!invite) return;
    fetchShare(invite.id, invite.chave)
      .then((f) => {
        if (f.estado === 'nova') setState({ kind: 'ready', ...invite, ...f });
        else
          setState({
            kind: 'error',
            text: 'Esta partilha já não existe: a pessoa que a criou retirou o acesso.',
          });
      })
      .catch((e: Error) => setState({ kind: 'error', text: e.message }));
  }, [invite]);

  async function save() {
    if (state.kind !== 'ready') return;
    await db.partilhas_recebidas.put({
      id: state.id,
      chave: state.chave,
      ambito: state.ambito,
      estado: 'ativa',
      de: state.de,
      versao: state.versao,
      dados: state.dados,
      atualizada_em: new Date().toISOString(),
      recebida_em: new Date().toISOString(),
    });
    navigate(`/partilhas/${state.id}`, { replace: true });
  }

  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        Partilha recebida
      </h1>
      {state.kind === 'loading' && <p>A abrir a partilha…</p>}
      {state.kind === 'error' && (
        <>
          <p className="errors" role="alert">
            {state.text}
          </p>
          <p>
            <Link to="/">Ir para o início</Link>
          </p>
        </>
      )}
      {state.kind === 'ready' && (
        <>
          <p className="lead">
            {state.de ? `${state.de} partilhou consigo` : 'Partilharam consigo'}:{' '}
            <strong>{SCOPE_LABELS[state.ambito]}</strong> ({count(state.dados)}).
          </p>
          <p>
            Pode ver os prazos e o estado de cada item, mas não alterar nada. A partilha é
            atualizada sempre que abrir a app. Os dados ficam guardados só neste dispositivo.
          </p>
          <div className="actions">
            <button type="button" className="primary" onClick={save}>
              Guardar e ver
            </button>
            <Link to="/" className="button">
              Agora não
            </Link>
          </div>
        </>
      )}
    </>
  );
}
