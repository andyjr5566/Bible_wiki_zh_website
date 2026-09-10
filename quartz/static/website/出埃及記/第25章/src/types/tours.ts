import type { EntityId, Vector3Data } from './core';

export interface CameraPose { position: Vector3Data; target: Vector3Data; fov: number; }

export interface TourHotspot {
  id: string;
  label: string;
  objectId: EntityId;
  scriptureReference: string;
  excerptIds: readonly string[];
  summary: string;
  cameraStart: CameraPose;
  cameraEnd: CameraPose;
  durationSeconds?: number | undefined;
  dimensionTargetId?: string | undefined;
}

export interface TourDefinition {
  id: string;
  order: number;
  title: string;
  subtitle: string;
  locationId: EntityId;
  objectId: EntityId | null;
  scriptureReference: string;
  excerptIds: string[];
  summary: string;
  durationSeconds: number;
  cameraStart: CameraPose;
  cameraEnd: CameraPose;
  dimensionTargetId?: string | undefined;
  peelRoof?: boolean | undefined;
  hotspots?: TourHotspot[] | undefined;
}

export interface ToursData { tours: TourDefinition[]; }
