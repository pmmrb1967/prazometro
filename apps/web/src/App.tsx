import { AccessibilityBar } from './components/AccessibilityBar';
import { LegalNotice } from './components/LegalNotice';
import { MODULES } from './modules';
import { usePreferences } from './preferences';

export function App() {
  const [prefs, setPrefs] = usePreferences();

  return (
    <>
      <a className="skip" href="#conteudo">
        Saltar para o conteúdo
      </a>
      <header className="top">
        <div className="brand">
          <img src="/logo.svg" alt="" width="48" height="48" />
          <span className="brand-name">Prazómetro</span>
        </div>
        <AccessibilityBar prefs={prefs} onChange={setPrefs} />
      </header>

      <main id="conteudo" className="page">
        <section className="intro">
          <h1>O que precisa de resolver?</h1>
          <p>
            Escolha um tema. A app diz-lhe até quando pode agir e o que deve fazer. É gratuita e não
            precisa de criar conta.
          </p>
        </section>

        <ul className="modules">
          {MODULES.map((m) => (
            <li key={m.id}>
              <article className="module" aria-labelledby={`mod-${m.id}`}>
                <h2 id={`mod-${m.id}`}>{m.title}</h2>
                <p>{m.summary}</p>
                {!m.available && <span className="soon">Em breve</span>}
              </article>
            </li>
          ))}
        </ul>

        <LegalNotice />
      </main>
    </>
  );
}
