import type { ExperienceMode, UIState } from './ui';
import type { AssetProfile, AssetRuntimeState } from './assets';
import type { AttributionView, ExperienceState, RitualCommand, TourCommand } from './experience';
import type { AudioManager } from '../audio/AudioManager';
import type { AtmosphereMode } from './atmosphere';
import type { CinematicState } from '../systems/CinematicTourController';
import type { DimensionUnit } from '../scene/DimensionVisualizer';

export interface ArchitectureStats {
  objects: number;
  characters: number;
  rituals: number;
  scriptures: number;
  locations: number;
  assets: number;
}

export interface AppPort {
  readonly stats: ArchitectureStats;
  readonly audio: AudioManager;
  getState(): Readonly<UIState>;
  subscribe(listener: (state: Readonly<UIState>) => void): () => void;
  transitionTo(mode: ExperienceMode, reason: string): void;
  getAssetState(): Readonly<AssetRuntimeState>;
  subscribeAssets(listener: (state: Readonly<AssetRuntimeState>) => void): () => void;
  setAssetProfile(profile: AssetProfile): void;
  loadDetail(assetId: string): void;
  getExperienceState(): Readonly<ExperienceState>;
  subscribeExperience(listener: (state: Readonly<ExperienceState>) => void): () => void;
  commandTour(command: TourCommand): void;
  selectLearningObject(objectId: string): void;
  startRitual(ritualId: string): void;
  commandRitual(command: RitualCommand): void;
  setCreditsOpen(open: boolean): void;
  getAttributions(): AttributionView[];
  setAtmosphere(mode: AtmosphereMode): void;
  setQuality(preset: 'high' | 'medium' | 'low'): void;

  // Cinematic Tour APIs
  startCinematicTour(fromIndex?: number): void;
  stopCinematicTour(): void;
  toggleCinematicPlayPause(): void;
  nextCinematicAct(): void;
  prevCinematicAct(): void;
  toggleCinematicDimensions(): void;
  setCinematicDimensionUnit(unit: DimensionUnit): void;
  setCinematicSpeed(speed: number): void;
  subscribeCinematic(listener: (state: Readonly<CinematicState>) => void): () => void;
}
