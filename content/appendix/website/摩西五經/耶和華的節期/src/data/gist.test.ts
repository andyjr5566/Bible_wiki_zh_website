import { describe, expect, it } from 'vitest';
import site from './site.json';

describe('條目簡介', () => {
  it('每個條目都有簡介，且不超過 40 字', () => {
    for (const [title, e] of Object.entries(site.entries)) {
      expect(e.gist, title).toBeTruthy();
      expect([...e.gist].length, title).toBeLessThanOrEqual(40);
    }
  });
  it('簡介不是被截斷的半句（不以「…」結尾）', () => {
    for (const [title, e] of Object.entries(site.entries)) expect(e.gist.endsWith('…'), title).toBe(false);
  });
});
