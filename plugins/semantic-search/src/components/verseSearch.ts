export interface PreparedVerse {
  readonly id: string;
  readonly slug: string;
  readonly book: string;
  readonly chapter: number;
  readonly verse: number;
  readonly text: string;
}

interface VerseMatchRange {
  start: number;
  end: number;
}

const searchableText = new WeakMap<PreparedVerse, string>();
const searchableVariantText = new WeakMap<PreparedVerse, string>();

const searchSuggestions = new Map<string, readonly string[]>([
  ["妳", ["你"]],
  ["您", ["你"]],
  ["她", ["他"]],
  ["祂", ["他"]],
  ["它", ["他"]],
  ["牠", ["他"]],
  ["意念", ["思想"]],
  ["思想", ["意念"]],
]);

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

function normalizeVerseText(text: string): string {
  return text.normalize("NFC").toLowerCase();
}

export function normalizeVerseSearchTerm(term: string): string {
  return normalizeVerseText(term.trim());
}

function foldVerseVariants(text: string): string {
  return text.replaceAll("裏", "裡");
}

export function getVerseSearchSuggestions(term: string): string[] {
  return [...(searchSuggestions.get(normalizeVerseSearchTerm(term)) ?? [])];
}

function normalizeTerms(terms: readonly string[], matchVariants: boolean): string[] {
  const normalized = terms.map(normalizeVerseSearchTerm).filter(Boolean);
  return [...new Set(matchVariants ? normalized.map(foldVerseVariants) : normalized)];
}

function getSearchableVerse(verse: PreparedVerse, matchVariants: boolean): string {
  let text = searchableText.get(verse);
  if (text === undefined) {
    text = normalizeVerseText(verse.text);
    searchableText.set(verse, text);
  }
  if (!matchVariants) return text;

  let variantText = searchableVariantText.get(verse);
  if (variantText === undefined) {
    variantText = foldVerseVariants(text);
    searchableVariantText.set(verse, variantText);
  }
  return variantText;
}

/** Every active condition must occur in the same verse. */
export function searchVerses(
  verses: readonly PreparedVerse[],
  terms: readonly string[],
  matchVariants = false,
): PreparedVerse[] {
  const conditions = normalizeTerms(terms, matchVariants);
  if (conditions.length === 0) return [];
  return verses.filter((verse) => {
    const text = getSearchableVerse(verse, matchVariants);
    return conditions.every((term) => text.includes(term));
  });
}

/** Map normalized offsets back to original graphemes if NFC or case conversion changes length. */
function getOriginalOffsets(text: string): VerseMatchRange[] {
  const offsets: VerseMatchRange[] = [];
  const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
  for (const { segment, index } of segmenter.segment(text)) {
    const range = { start: index, end: index + segment.length };
    for (let index = 0; index < normalizeVerseText(segment).length; index++) offsets.push(range);
  }
  return offsets;
}

/** Return ordered, nonoverlapping UTF-16 ranges for the original display text. */
export function getVerseMatchRanges(
  text: string,
  terms: readonly string[],
  matchVariants = false,
): VerseMatchRange[] {
  const normalized = normalizeVerseText(text);
  const searchable = matchVariants ? foldVerseVariants(normalized) : normalized;
  const offsets =
    text.length !== normalized.length || text !== text.normalize("NFC")
      ? getOriginalOffsets(text)
      : undefined;
  const ranges: VerseMatchRange[] = [];

  for (const term of normalizeTerms(terms, matchVariants)) {
    let start = searchable.indexOf(term);
    while (start !== -1) {
      const end = start + term.length;
      ranges.push({ start: offsets?.[start]?.start ?? start, end: offsets?.[end - 1]?.end ?? end });
      start = searchable.indexOf(term, start + 1);
    }
  }

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: VerseMatchRange[] = [];
  for (const range of ranges) {
    const last = merged.at(-1);
    if (last && range.start < last.end) {
      last.end = Math.max(last.end, range.end);
    } else {
      merged.push(range);
    }
  }
  return merged;
}
