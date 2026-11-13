import { lazy, Suspense, useEffect } from 'react';
import { useSignedIn } from './cloud/session';
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
import { ProcessDetail } from './modules/pos-obito/ProcessDetail';
import { ProcessForm } from './modules/pos-obito/ProcessForm';
import { ProcessList } from './modules/pos-obito/ProcessList';
import { usePreferences } from './preferences';
import { About } from './pages/About';
import { DocPage } from './pages/DocPage';
import { Feedback } from './pages/Feedback';
import { ReceivedList, ReceivedView } from './share/Received';
import { syncShares } from './share/shares';
import { Link, matchPath, navigate, usePageHeading, usePath } from './router';

// A página das cartas traz o gerador de PDF; só é descarregada quando é aberta.
const LetterPage = lazy(() => import('./modules/garantia/LetterPage'));
const SnsLetterPage = lazy(() => import('./modules/sns/SnsLetterPage'));
// A cópia na nuvem traz as passkeys e a cifra; também só quando é aberta.
const CloudPage = lazy(() => import('./cloud/CloudPage'));
const AdminPage = lazy(() => import('./admin/AdminPage'));
// A leitura de cartas traz a anonimização e a IA; o OCR só é carregado ao ler uma fotografia.
const NewLetter = lazy(() => import('./modules/cartas/NewLetter'));
const AiSettings = lazy(() => import('./modules/cartas/AiSettings'));
// A partilha traz a cifra e a conta; só quando é aberta.
const SharePage = lazy(() => import('./share/SharePage'));
const AcceptShare = lazy(() => import('./share/AcceptShare'));
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
          precisa de criar conta. <Link to="/sobre">Como funciona, com exemplos</Link>.
        </p>
      </section>

      <InstallPrompt />

      <ul className="modules">
        {MODULES.map((m) => {
          const open = m.available;
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
                {m.inDevelopment && <span className="soon">Em desenvolvimento</span>}
              </article>
            </li>
          );
        })}
      </ul>

      <p className="cloud-link">
        Sem conta, os dados ficam só neste dispositivo. <Link to="/conta">Com uma conta</Link>, pode
        guardar uma cópia cifrada e partilhar os prazos com a família.{' '}
        <Link to="/partilhas">Partilhas que recebeu</Link>.
      </p>

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

/** Endereço antigo: troca-o pelo novo sem deixar o antigo no histórico. */
function Redirect({ to }: { to: string }) {
  useEffect(() => navigate(to, { replace: true }), [to]);
  return null;
}

/** "Entrar" na barra de topo; "A minha conta" quando este dispositivo já tem sessão. */
function AccountLink() {
  const signedIn = useSignedIn();
  return (
    <Link to="/conta" className="button account-link">
      {signedIn ? 'A minha conta' : 'Entrar'}
    </Link>
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
    if (path === '/pos-obito') return <ProcessList />;
    if (path === '/pos-obito/novo') return <ProcessForm />;
    if ((m = matchPath('/pos-obito/:id/editar', path))) return <ProcessForm id={m.id} />;
    if ((m = matchPath('/pos-obito/:id/carta/:template', path)))
      return <PosObitoLetterPage id={m.id!} template={m.template!} />;
    if ((m = matchPath('/pos-obito/:id', path))) return <ProcessDetail id={m.id!} />;
  }
  if (path === '/sobre') return <About />;
  if (path === '/opiniao') return <Feedback />;
  if (path === '/privacidade') return <DocPage doc="privacidade" />;
  if (path === '/termos') return <DocPage doc="termos" />;
  if (path === '/aviso-legal') return <DocPage doc="aviso-legal" />;
  if (path === '/partilhar') return <SharePage />;
  if (path === '/partilha') return <AcceptShare />;
  if (path === '/partilhas') return <ReceivedList />;
  if ((m = matchPath('/partilhas/:id', path))) return <ReceivedView id={m.id!} />;
  if (path === '/conta') return <CloudPage />;
  if (path === '/copia') return <Redirect to="/conta" />;
  if (path === '/admin') return <AdminPage />;
  return <NotFound />;
}

export function App() {
  const [prefs, setPrefs] = usePreferences();
  const path = usePath();

  // Partilhas familiares: envia as alterações e vai buscar as recebidas ao abrir a app.
  useEffect(() => {
    syncShares();
  }, []);

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
        <div className="top-tools">
          <AccessibilityBar prefs={prefs} onChange={setPrefs} />
          <AccountLink />
        </div>
      </header>

      <main id="conteudo" className="page">
        <Suspense fallback={<p>A carregar…</p>}>
          <Routes path={path} />
        </Suspense>
      </main>

      <footer className="site-footer">
        <nav aria-label="Informação">
          <Link to="/sobre">Como funciona</Link>
          <Link to="/opiniao">Dar a sua opinião</Link>
          <Link to="/privacidade">Privacidade</Link>
          <Link to="/termos">Termos</Link>
          <Link to="/aviso-legal">Aviso legal</Link>
        </nav>
        <p>Prazómetro: gratuito, sem publicidade e sem fins comerciais.</p>
      </footer>
    </>
  );
}
