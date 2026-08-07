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
    .filter(([, item]) => {
      const searchableText = [item.title ?? "", item.content ?? "", ...(item.tags ?? [])].join(
        "\n",
      );
      return containsExactSearchText(searchableText, query);
    })
    .map(([slug]) => slug);
}
