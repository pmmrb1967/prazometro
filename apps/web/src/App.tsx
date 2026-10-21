import { lazy, Suspense } from 'react';
import { AccessibilityBar } from './components/AccessibilityBar';
import { InstallPrompt } from './components/InstallPrompt';
import { CartasList } from './modules/cartas/CartasList';
import { LetterDetail } from './modules/cartas/LetterDetail';
import { LegalNotice } from './components/LegalNotice';
import { Complaint } from './modules/garantia/Complaint';
import { GarantiaList } from './modules/garantia/GarantiaList';
import { PurchaseDetail } from './modules/garantia/PurchaseDetail';
import { PurchaseForm } from './modules/garantia/PurchaseForm';
import { RequestDetail } from './modules/sns/RequestDetail';
import { RequestForm } from './modules/sns/RequestForm';
import { SnsList } from './modules/sns/SnsList';
import { MODULES } from './modules';
import { previewEnabled } from './modules/pos-obito/preview';
import { ProcessDetail } from './modules/pos-obito/ProcessDetail';
import { ProcessForm } from './modules/pos-obito/ProcessForm';
import { ProcessList } from './modules/pos-obito/ProcessList';
import { usePreferences } from './preferences';
import { Link, matchPath, usePageHeading, usePath } from './router';

// A página das cartas traz o gerador de PDF; só é descarregada quando é aberta.
const LetterPage = lazy(() => import('./modules/garantia/LetterPage'));
const SnsLetterPage = lazy(() => import('./modules/sns/SnsLetterPage'));
// A cópia na nuvem traz as passkeys e a cifra; também só quando é aberta.
const CloudPage = lazy(() => import('./cloud/CloudPage'));
const AdminPage = lazy(() => import('./admin/AdminPage'));
// A leitura de cartas traz a anonimização e a IA; o OCR só é carregado ao ler uma fotografia.
const NewLetter = lazy(() => import('./modules/cartas/NewLetter'));
const AiSettings = lazy(() => import('./modules/cartas/AiSettings'));
const PosObitoLetterPage = lazy(() => import('./modules/pos-obito/PosObitoLetterPage'));

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
        {MODULES.map((m) => {
          const open = m.available || (m.preview && previewEnabled());
          return (
            <li key={m.id}>
              <article className="module" aria-labelledby={`mod-${m.id}`}>
                <h2 id={`mod-${m.id}`}>
                  {open ? (
                    <Link to={`/${m.id}`} className="module-link">
                      {m.title}
                    </Link>
                  ) : (
                    m.title
                  )}
                </h2>
                <p>{m.summary}</p>
                {!open && <span className="soon">Em breve</span>}
                {open && !m.available && <span className="soon">Pré-visualização</span>}
              </article>
            </li>
          );
        })}
      </ul>

      <p className="cloud-link">
        <Link to="/copia">Cópia na nuvem, cifrada</Link>: para não perder os dados se mudar de
        telemóvel.
      </p>

      <LegalNotice />
    </>
  );
}

/** Módulo à espera de revisão jurídica, fora da pré-visualização. */
function NotReady() {
  const heading = usePageHeading<HTMLHeadingElement>('Em preparação');
  return (
    <>
      <h1 ref={heading} tabIndex={-1}>
        Em preparação
      </h1>
      <p>Este tema ainda está a ser revisto por um jurista e vai ficar disponível em breve.</p>
      <p>
        <Link to="/">Voltar ao início</Link>
      </p>
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
  if (path === '/sns') return <SnsList />;
  if (path === '/sns/novo') return <RequestForm />;
  if ((m = matchPath('/sns/:id/editar', path))) return <RequestForm id={m.id} />;
  if ((m = matchPath('/sns/:id/carta/:template', path)))
    return <SnsLetterPage id={m.id!} template={m.template!} />;
  if ((m = matchPath('/sns/:id', path))) return <RequestDetail id={m.id!} />;
  if (path === '/cartas') return <CartasList />;
  if (path === '/cartas/nova') return <NewLetter />;
  if (path === '/cartas/ia') return <AiSettings />;
  if ((m = matchPath('/cartas/:id', path))) return <LetterDetail id={m.id!} />;
  if (path === '/pos-obito' || path.startsWith('/pos-obito/')) {
    if (!previewEnabled()) return <NotReady />;
    if (path === '/pos-obito') return <ProcessList />;
    if (path === '/pos-obito/novo') return <ProcessForm />;
    if ((m = matchPath('/pos-obito/:id/editar', path))) return <ProcessForm id={m.id} />;
    if ((m = matchPath('/pos-obito/:id/carta/:template', path)))
      return <PosObitoLetterPage id={m.id!} template={m.template!} />;
    if ((m = matchPath('/pos-obito/:id', path))) return <ProcessDetail id={m.id!} />;
  }
  if (path === '/copia') return <CloudPage />;
  if (path === '/admin') return <AdminPage />;
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
