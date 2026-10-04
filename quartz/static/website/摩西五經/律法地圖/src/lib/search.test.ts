import { describe, expect, it } from 'vitest';
import { search } from './search';

describe('搜尋框', () => {
  it('標題有這個詞的條文排在只有經文提到的前面', () => {
    const r = search('安息日', 8);
    expect(r.laws.length).toBeGreaterThan(0);
    expect(r.laws[0].title.includes('安息日')).toBe(true);
  });
  it('經文出處直接找到那一節所在的條文', () => {
    const r = search('申15:12');
    expect(r.ref?.laws.some((l) => l.id === 'deut15-12')).toBe(true);
    expect(r.laws).toEqual([]);
  });
  it('寄居的、不可取利都找得到條文', () => {
    expect(search('寄居的').laws.length).toBeGreaterThan(0);
    expect(search('不可取利').laws.some((l) => l.title.includes('取利') || l.summary.includes('取利'))).toBe(true);
  });
  it('主題名稱完全相同的排最前面', () => {
    const r = search('安息日');
    const first = r.topics[0];
    expect(first.plain === '安息日' || first.name === '安息日').toBe(true);
  });
  it('找不到的字回傳空', () => {
    const r = search('zzzz不存在');
    expect(r.laws).toEqual([]);
    expect(r.topics).toEqual([]);
    expect(r.entries).toEqual([]);
  });
});
