import type { EntityId } from '../types/core';

export interface TourStop { id: EntityId; locationId: EntityId; objectId: EntityId | null; title: string; scriptureReference: string | null; }
export class TourManager {
  #index = 0; #playing = false;
  constructor(readonly stops: readonly TourStop[]) {}
  get current(): TourStop | null { return this.stops[this.#index] ?? null; }
  get playing(): boolean { return this.#playing; }
  get index(): number { return this.#index; }
  start(): void { this.#playing = this.stops.length > 0; }
  pause(): void { this.#playing = false; }
  resume(): void { if (this.current) this.#playing = true; }
  toggle(): void { this.#playing ? this.pause() : this.resume(); }
  next(): TourStop | null { if (this.stops.length) this.#index = Math.min(this.#index + 1, this.stops.length - 1); return this.current; }
  previous(): TourStop | null { if (this.stops.length) this.#index = Math.max(this.#index - 1, 0); return this.current; }
  reset(): void { this.#index = 0; this.#playing = false; }
}
