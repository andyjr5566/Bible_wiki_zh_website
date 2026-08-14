import type { EntityId, Vector3Data } from './core';

export interface LocationDefinition {
  id: EntityId;
  name: string;
  zone: 'outer-court' | 'holy-place' | 'most-holy-place' | 'camp';
  position: Vector3Data;
  facingRadians: number;
  mapPoint: { x: number; y: number };
}

export interface WorldDefinition {
  orientation: { eastAxis: '+z'; upAxis: '+y'; unit: 'meter' };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  spawnLocationId: EntityId;
  locations: LocationDefinition[];
}
