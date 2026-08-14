import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../data/loadProjectData';
import { applySourceToWorld, assertCanonicalWorld, boundsContain, createLocationAnchors, getWorldBounds } from './WorldAlignment';

describe('canonical world alignment', () => {
  it('orders the east gate, court, holy place, and most holy place along +Z to -Z', () => {
    const world = loadProjectData().world;
    expect(() => assertCanonicalWorld(world)).not.toThrow();
    const anchors = createLocationAnchors(world);
    expect(anchors.get('east-gate')?.position.z).toBeGreaterThan(anchors.get('most-holy-place')!.position.z);
    expect([...anchors.values()].every((anchor) => boundsContain(world.bounds, anchor.position))).toBe(true);
  });

  it('applies the manifest source-to-world transform before calculating bounds', () => {
    const main = loadProjectData().assets.assets.find(({ id }) => id === 'tabernacle-main')!;
    const resource = new THREE.Group(); resource.add(new THREE.Mesh(new THREE.BoxGeometry(4, 2, 6), new THREE.MeshBasicMaterial()));
    applySourceToWorld(resource, main);
    const bounds = getWorldBounds(resource);
    expect(bounds.size.x).toBeCloseTo(1.8);
    expect(bounds.size.y).toBeCloseTo(0.6);
    expect(bounds.size.z).toBeCloseTo(1.2);
  });
});
