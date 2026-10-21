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
