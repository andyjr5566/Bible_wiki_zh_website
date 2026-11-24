/**
 * 統一的搜尋正規化與比對引擎：經文搜尋、經文標示、知識庫搜尋、摘要標示、預覽／頁面內標示共用。
 *
 * 比對一律在「正規化後的字串」上做，再用 unitRanges 把每個 UTF-16 單元對回原文的 [start, end)。
 * 原文含 Plane-2 漢字（𧼮、𣎴 各佔 2 個單元），折疊（蹚→𧼮）或組合字（A + ́ → á）都會改變長度，
 * 所以不能假設正規化前後長度相同。
 */
import {
  CHAR_FOLD_MAP,
  PROPER_AND_EDITION_EQUIVALENTS,
  SIMPLIFIED_PHRASE_MAP,
} from "../data/compatData";

export interface TextRange {
  start: number;
  end: number;
}

export interface TextProjection {
  /** 正規化後的字串。 */
  norm: string;
  /** 長度與 norm 相同；norm 的每個 UTF-16 單元對應原文的 [start, end)。未要求時為空陣列。 */
  unitRanges: TextRange[];
  /** 被略過的譯註範圍（只有 stripNotes 時才有）。 */
  notes: TextRange[];
}

export interface ProjectionOptions {
  /** 是否建立 unitRanges（只做比對、不需要標示時可省略以加快速度）。 */
  ranges?: boolean;
  /** 略過行內譯註（【…】、[原文…]、（原文…）等）。 */
  stripNotes?: boolean;
  /**
   * 換行保留成單一個 "\n" 哨兵字元（連續換行合併）。查詢展開後永遠不含 "\n"，
   * 所以比對不會跨行；行內空白與標點仍然被略過。只給知識庫搜尋用，經文標示不需要。
   */
  lineBreaks?: boolean;
}

const MAX_EXPANSIONS = 8;

const IGNORABLE_CHARS = new Set(Array.from("，。；：？！、（）()【】〔〕[]「」『』“”‘’\"'—─…‧·﹕"));
const NOTE_PATTERN =
  /【[^】]*】|\[原文[^\]]*\]|（(?:原文|或作|或譯|古卷|有古卷|小字|[^）]{0,8}原文)[^）]*）/g;
const NOTE_TRIGGER = /[（(【[]/;
/** 組合符號、ZWJ、變體選擇符、表情符號代理對：要用 grapheme 切字，不能逐 code point。 */
function needsSegmenter(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      (code >= 0x300 && code <= 0x36f) ||
      (code >= 0x1ab0 && code <= 0x1aff) ||
      (code >= 0x1dc0 && code <= 0x1dff) ||
      (code >= 0x20d0 && code <= 0x20ff) ||
      code === 0x200c ||
      code === 0x200d ||
      (code >= 0xfe00 && code <= 0xfe0f) ||
      (code >= 0xfe20 && code <= 0xfe2f) ||
      (code >= 0xd83c && code <= 0xd83f)
    ) {
      return true;
    }
  }
  return false;
}
const WHITESPACE = /^\s+$/;

const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["「", "」"],
  ["『", "』"],
  ["“", "”"],
  ["‘", "’"],
  ['"', '"'],
  ["'", "'"],
];
const LEADING_VERSE_NUMBER = /^\d{1,3}(?:[.、:：]\s*|\s+)(?=[㐀-鿿\u{20000}-\u{2fa1f}])/u;

/** 清理使用者輸入：NFC、去外層引號、去掉複製經文時帶入的節號。 */
export function cleanSearchQuery(raw: string): string {
  let value = raw.normalize("NFC").trim();
  for (let guard = 0; guard < 16; guard++) {
    const before = value;
    for (const [open, close] of QUOTE_PAIRS) {
      if (value.length >= 2 && value.startsWith(open) && value.endsWith(close)) {
        value = value.slice(open.length, value.length - close.length).trim();
        break;
      }
    }
    value = value.replace(LEADING_VERSE_NUMBER, "").trim();
    if (value === before) break;
  }
  return value;
}

export function normalizeStrict(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

// ---------------------------------------------------------------------------
// 折疊表（只建一次）
// ---------------------------------------------------------------------------

const charFold = new Map<string, string>(Object.entries(CHAR_FOLD_MAP));

/** 詞組表以首字建索引、長的先試，大部分字元一次查表就結束。 */
const phraseByFirst = new Map<string, Array<{ chars: string[]; replacement: string[] }>>();
for (const [key, value] of Object.entries(SIMPLIFIED_PHRASE_MAP)) {
  const chars = Array.from(key);
  const replacement = Array.from(value);
  if (chars.length < 2 || chars.length !== replacement.length) continue;
  const list = phraseByFirst.get(chars[0]!) ?? [];
  list.push({ chars, replacement });
  phraseByFirst.set(chars[0]!, list);
}
for (const list of phraseByFirst.values()) list.sort((a, b) => b.chars.length - a.chars.length);

const properKeys = Object.keys(PROPER_AND_EDITION_EQUIVALENTS);
const maxProperLength = properKeys.reduce((max, key) => Math.max(max, key.length), 0);

/** BMP 單字的快速旗標：絕大多數字元不在詞組首字／折疊表裡，查旗標比查 Map 便宜。 */
const phraseFirstFlags = new Uint8Array(0x10000);
const foldFlags = new Uint8Array(0x10000);
for (const key of phraseByFirst.keys())
  if (key.length === 1) phraseFirstFlags[key.charCodeAt(0)] = 1;
for (const key of charFold.keys()) if (key.length === 1) foldFlags[key.charCodeAt(0)] = 1;

function applyPhrases(atoms: string[]): void {
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]!;
    if (atom.length === 1 && phraseFirstFlags[atom.charCodeAt(0)] === 0) continue;
    const candidates = phraseByFirst.get(atom);
    if (!candidates) continue;
    for (const { chars, replacement } of candidates) {
      if (i + chars.length > atoms.length) continue;
      let same = true;
      for (let k = 1; k < chars.length; k++) {
        if (atoms[i + k] !== chars[k]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      for (let k = 0; k < chars.length; k++) atoms[i + k] = replacement[k]!;
      i += chars.length - 1;
      break;
    }
  }
}

function isIgnorable(atom: string): boolean {
  if (atom.length === 1) {
    const code = atom.charCodeAt(0);
    if (code >= 0x3400 && code <= 0x9fff) return false;
    if ((code >= 0x61 && code <= 0x7a) || (code >= 0x30 && code <= 0x39)) return false;
    if (code <= 0x20 || code === 0x3000) return true;
    return IGNORABLE_CHARS.has(atom);
  }
  if (IGNORABLE_CHARS.has(atom)) return true;
  if (atom.length > 8) return false;
  if (WHITESPACE.test(atom)) return true;
  for (const char of atom) if (!IGNORABLE_CHARS.has(char) && !WHITESPACE.test(char)) return false;
  return true;
}

function lower(atom: string): string {
  const code = atom.charCodeAt(0);
  // 漢字／假名／全形標點不需要轉小寫
  if ((code >= 0x3000 && code < 0xff00) || (code >= 0xd840 && code <= 0xd87f)) return atom;
  return atom.toLowerCase();
}

/** 切成「字」：一般情況逐 code point；有組合符號／表情符號時才用 grapheme。 */
function atomize(text: string, withPositions: boolean): { atoms: string[]; starts: number[] } {
  const atoms: string[] = [];
  const starts: number[] = [];
  if (needsSegmenter(text) || text !== text.normalize("NFC")) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    for (const { segment, index } of segmenter.segment(text)) {
      atoms.push(segment.normalize("NFC"));
      starts.push(index);
    }
    return { atoms, starts };
  }
  let position = 0;
  for (const char of text) {
    atoms.push(char);
    if (withPositions) starts.push(position);
    position += char.length;
  }
  return { atoms, starts };
}

export function getNoteRanges(text: string): TextRange[] {
  if (!NOTE_TRIGGER.test(text)) return [];
  const ranges: TextRange[] = [];
  for (const match of text.matchAll(NOTE_PATTERN)) {
    ranges.push({ start: match.index!, end: match.index! + match[0].length });
  }
  return ranges;
}

/**
 * 建立正規化投影。
 * strictLiteral：只做 NFC + 小寫，保留標點與異體字。
 * 相容模式：詞組／單字折疊、小寫，並略過標點與空白；stripNotes 時另外略過行內譯註。
 */
export function buildProjection(
  text: string,
  strictLiteral = false,
  options: ProjectionOptions = {},
): TextProjection {
  const withRanges = options.ranges === true;
  const lineBreaks = options.lineBreaks === true && !strictLiteral;
  if (!strictLiteral && !withRanges && !options.stripNotes && !needsSegmenter(text)) {
    return { norm: fastNorm(text, lineBreaks), unitRanges: [], notes: [] };
  }
  const { atoms, starts } = atomize(text, true);
  const lowered = atoms.map(lower);
  const notes = !strictLiteral && options.stripNotes ? getNoteRanges(text) : [];

  if (!strictLiteral) {
    applyPhrases(lowered);
    for (let i = 0; i < lowered.length; i++) {
      const folded = charFold.get(lowered[i]!);
      if (folded !== undefined) lowered[i] = folded;
    }
    applyPhrases(lowered);
  }

  const pieces: string[] = [];
  const unitRanges: TextRange[] = [];
  let noteIndex = 0;
  for (let i = 0; i < lowered.length; i++) {
    const piece = lowered[i]!;
    const start = starts[i]!;
    if (!strictLiteral) {
      while (noteIndex < notes.length && notes[noteIndex]!.end <= start) noteIndex++;
      const note = notes[noteIndex];
      if (note && start >= note.start && start < note.end) continue;
      if (lineBreaks && (piece === "\n" || piece === "\r\n")) {
        if (pieces.length > 0 && pieces[pieces.length - 1] !== "\n") {
          pieces.push("\n");
          if (withRanges)
            unitRanges.push({ start, end: i + 1 < starts.length ? starts[i + 1]! : text.length });
        }
        continue;
      }
      if (isIgnorable(piece)) continue;
    }
    pieces.push(piece);
    if (withRanges) {
      const range = { start, end: i + 1 < starts.length ? starts[i + 1]! : text.length };
      for (let unit = 0; unit < piece.length; unit++) unitRanges.push(range);
    }
  }
  return { norm: pieces.join(""), unitRanges, notes };
}

/** 相容模式、不要位置、不略過譯註時的快速路徑：結果與一般路徑相同，但不建 starts／範圍陣列。 */
/** 通用版（以字串 atom 處理）：快速路徑遇到罕見字元（孤立代理、特殊小寫）時退回這裡；測試用它對照。 */
export function generalNorm(text: string, lineBreaks: boolean): string {
  const source = text !== text.normalize("NFC") ? text.normalize("NFC") : text;
  const atoms = Array.from(source);
  for (let i = 0; i < atoms.length; i++) atoms[i] = lower(atoms[i]!);
  applyPhrases(atoms);
  for (let i = 0; i < atoms.length; i++) {
    const atom = atoms[i]!;
    if (atom.length === 1 && foldFlags[atom.charCodeAt(0)] === 0) continue;
    const folded = charFold.get(atom);
    if (folded !== undefined) atoms[i] = folded;
  }
  applyPhrases(atoms);
  let out = "";
  for (let i = 0; i < atoms.length; i++) {
    const piece = atoms[i]!;
    if (lineBreaks && piece === "\n") {
      if (out !== "" && out.charCodeAt(out.length - 1) !== 10) out += "\n";
      continue;
    }
    if (!isIgnorable(piece)) out += piece;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 快速路徑：全程用 code point 陣列，一次掃描、不配置每字一個字串
// ---------------------------------------------------------------------------

type CpPhrase = { chars: number[]; replacement: number[] };
const cpPhraseByFirst = new Map<number, CpPhrase[]>();
for (const [first, list] of phraseByFirst) {
  cpPhraseByFirst.set(
    first.codePointAt(0)!,
    list.map(({ chars, replacement }) => ({
      chars: chars.map((c) => c.codePointAt(0)!),
      replacement: replacement.map((c) => c.codePointAt(0)!),
    })),
  );
}
/** 折疊表只有「單一 code point → 單一 code point」；BMP 用陣列（0 = 無），其餘用 Map。 */
const foldBmp = new Int32Array(0x10000);
const foldAstral = new Map<number, number>();
let foldIsSimple = true;
for (const [key, value] of charFold) {
  const from = Array.from(key);
  const to = Array.from(value);
  if (from.length !== 1 || to.length !== 1) {
    foldIsSimple = false;
    continue;
  }
  const fromCp = from[0]!.codePointAt(0)!;
  if (fromCp < 0x10000) foldBmp[fromCp] = to[0]!.codePointAt(0)!;
  else foldAstral.set(fromCp, to[0]!.codePointAt(0)!);
}
/** 小寫快取：0 = 尚未算、-1 = 小寫後不是單一單元（退回通用版）、其餘為 小寫單元 + 1。 */
const lowerCache = new Int32Array(0x10000);
/** 略過字元快取：0 = 尚未算、1 = 保留、2 = 略過。 */
const ignorableCache = new Uint8Array(0x10000);

function applyPhrasesCp(atoms: Int32Array, length: number): void {
  for (let i = 0; i < length; i++) {
    const first = atoms[i]!;
    if (first < 0x10000 && phraseFirstFlags[first] === 0) continue;
    const candidates = cpPhraseByFirst.get(first);
    if (!candidates) continue;
    for (const { chars, replacement } of candidates) {
      if (i + chars.length > length) continue;
      let same = true;
      for (let k = 1; k < chars.length; k++) {
        if (atoms[i + k] !== chars[k]) {
          same = false;
          break;
        }
      }
      if (!same) continue;
      for (let k = 0; k < chars.length; k++) atoms[i + k] = replacement[k]!;
      i += chars.length - 1;
      break;
    }
  }
}

export function fastNorm(text: string, lineBreaks: boolean): string {
  const source = text !== text.normalize("NFC") ? text.normalize("NFC") : text;
  const length = source.length;
  const atoms = new Int32Array(length);
  let count = 0;
  let phraseSeen = false;

  // 1) 切成 code point 並轉小寫（漢字／假名／全形標點不轉）
  for (let i = 0; i < length; i++) {
    let code = source.charCodeAt(i);
    if (code < 0x80) {
      if (code >= 0x41 && code <= 0x5a) code += 32;
    } else if (code >= 0x3000 && code < 0xff00) {
      // 漢字／假名／全形標點不轉小寫；代理對合成一個 code point（Plane-2 等，與通用版一樣不轉小寫）
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < length) {
        const low = source.charCodeAt(i + 1);
        if (low >= 0xdc00 && low <= 0xdfff) {
          atoms[count++] = ((code - 0xd800) << 10) + (low - 0xdc00) + 0x10000;
          i++;
          continue;
        }
      }
    } else {
      let cached = lowerCache[code]!;
      if (cached === 0) {
        const lowered = String.fromCharCode(code).toLowerCase();
        cached = lowered.length === 1 ? lowered.charCodeAt(0) + 1 : -1;
        lowerCache[code] = cached;
      }
      if (cached < 0) return generalNorm(source, lineBreaks);
      code = cached - 1;
    }
    if (code < 0x10000 && phraseFirstFlags[code] === 1) phraseSeen = true;
    atoms[count++] = code;
  }
  if (!foldIsSimple) return generalNorm(source, lineBreaks);

  // 2) 詞組 → 單字折疊 → 詞組（與通用版相同順序）
  if (phraseSeen) applyPhrasesCp(atoms, count);
  let phraseAgain = phraseSeen;
  for (let i = 0; i < count; i++) {
    const code = atoms[i]!;
    let folded: number | undefined;
    if (code < 0x10000) {
      if (foldFlags[code] === 0) continue;
      folded = foldBmp[code];
      if (folded === 0) continue;
    } else {
      folded = foldAstral.get(code);
      if (folded === undefined) continue;
    }
    atoms[i] = folded!;
    if (folded! < 0x10000 && phraseFirstFlags[folded!] === 1) phraseAgain = true;
  }
  if (phraseAgain) applyPhrasesCp(atoms, count);

  // 3) 略過標點／空白，換行視需要保留成單一換行，輸出 UTF-16 單元
  const out = new Uint16Array(count * 2);
  let outLength = 0;
  for (let i = 0; i < count; i++) {
    const code = atoms[i]!;
    if (code >= 0x10000) {
      const offset = code - 0x10000;
      out[outLength++] = 0xd800 + (offset >> 10);
      out[outLength++] = 0xdc00 + (offset & 0x3ff);
      continue;
    }
    if (code === 10 && lineBreaks) {
      if (outLength > 0 && out[outLength - 1] !== 10) out[outLength++] = 10;
      continue;
    }
    let state = ignorableCache[code]!;
    if (state === 0) {
      state = isIgnorable(String.fromCharCode(code)) ? 2 : 1;
      ignorableCache[code] = state;
    }
    if (state === 1) out[outLength++] = code;
  }
  if (outLength < 8192) return String.fromCharCode(...out.subarray(0, outLength));
  let result = "";
  for (let i = 0; i < outLength; i += 8192) {
    result += String.fromCharCode(...out.subarray(i, Math.min(i + 8192, outLength)));
  }
  return result;
}

// ---------------------------------------------------------------------------
// 查詢展開
// ---------------------------------------------------------------------------

const expansionCache = new Map<string, readonly string[]>();

function foldQuery(term: string): string {
  return buildProjection(term, false).norm;
}

/** 把一個詞展開成可比對的寫法（折疊後的原詞在前，再加專有名詞／版本差異寫法，最多 8 個）。 */
export function expandCompatibleTerms(term: string, strictLiteral = false): string[] {
  if (strictLiteral) {
    const strict = normalizeStrict(term);
    return strict ? [strict] : [];
  }
  const cached = expansionCache.get(term);
  if (cached) return [...cached];

  const folded = foldQuery(term);
  let variants: string[] = folded ? [folded] : [];
  if (folded) {
    const segments: string[][] = [];
    let literal = "";
    let i = 0;
    while (i < folded.length) {
      let matched: string | null = null;
      for (let length = Math.min(maxProperLength, folded.length - i); length >= 2; length--) {
        const key = folded.slice(i, i + length);
        if (Object.hasOwn(PROPER_AND_EDITION_EQUIVALENTS, key)) {
          matched = key;
          break;
        }
      }
      if (matched === null) {
        literal += folded[i];
        i++;
        continue;
      }
      if (literal) segments.push([literal]);
      literal = "";
      const alternatives = PROPER_AND_EDITION_EQUIVALENTS[matched]!.map(foldQuery).filter(Boolean);
      segments.push([matched, ...alternatives.filter((alt) => alt !== matched)]);
      i += matched.length;
    }
    if (literal) segments.push([literal]);

    variants = [""];
    for (const options of segments) {
      const next: string[] = [];
      for (const prefix of variants) {
        for (const option of options) {
          next.push(prefix + option);
          if (next.length >= MAX_EXPANSIONS * 4) break;
        }
      }
      variants = next;
    }
    variants = [...new Set(variants)].slice(0, MAX_EXPANSIONS);
  }
  expansionCache.set(term, variants);
  return [...variants];
}

// ---------------------------------------------------------------------------
// 比對
// ---------------------------------------------------------------------------

/** 命中 [from, to]（norm 單元，含）對回原文；若中間隔著被略過的譯註就切成多段。 */
function rangesForUnits(projection: TextProjection, from: number, to: number): TextRange[] {
  const { unitRanges, notes } = projection;
  const result: TextRange[] = [];
  let current: TextRange = { ...unitRanges[from]! };
  for (let unit = from + 1; unit <= to; unit++) {
    const next = unitRanges[unit]!;
    if (next.start === unitRanges[unit - 1]!.start) continue; // 同一個字的後半（代理對）
    const hasNoteBetween = notes.some(
      (note) => note.start >= current.end && note.end <= next.start,
    );
    if (hasNoteBetween) {
      result.push(current);
      current = { ...next };
    } else {
      current.end = Math.max(current.end, next.end);
    }
  }
  result.push(current);
  return result;
}

function collectRanges(projection: TextProjection, variants: readonly string[]): TextRange[] {
  const ranges: TextRange[] = [];
  for (const variant of variants) {
    if (!variant) continue;
    let index = projection.norm.indexOf(variant);
    while (index !== -1) {
      ranges.push(...rangesForUnits(projection, index, index + variant.length - 1));
      index = projection.norm.indexOf(variant, index + 1);
    }
  }
  return ranges;
}

export function mergeRanges(ranges: TextRange[]): TextRange[] {
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: TextRange[] = [];
  for (const range of sorted) {
    const last = merged.at(-1);
    if (last && range.start < last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }
  return merged;
}

/** 回傳原文上排序、合併、不重疊的 UTF-16 範圍。 */
export function findTextMatchRanges(
  text: string,
  terms: readonly string[],
  strictLiteral = false,
): TextRange[] {
  const variants = terms.flatMap((term) => expandCompatibleTerms(term, strictLiteral));
  if (variants.length === 0 || text === "") return [];

  const tracks = [buildProjection(text, strictLiteral, { ranges: true })];
  if (!strictLiteral && NOTE_TRIGGER.test(text)) {
    const stripped = buildProjection(text, false, { ranges: true, stripNotes: true });
    if (stripped.notes.length > 0) tracks.push(stripped);
  }
  return mergeRanges(tracks.flatMap((track) => collectRanges(track, variants)));
}

/** 只問「有沒有命中」，不需要位置。 */
export function textIncludesAny(norms: readonly string[], variants: readonly string[]): boolean {
  return variants.some((variant) => variant !== "" && norms.some((norm) => norm.includes(variant)));
}

/** 比對用的正規化全文（相容模式含略過譯註的第二軌）。 */
export function buildSearchNorms(text: string, strictLiteral = false): string[] {
  const norms = [buildProjection(text, strictLiteral).norm];
  if (!strictLiteral && NOTE_TRIGGER.test(text)) {
    const stripped = buildProjection(text, false, { stripNotes: true });
    if (stripped.notes.length > 0) norms.push(stripped.norm);
  }
  return norms;
}
