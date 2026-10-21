import { useState, type FormEvent } from 'react';
import { db, newId, type AssetType, type DeathProcess, type EstateAsset } from '../../db';
import { Link } from '../../router';
import { ASSET_LETTER, ASSET_TYPES } from './process';

const LABEL = Object.fromEntries(ASSET_TYPES) as Record<AssetType, string>;

/** Inventário de bens e contratos, para não esquecer nenhum banco, seguro ou contrato. */
export function Inventory({ p }: { p: DeathProcess }) {
  const [tipo, setTipo] = useState<AssetType>('conta');
  const [descricao, setDescricao] = useState('');
  const [entidade, setEntidade] = useState('');
  const [error, setError] = useState<string>();

  const save = (bens: EstateAsset[]) => db.processos_obito.update(p.id, { bens });

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!descricao.trim() && !entidade.trim()) {
      setError('Escreva o que é (por exemplo, «conta à ordem») ou o nome da entidade.');
      return;
    }
    setError(undefined);
    await save([
      ...p.bens,
      {
        id: newId(),
        tipo,
        descricao: descricao.trim() || LABEL[tipo],
        entidade: entidade.trim() || undefined,
        tratado: false,
      },
    ]);
    setDescricao('');
    setEntidade('');
  }

  return (
    <section aria-labelledby="inventario">
      <h2 id="inventario">Inventário de bens e contratos</h2>
      <p>
        Aponte aqui as contas, casas, carros, seguros e contratos de que se lembrar. Serve para a
        relação de bens das Finanças e para não esquecer nenhuma carta.
      </p>

      {p.bens.length === 0 ? (
        <p className="empty">Ainda não há nada no inventário.</p>
      ) : (
        <ul className="cards">
          {p.bens.map((b) => {
            const letter = ASSET_LETTER[b.tipo];
            return (
              <li key={b.id}>
                <p>
                  <strong>{b.descricao}</strong>
                  {b.entidade && ` · ${b.entidade}`}
                  <br />
                  <span className="muted">{LABEL[b.tipo]}</span>
                </p>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={b.tratado}
                    onChange={(e) =>
                      save(
                        p.bens.map((x) =>
                          x.id === b.id ? { ...x, tratado: e.target.checked } : x,
                        ),
                      )
                    }
                  />
                  Já está tratado
                </label>
                <div className="actions">
                  {letter && !b.tratado && (
                    <Link to={`/pos-obito/${p.id}/carta/${letter}?bem=${b.id}`} className="button">
                      Preparar a carta
                    </Link>
                  )}
                  <button type="button" onClick={() => save(p.bens.filter((x) => x.id !== b.id))}>
                    Retirar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <form className="form" onSubmit={add} noValidate>
        <h3>Acrescentar</h3>
        <label className="field">
          O que é
          <select value={tipo} onChange={(e) => setTipo(e.target.value as AssetType)}>
            {ASSET_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Descrição{' '}
          <span className="optional">(por exemplo, «conta à ordem» ou «casa de Viseu»)</span>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
        <label className="field">
          Banco, seguradora ou empresa <span className="optional">(opcional)</span>
          <input value={entidade} onChange={(e) => setEntidade(e.target.value)} />
        </label>
        {error && (
          <p className="errors" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="submit">Acrescentar ao inventário</button>
        </div>
      </form>
    </section>
  );
}
