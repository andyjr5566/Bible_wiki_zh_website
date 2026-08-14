import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { AssetDefinition } from '../../types/assets';

export type AssetLoadPhase = 'download' | 'parse' | 'validate' | 'ready' | 'error';

export interface AssetLoadProgress {
  assetId: string;
  phase: AssetLoadPhase;
  loadedBytes: number;
  totalBytes: number | null;
  ratio: number | null;
}

export interface AssetDiagnostics {
  meshCount: number;
  materialCount: number;
  textureCount: number;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  issues: string[];
}

export interface LoadedAsset {
  definition: AssetDefinition;
  resource: THREE.Group;
  diagnostics: AssetDiagnostics;
}

export interface AssetLoadOptions {
  signal?: AbortSignal;
  onProgress?: (progress: AssetLoadProgress) => void;
}

export interface AssetLoader {
  load(definition: AssetDefinition, options?: AssetLoadOptions): Promise<LoadedAsset>;
  unload(assetId: string): void;
  dispose(): void;
}

export class AssetLoadError extends Error {
  constructor(readonly assetId: string, message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'AssetLoadError';
  }
}

interface PendingLoad { controller: AbortController; promise: Promise<LoadedAsset>; }

export interface GLTFAssetLoaderOptions { forceFailureAssetId?: string; }

export class GLTFAssetLoader implements AssetLoader {
  readonly #loader = new GLTFLoader();
  readonly #loaded = new Map<string, LoadedAsset>();
  readonly #pending = new Map<string, PendingLoad>();
  readonly #forceFailureAssetId: string | undefined;

  constructor(options: GLTFAssetLoaderOptions = {}) { this.#forceFailureAssetId = options.forceFailureAssetId; }

  load(definition: AssetDefinition, options: AssetLoadOptions = {}): Promise<LoadedAsset> {
    if (options.signal?.aborted) return Promise.reject(new AssetLoadError(definition.id, `Loading cancelled: ${definition.id}`));
    const cached = this.#loaded.get(definition.id);
    if (cached) {
      options.onProgress?.(readyProgress(definition.id));
      return Promise.resolve(cached);
    }
    const inFlight = this.#pending.get(definition.id);
    if (inFlight) return this.#withCancellation(definition.id, inFlight.promise, options.signal);

    const controller = new AbortController();
    const promise = this.#load(definition, controller.signal, options.onProgress)
      .then((asset) => { this.#loaded.set(definition.id, asset); return asset; })
      .finally(() => this.#pending.delete(definition.id));
    this.#pending.set(definition.id, { controller, promise });
    return this.#withCancellation(definition.id, promise, options.signal);
  }

  unload(assetId: string): void {
    this.#pending.get(assetId)?.controller.abort();
    const asset = this.#loaded.get(assetId);
    if (!asset) return;
    disposeObject3D(asset.resource);
    this.#loaded.delete(assetId);
  }

  dispose(): void {
    this.#pending.forEach(({ controller }) => controller.abort());
    [...this.#loaded.keys()].forEach((assetId) => this.unload(assetId));
    this.#pending.clear();
  }

  async #load(definition: AssetDefinition, signal: AbortSignal, onProgress?: (progress: AssetLoadProgress) => void): Promise<LoadedAsset> {
    try {
      if (definition.id === this.#forceFailureAssetId) throw new AssetLoadError(definition.id, `Diagnostic forced load failure: ${definition.id}`);
      onProgress?.({ assetId: definition.id, phase: 'download', loadedBytes: 0, totalBytes: null, ratio: 0 });
      const url = new URL(definition.url, window.location.href).toString();
      const buffer = await downloadArrayBuffer(url, definition.id, signal, onProgress);
      onProgress?.({ assetId: definition.id, phase: 'parse', loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, ratio: 1 });
      const gltf = await this.#loader.parseAsync(buffer, url.slice(0, url.lastIndexOf('/') + 1));
      if (!gltf.scene) throw new AssetLoadError(definition.id, `GLTF scene is empty: ${definition.id}`);
      gltf.scene.traverse((node) => { if (node instanceof THREE.Mesh) { node.castShadow = true; node.receiveShadow = true; } });
      onProgress?.({ assetId: definition.id, phase: 'validate', loadedBytes: buffer.byteLength, totalBytes: buffer.byteLength, ratio: 1 });
      const diagnostics = validateScene(definition.id, gltf.scene);
      onProgress?.(readyProgress(definition.id, buffer.byteLength));
      return { definition, resource: gltf.scene, diagnostics };
    } catch (error) {
      if (error instanceof AssetLoadError) throw error;
      const message = signal.aborted ? `Loading cancelled: ${definition.id}` : `Failed to load ${definition.id}: ${toMessage(error)}`;
      onProgress?.({ assetId: definition.id, phase: 'error', loadedBytes: 0, totalBytes: null, ratio: null });
      throw new AssetLoadError(definition.id, message, error);
    }
  }

  #withCancellation(assetId: string, promise: Promise<LoadedAsset>, signal?: AbortSignal): Promise<LoadedAsset> {
    if (!signal) return promise;
    return new Promise<LoadedAsset>((resolve, reject) => {
      const onAbort = () => reject(new AssetLoadError(assetId, `Loading cancelled: ${assetId}`));
      signal.addEventListener('abort', onAbort, { once: true });
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
    });
  }
}

async function downloadArrayBuffer(url: string, assetId: string, signal: AbortSignal, onProgress?: (progress: AssetLoadProgress) => void): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new AssetLoadError(assetId, `HTTP ${response.status} while loading ${assetId}`);
  const totalBytes = Number(response.headers.get('content-length')) || null;
  if (!response.body) {
    const buffer = await response.arrayBuffer();
    onProgress?.({ assetId, phase: 'download', loadedBytes: buffer.byteLength, totalBytes, ratio: totalBytes ? 1 : null });
    return buffer;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value); loadedBytes += value.byteLength;
    onProgress?.({ assetId, phase: 'download', loadedBytes, totalBytes, ratio: totalBytes ? loadedBytes / totalBytes : null });
  }
  const bytes = new Uint8Array(loadedBytes);
  let offset = 0;
  chunks.forEach((chunk) => { bytes.set(chunk, offset); offset += chunk.byteLength; });
  return bytes.buffer;
}

export function validateScene(assetId: string, resource: THREE.Object3D): AssetDiagnostics {
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const issues: string[] = [];
  let meshCount = 0;
  resource.updateMatrixWorld(true);
  resource.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    meshCount += 1;
    if (!node.geometry.getAttribute('position')) issues.push(`${node.name || 'unnamed mesh'} has no position attribute`);
    const nodeMaterials = Array.isArray(node.material) ? node.material : [node.material];
    nodeMaterials.forEach((material) => {
      if (!material) { issues.push(`${node.name || 'unnamed mesh'} has no material`); return; }
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  if (!meshCount) throw new AssetLoadError(assetId, `GLTF contains no meshes: ${assetId}`);
  const box = new THREE.Box3().setFromObject(resource);
  if (box.isEmpty()) throw new AssetLoadError(assetId, `GLTF bounds are empty: ${assetId}`);
  return {
    meshCount,
    materialCount: materials.size,
    textureCount: textures.size,
    bounds: { min: box.min.toArray() as [number, number, number], max: box.max.toArray() as [number, number, number] },
    issues,
  };
}

export function disposeObject3D(resource: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  resource.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    geometries.add(node.geometry);
    (Array.isArray(node.material) ? node.material : [node.material]).forEach((material) => {
      if (!material) return;
      materials.add(material);
      Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value); });
    });
  });
  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
  resource.removeFromParent();
}

function readyProgress(assetId: string, totalBytes = 0): AssetLoadProgress {
  return { assetId, phase: 'ready', loadedBytes: totalBytes, totalBytes: totalBytes || null, ratio: 1 };
}

function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
