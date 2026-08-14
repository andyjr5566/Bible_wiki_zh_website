import type { ConfidenceLevel, EntityId, ScriptureReference, Vector3Data } from './core';

export interface TabernacleObjectDefinition {
  id: EntityId;
  name: string;
  locationId: EntityId;
  assetId: EntityId | null;
  interactionPosition: Vector3Data;
  confidence: ConfidenceLevel;
  scriptureReferences: ScriptureReference[];
  interactable: boolean;
}

export interface TabernacleDefinition {
  id: EntityId;
  name: string;
  purpose: string;
  objects: TabernacleObjectDefinition[];
}
