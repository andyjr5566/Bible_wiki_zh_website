import type { EntityId } from './core';

export type ExperienceMode = 'overview' | 'tour' | 'learning' | 'ritual';
export type OverlayId = 'none' | 'scripture' | 'map' | 'settings' | 'credits';
export type PlaybackOwner = 'none' | 'tour' | 'ritual' | 'cinematic';

export interface UIState {
  mode: ExperienceMode;
  previousMode: ExperienceMode | null;
  selectedEntityId: EntityId | null;
  activePanel: 'none' | 'object' | 'scripture' | 'ritual' | 'character';
  transitionReason: string;
  selectedRitualId: EntityId | null;
  selectedBranchId: EntityId | null;
  selectedStepId: EntityId | null;
  overlay: OverlayId;
  playbackOwner: PlaybackOwner;
}
