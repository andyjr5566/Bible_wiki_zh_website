import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BANNED, buildAll, lintCopy, lintPlain, renderOutputs } from '../../scripts/build-data.mjs';
import { extractRefs, IN_VAULT, ROOT, GIST_MAX, SITE } from '../../scripts/lib.mjs';
import data from './explorer.json';
import type { Explorer } from './types';
import { chapterUrl, entryUrl, WIKI_BASE } from './links';

const DB = data as unknown as Explorer;

describe('資料閘門（要在 vault 裡跑）', () => {
  const result = IN_VAULT ? buildAll() : null;

  it.skipIf(!IN_VAULT)('手寫資料沒有錯誤：經文範圍、依據節、子題、白話說明 lint、條目、關聯證據', () => {
    expect(result!.errors).toEqual([]);
  });

  it.skipIf(!IN_VAULT)('explorer.json 是最新的（改了 data/*.yaml 或 vault 之後要跑 npm run data）', () => {
    for (const [p, s] of Object.entries(renderOutputs(result!) as Record<string, string>)) {
      expect(existsSync(p), p).toBe(true);
      expect(readFileSync(p, 'utf8'), p).toBe(s);
    }
  });

  it.skipIf(!IN_VAULT)('經文逐字取自 raw_scripture', () => {
    for (const [key, text] of Object.entries(DB.verses)) {
      const m = /^(.)(\d+):(\d+)$/.exec(key)!;
      const book = DB.books.find((b) => b.abbr === m[1])!.name;
      const lines = readFileSync(resolve(ROOT, 'raw_scripture', book, `第${m[2]}章.txt`), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean);
      expect(lines[Number(m[3]) - 1], key).toBe(text);
    }
  });

  it.skipIf(!IN_VAULT)('首頁標語與「經文給的理由」都是和合本原句，理由節落在條文的經文範圍內', () => {
    const line = (book: string, ch: number, v: number) =>
      readFileSync(resolve(ROOT, 'raw_scripture', book, `第${ch}章.txt`), 'utf8').replace(/^﻿/, '').split(/\r?\n/).filter(Boolean)[v - 1];
    expect(DB.motto.text).toBe(line('詩篇', 1, 2));
    for (const l of DB.laws) {
      const inRefs = (n: number) => l.refs.some(([a, b]) => n >= a && n <= b);
      for (const n of l.why) {
        expect(inRefs(n), `${l.id} why ${n}`).toBe(true);
        const abbr = DB.books.find((b) => b.name === l.book)!.abbr;
        expect(DB.verses[`${abbr}${l.chapter}:${n}`], `${l.id} ${n}`).toBe(line(l.book, l.chapter, n));
      }
    }
  });

  it.skipIf(!IN_VAULT)('每個條目連結都對應 link_folder 裡真的存在的檔案', () => {
    for (const [title, info] of Object.entries(DB.entries)) {
      expect(existsSync(resolve(ROOT, 'link_folder', info.type, `${title}.md`)), title).toBe(true);
    }
  });
});

describe('不重工：知識庫內容只留名稱＋一句話＋連結', () => {
  it('條目簡介不超過 40 字', () => {
    for (const [title, info] of Object.entries(DB.entries)) expect([...info.gist].length, title).toBeLessThanOrEqual(GIST_MAX);
  });
  it('條目簡介不含原文字母與 Strong 編號', () => {
    for (const [title, info] of Object.entries(DB.entries)) expect(info.gist, title).not.toMatch(/[֐-׿]|\bH\d{3,}/);
  });
  it('連結是公開的網頁網址，不是 obsidian://', () => {
    const u = entryUrl('互文', '申15：12-18');
    expect(u.startsWith(WIKI_BASE)).toBe(true);
    expect(u).not.toMatch(/obsidian/i);
    expect(decodeURIComponent(u).endsWith('/link_folder/互文/申15：12-18')).toBe(true);
    expect(decodeURIComponent(chapterUrl(5, '申命記', 15)).endsWith('/05-申命記/第15章')).toBe(true);
  });
});

describe('結構', () => {
  it('每條律法都有段落、子題與白話說明', () => {
    const sections = new Set(DB.sections.map((s) => s.id));
    const topics = new Set(DB.topics.map((t) => t.id));
    for (const l of DB.laws) {
      expect(sections.has(l.section), l.id).toBe(true);
      expect(l.topics.length, l.id).toBeGreaterThan(0);
      for (const t of l.topics) expect(topics.has(t), `${l.id} ${t}`).toBe(true);
      expect(lintPlain(l.summary), l.id).toEqual([]);
    }
  });
  it('關聯兩端都存在，且都有證據', () => {
    const ids = new Set(DB.laws.map((l) => l.id));
    for (const r of DB.relations) {
      expect(ids.has(r.from) && ids.has(r.to)).toBe(true);
      expect(r.evidence.quote.length).toBeGreaterThan(0);
    }
  });
  it('經文片語位置落在經文範圍內', () => {
    for (const [key, links] of Object.entries(DB.links)) {
      const text = DB.verses[key];
      for (const k of links) expect(k.e <= text.length && k.s >= 0 && k.s < k.e, key).toBe(true);
    }
  });
});

describe('經文參照解析（證據引句用）', () => {
  it('各種寫法', () => {
    expect(extractRefs('申命記15章補充了出21:2-6的希伯來奴僕')).toEqual([
      { book: '申命記', chapter: 15, from: 1, to: Infinity },
      { book: '出埃及記', chapter: 21, from: 2, to: 6 },
    ]);
    expect(extractRefs('出二十11以神的創造為基礎')).toEqual([{ book: '出埃及記', chapter: 20, from: 11, to: 11 }]);
    expect(extractRefs('《出埃及記》二十一2～6同一條例')).toEqual([{ book: '出埃及記', chapter: 21, from: 2, to: 6 }]);
    expect(extractRefs('利25：39-43')).toEqual([{ book: '利未記', chapter: 25, from: 39, to: 43 }]);
  });
  it('一般文字不會被當成參照', () => {
    expect(extractRefs('他們出去歸回本家，利益歸主人')).toEqual([]);
  });
});

describe('首頁的問題卡', () => {
  it('問句過 lint、以問號結尾，答案的條文都存在', () => {
    const ids = new Set(DB.laws.map((l) => l.id));
    for (const q of DB.questions) {
      expect(lintCopy(q.q), q.q).toEqual([]);
      expect(q.q.endsWith('？'), q.q).toBe(true);
      expect(q.laws.length, q.q).toBeGreaterThan(0);
      for (const id of q.laws) expect(ids.has(id), `${q.q} ${id}`).toBe(true);
    }
  });
  it('標題 lint 擋得住標語式寫法與導覽口吻', () => {
    expect(lintCopy('同一條律法說了三次：奴僕的自由').length).toBeGreaterThan(0);
    expect(lintCopy('讓我們一起看安息日').length).toBeGreaterThan(0);
    expect(lintCopy('被賣的弟兄什麼時候自由')).toEqual([]);
  });
});

describe('介面文字不用公式句', () => {
  // 掃 src 底下所有程式裡的中文字串（註解也算），命中白話說明的禁用清單就失敗
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir, { withFileTypes: true })) {
      const p = resolve(dir, f.name);
      if (f.isDirectory()) walk(p);
      else if (/\.ts$/.test(f.name) && !/\.test\.ts$/.test(f.name)) files.push(p);
    }
  };
  walk(resolve(SITE, 'src'));
  it.each(files.map((f) => [f.slice(resolve(SITE, 'src').length + 1), f]))('%s', (_name, file) => {
    const text = readFileSync(file as string, 'utf8');
    const strings = text.match(/'[^'\n]*[一-鿿][^'\n]*'|`[^`]*[一-鿿][^`]*`/g) ?? [];
    for (const str of strings) for (const [re, why] of BANNED as [RegExp, string][]) {
      if (why.includes('她') || why.includes('來源代號') || why.includes('Strong')) continue;
      expect(re.test(str), `${why}：${str}`).toBe(false);
    }
  });
});

describe('新手教學用到的示範資料', () => {
  // 新手教學（src/ui/coach.ts）會請讀者點第一張問題卡、進它的律法、打開「別卷」、並排、再進利25:39。資料變動時要先確認這條路還走得通。
  it('第一張問題卡的律法有別卷記載，並且能並排到利25:39 與申15:12', async () => {
    const { DB, lawById, relationsOf } = await import('./db');
    const demo = DB.questions[0].laws[0];
    expect(lawById.has(demo)).toBe(true);
    const others = relationsOf(demo).map((r) => r.other.id);
    expect(others).toContain('lev25-39');
    expect(others).toContain('deut15-12');
  });
  it('利25:39 有「經文給的理由」，並且屬於「奴僕與自由」這個主題', async () => {
    const { lawById, lawWhy, topicById } = await import('./db');
    const l = lawById.get('lev25-39')!;
    expect(lawWhy(l).length).toBeGreaterThan(0);
    expect(l.topics[0]).toBe('slavery');
    expect(topicById.has('slavery')).toBe(true);
  });
});

describe('新手教學開場引用的經文', () => {
  it('開場引的那句是出21:2 的和合本原句', async () => {
    const { DB } = await import('./db');
    const { DEMO_QUOTE } = await import('../ui/coach');
    expect(DB.verses['出21:2']).toContain(DEMO_QUOTE);
  });
});
