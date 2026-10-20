import { lazy, Suspense } from 'react';
import { AccessibilityBar } from './components/AccessibilityBar';
import { InstallPrompt } from './components/InstallPrompt';
import { LegalNotice } from './components/LegalNotice';
import { Complaint } from './modules/garantia/Complaint';
import { GarantiaList } from './modules/garantia/GarantiaList';
import { PurchaseDetail } from './modules/garantia/PurchaseDetail';
import { PurchaseForm } from './modules/garantia/PurchaseForm';
import { MODULES } from './modules';
import { usePreferences } from './preferences';
import { Link, matchPath, usePageHeading, usePath } from './router';

// A página das cartas traz o gerador de PDF; só é descarregada quando é aberta.
const LetterPage = lazy(() => import('./modules/garantia/LetterPage'));

function Home() {
  const heading = usePageHeading<HTMLHeadingElement>('Início');
  return (
    <>
      <section className="intro">
        <h1 ref={heading} tabIndex={-1}>
          O que precisa de resolver?
        </h1>
        <p>
          Escolha um tema. A app diz-lhe até quando pode agir e o que deve fazer. É gratuita e não
          precisa de criar conta.
        </p>
      </section>

      <InstallPrompt />

      <ul className="modules">
        {MODULES.map((m) => (
          <li key={m.id}>
            <article className="module" aria-labelledby={`mod-${m.id}`}>
              <h2 id={`mod-${m.id}`}>
                {m.available ? (
                  <Link to={`/${m.id}`} className="module-link">
                    {m.title}
                  </Link>
                ) : (
                  m.title
                )}
              </h2>
              <p>{m.summary}</p>
              {!m.available && <span className="soon">Em breve</span>}
            </article>
          </li>
        ))}
      </ul>

      <LegalNotice />
    </>
  );
}

function NotFound() {
  const heading = usePageHeading<HTMLHeadingElement>('Página não encontrada');
  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        Página não encontrada
      </h1>
      <p>
        <Link to="/">Voltar ao início</Link>
      </p>
    </>
  );
}

function Routes({ path }: { path: string }) {
  let m: Record<string, string> | null;
  if (path === '/') return <Home />;
  if (path === '/garantia') return <GarantiaList />;
  if (path === '/garantia/nova') return <PurchaseForm />;
  if ((m = matchPath('/garantia/:id/editar', path))) return <PurchaseForm id={m.id} />;
  if ((m = matchPath('/garantia/:id/reclamar', path))) return <Complaint id={m.id!} />;
  if ((m = matchPath('/garantia/:id/carta/:template', path)))
    return <LetterPage id={m.id!} template={m.template!} />;
  if ((m = matchPath('/garantia/:id', path))) return <PurchaseDetail id={m.id!} />;
  return <NotFound />;
}

export function App() {
  const [prefs, setPrefs] = usePreferences();
  const path = usePath();

  return (
    <>
      <a className="skip" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="top">
        <Link to="/" className="brand">
          <img src="/logo.svg" alt="" width="48" height="48" />
          <span className="brand-name">Prazómetro</span>
        </Link>
        <AccessibilityBar prefs={prefs} onChange={setPrefs} />
      </header>

      <main id="conteudo" className="page">
        <Suspense fallback={<p>A carregar…</p>}>
          <Routes path={path} />
        </Suspense>
      </main>
    </>
  );
}
