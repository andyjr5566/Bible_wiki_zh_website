import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { AssetLoadError, disposeObject3D, GLTFAssetLoader, validateScene } from './AssetLoader';
import { loadProjectData } from '../../data/loadProjectData';

describe('GLTF asset resource validation and disposal', () => {
  it('collects render diagnostics and disposes geometry, material, and textures', () => {
    const resource = new THREE.Group();
    const geometry = new THREE.BoxGeometry(1, 1, 1); const texture = new THREE.Texture(); const material = new THREE.MeshStandardMaterial({ map: texture });
    const disposeGeometry = vi.spyOn(geometry, 'dispose'); const disposeMaterial = vi.spyOn(material, 'dispose'); const disposeTexture = vi.spyOn(texture, 'dispose');
    resource.add(new THREE.Mesh(geometry, material));
    const diagnostics = validateScene('fixture', resource);
    expect(diagnostics.meshCount).toBe(1); expect(diagnostics.materialCount).toBe(1); expect(diagnostics.textureCount).toBe(1); expect(diagnostics.issues).toEqual([]);
    disposeObject3D(resource);
    expect(disposeGeometry).toHaveBeenCalledOnce(); expect(disposeMaterial).toHaveBeenCalledOnce(); expect(disposeTexture).toHaveBeenCalledOnce();
  });
  it('surfaces an explicit load error without silently selecting the fallback model', async () => {
    const definition = loadProjectData().assets.assets.find(({ id }) => id === 'tabernacle-main')!;
    const loader = new GLTFAssetLoader({ forceFailureAssetId: definition.id });
    await expect(loader.load(definition)).rejects.toBeInstanceOf(AssetLoadError);
    loader.dispose();
  });
});
