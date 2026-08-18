import * as THREE from 'three';

export type DimensionUnit = 'cubit' | 'cm' | 'inch';

export interface DimensionBoxSpec {
  id: string;
  name: string;
  center: { x: number; y: number; z: number };
  sizeCubits: { x: number; y: number; z: number }; // Length, Height, Width in cubits
  customLabels?: { length?: string; height?: string; width?: string };
}

const CUBIT_IN_CM = 45.0;
const CM_IN_INCH = 0.393701;

export class DimensionVisualizer {
  readonly root = new THREE.Group();
  #activeSpecId: string | null = null;
  #currentUnit: DimensionUnit = 'cubit';

  readonly #linesGroup = new THREE.Group();
  readonly #labelsGroup = new THREE.Group();

  readonly #specs: Map<string, DimensionBoxSpec> = new Map([
    [
      'ark',
      {
        id: 'ark',
        name: '約櫃 (Ark of the Covenant)',
        center: { x: 0, y: 0.72, z: -9.18 },
        sizeCubits: { x: 2.5, y: 1.5, z: 1.5 }, // 2.5 x 1.5 x 1.5 cubits
      },
    ],
    [
      'shewbread-table',
      {
        id: 'shewbread-table',
        name: '陳設餅桌 (Table of Showbread)',
        center: { x: 1.2, y: 0.78, z: -4.35 },
        sizeCubits: { x: 2.0, y: 1.5, z: 1.0 }, // 2 x 1.5 x 1 cubits
      },
    ],
    [
      'menorah',
      {
        id: 'menorah',
        name: '金燈臺 (Menorah)',
        center: { x: -1.2, y: 0.82, z: -4.35 },
        sizeCubits: { x: 1.8, y: 1.6, z: 0.6 },
        customLabels: {
          length: '七枝燈盞 (7 Lamps)',
          height: '一他連得精金 (1 Talent Gold)',
        },
      },
    ],
    [
      'incense-altar',
      {
        id: 'incense-altar',
        name: '金香壇 (Altar of Incense)',
        center: { x: 0, y: 1.0, z: -5.85 },
        sizeCubits: { x: 1.0, y: 2.0, z: 1.0 }, // 1 x 2 x 1 cubits
      },
    ],
    [
      'burnt-altar',
      {
        id: 'burnt-altar',
        name: '銅燔祭壇 (Altar of Burnt Offering)',
        center: { x: 0, y: 1.05, z: 9.0 },
        sizeCubits: { x: 5.0, y: 3.0, z: 5.0 }, // 5 x 3 x 5 cubits
      },
    ],
    [
      'outer-court',
      {
        id: 'outer-court',
        name: '外院圍欄 (Outer Court)',
        center: { x: 0, y: 1.4, z: 0 },
        sizeCubits: { x: 50.0, y: 5.0, z: 100.0 }, // 100 x 50 cubits (22m x 45m)
      },
    ],
  ]);

  constructor(parent: THREE.Object3D) {
    this.root.name = 'dimension-visualizer';
    this.root.add(this.#linesGroup, this.#labelsGroup);
    parent.add(this.root);
  }

  setUnit(unit: DimensionUnit): void {
    this.#currentUnit = unit;
    if (this.#activeSpecId) {
      this.showObjectDimensions(this.#activeSpecId);
    }
  }

  showObjectDimensions(specId: string): void {
    this.clear();
    const spec = this.#specs.get(specId);
    if (!spec) return;

    this.#activeSpecId = specId;

    // Convert cubits to scene meter units (1 cubit ~= 0.45m in model space)
    const scale = 0.45;
    const sx = spec.sizeCubits.x * scale;
    const sy = spec.sizeCubits.y * scale;
    const sz = spec.sizeCubits.z * scale;

    const { x, y, z } = spec.center;
    const minX = x - sx / 2;
    const maxX = x + sx / 2;
    const minY = Math.max(0.05, y - sy / 2);
    const maxY = y + sy / 2;
    const minZ = z - sz / 2;
    const maxZ = z + sz / 2;

    const lineMat = new THREE.LineBasicMaterial({
      color: 0xffdf78,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
    });

    // 1. Length dimension line (along X at front-bottom)
    this.#createDimensionLine(
      new THREE.Vector3(minX, minY, maxZ + 0.12),
      new THREE.Vector3(maxX, minY, maxZ + 0.12),
      spec.customLabels?.length ?? this.#formatDim('長度', spec.sizeCubits.x),
      lineMat
    );

    // 2. Height dimension line (along Y at right-front)
    this.#createDimensionLine(
      new THREE.Vector3(maxX + 0.12, minY, maxZ + 0.12),
      new THREE.Vector3(maxX + 0.12, maxY, maxZ + 0.12),
      spec.customLabels?.height ?? this.#formatDim('高度', spec.sizeCubits.y),
      lineMat
    );

    // 3. Width/Depth dimension line (along Z at right-bottom)
    this.#createDimensionLine(
      new THREE.Vector3(maxX + 0.12, minY, minZ),
      new THREE.Vector3(maxX + 0.12, minY, maxZ),
      spec.customLabels?.width ?? this.#formatDim('寬度', spec.sizeCubits.z),
      lineMat
    );

    // Subtle bounding box corner bracket accents
    this.#createCornerBrackets(minX, maxX, minY, maxY, minZ, maxZ);
  }

  clear(): void {
    this.#activeSpecId = null;
    while (this.#linesGroup.children.length > 0) {
      const child = this.#linesGroup.children[0];
      if (child) {
        this.#linesGroup.remove(child);
        if (child instanceof THREE.Line) child.geometry.dispose();
      }
    }
    while (this.#labelsGroup.children.length > 0) {
      const child = this.#labelsGroup.children[0];
      if (child) {
        this.#labelsGroup.remove(child);
        if (child instanceof THREE.Sprite) {
          child.geometry.dispose();
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      }
    }
  }

  #formatDim(prefix: string, cubits: number): string {
    if (this.#currentUnit === 'cubit') {
      return `${prefix} ${cubits} 肘`;
    }
    if (this.#currentUnit === 'cm') {
      const cm = Math.round(cubits * CUBIT_IN_CM * 10) / 10;
      return `${prefix} ${cm} cm`;
    }
    const inches = Math.round(cubits * CUBIT_IN_CM * CM_IN_INCH * 10) / 10;
    return `${prefix} ${inches} in`;
  }

  #createDimensionLine(
    start: THREE.Vector3,
    end: THREE.Vector3,
    text: string,
    material: THREE.Material
  ): void {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const line = new THREE.Line(geo, material);
    this.#linesGroup.add(line);

    // End tick marks
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const tickDir = new THREE.Vector3().crossVectors(dir, up).normalize().multiplyScalar(0.08);
    if (tickDir.lengthSq() < 0.001) tickDir.set(0.08, 0, 0);

    const tickGeo1 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().subVectors(start, tickDir),
      new THREE.Vector3().addVectors(start, tickDir),
    ]);
    const tickGeo2 = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3().subVectors(end, tickDir),
      new THREE.Vector3().addVectors(end, tickDir),
    ]);
    this.#linesGroup.add(new THREE.Line(tickGeo1, material));
    this.#linesGroup.add(new THREE.Line(tickGeo2, material));

    // Midpoint Sprite Text Label
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const sprite = this.#createTextSprite(text);
    sprite.position.copy(mid).add(new THREE.Vector3(0, 0.12, 0));
    this.#labelsGroup.add(sprite);
  }

  #createCornerBrackets(
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
    minZ: number,
    maxZ: number
  ): void {
    const bracketLen = 0.15;
    const pts: THREE.Vector3[] = [];

    // 8 corners with short brackets
    const corners = [
      new THREE.Vector3(minX, minY, minZ),
      new THREE.Vector3(maxX, minY, minZ),
      new THREE.Vector3(minX, maxY, minZ),
      new THREE.Vector3(maxX, maxY, minZ),
      new THREE.Vector3(minX, minY, maxZ),
      new THREE.Vector3(maxX, minY, maxZ),
      new THREE.Vector3(minX, maxY, maxZ),
      new THREE.Vector3(maxX, maxY, maxZ),
    ];

    corners.forEach((c) => {
      const dx = c.x === minX ? bracketLen : -bracketLen;
      const dy = c.y === minY ? bracketLen : -bracketLen;
      const dz = c.z === minZ ? bracketLen : -bracketLen;
      pts.push(c, new THREE.Vector3(c.x + dx, c.y, c.z));
      pts.push(c, new THREE.Vector3(c.x, c.y + dy, c.z));
      pts.push(c, new THREE.Vector3(c.x, c.y, c.z + dz));
    });

    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color: 0xd2b875,
      transparent: true,
      opacity: 0.45,
    });
    this.#linesGroup.add(new THREE.LineSegments(geo, mat));
  }

  #createTextSprite(text: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = 'rgba(18, 20, 14, 0.85)';
      ctx.roundRect(8, 8, 368, 80, 12);
      ctx.fill();
      ctx.strokeStyle = '#d2b875';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.fillStyle = '#fff4d6';
      ctx.font = 'bold 28px "Noto Sans TC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 192, 48);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.95, 0.24, 1);
    return sprite;
  }

  dispose(): void {
    this.clear();
    this.root.removeFromParent();
  }
}
