import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLANS } from '../data/levites';
import { CAMPS, TRIBES } from '../data/tribes';
import type { CampId, ClanId, TribeId } from '../data/types';
import { BANNER_POS, CLAN_RECT, COURT, TENT_COLS, TRIBE_RECT, center, tentsFor, toWorld } from '../layout';
import type { Rect } from '../layout';
import type { Selection } from '../store';
import { createCloud } from './cloud';
import type { Cloud } from './cloud';
import { BANNER_TRADITION, CAMP_HEX, CAMP_STYLE } from '../ui/meta';

export interface Assets {
  courtyard: THREE.Object3D;
  wagon: THREE.Object3D;
  loads: Record<string, THREE.Object3D>;
  bull: THREE.Object3D;
  /** Blender 做的曠野地形（scripts/blender/build_wilderness.py）；頂點色，沒有法線 */
  terrain: THREE.BufferGeometry;
  /** Blender 做的帳棚；頂點色只分明暗，營的顏色由 instance color 染 */
  tent: THREE.BufferGeometry;
}

const base = import.meta.env.BASE_URL;

export async function loadAssets(onProgress?: (n: number, total: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const names = ['courtyard', 'wagon', 'loads', 'bull', 'terrain', 'tent'] as const;
  let done = 0;
  const load = async (n: string) => {
    const g = await loader.loadAsync(`${base}models/${n}.glb`);
    onProgress?.(++done, names.length);
    return g;
  };
  const [c, w, l, b, tr, tn] = await Promise.all(names.map(load));
  const firstGeo = (o: THREE.Object3D): THREE.BufferGeometry => {
    let g: THREE.BufferGeometry | null = null;
    o.traverse((x) => { if (!g && (x as THREE.Mesh).isMesh) g = (x as THREE.Mesh).geometry; });
    return g!;
  };
  const terrain = firstGeo(tr.scene);
  terrain.computeVertexNormals();
  // Blender 裡門朝北（glTF 的 −z）；網站的排法要門在 +z，再由 layTents 轉向會幕
  // 縮窄一點，排在一起時一頂一頂分得出來（排法的間距照舊）
  const tent = firstGeo(tn.scene).clone().rotateY(Math.PI).scale(0.8, 1, 0.84);
  const loads: Record<string, THREE.Object3D> = {};
  l.scene.traverse((o) => { if (o.name.startsWith('load_') && !o.name.includes('__')) loads[o.name] = o; });
  return { courtyard: c.scene, wagon: w.scene, loads, bull: b.scene, terrain, tent };
}

/* ------------------------------------------------------------ 幾何 */

/** 帳棚：脊線沿 z，門在 +z 那一面的山牆；頂點色讓門洞比較暗，實例色負責染營的顏色 */
export function tentGeometry(): THREE.BufferGeometry {
  const W = 4.2, D = 3.6, H = 5.0;
  const tris: number[] = [];
  const cols: number[] = [];
  const tri = (a: number[], b: number[], c: number[], k: number) => {
    tris.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) cols.push(k, k, k);
  };
  const quad = (a: number[], b: number[], c: number[], d: number[], k: number) => { tri(a, b, c, k); tri(a, c, d, k); };
  quad([-W, 0, D], [-W, 0, -D], [0, H, -D], [0, H, D], 1.0);
  quad([W, 0, -D], [W, 0, D], [0, H, D], [0, H, -D], 0.92);
  tri([-W, 0, D], [0, H, D], [W, 0, D], 0.8);
  tri([W, 0, -D], [0, H, -D], [-W, 0, -D], 0.7);
  const e = D + 0.02;
  tri([-1.4, 0, e], [0, 3.2, e], [1.4, 0, e], 0.1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

export function figureGeometry(): THREE.BufferGeometry {
  const g = new THREE.CapsuleGeometry(0.7, 2.3, 3, 8);
  g.translate(0, 1.9, 0);
  return g;
}

/* ------------------------------------------------------------ 世界 */

export interface World {
  root: THREE.Group;
  tribeGroups: Record<TribeId, THREE.Group>;
  tribeTents: Record<TribeId, THREE.InstancedMesh>;
  clanGroups: Record<ClanId, THREE.Group>;
  campMats: Record<CampId, THREE.MeshStandardMaterial>;
  leviMat: THREE.MeshStandardMaterial;
  courtGroup: THREE.Group;
  courtFootprint: THREE.LineLoop;
  cloud: Cloud;
  flags: Record<CampId, { mesh: THREE.Mesh; pole: THREE.Mesh; day: THREE.CanvasTexture; trad: THREE.CanvasTexture }>;
  decals: { mesh: THREE.Mesh; sel: Selection; camp?: CampId; tribe?: TribeId; clan?: ClanId; court?: boolean }[];
  hitboxes: THREE.Object3D[];
  labels: { key: string; text: string; pos: THREE.Vector3; sel: Selection }[];
  rectWorld: (r: Rect) => { cx: number; cz: number; w: number; d: number };
  terrain: THREE.Mesh;
  /** 0 = not yet pitched (invisible), 1 = fully standing. Every key defaults to 1 (current behaviour unchanged). */
  setRise(key: CampId | 'levi' | 'court', r: number): void;
}

const wRect = (r: Rect) => {
  const [cx, cz] = toWorld(...center(r));
  const [x0, z0] = toWorld(r.x, r.y);
  const [x1, z1] = toWorld(r.x + r.w, r.y + r.h);
  return { cx, cz, w: x1 - x0, d: z1 - z0 };
};

function flagTexture(bg: string, glyph: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, 256, 160);
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 8;
  g.strokeRect(8, 8, 240, 144);
  g.fillStyle = '#fff';
  g.font = '700 108px "Noto Serif TC", "Microsoft JhengHei", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(glyph, 128, 88);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function buildWorld(scene: THREE.Scene, assets: Assets): World {
  const root = new THREE.Group();
  scene.add(root);

  const tentGeo = assets.tent;
  const cream = new THREE.Color(0xf1e6cc);
  const mkMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: new THREE.Color(0xffb04a), emissiveIntensity: 0 });
  const campMats = {} as Record<CampId, THREE.MeshStandardMaterial>;
  for (const c of CAMPS) campMats[c.id] = mkMat();
  const leviMat = mkMat();

  const tribeGroups = {} as Record<TribeId, THREE.Group>;
  const tribeTents = {} as Record<TribeId, THREE.InstancedMesh>;
  const clanGroups = {} as Record<ClanId, THREE.Group>;
  const tentBases = new Map<THREE.InstancedMesh, THREE.Matrix4[]>();
  const decals: World['decals'] = [];
  const hitboxes: THREE.Object3D[] = [];
  const labels: World['labels'] = [];

  const decalMat = (hex: number) => new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0, depthWrite: false });
  const addDecal = (r: Rect, hex: number, sel: Selection, extra: Partial<World['decals'][number]>, grow = 0) => {
    const w = wRect(r);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w.w + grow, w.d + grow), decalMat(hex));
    m.rotation.x = -Math.PI / 2;
    m.position.set(w.cx, 0.35, w.cz);
    m.renderOrder = 2;
    m.userData.sel = sel;
    root.add(m);
    decals.push({ mesh: m, sel, ...extra });
    hitboxes.push(m);
    return w;
  };

  /** 在一個長方形裡排帳棚，門朝會幕 */
  const layTents = (n: number, r: Rect, cols: number, sx: number, sz: number, mat: THREE.Material, tint: THREE.Color, name: string): THREE.InstancedMesh => {
    const w = wRect(r);
    const mesh = new THREE.InstancedMesh(tentGeo, mat, n);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = name;
    const rows = Math.ceil(n / cols);
    const m4 = new THREE.Matrix4();
    const bases: THREE.Matrix4[] = [];
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols);
      const inRow = Math.min(cols, n - row * cols);
      const c = i % cols;
      const x = (c - (inRow - 1) / 2) * sx;
      const z = (row - (rows - 1) / 2) * sz;
      // 門朝向會幕（原點）
      const ang = Math.atan2(-(w.cx + x), -(w.cz + z));
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), ang);
      m4.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m4);
      bases.push(m4.clone());
      col.copy(tint).lerp(cream, 0.4 + Math.random() * 0.16);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    tentBases.set(mesh, bases);
    return mesh;
  };

  /* ---- 十二支派的帳棚 ---- */
  for (const t of TRIBES) {
    const r = TRIBE_RECT[t.id];
    const w = wRect(r);
    const g = new THREE.Group();
    g.position.set(w.cx, 0, w.cz);
    const mesh = layTents(Math.max(tentsFor(t.c2.n), tentsFor(t.c26.n)), r, TENT_COLS, 9, 12.5, campMats[t.camp], new THREE.Color(CAMP_HEX[t.camp]), `tents-${t.id}`);
    mesh.count = tentsFor(t.c2.n);
    g.add(mesh);
    root.add(g);
    tribeGroups[t.id] = g;
    tribeTents[t.id] = mesh;
    addDecal(r, CAMP_HEX[t.camp], { kind: 'tribe', id: t.id }, { tribe: t.id, camp: t.camp }, 4);
    labels.push({ key: `t-${t.id}`, text: t.name, pos: new THREE.Vector3(w.cx, 9, w.cz + w.d / 2 - 4), sel: { kind: 'tribe', id: t.id } });
  }

  /* ---- 利未人 ---- */
  const leviTint = new THREE.Color(0x6b4ea2);
  for (const c of CLANS) {
    const r = CLAN_RECT[c.id];
    const w = wRect(r);
    const g = new THREE.Group();
    g.position.set(w.cx, 0, w.cz);
    const n = c.count ? tentsFor(c.count.n) : 3;
    const cols = Math.max(2, Math.floor((w.w - 4) / 10));
    g.add(layTents(n, r, cols, 10, 12, leviMat, leviTint, `tents-${c.id}`));
    root.add(g);
    clanGroups[c.id] = g;
    addDecal(r, 0x6b4ea2, { kind: 'clan', id: c.id }, { clan: c.id }, 3);
    labels.push({ key: `c-${c.id}`, text: c.id === 'priests' ? '祭司' : c.name, pos: new THREE.Vector3(w.cx, 8, w.cz - w.d / 2 - 3), sel: { kind: 'clan', id: c.id } });
  }

  /* ---- 會幕（院子）---- */
  const courtGroup = new THREE.Group();
  const cw = wRect(COURT);
  const model = assets.courtyard.clone(true);
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const k = cw.w / Math.max(size.x, 1);
  model.scale.setScalar(k);
  const box2 = new THREE.Box3().setFromObject(model);
  const c2 = box2.getCenter(new THREE.Vector3());
  model.position.set(-c2.x, -box2.min.y, -c2.z);
  model.traverse((o) => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  courtGroup.add(model);
  courtGroup.position.set(cw.cx, 0, cw.cz);
  root.add(courtGroup);
  const fp = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(cw.cx - cw.w / 2, 0.3, cw.cz - cw.d / 2), new THREE.Vector3(cw.cx + cw.w / 2, 0.3, cw.cz - cw.d / 2),
      new THREE.Vector3(cw.cx + cw.w / 2, 0.3, cw.cz + cw.d / 2), new THREE.Vector3(cw.cx - cw.w / 2, 0.3, cw.cz + cw.d / 2),
    ]),
    new THREE.LineBasicMaterial({ color: 0x9a5a2a, transparent: true, opacity: 0.55 }));
  root.add(fp);
  addDecal(COURT, 0xb88a1c, { kind: 'tabernacle' }, { court: true }, 6);
  labels.push({ key: 'court', text: '會幕', pos: new THREE.Vector3(cw.cx, 26, cw.cz), sel: { kind: 'tabernacle' } });

  /* ---- 雲彩：日間遮蓋帳幕，夜間形狀如火（民9:15-16）---- */
  const cloud = createCloud();
  cloud.group.position.set(cw.cx, 0, cw.cz);
  root.add(cloud.group);

  /* ---- 四面纛 ---- */
  const flags = {} as World['flags'];
  for (const c of CAMPS) {
    const p = BANNER_POS[c.id];
    const [bx, bz] = toWorld(p.x, p.y);
    const g = new THREE.Group();
    g.position.set(bx, 0, bz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 46, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.8 }));
    pole.position.y = 23;
    pole.castShadow = true;
    const hex = `#${CAMP_HEX[c.id].toString(16).padStart(6, '0')}`;
    const day = flagTexture(hex, CAMP_STYLE[c.id].glyph);
    const trad = flagTexture(hex, BANNER_TRADITION[c.id].glyph);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(20, 12.5, 8, 1), new THREE.MeshStandardMaterial({ map: day, side: THREE.DoubleSide, roughness: 0.8 }));
    flag.position.set(10.5, 39, 0);
    flag.castShadow = true;
    g.add(pole, flag);
    root.add(g);
    flags[c.id] = { mesh: flag, pole, day, trad };
    labels.push({ key: `b-${c.id}`, text: c.bannerName, pos: new THREE.Vector3(bx, 50, bz), sel: { kind: 'camp', id: c.id } });
  }

  /* ---- 行進的路（方向為示意）：往東穿過山口 ---- */
  const roadMat = new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 1, transparent: true, opacity: 0.85 });
  const road = new THREE.Mesh(new THREE.PlaneGeometry(1150, 34), roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.set(390 + 575, 0.12, 0);
  road.receiveShadow = true;
  root.add(road);

  /* ---- 曠野地形與營外的高處（Blender 做的，全是示意）---- */
  const terrain = new THREE.Mesh(assets.terrain, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 }));
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  root.add(terrain);

  type TentRise = { mesh: THREE.InstancedMesh; group: THREE.Group; bases: THREE.Matrix4[]; stagger: number[] };
  const campTents = {} as Record<CampId, TentRise[]>;
  for (const camp of CAMPS) {
    const entries: TentRise[] = TRIBES.filter((tribe) => tribe.camp === camp.id).map((tribe) => ({
      mesh: tribeTents[tribe.id],
      group: tribeGroups[tribe.id],
      bases: tentBases.get(tribeTents[tribe.id])!,
      stagger: [],
    }));
    campTents[camp.id] = entries;
  }
  const leviTents: TentRise[] = CLANS.map((clan) => ({
    mesh: clanGroups[clan.id].children[0] as THREE.InstancedMesh,
    group: clanGroups[clan.id],
    bases: tentBases.get(clanGroups[clan.id].children[0] as THREE.InstancedMesh)!,
    stagger: [],
  }));
  const setStaggers = (entries: TentRise[]) => {
    const distances = entries.flatMap((entry) => entry.bases.map((baseMatrix) => {
      const p = new THREE.Vector3().setFromMatrixPosition(baseMatrix).add(entry.group.position);
      return Math.hypot(p.x, p.z);
    }));
    const min = Math.min(...distances);
    const max = Math.max(...distances);
    let index = 0;
    for (const entry of entries) {
      entry.stagger = entry.bases.map(() => (distances[index++] - min) / Math.max(max - min, 1e-9));
    }
  };
  for (const entries of Object.values(campTents)) setStaggers(entries);
  setStaggers(leviTents);

  const rises: Record<CampId | 'levi' | 'court', number> = {
    judah: 1, reuben: 1, ephraim: 1, dan: 1, levi: 1, court: 1,
  };
  const risePosition = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const nextScale = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const applyTents = (entries: TentRise[], r: number) => {
    for (const entry of entries) {
      for (let i = 0; i < entry.bases.length; i++) {
        const ri = smoothstep(0, 1, r * 1.8 - entry.stagger[i] * 0.8);
        entry.bases[i].decompose(risePosition, quat, scale);
        risePosition.y -= (1 - ri) * 0.6;
        if (ri < 0.001) nextScale.set(0, 0, 0);
        else nextScale.set(1, ri, 1);
        matrix.compose(risePosition, quat, nextScale);
        entry.mesh.setMatrixAt(i, matrix);
      }
      entry.mesh.instanceMatrix.needsUpdate = true;
    }
  };
  const setRise = (key: CampId | 'levi' | 'court', value: number) => {
    const r = Math.min(1, Math.max(0, value));
    if (rises[key] === r) return;
    rises[key] = r;
    if (key === 'court') {
      const rc = Math.max(smoothstep(0, 1, r), 0.001);
      model.scale.y = k * rc;
      fp.visible = r >= 0.01;
      return;
    }
    if (key === 'levi') {
      applyTents(leviTents, r);
      return;
    }
    applyTents(campTents[key], r);
    const rf = smoothstep(0.55, 1, r);
    const banner = flags[key];
    banner.pole.scale.y = Math.max(rf, 0.001);
    banner.pole.position.y = 23 * rf;
    banner.mesh.position.y = 39 * rf;
    banner.mesh.scale.setScalar(Math.max(rf, 0.001));
    banner.mesh.visible = rf > 0.01;
  };

  return { root, tribeGroups, tribeTents, clanGroups, campMats, leviMat, courtGroup, courtFootprint: fp, cloud, flags, decals, hitboxes, labels, rectWorld: wRect, terrain, setRise };
}
