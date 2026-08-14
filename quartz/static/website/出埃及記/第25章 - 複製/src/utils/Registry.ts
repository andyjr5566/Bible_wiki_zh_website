export class Registry<T extends { id: string }> {
  readonly #entries = new Map<string, T>();

  constructor(entries: readonly T[] = []) {
    entries.forEach((entry) => this.register(entry));
  }

  register(entry: T): void {
    if (this.#entries.has(entry.id)) throw new Error(`Duplicate registry id: ${entry.id}`);
    this.#entries.set(entry.id, entry);
  }

  get(id: string): T | undefined { return this.#entries.get(id); }
  require(id: string): T {
    const entry = this.get(id);
    if (!entry) throw new Error(`Unknown registry id: ${id}`);
    return entry;
  }
  has(id: string): boolean { return this.#entries.has(id); }
  values(): T[] { return [...this.#entries.values()]; }
  get size(): number { return this.#entries.size; }
}
