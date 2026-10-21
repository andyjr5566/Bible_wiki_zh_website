export const SEMANTIC_SEARCH_TIMEOUT_MS = 4000;

export type FetchJsonResult<T = unknown> =
  | { status: "ok"; data: T }
  | { status: "timeout" | "error" | "aborted" };

export interface FetchJsonOptions {
  timeoutMs: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  { timeoutMs, signal, fetchImpl = fetch }: FetchJsonOptions,
): Promise<FetchJsonResult<T>> {
  if (signal?.aborted) return { status: "aborted" };

  const controller = new AbortController();
  let resolveControl!: (result: FetchJsonResult<T>) => void;
  const controlPromise = new Promise<FetchJsonResult<T>>((resolve) => {
    resolveControl = resolve;
  });
  const onAbort = () => {
    controller.abort();
    resolveControl({ status: "aborted" });
  };
  signal?.addEventListener("abort", onAbort, { once: true });

  let didTimeout = false;
  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort();
    resolveControl({ status: "timeout" });
  }, timeoutMs);

  const fetchPromise: Promise<FetchJsonResult<T>> = Promise.resolve().then(async () => {
    try {
      if (didTimeout) return { status: "timeout" };
      if (signal?.aborted) return { status: "aborted" };
      const response = await fetchImpl(url, { signal: controller.signal });
      if (didTimeout) return { status: "timeout" };
      if (signal?.aborted) return { status: "aborted" };
      if (!response.ok) return { status: "error" };
      const data = (await response.json()) as T;
      if (didTimeout) return { status: "timeout" };
      if (signal?.aborted) return { status: "aborted" };
      return { status: "ok", data };
    } catch {
      if (didTimeout) return { status: "timeout" };
      if (signal?.aborted) return { status: "aborted" };
      return { status: "error" };
    }
  });

  try {
    return await Promise.race([fetchPromise, controlPromise]);
  } finally {
    clearTimeout(timeoutId);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface SemanticSearchResultLike {
  slug: string;
}

export type SearchIndexState = "loading" | "ready" | "error";
export type SemanticSearchState = "loading" | "ready" | "error";
export type SearchViewNote =
  | "index-loading"
  | "exact-loading"
  | "index-unavailable"
  | "semantic-unavailable"
  | "search-unavailable";

export interface SearchView<T extends SemanticSearchResultLike> {
  results: T[];
  notes: SearchViewNote[];
  pending: boolean;
}

/** Combine exact and semantic results while describing which asynchronous work is still pending. */
export function composeSearchView<T extends SemanticSearchResultLike>({
  exact,
  semantic,
  indexState,
  semanticState,
}: {
  exact: readonly T[];
  semantic: readonly T[];
  indexState: SearchIndexState;
  semanticState: SemanticSearchState;
}): SearchView<T> {
  const seen = new Set<string>();
  const results: T[] = [];
  for (const result of [...exact, ...semantic]) {
    if (!result.slug || seen.has(result.slug)) continue;
    seen.add(result.slug);
    results.push(result);
  }

  const notes: SearchViewNote[] = [];
  // 兩邊都失敗時只給一句「搜尋暫時無法使用」，不要同時出現「只顯示語意相關的結果」和空清單（交叉審查指出的矛盾）
  if (indexState === "error" && semanticState === "error") {
    return { results, notes: ["search-unavailable"], pending: false };
  }
  if (indexState === "loading") {
    notes.push(semanticState === "loading" ? "index-loading" : "exact-loading");
  } else if (indexState === "error") {
    notes.push("index-unavailable");
  }
  if (indexState === "ready" && semanticState === "error") {
    notes.push("semantic-unavailable");
  }

  return {
    results,
    notes,
    pending: indexState === "loading" || semanticState === "loading",
  };
}

/** Create one shared index-loading promise and clear it after a failure so callers can retry. */
export function createIndexLoader<T>(
  fetchIndex: () => Promise<T>,
  onLoaded: (data: T) => void | Promise<void> = () => {},
): () => Promise<boolean> {
  let indexPromise: Promise<boolean> | null = null;

  return () => {
    if (!indexPromise) {
      indexPromise = Promise.resolve()
        .then(fetchIndex)
        .then(onLoaded)
        .then(() => true)
        .catch(() => {
          indexPromise = null;
          return false;
        });
    }
    return indexPromise;
  };
}

export function appendSemanticResults<T extends SemanticSearchResultLike>(
  exactSlugs: readonly string[],
  semanticResults: readonly T[],
  isExcluded: (slug: string) => boolean,
): T[] {
  const seen = new Set(exactSlugs);
  const additions: T[] = [];

  for (const result of semanticResults) {
    if (!result.slug || seen.has(result.slug) || isExcluded(result.slug)) continue;
    seen.add(result.slug);
    additions.push(result);
  }

  return additions;
}

export interface PagedResults<T> {
  items: T[];
  total: number;
  remaining: number;
}

/** Return one page from the results matching the selected category. */
export function pageResults<T>(
  results: readonly T[],
  category: string | null,
  getCategory: (result: T) => string,
  offset: number,
  limit: number,
): PagedResults<T> {
  const matchingResults =
    category === null ? [...results] : results.filter((result) => getCategory(result) === category);
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0;
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
  const items = matchingResults.slice(safeOffset, safeOffset + safeLimit);
  return {
    items,
    total: matchingResults.length,
    remaining: Math.max(0, matchingResults.length - safeOffset - items.length),
  };
}
