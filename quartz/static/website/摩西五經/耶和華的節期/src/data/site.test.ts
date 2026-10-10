// 產出的 site.json 一致性：每一拍引用的註釋與原文字都解析得到、每則註釋有原站網址、
// 每個原文字有希伯來文、經文與條目都收齊。內容本身的對 vault 檢查在 scripts/build-data.mjs。
import { describe, expect, it } from 'vitest';
import { SITE } from './site';
import { chapterUrl, entryUrl, lawUrl } from './links';

/** 和合本整行「併於上節。」的節：不收進 VerseBlock.lines */
const MERGED_VERSES = [
  { book: '歷代志下', chapter: 30, verse: 19 },
  { book: '申命記', chapter: 15, verse: 5 },
  { book: '耶利米書', chapter: 34, verse: 9 },
  { book: '耶利米書', chapter: 34, verse: 19 },
];

const beats = SITE.chapters.flatMap((c) => c.beats.map((b) => ({ chapter: c.id, ...b })));

describe('site.json 一致性', () => {
  it('標題與標語', () => {
    expect(SITE.title).toBe('耶和華的節期');
    expect(SITE.motto.ref).toBe('利23:2');
    expect(SITE.motto.book).toBe('利未記');
    expect(SITE.motto.lines.length).toBeGreaterThan(0);
  });

  it('章與拍：id 不重複、每章都有拍', () => {
    expect(new Set(SITE.chapters.map((c) => c.id)).size).toBe(SITE.chapters.length);
    for (const c of SITE.chapters) {
      expect(c.beats.length, c.id).toBeGreaterThan(0);
      expect(new Set(c.beats.map((b) => b.id)).size, c.id).toBe(c.beats.length);
      for (const k of ['paper', 'ink', 'accent', 'glow'] as const) expect(c.palette[k], `${c.id}.${k}`).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('每一拍的 notes、words 都解析得到', () => {
    for (const b of beats) {
      for (const id of b.notes ?? []) expect(SITE.commentary[id], `${b.chapter}/${b.id} notes ${id}`).toBeDefined();
      for (const id of b.words ?? []) expect(SITE.step[id], `${b.chapter}/${b.id} words ${id}`).toBeDefined();
    }
  });

  it('每一拍的 verse 與每章的 passages 都有經文', () => {
    for (const b of beats) {
      if (b.verse) expect(SITE.verses[b.verse]?.lines.length, `${b.chapter}/${b.id} verse ${b.verse}`).toBeGreaterThan(0);
    }
    for (const c of SITE.chapters) for (const p of c.passages) expect(SITE.verses[p]?.lines.length, `${c.id} ${p}`).toBeGreaterThan(0);
  });

  it('經文每節有字、節號遞增且都在範圍內（整行「併於上節。」的節不收，例如代下30:19）', () => {
    for (const [ref, v] of Object.entries(SITE.verses)) {
      expect(v.ref).toBe(ref);
      const nums = v.lines.map((l) => l.v);
      expect(nums.length, ref).toBeGreaterThan(0);
      expect(nums, ref).toEqual([...nums].sort((a, b) => a - b));
      expect(new Set(nums).size, ref).toBe(nums.length);
      expect(nums[0], ref).toBeGreaterThanOrEqual(v.from);
      expect(nums[nums.length - 1], ref).toBeLessThanOrEqual(v.to);
      // 缺的節只能是併於上節的那一節（代下30:19、申15:5、耶34:9）
      const merged = MERGED_VERSES.filter((m) => m.book === v.book && m.chapter === v.chapter && m.verse >= v.from && m.verse <= v.to).length;
      expect(nums.length, ref).toBeGreaterThanOrEqual(v.to - v.from + 1 - merged);
      for (const l of v.lines) {
        expect(l.text.trim().length, `${ref}:${l.v}`).toBeGreaterThan(0);
        expect(l.text.trim(), `${ref}:${l.v}`).not.toMatch(/^併於上節。?$/);
      }
      expect(Number.isInteger(v.bookNum), ref).toBe(true);
      expect(typeof v.kb, ref).toBe('boolean');
    }
    expect(SITE.verses['代下30:18-20'].lines.map((l) => l.v)).toEqual([18, 20]);
  });

  it('回聲、長條圖、passage、ot：欄位彼此對得起來', () => {
    const byId = new Map<string, string[]>();
    for (const c of SITE.chapters) for (const b of c.beats) byId.set(b.id, [...(byId.get(b.id) ?? []), c.id]);
    for (const b of beats) {
      for (const id of b.echoes ?? []) {
        expect(byId.get(id)?.length, `${b.id} echoes ${id}`).toBe(1);
        expect(id, `${b.id} 不能指自己`).not.toBe(b.id);
      }
      for (const bar of b.bars ?? []) {
        const g = SITE.offerings[bar.ref];
        expect(g, `${b.id} bars ${bar.ref}`).toBeDefined();
        expect(g.items.some((i) => i.animal.startsWith('公牛')), `${b.id} bars ${bar.ref}`).toBe(true);
      }
    }
    for (const c of SITE.chapters) {
      if (c.kind === 'passage') {
        // 有 month 就一定有 monthTo；兩個都沒有（coda）月份導覽維持「不定日期」
        expect(c.monthTo === undefined, c.id).toBe(c.month === undefined);
        if (c.month !== undefined) expect(c.monthTo!, c.id).toBeGreaterThan(c.month);
        for (const b of c.beats) {
          expect(b.text, c.id).toBe('');
          expect(b.notes ?? b.words ?? b.offerings ?? b.verse, c.id).toBeUndefined();
        }
      } else {
        expect(c.monthTo, c.id).toBeUndefined();
        for (const b of c.beats) expect(b.text.length, `${c.id}/${b.id}`).toBeGreaterThan(0);
      }
      for (const o of c.ot ?? []) {
        expect(['kept', 'word'], c.id).toContain(o.kind);
        expect(SITE.verses[o.ref], `${c.id} ot ${o.ref}`).toBeDefined();
        expect(o.note.trim().length, o.ref).toBeGreaterThan(0);
        expect([...o.note].length, o.ref).toBeLessThanOrEqual(120);
      }
    }
    for (const k of ['paper', 'ink', 'accent', 'glow'] as const) expect(SITE.laterPalette[k]).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('回看 recall：指到唯一存在的拍、不指自己、不是回聲拍；律法地圖 laws 有 id 與標題；sevens 是 7、49、50', () => {
    const byId = new Map<string, string[]>();
    for (const c of SITE.chapters) for (const b of c.beats) byId.set(b.id, [...(byId.get(b.id) ?? []), c.id]);
    const recalls = beats.filter((b) => b.recall);
    expect(recalls.length).toBeGreaterThan(0);
    for (const b of recalls) {
      expect(b.recall!.length, b.id).toBeGreaterThan(0);
      for (const id of b.recall!) {
        expect(byId.get(id)?.length, `${b.id} recall ${id}`).toBe(1);
        expect(id, `${b.id} 不能指自己`).not.toBe(b.id);
      }
      expect(b.echoes, `${b.id} 回看不是回聲`).toBeUndefined();
    }
    for (const c of SITE.chapters) {
      for (const l of c.laws ?? []) {
        expect(l.id, c.id).toMatch(/^[a-z]+\d+-\d+$/);
        expect(l.title.trim().length, `${c.id} ${l.id}`).toBeGreaterThan(0);
      }
    }
    expect(SITE.chapters.find((c) => c.id === 'sevens')?.laws?.length).toBeGreaterThan(0);
    expect(SITE.sevens).toEqual({ days: 7, weeks49: 49, fifty: 50 });
  });

  it('moreVerses 都有經文、不和 verse 重複', () => {
    for (const b of beats) {
      for (const ref of b.moreVerses ?? []) {
        expect(SITE.verses[ref]?.lines.length, `${b.id} moreVerses ${ref}`).toBeGreaterThan(0);
        expect(ref, `${b.id}`).not.toBe(b.verse);
      }
    }
  });

  it('bulls 拍的長條圖：七條，公牛合計 70', () => {
    const bulls = beats.find((b) => b.id === 'bulls')!;
    const counts = bulls.bars!.map((bar) => SITE.offerings[bar.ref].items.filter((i) => i.animal.startsWith('公牛')).reduce((n, i) => n + i.count, 0));
    expect(counts).toEqual([13, 12, 11, 10, 9, 8, 7]);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(70);
  });

  it('每則註釋有原站網址，且有 quote 或 paraphrase；英文來源的引文附中譯', () => {
    for (const n of Object.values(SITE.commentary)) {
      expect(n.url, n.id).toMatch(/^https?:\/\//);
      expect(n.quote || n.paraphrase, n.id).toBeTruthy();
      expect(n.work.trim().length, n.id).toBeGreaterThan(0);
      if ((n.source === 'KC' || n.source === 'BH') && n.quote) expect(n.quoteZh, n.id).toBeTruthy();
      if (n.source === 'CT' || n.source === 'GT') expect(n.quoteZh, n.id).toBeUndefined();
    }
  });

  it('授權頁的來源涵蓋每則註釋與每個原文字用到的章', () => {
    const has = (book: string, chapter: number, source: string) => SITE.sources.some((s) => s.book === book && s.chapter === chapter && s.source === source && /^https?:\/\//.test(s.url));
    for (const n of Object.values(SITE.commentary)) expect(has(n.book, n.chapter, n.source), `${n.id} 的來源`).toBe(true);
    for (const w of Object.values(SITE.step)) {
      const m = /^(.)(\d+):/.exec(w.ref)!;
      const book = { 創: '創世記', 出: '出埃及記', 利: '利未記', 民: '民數記', 申: '申命記' }[m[1] as '出'];
      expect(has(book, Number(m[2]), 'STEP'), `${w.id} 的 STEP 來源`).toBe(true);
    }
  });

  it('每個原文字都有希伯來文、Strong、詞形與說明', () => {
    for (const w of Object.values(SITE.step)) {
      expect(w.hebrew, w.id).toMatch(/[֐-׿]/);
      expect(w.strong, w.id).toMatch(/^H\d+/);
      expect(w.translit.length, w.id).toBeGreaterThan(0);
      expect(w.gloss.length, w.id).toBeGreaterThan(0);
      expect(w.morph.length, w.id).toBeGreaterThan(0);
      expect(w.lexicon.length, w.id).toBeGreaterThan(0);
      expect(w.note.length, w.id).toBeGreaterThan(0);
      expect(w.hebrew, w.id).not.toMatch(/[/\\]/);
    }
  });

  it('條目：章裡列的 entries、nt 都在 entries 表裡，且有類型', () => {
    for (const c of SITE.chapters) {
      for (const t of [...c.entries, ...c.nt]) {
        expect(SITE.entries[t], `${c.id} ${t}`).toBeDefined();
        expect(SITE.entries[t].type.length, t).toBeGreaterThan(0);
        expect(SITE.entries[t].title).toBe(t);
      }
    }
  });

  it('每段文字的 ==…== 最多一處', () => {
    const count = (s: string | undefined) => (s?.match(/==[^=]+?==/g) ?? []).length;
    for (const b of beats) expect(count(b.text), `${b.chapter}/${b.id}`).toBeLessThanOrEqual(1);
    for (const n of Object.values(SITE.commentary)) expect(count(n.paraphrase), n.id).toBeLessThanOrEqual(1);
    for (const w of Object.values(SITE.step)) expect(count(w.note), w.id).toBeLessThanOrEqual(1);
  });

  it('音檔：license 是 CC0、有來源頁；pages（若有）包含 page', () => {
    expect(new Set(SITE.audio.map((a) => a.id)).size).toBe(SITE.audio.length);
    for (const a of SITE.audio) {
      expect(a.license, a.id).toBe('CC0');
      expect(a.page, a.id).toMatch(/^https?:\/\//);
      expect(a.downloaded, a.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      if (a.pages) {
        expect(a.pages, a.id).toContain(a.page);
        for (const u of a.pages) expect(u, a.id).toMatch(/^https?:\/\//);
      }
    }
  });
});

describe('links.ts', () => {
  it('條目與章節網址有編碼', () => {
    expect(entryUrl('歷史', '逾越節')).toMatch(/\/link_folder\/%E6%AD%B7%E5%8F%B2\/%E9%80%BE%E8%B6%8A%E7%AF%80$/);
    expect(lawUrl('lev25-08')).toBe('../../律法地圖/dist/index.html#/law/lev25-08');
    expect(chapterUrl(2, '出埃及記', 12)).toMatch(/\/02-%E5%87%BA%E5%9F%83%E5%8F%8A%E8%A8%98\/%E7%AC%AC12%E7%AB%A0$/);
  });
});
