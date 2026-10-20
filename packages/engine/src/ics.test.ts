import { describe, expect, it } from 'vitest';
import { buildIcs } from './ics';

const agora = new Date('2026-10-20T10:00:00Z');

describe('buildIcs', () => {
  const ics = buildIcs(
    [
      {
        uid: 'compra-1',
        data: '2029-10-20',
        titulo: 'Fim da garantia: máquina de lavar',
        descricao: 'Loja X, fatura n.º 12; guardar a fatura.\nLinha 2',
        alarmes_dias_antes: [0, 30, 1],
      },
    ],
    { agora },
  );

  it('usa CRLF e termina com END:VCALENDAR', () => {
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('cria um evento de dia inteiro', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20291020');
    expect(ics).toContain('DTEND;VALUE=DATE:20291021');
    expect(ics).toContain('DTSTAMP:20261020T100000Z');
    expect(ics).toContain('UID:compra-1@prazometro');
  });

  it('escapa vírgulas, pontos e vírgulas e quebras de linha', () => {
    expect(ics).toContain('DESCRIPTION:Loja X\\, fatura n.º 12\\; guardar a fatura.\\nLinha 2');
  });

  it('alarmes às 09:00: 30 dias antes, na véspera e no próprio dia', () => {
    const triggers = [...ics.matchAll(/TRIGGER:(.*)\r\n/g)].map((m) => m[1]);
    expect(triggers).toEqual(['-P29DT15H', '-PT15H', 'PT9H']);
  });

  it('dobra linhas longas sem partir caracteres acentuados', () => {
    const longo = buildIcs(
      [{ uid: 'x', data: '2027-01-01', titulo: 'Prazo ' + 'ação '.repeat(30) }],
      {
        agora,
      },
    );
    // Tamanho em octetos UTF-8, calculado de forma independente do código testado.
    const octets = (s: string) => unescape(encodeURIComponent(s)).length;
    for (const line of longo.split('\r\n')) {
      expect(octets(line)).toBeLessThanOrEqual(75);
    }
    expect(longo).toContain('\r\n ');
    // Desdobrar devolve o texto original.
    expect(longo.replace(/\r\n /g, '')).toContain('SUMMARY:Prazo ' + 'ação '.repeat(30).trimEnd());
  });

  it('recusa alarmes negativos', () => {
    expect(() =>
      buildIcs([{ uid: 'x', data: '2027-01-01', titulo: 't', alarmes_dias_antes: [-1] }]),
    ).toThrow(RangeError);
  });
});
