import { Link } from '../router';

export function LegalNotice() {
  return (
    <aside className="legal" aria-labelledby="legal-title">
      <h2 id="legal-title">Aviso legal</h2>
      <p>
        O Prazómetro dá informação geral e modelos de carta. Não é aconselhamento jurídico nem
        substitui um advogado ou solicitador (Lei n.º 49/2004). Cada regra indica a fonte legal e a
        data em que foi verificada. <Link to="/aviso-legal">Ler o aviso legal completo</Link>.
      </p>
    </aside>
  );
}
