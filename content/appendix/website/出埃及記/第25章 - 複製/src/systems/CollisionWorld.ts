import type { Vector3Data } from '../types/core';
import type { WorldDefinition } from '../types/locations';

export interface WorldCollider { id: string; minX: number; maxX: number; minZ: number; maxZ: number; }

export class CollisionWorld {
  constructor(readonly world: WorldDefinition, readonly colliders: readonly WorldCollider[], readonly radius = 0.38) {}

  resolve(previous: Vector3Data, desired: Vector3Data): Vector3Data {
    const { minX, maxX, minZ, maxZ } = this.world.bounds;
    const bounded = { x: clamp(desired.x, minX + this.radius, maxX - this.radius), y: previous.y, z: clamp(desired.z, minZ + this.radius, maxZ - this.radius) };
    const xOnly = { ...bounded, z: previous.z };
    const afterX = this.#blocked(xOnly) ? { ...bounded, x: previous.x } : bounded;
    const zOnly = { ...afterX, z: bounded.z };
    return this.#blocked(zOnly) ? { ...afterX, z: previous.z } : zOnly;
  }

  #blocked(position: Vector3Data): boolean {
    return this.colliders.some((collider) => position.x > collider.minX - this.radius && position.x < collider.maxX + this.radius && position.z > collider.minZ - this.radius && position.z < collider.maxZ + this.radius);
  }
}

export const createTabernacleColliders = (): WorldCollider[] => [
  { id: 'burnt-altar', minX: -2.1, maxX: 2.1, minZ: 7.1, maxZ: 11.1 },
  { id: 'laver', minX: -1.1, maxX: 1.1, minZ: -1.1, maxZ: 1.1 },
  { id: 'sanctuary-wall', minX: -3.1, maxX: 3.1, minZ: -10.2, maxZ: -2.1 },
];

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }
