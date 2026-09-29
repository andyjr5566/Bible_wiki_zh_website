import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLANS, LEVITE_TOTAL, LOADS } from './levites';
import { MARCH_NUM10, MARCH_NUM2 } from './march';
import { allFacts, allVoices } from './registry';
import { CAMPS, TOTAL_1, TOTAL_2, TOTAL_26, TRIBES, tribesOf } from './tribes';
import { SIGNALS } from './trumpets';
import type { Ref } from './types';

/** vault 根目錄：appendix/website/民數記/第2章/src/data → 上六層 */
const ROOT = resolve(__dirname, '../../../../../..');

/**
 * 這幾項要對照 vault 裡的 raw_scripture 和章節主檔，只有在 vault 內才跑得動。
 * repo（CI）只帶著已產生的 verses.json，沒有這些來源檔，所以在那裡略過。
 */
const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture', '民數記'));

const BOOKS: Record<string, string> = { 創: '創世記', 民: '民數記', 書: '約書亞記' };

const cache = new Map<string, string[]>();
function verses(book: string, ch: number): string[] {
  const key = `${book}${ch}`;
  if (!cache.has(key)) {
    const text = readFileSync(resolve(ROOT, 'raw_scripture', BOOKS[book], `第${ch}章.txt`), 'utf8');
    cache.set(key, text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0));
  }
  return cache.get(key)!;
}

function refText(ref: Ref): string {
  const m = /^(創|民|書)(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`無法解析的出處：${ref}`);
  const vs = verses(m[1], +m[2]);
  const a = +m[3];
  const b = m[4] ? +m[4] : a;
  if (a < 1 || b > vs.length || b < a) throw new Error(`${ref} 超出${BOOKS[m[1]]}第${m[2]}章的 ${vs.length} 節`);
  return vs.slice(a - 1, b).join('');
}

/** 主檔去掉 Obsidian 標記（==高亮==、**粗體**、[[連結|顯示]]），留下讀者看到的字 */
const mdCache = new Map<number, string>();
function chapterMd(ch: number): string {
  if (!mdCache.has(ch)) {
    const raw = readFileSync(resolve(ROOT, '04 民數記', `第${ch}章.md`), 'utf8');
    mdCache.set(ch, raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/==/g, '').replace(/\*\*/g, ''));
  }
  return mdCache.get(ch)!;
}

/** 經文裡的中文數字（七萬四千六百名、六十萬零三千五百五十名）→ 阿拉伯數字 */
const D: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function section(s: string): number {
  let total = 0;
  let cur = 0;
  for (const ch of s) {
    if (ch in D) cur = D[ch];
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { total += cur * 100; cur = 0; }
    else if (ch === '千') { total += cur * 1000; cur = 0; }
  }
  return total + cur;
}
function parseZh(zh: string): number {
  const s = zh.replace(/名$/, '');
  const [hi, lo] = s.includes('萬') ? s.split('萬') : ['', s];
  return (hi ? section(hi) * 10000 : 0) + section(lo);
}

describe('中文數字換算', () => {
  it('讀得懂本站用到的寫法', () => {
    expect(parseZh('七萬四千六百名')).toBe(74600);
    expect(parseZh('十八萬六千四百名')).toBe(186400);
    expect(parseZh('十萬零八千一百名')).toBe(108100);
    expect(parseZh('四萬零五百名')).toBe(40500);
    expect(parseZh('六十萬零三千五百五十名')).toBe(603550);
    expect(parseZh('四萬五千六百五十名')).toBe(45650);
  });
});

describe('結構', () => {
  it('十二支派、四營，每營三支派、順序 1–2–3', () => {
    expect(TRIBES).toHaveLength(12);
    expect(new Set(TRIBES.map((t) => t.id)).size).toBe(12);
    expect(CAMPS).toHaveLength(4);
    for (const c of CAMPS) {
      const ts = tribesOf(c.id);
      expect(ts.map((t) => t.rank)).toEqual([1, 2, 3]);
      expect(ts.map((t) => t.id)).toEqual(c.members);
      expect(ts[0].id).toBe(c.head);
    }
  });
  it('四營方位：東、南、西、北各一', () => {
    expect(CAMPS.map((c) => c.side)).toEqual(['east', 'south', 'west', 'north']);
  });
  it('民7 十二日獻禮的次序，和民2 安營次序一致（推算，不手寫）', () => {
    const inOrder = CAMPS.flatMap((c) => tribesOf(c.id));
    expect(inOrder.map((t) => t.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
  it('民10 的行軍次序：營與族的先後和經文敘述一致', () => {
    const refs = MARCH_NUM10.map((s) => Number(/:(\d+)/.exec(s.ref)![1]));
    expect(refs).toEqual([...refs].sort((a, b) => a - b));
    expect(MARCH_NUM10.flatMap((s) => s.camps ?? [])).toEqual(['judah', 'reuben', 'ephraim', 'dan']);
    expect(MARCH_NUM2.flatMap((s) => s.camps ?? [])).toEqual(['judah', 'reuben', 'ephraim', 'dan']);
  });
});

describe('算術', () => {
  it('每一營三支派相加＝營總數（民2:9、16、24、31）', () => {
    for (const c of CAMPS) expect(tribesOf(c.id).reduce((s, t) => s + t.c2.n, 0)).toBe(c.total.n);
  });
  it('四營相加＝603,550（民2:32、民1:46）', () => {
    expect(CAMPS.reduce((s, c) => s + c.total.n, 0)).toBe(TOTAL_2.n);
    expect(TOTAL_1.n).toBe(TOTAL_2.n);
    expect(TRIBES.reduce((s, t) => s + t.c1.n, 0)).toBe(TOTAL_1.n);
  });
  it('民2 與民1 每個支派的人數相同', () => {
    for (const t of TRIBES) expect(t.c2.n).toBe(t.c1.n);
  });
  it('民26 十二支派相加＝601,730', () => {
    expect(TRIBES.reduce((s, t) => s + t.c26.n, 0)).toBe(TOTAL_26.n);
  });
  it('利未三族 7,500＋8,600＋6,200＝22,300，和經文的 22,000 差 300', () => {
    const sum = CLANS.reduce((s, c) => s + (c.count?.n ?? 0), 0);
    expect(sum).toBe(22300);
    expect(sum - LEVITE_TOTAL.n).toBe(300);
  });
  it('車與牛：革順 2＋4、米拉利 4＋8、哥轄 0（民7:7-9）', () => {
    const w = Object.fromEntries(CLANS.map((c) => [c.id, [c.wagons.n, c.wagons.oxen]]));
    expect(w.gershon).toEqual([2, 4]);
    expect(w.merari).toEqual([4, 8]);
    expect(w.kohath).toEqual([0, 0]);
  });
  it('民4 的五件聖物，只有約櫃最外面是純藍色毯子', () => {
    expect(LOADS.filter((l) => l.outer === 'blue').map((l) => l.id)).toEqual(['ark']);
  });
});

describe('經文出處與逐字引文', () => {
  const facts = allFacts();
  it('有資料可以檢查', () => expect(facts.length).toBeGreaterThan(100));
  it.skipIf(!IN_VAULT)('每個出處都指向存在的經節', () => {
    const bad: string[] = [];
    for (const f of facts) for (const r of f.refs ?? []) {
      try { refText(r); } catch (e) { bad.push(`${(e as Error).message}（${f.text}）`); }
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('每一段摘句都逐字出現在所引經節（和合本 raw_scripture）', () => {
    const bad = facts.filter((f) => f.q && !(f.refs ?? []).map(refText).join('').includes(f.q)).map((f) => `「${f.q}」不在 ${f.refs?.join('、')}`);
    expect(bad).toEqual([]);
  });
  it('「經文明說」一定附出處和摘句', () => {
    expect(facts.filter((f) => f.status === 'explicit' && (!f.refs?.length || !f.q)).map((f) => f.text)).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('人數的中文寫法出現在所引經節，且換算後等於數字', () => {
    const bad: string[] = [];
    const counts = [
      ...TRIBES.flatMap((t) => [t.c2, t.c1, t.c26]),
      ...CAMPS.map((c) => c.total),
      ...CLANS.flatMap((c) => (c.count ? [c.count] : [])),
      TOTAL_1, TOTAL_2, TOTAL_26, LEVITE_TOTAL,
    ];
    for (const c of counts) {
      if (!refText(c.ref).includes(c.zh)) bad.push(`${c.ref} 沒有「${c.zh}」`);
      if (parseZh(c.zh) !== c.n) bad.push(`${c.zh} 換算是 ${parseZh(c.zh)}，資料寫 ${c.n}`);
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('首領在民2、民10 兩處都對得上', () => {
    const bad: string[] = [];
    for (const t of TRIBES) {
      const who = `${t.father}的兒子${t.leader}`;
      if (!refText(t.campRef).includes(who)) bad.push(`${t.campRef} 找不到 ${who}`);
      if (!refText(t.marchRef).includes(who)) bad.push(`${t.marchRef} 找不到 ${who}`);
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('民7 獻禮日的那一節寫著這個支派和首領', () => {
    const bad: string[] = [];
    for (const t of TRIBES) {
      const v = refText(t.dayRef);
      if (!v.includes(t.name)) bad.push(`${t.dayRef} 沒有支派名 ${t.name}`);
      if (!new RegExp(`${t.father}(的)?兒子${t.leader}`).test(v)) bad.push(`${t.dayRef} 沒有首領 ${t.leader}`);
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('母系：每個支派的名字出現在創35:23-26 對應的那一句', () => {
    const v = refText('創35:23-26');
    const line: Record<string, string> = {
      leah: '利亞所生的是雅各的長子流便，還有西緬、利未、猶大、以薩迦、西布倫',
      rachel: '拉結所生的是約瑟、便雅憫',
      bilhah: '拉結的使女辟拉所生的是但、拿弗他利',
      zilpah: '利亞的使女悉帕所生的是迦得、亞設',
    };
    const bad: string[] = [];
    for (const t of TRIBES) {
      // 以法蓮、瑪拿西是約瑟的兒子，母系照創35:24 算在拉結名下
      const who = t.id === 'ephraim' ? '約瑟' : t.id === 'manasseh' ? '約瑟' : t.name;
      if (!line[t.mother].includes(who)) bad.push(`${t.name} 不在「${line[t.mother]}」`);
    }
    expect(bad).toEqual([]);
    for (const l of Object.values(line)) expect(v.includes(l)).toBe(true);
  });
  it.skipIf(!IN_VAULT)('號聲：東、南營的字出現在所引經節', () => {
    for (const s of SIGNALS) {
      if (!s.camp) continue;
      expect(refText(s.ref)).toContain({ east: '東邊', south: '南邊', west: '西邊', north: '北邊' }[s.camp]);
    }
  });
  it.skipIf(!IN_VAULT)('營與族的方位字對得上經文', () => {
    const word = { east: '東', south: '南', west: '西', north: '北' } as const;
    for (const c of CAMPS) expect(refText(c.sideRef)).toContain(`在${word[c.side]}邊`);
    for (const c of CLANS) expect(refText(c.sideRef)).toContain(`${word[c.side]}邊`);
  });
});

describe('註釋家的話', () => {
  it.skipIf(!IN_VAULT)('引號裡的話逐字出現在主檔的「」內；轉述的關鍵詞出現在主檔', () => {
    const bad: string[] = [];
    for (const v of allVoices()) {
      const md = chapterMd(v.ch);
      if (v.quote) {
        if (!md.includes(v.quote)) { bad.push(`第${v.ch}章主檔找不到：${v.quote}`); continue; }
        const spans = md.match(/「[^」]*」/g) ?? [];
        // 主檔裡的長引文可能含巢狀引號（『』），所以同時接受「」跨過的較長範圍
        const inLong = md.split(/\n/).some((line) => {
          const i = line.indexOf(v.quote!);
          return i >= 0 && line.lastIndexOf('「', i) > line.lastIndexOf('」', i);
        });
        if (!spans.some((s) => s.includes(v.quote!)) && !inLong) bad.push(`第${v.ch}章主檔裡這句不在「」內（是轉述）：${v.quote}`);
      }
      for (const k of v.keys ?? []) if (!md.includes(k)) bad.push(`第${v.ch}章主檔找不到關鍵詞：${k}`);
      if (!v.quote && !v.keys?.length) bad.push(`${v.who}：沒有引號也沒有關鍵詞（${v.says}）`);
    }
    expect(bad).toEqual([]);
  });
});

describe('verses.json', () => {
  it.skipIf(!IN_VAULT)('和 raw_scripture 完全一致（改了經文檔要重跑 npm run verses）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildVerses } = await import('../../scripts/build-verses.mjs');
    expect(JSON.parse(readFileSync(resolve(__dirname, 'verses.json'), 'utf8'))).toEqual(buildVerses());
  });
});
