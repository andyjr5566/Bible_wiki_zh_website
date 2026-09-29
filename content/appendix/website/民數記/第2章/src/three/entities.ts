import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MARCHES } from '../data/march';
import type { CampId, ClanId } from '../data/types';
import { viewAt } from '../phases';
import type { State } from '../store';
import { CAMP_HEX } from '../ui/meta';
import { figureGeometry } from './world';
import type { Assets, World } from './world';

/**
 * 行軍的角色：每個營或利未族，在原地是帳棚；輪到出發時帳棚收起來，一隊人（或車、牛、抬著聖物的人）
 * 從營裡走出來，沿著彎曲的路匯進向東的行列。行進方向是示意，經文沒有記。
 */
type EntId = CampId | ClanId;

interface Ent {
  id: EntId;
  home: THREE.Vector3;
  size: number;
  tents: THREE.Object3D[];
  walkers: THREE.Group | null;
  figs: { mesh: THREE.InstancedMesh; base: THREE.Vector3[] }[];
  cargo: THREE.Object3D[];
  p: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

const ROAD_START = 640;
const SPEED = 15;
const GAP = 18;

export interface Entities {
  update(dt: number, st: Readonly<State>): void;
}

export function buildEntities(world: World, assets: Assets): Entities {
  const figGeo = figureGeometry();
  const ents = new Map<EntId, Ent>();

  const figMat = new THREE.MeshStandardMaterial({ roughness: 0.85 });

  function figures(group: THREE.Group, points: THREE.Vector3[], hex: number): Ent['figs'][number] {
    const mesh = new THREE.InstancedMesh(figGeo, figMat, points.length);
    mesh.castShadow = true;
    const col = new THREE.Color();
    const m = new THREE.Matrix4();
    points.forEach((p, i) => {
      m.makeTranslation(p.x, p.y, p.z);
      mesh.setMatrixAt(i, m);
      col.setHex(hex).lerp(new THREE.Color(0xf1e6cc), 0.3 + Math.random() * 0.3);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    group.add(mesh);
    return { mesh, base: points.map((p) => p.clone()) };
  }

  const bullBox = new THREE.Box3().setFromObject(assets.bull);
  const bullSize = bullBox.getSize(new THREE.Vector3());
  const bullK = 5.6 / Math.max(bullSize.x, bullSize.z);

  function ox(): THREE.Object3D {
    const o = SkeletonUtils.clone(assets.bull);
    o.scale.setScalar(bullK);
    o.rotation.y = Math.PI / 2;
    o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
    return o;
  }

  /** 一輛篷子車＋兩隻牛，車尾在 x=0，牛在前面（+x） */
  function wagonWithOxen(cargo: 'linen' | 'boards'): { g: THREE.Group; cargo: THREE.Object3D } {
    const g = new THREE.Group();
    const w = assets.wagon.clone(true);
    w.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    g.add(w);
    for (const z of [-0.85, 0.85]) {
      const o = ox();
      o.position.set(6.9, 0, z * 1.1);
      g.add(o);
    }
    const load = new THREE.Group();
    if (cargo === 'linen') {
      const linen = new THREE.MeshStandardMaterial({ color: 0xece2c8, roughness: 0.95 });
      for (const z of [-0.5, 0.5]) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 3.2, 10), linen);
        b.rotation.z = Math.PI / 2;
        b.position.set(-0.4, 1.85 + 0.55 + 0.1, z * 1.2);
        load.add(b);
      }
    } else {
      const wood = new THREE.MeshStandardMaterial({ color: 0x9a6a3e, roughness: 0.8 });
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.32, 1.7), wood);
        b.position.set(-0.4, 1.6 + 0.24 + i * 0.36, 0);
        load.add(b);
      }
    }
    g.add(load);
    return { g, cargo: load };
  }

  /* ---- 四個營：一隊人，前面舉著本營的纛 ---- */
  for (const cid of ['judah', 'reuben', 'ephraim', 'dan'] as CampId[]) {
    const tribeIds = world.decals.filter((d) => d.camp === cid && d.tribe).map((d) => d.tribe!);
    const home = new THREE.Vector3();
    tribeIds.forEach((t) => home.add(world.tribeGroups[t].position));
    home.multiplyScalar(1 / tribeIds.length);
    const g = new THREE.Group();
    g.visible = false;
    const pts: THREE.Vector3[] = [];
    for (let r = 0; r < 13; r++) for (let c = 0; c < 4; c++) pts.push(new THREE.Vector3(-r * 3.3, 0, (c - 1.5) * 3.2));
    const fig = figures(g, pts, CAMP_HEX[cid]);
    // 和營裡那面纛共用材質：開「傳統纛圖案」圖層時，行進中的纛也跟著換
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(14, 9), world.flags[cid].mesh.material);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 30, 8), new THREE.MeshStandardMaterial({ color: 0x5a3a22 }));
    pole.position.set(3.5, 15, 0);
    flag.position.set(3.5, 25.5, -7.3);
    flag.rotation.y = Math.PI / 2;
    g.add(pole, flag);
    world.root.add(g);
    // 營裡的纛竿跟帳棚一起收：纛由隊伍舉著走了
    const staticFlag = world.flags[cid].mesh.parent!;
    ents.set(cid, { id: cid, home, size: 52, tents: [...tribeIds.map((t) => world.tribeGroups[t]), staticFlag], walkers: g, figs: [fig], cargo: [], p: 0 });
  }

  /* ---- 革順、米拉利：篷子車與牛 ---- */
  for (const [cid, n, cargoKind, hex] of [['gershon', 2, 'linen', 0x6b4ea2], ['merari', 4, 'boards', 0x6b4ea2]] as const) {
    const g = new THREE.Group();
    g.visible = false;
    const cargo: THREE.Object3D[] = [];
    for (let i = 0; i < n; i++) {
      const wo = wagonWithOxen(cargoKind);
      wo.g.position.x = -i * 16;
      g.add(wo.g);
      cargo.push(wo.cargo);
    }
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < n * 2; i++) pts.push(new THREE.Vector3(-i * 8 + 4, 0, i % 2 ? 4.6 : -4.6));
    const fig = figures(g, pts, hex);
    const home = world.clanGroups[cid].position.clone();
    world.root.add(g);
    ents.set(cid, { id: cid, home, size: n * 16 + 12, tents: [world.clanGroups[cid]], walkers: g, figs: [fig], cargo, p: 0 });
  }

  /* ---- 哥轄：五件聖物，每件四個人抬（民4:5-14；民7:9 沒有車） ---- */
  {
    const g = new THREE.Group();
    g.visible = false;
    const order: [string, number, number, number][] = [['load_ark', 4.6, 0.95, 4.6], ['load_table', 4.0, 0.65, 4.0], ['load_lampstand', 4.0, 0.6, 4.0], ['load_incense', 3.6, 0.6, 3.6], ['load_altar', 7.0, 2.1, 7.0]];
    const pts: THREE.Vector3[] = [];
    let x = 0;
    for (const [name, len, spread] of order) {
      const src = assets.loads[name];
      if (src) {
        const o = src.clone(true);
        o.position.set(x, 0, 0);
        o.traverse((c) => { if ((c as THREE.Mesh).isMesh) c.castShadow = true; });
        g.add(o);
      }
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(new THREE.Vector3(x + sx * (len / 2 - 0.5), 0, sz * spread));
      x -= len + 8;
    }
    const fig = figures(g, pts, 0x6b4ea2);
    world.root.add(g);
    ents.set('kohath', { id: 'kohath', home: world.clanGroups.kohath.position.clone(), size: -x + 6, tents: [world.clanGroups.kohath], walkers: g, figs: [fig], cargo: [], p: 0 });
  }

  /* ---- 祭司：跟著帳幕一起收 ---- */
  ents.set('priests', { id: 'priests', home: world.clanGroups.priests.position.clone(), size: 0, tents: [world.clanGroups.priests], walkers: null, figs: [], cargo: [], p: 0 });

  let marchTime = 0;
  const tmp = new THREE.Vector3();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const m4 = new THREE.Matrix4();

  function order(st: Readonly<State>): EntId[] {
    const steps = MARCHES[st.mode].steps;
    return steps.flatMap((s) => [...(s.camps ?? []), ...(s.clans ?? []).filter((c) => c !== 'priests')]) as EntId[];
  }

  function update(dt: number, st: Readonly<State>) {
    const view = viewAt(st.mode, st.phase);
    const list = order(st);
    // 每個角色在行列裡離最前面多遠
    const offset = new Map<EntId, number>();
    let acc = 0;
    for (const id of list) {
      offset.set(id, -acc);
      acc += (ents.get(id)?.size ?? 40) + GAP;
    }

    let moving = false;
    for (const e of ents.values()) {
      const target = e.id === 'priests'
        ? (view.tabernacleGone || view.goingTabernacle ? 1 : 0)
        : view.goneCamps.has(e.id as CampId) || view.goingCamps.has(e.id as CampId) || view.goneClans.has(e.id as ClanId) || view.goingClans.has(e.id as ClanId) ? 1 : 0;
      const step = dt / 3.0;
      e.p += Math.max(-step, Math.min(step, target - e.p));
      if (e.p > 0.001) moving = true;
    }
    marchTime = moving ? marchTime + dt : 0;

    const F = ROAD_START + SPEED * marchTime;
    const now = performance.now() / 1000;
    for (const e of ents.values()) {
      const s = 1 - smooth(0.0, 0.45, e.p);
      for (const t of e.tents) {
        t.visible = s > 0.02;
        t.scale.set(Math.max(s, 0.001), Math.max(s, 0.001), Math.max(s, 0.001));
      }
      const g = e.walkers;
      if (!g) continue;
      const vis = smooth(0.03, 0.18, e.p);
      g.visible = vis > 0.02;
      if (!g.visible) continue;
      g.scale.setScalar(vis);
      const u = Math.min(1, Math.max(0, (e.p - 0.12) / 0.88));
      const ease = u * u * (3 - 2 * u);
      p0.copy(e.home);
      p2.set(F + (offset.get(e.id) ?? 0), 0, 0);
      p1.set(p0.x + (p2.x - p0.x) * 0.28, 0, p2.z + (p0.z - p2.z) * 0.32);
      // 二次貝茲曲線：起點是營，終點是行列裡的位置
      const a = 1 - ease;
      tmp.copy(p0).multiplyScalar(a * a).addScaledVector(p1, 2 * a * ease).addScaledVector(p2, ease * ease);
      g.position.copy(tmp);
      dir.copy(p1).sub(p0).multiplyScalar(2 * a).addScaledVector(p2.clone().sub(p1), 2 * ease);
      dir.y = 0;
      dir.normalize();
      const east = Math.pow(ease, 3);
      dir.x = dir.x * (1 - east) + east;
      dir.z = dir.z * (1 - east);
      g.rotation.y = Math.atan2(-dir.z, dir.x);
      // 帳棚收起後，車上才看得到貨
      for (const c of e.cargo) c.visible = e.p > 0.1;
      // 走路的起伏
      for (const f of e.figs) {
        f.base.forEach((b, i) => {
          m4.makeTranslation(b.x, b.y + Math.abs(Math.sin(now * 6 + i * 1.7)) * 0.35, b.z);
          f.mesh.setMatrixAt(i, m4);
        });
        f.mesh.instanceMatrix.needsUpdate = true;
      }
    }

    // 帳幕（院子）
    const courtP = view.tabernacleGone || view.goingTabernacle ? 1 : 0;
    const cs = world.courtGroup.scale.x;
    const next = cs + Math.max(-dt / 2.4, Math.min(dt / 2.4, (1 - courtP) - cs));
    world.courtGroup.scale.setScalar(Math.max(next, 0.001));
    world.courtGroup.visible = next > 0.02;
  }

  return { update };
}
