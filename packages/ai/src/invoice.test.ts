import { describe, expect, it } from 'vitest';
import { amountCents, INVOICE_TASK, invoiceWithKeywords, readInvoice } from './invoice';

// Faturas FICTÍCIAS, com nomes, NIF e moradas inventados.

const WORTEN = `WORTEN - EQUIPAMENTOS PARA O LAR, S.A.
Rua Fictícia, 100
4400-000 Vila Nova de Gaia
NIF 503630330
FATURA-RECIBO FR 0123/45678
Data: 03/10/2026
Cliente: Joaquim Ferreira Antunes
NIF Cliente: 123456789
Máquina de lavar roupa Bosch Serie 4 WAN28 1 un 449,99
Entrega ao domicílio 1 un 19,90
Subtotal 381,30
IVA 23% 87,70
Total 469,00
Total a pagar (EUR) 469,89`;

const LOJA_LOCAL = `Electro Silva & Filhos, Lda.
Av. da Liberdade, 10
2000-111 Santarém
Fatura simplificada FS 2026/77
22 de setembro de 2026
Torradeira Philips 1 34,99
TOTAL 34,99 €`;

describe('fatura sem IA (palavras-chave)', () => {
  it('reconhece a loja conhecida, a data da fatura e o total a pagar', () => {
    expect(invoiceWithKeywords(WORTEN)).toEqual({
      loja: 'Worten',
      produto: '',
      data_compra: '2026-10-03',
      preco: '469,89',
    });
  });

  it('numa loja desconhecida usa a primeira linha, sem "Lda."', () => {
    expect(invoiceWithKeywords(LOJA_LOCAL)).toEqual({
      loja: 'Electro Silva & Filhos',
      produto: '',
      data_compra: '2026-09-22',
      preco: '34,99',
    });
  });

  it('sem nada reconhecível, deixa os campos vazios', () => {
    expect(invoiceWithKeywords('ilegível')).toEqual({
      loja: 'ilegível',
      produto: '',
      data_compra: '',
      preco: '',
    });
    expect(invoiceWithKeywords('')).toEqual({
      loja: '',
      produto: '',
      data_compra: '',
      preco: '',
    });
  });

  it('lê montantes escritos de várias maneiras', () => {
    expect(amountCents('349,90')).toBe(34990);
    expect(amountCents('1.234,56 €')).toBe(123456);
    expect(amountCents('1 234,56')).toBe(123456);
    expect(amountCents('349.90')).toBe(34990);
    expect(amountCents('trezentos')).toBeNull();
    expect(amountCents('')).toBeNull();
  });
});

describe('fatura com IA', () => {
  const answer = {
    loja: 'Worten',
    produto: 'Máquina de lavar roupa Bosch Serie 4',
    data_compra: '2026-10-03',
    preco: '469,89',
  };

  it('envia só texto anonimizado, com o prompt e o esquema da fatura', async () => {
    let sent = '';
    let task = '';
    const r = await readInvoice(WORTEN, 'workers-ai', async (t, k) => {
      sent = t;
      task = k.id;
      return answer;
    });
    expect(task).toBe(INVOICE_TASK.id);
    expect(sent).not.toContain('Joaquim');
    expect(sent).not.toContain('123456789');
    expect(sent).toContain('469,89');
    expect(sent).toContain('03/10/2026');
    expect(r).toEqual({ resultado: answer, fornecedor: 'workers-ai' });
  });

  it('descarta a data e o total que não estão escritos na fatura', async () => {
    const r = await readInvoice(WORTEN, 'claude-own', async () => ({
      ...answer,
      data_compra: '2026-10-05',
      preco: '500,00',
    }));
    expect(r.resultado.data_compra).toBe('');
    expect(r.resultado.preco).toBe('');
    expect(r.resultado.produto).toBe(answer.produto);
  });

  it('volta à leitura sem IA se a resposta não tiver o formato certo ou o fornecedor falhar', async () => {
    const bad = await readInvoice(WORTEN, 'gemini-own', async () => ({ loja: 1 }));
    expect(bad.fornecedor).toBe('none');
    expect(bad.aviso).toMatch(/formato/);
    expect(bad.resultado.loja).toBe('Worten');

    const down = await readInvoice(WORTEN, 'workers-ai', async () => {
      throw new Error('A IA gratuita não respondeu.');
    });
    expect(down.fornecedor).toBe('none');
    expect(down.aviso).toBe('A IA gratuita não respondeu. Preenchemos sem IA.');
  });

  it('com "none" não chama nenhum fornecedor', async () => {
    const r = await readInvoice(WORTEN, 'none', async () => {
      throw new Error('não devia ser chamado');
    });
    expect(r.fornecedor).toBe('none');
    expect(r.aviso).toBeUndefined();
  });
});
