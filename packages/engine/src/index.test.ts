import { describe, expect, it } from 'vitest';
import { ENGINE_VERSION } from './index';

describe('engine', () => {
  it('exporta a versão', () => {
    expect(ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
