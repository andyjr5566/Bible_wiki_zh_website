import * as THREE from 'three';
import type { AssetDefinition, AssetProfile, AssetRuntimeState } from '../../types/assets';
import { applySourceToWorld, getWorldBounds } from '../../scene/WorldAlignment';
import { EventChannel, type Unsubscribe } from '../../utils/EventChannel';
import { AssetManifest } from './AssetManifest';
import type { AssetLoader, LoadedAsset } from './AssetLoader';

export class AssetRuntimeManager {
  readonly #events = new EventChannel<Readonly<AssetRuntimeState>>();
  readonly #profileRoot = new THREE.Group();
  readonly #detailRoot = new THREE.Group();
  readonly #libraryRoot = new THREE.Group();
  readonly #mounted = new Map<string, LoadedAsset>();
  readonly #loadingAssetIds = new Set<string>();
  readonly #originalShellMaterialStates = new Map<THREE.Material, { opacity: number; transparent: boolean; depthWrite: boolean }>();
  readonly #originalShellNodeVisibility = new Map<THREE.Object3D, boolean>();
  readonly #partHighlightMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
  #state: AssetRuntimeState;
  #revision = 0;
  #detailGeneration = 0;
  #detailRequest: { assetId: string; generation: number } | null = null;

  constructor(readonly manifest: AssetManifest, readonly loader: AssetLoader, parent: THREE.Object3D, initialProfile: AssetProfile) {
    this.#profileRoot.name = 'profile-assets'; this.#detailRoot.name = 'on-demand-details'; this.#libraryRoot.name = 'runtime-library-assets';
    parent.add(this.#profileRoot, this.#detailRoot, this.#libraryRoot);
    this.#state = { phase: 'idle', profile: initialProfile, activeAssetIds: [], boundsByAssetId: {}, progress: null, error: null, diagnostics: { selectedAssetId: null, detailGeneration: 0, pendingAssetIds: [] } };
  }

  get snapshot(): Readonly<AssetRuntimeState> { return cloneState(this.#state); }
  subscribe(listener: (state: Readonly<AssetRuntimeState>) => void): Unsubscribe { listener(this.snapshot); return this.#events.subscribe(listener); }

  async selectProfile(profile: AssetProfile): Promise<void> {
    const revision = ++this.#revision;
    this.#detailGeneration += 1;
    this.#detailRequest = null;
    const plan = this.manifest.createLoadPlan(profile);
    this.#setState({ phase: 'loading', profile, progress: null, error: null });
    this.#clearDetails();
    this.#cancelPendingNotIn(new Set(plan.map(({ id }) => id)));
    this.#unmountProfileNotIn(new Set(plan.map(({ id }) => id)));
    try {
      for (const definition of plan) {
        await this.#mount(definition, this.#profileRoot, revision);
        if (revision !== this.#revision) return;
      }
      if (revision === this.#revision) this.#setState({ phase: 'ready', progress: null, error: null });
    } catch (error) {
      if (revision !== this.#revision) return;
      const assetId = plan.find((asset) => !this.#mounted.has(asset.id))?.id ?? 'unknown-asset';
      this.#setState({ phase: 'error', progress: null, error: { assetId, message: toMessage(error), fallbackAvailable: profile !== 'fallback-low' } });
    }
  }

  async loadDetail(assetId: string): Promise<void> {
    const definition = this.manifest.require(assetId);
    if (definition.qualityTier !== 'detail' || definition.runtimePolicy !== 'on-demand') throw new Error(`${assetId} is not an on-demand detail asset.`);
    if (this.#state.profile !== 'desktop-structural') {
      this.#setState({ phase: 'error', error: { assetId, message: 'Detail assets are available in structural mode so they do not overlap the complete hero model.', fallbackAvailable: true } });
      return;
    }
    const generation = ++this.#detailGeneration;
    this.#detailRequest = { assetId, generation };
    this.#clearDetails(assetId);
    this.#cancelPendingDetailsExcept(assetId);
    const revision = this.#revision;
    this.#setState({ phase: 'loading', progress: null, error: null, diagnostics: { ...this.#state.diagnostics, selectedAssetId: assetId, detailGeneration: generation } });
    try {
      await this.#mount(definition, this.#detailRoot, revision);
      if (revision === this.#revision && generation === this.#detailGeneration && this.#detailRequest?.assetId === assetId) this.#setState({ phase: 'ready', progress: null, error: null });
      else if (this.#detailRequest?.assetId !== assetId) this.unload(assetId);
    } catch (error) {
      if (revision === this.#revision && generation === this.#detailGeneration && this.#detailRequest?.assetId === assetId) this.#setState({ phase: 'error', progress: null, error: { assetId, message: toMessage(error), fallbackAvailable: true } });
    }
  }

  async loadLibrary(assetId: string): Promise<THREE.Group | null> {
    const definition = this.manifest.require(assetId);
    if (definition.qualityTier !== 'library' || definition.runtimePolicy !== 'deferred') throw new Error(`${assetId} is not an approved deferred library asset.`);
    const existing = this.#mounted.get(assetId); if (existing) return existing.resource;
    const revision = this.#revision;
    try {
      await this.#mount(definition, this.#libraryRoot, revision);
      return this.#mounted.get(assetId)?.resource ?? null;
    } catch { return null; }
  }

  getResource(assetId: string): THREE.Group | null { return this.#mounted.get(assetId)?.resource ?? null; }

  getPartBounds(assetId: string, nodeNames: readonly string[]): AssetRuntimeState['boundsByAssetId'][string] | null {
    if (!nodeNames.length) return null;
    const resource = this.getResource(assetId);
    if (!resource) return null;
    const names = new Set(nodeNames);
    const box = new THREE.Box3();
    resource.traverse((node) => { if (names.has(node.name)) box.expandByObject(node); });
    if (box.isEmpty()) return null;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    return { min: vector(box.min), max: vector(box.max), center: vector(center), size: vector(size) };
  }

  pickPart(assetId: string, parts: readonly { partId: string; nodeNames: readonly string[] }[], camera: THREE.Camera, clientX: number, clientY: number, rect: DOMRect): string | null {
    const resource = this.getResource(assetId);
    if (!resource || !parts.length || rect.width <= 0 || rect.height <= 0) return null;
    const nodes = new Map<string, string>();
    parts.forEach((part) => part.nodeNames.forEach((name) => nodes.set(name, part.partId)));
    if (!nodes.size) return null;
    const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(pointer, camera);
    const intersections = raycaster.intersectObject(resource, true);
    for (const hit of intersections) {
      const partId = nodes.get(hit.object.name);
      if (partId) return partId;
    }
    return null;
  }

  /** Highlight only explicitly mapped nodes; an empty map is intentionally a no-op. */
  highlightPart(assetId: string, nodeNames: readonly string[]): void {
    this.clearPartHighlight();
    if (!nodeNames.length) return;
    const names = new Set(nodeNames);
    const resource = this.getResource(assetId);
    if (!resource) return;
    resource.traverse((node) => {
      if (!(node instanceof THREE.Mesh) || !names.has(node.name)) return;
      const original = node.material;
      this.#partHighlightMaterials.set(node, original);
      const materials = Array.isArray(original) ? original.map((material) => material.clone()) : original.clone();
      node.material = materials;
      const highlighted = Array.isArray(materials) ? materials : [materials];
      highlighted.forEach((material) => {
        if ('color' in material) material.color.set(0xffd86b);
        if ('emissive' in material) material.emissive.set(0x6b4b12);
        if ('emissiveIntensity' in material) material.emissiveIntensity = 0.65;
      });
    });
  }

  clearPartHighlight(): void {
    this.#partHighlightMaterials.forEach((material, mesh) => {
      const highlighted = mesh.material;
      if (Array.isArray(highlighted)) highlighted.forEach((item) => item.dispose());
      else highlighted.dispose();
      mesh.material = material;
    });
    this.#partHighlightMaterials.clear();
  }
  setProfileVisible(visible: boolean): void { this.#profileRoot.visible = visible; }

  /**
   * Reveals the interior while an object is being studied. Only materials
   * belonging to the fabric/rope/structural shell are changed; the learned
   * object and its on-demand detail asset remain fully opaque.
   */
  setInteriorReveal(reveal: boolean): void {
    if (!reveal) {
      this.#originalShellNodeVisibility.forEach((visible, node) => { node.visible = visible; });
      this.#originalShellNodeVisibility.clear();
      this.#originalShellMaterialStates.forEach((original, material) => {
        material.opacity = original.opacity;
        material.transparent = original.transparent;
        material.depthWrite = original.depthWrite;
        material.needsUpdate = true;
      });
      this.#originalShellMaterialStates.clear();
      return;
    }

    this.#profileRoot.traverse((node) => {
      if (isShellNode(node.name) && !this.#originalShellNodeVisibility.has(node)) {
        this.#originalShellNodeVisibility.set(node, node.visible);
        node.visible = false;
      }
      if (!(node instanceof THREE.Mesh)) return;
      const materials = Array.isArray(node.material) ? node.material : [node.material];
      materials.forEach((material) => {
        if (!isShellMaterial(material.name)) return;
        if (!this.#originalShellMaterialStates.has(material)) {
          this.#originalShellMaterialStates.set(material, {
            opacity: material.opacity,
            transparent: material.transparent,
            depthWrite: material.depthWrite,
          });
        }
        material.transparent = true;
        material.opacity = 0.02;
        material.depthWrite = false;
        material.needsUpdate = true;
      });
    });
  }

  unload(assetId: string): void {
    const mounted = this.#mounted.get(assetId);
    if (!mounted) return;
    this.loader.unload(assetId); this.#mounted.delete(assetId);
    const { [assetId]: _removed, ...boundsByAssetId } = this.#state.boundsByAssetId;
    this.#setState({ activeAssetIds: [...this.#mounted.keys()], boundsByAssetId });
  }

  dispose(): void {
    this.#revision += 1;
    this.#detailGeneration += 1;
    this.#detailRequest = null;
    this.clearPartHighlight();
    this.setInteriorReveal(false);
    [...this.#mounted.keys()].forEach((assetId) => this.unload(assetId));
    this.loader.dispose(); this.#profileRoot.removeFromParent(); this.#detailRoot.removeFromParent(); this.#libraryRoot.removeFromParent(); this.#events.clear();
  }

  #mount(definition: AssetDefinition, parent: THREE.Object3D, revision: number): Promise<void> {
    const existing = this.#mounted.get(definition.id);
    if (existing) {
      if (existing.resource.parent !== parent) parent.add(existing.resource);
      return Promise.resolve();
    }
    this.#loadingAssetIds.add(definition.id);
    return this.loader.load(definition, { onProgress: (progress) => { if (revision === this.#revision) this.#setState({ progress }); } })
      .then((asset) => {
        if (revision !== this.#revision) { this.loader.unload(definition.id); return; }
        applySourceToWorld(asset.resource, definition);
        parent.add(asset.resource); this.#mounted.set(definition.id, asset);
        const bounds = getWorldBounds(asset.resource);
        this.#setState({ activeAssetIds: [...this.#mounted.keys()], boundsByAssetId: { ...this.#state.boundsByAssetId, [definition.id]: bounds } });
      })
      .finally(() => this.#loadingAssetIds.delete(definition.id));
  }

  #unmountProfileNotIn(desired: Set<string>): void {
    [...this.#mounted.keys()].forEach((assetId) => {
      const definition = this.manifest.get(assetId);
      if (definition && ['hero', 'structural', 'fallback'].includes(definition.qualityTier) && !desired.has(assetId)) this.unload(assetId);
    });
  }

  #clearDetails(keepAssetId?: string): void {
    [...this.#mounted.keys()].forEach((assetId) => { if (assetId !== keepAssetId && this.manifest.get(assetId)?.qualityTier === 'detail') this.unload(assetId); });
  }

  #cancelPendingNotIn(desired: Set<string>): void {
    [...this.#loadingAssetIds].forEach((assetId) => { if (!desired.has(assetId)) this.loader.unload(assetId); });
  }

  #cancelPendingDetailsExcept(assetId: string): void {
    [...this.#loadingAssetIds].forEach((pendingId) => {
      if (pendingId !== assetId && this.manifest.get(pendingId)?.qualityTier === 'detail') this.loader.unload(pendingId);
    });
  }

  #setState(patch: Partial<AssetRuntimeState>): void {
    const diagnostics = patch.diagnostics ?? this.#state.diagnostics;
    this.#state = { ...this.#state, ...patch, diagnostics: { ...diagnostics, pendingAssetIds: [...this.#loadingAssetIds] } };
    this.#events.emit(this.snapshot);
  }
}

function cloneState(state: AssetRuntimeState): AssetRuntimeState {
  return { ...state, activeAssetIds: [...state.activeAssetIds], boundsByAssetId: { ...state.boundsByAssetId }, progress: state.progress ? { ...state.progress } : null, error: state.error ? { ...state.error } : null, diagnostics: { ...state.diagnostics, pendingAssetIds: [...state.diagnostics.pendingAssetIds] } };
}

function toMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }

function vector(value: THREE.Vector3): { x: number; y: number; z: number } { return { x: value.x, y: value.y, z: value.z }; }

function isShellMaterial(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return [
    'inner_curtain',
    'outer_curtain',
    'courtlinen',
    'court_linen',
    'first_curtain_mat',
    'thirdcovering',
    'third_covering',
    'fourthcovering',
    'fourth_covering',
    'rope',
    'dark_logs',
    'bright_logs',
    'root',
  ].some((token) => normalized === token || normalized.includes(token));
}

function isShellNode(name: string): boolean {
  const normalized = name.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return ['curtain', 'covering', 'courtcurtain', 'portal', 'plane', 'logs', 'rope', 'tube', 'stake', 'copper_socket', 'socket'].some((token) => normalized.includes(token));
}
