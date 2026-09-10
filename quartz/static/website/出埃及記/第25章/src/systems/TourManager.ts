import type { EntityId } from '../types/core';
import type { TourHotspot } from '../types/tours';

export interface TourStop {
  id: EntityId;
  locationId: EntityId;
  objectId: EntityId | null;
  title: string;
  subtitle?: string | undefined;
  scriptureReference: string | null;
  excerptIds?: readonly string[] | undefined;
  summary?: string | undefined;
  durationSeconds?: number | undefined;
  cameraStart?: TourHotspot['cameraStart'] | undefined;
  cameraEnd?: TourHotspot['cameraEnd'] | undefined;
  dimensionTargetId?: string | undefined;
  peelRoof?: boolean | undefined;
  hotspots?: readonly TourHotspot[] | undefined;
}
export class TourManager {
  #index = 0; #playing = false;
  #hotspotId: string | null = null;
  constructor(readonly stops: readonly TourStop[]) {}
  get current(): TourStop | null {
    const stop = this.stops[this.#index];
    return stop ? { ...stop, ...(stop.hotspots ? { hotspots: [...stop.hotspots] } : {}) } : null;
  }
  get activeHotspot(): TourHotspot | null {
    const stop = this.stops[this.#index];
    return stop?.hotspots?.find(({ id }) => id === this.#hotspotId) ?? null;
  }
  get hotspotId(): string | null { return this.#hotspotId; }
  get playing(): boolean { return this.#playing; }
  get index(): number { return this.#index; }
  start(): void { this.#playing = this.stops.length > 0; }
  pause(): void { this.#playing = false; }
  resume(): void { if (this.current) this.#playing = true; }
  toggle(): void { this.#playing ? this.pause() : this.resume(); }
  next(): TourStop | null { if (this.stops.length) { this.#index = Math.min(this.#index + 1, this.stops.length - 1); this.#hotspotId = null; } return this.current; }
  previous(): TourStop | null { if (this.stops.length) { this.#index = Math.max(this.#index - 1, 0); this.#hotspotId = null; } return this.current; }
  goTo(index: number, hotspotId: string | null = null): TourStop | null {
    this.#index = this.stops.length ? Math.max(0, Math.min(this.stops.length - 1, index)) : 0;
    this.#hotspotId = this.stops[this.#index]?.hotspots?.some(({ id }) => id === hotspotId) ? hotspotId : null;
    return this.current;
  }
  selectHotspot(hotspotId: string | null): TourHotspot | null {
    const hotspot = hotspotId ? this.stops[this.#index]?.hotspots?.find(({ id }) => id === hotspotId) ?? null : null;
    this.#hotspotId = hotspot?.id ?? null;
    return hotspot;
  }
  reset(): void { this.#index = 0; this.#hotspotId = null; this.#playing = false; }
}
