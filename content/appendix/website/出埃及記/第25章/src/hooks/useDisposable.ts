export function useDisposable<T extends { dispose(): void }>(resource: T): () => void { return () => resource.dispose(); }
