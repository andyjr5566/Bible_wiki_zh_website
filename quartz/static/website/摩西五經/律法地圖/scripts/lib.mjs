// 產資料腳本共用的讀檔與解析函式。只讀 vault，不寫入 vault。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SITE = resolve(here, '..');
export const ROOT = resolve(SITE, '../../../..');
export const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture')) && existsSync(resolve(ROOT, 'link_folder'));

/** 摩西五經：簡稱、書名、資料夾名（與 util/book_paths.py 的「01 創世記」一致）、公開網站的資料夾名 */
export const BOOKS = [
  { abbr: '創', name: '創世記', num: 1 },
  { abbr: '出', name: '出埃及記', num: 2 },
  { abbr: '利', name: '利未記', num: 3 },
  { abbr: '民', name: '民數記', num: 4 },
  { abbr: '申', name: '申命記', num: 5 },
].map((b) => ({ ...b, dir: `${String(b.num).padStart(2, '0')} ${b.name}` }));
export const BOOK_BY_NAME = Object.fromEntries(BOOKS.map((b) => [b.name, b]));
export const BOOK_BY_ABBR = Object.fromEntries(BOOKS.map((b) => [b.abbr, b]));

export const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

// ---------- 經文 ----------

const verseCache = new Map();
/** raw_scripture/<書名>/第N章.txt：第 N 行＝第 N 節。經文只取自這裡，不改寫。 */
export function chapterVerses(book, chapter) {
  const key = `${book}/${chapter}`;
  if (!verseCache.has(key)) {
    const p = resolve(ROOT, 'raw_scripture', book, `第${chapter}章.txt`);
    verseCache.set(key, existsSync(p) ? read(p).split(/\r?\n/).filter((l) => l.length > 0) : null);
  }
  return verseCache.get(key);
}

/** "2-6" → [2, 6]；"5" → [5, 5] */
export function parseRange(text) {
  const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(String(text));
  if (!m) return null;
  const a = Number(m[1]);
  const b = m[2] ? Number(m[2]) : a;
  return a <= b ? [a, b] : null;
}

export const versesOf = (ranges) => ranges.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

/** 把節號清單壓成區間：[1,2,3,7] → [[1,3],[7,7]] */
export function toRanges(nums) {
  const out = [];
  for (const n of [...new Set(nums)].sort((x, y) => x - y)) {
    const last = out[out.length - 1];
    if (last && n === last[1] + 1) last[1] = n;
    else out.push([n, n]);
  }
  return out;
}

// ---------- 經文參照解析（證據引句用） ----------

const CN_DIGIT = { 〇: 0, 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 二十一 → 21、一百二十 → 120、十五 → 15 */
export function cnNumber(text) {
  let total = 0;
  let cur = 0;
  for (const ch of text) {
    if (ch in CN_DIGIT) cur = CN_DIGIT[ch];
    else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
    else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
    else return NaN;
  }
  return total + cur;
}

const BOOK_ALT = BOOKS.flatMap((b) => [b.name, b.abbr]).join('|');
// 出21:2-6、出21：2、利25:39-43、出二十一2～6、《出埃及記》二十一2～6、申15章
const REF_RE = new RegExp(
  `《?(${BOOK_ALT})》?\\s*` +
    '(?:' +
    '(\\d+)\\s*[:：]\\s*(\\d+)(?:\\s*[-–~～至]\\s*(\\d+))?' + // 阿拉伯數字章:節
    '|([〇零一二兩三四五六七八九十百]+)\\s*(\\d+)(?:\\s*[-–~～至]\\s*(\\d+))?' + // 中文章＋阿拉伯節
    '|(\\d+)\\s*章' + // 整章
    ')',
  'g',
);

/** 從一段文字抽出五經的經文參照：[{book, chapter, from, to}]（整章時 from=1, to=Infinity） */
export function extractRefs(text) {
  const out = [];
  for (const m of String(text).matchAll(REF_RE)) {
    const book = (BOOK_BY_NAME[m[1]] ?? BOOK_BY_ABBR[m[1]]).name;
    if (m[2]) out.push({ book, chapter: Number(m[2]), from: Number(m[3]), to: Number(m[4] ?? m[3]) });
    else if (m[5]) {
      const chapter = cnNumber(m[5]);
      if (Number.isFinite(chapter) && chapter > 0) out.push({ book, chapter, from: Number(m[6]), to: Number(m[7] ?? m[6]) });
    } else if (m[8]) out.push({ book, chapter: Number(m[8]), from: 1, to: Infinity });
  }
  return out;
}

/** 參照是否碰到某條律法（同卷同章且節數有交集） */
export function refTouchesLaw(ref, law) {
  return ref.book === law.book && ref.chapter === law.chapter && law.refs.some(([a, b]) => ref.from <= b && ref.to >= a);
}

// ---------- 經文裡的知識節點 ----------

/** <NN 書名>/.tmp/第N章/verse_links.yaml（創世記早期放在根目錄 .tmp/<NN 書名>/ 底下） */
export function verseLinksPath(book, chapter) {
  const dir = BOOK_BY_NAME[book].dir;
  const candidates = [
    resolve(ROOT, dir, '.tmp', `第${chapter}章`, 'verse_links.yaml'),
    resolve(ROOT, '.tmp', dir, `第${chapter}章`, 'verse_links.yaml'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

// ---------- 知識庫條目 ----------

let entryIndex = null;
/** 掃 link_folder：{title → {type, path}}，別名另存 alias → title */
export function entries() {
  if (entryIndex) return entryIndex;
  const byTitle = new Map();
  const alias = new Map();
  const base = resolve(ROOT, 'link_folder');
  for (const type of readdirSync(base, { withFileTypes: true })) {
    if (!type.isDirectory() || type.name.startsWith('.')) continue;
    for (const f of readdirSync(resolve(base, type.name))) {
      if (!f.endsWith('.md')) continue;
      const title = f.slice(0, -3);
      const path = resolve(base, type.name, f);
      byTitle.set(title, { type: type.name, path });
      const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(read(path));
      const am = fm && /^aliases:\s*\[(.*)\]\s*$/m.exec(fm[1]);
      if (am) for (const a of am[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)) if (!alias.has(a)) alias.set(a, title);
    }
  }
  entryIndex = { byTitle, alias };
  return entryIndex;
}

/** 標題或別名 → 正式標題；解不到回 null */
export function resolveEntry(name) {
  const { byTitle, alias } = entries();
  if (byTitle.has(name)) return name;
  return alias.get(name) ?? null;
}

/** 去掉 Obsidian 標記，留下讀者看到的字 */
export const plainText = (md) =>
  md
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1');

export const GIST_MAX = 40;
/** 條目「## 定義」的第一句，截到 40 字。只用來簡單提一下，完整內容一律連出去。 */
export function entryGist(title) {
  const e = entries().byTitle.get(title);
  if (!e) return '';
  const m = /^## 定義\s*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(read(e.path));
  const para = plainText((m?.[1] ?? '').trim().split(/\r?\n\s*\r?\n/)[0] ?? '')
    // 一句簡介是給一般讀者的：音譯、希伯來字母、Strong 編號留在條目頁，不進來
    .replace(/[（(][^（）()]*[A-Za-z֐-׿][^（）()]*[）)]/g, '')
    .replace(/[֐-׿]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const first = /^[^。！？]*[。！？]?/.exec(para)?.[0] ?? '';
  return first.length > GIST_MAX ? `${first.slice(0, GIST_MAX - 1)}…` : first;
}

export const entryText = (title) => {
  const e = entries().byTitle.get(title);
  return e ? read(e.path) : '';
};

// ---------- 章節 md ----------

export const chapterMdPath = (book, chapter) => resolve(ROOT, BOOK_BY_NAME[book].dir, `第${chapter}章.md`);

/** 章節 md 的「## 本章整理」那一段 */
export function chapterOrganization(book, chapter) {
  const p = chapterMdPath(book, chapter);
  if (!existsSync(p)) return '';
  const m = /^## 本章整理\s*$([\s\S]*?)(?=^## |^<!-- appendix-links:start|(?![\s\S]))/m.exec(read(p));
  return m ? m[1] : '';
}

/** 各卷「全書目錄及綱要.md」的 ### 標題（含「（a-b 章）」）→ 法典段落 */
export function bookCodes(book) {
  const p = resolve(ROOT, BOOK_BY_NAME[book].dir, '全書目錄及綱要.md');
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of read(p).split(/\r?\n/)) {
    const m = /^###\s+(.+?)（(\d+)\s*[-–]\s*(\d+)\s*章）\s*$/.exec(line);
    if (m) out.push({ title: m[1].trim(), from: Number(m[2]), to: Number(m[3]) });
  }
  return out;
}
