export type Unsubscribe = () => void;

export class EventChannel<T> {
  readonly #listeners = new Set<(event: T) => void>();

  subscribe(listener: (event: T) => void): Unsubscribe {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  emit(event: T): void { this.#listeners.forEach((listener) => listener(event)); }
  clear(): void { this.#listeners.clear(); }
}
