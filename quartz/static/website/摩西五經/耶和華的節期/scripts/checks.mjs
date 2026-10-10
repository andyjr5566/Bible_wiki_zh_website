// 建置檢查的純函式：只吃字串與已解析的資料，不碰檔案系統（測試用固定字串驗證行為）。
// build-data.mjs 負責讀 vault、把資料餵進來，並把錯誤訊息加上「哪一筆、哪個欄位」。
//
// TODO（第二階段）：民28–29 獻祭數字檢查。數字要從 raw_scripture 的民28–29 重新計算，
// 再和 data 裡寫到的獻祭數字比對，不手抄；這次不做。

// ---------- 引文逐字比對 ----------

/** 刪除所有空白與換行（含全形空白）。這是引文比對唯一的正規化：標點、全半形、引號一律原樣。 */
export const stripSpaces = (s) => String(s ?? '').replace(/\s+/g, '');

/** 刪除空白後的 raw，並記下每個字在原文的位置，才能從比對結果回頭找原文位置 */
export function indexNoSpace(raw) {
  let flat = '';
  const map = [];
  for (let i = 0; i < raw.length; i++) {
    if (/\s/.test(raw[i])) continue;
    flat += raw[i];
    map.push(i);
  }
  return { flat, map };
}

/** quote 在 raw 裡的所有位置（原文索引，end 不含）。空白不計。 */
export function findQuote(raw, quote) {
  const q = stripSpaces(quote);
  if (!q) return [];
  const { flat, map } = indexNoSpace(raw);
  const hits = [];
  for (let at = flat.indexOf(q); at >= 0; at = flat.indexOf(q, at + 1)) {
    hits.push({ start: map[at], end: map[at + q.length - 1] + 1 });
  }
  return hits;
}

/** 對不上時的診斷：前幾個字吻合、之後 raw 實際是什麼 */
export function mismatchHint(raw, quote) {
  const { flat } = indexNoSpace(raw);
  const q = stripSpaces(quote);
  let lo = 0;
  let hi = q.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (flat.includes(q.slice(0, mid))) lo = mid;
    else hi = mid - 1;
  }
  if (lo === 0) return '連第一個字都對不上';
  const at = flat.indexOf(q.slice(0, lo));
  return `前 ${lo} 個字（不計空白）吻合；引文接著是「${q.slice(lo, lo + 10)}」，raw 接著是「${flat.slice(at + lo, at + lo + 10)}」`;
}

// ---------- GT（拾穗）歸屬 ----------

const NAME_MARK = /[《》]/g;
const sameWork = (line, work) => {
  const a = stripSpaces(line);
  const b = stripSpaces(work);
  return a.includes(b) || a.replace(NAME_MARK, '').includes(b.replace(NAME_MARK, ''));
};

/**
 * 從 from 位置往後找第一個「歸屬標記」：兩個以上的破折號字元（─ U+2500、－ U+FF0D、‒ U+2012、– U+2013、— U+2014、― U+2015，可混用）。
 * 標記後面（可換一行）接的是出處名稱：很短、沒有句讀。
 * 正文裡當破折號用的 ──（後面接的是整句話）會略過，免得被當成歸屬。
 * 只在引文所在的段落裡找（遇到空行就停）：GT 常有整段沒標出處，
 * 不能拿下一段的標記替它掛名。
 * 回傳 {line} 或 null。
 */
export function attributionAfter(raw, from) {
  const blank = /\r?\n[ \t　]*\r?\n/g;
  blank.lastIndex = from;
  const b = blank.exec(raw);
  const paraEnd = b ? b.index : raw.length;
  const re = /[─－‒–—―]{2,}/g;
  re.lastIndex = from;
  for (let m = re.exec(raw); m && m.index < paraEnd; m = re.exec(raw)) {
    const after = raw.slice(m.index + m[0].length);
    const mm = /^[ \t　]*(?:\r?\n[ \t　]*)?([^\r\n]*)/.exec(after);
    const line = mm[1].trim();
    if (line && line.length <= 60 && !/[。！？，；]/.test(line)) return { line };
  }
  return null;
}

/**
 * GT 的逐字引文要落在「──《子來源》」那一段：引文之後的第一個歸屬必須包含 work。
 * 同一句引文在 raw 出現多次時，任何一處歸屬正確就算過。
 * 回傳錯誤訊息；沒有錯回 null。
 */
export function checkGtAttribution(raw, hits, work) {
  const found = [];
  for (const h of hits) {
    const a = attributionAfter(raw, h.end);
    if (a && sameWork(a.line, work)) return null;
    found.push(a ? `「${a.line}」` : '（引文之後找不到 ── 歸屬）');
  }
  return `GT 引文的歸屬不符：work 寫「${work}」，raw 裡引文後面的出處是 ${[...new Set(found)].join('、')}`;
}

/** 只有 paraphrase 的 GT 註釋：work 的子來源名稱要出現在這份 raw 裡 */
export function gtWorkInRaw(raw, work) {
  const flat = stripSpaces(raw);
  const w = stripSpaces(work);
  return flat.includes(w) || flat.replace(NAME_MARK, '').includes(w.replace(NAME_MARK, ''));
}

/**
 * 一則註釋對 raw 的檢查（quote 逐字、GT 歸屬、GT 轉述的子來源）。
 * 回傳錯誤訊息陣列（不含「哪一筆」的前綴）。
 */
export function checkQuote({ source, quote, paraphrase, work }, raw, rawName) {
  const errs = [];
  if (quote) {
    const hits = findQuote(raw, quote);
    if (!hits.length) {
      errs.push(`quote 在 ${rawName} 找不到逐字原文（${mismatchHint(raw, quote)}）`);
    } else if (source === 'GT') {
      const e = checkGtAttribution(raw, hits, work);
      if (e) errs.push(e);
    }
  } else if (paraphrase && source === 'GT') {
    if (!gtWorkInRaw(raw, work)) errs.push(`GT 轉述的子來源「${work}」沒有出現在 ${rawName}`);
  }
  return errs;
}

// ---------- 頁尾「聖經裡還有的節期」 ----------

/** 一段話裡所有「…」引文（不含引號） */
export const quotedParts = (text) => [...String(text ?? '').matchAll(/「([^」]+)」/g)].map((m) => m[1]);

/**
 * note 裡每個「…」引文都要逐字出現在該項 refs 的經文裡（比對規則同註釋 quote：只忽略空白）。
 * verseTexts：該項所有 ref 的經文（字串陣列）。回傳錯誤訊息陣列。
 */
export function checkNoteQuotes(note, verseTexts) {
  const errs = [];
  const joined = verseTexts.join('');
  for (const q of quotedParts(note)) {
    if (!findQuote(joined, q).length) errs.push(`引文「${q}」沒有逐字出現在這一項的經文裡（${mismatchHint(joined, q)}）`);
  }
  return errs;
}

// ---------- ==高亮== ----------

/** 文字裡 ==…== 的處數；stray 表示有落單的 == */
export function countHighlights(text) {
  const s = String(text ?? '');
  const pairs = s.match(/==[^=]+?==/g) ?? [];
  return { count: pairs.length, stray: s.replace(/==[^=]+?==/g, '').includes('==') };
}

/** 每段最多一處 ==…==，而且要成對。回傳錯誤訊息陣列。 */
export function checkHighlights(text) {
  const { count, stray } = countHighlights(text);
  const errs = [];
  if (count > 1) errs.push(`==…== 每段最多一處（目前 ${count} 處）`);
  if (stray) errs.push('有落單的 ==（沒有成對）');
  return errs;
}

// ---------- STEP ----------

/** 去掉詞素分隔符 / 與跳脫符 \ */
export const cleanHebrew = (s) => String(s ?? '').replace(/[/\\]/g, '');

/** STEP 一列 → 網站的原文欄位 */
export function stepWordFrom(row) {
  const parts = row.morphRaw.split(' — ');
  return {
    hebrew: cleanHebrew(row.hebrewRaw),
    translit: row.translitRaw.replace(/\//g, ''),
    // Context gloss 裡「/ 」是詞素分隔（and/ he said）；其他斜線原樣保留
    gloss: row.glossRaw.replace(/\/\s+/g, ' ').replace(/\/$/, '').replace(/\s+/g, ' ').trim(),
    strong: row.strong,
    morph: parts[0].trim(),
    morphText: parts.slice(1).join(' — ').trim(),
    lexicon: row.lexicon,
  };
}

/**
 * 在已解析的 STEP 檔裡找 spec 指定的字，並驗證：位置找得到、Strong 與 expect_strong 一致、
 * 去掉分隔符後的希伯來字是該節「Original:」行的子字串（證明不是手打的）。
 * 回傳 {word, errors}。
 */
export function extractStepWord(spec, stepMap, { chapter, verse, en }) {
  const errors = [];
  const sec = stepMap?.get(`${chapter}:${verse}`);
  if (!sec) return { word: null, errors: [`STEP raw 找不到 ${en} ${chapter}:${verse} 這一節`] };
  if (sec.en !== en) errors.push(`STEP raw 這一節的書名是「${sec.en}」，預期「${en}」`);
  const row = sec.rows.find((r) => r.n === spec.position);
  if (!row) return { word: null, errors: [...errors, `STEP 表格第 ${spec.position} 個字不存在（這一節共 ${sec.rows.length} 個字）`] };
  const word = stepWordFrom(row);
  if (word.strong !== spec.expect_strong) {
    errors.push(`抽到的 Strong 是 ${word.strong}（${word.hebrew}，${word.gloss}），與 expect_strong ${spec.expect_strong} 不一致，position 可能寫錯`);
  }
  if (!cleanHebrew(sec.original).includes(word.hebrew)) {
    errors.push(`希伯來字「${word.hebrew}」不是該節 Original 行的子字串`);
  }
  return { word, errors };
}

// ---------- 音檔 ----------

const isHttp = (u) => typeof u === 'string' && /^https?:\/\/\S+$/.test(u);

/**
 * 音檔一筆的欄位檢查。回傳錯誤訊息陣列。
 * 規則：license 只能是 CC0；page 是 http(s) 網址；pages（若有）每個都是 http(s) 網址且包含 page；
 * downloaded 是有效的 YYYY-MM-DD；edit（若有）是非空字串。
 */
export function checkAudioEntry(a) {
  const errs = [];
  for (const k of ['id', 'file', 'title', 'author']) if (typeof a[k] !== 'string' || !a[k].trim()) errs.push(`${k} 要是非空字串`);
  if (a.license !== 'CC0') errs.push(`license 只能是 'CC0'（目前是 ${JSON.stringify(a.license)}）`);
  if (!isHttp(a.page)) errs.push(`page 要是 http(s) 網址（目前是 ${JSON.stringify(a.page)}）`);
  if (a.pages !== undefined) {
    if (!Array.isArray(a.pages) || !a.pages.length) errs.push('pages 要是網址陣列');
    else {
      a.pages.forEach((u, i) => { if (!isHttp(u)) errs.push(`pages[${i}] 要是 http(s) 網址（目前是 ${JSON.stringify(u)}）`); });
      if (isHttp(a.page) && !a.pages.includes(a.page)) errs.push('pages 要包含 page');
    }
  }
  if (typeof a.downloaded !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.downloaded) || Number.isNaN(Date.parse(a.downloaded)) || new Date(a.downloaded).toISOString().slice(0, 10) !== a.downloaded) {
    errs.push(`downloaded 要是有效的 YYYY-MM-DD（目前是 ${JSON.stringify(a.downloaded)}）`);
  }
  if (a.loop !== undefined && typeof a.loop !== 'boolean') errs.push('loop 要是 true/false');
  if (a.edit !== undefined && (typeof a.edit !== 'string' || !a.edit.trim())) errs.push('edit 要是非空字串');
  return errs;
}

/** 未知欄位（多半是打錯字） */
export function unknownKeys(obj, allowed) {
  return Object.keys(obj ?? {}).filter((k) => !allowed.includes(k));
}

// ---------- 獻祭數字（檢查 #5）：數字只從經文算，yaml 不手抄 ----------

/** 動物詞照經文原字；長詞優先，免得「公綿羊」吃掉「公綿羊羔」的前半 */
export const OFFERING_ANIMALS = ['公牛犢', '公綿羊羔', '公綿羊', '公羊羔', '羊羔', '公山羊', '公牛', '公羊'];
const ANIMAL_ALT = [...OFFERING_ANIMALS].sort((a, b) => b.length - a.length).join('|');
const DIGITS = { 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 支援一到九、十、十一到十九；「二十」「三十」等不支援（不匹配，隻就沒被吃掉，會報錯，不會誤解析） */
const NUM = '(?:十[一二三四五六七八九]?|[一二兩三四五六七八九])';
/** 單字的數字字元（lookbehind 用：「二十隻」的「十」前面是數字，不是十） */
const NUM_CH = '[一二兩三四五六七八九十]';
/** 「十」「十一」…「十九」「一」…「九」→ 數目；不認得回 NaN */
export function parseNumeral(s) {
  if (s === '十') return 10;
  if (s.length === 2 && s[0] === '十') return 10 + (DIGITS[s[1]] ?? NaN);
  return s.length === 1 ? (DIGITS[s] ?? NaN) : NaN;
}
const ROLE_NAMES = '燔祭|贖罪祭|平安祭';
/** 同時獻的素祭、奠祭的份量（伊法、欣、奠酒）：這種句子裡的「隻」是在說配搭的份量，不是祭牲的數目 */
const ACCOMPANIMENT = /伊法|欣|奠酒/;
const CLAUSE_SPLIT = /[，；]/;
const MODIFIER_MAX = 12;

/**
 * 從一段經文（每節一個字串）解析祭牲清單。回傳 { items:[{animal,count,role}], errors:[字串] }。
 * 規則：
 *  1. 以「，；」切子句、以「。」切句。
 *  2. 抓「動物＋數字＋隻」（先）與「數字＋隻＋（修飾語）＋動物」（後）；只認緊接「隻」的數字，「一歲」不是數量。
 *  3. role：本子句的「(為|作|作為)(燔祭|贖罪祭|平安祭)」；沒有，本子句有「贖罪」→「贖罪」；
 *     再沒有，同一句（以「。」為界）出現的燔祭／贖罪祭／平安祭；再沒有，同一節出現的；都沒有 → 空字串。
 *  4. 含「伊法／欣／奠酒」的句子是在說素祭、奠祭的份量，其中的「隻」算被吃掉，但不產生祭牲。
 *  5. 其餘每一個「隻」都必須被某一筆吃掉，否則回報是哪一句。
 */
export function parseOfferings(verseTexts) {
  const items = [];
  const errors = [];
  const roleIn = (s) => new RegExp(ROLE_NAMES).exec(s)?.[0] ?? '';
  verseTexts.forEach((verse) => {
    for (const sentence of verse.split('。')) {
      if (!sentence.includes('隻')) continue;
      if (ACCOMPANIMENT.test(sentence)) continue;
      const sentenceRole = roleIn(sentence);
      let offset = 0;
      for (const clause of sentence.split(CLAUSE_SPLIT)) {
        const clauseStart = sentence.indexOf(clause, offset);
        offset = clauseStart + clause.length;
        if (!clause.includes('隻')) continue;
        const eaten = new Set(); // 已被吃掉的「隻」在子句內的位置
        const found = []; // { at, animal, count }
        // 動物＋數字＋隻
        for (const m of clause.matchAll(new RegExp(`(${ANIMAL_ALT})(${NUM})隻`, 'g'))) {
          const pos = m.index + m[1].length + m[2].length;
          eaten.add(pos);
          found.push({ at: m.index, animal: m[1], count: parseNumeral(m[2]) });
        }
        // 數字＋隻＋（修飾語）＋動物
        const pre = new RegExp(`(?<!${NUM_CH})(${NUM})隻([^，；。隻]{0,${MODIFIER_MAX}}?)(${ANIMAL_ALT})`, 'g');
        for (let m = pre.exec(clause); m; m = pre.exec(clause)) {
          const pos = m.index + m[1].length;
          if (eaten.has(pos)) { pre.lastIndex = m.index + 1; continue; }
          eaten.add(pos);
          found.push({ at: m.index, animal: m[3], count: parseNumeral(m[1]) });
          pre.lastIndex = m.index + m[0].length;
        }
        for (let i = clause.indexOf('隻'); i >= 0; i = clause.indexOf('隻', i + 1)) {
          if (!eaten.has(i)) errors.push(`「隻」沒有被解析成祭牲：「${clause}」（出自：${sentence}。）`);
        }
        const direct = new RegExp(`(?:作為|為|作)(${ROLE_NAMES})`).exec(clause)?.[1];
        const role = direct ?? (clause.includes('贖罪') ? '贖罪' : (sentenceRole || roleIn(verse)));
        found.sort((a, b) => a.at - b.at).forEach((f) => items.push({ animal: f.animal, count: f.count, role }));
      }
    }
  });
  if (!items.length && !errors.length) errors.push('這段經文沒有解析出任何祭牲');
  return { items, errors };
}

// ---------- 七的倍數（檢查 #6）：七、四十九、五十只從經文解析，場景的格數讀這些值 ----------

const TENS = { 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
/** 一到九十九的中文數字（七、十、十二、二十、四十九、五十）→ 數目；不認得回 NaN */
export function parseCnCount(s) {
  const t = String(s ?? '');
  if (t === '十') return 10;
  if (/^[一二兩三四五六七八九]$/.test(t)) return DIGITS[t];
  let m = /^十([一二三四五六七八九])$/.exec(t);
  if (m) return 10 + DIGITS[m[1]];
  m = /^([二三四五六七八九])十([一二三四五六七八九])?$/.exec(t);
  if (m) return TENS[m[1]] * 10 + (m[2] ? DIGITS[m[2]] : 0);
  return NaN;
}

const CN_COUNT = '[一二兩三四五六七八九十]+';
/**
 * 從三段經文解析七的倍數。
 *  lev23_15_16：利23:15-16 的兩節文字合併（「要滿了七個安息日」「共計五十天」）
 *  lev25_8：利25:8（「七個安息年，就是七七年」「共是四十九年」）
 *  lev25_10：利25:10（「第五十年」）
 * 回傳 {days, weeks49, fifty, errors}：
 *  days＝七個安息日的「七」；weeks49＝七個安息年共是的年數；fifty＝禧年是第幾年。
 *  另外檢查：利23:16 的天數＝第五十（七個安息日之後的次日）、七七＝四十九、禧年＝四十九加一。
 */
export function parseSevens({ lev23_15_16 = '', lev25_8 = '', lev25_10 = '' } = {}) {
  const errors = [];
  const num = (re, text, where, label) => {
    const m = re.exec(text);
    if (!m) { errors.push(`${where} 找不到「${label}」`); return NaN; }
    const n = parseCnCount(m[1]);
    if (Number.isNaN(n)) errors.push(`${where}「${label}」的數字「${m[1]}」認不得`);
    return n;
  };
  const days = num(new RegExp(`要滿了(${CN_COUNT})個安息日`), lev23_15_16, '利23:15', '要滿了N個安息日');
  const fiftyDays = num(new RegExp(`共計(${CN_COUNT})天`), lev23_15_16, '利23:16', '共計N天');
  const sabbathYears = num(new RegExp(`計算(${CN_COUNT})個安息年`), lev25_8, '利25:8', '計算N個安息年');
  const sevenSevens = /就是七七年/.test(lev25_8);
  if (!sevenSevens) errors.push('利25:8 找不到「就是七七年」');
  const weeks49 = num(new RegExp(`共是(${CN_COUNT})年`), lev25_8, '利25:8', '共是N年');
  const jubilee = num(new RegExp(`第(${CN_COUNT})年`), lev25_10, '利25:10', '第N年');
  if (!errors.length) {
    if (sabbathYears !== days) errors.push(`利25:8 的安息年數（${sabbathYears}）和利23:15 的安息日數（${days}）不同`);
    if (weeks49 !== days * days) errors.push(`七七應為 ${days * days}，利25:8 寫 ${weeks49}`);
    if (fiftyDays !== days * days + 1) errors.push(`利23:16 的天數（${fiftyDays}）應為 ${days * days + 1}（${days} 個安息日加次日）`);
    if (jubilee !== weeks49 + 1) errors.push(`利25:10 的第 ${jubilee} 年應為 ${weeks49 + 1}`);
  }
  return { days, weeks49, fifty: jubilee, errors };
}
