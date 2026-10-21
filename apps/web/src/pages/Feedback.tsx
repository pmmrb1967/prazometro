import { useState, type FormEvent } from 'react';
import { api } from '../cloud/api';
import { Link, usePageHeading } from '../router';

const TOPICS: [string, string][] = [
  ['geral', 'A app em geral'],
  ['garantia', 'Garantia de uma compra'],
  ['sns', 'Espera no SNS'],
  ['cartas', 'Perceber uma carta'],
  ['pos-obito', 'Depois de um falecimento'],
  ['partilha', 'Partilha com a família'],
];

/** Opinião sobre a app, sem conta e sem dados pessoais. */
export function Feedback() {
  const heading = usePageHeading<HTMLHeadingElement>('Dar a sua opinião');
  const [topic, setTopic] = useState('geral');
  const [text, setText] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(undefined);
    try {
      await api('/feedback', { json: { modulo: topic, message: text } });
      setState('sent');
    } catch (err) {
      setError((err as Error).message);
      setState('idle');
    }
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        Dar a sua opinião
      </h1>
      {state === 'sent' ? (
        <>
          <p className="ok" role="status">
            Obrigado. A sua opinião ajuda a melhorar o Prazómetro.
          </p>
          <p>
            <Link to="/">Voltar ao início</Link>
          </p>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <p className="lead">
            Alguma coisa difícil de perceber? Falta um tema? Encontrou um erro? Diga-nos. Não
            precisa de conta e não guardamos quem escreveu.
          </p>
          <label className="field">
            Sobre o quê?
            <select value={topic} onChange={(e) => setTopic(e.target.value)}>
              {TOPICS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            A sua opinião
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              minLength={10}
              maxLength={1000}
              required
            />
          </label>
          <p className="hint">
            Não escreva dados pessoais (nome, NIF, morada, saúde). Se quiser resposta, não deixe o
            contacto aqui: escreva para Prazometro@outlook.com.
          </p>
          {error && (
            <p className="errors" role="alert">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit" className="primary" disabled={state === 'sending'}>
              {state === 'sending' ? 'A enviar…' : 'Enviar'}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
