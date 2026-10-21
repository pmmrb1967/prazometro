import type { ReactNode } from 'react';
import { Link } from '../router';

// Mostra os textos de docs/ (privacidade, termos, aviso legal) sem bibliotecas: títulos,
// parágrafos, listas, tabelas simples, **negrito** e [ligações](url). O título de nível 1 fica
// de fora, porque a página já tem o seu.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\[(.+?)\]\((.+?)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) out.push(<strong key={m.index}>{m[1]}</strong>);
    else if (m[3]!.startsWith('/'))
      out.push(
        <Link key={m.index} to={m[3]!}>
          {m[2]}
        </Link>,
      );
    else
      out.push(
        <a key={m.index} href={m[3]} target="_blank" rel="noreferrer">
          {m[2]}
        </a>,
      );
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function Markdown({ source }: { source: string }) {
  const blocks = source.trim().split(/\n\s*\n/);
  return (
    <>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const first = lines[0]!;
        if (first.startsWith('# ')) return null;
        if (first.startsWith('### ')) return <h3 key={i}>{inline(first.slice(4))}</h3>;
        if (first.startsWith('## ')) return <h2 key={i}>{inline(first.slice(3))}</h2>;
        if (lines.every((l) => l.startsWith('- '))) {
          return (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.slice(2))}</li>
              ))}
            </ul>
          );
        }
        if (first.startsWith('|') && lines.length > 2) {
          const [head, , ...rows] = lines;
          return (
            <div key={i} className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {cells(head!).map((c) => (
                      <th key={c} scope="col">
                        {inline(c)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, j) => (
                    <tr key={j}>
                      {cells(r).map((c, k) => (
                        <td key={k}>{inline(c)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return <p key={i}>{inline(lines.join(' '))}</p>;
      })}
    </>
  );
}
