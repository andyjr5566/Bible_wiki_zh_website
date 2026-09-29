import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { SCENES } from './scenes';
import { allFacts, allVoices } from './registry';
import type { Ref } from './types';

/** vault 根目錄：appendix/website/創世記/第6章/src/data → 上六層 */
const ROOT = resolve(__dirname, '../../../../../..');

/**
 * 這幾項要對照 vault 裡的 raw_scripture 和章節主檔，只有在 vault 內才跑得動。
 * repo（CI）只帶著已產生的 verses.json，沒有這些來源檔，所以在那裡略過。
 */
const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture', '創世記'));

const cache = new Map<number, string[]>();
function verses(ch: number): string[] {
  if (!cache.has(ch)) {
    const text = readFileSync(resolve(ROOT, 'raw_scripture', '創世記', `第${ch}章.txt`), 'utf8');
    cache.set(ch, text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0));
  }
  return cache.get(ch)!;
}

function refText(ref: Ref): string {
  const m = /^創(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`無法解析的出處：${ref}`);
  const vs = verses(+m[1]);
  const a = +m[2];
  const b = m[3] ? +m[3] : a;
  if (a < 1 || b > vs.length || b < a) throw new Error(`${ref} 超出創世記第${m[1]}章的 ${vs.length} 節`);
  return vs.slice(a - 1, b).join('');
}

/** 主檔去掉 Obsidian 標記（==高亮==、**粗體**、[[連結|顯示]]），留下讀者看到的字 */
const mdCache = new Map<number, string>();
function chapterMd(ch: number): string {
  if (!mdCache.has(ch)) {
    const raw = readFileSync(resolve(ROOT, '01 創世記', `第${ch}章.md`), 'utf8');
    mdCache.set(ch, raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/==/g, '').replace(/\*\*/g, ''));
  }
  return mdCache.get(ch)!;
}

describe('經文出處與逐字引文', () => {
  const facts = allFacts();
  it('有資料可以檢查', () => expect(facts.length).toBeGreaterThan(60));
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
});

describe('註釋家的話', () => {
  it.skipIf(!IN_VAULT)('引號裡的話逐字出現在創世記該章主檔的「」內', () => {
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

describe('故事', () => {
  it('每一幕的 id 不重複', () => {
    const ids = SCENES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('verses.json', () => {
  it.skipIf(!IN_VAULT)('和 raw_scripture 完全一致（改了經文檔要重跑 npm run verses）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildVerses } = await import('../../scripts/build-verses.mjs');
    expect(JSON.parse(readFileSync(resolve(__dirname, 'verses.json'), 'utf8'))).toEqual(buildVerses());
  });
});
