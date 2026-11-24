import { buildProjection, expandCompatibleTerms } from "./textMatcher";

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

/** 相容比對用的查詢寫法（簡繁、異體字、專有名詞／版本差異）；查詢太短或全是標點時為空。 */
function exactQueryVariants(query: string): string[] {
  if (query.trim().length < MIN_EXACT_QUERY_LENGTH) return [];
  return expandCompatibleTerms(query.trim(), false);
}

function includesAnyVariant(text: string, variants: readonly string[]): boolean {
  return variants.some((variant) => variant !== "" && text.includes(variant));
}

/** 知識庫搜尋用的正規化：換行是硬邊界（哨兵 "\n"），行內空白與標點照舊忽略。 */
function projectField(value: string): string {
  return buildProjection(value, false, { lineBreaks: true }).norm;
}

export function containsExactSearchText(value: string, query: string): boolean {
  const variants = exactQueryVariants(query);
  if (variants.length === 0) return false;
  return includesAnyVariant(projectField(value), variants);
}

interface NormalizedItem {
  title: string;
  content: string;
  /** 標題、內文、每個標籤以 "\n" 隔開，比對不會跨欄位。 */
  searchable: string;
}

// 每筆內容正規化後的快取：完整站約 3,800 筆、20 MB，每次查詢都重新 normalize 會拖慢精準結果（B4-1 要求 300 ms 內出現）
const normalizedCache = new WeakMap<ExactSearchItem, NormalizedItem>();

function normalizedItem(item: ExactSearchItem): NormalizedItem {
  let cached = normalizedCache.get(item);
  if (cached === undefined) {
    const title = projectField(item.title ?? "");
    const content = projectField(item.content ?? "");
    const tags = (item.tags ?? []).map(projectField);
    cached = { title, content, searchable: [title, content, ...tags].join("\n") };
    normalizedCache.set(item, cached);
  }
  return cached;
}

function normalizedSearchableText(item: ExactSearchItem): string {
  return normalizedItem(item).searchable;
}

/** 先把每筆的正規化全文算好放進快取（同步版；測試或小資料用）。 */
export function warmExactSearchCache(items: Record<string, ExactSearchItem>): void {
  for (const item of Object.values(items)) {
    if (item && typeof item === "object") normalizedSearchableText(item);
  }
}

export interface WarmOptions {
  /** 回傳 true 就停止（下一批不再處理）。 */
  isCancelled?: () => boolean;
  /** 每批最多處理幾筆。 */
  chunkSize?: number;
  /** 每批的時間預算（毫秒）；超過就讓出主執行緒。 */
  budgetMs?: number;
  /** 每批結束後呼叫（測量用）。 */
  onBatch?: (info: { processed: number; ms: number }) => void;
}

const DEFAULT_WARM_CHUNK = 300;
const DEFAULT_WARM_BUDGET_MS = 8;

const nowMs = (): number => (typeof performance !== "undefined" ? performance.now() : Date.now());

/** 讓出主執行緒：瀏覽器用 requestIdleCallback（有逾時），否則 setTimeout(0)。 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => {
    const idle = (globalThis as { requestIdleCallback?: typeof requestIdleCallback })
      .requestIdleCallback;
    if (typeof idle === "function") idle(() => resolve(), { timeout: 100 });
    else setTimeout(resolve, 0);
  });
}

const warmInFlight = new WeakMap<object, Promise<void>>();

/**
 * 分批預熱正規化快取，批與批之間讓出主執行緒，避免第一次知識搜尋凍結畫面。
 * 以 items 物件為 key 只跑一次（SPA 換頁重複呼叫會拿到同一個 Promise）；已快取的項目直接略過，
 * 所以搜尋途中才補進來的項目、或搜尋已先算過的項目都不會重複處理。
 */
export function warmExactSearchIndex(
  items: Record<string, ExactSearchItem>,
  options: WarmOptions = {},
): Promise<void> {
  const existing = warmInFlight.get(items);
  if (existing) return existing;
  const chunkSize = options.chunkSize ?? DEFAULT_WARM_CHUNK;
  const budgetMs = options.budgetMs ?? DEFAULT_WARM_BUDGET_MS;
  const run = async (): Promise<void> => {
    const list = Object.values(items);
    let index = 0;
    while (index < list.length) {
      if (options.isCancelled?.()) return;
      const startedAt = nowMs();
      const startIndex = index;
      while (index < list.length && index - startIndex < chunkSize) {
        const item = list[index++];
        if (item && typeof item === "object") normalizedSearchableText(item);
        if (nowMs() - startedAt >= budgetMs) break;
      }
      options.onBatch?.({ processed: index - startIndex, ms: nowMs() - startedAt });
      if (index < list.length) await yieldToMain();
    }
  };
  const promise = run().finally(() => {
    // 被取消而沒跑完的話，下次可以重新開始
    if (options.isCancelled?.()) warmInFlight.delete(items);
  });
  warmInFlight.set(items, promise);
  return promise;
}

export function findExactMatchSlugs(
  items: Record<string, ExactSearchItem>,
  query: string,
): string[] {
  const variants = exactQueryVariants(query);
  if (variants.length === 0) return [];
  return Object.entries(items)
    .filter(([slug]) => !isSearchExcludedSlug(slug))
    .filter(([, item]) => includesAnyVariant(normalizedSearchableText(item), variants))
    .map(([slug]) => slug);
}

export type SlugKind = "chapter" | "entry" | "other";

export function getSlugKind(slug: string): SlugKind {
  if (/^\d\d-/.test(slug)) return "chapter";
  if (slug.startsWith("link_folder/")) return "entry";
  return "other";
}

function countNonOverlappingOccurrences(text: string, queries: readonly string[]): number {
  let total = 0;
  for (const query of queries) {
    if (query.length === 0) continue;
    let index = text.indexOf(query);
    while (index !== -1) {
      total++;
      index = text.indexOf(query, index + query.length);
    }
  }
  return total;
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
  const variants = exactQueryVariants(query);
  const ranked = slugs.map((slug): RankedExactMatch => {
    const item = items[slug] ?? {};
    const { title, content } = normalizedItem(item);
    const tier: RankedExactMatch["tier"] = variants.includes(title)
      ? 0
      : includesAnyVariant(title, variants)
        ? 1
        : 2;

    return {
      slug,
      tier,
      count: countNonOverlappingOccurrences(title + "\n" + content, variants),
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

export function getKnowledgeSearchCategory(slug: string): string | null {
  if (isSearchExcludedSlug(slug)) return null;
  const category = getResultCategory(slug);
  return category === CATEGORY_CHAPTER ? null : category;
}

export function getKnowledgeSearchCategories(slugs: readonly string[]): string[] {
  const categories: string[] = [...LINK_FOLDER_CATEGORY_ORDER, CATEGORY_APPENDIX];
  for (const slug of slugs) {
    const category = getKnowledgeSearchCategory(slug);
    if (category !== null) categories.push(category);
  }
  return summarizeCategories(categories).map(({ name }) => name);
}

export function getKnowledgeSearchCategoryLabel(category: string): string {
  return category === "原文" ? "原文詞義" : category;
}

export function findKnowledgeMatchSlugs(
  items: Record<string, ExactSearchItem>,
  query: string,
  selectedCategories: ReadonlySet<string>,
): string[] {
  if (selectedCategories.size === 0) return [];
  const matches = findExactMatchSlugs(items, query).filter((slug) => {
    const category = getKnowledgeSearchCategory(slug);
    return category !== null && selectedCategories.has(category);
  });
  return rankExactMatches(items, matches, query);
}
