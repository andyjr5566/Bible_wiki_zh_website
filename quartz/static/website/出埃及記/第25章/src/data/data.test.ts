import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { STOPS } from './stops';
import { allFacts, allVoices } from './registry';
import type { Ref } from './types';

/** vault 根目錄：appendix/website/出埃及記/第25章/src/data → 上六層 */
const ROOT = resolve(__dirname, '../../../../../..');

const cache = new Map<number, string[]>();
function verses(ch: number): string[] {
  if (!cache.has(ch)) {
    const text = readFileSync(resolve(ROOT, 'raw_scripture', '出埃及記', `第${ch}章.txt`), 'utf8');
    cache.set(ch, text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0));
  }
  return cache.get(ch)!;
}

function refText(ref: Ref): string {
  const m = /^出(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`無法解析的出處：${ref}`);
  const vs = verses(+m[1]);
  const a = +m[2];
  const b = m[3] ? +m[3] : a;
  if (a < 1 || b > vs.length || b < a) throw new Error(`${ref} 超出出埃及記第${m[1]}章的 ${vs.length} 節`);
  return vs.slice(a - 1, b).join('');
}

/** 主檔去掉 Obsidian 標記（==高亮==、**粗體**、[[連結|顯示]]），留下讀者看到的字 */
const mdCache = new Map<number, string>();
function chapterMd(ch: number): string {
  if (!mdCache.has(ch)) {
    const raw = readFileSync(resolve(ROOT, '02 出埃及記', `第${ch}章.md`), 'utf8');
    mdCache.set(ch, raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/==/g, '').replace(/\*\*/g, ''));
  }
  return mdCache.get(ch)!;
}

describe('經文出處與逐字引文', () => {
  const facts = allFacts();
  it('有資料可以檢查', () => expect(facts.length).toBeGreaterThan(80));
  it('每個出處都指向存在的經節', () => {
    const bad: string[] = [];
    for (const f of facts) for (const r of f.refs ?? []) {
      try { refText(r); } catch (e) { bad.push(`${(e as Error).message}（${f.text}）`); }
    }
    expect(bad).toEqual([]);
  });
  it('每一段摘句都逐字出現在所引經節（和合本 raw_scripture）', () => {
    const bad = facts.filter((f) => f.q && !(f.refs ?? []).map(refText).join('').includes(f.q)).map((f) => `「${f.q}」不在 ${f.refs?.join('、')}`);
    expect(bad).toEqual([]);
  });
  it('「經文明說」一定附出處', () => {
    expect(facts.filter((f) => f.status === 'explicit' && !f.refs?.length).map((f) => f.text)).toEqual([]);
  });
});

describe('註釋家的話', () => {
  it('引號裡的話逐字出現在出埃及記該章主檔的「」內', () => {
    const bad: string[] = [];
    for (const v of allVoices()) {
      if (!v.quote) continue;
      const md = chapterMd(v.ch);
      if (!md.includes(v.quote)) { bad.push(`第${v.ch}章主檔找不到：${v.quote}`); continue; }
      const spans = md.match(/「[^」]*」/g) ?? [];
      if (!spans.some((s) => s.includes(v.quote!))) bad.push(`第${v.ch}章主檔裡這句不在「」內（是轉述）：${v.quote}`);
    }
    expect(bad).toEqual([]);
  });
});

describe('導覽', () => {
  it('兩種次序都是 1–9 且不重複', () => {
    expect(STOPS.map((s) => s.walk).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(STOPS.map((s) => s.reveal).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
});

describe('verses.json', () => {
  it('和 raw_scripture 完全一致（改了經文檔要重跑 npm run verses）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildVerses } = await import('../../scripts/build-verses.mjs');
    expect(JSON.parse(readFileSync(resolve(__dirname, 'verses.json'), 'utf8'))).toEqual(buildVerses());
  });
});
