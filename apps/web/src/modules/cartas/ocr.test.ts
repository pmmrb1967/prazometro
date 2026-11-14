import { describe, expect, it } from 'vitest';
import { contrastRange } from './ocr';

function histogram(levels: Record<number, number>) {
  const h = new Uint32Array(256);
  let total = 0;
  for (const [level, n] of Object.entries(levels)) {
    h[Number(level)] = n;
    total += n;
  }
  return { h, total };
}

describe('contrastRange', () => {
  it('estica entre os percentis 2 e 98 numa fotografia com tons espalhados', () => {
    const { h, total } = histogram({ 10: 50, 60: 100, 120: 300, 180: 400, 230: 100, 250: 50 });
    expect(contrastRange(h, total)).toEqual([10, 250]);
  });

  it('não estica papel branco com menos de 2% de texto (punha a imagem toda a preto)', () => {
    const { h, total } = histogram({ 0: 7, 255: 993 });
    expect(contrastRange(h, total)).toBeUndefined();
  });

  it('não estica uma imagem quase toda do mesmo cinzento', () => {
    const { h, total } = histogram({ 200: 500, 210: 500 });
    expect(contrastRange(h, total)).toBeUndefined();
  });
});
