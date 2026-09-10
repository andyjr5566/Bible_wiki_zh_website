import excerptsJson from '../data/scripture-excerpts.json';
import toursJson from '../data/tours.json';
import cameraPaths from '../data/cinematic-paths.json';
import { scriptureExcerptsSchema } from '../data/schemas/scriptureEvidence';
import { toursSchema } from '../data/schemas/tours';
import { EventChannel, type Unsubscribe } from '../utils/EventChannel';
import type { Vector3Data } from '../types/core';
import type { DimensionUnit } from '../scene/DimensionVisualizer';
import type { ScriptureExcerpt } from '../types/scriptureEvidence';
import type { TourDefinition, TourHotspot, CameraPose } from '../types/tours';

export interface CinematicHotspot {
  id: string;
  label: string;
  objectId: string;
  summary: string;
  scriptureReference: string;
  scriptureText: string;
  cameraStart: CameraPose;
  cameraEnd: CameraPose;
  durationSeconds: number;
  dimensionTargetId?: string | undefined;
}

export interface CinematicAct {
  id: string;
  actNumber: number;
  totalActs: number;
  title: string;
  subtitle: string;
  hebrewTerm?: string | undefined;
  scriptureReference: string;
  /** Shared by the subtitle and expandable full excerpt. */
  sourceReference: string;
  scriptureText: string;
  durationSeconds: number;
  cameraStart: { position: Vector3Data; target: Vector3Data; fov: number };
  cameraEnd: { position: Vector3Data; target: Vector3Data; fov: number };
  dimensionTargetId?: string | undefined;
  peelRoof?: boolean | undefined;
  hotspots: readonly CinematicHotspot[];
  hotspotId: string | null;
}

export interface CinematicState {
  isPlaying: boolean;
  isPaused: boolean;
  currentActIndex: number;
  currentAct: CinematicAct;
  progressRatio: number;
  playbackSpeed: number;
  showDimensions: boolean;
  dimensionUnit: DimensionUnit;
}

function excerptText(ids: readonly string[], byId: ReadonlyMap<string, ScriptureExcerpt>): string {
  return ids.map((id) => byId.get(id)?.text ?? '').filter(Boolean).join('\n\n');
}

function toHotspot(hotspot: TourHotspot, byId: ReadonlyMap<string, ScriptureExcerpt>): CinematicHotspot {
  return {
    id: hotspot.id,
    label: hotspot.label,
    objectId: hotspot.objectId,
    summary: hotspot.summary,
    scriptureReference: hotspot.scriptureReference,
    scriptureText: excerptText(hotspot.excerptIds, byId),
    cameraStart: hotspot.cameraStart,
    cameraEnd: hotspot.cameraEnd,
    durationSeconds: hotspot.durationSeconds ?? 8,
    dimensionTargetId: hotspot.dimensionTargetId,
  };
}

/** Build the automatic view from the same tour source records used by TourManager. */
export function createCinematicActs(tours: readonly TourDefinition[], excerpts: readonly ScriptureExcerpt[]): CinematicAct[] {
  const excerptById = new Map(excerpts.map((excerpt) => [excerpt.id, excerpt]));
  // Restore the eight-shot walkthrough; the manual tour retains five stations.
  const ordered = tours.slice().sort((a, b) => a.order - b.order).flatMap((tour) => [
    tour,
    ...(tour.hotspots ?? []).map((hotspot) => ({ ...tour, ...hotspot, title: hotspot.label, subtitle: hotspot.label, hotspots: [], durationSeconds: hotspot.durationSeconds ?? 8 })),
  ]);
  return ordered.map((tour, index) => ({
    id: tour.id,
    actNumber: index + 1,
    totalActs: ordered.length,
    title: tour.id === 'holy-place' ? '進入聖所' : tour.title,
    subtitle: tour.subtitle,
    scriptureReference: tour.scriptureReference,
    sourceReference: tour.scriptureReference,
    scriptureText: excerptText(tour.excerptIds, excerptById),
    durationSeconds: cameraPaths[index]?.durationSeconds ?? tour.durationSeconds,
    cameraStart: cameraPaths[index]?.cameraStart ?? tour.cameraStart,
    cameraEnd: cameraPaths[index]?.cameraEnd ?? tour.cameraEnd,
    dimensionTargetId: tour.dimensionTargetId,
    peelRoof: false,
    hotspots: (tour.hotspots ?? []).map((hotspot) => toHotspot(hotspot, excerptById)),
    hotspotId: null,
  }));
}

const tourData = toursSchema.parse(toursJson);
const excerptData = scriptureExcerptsSchema.parse(excerptsJson);
export const CINEMATIC_ACTS = createCinematicActs(tourData.tours, excerptData.excerpts);

export class CinematicTourController {
  readonly #events = new EventChannel<Readonly<CinematicState>>();
  #actIndex = 0;
  #isPlaying = false;
  #isPaused = false;
  #actElapsed = 0;
  #speed = 1;
  #showDimensions = false;
  #dimensionUnit: DimensionUnit = 'cubit';
  #hotspotId: string | null = null;

  constructor(readonly acts = CINEMATIC_ACTS) {}

  get snapshot(): Readonly<CinematicState> {
    const base = this.acts[this.#actIndex] ?? this.acts[0]!;
    const hotspot = base?.hotspots.find(({ id }) => id === this.#hotspotId);
    const act = hotspot ? {
      ...base,
      title: `${base.title} · ${hotspot.label}`,
      subtitle: hotspot.label,
      scriptureReference: hotspot.scriptureReference,
      sourceReference: hotspot.scriptureReference,
      scriptureText: hotspot.scriptureText,
      cameraStart: hotspot.cameraStart,
      cameraEnd: hotspot.cameraEnd,
      durationSeconds: hotspot.durationSeconds,
      dimensionTargetId: hotspot.dimensionTargetId ?? base.dimensionTargetId,
      hotspotId: hotspot.id,
    } : { ...base, hotspotId: null };
    return {
      isPlaying: this.#isPlaying,
      isPaused: this.#isPaused,
      currentActIndex: this.#actIndex,
      currentAct: act,
      progressRatio: Math.min(1, this.#actElapsed / Math.max(0.001, act.durationSeconds)),
      playbackSpeed: this.#speed,
      showDimensions: this.#showDimensions,
      dimensionUnit: this.#dimensionUnit,
    };
  }

  subscribe(listener: (state: Readonly<CinematicState>) => void): Unsubscribe { listener(this.snapshot); return this.#events.subscribe(listener); }
  start(fromIndex = 0): void {
    this.#actIndex = this.acts.length ? Math.max(0, Math.min(this.acts.length - 1, fromIndex)) : 0;
    this.#hotspotId = null;
    this.#isPlaying = this.acts.length > 0;
    this.#isPaused = false;
    this.#actElapsed = 0;
    this.#emit();
  }
  pause(): void { if (!this.#isPlaying) return; this.#isPaused = true; this.#emit(); }
  resume(): void { if (!this.#isPlaying) { this.start(this.#actIndex); return; } this.#isPaused = false; this.#emit(); }
  togglePlayPause(): void { if (this.#isPaused || !this.#isPlaying) this.resume(); else this.pause(); }
  replay(): void { if (!this.acts.length) return; this.#actElapsed = 0; this.#isPlaying = true; this.#isPaused = false; this.#emit(); }
  stop(): void { this.#isPlaying = false; this.#isPaused = false; this.#actElapsed = 0; this.#emit(); }
  next(): void {
    if (this.#actIndex < this.acts.length - 1) { this.#actIndex += 1; this.#hotspotId = null; this.#actElapsed = 0; this.#emit(); }
    else this.stop();
  }
  previous(): void { if (this.#actIndex > 0) { this.#actIndex -= 1; this.#hotspotId = null; this.#actElapsed = 0; this.#emit(); } }
  jumpTo(index: number): void { this.#actIndex = Math.max(0, Math.min(this.acts.length - 1, index)); this.#hotspotId = null; this.#actElapsed = 0; this.#emit(); }
  selectHotspot(hotspotId: string | null): void {
    const valid = hotspotId && this.acts[this.#actIndex]?.hotspots.some(({ id }) => id === hotspotId) ? hotspotId : null;
    this.#hotspotId = valid;
    this.#actElapsed = 0;
    this.#emit();
  }
  setSpeed(speed: number): void { if (Number.isFinite(speed) && speed > 0) { this.#speed = Math.max(0.25, Math.min(2, speed)); this.#emit(); } }
  toggleDimensions(): void { this.#showDimensions = !this.#showDimensions; this.#emit(); }
  setDimensionUnit(unit: DimensionUnit): void { this.#dimensionUnit = unit; this.#emit(); }
  update(deltaSeconds: number): boolean {
    if (!this.#isPlaying || this.#isPaused) return false;
    const act = this.snapshot.currentAct;
    this.#actElapsed += Math.max(0, deltaSeconds) * this.#speed;
    this.#emit();
    if (this.#actElapsed >= act.durationSeconds) { this.next(); return true; }
    return false;
  }
  #emit(): void { this.#events.emit(this.snapshot); }
}
