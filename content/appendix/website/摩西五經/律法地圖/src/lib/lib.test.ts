import { describe, expect, it } from 'vitest';
import { charDiff, similarity } from './diff';
import { parseQueryRef, refHits } from './refs';
import { lintPlain, overlapRatio } from '../../scripts/build-data.mjs';

describe('搜尋框的經文參照', () => {
  it('解析', () => {
    expect(parseQueryRef('申15:12')).toEqual({ book: '申命記', chapter: 15, from: 12, to: 12 });
    expect(parseQueryRef('出 21：2-6')).toEqual({ book: '出埃及記', chapter: 21, from: 2, to: 6 });
    expect(parseQueryRef('利未記25章')).toEqual({ book: '利未記', chapter: 25 });
    expect(parseQueryRef('安息日')).toBeNull();
  });
  it('命中條文', () => {
    const law = { book: '申命記', chapter: 15, refs: [[12, 18]] as [number, number][] };
    expect(refHits({ book: '申命記', chapter: 15, from: 14, to: 14 }, law)).toBe(true);
    expect(refHits({ book: '申命記', chapter: 15, from: 1, to: 11 }, law)).toBe(false);
    expect(refHits({ book: '申命記', chapter: 15 }, law)).toBe(true);
  });
});

describe('字面差異', () => {
  it('只標出不同的字', () => {
    const parts = charDiff('當記念安息日', '當守安息日');
    expect(parts.map((p) => p.text).join('')).toBe('當記念守安息日');
    expect(parts.filter((p) => p.kind === 'same').map((p) => p.text).join('')).toBe('當安息日');
    expect(similarity(charDiff('一樣', '一樣'))).toBe(1);
  });
});

describe('白話說明 lint', () => {
  it('擋解釋性字眼、她、來源代號', () => {
    expect(lintPlain('這條律法象徵神的恩典')).toContain('解釋性字眼');
    expect(lintPlain('她可以出去')).toContain('和合本女性主詞用「他」');
    expect(lintPlain('GT 說第七年要放人')).toContain('來源代號不進白話說明');
    expect(lintPlain('這不是懲罰而是保護')).toContain('「不是…而是」對仗');
    expect(lintPlain('第七年可以白白地出去。')).toEqual([]);
  });
  it('重疊率', () => {
    expect(overlapRatio('第七年他可以自由', '第七年他可以自由，白白地出去。')).toBe(1);
    expect(overlapRatio('第七年可以自由', '第七年他可以自由，白白地出去。')).toBeCloseTo(5 / 6);
    expect(overlapRatio('預表基督的救贖', '第七年他可以自由')).toBe(0);
  });
});
