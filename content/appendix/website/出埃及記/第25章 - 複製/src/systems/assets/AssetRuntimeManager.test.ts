import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { loadProjectData } from '../../data/loadProjectData';
import type { AssetDefinition } from '../../types/assets';
import type { AssetLoader, LoadedAsset } from './AssetLoader';
import { AssetManifest } from './AssetManifest';
import { AssetRuntimeManager } from './AssetRuntimeManager';

class FixtureLoader implements AssetLoader {
  readonly loaded = new Map<string, LoadedAsset>();
  readonly unloaded: string[] = [];
  readonly loadCalls: string[] = [];
  async load(definition: AssetDefinition): Promise<LoadedAsset> {
    this.loadCalls.push(definition.id);
    const material = new THREE.MeshBasicMaterial(); material.name = 'Inner_Curtain';
    const shellMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material); shellMesh.name = 'OuterCurtain_0';
    const resource = new THREE.Group(); resource.add(shellMesh);
    const asset = { definition, resource, diagnostics: { meshCount: 1, materialCount: 1, textureCount: 0, bounds: { min: [-1, -1, -1] as [number, number, number], max: [1, 1, 1] as [number, number, number] }, issues: [] } };
    this.loaded.set(definition.id, asset); return asset;
  }
  unload(assetId: string): void { this.unloaded.push(assetId); this.loaded.get(assetId)?.resource.removeFromParent(); this.loaded.delete(assetId); }
  dispose(): void { [...this.loaded.keys()].forEach((id) => this.unload(id)); }
}

describe('runtime asset profiles', () => {
  it('loads hero, structural, fallback, and details only under their explicit policies', async () => {
    const manifest = new AssetManifest(loadProjectData().assets.assets); const loader = new FixtureLoader(); const root = new THREE.Group();
    const runtime = new AssetRuntimeManager(manifest, loader, root, 'desktop-high');
    await runtime.selectProfile('desktop-high');
    expect(runtime.snapshot.activeAssetIds).toEqual(['tabernacle-main']);
    const shellMesh = runtime.getResource('tabernacle-main')?.children[0] as THREE.Mesh;
    const shellMaterial = shellMesh.material as THREE.Material;
    runtime.setInteriorReveal(true);
    expect(shellMaterial.opacity).toBeCloseTo(0.02);
    expect(shellMaterial.transparent).toBe(true);
    expect(shellMaterial.depthWrite).toBe(false);
    expect(shellMesh.visible).toBe(false);
    runtime.setInteriorReveal(false);
    expect(shellMaterial.opacity).toBe(1);
    expect(shellMaterial.transparent).toBe(false);
    expect(shellMaterial.depthWrite).toBe(true);
    expect(shellMesh.visible).toBe(true);
    await runtime.selectProfile('desktop-high');
    expect(loader.loadCalls.filter((id) => id === 'tabernacle-main')).toHaveLength(1);
    await runtime.selectProfile('desktop-structural');
    expect(runtime.snapshot.activeAssetIds).toEqual(['tabernacle-framework']);
    expect(loader.unloaded).toContain('tabernacle-main');
    await runtime.loadDetail('tabernacle-ark-alternative');
    expect(runtime.snapshot.activeAssetIds).toEqual(['tabernacle-framework', 'tabernacle-ark-alternative']);
    await runtime.loadDetail('tabernacle-menorah-detail');
    expect(runtime.snapshot.activeAssetIds).toEqual(['tabernacle-framework', 'tabernacle-menorah-detail']);
    expect(loader.unloaded).toContain('tabernacle-ark-alternative');
    await runtime.selectProfile('fallback-low');
    expect(runtime.snapshot.activeAssetIds).toEqual(['tabernacle-lowpoly']);
    runtime.dispose();
  });
});
