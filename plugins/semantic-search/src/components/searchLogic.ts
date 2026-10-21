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

// 每筆內容正規化後的全文快取：完整站約 3,800 筆、20 MB，每次查詢都重新 normalize 會拖慢精準結果（B4-1 要求 300 ms 內出現）
const normalizedTextCache = new WeakMap<ExactSearchItem, string>();

function normalizedSearchableText(item: ExactSearchItem): string {
  let text = normalizedTextCache.get(item);
  if (text === undefined) {
    text = normalizeExactSearchText(
      [item.title ?? "", item.content ?? "", ...(item.tags ?? [])].join("\n"),
    );
    normalizedTextCache.set(item, text);
  }
  return text;
}

/** 先把每筆的正規化全文算好放進快取（完整索引載入後呼叫）。 */
export function warmExactSearchCache(items: Record<string, ExactSearchItem>): void {
  for (const item of Object.values(items)) {
    if (item && typeof item === "object") normalizedSearchableText(item);
  }
}

export function findExactMatchSlugs(
  items: Record<string, ExactSearchItem>,
  query: string,
): string[] {
  const normalizedQuery = normalizeExactSearchText(query.trim());
  if (normalizedQuery.length < MIN_EXACT_QUERY_LENGTH) return [];
  return Object.entries(items)
    .filter(([slug]) => !isSearchExcludedSlug(slug))
    .filter(([, item]) => normalizedSearchableText(item).includes(normalizedQuery))
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

/** link_folder 底下的分類順序（與關係圖一致）；新出現的資料夾排在這些之後。 */
export const LINK_FOLDER_CATEGORY_ORDER = [
  "人物",
  "地點",
  "事件",
  "歷史",
  "背景",
  "文化",
  "神學",
  "主題",
  "原文",
  "互文",
  "解經爭議",
] as const;

export const CATEGORY_OTHER = "其他";
export const CATEGORY_APPENDIX = "附錄";
export const CATEGORY_TEACHING = "教學";
export const CATEGORY_CHAPTER = "章節";

/**
 * 搜尋結果的類型標籤，與關係圖使用同一套分類。
 * link_folder/<資料夾>/<條目> 直接用資料夾名稱；章節、附錄、教學各一類；其餘為「其他」。
 */
export function getResultCategory(slug: string): string {
  let decodedSlug = slug;
  try {
    decodedSlug = decodeURIComponent(slug);
  } catch {
    // Keep the original slug when it contains malformed URL encoding.
  }

  const folder = decodedSlug.match(/^link_folder\/([^/]+)\//)?.[1];
  if (folder) return folder;
  if (/^\d\d-/.test(decodedSlug)) return CATEGORY_CHAPTER;
  if (decodedSlug.startsWith("appendix/")) return CATEGORY_APPENDIX;
  if (decodedSlug.startsWith("教學/")) return CATEGORY_TEACHING;
  return CATEGORY_OTHER;
}

function getCategorySortKey(category: string, firstSeen: number): [number, number] {
  const known = (LINK_FOLDER_CATEGORY_ORDER as readonly string[]).indexOf(category);
  if (known !== -1) return [known, 0];
  if (category === CATEGORY_OTHER) return [LINK_FOLDER_CATEGORY_ORDER.length + 1, 0];
  if (category === CATEGORY_APPENDIX) return [LINK_FOLDER_CATEGORY_ORDER.length + 2, 0];
  if (category === CATEGORY_TEACHING) return [LINK_FOLDER_CATEGORY_ORDER.length + 3, 0];
  if (category === CATEGORY_CHAPTER) return [LINK_FOLDER_CATEGORY_ORDER.length + 4, 0];
  // 新的 link_folder 資料夾：排在已知分類之後、「其他」之前，依出現順序
  return [LINK_FOLDER_CATEGORY_ORDER.length, firstSeen];
}

/** 統計各類型筆數，順序與關係圖一致：人物…解經爭議、新資料夾、其他、附錄、教學、章節。 */
export function summarizeCategories(
  categories: readonly string[],
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const category of categories) counts.set(category, (counts.get(category) ?? 0) + 1);
  const firstSeen = new Map<string, number>();
  Array.from(counts.keys()).forEach((name, index) => firstSeen.set(name, index));

  return Array.from(counts, ([name, count]) => ({ name, count })).sort((a, b) => {
    const [aGroup, aSeen] = getCategorySortKey(a.name, firstSeen.get(a.name) ?? 0);
    const [bGroup, bSeen] = getCategorySortKey(b.name, firstSeen.get(b.name) ?? 0);
    return aGroup - bGroup || aSeen - bSeen;
  });
}
