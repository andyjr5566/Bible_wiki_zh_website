// 建置腳本共用的「讀 vault」與「解析」函式。只讀 vault，不寫入 vault。
// 結構照 appendix/website/摩西五經/律法地圖/scripts/lib.mjs（IN_VAULT 判斷、經文與條目讀法），
// 另外加上本站需要的：經文參照解析、source_manifest 解析、STEP 表格解析。
// 純驗證邏輯（不碰檔案系統）放在 checks.mjs，方便用測試固定行為。
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import YAML from 'yaml';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const SITE_DIR = resolve(here, '..');
export const ROOT = resolve(SITE_DIR, '../../../..');
export const RAW_DATA_DIR = resolve(ROOT, 'raw_data');
/** 姊妹網站「律法地圖」（唯讀）：章末的律法地圖欄取條文標題 */
export const LAWMAP_DIR = resolve(SITE_DIR, '../律法地圖');
/** 在 scripture 專案裡才有 vault；部署（CI）時只有網站本身 */
export const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture')) && existsSync(resolve(ROOT, 'link_folder'));

/**
 * 本站用到的書卷：簡稱、書名、STEP 檔案裡的英文書名（en）、書卷序號、書卷資料夾
 * （與 util/book_paths.py 的「01 創世記」一致）。
 * 詩篇的 STEP 書名是複數「Psalms」，BibleHub 標題是單數「Psalm」（bh）。
 */
export const BOOKS = [
  { abbr: '創', name: '創世記', en: 'Genesis', num: 1 },
  { abbr: '出', name: '出埃及記', en: 'Exodus', num: 2 },
  { abbr: '利', name: '利未記', en: 'Leviticus', num: 3 },
  { abbr: '民', name: '民數記', en: 'Numbers', num: 4 },
  { abbr: '申', name: '申命記', en: 'Deuteronomy', num: 5 },
  { abbr: '書', name: '約書亞記', en: 'Joshua', num: 6 },
  { abbr: '得', name: '路得記', en: 'Ruth', num: 8 },
  { abbr: '撒上', name: '撒母耳記上', en: '1 Samuel', num: 9 },
  { abbr: '王上', name: '列王紀上', en: '1 Kings', num: 11 },
  { abbr: '王下', name: '列王紀下', en: '2 Kings', num: 12 },
  { abbr: '代下', name: '歷代志下', en: '2 Chronicles', num: 14 },
  { abbr: '拉', name: '以斯拉記', en: 'Ezra', num: 15 },
  { abbr: '尼', name: '尼希米記', en: 'Nehemiah', num: 16 },
  { abbr: '斯', name: '以斯帖記', en: 'Esther', num: 17 },
  { abbr: '詩', name: '詩篇', en: 'Psalms', bh: 'Psalm', num: 19 },
  { abbr: '賽', name: '以賽亞書', en: 'Isaiah', num: 23 },
  { abbr: '耶', name: '耶利米書', en: 'Jeremiah', num: 24 },
  { abbr: '結', name: '以西結書', en: 'Ezekiel', num: 26 },
  { abbr: '但', name: '但以理書', en: 'Daniel', num: 27 },
  { abbr: '珥', name: '約珥書', en: 'Joel', num: 29 },
  { abbr: '摩', name: '阿摩司書', en: 'Amos', num: 30 },
  { abbr: '亞', name: '撒迦利亞書', en: 'Zechariah', num: 38 },
  { abbr: '約', name: '約翰福音', en: 'John', num: 43 },
].map((b) => ({ ...b, dir: `${String(b.num).padStart(2, '0')} ${b.name}` }));
export const BOOK_BY_NAME = Object.fromEntries(BOOKS.map((b) => [b.name, b]));
export const BOOK_BY_ABBR = Object.fromEntries(BOOKS.map((b) => [b.abbr, b]));
const ABBR_ALT = BOOKS.map((b) => b.abbr).sort((a, b) => b.length - a.length).join('|');

export const read = (p) => readFileSync(p, 'utf8').replace(/^﻿/, '');

// ---------- 經文參照 ----------

const REF_RE = new RegExp(`^(${ABBR_ALT})(\\d+):(\\d+)(?:-(\\d+))?$`);
const CHAPTER_RE = new RegExp(`^(${ABBR_ALT})(\\d+)$`);

/** 「出12:21-28」→ {abbr, book, chapter, from, to}；格式不對回 null（只收單章，節範圍用半形連字號） */
export function parseRef(text) {
  const m = REF_RE.exec(String(text ?? '').trim());
  if (!m) return null;
  const from = Number(m[3]);
  const to = m[4] ? Number(m[4]) : from;
  if (from < 1 || to < from) return null;
  return { abbr: m[1], book: BOOK_BY_ABBR[m[1]].name, chapter: Number(m[2]), from, to };
}

/** 「出12」→ {abbr, book, chapter}（commentary.yaml 的 chapter 欄） */
export function parseChapterRef(text) {
  const m = CHAPTER_RE.exec(String(text ?? '').trim());
  if (!m) return null;
  return { abbr: m[1], book: BOOK_BY_ABBR[m[1]].name, chapter: Number(m[2]) };
}

const verseCache = new Map();
/** raw_scripture/<書名>/第N章.txt：第 N 行＝第 N 節（空行略過）。經文只取自這裡，不改寫。 */
export function chapterVerses(book, chapter) {
  const key = `${book}/${chapter}`;
  if (!verseCache.has(key)) {
    const p = resolve(ROOT, 'raw_scripture', book, `第${chapter}章.txt`);
    verseCache.set(key, existsSync(p) ? read(p).split(/\r?\n/).filter((l) => l.length > 0) : null);
  }
  return verseCache.get(key);
}

/** 整行只有「併於上節。」的節：和合本把這一節併進上一節，沒有自己的經文（例如代下30:19） */
export const MERGED_VERSE = /^併於上節。?$/;
export const isMergedVerse = (text) => MERGED_VERSE.test(String(text ?? '').trim());

/** 「<NN 書名>/第N章.md」存在才有章頁可連（VerseBlock.kb） */
export function hasKbChapter(book, chapter) {
  const b = BOOK_BY_NAME[book];
  return !!b && existsSync(resolve(ROOT, b.dir, `第${chapter}章.md`));
}

// ---------- 每章來源清單（source_manifest.md） ----------

/** raw_data 檔名前綴 → 來源代號（頁尾「聖經裡還有的節期」的 sources 欄用檔名指定註釋） */
export const SOURCE_BY_RAW_PREFIX = {
  biblehub_study: 'BH',
  ccbiblestudy_CT: 'CT',
  ccbiblestudy_GT: 'GT',
  kingcomments: 'KC',
};

/**
 * 「biblehub_study_daniel_8」→ {id: 'BH', book, chapter}；格式不對或書卷不在書卷表回 null。
 * 書名部分對 BOOKS 的英文名（小寫、空白換底線，例如 1_kings）。
 */
export function parseRawName(name) {
  const m = /^(biblehub_study|ccbiblestudy_CT|ccbiblestudy_GT|kingcomments)_(.+)_(\d+)$/.exec(String(name ?? '').trim());
  if (!m) return null;
  const b = BOOKS.find((x) => x.en.toLowerCase().replace(/\s+/g, '_') === m[2]);
  return b ? { id: SOURCE_BY_RAW_PREFIX[m[1]], book: b.name, chapter: Number(m[3]) } : null;
}

/** manifest「來源」欄 → 來源代號 */
export const SOURCE_BY_MANIFEST = {
  'ccbiblestudy CT': 'CT',
  'ccbiblestudy GT': 'GT',
  KingComments: 'KC',
  'BibleHub Study': 'BH',
  'STEP Bible': 'STEP',
};
/** 授權頁與註釋卡上顯示的原站名稱 */
export const SOURCE_SITE = {
  CT: 'ccbiblestudy 逐節註解',
  GT: 'ccbiblestudy 拾穗',
  KC: 'KingComments 研經註解',
  BH: 'BibleHub 研經註解',
  STEP: 'STEP Bible 原文資料',
};
/** 授權頁排序用 */
export const SOURCE_ORDER = ['CT', 'GT', 'KC', 'BH', 'STEP'];

/**
 * 解析 source_manifest.md 的 markdown 表格，欄位依表頭名稱取（來源、類型、URL、raw_data 檔案、狀態）。
 * 回傳 [{source, type, url, raw, status}]，source 是 manifest 原字串。
 */
export function parseManifest(text) {
  const rows = [];
  let header = null;
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t.startsWith('|')) continue;
    const cells = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // 分隔列
    if (!header) { header = cells; continue; }
    const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
    rows.push({ source: row['來源'], type: row['類型'], url: row['URL'], raw: row['raw_data 檔案'], status: row['狀態'] });
  }
  return rows;
}

/** <NN 書名>/.tmp/第N章/source_manifest.md（創世記早期放在根目錄 .tmp/<NN 書名>/ 底下） */
export function manifestPath(book, chapter) {
  const dir = BOOK_BY_NAME[book].dir;
  const candidates = [
    resolve(ROOT, dir, '.tmp', `第${chapter}章`, 'source_manifest.md'),
    resolve(ROOT, '.tmp', dir, `第${chapter}章`, 'source_manifest.md'),
  ];
  return candidates.find((p) => existsSync(p)) ?? null;
}

const manifestCache = new Map();
/**
 * 一章的來源清單：{CT: {site, url, rawPath, status}, GT: …, KC, BH, STEP}。
 * raw 檔路徑與網址一律從 manifest 取；找不到 manifest 回 null。
 */
export function chapterSources(book, chapter) {
  const key = `${book}/${chapter}`;
  if (manifestCache.has(key)) return manifestCache.get(key);
  const p = manifestPath(book, chapter);
  let out = null;
  if (p) {
    out = {};
    for (const row of parseManifest(read(p))) {
      const id = SOURCE_BY_MANIFEST[row.source];
      if (!id) continue;
      out[id] = { site: SOURCE_SITE[id], url: row.url, rawPath: row.raw ? resolve(ROOT, row.raw) : null, rawRel: row.raw, status: row.status };
    }
  }
  manifestCache.set(key, out);
  return out;
}

const rawCache = new Map();
/** 讀一個 raw_data 檔（快取）；不存在回 null */
export function readRaw(path) {
  if (!path) return null;
  if (!rawCache.has(path)) rawCache.set(path, existsSync(path) ? read(path) : null);
  return rawCache.get(path);
}

// ---------- STEP raw ----------

/**
 * 解析 stepbible_*.txt：每節一個「## Exodus 12:6」標題，接「**Original:** …」與七欄表格。
 * 回傳 Map("12:6" → {en, chapter, verse, original, rows: [{n, hebrewRaw, translitRaw, glossRaw, strong, morphRaw, lexicon}]})。
 */
export function parseStepFile(text) {
  const out = new Map();
  let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    const h = /^##\s+(.+?)\s+(\d+):(\d+)\s*$/.exec(line);
    if (h) {
      cur = { en: h[1], chapter: Number(h[2]), verse: Number(h[3]), original: '', rows: [] };
      out.set(`${cur.chapter}:${cur.verse}`, cur);
      continue;
    }
    if (!cur) continue;
    if (line.startsWith('**Original:**')) { cur.original = line.slice('**Original:**'.length).trim(); continue; }
    if (!/^\|\s*\d+\s*\|/.test(line)) continue;
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((s) => s.trim());
    if (cells.length !== 7) continue; // 欄數不對的列不收，查不到位置時由呼叫端報錯
    const [n, hebrewRaw, translitRaw, glossRaw, strong, morphRaw, lexicon] = cells;
    cur.rows.push({ n: Number(n), hebrewRaw, translitRaw, glossRaw, strong, morphRaw, lexicon });
  }
  return out;
}

const stepCache = new Map();
export function readStepFile(path) {
  if (!stepCache.has(path)) {
    const text = readRaw(path);
    stepCache.set(path, text == null ? null : parseStepFile(text));
  }
  return stepCache.get(path);
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
  const first = firstSentence(para);
  return first.length > GIST_MAX ? `${first.slice(0, GIST_MAX - 1)}…` : first;
}

/** 第一句：句號、驚嘆號、問號在引號或括號裡不算句尾（免得把「…一年之首。」切成沒有收尾的半句） */
export function firstSentence(para) {
  let depth = 0;
  for (let i = 0; i < para.length; i++) {
    const ch = para[i];
    if ('「『（('.includes(ch)) depth++;
    else if ('」』）)'.includes(ch)) depth = Math.max(0, depth - 1);
    else if (depth === 0 && '。！？'.includes(ch)) return para.slice(0, i + 1);
  }
  return para;
}

// ---------- public/audio ----------

/** public/audio/ 底下所有檔案（相對路徑，正斜線）；資料夾不存在回 []。略過 . 開頭的檔案。 */
export function listAudioFiles(dir = resolve(SITE_DIR, 'public/audio')) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.'))
    .map((d) => resolve(d.parentPath ?? d.path, d.name).slice(dir.length + 1).replace(/\\/g, '/'))
    .sort();
}

// ---------- 律法地圖（唯讀） ----------

/**
 * 讀律法地圖 data/laws/*.yaml（結構 book → chapters[] → sections[] → laws[]），回傳 Map(條文 id → title)。
 * 資料夾不存在回 null。
 */
export function readLawTitles(dir = resolve(LAWMAP_DIR, 'data/laws')) {
  if (!existsSync(dir)) return null;
  const out = new Map();
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.yaml')).sort()) {
    const doc = YAML.parse(read(resolve(dir, f)));
    for (const ch of doc?.chapters ?? []) for (const sec of ch.sections ?? []) for (const law of sec.laws ?? []) if (law?.id) out.set(law.id, String(law.title ?? ''));
  }
  return out;
}
