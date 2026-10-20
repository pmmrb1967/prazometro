import { describe, expect, it } from 'vitest';
import caducidade from '../../../../rules/garantia/caducidade-direitos.json';
import prazoGeral from '../../../../rules/garantia/prazo-geral.json';
import prazoReparacao from '../../../../rules/garantia/prazo-reparacao.json';
import substituicao from '../../../../rules/garantia/substituicao.json';
import usadosReduzido from '../../../../rules/garantia/usados-prazo-reduzido.json';
import { evaluateRule } from './evaluate';
import { RuleSchema } from './schema';

// Casos concretos com as regras reais do módulo Garantia (DL 84/2021).
const geral = RuleSchema.parse(prazoGeral);
const reduzido = RuleSchema.parse(usadosReduzido);
const reparacao = RuleSchema.parse(prazoReparacao);
const direitos = RuleSchema.parse(caducidade);
const troca = RuleSchema.parse(substituicao);

const TODAY = '2026-10-20';
const compra = {
  tipo_vendedor: 'profissional',
  uso: 'pessoal',
  estado: 'novo',
  data_compra: '2025-03-10',
  data_entrega: '2025-03-10',
};

describe('garantia: prazo geral de 3 anos', () => {
  it('bem novo: 3 anos, rejeição aos 30 dias e fim da presunção aos 2 anos', () => {
    const r = evaluateRule(geral, compra, TODAY);
    expect(r.aplica).toBe(true);
    expect(r.prazo).toBe('2028-03-10');
    expect(r.marcos.map((m) => [m.id, m.data])).toEqual([
      ['rejeicao', '2025-04-09'],
      ['fim-presuncao', '2027-03-10'],
    ]);
    expect(evaluateRule(reduzido, compra, TODAY).aplica).toBe(false);
  });

  it('conta a partir da entrega, não da compra', () => {
    const r = evaluateRule(
      geral,
      { ...compra, data_compra: '2025-12-20', data_entrega: '2026-01-05' },
      TODAY,
    );
    expect(r.prazo).toBe('2029-01-05');
  });

  it('recondicionado tem sempre 3 anos, mesmo com acordo de redução', () => {
    const facts = { ...compra, estado: 'recondicionado', acordo_18_meses: 'sim' };
    expect(evaluateRule(geral, facts, TODAY).prazo).toBe('2028-03-10');
    expect(evaluateRule(reduzido, facts, TODAY).aplica).toBe(false);
  });

  it('usado sem acordo de redução tem 3 anos', () => {
    const facts = { ...compra, estado: 'usado', acordo_18_meses: 'nao' };
    expect(evaluateRule(geral, facts, TODAY).prazo).toBe('2028-03-10');
    expect(evaluateRule(reduzido, facts, TODAY).aplica).toBe(false);
  });

  it('não se aplica a compras a particulares, para uso profissional ou antes de 2022', () => {
    expect(evaluateRule(geral, { ...compra, tipo_vendedor: 'particular' }, TODAY).falhas).toEqual([
      'tipo_vendedor',
    ]);
    expect(evaluateRule(geral, { ...compra, uso: 'profissional' }, TODAY).aplica).toBe(false);
    const antiga = { ...compra, data_compra: '2021-12-31', data_entrega: '2022-01-03' };
    expect(evaluateRule(geral, antiga, TODAY).falhas).toEqual(['data_compra']);
    const primeiroDia = { ...compra, data_compra: '2022-01-01', data_entrega: '2022-01-01' };
    expect(evaluateRule(geral, primeiroDia, TODAY).aplica).toBe(true);
  });
});

describe('garantia: usados com prazo reduzido', () => {
  it('18 meses a partir de 31 de agosto terminam no fim de fevereiro; presunção de 1 ano', () => {
    const facts = {
      ...compra,
      estado: 'usado',
      acordo_18_meses: 'sim',
      data_compra: '2025-08-31',
      data_entrega: '2025-08-31',
    };
    const r = evaluateRule(reduzido, facts, TODAY);
    expect(r.prazo).toBe('2027-02-28');
    expect(r.marcos.find((m) => m.id === 'fim-presuncao')?.data).toBe('2026-08-31');
    expect(evaluateRule(geral, facts, TODAY).aplica).toBe(false);
  });

  it('"não sei" usa por precaução o prazo mais curto', () => {
    const facts = { ...compra, estado: 'usado', acordo_18_meses: 'nao_sei' };
    expect(evaluateRule(reduzido, facts, TODAY).prazo).toBe('2026-09-10');
    expect(evaluateRule(geral, facts, TODAY).aplica).toBe(false);
  });
});

describe('garantia: depois de comunicar o defeito', () => {
  const comunicado = { ...compra, data_comunicacao: '2026-10-20' };

  it('a loja tem 30 dias para reparar ou trocar', () => {
    expect(evaluateRule(reparacao, comunicado, TODAY).prazo).toBe('2026-11-19');
  });

  it('os direitos caducam 2 anos depois da comunicação', () => {
    const r = evaluateRule(direitos, comunicado, TODAY);
    expect(r.prazo).toBe('2028-10-20');
    expect(r.alertas.map((a) => a.data)).toEqual(['2028-07-22', '2028-09-20']);
  });

  it('sem data de comunicação, estas regras não se aplicam', () => {
    expect(evaluateRule(reparacao, compra, TODAY).falhas).toEqual(['data_comunicacao']);
  });

  it('o bem recebido em troca tem nova garantia (regra a rever por jurista)', () => {
    const r = evaluateRule(troca, { ...compra, data_entrega_substituto: '2026-05-04' }, TODAY);
    expect(r.prazo).toBe('2029-05-04');
    expect(r.verificacao).toBe('a_rever');
  });
});
