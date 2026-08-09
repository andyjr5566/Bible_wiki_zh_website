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
