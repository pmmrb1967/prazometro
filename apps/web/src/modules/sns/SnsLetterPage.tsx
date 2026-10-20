import { formatDateLong, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { LetterForm } from '../../components/LetterForm';
import { db, type WaitRequest } from '../../db';
import { slug } from '../../download';
import { Link } from '../../router';
import { SNS_RULES } from './rules';
import { tmrgText, waitStatus } from './waiting';

/** Campos da carta preenchidos com o pedido e com o tempo máximo calculado pelo motor. */
function prefill(r: WaitRequest) {
  const today = todayInLisbon();
  const s = waitStatus(r, SNS_RULES, today);
  const inicio = r.data_indicacao ?? r.data_pedido;
  const situacao = [
    ...(r.data_marcada && s.marcadaDepois !== undefined
      ? [`A data marcada, ${formatDateLong(r.data_marcada)}, fica depois desse prazo.`]
      : []),
    'Até hoje, ainda não fui atendido nem tenho data marcada.',
    'Até hoje, ainda não fui atendido.',
  ];
  return {
    initial: {
      instituicao: r.instituicao ?? '',
      data_carta: formatDateLong(today),
      cuidado: r.descricao,
      data_inicio: inicio ? formatDateLong(inicio) : '',
      tmrg: s.rule ? tmrgText(s.rule) : '',
      data_limite: s.prazo ? formatDateLong(s.prazo) : '',
    },
    choices: { situacao },
  };
}

export default function SnsLetterPage({ id, template }: { id: string; template: string }) {
  const r = useLiveQuery(() => db.pedidos_sns.get(id), [id]);
  const profile = useLiveQuery(() => db.perfil.get('perfil'), [], null);
  if (r === undefined || profile === null) return null;
  const { initial, choices } = prefill(r);
  return (
    <LetterForm
      key={template}
      templateId={template}
      initial={initial}
      choices={template === 'sns.reclamacao' ? choices : undefined}
      profile={profile}
      filename={`carta-sns-${slug(r.descricao)}-${formatDateShort(todayInLisbon()).replaceAll('/', '-')}.pdf`}
      backTo={`/sns/${r.id}`}
      crumbs={
        <>
          <Link to="/">Início</Link> › <Link to="/sns">Espera no SNS</Link> ›{' '}
          <Link to={`/sns/${r.id}`}>{r.descricao}</Link>
        </>
      }
    />
  );
}
