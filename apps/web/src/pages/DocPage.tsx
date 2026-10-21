import legal from '../../../../docs/aviso-legal.md?raw';
import privacy from '../../../../docs/privacidade.md?raw';
import terms from '../../../../docs/termos.md?raw';
import { Markdown } from '../components/Markdown';
import { Link, usePageHeading } from '../router';

// Páginas de texto lidas de docs/: o mesmo texto serve o repositório e a app.

export const DOCS = {
  privacidade: { titulo: 'Política de privacidade', texto: privacy },
  termos: { titulo: 'Termos de utilização', texto: terms },
  'aviso-legal': { titulo: 'Aviso legal', texto: legal },
};

export function DocPage({ doc }: { doc: keyof typeof DOCS }) {
  const { titulo, texto } = DOCS[doc];
  const heading = usePageHeading<HTMLHeadingElement>(titulo);
  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {titulo}
      </h1>
      <article className="doc">
        <Markdown source={texto} />
      </article>
    </>
  );
}
