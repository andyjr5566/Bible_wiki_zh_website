import type { ConfidenceLevel, EntityId, Vector3Data } from './core';

export type MeasurementStatus = 'verified' | 'unresolved';

export interface ObjectDimensions {
  status: MeasurementStatus;
  lengthCubits: number | null;
  widthCubits: number | null;
  heightCubits: number | null;
  sourceClaimIds: string[];
  displayNote: string;
}

export interface ObjectPart { id: string; label: string; claimIds: string[]; }

export interface ObjectDetailDefinition {
  id: EntityId;
  name: string;
  locationId: EntityId;
  confidence: ConfidenceLevel;
  summary: string;
  dimensions: ObjectDimensions;
  materials: string[];
  parts: ObjectPart[];
  claimIds: string[];
  center: Vector3Data;
  scriptureReferences: string[];
}

export interface ObjectDetailsData { objects: ObjectDetailDefinition[]; }
