import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { formatDateLong, formatDateShort } from './format';
import { UnsupportedCharactersError, renderLetterPdf } from './pdf';
import {
  checkTemplate,
  fillTemplate,
  parseTemplate,
  TemplateError,
  templateFields,
} from './template';

const SOURCE = `---
id: garantia.exemplo-de-teste
modulo: garantia
titulo: Carta de exemplo
campos:
  - id: nome
    rotulo: O seu nome
  - id: loja
    rotulo: Nome da loja
  - id: notas
    rotulo: Notas
    obrigatorio: false
fontes:
  - titulo: Fonte de exemplo
    url: https://example.org/
    artigo: 1.º
verificado_em: 2026-10-20
verificado_por: testes
estado: publicada
---
# Reclamação

Exmos. Senhores da {{ loja }},

Eu, {{nome}}, venho reclamar. {{notas}}
Com os melhores cumprimentos,
{{nome}}
`;

describe('modelos de carta', () => {
  it('lê o cabeçalho e o corpo', () => {
    const t = parseTemplate(SOURCE);
    expect(t.meta.id).toBe('garantia.exemplo-de-teste');
    expect(t.meta.campos[2]?.obrigatorio).toBe(false);
    expect(t.meta.campos[0]?.obrigatorio).toBe(true);
    expect(t.body.startsWith('# Reclamação')).toBe(true);
    expect(templateFields(t.body)).toEqual(['loja', 'nome', 'notas']);
    expect(checkTemplate(t)).toEqual([]);
  });

  it('preenche os campos e assinala os obrigatórios em falta', () => {
    const t = parseTemplate(SOURCE);
    const { texto, em_falta } = fillTemplate(t, { nome: 'Maria Antónia' });
    expect(texto).toContain('Exmos. Senhores da [Nome da loja],');
    expect(texto).toContain('Eu, Maria Antónia, venho reclamar. \n');
    expect(em_falta).toEqual(['loja']);
  });

  it('deteta campos usados mas não declarados, e vice-versa', () => {
    const t = parseTemplate(SOURCE.replace('{{notas}}', '{{data_compra}}'));
    expect(checkTemplate(t)).toEqual([
      'campo {{data_compra}} usado mas não declarado',
      'campo "notas" declarado mas não usado',
    ]);
  });

  it('recusa modelos sem cabeçalho ou sem fonte', () => {
    expect(() => parseTemplate('# Só corpo')).toThrow(TemplateError);
    const semFonte = SOURCE.replace(/fontes:[\s\S]*?verificado_em/, 'fontes: []\nverificado_em');
    expect(() => parseTemplate(semFonte)).toThrow(/sem fonte/);
  });
});

describe('formatação de datas', () => {
  it('por extenso e abreviada', () => {
    expect(formatDateLong('2026-03-01')).toBe('1 de março de 2026');
    expect(formatDateShort('2026-03-01')).toBe('01/03/2026');
  });
});

describe('renderLetterPdf', () => {
  it('gera um PDF A4 com acentos portugueses e €', async () => {
    const bytes = await renderLetterPdf('# Reclamação\n\nAção, coração, órgão, €120,00 — nº 5', {
      titulo: 'Reclamação',
    });
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getTitle()).toBe('Reclamação');
    const { width, height } = doc.getPage(0).getSize();
    expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  });

  it('passa para uma nova página quando o texto não cabe', async () => {
    const longo = Array.from({ length: 120 }, (_, i) => `Linha ${i + 1} da carta.`).join('\n');
    const doc = await PDFDocument.load(await renderLetterPdf(longo));
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('avisa quando a letra por defeito não tem um carácter (em vez de o trocar)', async () => {
    await expect(renderLetterPdf('Nome: Łukasz Ștefan')).rejects.toBeInstanceOf(
      UnsupportedCharactersError,
    );
  });

  describe('com uma cadeia de letras (subconjuntos latin + latin-ext)', () => {
    const file = (subset: string) =>
      new Uint8Array(
        readFileSync(
          fileURLToPath(
            import.meta.resolve(
              `@fontsource/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-${subset}-400-normal.woff`,
            ),
          ),
        ),
      );
    const fonts = { regular: [file('latin'), file('latin-ext')] };

    it('junta os dois subconjuntos na mesma linha', async () => {
      const bytes = await renderLetterPdf('Eu, Łukasz Ștefan, venho reclamar da ação: €120.', {
        fonts,
      });
      expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    });

    it('recusa caracteres que nenhuma letra da cadeia tem (cirílico)', async () => {
      const erro = await renderLetterPdf('Олена', { fonts }).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(UnsupportedCharactersError);
      expect((erro as UnsupportedCharactersError).chars).toEqual(['О', 'л', 'е', 'н', 'а']);
    });

    it('sem a cadeia completa, o ç falta no subconjunto latin-ext', async () => {
      await expect(
        renderLetterPdf('Ação', { fonts: { regular: [file('latin-ext')] } }),
      ).rejects.toBeInstanceOf(UnsupportedCharactersError);
    });
  });
});
