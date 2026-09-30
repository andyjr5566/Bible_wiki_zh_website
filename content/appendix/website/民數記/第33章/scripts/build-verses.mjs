// 從 vault 的 raw_scripture 抽出本站用到的經文，寫成 src/data/verses.json。
// 經文本文只取自 raw_scripture（和合本），不經模型改寫。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');
export const CHAPTERS = [
  ['創', '創世記', [47]],
  ['出', '出埃及記', [12, 13, 14, 15, 16, 17, 19, 20, 40]],
  ['民', '民數記', [1, 9, 10, 11, 12, 13, 14, 20, 21, 22, 25, 26, 27, 32, 33, 36]],
  ['申', '申命記', [1, 2, 10, 34]],
  ['書', '約書亞記', [3]],
];

export function buildVerses() {
  const out = {};
  for (const [abbr, book, chs] of CHAPTERS) {
    for (const ch of chs) {
      const lines = readFileSync(resolve(ROOT, 'raw_scripture', book, `第${ch}章.txt`), 'utf8')
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .filter((l) => l.length > 0);
      lines.forEach((text, i) => (out[`${abbr}${ch}:${i + 1}`] = text));
    }
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const verses = buildVerses();
  writeFileSync(resolve(here, '../src/data/verses.json'), JSON.stringify(verses, null, 0) + '\n', 'utf8');
  console.log(`verses.json: ${Object.keys(verses).length} 節`);
}
