// 從 vault 的 raw_scripture 抽出本站用到的經文，寫成 src/data/verses.json。
// 經文本文只取自 raw_scripture（和合本），不經模型改寫。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');
export const BOOKS = {
  利: '利未記',
  出: '出埃及記',
  民: '民數記',
  申: '申命記',
  太: '馬太福音',
  可: '馬可福音',
  路: '路加福音',
  約: '約翰福音',
  來: '希伯來書',
};
export const CHAPTERS = [
  ['利', [7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 22]],
  ['出', [4, 29, 40]],
  ['民', [5, 6, 9, 12]],
  ['申', [14, 23]],
  ['太', [8, 9]],
  ['可', [5, 7]],
  ['路', [2, 8]],
  ['約', [19]],
  ['來', [13]],
];

export function buildVerses() {
  const out = {};
  for (const [abbr, chs] of CHAPTERS) {
    for (const ch of chs) {
      const lines = readFileSync(resolve(ROOT, 'raw_scripture', BOOKS[abbr], `第${ch}章.txt`), 'utf8')
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
