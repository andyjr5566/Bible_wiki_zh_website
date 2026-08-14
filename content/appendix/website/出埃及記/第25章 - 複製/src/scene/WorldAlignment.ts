import * as THREE from 'three';
import type { AssetDefinition, AssetWorldBounds } from '../types/assets';
import type { Vector3Data } from '../types/core';
import type { WorldDefinition } from '../types/locations';

export type WorldBounds = AssetWorldBounds;

export interface LocationAnchor {
  locationId: string;
  position: Vector3Data;
  cameraTarget: Vector3Data;
}

export const canonicalWorld = Object.freeze({ upAxis: '+y', eastAxis: '+z', holyDirection: '-z' } as const);

/** Applies the manifest's source-to-world calibration to a freshly parsed GLTF root. */
export function applySourceToWorld(resource: THREE.Object3D, asset: Pick<AssetDefinition, 'id' | 'transform'>): void {
  const { position, rotation, scale } = asset.transform;
  resource.name = `asset:${asset.id}`;
  resource.position.set(position.x, position.y, position.z);
  resource.rotation.set(rotation.x, rotation.y, rotation.z);
  resource.scale.setScalar(scale);
  resource.updateMatrixWorld(true);
}

export function getWorldBounds(resource: THREE.Object3D): WorldBounds {
  resource.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(resource);
  if (box.isEmpty()) throw new Error(`Cannot calculate empty bounds for ${resource.name || 'unnamed resource'}`);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  return {
    min: vector(box.min), max: vector(box.max), center: vector(center), size: vector(size),
  };
}

export function createLocationAnchors(world: WorldDefinition): Map<string, LocationAnchor> {
  assertCanonicalWorld(world);
  return new Map(world.locations.map((location) => [location.id, {
    locationId: location.id,
    position: { ...location.position },
    cameraTarget: { x: location.position.x, y: location.position.y + 1.5, z: location.position.z },
  }]));
}

export function assertCanonicalWorld(world: WorldDefinition): void {
  if (world.orientation.eastAxis !== canonicalWorld.eastAxis || world.orientation.upAxis !== canonicalWorld.upAxis) {
    throw new Error('World orientation must be Y-up with east gate at +Z.');
  }
  const east = world.locations.find((location) => location.id === 'east-gate');
  const burntAltar = world.locations.find((location) => location.id === 'burnt-altar-location');
  const laver = world.locations.find((location) => location.id === 'laver-location');
  const holy = world.locations.find((location) => location.id === 'holy-place');
  const mostHoly = world.locations.find((location) => location.id === 'most-holy-place');
  if (!east || !burntAltar || !laver || !holy || !mostHoly) throw new Error('Canonical orientation requires east gate through most holy place anchors.');
  const route = [east, burntAltar, laver, holy, mostHoly];
  if (!route.every((location, index) => index === 0 || location.position.z < route[index - 1]!.position.z)) {
    throw new Error('Canonical route must progress from east (+Z) toward most holy place (-Z).');
  }
}

export function boundsContain(bounds: WorldDefinition['bounds'], point: Vector3Data, padding = 0): boolean {
  return point.x >= bounds.minX - padding && point.x <= bounds.maxX + padding && point.z >= bounds.minZ - padding && point.z <= bounds.maxZ + padding;
}

function vector(value: THREE.Vector3): Vector3Data { return { x: value.x, y: value.y, z: value.z }; }
