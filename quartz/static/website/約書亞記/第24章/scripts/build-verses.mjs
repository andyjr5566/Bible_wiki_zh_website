// 從 vault 的 raw_scripture 抽出本站用到的所有經文（和合本），寫入 src/data/verses.json。
// 同時記錄相關章節主檔是否已存在於知識庫，供無 vault 的 CI 環境與 build-site.mjs 使用。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');

export const CHAPTERS = [
  ['創', '創世記', '01 創世記', [11, 12, 13, 15, 17, 23, 28, 31, 33, 34, 35, 37, 46, 48, 50]],
  ['出', '出埃及記', '02 出埃及記', [1, 12, 13, 14, 15, 19, 20, 23, 24]],
  ['民', '民數記', '04 民數記', [13, 14, 20, 21, 22, 23, 24, 25, 27]],
  ['申', '申命記', '05 申命記', [2, 5, 6, 7, 8, 10, 11, 27, 29, 30, 31, 34]],
  ['書', '約書亞記', '06 約書亞記', [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 17, 18, 19, 20, 21, 22, 23, 24]],
  ['士', '士師記', '07 士師記', [2, 6, 9, 11]],
  ['撒上', '撒母耳記上', '09 撒母耳記上', [7]],
  ['撒下', '撒母耳記下', '10 撒母耳記下', [18, 23]],
  ['王上', '列王紀上', '11 列王紀上', [12, 18]],
  ['約', '約翰福音', '43 約翰福音', [4]],
  ['徒', '使徒行傳', '44 使徒行傳', [7, 16]],
  ['來', '希伯來書', '58 希伯來書', [11]],
];

export function buildVerses() {
  const verses = {};
  const kbChapters = {};
  for (const [abbr, book, bookFolder, chs] of CHAPTERS) {
    for (const ch of chs) {
      const rawPath = resolve(ROOT, 'raw_scripture', book, `第${ch}章.txt`);
      const lines = readFileSync(rawPath, 'utf8')
        .replace(/^\uFEFF/, '')
        .split(/\r?\n/)
        .filter((l) => l.length > 0);
      lines.forEach((text, i) => {
        verses[`${abbr}${ch}:${i + 1}`] = text;
      });
      const kbMdPath = resolve(ROOT, bookFolder, `第${ch}章.md`);
      kbChapters[`${abbr}${ch}`] = {
        abbr,
        book,
        bookFolder,
        chapter: ch,
        kb: existsSync(kbMdPath),
      };
    }
  }
  return { verses, kbChapters };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const payload = buildVerses();
  const outPath = resolve(here, '../src/data/verses.json');
  writeFileSync(outPath, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`verses.json: ${Object.keys(payload.verses).length} 節, ${Object.keys(payload.kbChapters).length} 章`);
}
