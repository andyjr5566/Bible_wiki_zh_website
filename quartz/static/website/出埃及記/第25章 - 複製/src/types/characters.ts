import type { ConfidenceLevel, EntityId, ScriptureReference } from './core';

export type CharacterRole = 'Priest' | 'HighPriest' | 'LeviteHelper';
export type GarmentSlot = 'Ephod' | 'Breastpiece' | 'TurbanMiter' | 'Robe' | 'Tunic' | 'GoldPlate';

export interface CharacterNavigationHook {
  spawnLocationId: EntityId;
  routeLocationIds: EntityId[];
  movementProfile: 'stationary' | 'ritual-route' | 'ambient-route';
}

export interface CharacterAnimationHooks {
  idle: string;
  walk: string;
  ritual: Record<string, string>;
}

export interface GarmentAssignment {
  slot: GarmentSlot;
  assetId: EntityId | null;
  confidence: ConfidenceLevel;
}

export interface CharacterDefinition {
  id: EntityId;
  name: string;
  role: CharacterRole;
  baseAssetId: EntityId | null;
  navigation: CharacterNavigationHook;
  animations: CharacterAnimationHooks;
  scriptureReferences: ScriptureReference[];
  garments: GarmentAssignment[];
}

export interface CharacterRuntimeHooks {
  onSpawn?(definition: CharacterDefinition): void;
  onNavigate?(characterId: EntityId, locationId: EntityId): void;
  onAnimation?(characterId: EntityId, clip: string): void;
  onGarmentChanged?(characterId: EntityId, slot: GarmentSlot): void;
}
