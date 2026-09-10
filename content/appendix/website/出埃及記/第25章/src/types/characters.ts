import type { ConfidenceLevel, EntityId, ScriptureReference } from './core';

export type CharacterRole = 'Priest' | 'HighPriest' | 'LeviteHelper';
export type GarmentSlot = 'Ephod' | 'Breastpiece' | 'TurbanMiter' | 'Robe' | 'Tunic' | 'GoldPlate' | 'Sash' | 'LinenBreeches' | 'Headdress';
export type GarmentState = 'daily-priest' | 'daily-high-priest' | 'atonement-linen' | 'post-atonement-garments' | 'unspecified';
export type CharacterVisualPolicy = 'technical-base-with-label' | 'abstract-role-marker';

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
  defaultGarmentState: GarmentState;
  visualPolicy: CharacterVisualPolicy;
  responsibilitySummary: string[];
  responsibilityClaimIds: string[];
  navigation: CharacterNavigationHook;
  animations: CharacterAnimationHooks;
  scriptureReferences: ScriptureReference[];
  garments: GarmentAssignment[];
}

export interface GarmentPartDefinition {
  id: EntityId;
  label: string;
  claimedMaterials: string[];
  quantity: string;
  function: string;
  sourceClaimIds: string[];
  scriptureReferences: ScriptureReference[];
  confidence: ConfidenceLevel;
  assetId: EntityId | null;
  visualPolicy: 'text-label' | 'abstract-marker' | 'technical-overlay';
  unknowns: string[];
}

export interface GarmentStateDefinition {
  id: GarmentState;
  label: string;
  role: CharacterRole | 'unspecified';
  parts: GarmentPartDefinition[];
  sourceClaimIds: string[];
  scriptureReferences: ScriptureReference[];
  transitionNote: string;
  unknowns: string[];
}

export interface GarmentsData { states: GarmentStateDefinition[]; }

export interface RoleCostumeDefinition {
  id: EntityId;
  role: CharacterRole;
  label: string;
  defaultGarmentState: GarmentState;
  allowedGarmentStates: GarmentState[];
  forbiddenGarmentStates: GarmentState[];
  responsibilitySummary: string[];
  sourceClaimIds: string[];
  visualPolicy: CharacterVisualPolicy;
  disclosure: string;
}

export interface RoleCostumesData { roles: RoleCostumeDefinition[]; }

export interface CharacterRuntimeHooks {
  onSpawn?(definition: CharacterDefinition): void;
  onNavigate?(characterId: EntityId, locationId: EntityId): void;
  onAnimation?(characterId: EntityId, clip: string): void;
  onGarmentChanged?(characterId: EntityId, slot: GarmentSlot): void;
}
