import type { EntityId } from './core';

export type ExperienceMode = 'overview' | 'tour' | 'learning';

export interface UIState {
  mode: ExperienceMode;
  previousMode: ExperienceMode | null;
  selectedEntityId: EntityId | null;
  activePanel: 'none' | 'object' | 'scripture' | 'ritual' | 'character';
  transitionReason: string;
}
