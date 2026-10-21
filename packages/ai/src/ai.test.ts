import { describe, expect, it } from 'vitest';
import { anonymize, describeRemoved, isNif } from './anonymize';
import { findDates } from './dates';
import { TEST_LETTERS } from './fixtures/letters';
import { callGemini, testGeminiKey } from './gemini';
import { extract } from './index';
import { extractWithKeywords } from './keywords';
import type { Extraction } from './schema';

describe('datas escritas na carta', () => {
  it('reconhece os formatos habituais e ignora datas impossíveis', () => {
    const found = findDates(
      'Em 21/10/2026, 3-2-2026, 01.04.2026, 2026-05-31, 2 de março de 2026, 1.º de maio de 2026 e 31/02/2026.',
    ).map((d) => d.data);
    expect(found).toEqual([
      '2026-10-21',
      '2026-02-03',
      '2026-04-01',
      '2026-05-31',
      '2026-03-02',
      '2026-05-01',
    ]);
  });
});

describe('conjunto de teste (fornecedor sem IA)', () => {
  const results = TEST_LETTERS.map((l) => ({ l, r: extractWithKeywords(l.texto) }));

  it('tem 30 cartas', () => {
    expect(TEST_LETTERS).toHaveLength(30);
  });

  it('acerta o emissor em pelo menos 90% das cartas', () => {
    const wrong = results.filter(({ l, r }) => r.emissor !== l.emissor);
    const rate = 1 - wrong.length / results.length;
    expect(
      rate,
      `falhas: ${wrong.map(({ l, r }) => `${l.id} (${r.emissor})`).join(', ')}`,
    ).toBeGreaterThanOrEqual(0.9);
  });

  it('acerta as datas em pelo menos 90% das cartas', () => {
    const wrong = results.filter(
      ({ l, r }) =>
        JSON.stringify(r.datas.map((d) => d.data).sort()) !== JSON.stringify([...l.datas].sort()),
    );
    const rate = 1 - wrong.length / results.length;
    expect(rate, `falhas: ${wrong.map(({ l }) => l.id).join(', ')}`).toBeGreaterThanOrEqual(0.9);
  });

  it('dá a cada data o significado da pista mais próxima', () => {
    const r = results.find(({ l }) => l.id === 'transito-auto-1')!.r;
    expect(r.datas).toEqual([
      { data: '2026-08-21', descricao: 'Data da infração' },
      { data: '2026-09-10', descricao: 'Data da notificação' },
    ]);
  });

  it('reconhece os tipos de carta ligados a regras do motor', () => {
    for (const { l, r } of results) {
      if (['contraordenacao_transito', 'audicao_previa_at', 'citacao_tribunal'].includes(l.tipo)) {
        expect(r.tipo, l.id).toBe(l.tipo);
      }
    }
  });
});

describe('anonimização', () => {
  it('valida o dígito de controlo do NIF', () => {
    expect(isNif('123456789')).toBe(true);
    expect(isNif('123456780')).toBe(false);
    expect(isNif('412345678')).toBe(false);
  });

  it('apaga NIF, NISS, IBAN, nomes, moradas, matrículas, processos, telefones e emails', () => {
    const { texto, contagem } = anonymize(`Exmo. Senhor
Joaquim Ferreira Antunes
Rua das Flores, 12, 2.º Esq.
1200-195 Lisboa
NIF: 123456789   NISS: 12345678901
IBAN PT50 0035 0123 4567 8901 2345 6
Matrícula AA-12-BC. Processo 12345/26.4T8LSB. Auto n.º 912345678.
Contacto: 912 345 678 ou joaquim.antunes@exemplo.pt
O senhor Joaquim Antunes deve pagar 60,00 € até 21/10/2026 (art. 175.º do Código da Estrada, Decreto-Lei n.º 114/94).`);
    for (const secret of [
      'Joaquim',
      'Antunes',
      'Ferreira',
      'Flores',
      '1200-195',
      'Lisboa',
      '123456789',
      '12345678901',
      'PT50',
      'AA-12-BC',
      '12345/26',
      '912345678',
      '912 345 678',
      'joaquim.antunes',
    ]) {
      expect(texto, secret).not.toContain(secret);
    }
    // O que é preciso para perceber a carta fica.
    expect(texto).toContain('60,00 €');
    expect(texto).toContain('21/10/2026');
    expect(texto).toContain('art. 175.º do Código da Estrada');
    expect(texto).toContain('Decreto-Lei n.º 114/94');
    expect(contagem).toMatchObject({ NIF: 1, NISS: 1, IBAN: 1, MATRÍCULA: 1, PROCESSO: 1 });
    expect(contagem.NOME).toBeGreaterThanOrEqual(2);
    expect(describeRemoved({ NOME: 2, NIF: 1 })).toBe('2 nomes e 1 NIF');
  });

  it('apaga os nomes indicados pela pessoa em qualquer sítio', () => {
    const { texto } = anonymize('A requerente, MARIA COSTA, e a filha Inês Costa.', {
      nomes: ['Maria Costa'],
    });
    expect(texto).not.toMatch(/maria|costa/i);
    expect(texto).toContain('Inês');
  });

  it('nas 30 cartas, não deixa passar NIF, NISS, IBAN nem nomes depois de "Exmo." ou "Nome:"', () => {
    for (const l of TEST_LETTERS) {
      const { texto } = anonymize(l.texto);
      expect(texto, l.id).not.toMatch(/\b\d{9}\b/);
      expect(texto, l.id).not.toMatch(/\b\d{11}\b/);
      expect(texto, l.id).not.toMatch(/PT50/);
      expect(texto, l.id).not.toMatch(/Exm[oa]\.? (?:Senhor|Senhora|Sr\.)\s*\n?\s*[A-Z][a-z]/);
      // As datas mantêm-se.
      for (const d of l.datas) {
        expect(
          findDates(texto).map((x) => x.data),
          l.id,
        ).toContain(d);
      }
    }
  });
});

const valid: Extraction = {
  emissor: 'transito',
  emissor_nome: 'ANSR',
  tipo: 'contraordenacao_transito',
  assunto: 'Excesso de velocidade',
  resumo: 'Foi registada uma infração.',
  pedido: 'Pagar ou apresentar defesa em 15 dias úteis.',
  consequencias: '',
  datas: [
    { data: '2026-08-21', descricao: 'Data da infração' },
    { data: '2026-09-25', descricao: 'Inventada' },
  ],
};

describe('extrair (interface comum)', () => {
  const letter = TEST_LETTERS.find((l) => l.id === 'transito-auto-1')!.texto;

  it('envia só texto anonimizado e descarta datas que não estão na carta', async () => {
    let sent = '';
    const r = await extract(letter, 'gemini-own', async (t) => {
      sent = t;
      return valid;
    });
    expect(sent).not.toContain('Paulo');
    expect(sent).not.toContain('AA-12-BC');
    expect(sent).toContain('15 dias úteis');
    expect(r.fornecedor).toBe('gemini-own');
    expect(r.resultado.datas.map((d) => d.data)).toEqual(['2026-08-21']);
  });

  it('volta ao modo sem IA se a resposta não tiver o formato certo', async () => {
    const r = await extract(letter, 'claude-own', async () => ({ ...valid, emissor: 'marte' }));
    expect(r.fornecedor).toBe('none');
    expect(r.aviso).toMatch(/formato/);
    expect(r.resultado.emissor).toBe('transito');
  });

  it('volta ao modo sem IA se o fornecedor falhar', async () => {
    const r = await extract(letter, 'gemini-admin', async () => {
      throw new Error('O Gemini não respondeu.');
    });
    expect(r.fornecedor).toBe('none');
    expect(r.aviso).toBe('O Gemini não respondeu. Mostramos a leitura sem IA.');
  });

  it('com "none" não chama nenhum fornecedor', async () => {
    const r = await extract(letter, 'none', async () => {
      throw new Error('não devia ser chamado');
    });
    expect(r.fornecedor).toBe('none');
    expect(r.aviso).toBeUndefined();
  });
});

describe('Gemini', () => {
  it('envia o prompt, o esquema e a chave no cabeçalho', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFn = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Response.json({
        candidates: [{ content: { parts: [{ text: JSON.stringify(valid) }] } }],
      });
    }) as unknown as typeof fetch;
    const out = await callGemini('texto', { key: 'chave', model: 'gemini-teste' }, fetchFn);
    expect(out).toEqual(valid);
    expect(calls[0]!.url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-teste:generateContent',
    );
    expect(new Headers(calls[0]!.init.headers).get('x-goog-api-key')).toBe('chave');
    const body = JSON.parse(calls[0]!.init.body as string);
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.generationConfig.responseSchema.additionalProperties).toBeUndefined();
    expect(body.systemInstruction.parts[0].text).toMatch(/Nunca calcules prazos/);
  });

  it('traduz os erros para mensagens simples', async () => {
    const fail = (status: number) =>
      (async () => new Response('', { status })) as unknown as typeof fetch;
    await expect(testGeminiKey({ key: 'x' }, fail(400))).rejects.toThrow(
      'A chave do Gemini não é válida.',
    );
    await expect(callGemini('t', { key: 'x' }, fail(429))).rejects.toThrow(/excesso/);
    await expect(callGemini('t', { key: 'x', model: '../x' })).rejects.toThrow(/inválido/);
  });
});
