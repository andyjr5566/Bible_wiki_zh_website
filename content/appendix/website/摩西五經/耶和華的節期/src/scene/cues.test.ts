import { describe, expect, it } from 'vitest';
import { SITE } from '../data/site';
import { bullDayCounts } from './booths';
import { CHAPTER_IDS, CUES, LATER_IDX, N_CUES, paletteAt } from './tracks';

describe('scene tracks', () => {
  it('CUES 與 site.json 的 chapters→beats 順序一致', () => {
    const fromSite = SITE.chapters.flatMap((ch) => ch.beats.map((b) => b.cue));
    expect([...CUES]).toEqual(fromSite);
  });
  it('paletteAt 全程回傳有效的配色索引', () => {
    for (let s = 0; s <= N_CUES; s += 0.01) {
      const p = paletteAt(s);
      expect(p.a).toBeGreaterThanOrEqual(0);
      expect(p.a).toBeLessThanOrEqual(LATER_IDX);
      expect(p.b).toBeLessThanOrEqual(LATER_IDX);
    }
    expect(LATER_IDX).toBe(CHAPTER_IDS.length);
  });
  it('每章都有配色可用', () => {
    for (const id of CHAPTER_IDS) expect(SITE.chapters.some((c) => c.id === id)).toBe(true);
  });
  it('住棚節每日公牛數取自 SITE.offerings（13→7，每日少一隻）', () => {
    expect(bullDayCounts()).toEqual([13, 12, 11, 10, 9, 8, 7]);
  });
});
