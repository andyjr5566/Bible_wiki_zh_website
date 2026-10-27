import * as THREE from 'three';

export interface DemGridData {
  cols: number;
  rows: number;
  /** 世界座標範圍（以示劍橡樹空地為 (0,0)，+X 東、-X 西、-Z 北以巴路山、+Z 南基利心山） */
  widthM: number;
  depthM: number;
  centerOffsetX: number;
  centerOffsetZ: number;
  baseElevM: number;
  heights: Float32Array;
}

/**
 * 程序佔位高程（collect/dem 尚未載入或離線降級時使用）：
 * - (0, 0) 周圍半徑 30m 為平坦集會空地；
 * - 北側 (-Z) 為以巴路山（Mount Ebal，較高且寬闊）；
 * - 南側 (+Z) 為基利心山（Mount Gerizim，南壁陡升）；
 * - 東西向 (+X / -X) 為示劍谷口通道。
 */
export function evalProceduralValleyHeight(x: number, z: number): number {
  const rClear = Math.hypot(x, z + 2);
  const clearMask = smoothstep(26, 78, rClear);

  // 北側以巴路山（峰值約在 x=-40, z=-340）
  const dxE = (x + 40) / 380;
  const dzE = (z + 340) / 230;
  const ebalSkirt = (z + 240) / 140;
  const ebal = 148 * Math.exp(-(dxE * dxE + dzE * dzE)) + 48 * Math.exp(-(ebalSkirt * ebalSkirt));

  // 南側基利心山（峰值約在 x=-20, z=+290）
  const dxG = (x + 20) / 340;
  const dzG = (z - 290) / 195;
  const gerizimSkirt = (z - 210) / 125;
  const gerizim = 132 * Math.exp(-(dxG * dxG + dzG * dzG)) + 42 * Math.exp(-(gerizimSkirt * gerizimSkirt));

  // 谷底自然微起伏與岩石階地
  const ridgeNoise =
    Math.sin(x * 0.017 + z * 0.011) * 3.2 +
    Math.cos(x * 0.039 - z * 0.031) * 1.4 +
    Math.sin(x * 0.085 + z * 0.07) * 0.45;

  // 東西兩端遠方丘陵微升
  const farHills = Math.max(0, (Math.abs(x) - 320) * 0.06);

  return (ebal + gerizim + farHills + ridgeNoise * smoothstep(18, 60, rClear)) * clearMask;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** 雙線性取樣真實 DEM 網格，並在集會空地中心 (0,0) 半徑 28m 平順整平供人物站立 */
export function sampleValleyHeight(x: number, z: number, dem?: DemGridData | null): number {
  if (!dem) return fadeDistantRelief(x, z, evalProceduralValleyHeight(x, z));

  const gx = ((x - dem.centerOffsetX) / dem.widthM + 0.5) * (dem.cols - 1);
  const gz = ((z - dem.centerOffsetZ) / dem.depthM + 0.5) * (dem.rows - 1);
  if (gx < 0 || gx >= dem.cols - 1 || gz < 0 || gz >= dem.rows - 1) {
    return evalProceduralValleyHeight(x, z);
  }

  const ix = Math.floor(gx);
  const iz = Math.floor(gz);
  const fx = gx - ix;
  const fz = gz - iz;

  const h00 = dem.heights[iz * dem.cols + ix];
  const h10 = dem.heights[iz * dem.cols + ix + 1];
  const h01 = dem.heights[(iz + 1) * dem.cols + ix];
  const h11 = dem.heights[(iz + 1) * dem.cols + ix + 1];

  const raw =
    (h00 * (1 - fx) + h10 * fx) * (1 - fz) +
    (h01 * (1 - fx) + h11 * fx) * fz -
    dem.baseElevM;

  // 橡樹與群眾站立區（半徑 28m 內平坦為 y=0，28..95m 平順銜接真實山坡）
  const rClear = Math.hypot(x, z + 2);
  const mask = smoothstep(26, 92, rClear);
  return fadeDistantRelief(x, z, raw * mask);
}

function fadeDistantRelief(x: number, z: number, height: number): number {
  const distance = Math.hypot(x, z + 2);
  // Real distant mountains belong to the DEM panorama. The walkable mesh
  // supplies only shallow local relief; otherwise its compressed DEM skirt
  // becomes a faceted wall just behind the assembly.
  const flatten = smoothstep(45, 95, distance);
  return Math.max(-2, Math.min(3.2, height)) * (1 - flatten);
}

function createLimestoneDetailTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#e8e0cf';
  ctx.fillRect(0, 0, 256, 256);

  // 固定種子亂數，確保每次渲染一致
  let seed = 2401;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (let i = 0; i < 3200; i++) {
    const x = rnd() * 256;
    const y = rnd() * 256;
    const shade = 205 + Math.floor(rnd() * 44);
    const alpha = 0.14 + rnd() * 0.22;
    ctx.fillStyle = `rgba(${shade}, ${Math.floor(shade * 0.94)}, ${Math.floor(shade * 0.83)}, ${alpha})`;
    ctx.fillRect(x, y, 1.5 + rnd() * 2.5, 1.2 + rnd() * 1.8);
  }
  // 細微岩層橫紋
  for (let y = 0; y < 256; y += 8) {
    ctx.fillStyle = `rgba(145, 130, 106, ${0.04 + rnd() * 0.05})`;
    ctx.fillRect(0, y, 256, 1.5);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(160, 160);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export interface ValleyTerrainHandle {
  group: THREE.Group;
  mesh: THREE.Mesh;
  material: THREE.MeshStandardMaterial;
  sampleHeight(x: number, z: number): number;
  applyDem(dem: DemGridData): void;
  setTheme(dark: boolean, pastBlend: number, later: boolean, nightMix?: number): void;
}

export function createValleyTerrain(initialDem?: DemGridData | null): ValleyTerrainHandle {
  let activeDem: DemGridData | null = initialDem ?? null;
  const group = new THREE.Group();
  group.name = 'shechem_valley_group';

  // 近景採 2m 間距，避免跨越整平區的 36m 三角形把人物與低鏡頭埋住。
  // 遠處只負責接合天幕，保留較疏網格。
  const W = 5200;
  const D = 4600;
  const axis = (extent: number) => [
    ...Array.from({ length: 48 }, (_, i) => -extent / 2 + i * (extent / 2 - 120) / 48),
    ...Array.from({ length: 121 }, (_, i) => -120 + i * 2),
    ...Array.from({ length: 48 }, (_, i) => 120 + (i + 1) * (extent / 2 - 120) / 48),
  ];
  const xs = axis(W), zs = axis(D);
  const segX = xs.length - 1;
  const segZ = zs.length - 1;
  const geo = new THREE.PlaneGeometry(W, D, segX, segZ);
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position as THREE.BufferAttribute;
  for (let row = 0; row < zs.length; row++) {
    for (let col = 0; col < xs.length; col++) {
      const index = row * xs.length + col;
      posAttr.setX(index, xs[col]);
      posAttr.setZ(index, zs[row]);
    }
  }
  const colors = new Float32Array(posAttr.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const cFloor = new THREE.Color('#e6ddca');
  const cPath = new THREE.Color('#efe7d6');
  const cSlope = new THREE.Color('#cbbd9f');
  const cScrub = new THREE.Color('#8e9472');
  const cPeak = new THREE.Color('#d8ceb8');
  const tmpCol = new THREE.Color();

  function rebuildVertices(): void {
    for (let i = 0; i < posAttr.count; i++) {
      const x = posAttr.getX(i);
      const z = posAttr.getZ(i);
      const y = sampleValleyHeight(x, z, activeDem);
      posAttr.setY(i, y);

      // 依高度與坡向給定自然石灰岩／橄欖灌叢頂點色
      const rClear = Math.hypot(x, z + 2);
      const roadDist = Math.abs(z - 4.5 + Math.sin(x * 0.015) * 3.5);
      if (rClear < 28) {
        tmpCol.copy(cFloor).lerp(cPath, smoothstep(16, 4, rClear) * 0.55);
      } else if (roadDist < 5.5 && y < 18) {
        tmpCol.copy(cPath);
      } else if (y < 38) {
        const scrubMix = 0.28 + 0.25 * Math.sin(x * 0.05 + z * 0.07);
        tmpCol.copy(cSlope).lerp(cScrub, Math.max(0, Math.min(0.65, scrubMix)));
      } else if (y < 120) {
        tmpCol.copy(cSlope).lerp(cScrub, 0.22);
      } else {
        tmpCol.copy(cSlope).lerp(cPeak, smoothstep(120, 260, y));
      }

      colors[i * 3] = tmpCol.r;
      colors[i * 3 + 1] = tmpCol.g;
      colors[i * 3 + 2] = tmpCol.b;
    }
    posAttr.needsUpdate = true;
    (geo.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    geo.computeVertexNormals();
  }

  rebuildVertices();

  const detailTex = createLimestoneDetailTexture();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: detailTex,
    roughness: 0.94,
    metalness: 0.02,
  });

  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  group.add(mesh);

  // 集會空地邊緣散落幾塊天然石灰岩塊（低多邊形，增加地面層次感）
  const rockMat = new THREE.MeshStandardMaterial({ color: '#cfc4ae', roughness: 0.92 });
  const rockGeo = new THREE.DodecahedronGeometry(0.55, 0);
  const boulderSpots: [number, number, number, number][] = [
    [-11.5, -6.2, 1.3, 0.4],
    [13.2, -5.8, 1.1, 1.2],
    [-15.4, 9.5, 0.9, 2.1],
    [16.8, 11.2, 1.25, 0.8],
    [-8.2, -12.4, 1.5, 1.7],
    [9.6, -11.0, 1.0, 2.6],
  ];
  for (const [rx, rz, sc, rotY] of boulderSpots) {
    const r = new THREE.Mesh(rockGeo, rockMat);
    const ry = sampleValleyHeight(rx, rz, activeDem);
    r.position.set(rx, ry + 0.14 * sc, rz);
    r.scale.set(sc * 1.3, sc * 0.62, sc * 1.05);
    r.rotation.y = rotY;
    r.castShadow = true;
    r.receiveShadow = true;
    group.add(r);
  }

  const baseTintLight = new THREE.Color('#ffffff');
  // Vertex colors, detail map and ambient light multiply this tint. The old
  // dark tint compounded all three into an almost black foreground.
  const baseTintDark = new THREE.Color('#c7b99b');
  const pastTint = new THREE.Color('#d8b992');
  const laterTint = new THREE.Color('#e4dac2');
  const workTint = new THREE.Color();

  return {
    group,
    mesh,
    material,
    sampleHeight: (x, z) => sampleValleyHeight(x, z, activeDem),
    applyDem(dem: DemGridData) {
      activeDem = dem;
      rebuildVertices();
    },
    setTheme(dark: boolean, pastBlend: number, later: boolean, nightMix = 0) {
      workTint.copy(dark ? baseTintDark : baseTintLight);
      if (pastBlend > 0.01) {
        workTint.lerp(pastTint, pastBlend * 0.55);
      } else if (later && !dark) {
        workTint.lerp(laterTint, 0.45);
      }
      workTint.lerp(baseTintDark, Math.max(0, Math.min(1, nightMix)) * 0.4);
      material.color.copy(workTint);
    },
  };
}
