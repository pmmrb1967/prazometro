import { formatDateShort, verificationStatus, type Rule } from '@prazometro/engine';
import { todayInLisbon } from '@prazometro/engine';

/** Fonte legal e data de verificação de cada regra usada (princípio 4). */
export function RuleSources({ rules }: { rules: Rule[] }) {
  const today = todayInLisbon();
  return (
    <details className="sources">
      <summary>De onde vêm estas datas</summary>
      <ul>
        {rules.map((r) => {
          const status = verificationStatus(r, today);
          return (
            <li key={r.id}>
              <p>
                <strong>{r.titulo}.</strong> {r.descricao}
              </p>
              <ul>
                {r.fontes.map((f) => (
                  <li key={f.artigo}>
                    <a href={f.url} target="_blank" rel="noreferrer">
                      {f.titulo}
                    </a>
                    , artigo {f.artigo}
                  </li>
                ))}
              </ul>
              <p className="muted">
                Verificada em {formatDateShort(r.verificado_em)}.{' '}
                {status === 'a_verificar' && (
                  <strong>A verificar: passaram mais de 6 meses desde a última verificação.</strong>
                )}
                {status === 'a_rever' && (
                  <strong>
                    Em revisão: esta regra ainda está a ser confirmada por um jurista.
                  </strong>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
