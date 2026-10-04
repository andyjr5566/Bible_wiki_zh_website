// 把手寫資料（data/*.yaml）和 vault 裡的來源接起來，產生網站要用的 src/data/explorer.json。
//
//   node scripts/build-data.mjs           產生（寫檔）
//   node scripts/build-data.mjs --check   只檢查：有錯誤或輸出過期就失敗（npm run build 會先跑這個）
//
// 手寫的只有結構（主題、段落、條文、白話說明、關聯、導覽路線）。經文、經文裡的知識節點、
// 條目類型、法典段落都從 vault 讀；知識庫內容只取條目名稱＋一句簡介，完整內容由網站連出去。
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  BOOKS, BOOK_BY_NAME, SITE, IN_VAULT, read, chapterVerses, parseRange, versesOf, toRanges,
  extractRefs, refTouchesLaw, verseLinksPath, resolveEntry, entries, entryGist, entryText,
  chapterMdPath, chapterOrganization, bookCodes, ROOT,
} from './lib.mjs';

/** 首頁標語取自這一節的和合本原文（逐字讀 raw_scripture，不手抄） */
const MOTTO = { book: '詩篇', chapter: 1, verse: 2 };

export const RELATION_TYPES = ['parallel', 'supplement', 'case', 'cites'];
export const SUMMARY_MAX = 90;
/** 白話說明只能重述經文；這些字眼多半代表加了解釋或 AI 腔 */
export const BANNED = [
  [/不是[^。；]*?而是/, '「不是…而是」對仗'],
  [/象徵|預表|體現|意味著|彰顯|啟示我們|提醒我們|教導我們|屬靈/, '解釋性字眼'],
  [/她/, '和合本女性主詞用「他」'],
  [/\b(?:CT|GT|KC|BH|STEP)\b/, '來源代號不進白話說明'],
  [/\bH\d{3,}/, 'Strong 編號不進白話說明'],
  [/不只是[^。；]*?更|與其說[^。；]*?不如說|是[^。；，]{1,12}，不是/, '對仗轉折'],
  [/讓我們|一起來|帶你|探索|旅程|踏上|揭開|奧秘|值得注意|值得一提|事實上|換句話說|自古以來/, '導覽口吻或套話'],
];
/** 網站自己寫的標題、問句：平實交代內容，不寫成「X：Y」標語 */
export const COPY_BANNED = [[/[：:]/, '標題不用「X：Y」標語式寫法']];
export function lintCopy(text, max = 30) {
  return [...lintPlain(text, max), ...COPY_BANNED.filter(([re]) => re.test(text ?? '')).map(([, why]) => why)];
}
const OVERLAP_WARN = 0.4;

const loadYaml = (p) => YAML.parse(read(p));

/** 白話說明 lint：回傳錯誤訊息清單 */
export function lintPlain(text, max = SUMMARY_MAX) {
  const errs = [];
  if (!text || !String(text).trim()) return ['空白'];
  if ([...text].length > max) errs.push(`超過 ${max} 字（${[...text].length}）`);
  for (const [re, why] of BANNED) if (re.test(text)) errs.push(why);
  return errs;
}

/** 說明裡的中文雙字詞，有多少比例出現在依據經文中（太低＝可能說了經文沒說的事） */
export function overlapRatio(summary, verseText) {
  const cjk = [...summary].filter((c) => /\p{Script=Han}/u.test(c));
  const grams = new Set();
  for (let i = 0; i + 1 < cjk.length; i++) grams.add(cjk[i] + cjk[i + 1]);
  if (!grams.size) return 1;
  let hit = 0;
  for (const g of grams) if (verseText.includes(g)) hit++;
  return hit / grams.size;
}

export function buildAll() {
  const errors = [];
  const warnings = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const dataDir = resolve(SITE, 'data');

  // ---- 主題 ----
  const topicsSrc = loadYaml(resolve(dataDir, 'topics.yaml'));
  const groups = [];
  const topics = [];
  const topicIds = new Set();
  const usedEntries = new Set();
  const needEntry = (where, name) => {
    const t = resolveEntry(name);
    if (!t) err(where, `知識庫找不到條目「${name}」`);
    else usedEntries.add(t);
    return t;
  };
  for (const g of topicsSrc.groups) {
    groups.push({ id: g.id, name: g.name, plain: g.plain, color: g.color, topics: g.topics.map((t) => t.id) });
    for (const t of g.topics) {
      if (topicIds.has(t.id)) err(`topics.${t.id}`, '主題 id 重複');
      topicIds.add(t.id);
      const entry = t.entry ? needEntry(`topics.${t.id}`, t.entry) : null;
      topics.push({ id: t.id, name: t.name, plain: t.plain ?? t.name, group: g.id, ...(entry ? { entry } : {}) });
    }
  }

  // ---- 段落與條文 ----
  const sections = [];
  const laws = [];
  const lawById = new Map();
  const chapterInfo = []; // {book, chapter, excluded}
  const lawsDir = resolve(dataDir, 'laws');
  const files = existsSync(lawsDir) ? readdirSync(lawsDir).filter((f) => f.endsWith('.yaml')) : [];
  // 檔名可以是「利未記-01-04」：同一卷分成幾個檔案時，取最前面的書名排序
  const bookOrder = (name) => BOOK_BY_NAME[name.split('-')[0]]?.num ?? 99;
  for (const f of files.sort((a, b) => bookOrder(a.replace(/\.yaml$/, '')) - bookOrder(b.replace(/\.yaml$/, '')))) {
    const src = loadYaml(resolve(lawsDir, f));
    const book = src.book;
    if (!BOOK_BY_NAME[book]) { err(f, `不是五經的書名：${book}`); continue; }
    for (const ch of src.chapters ?? []) {
      const where = `${book}${ch.chapter}`;
      const verses = chapterVerses(book, ch.chapter);
      if (!verses) { err(where, 'raw_scripture 找不到這一章'); continue; }
      const n = verses.length;
      const inChapter = ([a, b]) => a >= 1 && b <= n;
      const excluded = [];
      for (const x of ch.excluded ?? []) {
        const r = parseRange(x.verses);
        if (!r || !inChapter(r)) err(where, `excluded 範圍不對：${x.verses}`);
        else if (!x.reason) err(where, `excluded ${x.verses} 要寫理由`);
        else excluded.push({ range: r, reason: x.reason });
      }
      chapterInfo.push({ book, chapter: ch.chapter, total: n, excluded });
      for (const s of ch.sections ?? []) {
        const sr = parseRange(s.verses);
        if (!sr || !inChapter(sr)) err(s.id, `段落範圍不對：${s.verses}`);
        const code = bookCodes(book).find((c) => ch.chapter >= c.from && ch.chapter <= c.to)?.title;
        const sec = { id: s.id, book, chapter: ch.chapter, title: s.title, from: sr?.[0] ?? 1, to: sr?.[1] ?? 1, ...(code ? { code } : {}), laws: [] };
        sections.push(sec);
        for (const l of s.laws ?? []) {
          const lw = `${l.id}`;
          if (lawById.has(l.id)) err(lw, '條文 id 重複');
          const refs = (l.refs ?? []).map(parseRange);
          if (!refs.length || refs.some((r) => !r || !inChapter(r))) err(lw, `refs 不對：${JSON.stringify(l.refs)}`);
          const good = refs.filter(Boolean);
          if (sr && good.some(([a, b]) => a < sr[0] || b > sr[1])) warnings.push(`${lw}: 條文超出所屬段落 ${s.verses}`);
          const covered = new Set(versesOf(good));
          const basis = l.basis ?? [];
          if (!basis.length) err(lw, '要寫 basis（依據經節）');
          for (const v of basis) if (!covered.has(v)) err(lw, `basis 第 ${v} 節不在 refs 內`);
          // why：經文自己交代理由的節（只標節號，畫面上顯示和合本原句，網站不另寫理由）
          const why = l.why ?? [];
          for (const v of why) if (!covered.has(v)) err(lw, `why 第 ${v} 節不在 refs 內`);
          const ts = l.topics ?? [];
          if (!ts.length) err(lw, '至少要一個子題');
          for (const t of ts) if (!topicIds.has(t)) err(lw, `沒有這個子題：${t}`);
          for (const e of lintPlain(l.summary)) err(lw, `白話說明：${e}`);
          for (const e of lintPlain(l.title, 30)) err(lw, `標題：${e}`);
          const ents = (l.entries ?? []).map((e) => needEntry(lw, e)).filter(Boolean);
          const law = { id: l.id, title: l.title, book, chapter: ch.chapter, refs: good, topics: ts, summary: l.summary, basis, why, entries: ents, section: s.id };
          laws.push(law);
          lawById.set(l.id, law);
          sec.laws.push(l.id);
          const basisText = basis.map((v) => verses[v - 1] ?? '').join('');
          const ratio = overlapRatio(l.summary ?? '', basisText);
          law._overlap = ratio;
          if (ratio < OVERLAP_WARN) warnings.push(`${lw}: 白話說明與依據經文的字詞重疊只有 ${(ratio * 100).toFixed(0)}%，請對照經文確認沒有加料`);
        }
      }
    }
  }

  // ---- 經文與經文裡的知識節點 ----
  const verses = {};
  const links = {};
  const abbr = (book) => BOOK_BY_NAME[book].abbr;
  const lawChapters = new Map();
  for (const law of laws) {
    const key = `${law.book}/${law.chapter}`;
    if (!lawChapters.has(key)) lawChapters.set(key, new Set());
    for (const v of versesOf(law.refs)) lawChapters.get(key).add(v);
  }
  for (const [key, vs] of lawChapters) {
    const [book, chs] = key.split('/');
    const chapter = Number(chs);
    const text = chapterVerses(book, chapter);
    for (const v of vs) verses[`${abbr(book)}${chapter}:${v}`] = text[v - 1];
    // 理由節一定在 refs 內，已隨 vs 收進 verses
    const p = verseLinksPath(book, chapter);
    if (!p) { warnings.push(`${book}${chapter}: 找不到 verse_links.yaml，經文不會劃出知識節點`); continue; }
    const vl = YAML.parse(read(p));
    for (const item of vl.links ?? []) {
      if (!vs.has(item.verse)) continue;
      const vk = `${abbr(book)}${chapter}:${item.verse}`;
      const t = text[item.verse - 1];
      let at = -1;
      for (let k = 0; k < (item.occurrence ?? 1); k++) at = t.indexOf(item.phrase, at + 1);
      if (at < 0) { err(vk, `verse_links 的片語「${item.phrase}」在經文裡找不到`); continue; }
      const target = resolveEntry(item.target);
      if (!target) { err(vk, `verse_links 的 target「${item.target}」不在 link_folder`); continue; }
      usedEntries.add(target);
      (links[vk] ??= []).push({ s: at, e: at + item.phrase.length, target });
    }
  }
  for (const [vk, arr] of Object.entries(links)) {
    arr.sort((a, b) => a.s - b.s || b.e - a.e);
    const kept = [];
    for (const l of arr) {
      if (kept.length && l.s < kept[kept.length - 1].e) { warnings.push(`${vk}: 片語重疊，略過「${l.target}」`); continue; }
      kept.push(l);
    }
    links[vk] = kept;
  }

  // ---- 關聯 ----
  const relations = [];
  const relSrc = loadYaml(resolve(dataDir, 'relations.yaml')) ?? [];
  relSrc.forEach((r, i) => {
    const where = `relations[${i}] ${r.from}→${r.to}`;
    const from = lawById.get(r.from);
    const to = lawById.get(r.to);
    if (!from || !to) { err(where, '找不到 from 或 to 條文'); return; }
    if (!RELATION_TYPES.includes(r.type)) { err(where, `type 只能是 ${RELATION_TYPES.join('/')}`); return; }
    const ev = r.evidence ?? {};
    if (!ev.quote) { err(where, '證據要有 quote'); return; }
    let evidence;
    let refs = extractRefs(ev.quote);
    if (ev.entry) {
      const title = resolveEntry(ev.entry);
      if (!title) { err(where, `證據條目「${ev.entry}」不存在`); return; }
      if (!entryText(title).includes(ev.quote)) { err(where, `引句沒有逐字出現在條目「${title}」`); return; }
      usedEntries.add(title);
      refs = [...extractRefs(title), ...refs];
      evidence = { kind: 'entry', title, quote: ev.quote };
    } else if (ev.chapter) {
      const m = /^(.+)\/第(\d+)章$/.exec(ev.chapter);
      if (!m || !BOOK_BY_NAME[m[1]] || !existsSync(chapterMdPath(m[1], Number(m[2])))) { err(where, `證據章節「${ev.chapter}」不存在`); return; }
      if (!chapterOrganization(m[1], Number(m[2])).includes(ev.quote)) { err(where, `引句沒有逐字出現在 ${ev.chapter} 的本章整理`); return; }
      refs = [{ book: m[1], chapter: Number(m[2]), from: 1, to: Infinity }, ...refs];
      evidence = { kind: 'chapter', book: m[1], chapter: Number(m[2]), quote: ev.quote };
    } else { err(where, '證據要有 entry 或 chapter'); return; }
    const hitsFrom = refs.some((x) => refTouchesLaw(x, from));
    const hitsTo = refs.some((x) => refTouchesLaw(x, to));
    if (!hitsFrom || !hitsTo) { err(where, `證據裡的經文參照沒有同時蓋到兩端（from:${hitsFrom} to:${hitsTo}）`); return; }
    relations.push({ from: r.from, to: r.to, type: r.type, evidence });
  });

  // ---- 導覽路線、術語 ----
  const tours = [];
  for (const t of loadYaml(resolve(dataDir, 'tours.yaml')) ?? []) {
    for (const s of t.stops ?? []) if (!lawById.has(s)) err(`tours.${t.id}`, `沒有這條條文：${s}`);
    for (const e of lintCopy(t.title)) err(`tours.${t.id}`, `名稱：${e}`);
    for (const e of lintPlain(t.intro)) err(`tours.${t.id}`, `開場：${e}`);
    tours.push({ id: t.id, title: t.title, intro: t.intro, stops: t.stops ?? [] });
  }
  const questions = [];
  (loadYaml(resolve(dataDir, 'questions.yaml')) ?? []).forEach((x, i) => {
    const where = `questions[${i}]`;
    for (const e of lintCopy(x.q)) err(where, `問句：${e}`);
    if (!/？$/.test(x.q ?? '')) err(where, '問句要以「？」結尾');
    const ls = x.laws ?? [];
    if (!ls.length || ls.length > 3) err(where, 'laws 要 1–3 條');
    for (const id of ls) if (!lawById.has(id)) err(where, `沒有這條條文：${id}`);
    questions.push({ q: x.q, laws: ls });
  });
  const glossary = [];
  for (const [term, name] of Object.entries(loadYaml(resolve(dataDir, 'glossary.yaml')) ?? {})) {
    const t = needEntry(`glossary.${term}`, name);
    if (t) glossary.push({ term, entry: t });
  }

  // ---- 首頁標語：詩1:2 和合本原句 ----
  const mottoVerses = chapterVerses(MOTTO.book, MOTTO.chapter);
  const motto = { ref: `${MOTTO.book}${MOTTO.chapter}:${MOTTO.verse}`, text: mottoVerses?.[MOTTO.verse - 1] ?? '' };
  if (!motto.text.includes('喜愛耶和華的律法')) err('motto', `${motto.ref} 在 raw_scripture 找不到預期的經文`);

  // ---- 「律法」的原文字義：核對 STEP 簡明詞典，畫面上的字義不得超出詞典 ----
  const lex = resolve(ROOT, '.stepbible_data/Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt');
  if (existsSync(lex)) {
    const rows = readFileSync(lex, 'utf8').split(/\r?\n/);
    const row = (id) => rows.find((r) => r.startsWith(`${id}\t`)) ?? '';
    if (!/direction, instruction/.test(row('H8451'))) err('torah', 'STEP 詞典的 H8451 查不到「direction, instruction」');
    if (!/to shoot/.test(row('H3384a')) || !/direct, teach/.test(row('H3384b'))) err('torah', 'STEP 詞典的 H3384 查不到射箭與指出、教導兩個義域');
  } else warnings.push('找不到 .stepbible_data 詞典，未核對「律法」原文字義');

  // ---- 條目：只留類型與一句簡介 ----
  const entryMap = {};
  for (const title of [...usedEntries].sort()) {
    entryMap[title] = { type: entries().byTitle.get(title).type, gist: entryGist(title) };
  }

  // ---- 覆蓋率 ----
  const coverage = chapterInfo.map(({ book, chapter, total, excluded }) => {
    const covered = lawChapters.get(`${book}/${chapter}`) ?? new Set();
    const ex = new Set(versesOf(excluded.map((x) => x.range)));
    const missing = [];
    for (let v = 1; v <= total; v++) if (!covered.has(v) && !ex.has(v)) missing.push(v);
    return { book, chapter, total, covered: covered.size, excluded: ex.size, missing: toRanges(missing) };
  });

  const data = {
    version: 1,
    books: BOOKS.map((b) => ({
      abbr: b.abbr, name: b.name, num: b.num,
      chapters: IN_VAULT ? countChapters(b.name) : 0,
      codes: bookCodes(b.name),
    })),
    groups, topics, sections,
    laws: laws.map(({ _overlap, ...l }) => l),
    motto, verses, links, entries: entryMap, relations, questions, tours, glossary, coverage,
  };

  const chaptersJson = [...new Set(laws.map((l) => `${l.book}/第${l.chapter}章`))]
    .sort((a, b) => sortKey(a) - sortKey(b));

  const review = reviewSheet(laws, verses, abbr);
  return { data, errors, warnings, coverage, chaptersJson, review };
}

function countChapters(book) {
  const dir = resolve(SITE, '../../../..', 'raw_scripture', book);
  return existsSync(dir) ? readdirSync(dir).filter((f) => /^第\d+章\.txt$/.test(f)).length : 0;
}

function sortKey(key) {
  const m = /^(.+)\/第(\d+)章$/.exec(key);
  return BOOK_BY_NAME[m[1]].num * 1000 + Number(m[2]);
}

function reviewSheet(laws, verses, abbr) {
  const lines = [
    '# 白話說明逐條審查表',
    '',
    '> 自動產生（`npm run data`），不要手改。每條對照經文確認：只重述經文說了什麼、沒有加解釋、依據節對得上。',
    '> 重疊率是說明裡的雙字詞出現在依據經文中的比例，太低時要特別看。',
    '',
    '| 條文 | 經文 | 白話說明 | 依據 | 重疊率 |',
    '| --- | --- | --- | --- | --- |',
  ];
  for (const l of laws) {
    const text = versesOf(l.refs).map((v) => `${v} ${verses[`${abbr(l.book)}${l.chapter}:${v}`]}`).join(' ');
    const flag = l._overlap < OVERLAP_WARN ? ' ⚠' : '';
    lines.push(`| ${l.id} ${l.title} | ${abbr(l.book)}${l.chapter}：${text} | ${l.summary} | ${l.basis.join('、')} | ${(l._overlap * 100).toFixed(0)}%${flag} |`);
  }
  return lines.join('\n') + '\n';
}

const OUT = {
  data: resolve(SITE, 'src/data/explorer.json'),
  chapters: resolve(SITE, 'appendix-chapters.json'),
  review: resolve(SITE, 'review/summaries.md'),
};

export function renderOutputs(result) {
  return {
    [OUT.data]: JSON.stringify(result.data) + '\n',
    [OUT.chapters]: JSON.stringify(result.chaptersJson, null, 2) + '\n',
    [OUT.review]: result.review,
  };
}

function main() {
  if (!IN_VAULT) {
    console.error('找不到 vault（raw_scripture、link_folder）。這個腳本要在 scripture 專案裡跑。');
    process.exit(1);
  }
  const check = process.argv.includes('--check');
  const result = buildAll();
  for (const w of result.warnings) console.warn(`警告 ${w}`);
  for (const c of result.coverage) {
    if (c.missing.length) console.log(`覆蓋率 ${c.book}${c.chapter}：${c.covered}/${c.total} 節已收，${c.excluded} 節不收，未處理 ${c.missing.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join('、')}`);
  }
  if (result.errors.length) {
    for (const e of result.errors) console.error(`錯誤 ${e}`);
    console.error(`共 ${result.errors.length} 個錯誤`);
    process.exit(1);
  }
  const outputs = renderOutputs(result);
  if (check) {
    const stale = Object.entries(outputs).filter(([p, s]) => !existsSync(p) || readFileSync(p, 'utf8') !== s);
    if (stale.length) {
      for (const [p] of stale) console.error(`過期：${p}（請跑 npm run data）`);
      process.exit(1);
    }
    console.log(`資料是最新的：${result.data.laws.length} 條條文、${result.data.relations.length} 條關聯`);
    return;
  }
  for (const [p, s] of Object.entries(outputs)) {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, s, 'utf8');
  }
  console.log(`已產生：${result.data.laws.length} 條條文、${result.data.sections.length} 個段落、${result.data.relations.length} 條關聯、${Object.keys(result.data.entries).length} 個條目`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
