// 把手寫資料（data/*.yaml）和 vault 裡的來源接起來，產生網站要用的 src/data/site.json。
//
//   node scripts/build-data.mjs           產生（寫檔）
//   node scripts/build-data.mjs --check   只檢查：有錯誤或輸出過期就失敗（npm run build 會先跑這個）
//
// 手寫的只有結構與網站自己的話（story.yaml 的敘述、commentary.yaml 的挑句與轉述、step.yaml 的說明）。
// 經文、註釋原站網址、STEP 原文欄位、條目類型與簡介都從 vault 讀；工程端不寫任何研經文字。
// 輸出是決定性的：物件 key 一律排序，不放時間戳。
//
// 建置檢查（任何一項失敗都列出是哪一筆、哪個欄位，然後 exit 1）：
//   a. 經文參照都能解析，raw_scripture 有那幾節
//   b. 註釋 quote 在該章 raw 逐字找得到；GT 還檢查「──《子來源》」歸屬；欄位齊全
//   c. 條目（entries、nt）都在 link_folder 找得到（標題或別名）
//   d. step.yaml：位置找得到、Strong 與 expect_strong 一致、希伯來字是該節 Original 行的子字串
//   e. story.yaml 的 notes／words 引用都存在；每段 ==…== 最多一處；沒被用到的註釋與原文字只警告
//   f. audio-sources.yaml：檔案存在、license 是 CC0、page 與 pages 是網址、downloaded 是日期，
//      public/audio/ 底下每個檔案都有一筆
//   g. offerings：每個出處都從 raw_scripture 解析出祭牲（動物、數目、獻祭種類），寫進 SITE.offerings；
//      經文裡每一個「隻」都要被吃掉，吃不掉就列出是哪一句。數字不手抄。
//   h. 第二階段第二批：echoes 指到存在的拍（不能指自己）；bars 的每條 ref 都有祭牲、至少一筆「公牛」；
//      passage 章的 month／monthTo、無字的拍；ot 的 kind／ref／note；later_palette。
//   i. 經文裡整行「併於上節。」的節不收進 VerseBlock.lines（節號不變，例如代下30:19）。
//   j. 第三批：recall 指到存在的拍（不能指自己）；law_links 的條文 id 都在律法地圖 data/laws/*.yaml 找得到（標題一併寫進 StoryChapter.laws）；
//      七的倍數（#6）：利23:15-16 七個安息日、五十天，利25:8 七七＝四十九年，利25:10 第五十年，解析值寫進 SiteData.sevens。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  BOOK_BY_NAME, IN_VAULT, LAWMAP_DIR, RAW_DATA_DIR, SITE_DIR, SOURCE_ORDER, SOURCE_SITE,
  chapterSources, chapterVerses, entries, entryGist, hasKbChapter, isMergedVerse, listAudioFiles, parseChapterRef, parseRef, readLawTitles,
  parseRawName, read, readRaw, readStepFile, resolveEntry,
} from './lib.mjs';
import { checkAudioEntry, checkHighlights, checkNoteQuotes, checkQuote, extractStepWord, parseOfferings, parseSevens, unknownKeys } from './checks.mjs';

export const OUT = resolve(SITE_DIR, 'src/data/site.json');
const SOURCE_IDS = ['CT', 'GT', 'KC', 'BH'];
const INTERACTIONS = ['hyssop', 'bake', 'wave', 'count', 'blow'];
const HEX = /^#[0-9a-fA-F]{6}$/;

const isStr = (x) => typeof x === 'string' && x.trim().length > 0;
const isStrArray = (x) => Array.isArray(x) && x.every((s) => typeof s === 'string' && s.trim());

/** key 排序後的 JSON：同樣的資料永遠產生同樣的檔案 */
export function stableStringify(value) {
  const sort = (v) => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') return Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]));
    return v;
  };
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/** dataDir、audioDir 可以換掉，測試用來餵故意弄壞的資料 */
export function buildAll({ dataDir = resolve(SITE_DIR, 'data'), audioDir = resolve(SITE_DIR, 'public/audio'), lawsDir = resolve(LAWMAP_DIR, 'data/laws') } = {}) {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const warn = (where, msg) => warnings.push(`${where}: ${msg}`);
  const loadYaml = (name) => {
    const p = resolve(dataDir, name);
    if (!existsSync(p)) { err(name, '找不到這個檔案'); return null; }
    return YAML.parse(read(p));
  };
  /** 回報未知欄位（多半是打錯字） */
  const checkKeys = (where, obj, allowed) => {
    for (const k of unknownKeys(obj, allowed)) err(where, `不認得的欄位「${k}」（允許：${allowed.join('、')}）`);
  };

  // ---------- a. 經文 ----------
  const verses = {};
  /** 解析參照、確認 raw_scripture 有那幾節；collect 為真時收進 site.json 的 verses */
  const resolveVerse = (where, ref, collect) => {
    const r = parseRef(ref);
    if (!r) { err(where, `經文參照格式不對：${JSON.stringify(ref)}（要寫成「出12:21-28」）`); return null; }
    const text = chapterVerses(r.book, r.chapter);
    if (!text) { err(where, `raw_scripture 找不到 ${r.book}第${r.chapter}章（參照 ${ref}）`); return null; }
    if (r.to > text.length) { err(where, `${ref} 超出本章節數（${r.book}${r.chapter} 章只有 ${text.length} 節）`); return null; }
    // 和合本把這一節併進上一節，整行只有「併於上節。」：不收進 lines，其他節的節號不變
    const lines = Array.from({ length: r.to - r.from + 1 }, (_, i) => ({ v: r.from + i, text: text[r.from + i - 1] }))
      .filter((l) => !isMergedVerse(l.text));
    if (!lines.length) { err(where, `${ref} 整段都是「併於上節。」，沒有自己的經文`); return null; }
    const block = {
      ref,
      book: r.book,
      bookNum: BOOK_BY_NAME[r.book].num,
      chapter: r.chapter,
      from: r.from,
      to: r.to,
      lines,
      kb: hasKbChapter(r.book, r.chapter),
    };
    if (collect) verses[ref] = block;
    return block;
  };

  // ---------- 條目（c） ----------
  const entryMap = {};
  /** feasts.yaml 的 entry_gists：主筆依條目定義手寫的一句簡介（載入 feasts.yaml 後填入） */
  let gistOverrides = {};
  const needEntry = (where, name) => {
    if (!isStr(name)) { err(where, `條目名稱要是非空字串（目前是 ${JSON.stringify(name)}）`); return null; }
    const title = resolveEntry(name);
    if (!title) { err(where, `知識庫找不到條目「${name}」（標題與別名都查過）`); return null; }
    if (title !== name) warn(where, `「${name}」是別名，正式標題是「${title}」`);
    if (!entryMap[title]) {
      const gist = isStr(gistOverrides[title]) ? gistOverrides[title] : entryGist(title);
      if (!gist) warn(where, `條目「${title}」讀不到「## 定義」的第一句`);
      entryMap[title] = { title, type: entries().byTitle.get(title).type, gist };
    }
    return title;
  };

  // ---------- 授權頁要用的來源 ----------
  const usedSources = new Map(); // key → {book, chapter, source}
  const useSource = (book, chapter, source) => usedSources.set(`${book}|${chapter}|${source}`, { book, chapter, source });

  // ---------- feasts.yaml ----------
  const feasts = loadYaml('feasts.yaml') ?? {};
  checkKeys('feasts.yaml', feasts, ['title', 'motto', 'later_palette', 'entry_gists', 'law_links', 'chapters', 'others']);
  if (!isStr(feasts.title)) err('feasts.yaml', 'title 要是非空字串');
  gistOverrides = feasts.entry_gists ?? {};
  if (typeof gistOverrides !== 'object' || Array.isArray(gistOverrides)) { err('feasts.yaml', 'entry_gists 要是「條目標題: 一句簡介」的對照表'); gistOverrides = {}; }
  for (const [t, g] of Object.entries(gistOverrides)) {
    if (!isStr(g)) err(`feasts.yaml entry_gists [${t}]`, '簡介要是非空字串');
    else if ([...g].length > 40) err(`feasts.yaml entry_gists [${t}]`, `簡介超過 40 字（${[...g].length} 字）`);
    if (!resolveEntry(t)) err(`feasts.yaml entry_gists [${t}]`, '知識庫找不到這個條目');
    else if (resolveEntry(t) !== t) err(`feasts.yaml entry_gists [${t}]`, `要用正式標題「${resolveEntry(t)}」`);
  }
  const motto = resolveVerse('feasts.yaml motto', feasts.motto, true);
  const laterPal = feasts.later_palette ?? {};
  checkKeys('feasts.yaml later_palette', laterPal, ['paper', 'ink', 'accent', 'glow']);
  for (const k of ['paper', 'ink', 'accent', 'glow']) if (!HEX.test(laterPal[k] ?? '')) err(`feasts.yaml later_palette.${k}`, `要是 #rrggbb 色碼（目前是 ${JSON.stringify(laterPal[k])}）`);
  const chapterSrc = Array.isArray(feasts.chapters) ? feasts.chapters : [];
  if (!chapterSrc.length) err('feasts.yaml', 'chapters 要是非空陣列');
  const chapterIds = new Set(chapterSrc.map((c) => c?.id));

  // ---------- law_links（j）：章 id → 律法地圖條文，標題取自律法地圖 data/laws/*.yaml ----------
  /** 章 id → [{id, title}] */
  const lawLinks = {};
  if (feasts.law_links !== undefined) {
    const src = feasts.law_links;
    if (!src || typeof src !== 'object' || Array.isArray(src)) err('feasts.yaml law_links', '要是「章 id: [條文 id, …]」的對照表');
    else {
      const titles = readLawTitles(lawsDir);
      if (!titles) err('feasts.yaml law_links', `找不到律法地圖的條文資料夾：${lawsDir}`);
      for (const [ch, ids] of Object.entries(src)) {
        const w = `feasts.yaml law_links [${ch}]`;
        if (!chapterIds.has(ch)) err(w, '不是 feasts.yaml 的章 id');
        if (!isStrArray(ids) || !ids.length) { err(w, '要是條文 id 的字串陣列'); continue; }
        const seen = new Set();
        lawLinks[ch] = [];
        for (const id of ids) {
          if (seen.has(id)) { err(w, `條文 id「${id}」重複`); continue; }
          seen.add(id);
          const title = titles?.get(id);
          if (titles && !title) err(w, `律法地圖沒有條文 id「${id}」`);
          else if (title) lawLinks[ch].push({ id, title });
        }
      }
    }
  }

  // ---------- commentary.yaml（b） ----------
  const commentarySrc = loadYaml('commentary.yaml') ?? {};
  const commentary = {};
  const declaredNotes = new Set();
  const NOTE_KEYS = ['id', 'source', 'work', 'chapter', 'verse', 'quote', 'quoteZh', 'paraphrase'];
  for (const [group, notes] of Object.entries(commentarySrc)) {
    if (!chapterIds.has(group)) err(`commentary.yaml ${group}`, `群組名稱不是 feasts.yaml 的章 id（${[...chapterIds].join('、')}）`);
    if (!Array.isArray(notes)) { err(`commentary.yaml ${group}`, '要是註釋陣列'); continue; }
    notes.forEach((n, i) => {
      const where = `commentary.yaml ${group}[${n?.id ?? i}]`;
      if (!n || typeof n !== 'object') { err(where, '要是物件'); return; }
      checkKeys(where, n, NOTE_KEYS);
      if (!isStr(n.id)) { err(where, 'id 要是非空字串'); return; }
      if (declaredNotes.has(n.id)) { err(where, 'id 重複'); return; }
      declaredNotes.add(n.id);
      if (!SOURCE_IDS.includes(n.source)) { err(`${where}.source`, `只能是 ${SOURCE_IDS.join('/')}（目前是 ${JSON.stringify(n.source)}）`); return; }
      if (!isStr(n.work)) err(`${where}.work`, '要是非空字串（讀者看到的出處，GT 要寫到子來源）');
      const ch = parseChapterRef(n.chapter);
      if (!ch) { err(`${where}.chapter`, `格式不對：${JSON.stringify(n.chapter)}（要寫成「出12」）`); return; }
      const vr = parseRef(n.verse);
      resolveVerse(`${where}.verse`, n.verse, false);
      if (vr && (vr.book !== ch.book || vr.chapter !== ch.chapter)) err(`${where}.verse`, `${n.verse} 不在 chapter 欄指定的 ${n.chapter}`);
      for (const k of ['quote', 'quoteZh', 'paraphrase']) if (n[k] !== undefined && !isStr(n[k])) err(`${where}.${k}`, '要是非空字串');
      if (!n.quote && !n.paraphrase) err(where, '至少要有 quote 或 paraphrase');
      if (n.quote && (n.source === 'KC' || n.source === 'BH') && !n.quoteZh) err(`${where}.quoteZh`, `${n.source} 的英文引文必須附 quoteZh 中譯`);
      if (n.quoteZh && !n.quote) err(`${where}.quoteZh`, '沒有 quote 就不該有 quoteZh');
      if (n.quoteZh && (n.source === 'CT' || n.source === 'GT')) err(`${where}.quoteZh`, `${n.source} 是中文來源，不填 quoteZh`);
      if (n.paraphrase) for (const e of checkHighlights(n.paraphrase)) err(`${where}.paraphrase`, e);

      // 原站網址與 raw 檔一律從該章 source_manifest.md 取
      const src = chapterSources(ch.book, ch.chapter);
      let url = '';
      if (!src) err(where, `找不到 ${ch.book}第${ch.chapter}章的 source_manifest.md`);
      else if (!src[n.source]) err(where, `manifest 沒有 ${n.source} 這個來源`);
      else {
        const s = src[n.source];
        url = s.url;
        if (!url) err(where, `manifest 的 ${n.source} 沒有 URL`);
        if (s.status !== 'OK') err(where, `manifest 的 ${n.source} 狀態是「${s.status}」，不是 OK`);
        const raw = readRaw(s.rawPath);
        if (raw == null) err(where, `raw 檔不存在：${s.rawRel}`);
        else for (const e of checkQuote(n, raw, s.rawRel)) err(`${where}.quote`, e);
        useSource(ch.book, ch.chapter, n.source);
      }
      commentary[n.id] = {
        id: n.id,
        source: n.source,
        work: n.work,
        site: SOURCE_SITE[n.source],
        url,
        book: ch.book,
        chapter: ch.chapter,
        verse: n.verse,
        ...(n.quote ? { quote: n.quote } : {}),
        ...(n.quoteZh ? { quoteZh: n.quoteZh } : {}),
        ...(n.paraphrase ? { paraphrase: n.paraphrase } : {}),
      };
    });
  }

  // ---------- step.yaml（d） ----------
  const stepSrc = loadYaml('step.yaml') ?? [];
  const step = {};
  const declaredWords = new Set();
  const STEP_KEYS = ['id', 'label', 'ref', 'position', 'expect_strong', 'note'];
  if (!Array.isArray(stepSrc)) err('step.yaml', '要是陣列');
  (Array.isArray(stepSrc) ? stepSrc : []).forEach((s, i) => {
    const where = `step.yaml [${s?.id ?? i}]`;
    if (!s || typeof s !== 'object') { err(where, '要是物件'); return; }
    checkKeys(where, s, STEP_KEYS);
    if (!isStr(s.id)) { err(where, 'id 要是非空字串'); return; }
    if (declaredWords.has(s.id)) { err(where, 'id 重複'); return; }
    declaredWords.add(s.id);
    if (!isStr(s.label)) err(`${where}.label`, '要是非空字串');
    if (!isStr(s.note)) err(`${where}.note`, '要是非空字串');
    else for (const e of checkHighlights(s.note)) err(`${where}.note`, e);
    if (!isStr(s.expect_strong)) err(`${where}.expect_strong`, '要是非空字串（防呆用，例如 H24）');
    if (!Number.isInteger(s.position) || s.position < 1) { err(`${where}.position`, `要是 ≥1 的整數（目前是 ${JSON.stringify(s.position)}）`); return; }
    const r = parseRef(s.ref);
    if (!r || r.from !== r.to) { err(`${where}.ref`, `要是單節參照，例如「出13:4」（目前是 ${JSON.stringify(s.ref)}）`); return; }
    const verseText = chapterVerses(r.book, r.chapter)?.[r.from - 1];
    if (verseText === undefined) { err(`${where}.ref`, `raw_scripture 沒有 ${s.ref}`); return; }
    if (isStr(s.label) && !verseText.includes(s.label)) warn(`${where}.label`, `「${s.label}」沒有出現在 ${s.ref} 的和合本經文裡`);
    const src = chapterSources(r.book, r.chapter);
    const stepSrcInfo = src?.STEP;
    if (!src) { err(where, `找不到 ${r.book}第${r.chapter}章的 source_manifest.md`); return; }
    if (!stepSrcInfo) { err(where, 'manifest 沒有 STEP Bible 這個來源'); return; }
    if (stepSrcInfo.status !== 'OK') err(where, `manifest 的 STEP 狀態是「${stepSrcInfo.status}」，不是 OK`);
    const map = readStepFile(stepSrcInfo.rawPath);
    if (!map) { err(where, `STEP raw 檔不存在：${stepSrcInfo.rawRel}`); return; }
    const { word, errors: stepErrors } = extractStepWord(s, map, { chapter: r.chapter, verse: r.from, en: BOOK_BY_NAME[r.book].en });
    for (const e of stepErrors) err(`${where}`, e);
    useSource(r.book, r.chapter, 'STEP');
    if (!word) return;
    step[s.id] = {
      id: s.id,
      label: s.label,
      ref: s.ref,
      position: s.position,
      ...word,
      note: s.note,
    };
  });

  // ---------- story.yaml（e）＋ 章 ----------
  const storySrc = loadYaml('story.yaml') ?? {};
  const offerings = {};
  /** 獻祭出處：解析經文裡的祭牲；同一出處只算一次 */
  const needOffering = (where, ref) => {
    if (!isStr(ref)) { err(where, `獻祭出處要是非空字串（目前是 ${JSON.stringify(ref)}）`); return; }
    if (offerings[ref]) return;
    const block = resolveVerse(where, ref, false);
    if (!block) return;
    const { items, errors: offErrors } = parseOfferings(block.lines.map((l) => l.text));
    for (const e of offErrors) err(`${where} ${ref}`, e);
    if (!offErrors.length) offerings[ref] = { ref, items };
  };
  const usedNotes = new Set();
  const usedWords = new Set();
  const BEAT_KEYS = ['id', 'cue', 'day', 'dayTo', 'badge', 'offerings', 'offeringsLabel', 'bars', 'echoes', 'recall', 'verse', 'moreVerses', 'text', 'prompt', 'interaction', 'notes', 'words', 'reason'];
  const BAR_KEYS = ['label', 'ref'];
  const OT_KEYS = ['kind', 'ref', 'note'];
  const OT_KINDS = ['kept', 'word'];
  // 章末每一條要交代「讀者看什麼」（跟本章律法的對照），不只是重述經文，所以放寬到 120 字
  const OT_NOTE_MAX = 120;
  const KINDS = ['opening', 'feast', 'passage'];
  /** 回聲拍的 echoes 要等所有拍都收齊才能查：[{where, id, self}] */
  const echoRefs = [];
  /** recall 同樣等所有拍收齊才查 */
  const recallRefs = [];
  /** 拍 id → 出現在哪幾章（回聲只能指到唯一的拍） */
  const beatHome = new Map();
  for (const k of Object.keys(storySrc)) if (!chapterIds.has(k)) err(`story.yaml ${k}`, '這個 key 不是 feasts.yaml 的章 id');

  const chapters = [];
  const CHAPTER_KEYS = ['id', 'kind', 'title', 'date', 'month', 'monthTo', 'day', 'scene', 'palette', 'passages', 'entries', 'nt', 'next', 'ot'];
  const seenChapters = new Set();
  chapterSrc.forEach((c, i) => {
    const where = `feasts.yaml chapters[${c?.id ?? i}]`;
    if (!c || typeof c !== 'object') { err(where, '要是物件'); return; }
    checkKeys(where, c, CHAPTER_KEYS);
    if (!isStr(c.id)) { err(where, 'id 要是非空字串'); return; }
    if (seenChapters.has(c.id)) { err(where, '章 id 重複'); return; }
    seenChapters.add(c.id);
    if (!KINDS.includes(c.kind)) err(`${where}.kind`, `只能是 ${KINDS.join('、')}（目前是 ${JSON.stringify(c.kind)}）`);
    if (!isStr(c.title)) err(`${where}.title`, '要是非空字串');
    if (!isStr(c.scene)) err(`${where}.scene`, '要是非空字串');
    if (c.date !== undefined && !isStr(c.date)) err(`${where}.date`, '要是非空字串');
    if (c.month !== undefined && !(Number.isInteger(c.month) && c.month >= 1 && c.month <= 12)) err(`${where}.month`, '要是 1–12 的整數');
    // passage 可以完全沒有月份（coda：月份導覽維持「不定日期」）；有 month 就一定要有 monthTo
    if (c.kind === 'passage') {
      if (c.month !== undefined && c.monthTo === undefined) err(`${where}.monthTo`, 'passage 章有 month 就一定要有 monthTo');
      if (c.month === undefined && c.monthTo !== undefined) err(`${where}.month`, '有 monthTo 就一定要有 month');
      if (c.monthTo !== undefined) {
        if (!(Number.isInteger(c.monthTo) && c.monthTo >= 1 && c.monthTo <= 12)) err(`${where}.monthTo`, '要是 1–12 的整數');
        else if (Number.isInteger(c.month) && !(c.month < c.monthTo)) err(`${where}.monthTo`, `要大於 month（month ${c.month}、monthTo ${c.monthTo}）`);
      }
    } else if (c.monthTo !== undefined) err(`${where}.monthTo`, '只有 passage 章可以有 monthTo');
    if (c.day !== undefined && !(Number.isInteger(c.day) && c.day >= 1 && c.day <= 30)) err(`${where}.day`, '要是 1–30 的整數');
    const pal = c.palette ?? {};
    checkKeys(`${where}.palette`, pal, ['paper', 'ink', 'accent', 'glow']);
    for (const k of ['paper', 'ink', 'accent', 'glow']) if (!HEX.test(pal[k] ?? '')) err(`${where}.palette.${k}`, `要是 #rrggbb 色碼（目前是 ${JSON.stringify(pal[k])}）`);
    if (c.next !== undefined) {
      checkKeys(`${where}.next`, c.next, ['title', 'date']);
      if (!isStr(c.next?.title) || !isStr(c.next?.date)) err(`${where}.next`, 'title 與 date 都要是非空字串');
    }
    for (const k of ['passages', 'entries', 'nt']) if (!isStrArray(c[k])) err(`${where}.${k}`, '要是字串陣列（可以是空的）');
    const passages = isStrArray(c.passages) ? c.passages : [];
    passages.forEach((p, j) => resolveVerse(`${where}.passages[${j}]`, p, true));
    const listed = new Set();
    const canon = (key) =>
      (isStrArray(c[key]) ? c[key] : []).map((name, j) => {
        const t = needEntry(`${where}.${key}[${j}]`, name);
        if (t && listed.has(t)) warn(`${where}.${key}[${j}]`, `條目「${t}」在這一章重複列出`);
        if (t) listed.add(t);
        return t;
      }).filter(Boolean);
    const chEntries = canon('entries');
    const chNt = canon('nt');

    // 這一章的拍
    const beatSrc = storySrc[c.id];
    if (!Array.isArray(beatSrc) || !beatSrc.length) err(`story.yaml ${c.id}`, '這一章沒有任何一拍（要是非空陣列）');
    const beatIds = new Set();
    const beats = (Array.isArray(beatSrc) ? beatSrc : []).map((b, j) => {
      const bw = `story.yaml ${c.id}[${b?.id ?? j}]`;
      if (!b || typeof b !== 'object') { err(bw, '要是物件'); return null; }
      checkKeys(bw, b, BEAT_KEYS);
      if (!isStr(b.id)) err(bw, 'id 要是非空字串');
      else if (beatIds.has(b.id)) err(bw, '拍 id 在這一章重複');
      else {
        beatIds.add(b.id);
        beatHome.set(b.id, [...(beatHome.get(b.id) ?? []), c.id]);
      }
      if (!isStr(b.cue)) err(`${bw}.cue`, '要是非空字串');
      const isPassage = c.kind === 'passage';
      // passage（無字的時光過場）的拍：text 可以是空字串，而且不可有任何文字內容
      if (isPassage && b.text === '') {
        /* 無字 */
      } else if (!isStr(b.text)) err(`${bw}.text`, isPassage ? '要是字串（passage 的拍可以是空字串）' : '要是非空字串（只有 passage 的拍可以是空字串）');
      else {
        if (isPassage) err(`${bw}.text`, 'passage 的拍不寫文字（要是空字串）');
        for (const e of checkHighlights(b.text)) err(`${bw}.text`, e);
      }
      if (isPassage) {
        for (const k of ['notes', 'words', 'offerings', 'verse', 'moreVerses', 'bars', 'echoes', 'recall']) {
          if (b[k] !== undefined) err(`${bw}.${k}`, 'passage 的拍不可有這個欄位');
        }
      }
      if (b.verse !== undefined) resolveVerse(`${bw}.verse`, b.verse, true);
      if (b.moreVerses !== undefined) {
        if (!isStrArray(b.moreVerses) || !b.moreVerses.length) err(`${bw}.moreVerses`, '要是經文出處的字串陣列（例如 [得2:23]）');
        else {
          b.moreVerses.forEach((ref, k) => {
            if (ref === b.verse) err(`${bw}.moreVerses[${k}]`, `和 verse（${b.verse}）重複`);
            else if (b.moreVerses.indexOf(ref) !== k) err(`${bw}.moreVerses[${k}]`, `「${ref}」在 moreVerses 裡重複`);
            resolveVerse(`${bw}.moreVerses[${k}]`, ref, true);
          });
        }
      }
      if (b.echoes !== undefined) {
        if (!isStrArray(b.echoes) || !b.echoes.length) err(`${bw}.echoes`, '要是拍 id 的字串陣列（例如 [not-yet]）');
        else b.echoes.forEach((id, k) => echoRefs.push({ where: `${bw}.echoes[${k}]`, id, self: b.id, chapter: c.id }));
      }
      if (b.recall !== undefined) {
        if (!isStrArray(b.recall) || !b.recall.length) err(`${bw}.recall`, '要是拍 id 的字串陣列（例如 [count]）');
        else b.recall.forEach((id, k) => {
          if (b.recall.indexOf(id) !== k) err(`${bw}.recall[${k}]`, `「${id}」在 recall 裡重複`);
          recallRefs.push({ where: `${bw}.recall[${k}]`, id, self: b.id, chapter: c.id });
        });
      }
      if (b.bars !== undefined) {
        if (!Array.isArray(b.bars) || !b.bars.length) err(`${bw}.bars`, '要是 [{label, ref}] 陣列');
        else {
          b.bars.forEach((bar, k) => {
            const bwk = `${bw}.bars[${k}]`;
            if (!bar || typeof bar !== 'object' || Array.isArray(bar)) { err(bwk, '要是 {label, ref} 物件'); return; }
            checkKeys(bwk, bar, BAR_KEYS);
            if (!isStr(bar.label)) err(`${bwk}.label`, '要是非空字串');
            needOffering(`${bwk}.ref`, bar.ref);
            const group = isStr(bar.ref) ? offerings[bar.ref] : null;
            if (group && !group.items.some((it) => it.animal.startsWith('公牛'))) err(`${bwk}.ref`, `${bar.ref} 裡沒有名稱以「公牛」開頭的祭牲，畫不出長條`);
          });
        }
      }
      if (b.interaction !== undefined && !INTERACTIONS.includes(b.interaction)) err(`${bw}.interaction`, `只能是 ${INTERACTIONS.join('/')}（目前是 ${JSON.stringify(b.interaction)}）`);
      if (b.interaction && !isStr(b.prompt)) warn(bw, '有 interaction 的拍應該有 prompt');
      if (b.prompt && !b.interaction) warn(bw, '有 prompt 但沒有 interaction');
      const okDay = (x) => typeof x === 'number' && x >= 1 && x <= 30;
      if (b.day !== undefined && !okDay(b.day)) err(`${bw}.day`, '要是 1–30 的數字');
      if (b.dayTo !== undefined) {
        if (!okDay(b.dayTo)) err(`${bw}.dayTo`, '要是 1–30 的數字');
        else if (b.day === undefined) err(`${bw}.dayTo`, '有 dayTo 就一定要有 day');
        else if (okDay(b.day) && !(b.dayTo > b.day)) err(`${bw}.dayTo`, `要大於 day（day ${b.day}、dayTo ${b.dayTo}）`);
      }
      if (b.badge !== undefined && !isStr(b.badge)) err(`${bw}.badge`, '要是非空字串');
      if (b.offeringsLabel !== undefined) {
        if (!isStr(b.offeringsLabel)) err(`${bw}.offeringsLabel`, '要是非空字串');
        else if ([...b.offeringsLabel].length > 12) err(`${bw}.offeringsLabel`, `超過 12 字（${[...b.offeringsLabel].length} 字）`);
        if (b.offerings === undefined) err(`${bw}.offeringsLabel`, '有 offeringsLabel 就一定要有 offerings');
      }
      if (b.offerings !== undefined) {
        if (!isStrArray(b.offerings) || !b.offerings.length) err(`${bw}.offerings`, '要是經文出處的字串陣列（例如 [民28:19-22]）');
        else b.offerings.forEach((ref, k) => needOffering(`${bw}.offerings[${k}]`, ref));
      }
      if (b.reason !== undefined && typeof b.reason !== 'boolean') err(`${bw}.reason`, '要是 true/false');
      for (const [key, declared, used] of [['notes', declaredNotes, usedNotes], ['words', declaredWords, usedWords]]) {
        if (b[key] === undefined) continue;
        if (!isStrArray(b[key])) { err(`${bw}.${key}`, '要是 id 字串陣列'); continue; }
        b[key].forEach((id) => {
          if (!declared.has(id)) err(`${bw}.${key}`, `${key === 'notes' ? 'commentary.yaml' : 'step.yaml'} 沒有 id「${id}」`);
          else used.add(id);
        });
      }
      return {
        id: b.id,
        cue: b.cue,
        ...(b.verse !== undefined ? { verse: b.verse } : {}),
        ...(b.moreVerses !== undefined && Array.isArray(b.moreVerses) ? { moreVerses: b.moreVerses } : {}),
        text: b.text,
        ...(b.prompt !== undefined ? { prompt: b.prompt } : {}),
        ...(b.interaction !== undefined ? { interaction: b.interaction } : {}),
        ...(b.notes !== undefined ? { notes: b.notes } : {}),
        ...(b.words !== undefined ? { words: b.words } : {}),
        ...(b.reason !== undefined ? { reason: b.reason } : {}),
        ...(b.day !== undefined ? { day: b.day } : {}),
        ...(b.dayTo !== undefined ? { dayTo: b.dayTo } : {}),
        ...(b.badge !== undefined ? { badge: b.badge } : {}),
        ...(b.offerings !== undefined ? { offerings: b.offerings } : {}),
        ...(b.offeringsLabel !== undefined ? { offeringsLabel: b.offeringsLabel } : {}),
        ...(b.bars !== undefined && Array.isArray(b.bars) ? { bars: b.bars.map((x) => ({ label: x?.label, ref: x?.ref })) } : {}),
        ...(b.echoes !== undefined && Array.isArray(b.echoes) ? { echoes: b.echoes } : {}),
        ...(b.recall !== undefined && Array.isArray(b.recall) ? { recall: b.recall } : {}),
      };
    }).filter(Boolean);

    // 章末「舊約其他書卷」
    let ot;
    if (c.ot !== undefined) {
      if (!Array.isArray(c.ot) || !c.ot.length) err(`${where}.ot`, '要是 [{kind, ref, note}] 陣列（沒有就不要寫這個欄位）');
      else {
        ot = [];
        c.ot.forEach((o, k) => {
          const ow = `${where}.ot[${k}]`;
          if (!o || typeof o !== 'object' || Array.isArray(o)) { err(ow, '要是 {kind, ref, note} 物件'); return; }
          checkKeys(ow, o, OT_KEYS);
          if (!OT_KINDS.includes(o.kind)) err(`${ow}.kind`, `只能是 ${OT_KINDS.join('／')}（目前是 ${JSON.stringify(o.kind)}）`);
          if (!isStr(o.note)) err(`${ow}.note`, '要是非空字串');
          else if ([...o.note].length > OT_NOTE_MAX) err(`${ow}.note`, `超過 ${OT_NOTE_MAX} 字（${[...o.note].length} 字）`);
          const block = resolveVerse(`${ow}.ref`, o.ref, true);
          if (block && isStr(o.note) && OT_KINDS.includes(o.kind)) ot.push({ kind: o.kind, ref: o.ref, note: o.note });
        });
      }
    }

    chapters.push({
      id: c.id,
      kind: c.kind,
      title: c.title,
      ...(c.date !== undefined ? { date: c.date } : {}),
      ...(c.month !== undefined ? { month: c.month } : {}),
      ...(c.monthTo !== undefined ? { monthTo: c.monthTo } : {}),
      ...(c.day !== undefined ? { day: c.day } : {}),
      scene: c.scene,
      palette: { paper: pal.paper, ink: pal.ink, accent: pal.accent, glow: pal.glow },
      beats,
      passages,
      entries: chEntries,
      nt: chNt,
      ...(c.next ? { next: { title: c.next.title, date: c.next.date } } : {}),
      ...(ot ? { ot } : {}),
      ...(lawLinks[c.id]?.length ? { laws: lawLinks[c.id] } : {}),
    });
  });

  // 回聲：每個 id 都要是存在的拍（全書唯一）、不能指自己
  for (const { where, id, self } of echoRefs) {
    const homes = beatHome.get(id);
    if (!homes) err(where, `沒有 id 是「${id}」的拍`);
    else if (id === self) err(where, '回聲拍不能指向自己');
    else if (homes.length > 1) err(where, `拍 id「${id}」在多章都有（${homes.join('、')}），指不到唯一的拍`);
  }

  // 回看：同樣的規則（存在、唯一、不能指自己）
  for (const { where, id, self } of recallRefs) {
    const homes = beatHome.get(id);
    if (!homes) err(where, `沒有 id 是「${id}」的拍`);
    else if (id === self) err(where, '回看不能指向自己');
    else if (homes.length > 1) err(where, `拍 id「${id}」在多章都有（${homes.join('、')}），指不到唯一的拍`);
  }

  for (const id of Object.keys(commentary)) if (!usedNotes.has(id)) warn(`commentary.yaml [${id}]`, '有定義但沒有被任何一拍用到');
  for (const id of Object.keys(step)) if (!usedWords.has(id)) warn(`step.yaml [${id}]`, '有定義但沒有被任何一拍用到');

  // ---------- others（k）：頁尾「聖經裡還有的節期」 ----------
  // 每個 ref 的經文從 raw_scripture 取；note 裡每個「…」引文要逐字出現在該項 refs 的經文裡
  const others = { title: '', intro: '', items: [] };
  const OTHERS_KEYS = ['title', 'intro', 'items'];
  const OTHERS_ITEM_KEYS = ['name', 'refs', 'note', 'sources'];
  if (feasts.others === undefined) err('feasts.yaml others', '缺少這個欄位（頁尾「聖經裡還有的節期」）');
  else if (!feasts.others || typeof feasts.others !== 'object' || Array.isArray(feasts.others)) err('feasts.yaml others', '要是 {title, intro, items} 物件');
  else {
    const o = feasts.others;
    checkKeys('feasts.yaml others', o, OTHERS_KEYS);
    if (!isStr(o.title)) err('feasts.yaml others.title', '要是非空字串');
    if (!isStr(o.intro)) err('feasts.yaml others.intro', '要是非空字串');
    if (!Array.isArray(o.items) || !o.items.length) err('feasts.yaml others.items', '要是非空陣列');
    others.title = isStr(o.title) ? o.title : '';
    others.intro = isStr(o.intro) ? o.intro : '';
    (Array.isArray(o.items) ? o.items : []).forEach((it, i) => {
      const w = `feasts.yaml others.items[${it?.name ?? i}]`;
      if (!it || typeof it !== 'object' || Array.isArray(it)) { err(w, '要是 {name, refs, note} 物件'); return; }
      checkKeys(w, it, OTHERS_ITEM_KEYS);
      if (!isStr(it.name)) err(`${w}.name`, '要是非空字串');
      if (!isStr(it.note)) err(`${w}.note`, '要是非空字串');
      if (!isStrArray(it.refs) || !it.refs.length) { err(`${w}.refs`, '要是經文出處的字串陣列（例如 [斯9:20-22]）'); return; }
      // sources：註釋的 raw_data 檔名（不含 .txt）；原站網址從該章 source_manifest.md 取，並併進頁尾的來源清單
      const srcs = [];
      if (it.sources !== undefined) {
        if (!isStrArray(it.sources) || !it.sources.length) err(`${w}.sources`, '要是 raw_data 檔名（不含 .txt）的字串陣列');
        else it.sources.forEach((name, k) => {
          const sw = `${w}.sources[${k}]`;
          const p = parseRawName(name);
          if (!p) { err(sw, `檔名格式不對或書卷不在書卷表：${JSON.stringify(name)}（要寫成「biblehub_study_daniel_8」）`); return; }
          if (!existsSync(resolve(RAW_DATA_DIR, `${name}.txt`))) { err(sw, `raw_data/${name}.txt 不存在`); return; }
          const s = chapterSources(p.book, p.chapter)?.[p.id];
          if (!s) { err(sw, `${p.book}第${p.chapter}章的 source_manifest.md 沒有這個來源`); return; }
          if (s.status !== 'OK' || !s.url) { err(sw, `manifest 的狀態是「${s.status}」或沒有 URL`); return; }
          if (!String(s.rawRel ?? '').endsWith(`${name}.txt`)) { err(sw, `manifest 登記的 raw 檔是 ${s.rawRel}，和「${name}」不符`); return; }
          useSource(p.book, p.chapter, p.id);
          srcs.push({ site: SOURCE_SITE[p.id], book: p.book, chapter: p.chapter, url: s.url });
        });
      }
      const blocks = it.refs.map((ref, k) => resolveVerse(`${w}.refs[${k}]`, ref, false));
      if (blocks.some((b) => !b)) return;
      if (isStr(it.note)) for (const e of checkNoteQuotes(it.note, blocks.map((b) => b.lines.map((l) => l.text).join('')))) err(`${w}.note`, e);
      if (isStr(it.name) && isStr(it.note)) {
        others.items.push({
          name: it.name,
          refs: it.refs,
          note: it.note,
          verses: blocks.map((b) => ({ ref: b.ref, text: b.lines.map((l) => l.text).join('') })),
          ...(srcs.length ? { sources: srcs } : {}),
        });
      }
    });
  }

  // ---------- audio-sources.yaml（f） ----------
  const audioSrc = loadYaml('audio-sources.yaml') ?? [];
  const audio = [];
  const AUDIO_KEYS = ['id', 'file', 'title', 'author', 'license', 'page', 'pages', 'downloaded', 'loop', 'edit'];
  if (!Array.isArray(audioSrc)) err('audio-sources.yaml', '要是陣列（沒有音檔就寫 []）');
  const onDisk = new Set(listAudioFiles(audioDir));
  const listedFiles = new Set();
  const audioIds = new Set();
  (Array.isArray(audioSrc) ? audioSrc : []).forEach((a, i) => {
    const where = `audio-sources.yaml [${a?.id ?? i}]`;
    if (!a || typeof a !== 'object') { err(where, '要是物件'); return; }
    checkKeys(where, a, AUDIO_KEYS);
    for (const e of checkAudioEntry(a)) err(where, e);
    if (audioIds.has(a.id)) err(where, 'id 重複');
    audioIds.add(a.id);
    if (typeof a.file === 'string') {
      if (listedFiles.has(a.file)) err(where, `file「${a.file}」重複登記`);
      listedFiles.add(a.file);
      if (!onDisk.has(a.file)) err(`${where}.file`, `public/audio/ 底下沒有「${a.file}」`);
    }
    audio.push({
      id: a.id,
      file: a.file,
      title: a.title,
      author: a.author,
      license: a.license,
      page: a.page,
      ...(a.pages !== undefined ? { pages: a.pages } : {}),
      downloaded: a.downloaded,
      ...(a.loop !== undefined ? { loop: a.loop } : {}),
      ...(a.edit !== undefined ? { edit: a.edit } : {}),
    });
  });
  for (const f of onDisk) if (!listedFiles.has(f)) err(`public/audio/${f}`, '這個檔案在 audio-sources.yaml 沒有授權紀錄');

  // ---------- 授權頁的來源 ----------
  const bookNum = (name) => BOOK_BY_NAME[name].num;
  const sources = [...usedSources.values()]
    .sort((a, b) => bookNum(a.book) - bookNum(b.book) || a.chapter - b.chapter || SOURCE_ORDER.indexOf(a.source) - SOURCE_ORDER.indexOf(b.source))
    .map(({ book, chapter, source }) => ({
      book,
      chapter,
      source,
      site: SOURCE_SITE[source],
      url: chapterSources(book, chapter)?.[source]?.url ?? '',
    }));

  // ---------- 七的倍數（檢查 #6）：七、四十九、五十只從經文解析 ----------
  const lev = (ch, from, to) => (chapterVerses('利未記', ch) ?? []).slice(from - 1, to).join('');
  const sevens = parseSevens({ lev23_15_16: lev(23, 15, 16), lev25_8: lev(25, 8, 8), lev25_10: lev(25, 10, 10) });
  for (const e of sevens.errors) err('七的倍數', e);
  if (!sevens.errors.length && (sevens.days !== 7 || sevens.weeks49 !== 49 || sevens.fifty !== 50)) {
    err('七的倍數', `解析值應為 7、49、50，實際是 ${sevens.days}、${sevens.weeks49}、${sevens.fifty}`);
  }

  const data = {
    title: feasts.title,
    motto,
    chapters,
    verses,
    commentary,
    step,
    entries: Object.fromEntries(Object.entries(entryMap).map(([k, { type, gist }]) => [k, { title: k, type, gist }])),
    offerings,
    laterPalette: { paper: laterPal.paper, ink: laterPal.ink, accent: laterPal.accent, glow: laterPal.glow },
    audio,
    sources,
    sevens: { days: sevens.days, weeks49: sevens.weeks49, fifty: sevens.fifty },
    others,
  };
  return { data, errors, warnings };
}

export const renderOutput = (data) => stableStringify(data);

function main() {
  const check = process.argv.includes('--check');
  if (!IN_VAULT) {
    if (check) {
      // 部署時（CI）只有網站本身，沒有 vault；site.json 已隨專案提交，直接用它。
      console.log('找不到 vault，略過資料新鮮度檢查（使用已提交的 site.json）。');
      return;
    }
    console.error('找不到 vault（raw_scripture、link_folder）。這個腳本要在 scripture 專案裡跑。');
    process.exit(1);
  }
  const { data, errors, warnings } = buildAll();
  for (const w of warnings) console.warn(`警告 ${w}`);
  if (errors.length) {
    for (const e of errors) console.error(`錯誤 ${e}`);
    console.error(`共 ${errors.length} 個錯誤`);
    process.exit(1);
  }
  const out = renderOutput(data);
  const summary =
    `${data.chapters.length} 章、${data.chapters.reduce((n, c) => n + c.beats.length, 0)} 拍、` +
    `${Object.keys(data.verses).length} 段經文、${Object.keys(data.commentary).length} 則註釋、` +
    `${Object.keys(data.step).length} 個原文字、${Object.keys(data.offerings).length} 組獻祭、${Object.keys(data.entries).length} 個條目、` +
    `${data.audio.length} 個音檔、${data.sources.length} 筆來源`;
  if (check) {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== out) {
      console.error(`過期：${OUT}（請跑 npm run data）`);
      process.exit(1);
    }
    console.log(`資料是最新的：${summary}`);
    return;
  }
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, out, 'utf8');
  console.log(`已產生 src/data/site.json（${Buffer.byteLength(out)} bytes）：${summary}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
