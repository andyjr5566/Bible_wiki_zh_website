import type { Vector3Data } from '../types/core';
import type { MapMarkerView } from '../types/experience';
import type { WorldDefinition } from '../types/locations';

export class MapModeManager {
  constructor(readonly world: WorldDefinition) {}
  worldToMap(position: Vector3Data): { x: number; y: number } {
    const { minX, maxX, minZ, maxZ } = this.world.bounds;
    return { x: (position.x - minX) / (maxX - minX), y: (maxZ - position.z) / (maxZ - minZ) };
  }
  mapToWorld(point: { x: number; y: number }, y = 0): Vector3Data {
    const { minX, maxX, minZ, maxZ } = this.world.bounds;
    return { x: minX + point.x * (maxX - minX), y, z: maxZ - point.y * (maxZ - minZ) };
  }
  createMarkers(player: Vector3Data): MapMarkerView[] {
    return [
      ...this.world.locations.map((location) => ({ id: location.id, label: location.name, ...this.worldToMap(location.position), kind: 'location' as const })),
      { id: 'player', label: '你的位置', ...this.worldToMap(player), kind: 'player' as const },
    ];
  }
}
