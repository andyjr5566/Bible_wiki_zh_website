import type { ConfidenceLevel, EntityId, ScriptureReference } from './core';

export type RitualType = 'washing' | 'burnt-offering' | 'incense' | 'lamp-care' | 'shewbread' | 'atonement-entry';
export type RitualTrigger = { kind: 'interaction'; objectId: EntityId } | { kind: 'learning-mode'; locationId: EntityId };

export interface RitualStep {
  id: EntityId;
  order: number;
  title: string;
  instruction: string;
  confidence: ConfidenceLevel;
  objectIds: EntityId[];
  characterIds: EntityId[];
  scriptureReferences: ScriptureReference[];
  playbackHook: string;
  uiHook: string;
}

export interface RitualDefinition {
  id: EntityId;
  name: string;
  type: RitualType;
  locationId: EntityId;
  confidence: ConfidenceLevel;
  trigger: RitualTrigger;
  steps: RitualStep[];
}

export interface RitualPlaybackState {
  ritualId: EntityId | null;
  stepIndex: number;
  status: 'idle' | 'playing' | 'paused' | 'complete';
}

export interface RitualPlaybackHooks {
  onStepEnter?(ritual: RitualDefinition, step: RitualStep): void;
  onStepExit?(ritual: RitualDefinition, step: RitualStep): void;
  onStateChange?(state: RitualPlaybackState): void;
}
