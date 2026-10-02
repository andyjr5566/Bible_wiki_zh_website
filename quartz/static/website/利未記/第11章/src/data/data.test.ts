import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { allFacts, allVoices } from './registry';
import type { Ref } from './types';

/** vault 根目錄：appendix/website/利未記/第11章/src/data → 上六層 */
const ROOT = resolve(__dirname, '../../../../../..');

/**
 * 這幾項要對照 vault 裡的 raw_scripture 和章節主檔，只有在 vault 內才跑得動。
 * repo（CI）只帶著已產生的 verses.json，沒有這些來源檔，所以在那裡略過。
 */
const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture', '利未記'));
const BOOKS: Record<string, string> = {
  利: '利未記', 出: '出埃及記', 民: '民數記', 申: '申命記', 太: '馬太福音', 可: '馬可福音', 路: '路加福音', 約: '約翰福音', 來: '希伯來書',
};

const chapterCache = new Map<string, string[]>();
function verses(book: string, ch: number): string[] {
  const key = `${book}${ch}`;
  if (!chapterCache.has(key)) {
    const text = readFileSync(resolve(ROOT, 'raw_scripture', BOOKS[book], `第${ch}章.txt`), 'utf8');
    chapterCache.set(key, text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0));
  }
  return chapterCache.get(key)!;
}

const REF_RE = /^(利|出|民|申|太|可|路|約|來)(\d+):(\d+)(?:-(\d+))?$/;

function refText(ref: Ref): string {
  const m = REF_RE.exec(ref);
  if (!m) throw new Error(`無法解析的出處：${ref}`);
  const [, book, ch, a, b] = m;
  const vs = verses(book, +ch);
  const from = +a;
  const to = b ? +b : from;
  if (from < 1 || to > vs.length || to < from) throw new Error(`${ref} 超出 ${BOOKS[book]}第${ch}章的 ${vs.length} 節`);
  return vs.slice(from - 1, to).join('');
}

const mdCache = new Map<number, string>();
function chapterMd(ch: number): string {
  if (!mdCache.has(ch)) mdCache.set(ch, readFileSync(resolve(ROOT, '03 利未記', `第${ch}章.md`), 'utf8'));
  return mdCache.get(ch)!;
}

describe('經文出處與逐字引文', () => {
  const items = allFacts();

  it('有資料可以檢查', () => {
    expect(items.length).toBeGreaterThan(60);
  });

  it.skipIf(!IN_VAULT)('每個出處都指向存在的經節', () => {
    const bad: string[] = [];
    for (const it of items) for (const r of it.refs ?? []) {
      try {
        refText(r);
      } catch (e) {
        bad.push(`${(e as Error).message}（${it.text}）`);
      }
    }
    expect(bad).toEqual([]);
  });

  it.skipIf(!IN_VAULT)('每一段「」摘句都逐字出現在所引經節（和合本 raw_scripture）', () => {
    const bad: string[] = [];
    for (const it of items) {
      if (!it.q) continue;
      if (!it.refs?.length) {
        bad.push(`有摘句卻沒有出處：${it.q}`);
        continue;
      }
      const text = it.refs.map(refText).join('');
      if (!text.includes(it.q)) bad.push(`「${it.q}」不在 ${it.refs.join('、')}`);
    }
    expect(bad).toEqual([]);
  });

  it('「經文明說」一定附出處', () => {
    const bad = items.filter((i) => i.status === 'explicit' && !(i.refs?.length)).map((i) => i.text);
    expect(bad).toEqual([]);
  });
});

describe('註釋家的話', () => {
  it.skipIf(!IN_VAULT)('每一句引用都逐字出現在利未記該章主檔的「」裡', () => {
    const bad: string[] = [];
    for (const v of allVoices()) {
      if (!v.quote) continue;
      const md = chapterMd(v.ch);
      const spans = md.match(/「[^」]*」/g) ?? [];
      if (!md.includes(v.quote)) bad.push(`第${v.ch}章主檔找不到：${v.quote}`);
      else if (!spans.some((s) => s.includes(v.quote!))) bad.push(`第${v.ch}章主檔裡這句不在「」內（是轉述）：${v.quote}`);
    }
    expect(bad).toEqual([]);
  });

  it('英文來源（KC、BH）只轉述，不加引號', () => {
    const bad = allVoices().filter((v) => /^(KC|BH)/.test(v.who) && v.quote).map((v) => `${v.who}：${v.quote}`);
    expect(bad).toEqual([]);
  });
});

describe('verses.json', () => {
  it.skipIf(!IN_VAULT)('和 raw_scripture 完全一致（改了經文檔要重跑 npm run verses）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildVerses } = await import('../../scripts/build-verses.mjs');
    const onDisk = JSON.parse(readFileSync(resolve(__dirname, 'verses.json'), 'utf8'));
    expect(onDisk).toEqual(buildVerses());
  });
});
