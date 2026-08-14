import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { CollisionWorld, createTabernacleColliders } from './CollisionWorld';

describe('CollisionWorld', () => {
  const world = new CollisionWorld(loadProjectData().world, createTabernacleColliders());

  it('keeps the player inside the canonical court bounds', () => {
    expect(world.resolve({ x: 0, y: 1.7, z: 0 }, { x: 80, y: 1.7, z: -80 })).toEqual({ x: 11.62, y: 1.7, z: -21.62 });
  });

  it('blocks movement into the altar while allowing axis sliding', () => {
    const result = world.resolve({ x: 3, y: 1.7, z: 12 }, { x: 1.5, y: 1.7, z: 10.5 });
    expect(result.x).toBe(1.5);
    expect(result.z).toBe(12);
  });
});
