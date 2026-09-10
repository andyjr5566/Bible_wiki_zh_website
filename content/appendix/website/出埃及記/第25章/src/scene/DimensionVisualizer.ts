import * as THREE from 'three';
import type { DimensionSpec } from '../types/dimensions';

export type DimensionUnit = 'cubit' | 'cm' | 'inch';
export type DimensionBoxSpec = DimensionSpec;
const CUBIT_IN_CM = 45;
const CM_IN_INCH = 0.393701;

export class DimensionVisualizer {
  readonly root = new THREE.Group();
  #activeSpecId: string | null = null;
  #currentUnit: DimensionUnit = 'cubit';
  readonly #linesGroup = new THREE.Group();
  readonly #labelsGroup = new THREE.Group();
  readonly #specs: Map<string, DimensionBoxSpec>;

  constructor(parent: THREE.Object3D, specs: readonly DimensionBoxSpec[]) {
    this.#specs = new Map(specs.map((spec) => [spec.id, spec]));
    this.root.name = 'dimension-visualizer';
    this.root.add(this.#linesGroup, this.#labelsGroup);
    parent.add(this.root);
  }

  setUnit(unit: DimensionUnit): void {
    if (unit === this.#currentUnit) return;
    this.#currentUnit = unit;
    const activeId = this.#activeSpecId;
    this.clear();
    if (activeId) this.showObjectDimensions(activeId);
  }

  showObjectDimensions(specId: string): void {
    if (specId === this.#activeSpecId) return;
    this.clear();
    const spec = this.#specs.get(specId);
    if (!spec || spec.status !== 'verified' || !spec.sizeCubits) return;
    this.#activeSpecId = specId;
    const scale = 0.45;
    const sx = spec.sizeCubits.x * scale;
    const sy = spec.sizeCubits.y * scale;
    const sz = spec.sizeCubits.z * scale;
    const { x, y, z } = spec.center;
    const minX = x - sx / 2; const maxX = x + sx / 2;
    const minY = Math.max(0.05, y - sy / 2); const maxY = y + sy / 2;
    const minZ = z - sz / 2; const maxZ = z + sz / 2;
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffdf78, linewidth: 2, transparent: true, opacity: 0.9 });
    this.#createDimensionLine(new THREE.Vector3(minX, minY, maxZ + 0.12), new THREE.Vector3(maxX, minY, maxZ + 0.12), spec.customLabels?.length ?? this.#formatDim('長度', spec.sizeCubits.x), lineMat);
    this.#createDimensionLine(new THREE.Vector3(maxX + 0.12, minY, maxZ + 0.12), new THREE.Vector3(maxX + 0.12, maxY, maxZ + 0.12), spec.customLabels?.height ?? this.#formatDim('高度', spec.sizeCubits.y), lineMat);
    this.#createDimensionLine(new THREE.Vector3(maxX + 0.12, minY, minZ), new THREE.Vector3(maxX + 0.12, minY, maxZ), spec.customLabels?.width ?? this.#formatDim('寬度', spec.sizeCubits.z), lineMat);
    this.#createCornerBrackets(minX, maxX, minY, maxY, minZ, maxZ);
  }

  clear(): void {
    this.#activeSpecId = null;
    while (this.#linesGroup.children.length) {
      const child = this.#linesGroup.children[0]!;
      this.#linesGroup.remove(child);
      if (child instanceof THREE.Line) { child.geometry.dispose(); if (child.material instanceof THREE.Material) child.material.dispose(); }
    }
    while (this.#labelsGroup.children.length) {
      const child = this.#labelsGroup.children[0]!;
      this.#labelsGroup.remove(child);
      if (child instanceof THREE.Sprite) { child.geometry.dispose(); if (child.material.map) child.material.map.dispose(); child.material.dispose(); }
    }
  }

  #formatDim(prefix: string, cubits: number): string {
    if (this.#currentUnit === 'cubit') return `${prefix} ${cubits} 肘`;
    if (this.#currentUnit === 'cm') return `${prefix} ${Math.round(cubits * CUBIT_IN_CM * 10) / 10} cm`;
    return `${prefix} ${Math.round(cubits * CUBIT_IN_CM * CM_IN_INCH * 10) / 10} in`;
  }

  #createDimensionLine(start: THREE.Vector3, end: THREE.Vector3, text: string, material: THREE.Material): void {
    this.#linesGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([start, end]), material));
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const tickDir = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize().multiplyScalar(0.08);
    if (tickDir.lengthSq() < 0.001) tickDir.set(0.08, 0, 0);
    for (const point of [start, end]) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3().subVectors(point, tickDir), new THREE.Vector3().addVectors(point, tickDir)]);
      this.#linesGroup.add(new THREE.Line(geo, material));
    }
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const sprite = this.#createTextSprite(text); sprite.position.copy(mid).add(new THREE.Vector3(0, 0.12, 0)); this.#labelsGroup.add(sprite);
  }

  #createCornerBrackets(minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number): void {
    const len = 0.15; const points: THREE.Vector3[] = [];
    for (const c of [new THREE.Vector3(minX, minY, minZ), new THREE.Vector3(maxX, minY, minZ), new THREE.Vector3(minX, maxY, minZ), new THREE.Vector3(maxX, maxY, minZ), new THREE.Vector3(minX, minY, maxZ), new THREE.Vector3(maxX, minY, maxZ), new THREE.Vector3(minX, maxY, maxZ), new THREE.Vector3(maxX, maxY, maxZ)]) {
      points.push(c, new THREE.Vector3(c.x + (c.x === minX ? len : -len), c.y, c.z), c, new THREE.Vector3(c.x, c.y + (c.y === minY ? len : -len), c.z), c, new THREE.Vector3(c.x, c.y, c.z + (c.z === minZ ? len : -len)));
    }
    this.#linesGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xd2b875, transparent: true, opacity: 0.45 })));
  }

  #createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) { ctx.fillStyle = 'rgba(18, 20, 14, 0.85)'; ctx.roundRect(8, 8, 368, 80, 12); ctx.fill(); ctx.strokeStyle = '#d2b875'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = '#fff4d6'; ctx.font = 'bold 28px "Noto Sans TC", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 192, 48); }
    const texture = new THREE.CanvasTexture(canvas); texture.minFilter = THREE.LinearFilter;
    // Labels retain a small screen size when a close-up camera approaches them.
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, sizeAttenuation: false }));
    sprite.scale.set(0.12, 0.03, 1);
    return sprite;
  }

  dispose(): void { this.clear(); this.root.removeFromParent(); }
}
