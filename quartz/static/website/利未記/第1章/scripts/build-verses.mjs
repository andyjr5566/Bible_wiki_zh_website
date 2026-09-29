// 從 vault 的 raw_scripture 抽出本站用到的經文，寫成 src/data/verses.json。
// 經文本文只取自 raw_scripture（和合本），不經模型改寫。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');
export const CHAPTERS = [
  ['利', '利未記', [1, 2, 3, 4, 5, 6, 7, 8, 9]],
  ['出', '出埃及記', [26, 27, 28, 30, 38, 40]],
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
