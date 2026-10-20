import { useLiveQuery } from 'dexie-react-hooks';
import { LetterForm } from '../../components/LetterForm';
import { db } from '../../db';
import { slug } from '../../download';
import { Link } from '../../router';
import { CHOICES, prefill } from './letters';

export default function LetterPage({ id, template }: { id: string; template: string }) {
  const p = useLiveQuery(() => db.compras.get(id), [id]);
  const profile = useLiveQuery(() => db.perfil.get('perfil'), [], null);
  if (p === undefined || profile === null) return null;
  return (
    <LetterForm
      key={template}
      templateId={template}
      initial={prefill(p)}
      choices={CHOICES[template]}
      profile={profile}
      filename={`carta-${slug(p.produto)}.pdf`}
      backTo={`/garantia/${p.id}/reclamar`}
      crumbs={
        <>
          <Link to="/">Início</Link> › <Link to="/garantia">Garantias</Link> ›{' '}
          <Link to={`/garantia/${p.id}`}>{p.produto}</Link> ›{' '}
          <Link to={`/garantia/${p.id}/reclamar`}>Reclamar</Link>
        </>
      }
    />
  );
}
