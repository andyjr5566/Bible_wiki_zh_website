import { BRIDGE_TERMS, PROTECTED_TA_PROPER_NAMES } from "../data/compatData";
import {
  buildSearchNorms,
  cleanSearchQuery,
  expandCompatibleTerms,
  findTextMatchRanges,
  normalizeStrict,
  textIncludesAny,
  type TextRange,
} from "./textMatcher";

export interface PreparedVerse {
  readonly id: string;
  readonly slug: string;
  readonly book: string;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

/** Flatten the build index in canonical order, keeping the original display text. */
export function prepareVerseIndex(payload: unknown): PreparedVerse[] {
  if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.chapters)) {
    throw new Error("Invalid verse index");
  }

  const rows: PreparedVerse[] = [];
  const seen = new Set<string>();
  for (const entry of payload.chapters as unknown[]) {
    if (!isRecord(entry)) throw new Error("Invalid chapter in verse index");
    const { slug, book, chapter, start, verses } = entry;
    if (
      typeof slug !== "string" ||
      !/^\d{2}-[^/?#\\]+\/第\d+章$/.test(slug) ||
      seen.has(slug) ||
      typeof book !== "string" ||
      !book.trim() ||
      !isPositiveInteger(chapter) ||
      !slug.endsWith(`/第${chapter}章`) ||
      !isPositiveInteger(start) ||
      !Array.isArray(verses) ||
      !verses.length ||
      !Number.isSafeInteger(start + verses.length - 1)
    ) {
      throw new Error("Invalid chapter in verse index");
    }

    seen.add(slug);
    for (const [offset, text] of (verses as unknown[]).entries()) {
      if (typeof text !== "string" || !text.trim()) throw new Error("Invalid text in verse index");
      const verse = start + offset;
      rows.push({ id: `${slug}#v${verse}`, slug, book, chapter, verse, text });
    }
  }
  return rows;
}

export function normalizeVerseSearchTerm(term: string): string {
  return normalizeStrict(term.trim());
}

const CJK_CHAR = /[㐀-鿿\u{20000}-\u{2fa1f}]/u;
const CJK_SPLIT = /[^㐀-鿿\u{20000}-\u{2fa1f}]+/u;

/** 每個輸入詞先清理，再依空白拆成各自獨立的條件（同一節要全部出現）。 */
function splitWords(terms: readonly string[]): string[] {
  return terms.flatMap((term) => cleanSearchQuery(term).split(/\s+/).filter(Boolean));
}

/** 每一節預先算好的比對全文；31,102 節只算一次。 */
const compatNorms = new WeakMap<PreparedVerse, string[]>();
const strictNorms = new WeakMap<PreparedVerse, string>();

function getCompatNorms(verse: PreparedVerse): string[] {
  let norms = compatNorms.get(verse);
  if (!norms) {
    norms = buildSearchNorms(verse.text, false);
    compatNorms.set(verse, norms);
  }
  return norms;
}

function getStrictNorm(verse: PreparedVerse): string {
  let norm = strictNorms.get(verse);
  if (norm === undefined) {
    norm = normalizeStrict(verse.text);
    strictNorms.set(verse, norm);
  }
  return norm;
}

/** Every active condition must occur in the same verse. 預設為相容比對；strictLiteral 為嚴格字面。 */
export function searchVerses(
  verses: readonly PreparedVerse[],
  terms: readonly string[],
  strictLiteral = false,
): PreparedVerse[] {
  const conditions: string[][] = [];
  const seen = new Set<string>();
  for (const word of splitWords(terms)) {
    const variants = expandCompatibleTerms(word, strictLiteral);
    const key = variants.join("\u0000");
    if (variants.length === 0 || seen.has(key)) continue;
    seen.add(key);
    conditions.push(variants);
  }
  if (conditions.length === 0) return [];
  return verses.filter((verse) => {
    const norms = strictLiteral ? [getStrictNorm(verse)] : getCompatNorms(verse);
    return conditions.every((variants) => textIncludesAny(norms, variants));
  });
}

/** Return ordered, nonoverlapping UTF-16 ranges for the original display text. */
export function getVerseMatchRanges(
  text: string,
  terms: readonly string[],
  strictLiteral = false,
): TextRange[] {
  return findTextMatchRanges(text, splitWords(terms), strictLiteral);
}

// ---------------------------------------------------------------------------
// Layer 2：零命中時自動改寫
// ---------------------------------------------------------------------------

export interface AutoRewriteNotice {
  readonly originalQuery: string;
  readonly rewrittenQuery: string;
  readonly message: string;
}

export interface VerseSearchExecution {
  readonly hits: PreparedVerse[];
  readonly effectiveTerms: string[];
  readonly autoRewrite: AutoRewriteNotice | null;
  readonly suggestions: string[];
}

const protectedNamePattern = new RegExp(`(${PROTECTED_TA_PROPER_NAMES.join("|")})`);

function rewriteTerm(term: string): { text: string; god: boolean } {
  let text = term;
  let god = false;
  if (text.includes("上帝")) {
    text = text.replaceAll("上帝", "神");
    god = true;
  }
  if (Array.from(text).length >= 2) {
    text = text
      .split(protectedNamePattern)
      .map((part, index) =>
        index % 2 === 1 ? part : part.replace(/[祂她牠它]/g, "他").replace(/[妳您祢袮]/g, "你"),
      )
      .join("");
  }
  return { text, god };
}

export function searchVersesWithRewrite(
  verses: readonly PreparedVerse[],
  rawTerms: readonly string[],
  strictLiteral = false,
  related?: RelatedWordTable,
): VerseSearchExecution {
  const hits = searchVerses(verses, rawTerms, strictLiteral);
  const direct: VerseSearchExecution = {
    hits,
    effectiveTerms: [...rawTerms],
    autoRewrite: null,
    suggestions: getVerseSearchSuggestions(
      rawTerms[0] ?? "",
      verses,
      strictLiteral,
      hits.length,
      related,
    ),
  };
  if (hits.length > 0 || strictLiteral) return direct;

  const cleaned = splitWords(rawTerms);
  const rewritten = cleaned.map(rewriteTerm);
  const rewrittenTerms = rewritten.map(({ text }) => text);
  if (rewrittenTerms.every((text, index) => text === cleaned[index])) return direct;

  const rewrittenHits = searchVerses(verses, rewrittenTerms, false);
  if (rewrittenHits.length === 0) return direct;

  const display = rewrittenTerms.join(" ");
  const usedGod = rewritten.some(({ god }) => god);
  return {
    hits: rewrittenHits,
    effectiveTerms: rewrittenTerms,
    autoRewrite: {
      originalQuery: cleaned.join(" "),
      rewrittenQuery: display,
      message: usedGod
        ? `本站為和合本神版，以下顯示「${display}」的對應經文`
        : `本站和合本寫作「${display}」，以下顯示對應經文`,
    },
    suggestions: [],
  };
}

// ---------------------------------------------------------------------------
// 建議詞
// ---------------------------------------------------------------------------

// 代名詞是規則（本站和合本一律寫「他」「你」），留在程式裡；
// 詞彙對照（意念↔思想…）是資料，放在 quartz/data/verse-search-related.json，建置時隨 hints 送來。
const STATIC_SUGGESTIONS = new Map<string, readonly string[]>([
  ["祂", ["他"]],
  ["她", ["他"]],
  ["牠", ["他"]],
  ["它", ["他"]],
  ["妳", ["你"]],
  ["您", ["你"]],
  ["祢", ["你"]],
  ["袮", ["你"]],
]);

/** 詞 → 本站和合本（1919）的寫法。 */
export type RelatedWordTable = Readonly<Record<string, readonly string[]>>;

const relatedLookups = new WeakMap<RelatedWordTable, Map<string, readonly string[]>>();

/** 鍵一律用和查詢相同的正規化，這樣大小寫、全半形等差異不會讓詞表查不到。 */
function lookupRelated(related: RelatedWordTable, normalizedQuery: string): readonly string[] {
  let lookup = relatedLookups.get(related);
  if (!lookup) {
    lookup = new Map();
    for (const [key, words] of Object.entries(related)) {
      const normalized = normalizeVerseSearchTerm(key);
      lookup.set(normalized, [...(lookup.get(normalized) ?? []), ...words]);
    }
    relatedLookups.set(related, lookup);
  }
  return lookup.get(normalizedQuery) ?? [];
}

const MAX_RETRY_CHIPS = 3;
const LONG_QUERY_LENGTH = 9;

function splitIntoShortPhrases(query: string): string[] {
  const phrases: string[] = [];
  for (const piece of query.split(CJK_SPLIT)) {
    const chars = Array.from(piece);
    if (chars.length < 2) continue;
    if (chars.length <= 4) {
      phrases.push(piece);
      continue;
    }
    for (let i = 0; i < chars.length; i += 4) {
      const chunk = chars.slice(i, i + 4);
      if (chunk.length >= 2) phrases.push(chunk.join(""));
    }
  }
  return phrases;
}

export function getVerseSearchSuggestions(
  query: string,
  verses?: readonly PreparedVerse[],
  strictLiteral = false,
  knownHitCount?: number,
  related?: RelatedWordTable,
): string[] {
  const cleaned = cleanSearchQuery(query);
  const suggestions = new Set<string>();
  const hasHits = (term: string) =>
    !verses || searchVerses(verses, [term], strictLiteral).length > 0;
  const normalizedQuery = normalizeVerseSearchTerm(cleaned);

  const candidates = [
    ...(STATIC_SUGGESTIONS.get(normalizedQuery) ?? []),
    ...(related ? lookupRelated(related, normalizedQuery) : []),
  ];
  for (const word of candidates) {
    if (hasHits(word)) suggestions.add(word);
  }

  const folded = expandCompatibleTerms(cleaned, false)[0];
  if (folded) {
    for (const rule of BRIDGE_TERMS) {
      if (expandCompatibleTerms(rule.query, false)[0] !== folded) continue;
      for (const term of rule.cuvTerms) {
        if (term !== cleaned && hasHits(term)) suggestions.add(term);
      }
    }
  }

  if (
    verses &&
    Array.from(cleaned).filter((char) => CJK_CHAR.test(char)).length >= LONG_QUERY_LENGTH
  ) {
    const hitCount = knownHitCount ?? searchVerses(verses, [cleaned], strictLiteral).length;
    if (hitCount === 0) {
      const chips: string[] = [];
      for (const phrase of splitIntoShortPhrases(cleaned)) {
        if (chips.length >= MAX_RETRY_CHIPS) break;
        if (!chips.includes(phrase) && searchVerses(verses, [phrase], strictLiteral).length > 0) {
          chips.push(phrase);
        }
      }
      for (const chip of chips) suggestions.add(chip);
    }
  }

  suggestions.delete(cleaned);
  return [...suggestions];
}

// ---------------------------------------------------------------------------
// 單節釘選：其他譯本的用字在本站和合本裡對不上時，人工指出「這一節就是你要找的」
// ---------------------------------------------------------------------------

export interface VersePin {
  readonly query: string;
  readonly id: string;
  readonly cuv: string;
}

export interface VerseSearchHints {
  readonly related: RelatedWordTable;
  readonly pins: readonly VersePin[];
}

/** 建置產物的格式檢查；格式不對就當作沒有提示，經文搜尋照常運作。 */
export function parseVerseSearchHints(payload: unknown): VerseSearchHints | null {
  if (!isRecord(payload) || payload.version !== 1) return null;
  const related: Record<string, string[]> = {};
  if (isRecord(payload.related)) {
    for (const [key, words] of Object.entries(payload.related)) {
      if (!Array.isArray(words)) continue;
      const list = words.filter((word): word is string => typeof word === "string" && !!word);
      if (list.length > 0) related[key] = list;
    }
  }
  const pins: VersePin[] = [];
  if (Array.isArray(payload.pins)) {
    for (const pin of payload.pins as unknown[]) {
      if (
        isRecord(pin) &&
        typeof pin.query === "string" &&
        typeof pin.id === "string" &&
        typeof pin.cuv === "string" &&
        pin.query &&
        pin.cuv
      ) {
        pins.push({ query: pin.query, id: pin.id, cuv: pin.cuv });
      }
    }
  }
  return { related, pins };
}

export interface PinnedVerse {
  readonly verse: PreparedVerse;
  readonly cuv: string;
}

export interface PinSelectionOptions {
  readonly strictLiteral?: boolean;
  readonly hasRefinements?: boolean;
}

/**
 * 查詢詞有釘選的經節、而且還不在直接命中裡，就回傳那些經節。
 * 嚴格字面比對或加了再查條件時不使用釘選（使用者要的是精確結果）。
 */
export function selectPinnedVerses(
  verses: readonly PreparedVerse[],
  pins: readonly VersePin[],
  rawQuery: string,
  directHitIds: ReadonlySet<string>,
  { strictLiteral = false, hasRefinements = false }: PinSelectionOptions = {},
): PinnedVerse[] {
  if (strictLiteral || hasRefinements || pins.length === 0) return [];
  const query = normalizeVerseSearchTerm(cleanSearchQuery(rawQuery));
  if (!query) return [];
  const verseMap = getVerseMap(verses);
  const seen = new Set<string>();
  const selected: PinnedVerse[] = [];
  for (const pin of pins) {
    if (normalizeVerseSearchTerm(pin.query) !== query) continue;
    const verse = verseMap.get(pin.id);
    if (!verse || directHitIds.has(pin.id) || seen.has(pin.id)) continue;
    seen.add(pin.id);
    selected.push({ verse, cuv: pin.cuv });
  }
  return selected;
}

// ---------------------------------------------------------------------------
// Layer 3：原文研讀區塊
// ---------------------------------------------------------------------------

export interface VerseOriginalEntryLink {
  readonly slug: string;
  readonly title: string;
  readonly isOriginalEntry: boolean;
}

export interface VerseOriginalIndex {
  readonly version: 1;
  readonly attribution: string;
  readonly lexicon: Readonly<
    Record<
      string,
      readonly [lemma: string, translit: string, zhGloss: string, topRenderings: readonly string[]]
    >
  >;
  readonly chapters: Readonly<
    Record<
      string,
      Readonly<Record<string, ReadonlyArray<readonly [strongId: string, rendering: string]>>>
    >
  >;
  readonly entries?: Readonly<Record<string, VerseOriginalEntryLink>>;
  readonly entryAliases?: Readonly<Record<string, readonly string[]>>;
}

export interface OriginalStudyVerseHit {
  readonly verse: PreparedVerse;
  readonly rendering: string;
}

export interface OriginalStudyGroup {
  readonly lemma: string;
  readonly translit: string;
  readonly zhGloss: string;
  readonly distinctRenderings: string[];
  readonly hits: OriginalStudyVerseHit[];
  readonly entryLink: VerseOriginalEntryLink | null;
  readonly autoOpen: boolean;
}

export const ORIGINAL_STUDY_ATTRIBUTION = "原文資料：STEP Bible（CC BY 4.0）";
const MAX_ORIGINAL_QUERY_LENGTH = 8;
const MAX_ORIGINAL_GROUPS = 3;

interface StrongOccurrence {
  slug: string;
  verse: number;
  rendering: string;
}

interface OriginalIndexLookup {
  byStrong: Map<string, StrongOccurrence[]>;
  byRendering: Map<string, Set<string>>;
}

const lookupCache = new WeakMap<VerseOriginalIndex, OriginalIndexLookup>();
const verseMapCache = new WeakMap<readonly PreparedVerse[], Map<string, PreparedVerse>>();

function foldOne(text: string): string {
  return expandCompatibleTerms(text, false)[0] ?? "";
}

function getLookup(index: VerseOriginalIndex): OriginalIndexLookup {
  let lookup = lookupCache.get(index);
  if (lookup) return lookup;
  const byStrong = new Map<string, StrongOccurrence[]>();
  const byRendering = new Map<string, Set<string>>();
  const addRendering = (rendering: string, strongId: string) => {
    const key = foldOne(rendering);
    if (!key) return;
    let ids = byRendering.get(key);
    if (!ids) byRendering.set(key, (ids = new Set()));
    ids.add(strongId);
  };
  for (const [strongId, row] of Object.entries(index.lexicon)) {
    for (const rendering of row[3] ?? []) addRendering(rendering, strongId);
  }
  for (const [slug, verseMap] of Object.entries(index.chapters)) {
    for (const [verseKey, words] of Object.entries(verseMap)) {
      const verse = Number(verseKey);
      for (const [strongId, rendering] of words) {
        if (!(strongId in index.lexicon)) continue;
        let list = byStrong.get(strongId);
        if (!list) byStrong.set(strongId, (list = []));
        list.push({ slug, verse, rendering });
        addRendering(rendering, strongId);
      }
    }
  }
  lookup = { byStrong, byRendering };
  lookupCache.set(index, lookup);
  return lookup;
}

function getVerseMap(verses: readonly PreparedVerse[]): Map<string, PreparedVerse> {
  let map = verseMapCache.get(verses);
  if (!map) {
    map = new Map(verses.map((verse) => [verse.id, verse]));
    verseMapCache.set(verses, map);
  }
  return map;
}

/**
 * 以原文詞為單位，找出同一個原文詞在本站其他經文中的譯法。
 * 單字查詢（例如「愛」）只在橋接詞／別名命中時才展開，避免一個詞帶出上千節。
 */
export function findOriginalLanguageStudyGroups(
  verses: readonly PreparedVerse[],
  originalIndex: VerseOriginalIndex | null,
  rawQuery: string,
  directHitIds: ReadonlySet<string>,
): OriginalStudyGroup[] {
  if (!originalIndex) return [];
  const query = cleanSearchQuery(rawQuery);
  const foldedQuery = query ? foldOne(query) : "";
  if (!foldedQuery) return [];

  const exact = new Set<string>();
  const byRenderingMatch = new Set<string>();
  const targets = new Set([foldedQuery]);
  for (const bridge of BRIDGE_TERMS) {
    if (foldOne(bridge.query) !== foldedQuery) continue;
    for (const id of bridge.strongIds) if (id in originalIndex.lexicon) exact.add(id);
    for (const term of bridge.cuvTerms) targets.add(foldOne(term));
  }
  for (const value of originalIndex.entryAliases?.[query.toLowerCase()] ?? []) {
    if (value in originalIndex.lexicon) exact.add(value);
    for (const [id, link] of Object.entries(originalIndex.entries ?? {})) {
      if (link.slug === value && id in originalIndex.lexicon) exact.add(id);
    }
  }

  const lookup = getLookup(originalIndex);
  if (exact.size === 0) {
    const length = Array.from(query).length;
    if (length > MAX_ORIGINAL_QUERY_LENGTH || length < 2) return [];
    for (const id of lookup.byRendering.get(foldedQuery) ?? []) byRenderingMatch.add(id);
  }

  const verseMap = getVerseMap(verses);
  const groups: Array<{ group: OriginalStudyGroup; isExact: boolean; ratio: number }> = [];
  for (const strongId of new Set([...exact, ...byRenderingMatch])) {
    const row = originalIndex.lexicon[strongId];
    const occurrences = lookup.byStrong.get(strongId) ?? [];
    if (!row || occurrences.length === 0) continue;

    const seenVerses = new Set<string>();
    const hits: OriginalStudyVerseHit[] = [];
    let matching = 0;
    for (const { slug, verse, rendering } of occurrences) {
      if (targets.has(foldOne(rendering))) matching++;
      const id = `${slug}#v${verse}`;
      const prepared = verseMap.get(id);
      if (!prepared || seenVerses.has(id)) continue;
      if (directHitIds.size > 0 && directHitIds.has(id)) continue;
      seenVerses.add(id);
      hits.push({ verse: prepared, rendering });
    }
    if (hits.length === 0) continue;

    const counts = new Map<string, number>();
    for (const { rendering } of hits) counts.set(rendering, (counts.get(rendering) ?? 0) + 1);
    groups.push({
      group: {
        lemma: row[0],
        translit: row[1],
        zhGloss: row[2],
        distinctRenderings: [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([r]) => r),
        hits,
        entryLink: originalIndex.entries?.[strongId] ?? null,
        autoOpen: directHitIds.size === 0,
      },
      isExact: exact.has(strongId),
      ratio: matching / occurrences.length,
    });
  }

  return groups
    .sort(
      (a, b) =>
        Number(b.isExact) - Number(a.isExact) ||
        b.ratio - a.ratio ||
        b.group.hits.length - a.group.hits.length,
    )
    .slice(0, MAX_ORIGINAL_GROUPS)
    .map(({ group }) => group);
}
