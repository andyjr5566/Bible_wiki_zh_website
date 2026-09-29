import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CLANS } from '../data/levites';
import { CAMPS, TRIBES } from '../data/tribes';
import type { CampId, ClanId, TribeId } from '../data/types';
import { BANNER_POS, CLAN_RECT, COURT, TENT_COLS, TRIBE_RECT, center, tentsFor, toWorld } from '../layout';
import type { Rect } from '../layout';
import type { Selection } from '../store';
import { BANNER_TRADITION, CAMP_HEX, CAMP_STYLE } from '../ui/meta';

export interface Assets {
  courtyard: THREE.Object3D;
  wagon: THREE.Object3D;
  loads: Record<string, THREE.Object3D>;
  bull: THREE.Object3D;
}

const base = import.meta.env.BASE_URL;

export async function loadAssets(onProgress?: (n: number, total: number) => void): Promise<Assets> {
  const loader = new GLTFLoader();
  const names = ['courtyard', 'wagon', 'loads', 'bull'] as const;
  let done = 0;
  const load = async (n: string) => {
    const g = await loader.loadAsync(`${base}models/${n}.glb`);
    onProgress?.(++done, names.length);
    return g;
  };
  const [c, w, l, b] = await Promise.all(names.map(load));
  const loads: Record<string, THREE.Object3D> = {};
  l.scene.traverse((o) => { if (o.name.startsWith('load_') && !o.name.includes('__')) loads[o.name] = o; });
  return { courtyard: c.scene, wagon: w.scene, loads, bull: b.scene };
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
  cloud: THREE.Group;
  cloudMat: THREE.MeshStandardMaterial;
  fire: THREE.PointLight;
  flags: Record<CampId, { mesh: THREE.Mesh; day: THREE.CanvasTexture; trad: THREE.CanvasTexture }>;
  decals: { mesh: THREE.Mesh; sel: Selection; camp?: CampId; tribe?: TribeId; clan?: ClanId; court?: boolean }[];
  hitboxes: THREE.Object3D[];
  labels: { key: string; text: string; pos: THREE.Vector3; sel: Selection }[];
  rectWorld: (r: Rect) => { cx: number; cz: number; w: number; d: number };
  hill: THREE.Mesh;
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

export function buildWorld(scene: THREE.Scene, assets: Assets): World {
  const root = new THREE.Group();
  scene.add(root);

  const tentGeo = tentGeometry();
  const cream = new THREE.Color(0xf1e6cc);
  const mkMat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, emissive: new THREE.Color(0xffb04a), emissiveIntensity: 0 });
  const campMats = {} as Record<CampId, THREE.MeshStandardMaterial>;
  for (const c of CAMPS) campMats[c.id] = mkMat();
  const leviMat = mkMat();

  const tribeGroups = {} as Record<TribeId, THREE.Group>;
  const tribeTents = {} as Record<TribeId, THREE.InstancedMesh>;
  const clanGroups = {} as Record<ClanId, THREE.Group>;
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
      col.copy(tint).lerp(cream, 0.4 + Math.random() * 0.16);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
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

  /* ---- 雲彩與火 ---- */
  const cloud = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.94, emissive: new THREE.Color(0xff7a1a), emissiveIntensity: 0 });
  const puffs: [number, number, number, number][] = [[0, 36, 0, 15], [-16, 32, 4, 11], [16, 34, -3, 12], [6, 46, 2, 9], [-8, 42, -6, 8], [24, 30, 8, 8], [-24, 30, -4, 8]];
  for (const [x, y, z, r] of puffs) {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), cloudMat);
    m.position.set(x, y, z);
    m.scale.set(1.25, 0.8, 1.05);
    cloud.add(m);
  }
  cloud.position.set(cw.cx, 0, cw.cz);
  root.add(cloud);
  const fire = new THREE.PointLight(0xff8a3c, 0, 420, 1.6);
  fire.position.set(cw.cx, 34, cw.cz);
  root.add(fire);

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
    flags[c.id] = { mesh: flag, day, trad };
    labels.push({ key: `b-${c.id}`, text: c.bannerName, pos: new THREE.Vector3(bx, 50, bz), sel: { kind: 'camp', id: c.id } });
  }

  /* ---- 行進的路（方向為示意）與營外的高處 ---- */
  const road = new THREE.Mesh(new THREE.PlaneGeometry(2600, 34), new THREE.MeshStandardMaterial({ color: 0xb59f74, roughness: 1 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(390 + 1300, 0.12, 0);
  road.receiveShadow = true;
  root.add(road);

  const hillGeo = new THREE.ConeGeometry(230, 142, 28, 7);
  const pos = hillGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    if (y > -70) {
      pos.setX(i, pos.getX(i) * (1 + (Math.sin(i * 1.7) * 0.06)));
      pos.setZ(i, pos.getZ(i) * (1 + (Math.cos(i * 2.3) * 0.06)));
      pos.setY(i, y + Math.sin(i * 3.1) * 3);
    }
  }
  hillGeo.computeVertexNormals();
  const hill = new THREE.Mesh(hillGeo, new THREE.MeshStandardMaterial({ color: 0x9c8a63, roughness: 1, flatShading: true }));
  hill.position.set(668, 71, -382);
  hill.castShadow = true;
  hill.receiveShadow = true;
  root.add(hill);

  return { root, tribeGroups, tribeTents, clanGroups, campMats, leviMat, courtGroup, courtFootprint: fp, cloud, cloudMat, fire, flags, decals, hitboxes, labels, rectWorld: wRect, hill };
}
