import type { InvoiceResult } from '@prazometro/ai';
import { isValidDate, todayInLisbon } from '@prazometro/engine';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState, type FormEvent } from 'react';
import { Choice } from '../../components/Choice';
import { LegalNotice } from '../../components/LegalNotice';
import { db, newId, type Purchase } from '../../db';
import { Link, navigate, usePageHeading } from '../../router';
import { InvoiceAutofill } from './InvoiceAutofill';

type Draft = Omit<Purchase, 'id' | 'criado_em' | 'preco'> & { preco: string };

function emptyDraft(): Draft {
  const today = todayInLisbon();
  return {
    produto: '',
    loja: '',
    loja_morada: '',
    data_compra: today,
    data_entrega: today,
    estado: 'novo',
    acordo_18_meses: 'nao_sei',
    tipo_vendedor: 'profissional',
    uso: 'pessoal',
    preco: '',
    notas: '',
  };
}

function validate(d: Draft): string[] {
  const errors: string[] = [];
  const today = todayInLisbon();
  if (!d.produto.trim()) errors.push('Escreva o que comprou.');
  if (!d.loja.trim()) errors.push('Escreva onde comprou.');
  if (!isValidDate(d.data_compra)) errors.push('Indique a data da compra.');
  else if (d.data_compra > today) errors.push('A data da compra não pode ser no futuro.');
  if (!isValidDate(d.data_entrega)) errors.push('Indique a data em que recebeu o bem.');
  else if (isValidDate(d.data_compra) && d.data_entrega < d.data_compra)
    errors.push('A entrega não pode ser antes da compra.');
  if (d.preco && !/^\d+([.,]\d{1,2})?$/.test(d.preco.trim()))
    errors.push('Escreva o preço só com números, por exemplo 349,90.');
  return errors;
}

export function PurchaseForm({ id }: { id?: string }) {
  const existing = useLiveQuery(() => (id ? db.compras.get(id) : undefined), [id]);
  if (id && existing === undefined) return null;
  return <PurchaseFormInner key={id ?? 'nova'} existing={existing} />;
}

function PurchaseFormInner({ existing }: { existing?: Purchase }) {
  const editing = !!existing;
  const heading = usePageHeading<HTMLHeadingElement>(editing ? 'Alterar compra' : 'Nova compra');
  const [d, setD] = useState<Draft>(() =>
    existing
      ? { ...emptyDraft(), ...existing, preco: existing.preco?.toFixed(2).replace('.', ',') ?? '' }
      : emptyDraft(),
  );
  const [fatura, setFatura] = useState<File | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [deliveryTouched, setDeliveryTouched] = useState(editing);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));

  /** Põe no formulário o que se leu da fatura; o que não se leu fica como estava. */
  function applyInvoice({ resultado: r }: InvoiceResult) {
    setD((prev) => {
      const next = { ...prev };
      if (r.produto) next.produto = r.produto;
      if (r.loja) next.loja = r.loja;
      if (r.preco) next.preco = r.preco;
      if (r.data_compra && r.data_compra <= todayInLisbon()) {
        next.data_compra = r.data_compra;
        // Sem outra informação, a entrega é no dia da compra: dá a data mais cedo, a segura.
        if (!deliveryTouched || prev.data_entrega < r.data_compra)
          next.data_entrega = r.data_compra;
      }
      return next;
    });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const errs = validate(d);
    setErrors(errs);
    if (errs.length) {
      document.getElementById('form-errors')?.focus();
      return;
    }
    const purchase: Purchase = {
      ...(existing ?? { id: newId(), criado_em: todayInLisbon() }),
      produto: d.produto.trim(),
      loja: d.loja.trim(),
      loja_morada: d.loja_morada?.trim() || undefined,
      data_compra: d.data_compra,
      data_entrega: d.data_entrega,
      estado: d.estado,
      acordo_18_meses: d.estado === 'usado' ? d.acordo_18_meses : undefined,
      tipo_vendedor: d.tipo_vendedor,
      uso: d.uso,
      preco: d.preco ? Number(d.preco.trim().replace(',', '.')) : undefined,
      notas: d.notas?.trim() || undefined,
    };
    if (fatura) {
      const fileId = purchase.fatura_id ?? newId();
      await db.ficheiros.put({ id: fileId, nome: fatura.name, tipo: fatura.type, blob: fatura });
      purchase.fatura_id = fileId;
    }
    await db.compras.put(purchase);
    navigate(`/garantia/${purchase.id}`, { replace: !editing });
  }

  return (
    <>
      <nav className="crumbs" aria-label="Caminho">
        <Link to="/">Início</Link> › <Link to="/garantia">Garantias</Link>
      </nav>
      <h1 ref={heading} tabIndex={-1}>
        {editing ? 'Alterar compra' : 'Registar uma compra'}
      </h1>

      <InvoiceAutofill
        file={fatura}
        hasStored={!!existing?.fatura_id}
        onFile={setFatura}
        onFill={applyInvoice}
      />

      <form className="form" onSubmit={onSubmit} noValidate>
        {errors.length > 0 && (
          <div id="form-errors" className="errors" tabIndex={-1} role="alert">
            <p>Falta corrigir:</p>
            <ul>
              {errors.map((er) => (
                <li key={er}>{er}</li>
              ))}
            </ul>
          </div>
        )}

        <label className="field">
          O que comprou?
          <input
            id="produto"
            value={d.produto}
            onChange={(e) => set('produto', e.target.value)}
            aria-describedby="produto-dica"
            autoComplete="off"
          />
        </label>
        <p id="produto-dica" className="hint">
          Por exemplo: máquina de lavar roupa.
        </p>

        <label className="field">
          Onde comprou? (nome da loja)
          <input id="loja" value={d.loja} onChange={(e) => set('loja', e.target.value)} />
        </label>

        <label className="field">
          <span>
            Morada da loja <span className="optional">(opcional, serve para as cartas)</span>
          </span>
          <textarea
            id="loja_morada"
            rows={2}
            value={d.loja_morada}
            onChange={(e) => set('loja_morada', e.target.value)}
          />
        </label>

        <div className="row">
          <label className="field">
            Data da compra
            <input
              id="data_compra"
              type="date"
              value={d.data_compra}
              max={todayInLisbon()}
              onChange={(e) => set('data_compra', e.target.value)}
            />
          </label>
          <label className="field">
            Data em que recebeu o bem
            <input
              id="data_entrega"
              type="date"
              value={d.data_entrega}
              min={d.data_compra}
              onChange={(e) => {
                setDeliveryTouched(true);
                set('data_entrega', e.target.value);
              }}
            />
          </label>
        </div>
        <p className="hint">A garantia conta a partir do dia em que recebeu o bem.</p>

        <Choice
          legend="Comprou a uma loja ou empresa?"
          name="tipo_vendedor"
          value={d.tipo_vendedor}
          options={[
            ['profissional', 'Sim, a uma loja ou empresa (também online)'],
            ['particular', 'Não, a um particular (por exemplo, num site de anúncios)'],
          ]}
          onChange={(v) => set('tipo_vendedor', v)}
        />

        <Choice
          legend="Para que é?"
          name="uso"
          value={d.uso}
          options={[
            ['pessoal', 'Para mim ou para a família'],
            ['profissional', 'Para o meu trabalho ou empresa'],
          ]}
          onChange={(v) => set('uso', v)}
        />

        <Choice
          legend="O bem era novo?"
          name="estado"
          value={d.estado}
          options={[
            ['novo', 'Novo'],
            ['recondicionado', 'Recondicionado (diz "recondicionado" na fatura)'],
            ['usado', 'Usado ou em segunda mão'],
          ]}
          onChange={(v) => set('estado', v)}
        />

        {d.estado === 'usado' && (
          <Choice
            legend="Ficou escrito que a garantia é de 18 meses?"
            hint="Nos bens usados, a loja pode combinar consigo uma garantia mais curta, de 18 meses. Veja na fatura ou no contrato."
            name="acordo_18_meses"
            value={d.acordo_18_meses ?? 'nao_sei'}
            options={[
              ['sim', 'Sim, 18 meses'],
              ['nao', 'Não, não ficou nada combinado'],
              ['nao_sei', 'Não sei'],
            ]}
            onChange={(v) => set('acordo_18_meses', v)}
          />
        )}

        <label className="field">
          <span>
            Preço <span className="optional">(opcional)</span>
          </span>
          <input
            id="preco"
            inputMode="decimal"
            value={d.preco}
            onChange={(e) => set('preco', e.target.value)}
            placeholder="0,00 €"
          />
        </label>

        <label className="field">
          <span>
            Notas <span className="optional">(opcional)</span>
          </span>
          <textarea
            id="notas"
            rows={3}
            value={d.notas}
            onChange={(e) => set('notas', e.target.value)}
          />
        </label>

        <div className="actions">
          <button type="submit" className="primary">
            Guardar
          </button>
          <Link to={existing ? `/garantia/${existing.id}` : '/garantia'} className="button">
            Cancelar
          </Link>
        </div>
      </form>
      <LegalNotice />
    </>
  );
}
