import { describe, expect, it } from 'vitest';
import { exampleRule } from './fixtures';
import { validateRepository } from './validation';

const template = (id = 'garantia.carta-teste', modulo = 'garantia') => `---
id: ${id}
modulo: ${modulo}
titulo: Carta
campos:
  - id: nome
    rotulo: Nome
fontes:
  - titulo: Fonte
    url: https://example.org/
    artigo: 1.º
verificado_em: 2026-10-20
verificado_por: testes
estado: publicada
---
Eu, {{nome}}.
`;

const ruleFile = (rule: object, path = 'rules/garantia/exemplo.json') => ({
  path,
  content: JSON.stringify(rule),
});

const TODAY = '2026-10-20';

describe('validateRepository', () => {
  it('um repositório coerente não tem erros', () => {
    const r = validateRepository(
      [ruleFile({ ...exampleRule, modelos_carta: ['garantia.carta-teste'] })],
      [{ path: 'templates/garantia/carta-teste.md', content: template() }],
      TODAY,
    );
    expect(r).toEqual({ erros: [], avisos: [], regras: 1, modelos: 1 });
  });

  it('falha sem fontes ou sem verificado_em', () => {
    const { verificado_em: _, ...semData } = exampleRule;
    const r = validateRepository(
      [
        ruleFile({ ...exampleRule, fontes: [] }, 'rules/garantia/a.json'),
        ruleFile(semData, 'rules/garantia/b.json'),
      ],
      [],
      TODAY,
    );
    expect(r.erros).toHaveLength(2);
    expect(r.erros[0]).toContain('rules/garantia/a.json: fontes');
    expect(r.erros[1]).toBe('rules/garantia/b.json: verificado_em: campo obrigatório em falta');
  });

  it('deteta JSON inválido, ids repetidos, pasta errada e data no futuro', () => {
    const r = validateRepository(
      [
        { path: 'rules/garantia/partido.json', content: '{ "id": ' },
        ruleFile(exampleRule, 'rules/garantia/a.json'),
        ruleFile(exampleRule, 'rules/sns/b.json'),
        ruleFile(
          { ...exampleRule, id: 'garantia.futura', verificado_em: '2026-10-21' },
          'rules/garantia/c.json',
        ),
      ],
      [],
      TODAY,
    );
    expect(r.erros).toEqual([
      expect.stringContaining('partido.json: JSON inválido'),
      expect.stringContaining('rules/sns/b.json: id "garantia.exemplo-de-teste" repetido'),
      'rules/sns/b.json: está fora da pasta do módulo "garantia"',
      'rules/garantia/c.json: verificado_em está no futuro',
    ]);
  });

  it('deteta modelos de carta que não existem', () => {
    const r = validateRepository(
      [ruleFile({ ...exampleRule, modelos_carta: ['garantia.nao-existe'] })],
      [],
      TODAY,
    );
    expect(r.erros).toEqual([
      'rules/garantia/exemplo.json: modelo de carta "garantia.nao-existe" não existe em templates/',
    ]);
  });

  it('valida os modelos de carta (campos e pasta)', () => {
    const r = validateRepository(
      [],
      [{ path: 'templates/sns/x.md', content: template().replace('{{nome}}', '{{morada}}') }],
      TODAY,
    );
    expect(r.erros).toEqual([
      'templates/sns/x.md: campo {{morada}} usado mas não declarado',
      'templates/sns/x.md: campo "nome" declarado mas não usado',
      'templates/sns/x.md: está fora da pasta do módulo "garantia"',
    ]);
  });

  it('avisa (sem falhar) sobre regras com mais de 6 meses ou a rever', () => {
    const r = validateRepository(
      [
        ruleFile({ ...exampleRule, verificado_em: '2026-01-10' }, 'rules/garantia/velha.json'),
        ruleFile(
          { ...exampleRule, id: 'garantia.outra', estado: 'a_rever' },
          'rules/garantia/rever.json',
        ),
      ],
      [],
      TODAY,
    );
    expect(r.erros).toEqual([]);
    expect(r.avisos).toEqual([
      'rules/garantia/velha.json: regra a verificar',
      'rules/garantia/rever.json: regra a rever',
    ]);
  });
});
