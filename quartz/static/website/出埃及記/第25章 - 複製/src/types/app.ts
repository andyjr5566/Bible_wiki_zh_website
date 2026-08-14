import type { ExperienceMode, UIState } from './ui';
import type { AssetProfile, AssetRuntimeState } from './assets';
import type { AttributionView, ExperienceState, RitualCommand, TourCommand } from './experience';

export interface ArchitectureStats {
  objects: number; characters: number; rituals: number; scriptures: number; locations: number; assets: number;
}

export interface AppPort {
  readonly stats: ArchitectureStats;
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
}
