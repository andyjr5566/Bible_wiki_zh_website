/** Exact matching is intentionally skipped for one-character queries. */
export const MIN_EXACT_QUERY_LENGTH = 2;

export function shouldRunExactSearch(query: string): boolean {
  return query.trim().length >= MIN_EXACT_QUERY_LENGTH;
}

export interface ExactSearchItem {
  title?: string;
  content?: string;
  tags?: string[];
}

const EXCLUDED_SEARCH_BASENAMES = new Set([
  "index",
  "readme",
  "install-computer",
  "install-mobile",
  "license",
  "changelog",
  "contributing",
  "code-of-conduct",
]);

export function isSearchExcludedSlug(slug: string): boolean {
  const basename = slug
    .split(/[\\/]/)
    .filter(Boolean)
    .at(-1)
    ?.replace(/\.(?:md|html)$/i, "")
    .replace(/[_\s]+/g, "-")
    .toLowerCase();

  return basename ? EXCLUDED_SEARCH_BASENAMES.has(basename) : true;
}

/**
 * Exact search means the complete query occurs as one contiguous substring.
 * Do not split CJK queries into individual characters: "聖靈哈哈" must not
 * match a page that only contains "聖靈" or "哈哈".
 */
export function normalizeExactSearchText(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase();
}

export function containsExactSearchText(value: string, query: string): boolean {
  const normalizedQuery = normalizeExactSearchText(query.trim());
  if (normalizedQuery.length < MIN_EXACT_QUERY_LENGTH) return false;
  return normalizeExactSearchText(value).includes(normalizedQuery);
}

export function findExactMatchSlugs(
  items: Record<string, ExactSearchItem>,
  query: string,
): string[] {
  return Object.entries(items)
    .filter(([slug]) => !isSearchExcludedSlug(slug))
    .filter(([, item]) => {
      const searchableText = [item.title ?? "", item.content ?? "", ...(item.tags ?? [])].join(
        "\n",
      );
      return containsExactSearchText(searchableText, query);
    })
    .map(([slug]) => slug);
}

export type SlugKind = "chapter" | "entry" | "other";

export function getSlugKind(slug: string): SlugKind {
  if (/^\d\d-/.test(slug)) return "chapter";
  if (slug.startsWith("link_folder/")) return "entry";
  return "other";
}

function countNonOverlappingOccurrences(text: string, query: string): number {
  if (query.length === 0) return 0;

  let count = 0;
  let index = text.indexOf(query);
  while (index !== -1) {
    count++;
    index = text.indexOf(query, index + query.length);
  }
  return count;
}

interface RankedExactMatch {
  slug: string;
  tier: 0 | 1 | 2;
  count: number;
  kind: SlugKind;
}

function compareRankedMatches(a: RankedExactMatch, b: RankedExactMatch): number {
  if (a.count !== b.count) return b.count - a.count;

  const aIsChapter = a.kind === "chapter";
  const bIsChapter = b.kind === "chapter";
  if (aIsChapter !== bIsChapter) return aIsChapter ? 1 : -1;

  return a.slug.localeCompare(b.slug, "zh-Hant");
}

/** Rank complete exact matches by title quality, frequency, kind, and slug. */
export function rankExactMatches(
  items: Record<string, ExactSearchItem>,
  slugs: readonly string[],
  query: string,
): string[] {
  const normalizedQuery = normalizeExactSearchText(query.trim());
  const ranked = slugs.map((slug): RankedExactMatch => {
    const item = items[slug] ?? {};
    const title = normalizeExactSearchText(item.title ?? "");
    const content = normalizeExactSearchText(item.content ?? "");
    const tier: RankedExactMatch["tier"] =
      normalizedQuery.length > 0 && title === normalizedQuery
        ? 0
        : normalizedQuery.length > 0 && title.includes(normalizedQuery)
          ? 1
          : 2;

    return {
      slug,
      tier,
      count: countNonOverlappingOccurrences(title + "\n" + content, normalizedQuery),
      kind: getSlugKind(slug),
    };
  });

  const tierZeroAndOne = ranked
    .filter((match) => match.tier !== 2)
    .sort((a, b) => a.tier - b.tier || compareRankedMatches(a, b));
  const tierTwo = ranked.filter((match) => match.tier === 2);
  const chapters = tierTwo.filter((match) => match.kind === "chapter").sort(compareRankedMatches);
  const entries = tierTwo.filter((match) => match.kind !== "chapter").sort(compareRankedMatches);

  const interleaved: RankedExactMatch[] = [];
  let chapterIndex = 0;
  let entryIndex = 0;
  while (chapterIndex < chapters.length || entryIndex < entries.length) {
    const chapter = chapters[chapterIndex];
    const entry = entries[entryIndex];
    if (!entry || (chapter && chapter.count >= entry.count)) {
      interleaved.push(chapter!);
      chapterIndex++;
    } else {
      interleaved.push(entry);
      entryIndex++;
    }
  }

  return [...tierZeroAndOne, ...interleaved].map((match) => match.slug);
}

/** Extract a readable book name from a Quartz slug such as 04-民數記/第16章. */
export function getBookNameFromSlug(slug: string): string {
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Keep the original slug when it contains malformed URL encoding.
  }

  const segments = decodedSlug.split(/[\\/]/).filter(Boolean);
  if (segments.length < 2) return "";

  const parentSegment = segments.at(-2);
  if (!parentSegment) return "";

  return parentSegment
    .replace(/^\d+[-_\s]*/, "")
    .replace(/-/g, " ")
    .trim();
}
