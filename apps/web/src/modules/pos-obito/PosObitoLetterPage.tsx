import { formatDateLong, formatDateShort, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { LetterForm } from '../../components/LetterForm';
import { db, type DeathProcess } from '../../db';
import { Link } from '../../router';
import { DevelopmentBanner } from './DevelopmentBanner';

const CHOICES = {
  pedido: [
    'Peço a cessação do contrato a partir da data do óbito ou, se não for possível, a partir da data em que receberem esta carta.',
    'Peço a mudança da titularidade do contrato para o meu nome, mantendo o serviço.',
  ],
};

/** Campos da carta preenchidos com o processo e, se vier de um bem do inventário, com a entidade. */
function prefill(p: DeathProcess, assetId: string | null) {
  const asset = p.bens.find((b) => b.id === assetId);
  return {
    data_carta: formatDateLong(todayInLisbon()),
    falecido_nome: p.nome ?? '',
    data_obito: formatDateLong(p.data_obito),
    entidade_nome: asset?.entidade ?? '',
    contrato: asset && asset.tipo === 'contrato' ? asset.descricao : '',
  };
}

export default function PosObitoLetterPage({ id, template }: { id: string; template: string }) {
  const p = useLiveQuery(() => db.processos_obito.get(id), [id]);
  const profile = useLiveQuery(() => db.perfil.get('perfil'), [], null);
  if (p === undefined || profile === null) return null;
  const assetId = new URLSearchParams(location.search).get('bem');
  return (
    <>
      <DevelopmentBanner />
      <LetterForm
        key={template}
        templateId={template}
        initial={prefill(p, assetId)}
        choices={template === 'pos-obito.cancelamento-contrato' ? CHOICES : undefined}
        profile={profile}
        filename={`carta-${template.replace('pos-obito.', '')}-${formatDateShort(todayInLisbon()).replaceAll('/', '-')}.pdf`}
        backTo={`/pos-obito/${p.id}`}
        crumbs={
          <>
            <Link to="/">Início</Link> › <Link to="/pos-obito">Depois de um falecimento</Link> ›{' '}
            <Link to={`/pos-obito/${p.id}`}>{p.nome || 'Falecimento'}</Link>
          </>
        }
      />
    </>
  );
}
