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
