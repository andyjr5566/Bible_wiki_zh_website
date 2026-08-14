import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { MapModeManager } from './MapModeManager';

describe('canonical world/map projection', () => {
  it('round-trips world coordinates through the map', () => {
    const manager = new MapModeManager(loadProjectData().world); const world = { x: 7, y: 0, z: -13 };
    expect(manager.mapToWorld(manager.worldToMap(world))).toEqual(world);
  });
  it('keeps stored map points aligned with the canonical east-to-west route', () => {
    const world = loadProjectData().world; const manager = new MapModeManager(world);
    world.locations.forEach((location) => {
      expect(manager.worldToMap(location.position).x).toBeCloseTo(location.mapPoint.x, 6);
      expect(manager.worldToMap(location.position).y).toBeCloseTo(location.mapPoint.y, 6);
    });
    expect(world.locations[0]!.mapPoint.y).toBeLessThan(world.locations.at(-1)!.mapPoint.y);
  });
  it('derives the player marker from the canonical transform', () => {
    const manager = new MapModeManager(loadProjectData().world);
    const marker = manager.createMarkers({ x: 0, y: 1.7, z: 18 }).find(({ id }) => id === 'player');
    expect(marker?.x).toBeCloseTo(0.5, 6);
    expect(marker?.y).toBeCloseTo(0.090909, 5);
    expect(marker?.kind).toBe('player');
  });
});
