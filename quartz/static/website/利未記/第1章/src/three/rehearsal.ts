import * as THREE from 'three';
import type { Actor, Item, Move, PlaceId, Step } from '../data/types';
import { ACTOR, PLACE_LABEL } from '../ui/meta';
import { createCourtyard, type Courtyard } from './courtyard';

/**
 * 3D 演練：在會幕院子裡把一個分支的步驟演出來。
 * 人物、祭牲、器物都用簡單幾何做成木頭玩偶風，不做寫實造型。
 * 宰殺只用象徵：祭牲跪下、側躺、淡出，旁邊出現盛血的盆；不畫傷口。
 * 座標（肘）：+X 東、-Z 北、+Y 上；燔祭壇中心 (18, 0, 0)、壇高 3；院門在 x = 50。
 */

type V = [number, number, number];
const v3 = (p: V) => new THREE.Vector3(...p);
const V3 = THREE.Vector3;

const ALTAR_X = 18;
/** 幔子、香壇（會幕裡）：照 3D 模型 */
const VEIL_X = -35;
const INCENSE_X = -32.5;
const ALTAR_TOP = 3.05;
const GATE_X = 50;

/** 祭物、器物放在各地點的位置 */
const SPOT: Record<PlaceId, V> = {
  gate: [47, 0, 0],
  front: [25, 0, 4.5],
  north: [18, 0, -6.6],
  altar: [ALTAR_X, ALTAR_TOP, 0],
  around: [ALTAR_X, 0, 0],
  horns: [ALTAR_X, ALTAR_TOP, 0],
  base: [ALTAR_X, 0, 2.9],
  side: [21.4, 0, 2.6],
  east: [23.2, 0, 0],
  laver: [2, 0, 0],
  door: [-14, 0, 0],
  veil: [-35, 0, 0],
  incense: [-32.5, 0, 0],
  court: [8, 0, -15],
  camp: [70, 0, -18],
  outside: [78, 0, 18],
};

/** 人站的位置（避開鏡頭和祭牲之間的連線） */
const STAND: Record<PlaceId, V> = {
  gate: [49.5, 0, 2.6],
  front: [26.4, 0, 1.2],
  north: [15.4, 0, -8.6],
  altar: [15.2, 0, 3.6],
  around: [15.2, 0, 3.6],
  horns: [15.2, 0, 3.6],
  base: [15.6, 0, 4],
  side: [19.2, 0, 4.4],
  east: [25.2, 0, 1.6],
  laver: [2, 0, 2.8],
  door: [-12.4, 0, 2.4],
  veil: [-33.2, 0, 2.4],
  incense: [-30.6, 0, 2.2],
  court: [10.4, 0, -13.4],
  camp: [72.5, 0, -16],
  outside: [80.6, 0, 16],
};

/** 每一步鏡頭看哪裡：[相機位置, 看的點] */
const ALTAR_VIEW: [V, V] = [[33, 12, 15], [19, 2, 1]];
const VIEW: Record<PlaceId, [V, V]> = {
  gate: [[64, 13, 22], [42, 2, 1]],
  front: [[40, 11, 22], [24, 2, 4]],
  north: [[32, 11, -20], [18.5, 1.5, -5]],
  altar: ALTAR_VIEW, around: [[34, 15, 17], [18, 1.5, 0]], horns: ALTAR_VIEW, base: ALTAR_VIEW, side: ALTAR_VIEW,
  east: [[35, 11, 13], [21.5, 1.5, 0.5]],
  laver: [[13, 9, 13], [2, 2, 0]],
  door: [[2, 11, 16], [-14, 3, 0]],
  // 會幕裡：頂蓋掀開，從牆上方往下看
  veil: [[-26, 24, 7], [-33.5, 1.5, 0]],
  incense: [[-25, 24, 7], [-32, 1, 0]],
  court: [[22, 12, -32], [8, 1, -14]],
  camp: [[88, 14, 0], [68, 1, -20]],
  outside: [[70, 22, 40], [66, 1, 12]],
};
const START_VIEW: [V, V] = [[66, 30, 44], [30, 0, 0]];

/* ------------------------------------------------------------------ 造型 */

const matCache = new Map<string, THREE.MeshStandardMaterial>();
function mat(color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  const key = color + JSON.stringify(extra);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra }));
  return matCache.get(key)!;
}
function mesh(geo: THREE.BufferGeometry, color: string | THREE.Material, pos: V = [0, 0, 0], extra?: Partial<THREE.MeshStandardMaterialParameters>) {
  const m = new THREE.Mesh(geo, typeof color === 'string' ? mat(color, extra) : color);
  m.position.set(...pos);
  m.castShadow = true;
  return m;
}

const SKIN = '#c9a07a';
const PRIESTLY = (a: Actor) => a !== 'offerer' && a !== 'elders' && a !== 'moses' && a !== 'people';

/** 木頭棋子造型的人：本體朝 +Z，手臂可以擺動 */
function figure(actor: Actor): THREE.Group {
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const color = PRIESTLY(actor) ? '#f3eee2' : actor === 'moses' ? '#8a3f2e' : actor === 'elders' ? '#7b6b3a' : '#9a7650';
  const robe = new THREE.MeshStandardMaterial({ color, roughness: 0.75 });
  g.userData.robe = robe;
  g.userData.robeColor = color;
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.95, 3.0, 18), robe, [0, 1.5, 0]));
  g.add(mesh(new THREE.SphereGeometry(0.5, 20, 14), SKIN, [0, 3.45, 0]));
  // 臉朝的方向：一個小鼻子，看得出人面向哪邊
  g.add(mesh(new THREE.SphereGeometry(0.09, 8, 6), '#b98c66', [0, 3.42, 0.5]));
  if (PRIESTLY(actor)) {
    g.add(mesh(new THREE.CylinderGeometry(0.47, 0.5, 0.46, 18), '#fbf8f0', [0, 3.86, 0]));
    g.add(mesh(new THREE.CylinderGeometry(0.67, 0.69, 0.22, 18), actor === 'anointed' || actor === 'aaron' ? '#3553a0' : '#b3263a', [0, 2.15, 0]));
  } else {
    g.add(mesh(new THREE.SphereGeometry(0.55, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), '#e2d3b4', [0, 3.5, 0]));
  }
  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.62, 2.75, 0);
    pivot.add(mesh(new THREE.CapsuleGeometry(0.14, 1.0, 4, 8), robe, [0, -0.65, 0]));
    pivot.add(mesh(new THREE.SphereGeometry(0.15, 10, 8), SKIN, [0, -1.3, 0]));
    pivot.rotation.z = side * 0.12;
    g.add(pivot);
    return pivot;
  };
  g.userData.arm = arm(1);
  g.userData.armL = arm(-1);
  g.userData.person = true;
  return g;
}

type AnimalKind = 'bull' | 'ram' | 'goat' | 'lamb';
const ANIMAL: Record<AnimalKind, { len: number; h: number; color: string; head: string; horn?: 'bull' | 'ram' | 'goat' }> = {
  bull: { len: 4.6, h: 3.1, color: '#8a5a3a', head: '#7a4c30', horn: 'bull' },
  ram: { len: 2.6, h: 1.9, color: '#e6dcc6', head: '#b9a27c', horn: 'ram' },
  goat: { len: 2.5, h: 1.9, color: '#5a4a3a', head: '#4a3c2e', horn: 'goat' },
  lamb: { len: 2.2, h: 1.6, color: '#ebe3d0', head: '#c9b894' },
};

/** 四腳的祭牲：本體朝 +Z，腿接在髖關節上可以擺 */
function quadruped(kind: AnimalKind): THREE.Group {
  const a = ANIMAL[kind];
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const r = a.h * 0.26;
  const legH = a.h * 0.45;
  const body = mesh(new THREE.CapsuleGeometry(r, a.len * 0.5, 6, 14), a.color, [0, legH + r * 0.85, 0]);
  body.rotation.x = Math.PI / 2;
  g.add(body);
  const legs: THREE.Group[] = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const hip = new THREE.Group();
    hip.position.set(x * r * 0.55, legH, z * a.len * 0.3);
    hip.add(mesh(new THREE.CylinderGeometry(a.h * 0.07, a.h * 0.06, legH, 8), a.head, [0, -legH / 2, 0]));
    g.add(hip);
    legs.push(hip);
  }
  const head = new THREE.Group();
  head.position.set(0, legH + r * 1.55, a.len * 0.48);
  head.add(mesh(new THREE.SphereGeometry(r * 0.62, 14, 10), a.head));
  head.add(mesh(new THREE.BoxGeometry(r * 0.7, r * 0.55, r * 0.7), a.head, [0, -r * 0.18, r * 0.55]));
  if (a.horn === 'bull') {
    for (const s of [1, -1]) {
      const h = mesh(new THREE.ConeGeometry(r * 0.16, r * 0.9, 8), '#efe6d2', [s * r * 0.62, r * 0.42, 0]);
      h.rotation.z = -s * 1.1;
      head.add(h);
    }
  } else if (a.horn === 'ram') {
    for (const s of [1, -1]) {
      const h = mesh(new THREE.TorusGeometry(r * 0.32, r * 0.11, 8, 16, Math.PI * 1.5), '#8d7650', [s * r * 0.55, r * 0.15, -r * 0.05]);
      h.rotation.y = Math.PI / 2;
      head.add(h);
    }
  } else if (a.horn === 'goat') {
    for (const s of [1, -1]) {
      const h = mesh(new THREE.ConeGeometry(r * 0.1, r * 0.9, 8), '#3a3026', [s * r * 0.25, r * 0.65, -r * 0.25]);
      h.rotation.x = -0.6;
      head.add(h);
    }
  }
  g.add(head);
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.08, a.h * 0.35, 6), a.head, [0, legH + r * 0.9, -a.len * 0.52]));
  g.userData.legs = legs;
  g.userData.head = head;
  g.userData.r = r;
  return g;
}

function bird(): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(0.42, 14, 10), '#b8b3a8', [0, 0.45, 0]);
  body.scale.set(0.85, 0.8, 1.25);
  g.add(body);
  g.add(mesh(new THREE.SphereGeometry(0.24, 12, 8), '#a8a296', [0, 0.82, 0.42]));
  const beak = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), '#d8a35a', [0, 0.8, 0.68]);
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (const s of [1, -1]) {
    const w = mesh(new THREE.SphereGeometry(0.3, 10, 6), '#9d978b', [s * 0.36, 0.5, -0.05]);
    w.scale.set(0.3, 0.7, 1.2);
    g.add(w);
  }
  // 斑鳩或雛鴿：放大一點才看得見
  g.scale.setScalar(1.3);
  return g;
}

function basin(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.6, 0.42, 0.38, 18), '#9a5a2a', [0, 0.19, 0], { metalness: 0.7, roughness: 0.4 }));
  const blood = mesh(new THREE.CircleGeometry(0.52, 18), '#7d1424', [0, 0.37, 0], { roughness: 0.3 });
  blood.rotation.x = -Math.PI / 2;
  g.add(blood);
  return g;
}

/** 一堆東西：每一塊是一個子物件，可以一塊一塊搬 */
function pile(kind: 'meat' | 'fat' | 'skin' | 'ash', animal: AnimalKind | 'bird' = 'bull'): THREE.Group {
  const g = new THREE.Group();
  const scale = animal === 'bull' ? 1 : animal === 'bird' ? 0.45 : 0.7;
  if (kind === 'meat') {
    const pts: V[] = [[0, 0.22, 0], [0.7, 0.22, 0.2], [-0.6, 0.22, 0.3], [0.2, 0.22, -0.6], [-0.3, 0.6, -0.1], [0.4, 0.6, -0.1]];
    for (const p of pts) {
      const m = mesh(new THREE.BoxGeometry(0.62, 0.42, 0.5), '#b8574a', p);
      m.rotation.y = p[0] * 2;
      g.add(m);
    }
  } else if (kind === 'fat') {
    for (const p of [[0, 0.25, 0], [0.45, 0.22, 0.25], [-0.4, 0.22, 0.2]] as V[]) g.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), '#f1d989', p));
  } else if (kind === 'skin') {
    const c = animal === 'bull' ? '#7a4c30' : animal === 'goat' ? '#4a3c2e' : '#e4dccb';
    const m = mesh(new THREE.BoxGeometry(2.0, 0.08, 1.3), c, [0, 0.05, 0]);
    m.rotation.y = 0.3;
    g.add(m);
  } else {
    g.add(mesh(new THREE.ConeGeometry(0.75, 0.55, 14), '#8d8a85', [0, 0.27, 0]));
  }
  g.scale.setScalar(scale);
  return g;
}

const TOKEN_COLOR: Partial<Record<Item, string>> = {
  flour: '#f3ead2', cake: '#e2c48a', grain: '#d9b84a', bread: '#e2c48a', breast: '#e7a77a', thigh: '#c9784e', silver: '#d6d9de', oil: '#d9c25a',
};
/** 其他祭物：每一件由幾塊組成，搬的時候可以一塊一塊放 */
function token(item: Item): THREE.Group {
  const g = new THREE.Group();
  const disc = (c: string, y: number, r = 0.45) => mesh(new THREE.CylinderGeometry(r, r, 0.1, 18), c, [0, y, 0]);
  switch (item) {
    case 'flour':
      g.add(mesh(new THREE.CylinderGeometry(0.55, 0.4, 0.35, 18), '#c8a46e', [0, 0.18, 0]));
      g.add(mesh(new THREE.SphereGeometry(0.45, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#f6efdc', [0, 0.33, 0]));
      break;
    case 'cake':
      for (let i = 0; i < 3; i++) g.add(disc('#e2c48a', 0.06 + i * 0.11));
      break;
    case 'bread':
      for (let i = 0; i < 4; i++) g.add(disc(i === 3 ? '#c99a5a' : '#e8cf98', 0.06 + i * 0.11, 0.42));
      break;
    case 'grain':
      for (let i = 0; i < 6; i++) {
        const st = mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.2, 6), '#d9b84a', [(i - 2.5) * 0.08, 0.5, 0]);
        st.rotation.z = (i - 2.5) * 0.08;
        g.add(st);
      }
      break;
    case 'silver':
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), '#d6d9de', [(i % 2) * 0.15, 0.04 + i * 0.07, 0], { metalness: 0.9, roughness: 0.3 }));
      break;
    case 'breast': {
      const m = mesh(new THREE.SphereGeometry(0.5, 14, 10), '#e7a77a', [0, 0.3, 0]);
      m.scale.set(1.2, 0.55, 0.9);
      g.add(m);
      break;
    }
    case 'thigh': {
      const m = mesh(new THREE.CapsuleGeometry(0.22, 0.9, 6, 10), '#c9784e', [0, 0.25, 0]);
      m.rotation.z = Math.PI / 2;
      g.add(m);
      break;
    }
    default:
      g.add(mesh(new THREE.SphereGeometry(0.4, 12, 10), TOKEN_COLOR[item] ?? '#cbb894', [0, 0.4, 0]));
  }
  return g;
}
const ANIMALS = new Set<Item>(['bull', 'ram', 'goat', 'lamb', 'bird']);
const PILES = new Set<Item>(['meat', 'fat', 'skin', 'ash']);

/* ------------------------------------------------------------------ 演練 */

export interface Rehearsal {
  /** 正在演的步驟快轉到結束（換步之前先呼叫，避免兩段動畫搶同一個人） */
  stop(): Promise<void>;
  /** steps：這一種祭會用到哪些東西（切塊時只做出用得到的胸、腿、皮） */
  reset(steps?: Step[]): void;
  /** focus：這是目前這一步，鏡頭要過去 */
  step(st: Step, animate: boolean, focus: boolean): Promise<void>;
  overview(animate: boolean): void;
  setColor(color: string): void;
  dispose(): void;
}

export async function createRehearsal(host: HTMLElement, labelsHost: HTMLElement, opts: { reducedMotion: boolean; lowPower: boolean }): Promise<Rehearsal> {
  const court: Courtyard = await createCourtyard(host, labelsHost, [], () => {}, { ...opts, heroOffset: false, autoRotate: false, drift: true });
  const root = new THREE.Group();
  court.scene.add(root);
  // 營中：院子外面幾頂帳棚（示意），看得出「營」在哪裡
  for (const [x, z, r] of [[64, -24, 0.3], [71, -27, -0.2], [78, -23, 0.5], [67, -31, 0.1], [75, -33, -0.4]] as V[]) {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3.2, 4), mat('#8a6a45'));
    tent.position.set(x, 1.6, z);
    tent.rotation.y = r + Math.PI / 4;
    tent.castShadow = true;
    court.scene.add(tent);
  }

  /* ---------------- 動畫：每個 tween 屬於一個世代，reset 之後舊的直接作廢 */
  let gen = 0;
  const running: { gen: number; t: number; ms: number; fn: (e: number) => void; done: () => void; linear?: boolean }[] = [];
  let ff = false;
  let cur: Promise<void> = Promise.resolve();
  court.onTick((_, dt) => {
    for (let i = running.length - 1; i >= 0; i--) {
      const r = running[i];
      if (ff || r.gen !== gen) { running.splice(i, 1); r.fn(1); r.done(); continue; }
      r.t = Math.min(1, Math.max(0, r.t + (dt * 1000) / r.ms));
      r.fn(r.linear ? r.t : r.t < 0.5 ? 2 * r.t * r.t : 1 - (-2 * r.t + 2) ** 2 / 2);
      if (r.t >= 1) { running.splice(i, 1); r.done(); }
    }
  });
  /** live=false：直接跳到結果（跳步時重建前面的狀態用） */
  let live = true;
  const tween = (ms: number, fn: (e: number) => void, linear = false) => new Promise<void>((done) => {
    if (!live || ff || opts.reducedMotion) { fn(1); done(); return; }
    running.push({ gen, t: 0, ms, fn, done, linear });
  });
  const pause = (ms: number) => tween(ms, () => {});

  /* ---------------- 人物 */
  const people = new Map<Actor, THREE.Group>();
  const nameTags = new Map<Actor, HTMLElement>();
  const HOME: Partial<Record<Actor, V>> = { offerer: [53, 0, 3.4], priest: [15, 0, 4.2], anointed: [12, 0, 5], elders: [53, 0, -3], moses: [24, 0, 9], aaron: [12, 0, 6] };
  function home(a: Actor, g: THREE.Group) {
    g.position.set(...(HOME[a] ?? [12, 0, 6]));
    g.rotation.set(0, -Math.PI / 2, 0);
    g.visible = true;
    (g.userData.arm as THREE.Group).rotation.x = 0;
    (g.userData.armL as THREE.Group).rotation.x = 0;
    (g.userData.robe as THREE.MeshStandardMaterial).color.set(g.userData.robeColor);
  }
  function person(a: Actor) {
    let g = people.get(a);
    if (!g) {
      g = figure(a);
      root.add(g);
      people.set(a, g);
      const tag = document.createElement('div');
      tag.className = 'tag3d';
      tag.textContent = ACTOR[a].label;
      tag.style.setProperty('--c', ACTOR[a].color);
      labelsHost.append(tag);
      nameTags.set(a, tag);
      home(a, g);
    }
    return g;
  }
  let activeActor: Actor | null = null;

  /** 拿在手上的東西：每格跟著人的手走 */
  const held = new Map<THREE.Object3D, THREE.Group>();
  const handPos = (p: THREE.Group, out = new V3()) => {
    p.updateMatrixWorld();
    return p.localToWorld(out.set(0, 2.2, 1.0));
  };

  /* ---------------- 地點標示圈、血跡、煙 */
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.0, 2.25, 48), new THREE.MeshBasicMaterial({ color: '#c2410c', transparent: true, opacity: 0.85, side: THREE.DoubleSide, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.add(ring);
  const placeTag = document.createElement('div');
  placeTag.className = 'tag3d place';
  labelsHost.append(placeTag);
  let placeAt: PlaceId | null = null;
  /** 地點標籤上數次數（例如彈血七次） */
  const flash = (n: string) => { if (placeAt) placeTag.textContent = `${PLACE_LABEL[placeAt]}・第 ${n} 次`; };

  const stains = new THREE.Group();
  root.add(stains);

  const puffs: THREE.Mesh[] = [];
  const smoke = new THREE.Group();
  for (let i = 0; i < 12; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshStandardMaterial({ color: '#d8d2c8', transparent: true, opacity: 0, depthWrite: false }));
    p.userData.phase = i / 12;
    puffs.push(p);
    smoke.add(p);
  }
  smoke.position.set(ALTAR_X, ALTAR_TOP + 1.2, 0);
  root.add(smoke);
  let smoking = 0;

  const tmp = new V3();
  court.onTick((t) => {
    for (const p of puffs) {
      const k = (t * 0.16 + p.userData.phase) % 1;
      p.position.set(Math.sin(k * 6 + p.userData.phase * 9) * 0.8, k * 8, Math.cos(k * 5) * 0.6);
      p.scale.setScalar(0.5 + k * 1.4);
      (p.material as THREE.MeshStandardMaterial).opacity = smoking * 0.45 * (1 - k);
    }
    ring.rotation.z = t * 0.4;
    for (const [item, p] of held) item.position.copy(handPos(p, tmp)).add(new V3(0, -0.35, 0));
    for (const [a, g] of people) {
      const tag = nameTags.get(a)!;
      const p = court.project(g.position.clone().add(new V3(0, 4.6, 0)));
      tag.style.opacity = p.hidden ? '0' : '1';
      tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      tag.classList.toggle('on', a === activeActor);
    }
    if (placeAt) {
      const p = court.project(v3(SPOT[placeAt]).setY(0));
      placeTag.style.opacity = p.hidden ? '0' : '1';
      placeTag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, 8px)`;
    } else placeTag.style.opacity = '0';
  });

  /* ---------------- 場上的東西 */
  const things = new Map<string, THREE.Object3D>();
  let uses = new Set<Item>();
  /** 第八天：眾民、榮光、亞倫身上的血點 */
  const crowd: THREE.Group[] = [];
  let glory: THREE.Group | null = null;
  const marks: THREE.Object3D[] = [];
  /** 被拖著走的祭牲：每格跟著人 */
  const dragging: (() => void)[] = [];
  court.onTick(() => dragging.forEach((f) => f()));
  let animal: AnimalKind | 'bird' = 'bull';
  let logsOn: THREE.Group | null = null;

  function make(item: Item): THREE.Object3D {
    switch (item) {
      case 'bull': case 'ram': case 'goat': case 'lamb':
        animal = item;
        return quadruped(item);
      case 'bird':
        animal = 'bird';
        return bird();
      case 'meat': case 'fat': case 'skin': case 'ash':
        return pile(item, animal);
      default:
        return token(item);
    }
  }
  function spot(place: PlaceId, item: Item): THREE.Vector3 {
    const p = v3(SPOT[place]);
    const off: Partial<Record<Item, V>> = { fat: [0.9, 0, -0.7], skin: [-1.6, 0, 1.2] };
    if (place === 'altar') return p.add(new V3(item === 'fat' ? 0.8 : 0, 0.02, item === 'fat' ? -0.8 : 0));
    return p.add(v3(off[item] ?? [0, 0, 0]));
  }
  function face(g: THREE.Object3D, to: THREE.Vector3) {
    const d = to.clone().sub(g.position);
    if (d.x * d.x + d.z * d.z > 0.01) g.rotation.y = Math.atan2(d.x, d.z);
  }

  /** 走路：人擺手、祭牲擺腿；要出入院門就繞過門口 */
  function route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    const inside = (p: THREE.Vector3) => p.x < GATE_X;
    if (inside(from) === inside(to)) return [to];
    const a = new V3(inside(from) ? GATE_X - 4 : GATE_X + 4, 0, 0);
    const b = new V3(inside(from) ? GATE_X + 4 : GATE_X - 4, 0, 0);
    return [a, b, to];
  }
  async function walkLeg(g: THREE.Object3D, to: THREE.Vector3, speed: number) {
    const from = g.position.clone();
    const dist = Math.hypot(to.x - from.x, to.z - from.z);
    if (dist < 0.05 && Math.abs(to.y - from.y) < 0.05) return;
    face(g, to);
    const isPerson = !!g.userData.person;
    const legs = g.userData.legs as THREE.Group[] | undefined;
    const arm = g.userData.arm as THREE.Group | undefined;
    const armL = g.userData.armL as THREE.Group | undefined;
    const busy = isPerson && [...held.values()].includes(g as THREE.Group);
    const strides = Math.max(2, dist / (isPerson ? 1.3 : 1.6));
    // 遠路走快一點，最多 4.5 秒
    await tween(Math.min(4500, Math.max(500, (dist / speed) * 1000)), (e) => {
      g.position.lerpVectors(from, to, e);
      const ph = Math.sin(e * Math.PI * strides);
      if (isPerson) {
        g.position.y = from.y + (to.y - from.y) * e + Math.abs(ph) * 0.14;
        if (!busy && arm && armL) { arm.rotation.x = ph * 0.55; armL.rotation.x = -ph * 0.55; }
      } else if (legs) {
        legs.forEach((l, k) => (l.rotation.x = ph * 0.45 * (k === 0 || k === 3 ? 1 : -1)));
      } else {
        // 被拋過去的東西：走一段弧線
        g.position.y += Math.sin(e * Math.PI) * Math.min(2.4, 0.6 + dist * 0.25);
      }
    }, true);
    g.position.copy(to);
    if (legs) legs.forEach((l) => (l.rotation.x = 0));
    if (isPerson && !busy && arm && armL) { arm.rotation.x = 0; armL.rotation.x = 0; }
  }
  async function walk(g: THREE.Object3D, to: THREE.Vector3, speed = 4.2) {
    for (const p of route(g.position, to)) await walkLeg(g, p, speed);
  }
  async function walkTo(p: THREE.Group, place: PlaceId, look?: THREE.Vector3) {
    await walk(p, v3(STAND[place]));
    face(p, look ?? v3(SPOT[place]));
  }

  /* ---------------- 手勢 */
  const armOf = (p: THREE.Group) => p.userData.arm as THREE.Group;
  async function armTo(p: THREE.Group, x: number, ms = 450) {
    const arm = armOf(p);
    const from = arm.rotation.x;
    await tween(ms, (e) => (arm.rotation.x = from + (x - from) * e));
  }
  async function lean(p: THREE.Group, x: number, ms = 400) {
    const from = p.rotation.x;
    await tween(ms, (e) => (p.rotation.x = from + (x - from) * e));
  }
  async function throwArm(p: THREE.Group) {
    await armTo(p, -2.3, 260);
    await armTo(p, -0.6, 220);
  }

  /** 血滴從 from 飛到每個目標，各自一條弧線 */
  async function drops(from: THREE.Vector3, targets: THREE.Vector3[], per = 4) {
    if (!live) return;
    const g = new THREE.Group();
    root.add(g);
    const ds = targets.flatMap((t) => Array.from({ length: per }, (_, k) => k).map((k) => {
      const d = mesh(new THREE.SphereGeometry(0.11, 6, 5), '#8e1c2c');
      d.userData.to = per === 1 ? t.clone() : t.clone().add(new V3((k - 1.5) * 0.45, Math.random() * 0.4 - 0.2, (Math.random() - 0.5) * 0.3));
      d.userData.delay = k * 0.06;
      g.add(d);
      return d;
    }));
    await tween(650, (e) => ds.forEach((d) => {
      const k = Math.min(1, Math.max(0, (e - d.userData.delay) / (1 - d.userData.delay)));
      d.position.lerpVectors(from, d.userData.to, k);
      d.position.y += Math.sin(k * Math.PI) * 1.4;
    }), true);
    root.remove(g);
  }
  function stain(geo: THREE.BufferGeometry, pos: V, rot: V = [0, 0, 0]) {
    const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#7d1424', transparent: true, opacity: 0, roughness: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    m.position.set(...pos);
    m.rotation.set(...rot);
    stains.add(m);
    return m;
  }
  const showStain = (m: THREE.Mesh, ms = 400) => tween(ms, (e) => ((m.material as THREE.MeshStandardMaterial).opacity = 0.85 * e));

  async function fade(o: THREE.Object3D, to: number, ms = 600) {
    const mats: THREE.MeshStandardMaterial[] = [];
    o.traverse((c) => {
      const m = c as THREE.Mesh;
      if (m.isMesh) {
        if (!m.userData.own) {
          m.material = (m.material as THREE.MeshStandardMaterial).clone();
          m.userData.own = true;
        }
        (m.material as THREE.MeshStandardMaterial).transparent = true;
        mats.push(m.material as THREE.MeshStandardMaterial);
      }
    });
    const from = mats[0]?.opacity ?? 1;
    await tween(ms, (e) => mats.forEach((m) => (m.opacity = from + (to - from) * e)));
  }
  const pop = (o: THREE.Object3D, ms = 320) => {
    const s = o.scale.x || 1;
    o.scale.setScalar(0.01);
    return tween(ms, (e) => o.scale.setScalar(Math.max(0.01, s * (e < 0.8 ? e * 1.2 : 1.2 - (e - 0.8)))));
  };
  const lastAnimal = () => [...things.entries()].reverse().find(([k]) => ANIMALS.has(k as Item));

  /** 人走到某樣東西旁邊、拿起來（別人手上的就從他手上接過來） */
  async function pickUp(p: THREE.Group, o: THREE.Object3D) {
    const holder = held.get(o);
    if (holder === p) return;
    const target = holder ? holder.position.clone() : o.position.clone();
    const dir = p.position.clone().sub(target).setY(0);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize().multiplyScalar(holder ? 1.6 : 1.4);
    await walk(p, target.clone().setY(0).add(dir));
    face(p, target);
    if (!holder) await lean(p, 0.3, 300);
    await armTo(p, -1.2, 300);
    held.set(o, p);
    if (holder) await armTo(holder, 0, 300);
    else await lean(p, 0, 300);
  }
  /** 把手上的一堆東西一塊一塊放到 dest（壇上就拋上去） */
  async function placePile(p: THREE.Group, o: THREE.Object3D, dest: THREE.Vector3, toss: boolean) {
    held.delete(o);
    const start = handPos(p).add(new V3(0, -0.35, 0));
    o.position.copy(dest);
    const kids = [...o.children];
    const local = kids.map((c) => c.position.clone());
    const scale = o.scale.x || 1;
    const off = start.clone().sub(dest).divideScalar(scale);
    kids.forEach((c, k) => c.position.copy(local[k]).add(off));
    for (let k = 0; k < kids.length; k++) {
      if (toss) void throwArm(p);
      const c = kids[k];
      await tween(toss ? 420 : 260, (e) => {
        c.position.copy(local[k]).addScaledVector(off, 1 - e);
        c.position.y += (Math.sin(e * Math.PI) * (toss ? 1.8 : 0.4)) / scale;
      });
      c.position.copy(local[k]);
    }
    await armTo(p, 0, 300);
  }

  /* ---------------- 血 */
  // 處理血、柴、祭肉的人：這一步的人若不是一般百姓就由他做（例如利8 的摩西），否則是祭司
  const holderOf = (actor: Actor | null) => person(actor && !['offerer', 'elders', 'people', 'unstated'].includes(actor) ? actor : 'priest');
  async function bloodMove(m: Move, actor: Actor | null) {
    const priest = holderOf(actor);
    const b = things.get('basin');
    if (b) await pickUp(priest, b);
    const src = () => handPos(priest).add(new V3(0, 0.2, 0));
    let putDown = true;
    if (m.how === 'carry') {
      // 端著血走（例如帶進會幕）
      await walkTo(priest, m.to);
      putDown = false;
    } else if (m.how === 'splash' && m.to === 'around') {
      // 拿著盆繞壇一圈，四面各潑一次
      const sides: { stand: V; face: V; rot: V }[] = [
        { stand: [ALTAR_X + 1.2, 0, 4.6], face: [ALTAR_X, 2.0, 2.62], rot: [0, 0, 0] },
        { stand: [ALTAR_X + 4.7, 0, 1.6], face: [ALTAR_X + 2.62, 2.0, 0], rot: [0, Math.PI / 2, 0] },
        { stand: [ALTAR_X + 1.2, 0, -4.6], face: [ALTAR_X, 2.0, -2.62], rot: [0, Math.PI, 0] },
        { stand: [ALTAR_X - 4.7, 0, -1.2], face: [ALTAR_X - 2.62, 2.0, 0], rot: [0, -Math.PI / 2, 0] },
      ];
      for (const s of sides) {
        const st = stain(new THREE.PlaneGeometry(4.0, 1.4), s.face, s.rot);
        await walk(priest, v3(s.stand), 5);
        face(priest, v3(s.face));
        void throwArm(priest);
        await drops(src(), [v3(s.face)]);
        await showStain(st, 300);
      }
      await walk(priest, v3(STAND.around), 5);
      face(priest, v3([ALTAR_X, 0, 0]));
    } else if (m.how === 'sprinkle' && m.to === 'veil') {
      // 對著幔子彈血：一次一次數
      await walkTo(priest, 'veil', v3(SPOT.veil).setY(3));
      const n = m.count ?? 7;
      for (let k = 0; k < n; k++) {
        const at = v3([VEIL_X + 0.15, 2.2 + (k % 3) * 0.7, -2.4 + k * 0.8]);
        void armTo(priest, -1.9, 160).then(() => armTo(priest, -1.2, 160));
        await drops(src(), [at], 1);
        await showStain(stain(new THREE.CircleGeometry(0.16, 10), [at.x, at.y, at.z], [0, Math.PI / 2, 0]), 120);
        flash(`${k + 1}`);
      }
      putDown = false;
    } else if (m.how === 'sprinkle') {
      // 彈在壇的旁邊
      await walkTo(priest, m.to, v3(SPOT[m.to]));
      for (let k = 0; k < 3; k++) {
        const at = v3([ALTAR_X + 1.2 - k * 0.8, 1.6 + k * 0.3, 2.62]);
        void armTo(priest, -1.9, 160).then(() => armTo(priest, -1.2, 160));
        await drops(src(), [at], 1);
        await showStain(stain(new THREE.CircleGeometry(0.2, 10), [at.x, at.y, at.z]), 120);
      }
      putDown = false;
    } else if (m.how === 'drain' || m.how === 'pour') {
      const at = m.to === 'base' ? v3([ALTAR_X + 0.6, 0.05, 2.9]) : v3(SPOT[m.to]).setY(0.05);
      await walk(priest, at.clone().setY(0).add(new V3(1.4, 0, 1.4)), 4.5);
      face(priest, at);
      const st = stain(new THREE.CircleGeometry(m.how === 'pour' ? 1.1 : 0.6, 20), [at.x, 0.05, at.z], [-Math.PI / 2, 0, 0]);
      await armTo(priest, -1.6, 350);
      for (let k = 0; k < 3; k++) await drops(src(), [at]);
      await showStain(st, 500);
      await armTo(priest, -1.2, 300);
    } else if (m.how === 'daub' && (m.to === 'horns' || m.to === 'incense')) {
      // 用指頭蘸血抹在四個角上：燔祭壇在院子裡，香壇在會幕裡
      const inside = m.to === 'incense';
      const cx = inside ? INCENSE_X : ALTAR_X;
      const reach = inside ? 0.42 : 2.2;
      const top = inside ? 2.1 : ALTAR_TOP + 0.3;
      const stand = inside ? 1.6 : 3.6;
      for (const [x, z] of [[1, 1], [1, -1], [-1, -1], [-1, 1]]) {
        const hp = v3([cx + x * reach, top, z * reach]);
        await walk(priest, v3([cx + x * stand, 0, z * stand]), 5);
        face(priest, hp);
        void armTo(priest, -2.0, 300);
        await drops(src(), [hp], inside ? 1 : 4);
        await showStain(stain(new THREE.SphereGeometry(inside ? 0.1 : 0.22, 8, 6), [hp.x, hp.y, hp.z]), 250);
      }
      putDown = !inside;
    } else {
      await walkTo(priest, m.to);
      void throwArm(priest);
      await drops(src(), [v3(SPOT[m.to]).setY(2)]);
    }
    if (putDown && b && held.get(b) === priest) {
      held.delete(b);
      await armTo(priest, 0, 300);
      b.position.copy(priest.position).add(new V3(0.9, 0, 0.9)).setY(0);
    }
  }

  /** 營外潔淨之地：一小堆柴、一團火 */
  let campFire: THREE.Group | null = null;
  function lightCampFire() {
    if (campFire) return;
    campFire = new THREE.Group();
    campFire.position.copy(v3(SPOT.outside));
    for (let i = 0; i < 4; i++) {
      const lg = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8), '#6b4a2e', [0, 0.15, -0.6 + i * 0.4]);
      lg.rotation.z = Math.PI / 2;
      lg.rotation.y = i % 2 ? 0.3 : -0.3;
      campFire.add(lg);
    }
    for (let i = 0; i < 3; i++) {
      const f = mesh(new THREE.ConeGeometry(0.5 - i * 0.12, 1.6 - i * 0.3, 10), i === 0 ? '#e2711d' : '#f5b041', [0, 0.9, 0], { emissive: '#ff7a1a', emissiveIntensity: 0.9 - i * 0.2, transparent: true, opacity: 0.85 });
      f.castShadow = false;
      f.userData.flame = i;
      campFire.add(f);
    }
    const light = new THREE.PointLight(0xff8a3a, 6, 12, 1.6);
    light.position.y = 1.2;
    campFire.add(light);
    root.add(campFire);
  }
  court.onTick((t) => {
    if (!campFire) return;
    for (const c of campFire.children) {
      if (c.userData.flame === undefined) continue;
      const k = c.userData.flame as number;
      c.scale.set(1, 0.85 + Math.sin(t * (7 + k * 3)) * 0.15, 1);
    }
  });

  /** 一塊一塊沉進火裡 */
  async function burnPieces(objs: THREE.Object3D[], fire: (e: number) => void) {
    const pieces = objs.flatMap((o) => (o.children.length > 1 ? o.children : [o]));
    for (const c of pieces) {
      const s = c.scale.x;
      const y0 = c.position.y;
      void tween(500, fire);
      await tween(pieces.length > 1 ? 360 : 1400, (e) => { c.scale.setScalar(Math.max(0.01, s * (1 - e))); c.position.y = y0 - e * 0.3; });
    }
    for (const o of objs) o.removeFromParent();
  }

  /** 素祭、贖罪祭的細麵：只抓一把 */
  function handful(item: Item, near: THREE.Vector3): THREE.Object3D {
    const g = new THREE.Group();
    const c = item === 'grain' ? '#d9b84a' : '#f3ead2';
    g.add(mesh(new THREE.SphereGeometry(0.28, 10, 8), c, [0, 0.25, 0]));
    g.add(mesh(new THREE.SphereGeometry(0.12, 8, 6), '#e8e0c8', [0.2, 0.4, 0.05]));
    g.position.copy(near).add(new V3(0.6, 0, 0.4));
    root.add(g);
    return g;
  }

  /* ---------------- 每一種移動 */
  async function playMove(m: Move, st: Step) {
    const actor = st.actor === 'unstated' || st.actor === 'people' ? null : st.actor;
    if (m.item === 'blood') return bloodMove(m, actor);
    if (m.item === 'fire') {
      // 祭司把柴一根一根擺上去，火慢慢旺起來
      const p = holderOf(actor);
      await walkTo(p, 'altar', v3(SPOT.altar));
      if (!logsOn) {
        logsOn = new THREE.Group();
        logsOn.position.set(ALTAR_X, ALTAR_TOP, 0);
        root.add(logsOn);
        for (let i = 0; i < 5; i++) {
          const lg = mesh(new THREE.CylinderGeometry(0.13, 0.13, 3.4, 8), '#6b4a2e');
          lg.rotation.z = Math.PI / 2;
          lg.rotation.y = i % 2 ? 0.25 : -0.25;
          const end = new V3(0, 0.14 + (i % 2) * 0.22, -1.2 + i * 0.6);
          logsOn.add(lg);
          const start = handPos(p).sub(logsOn.position);
          void throwArm(p);
          await tween(420, (e) => {
            lg.position.lerpVectors(start, end, e);
            lg.position.y += Math.sin(e * Math.PI) * 1.2;
          });
          lg.position.copy(end);
        }
      }
      await tween(1500, (e) => court.setFire(0.12 + e * 0.5));
      await armTo(p, 0, 300);
      return;
    }
    if (m.item === 'smoke') {
      await tween(1600, (e) => { smoking = Math.max(smoking, e); court.setFire(0.62 + e * 0.38); });
      return;
    }
    if (m.item === 'hand') {
      // 走到祭牲頭旁邊，彎身把手按在頭上
      const p = person(actor && !PRIESTLY(actor) ? actor : actor ?? 'offerer');
      const a = lastAnimal()?.[1];
      if (a) {
        const head = (a.userData.head as THREE.Object3D | undefined) ?? a;
        const hp = head.getWorldPosition(new V3());
        const side = new V3(Math.cos(a.rotation.y), 0, -Math.sin(a.rotation.y)).multiplyScalar(1.5);
        await walk(p, hp.clone().setY(0).add(side));
        face(p, hp);
      }
      await lean(p, 0.22, 400);
      await armTo(p, -1.15, 600);
      for (let k = 0; k < 2; k++) { await armTo(p, -0.95, 380); await armTo(p, -1.15, 380); }
      await pause(500);
      await armTo(p, 0, 450);
      await lean(p, 0, 350);
      return;
    }

    if (m.how === 'burn') {
      if (m.to === 'outside') {
        // 搬到營外燒：整隻公牛（還躺著的祭牲）或剩下的肉
        let o = things.get(m.item) ?? (m.item === 'meat' || m.item === 'skin' ? lastAnimal()?.[1] : undefined);
        if (!o) return;
        const key = [...things.entries()].find(([, v]) => v === o)?.[0];
        const p = actor ? person(actor) : null;
        if (p) {
          if (o.userData.slain) {
            // 祭牲太大：人在前面拖著走
            await walk(p, o.position.clone().setY(0).add(new V3(2.2, 0, 0)));
            const off = o.position.clone().sub(p.position);
            const follow = () => o!.position.copy(p.position).add(off);
            dragging.push(follow);
            lightCampFire();
            await walk(p, v3(STAND.outside), 4);
            dragging.splice(dragging.indexOf(follow), 1);
            await walk(o, v3(SPOT.outside).setY(o.position.y), 3);
          } else {
            await pickUp(p, o);
            lightCampFire();
            await walkTo(p, 'outside');
            held.delete(o);
            await walk(o, v3(SPOT.outside).add(new V3(0, 0.6, 0)), 5);
            await armTo(p, 0, 300);
          }
        } else {
          lightCampFire();
          await walk(o, v3(SPOT.outside), 5);
        }
        lightCampFire();
        await burnPieces([o], () => {});
        if (key) things.delete(key);
        if (o === lastAnimal()?.[1]) things.forEach((v, k) => v === o && things.delete(k));
        return;
      }
      // 燒在壇上
      let o = things.get(m.item);
      const p = actor ? person(actor) : null;
      if (o && m.part) {
        o = handful(m.item, o.position);
      } else if (!o) {
        // 沒有現成的（例如贖罪祭的脂油）：從祭牲那裡取下來
        const from = m.from ?? 'front';
        o = PILES.has(m.item) ? make(m.item) : handful(m.item, v3(SPOT[from]));
        if (!o.parent) {
          o.position.copy(spot(from, m.item));
          root.add(o);
        }
        const slain = m.item === 'meat' ? lastAnimal() : undefined;
        if (slain && slain[1].userData.slain) {
          // 祭牲切成塊子燒：祭牲淡出，換成一堆肉
          o.position.copy(slain[1].position).setY(0);
          await fade(slain[1], 0, 500);
          slain[1].removeFromParent();
          things.delete(slain[0]);
        }
        await pop(o, 350);
      }
      if (p && held.get(o) !== p && o.position.distanceTo(v3(SPOT.altar)) > 1.2) await pickUp(p, o);
      if (p && held.get(o) === p) {
        await walkTo(p, 'altar', v3(SPOT.altar));
        await placePile(p, o, spot('altar', m.item), true);
      } else if (o.position.distanceTo(v3(SPOT.altar)) > 1.2) await walk(o, spot('altar', m.item), 6);
      const fat = m.item === 'meat' ? things.get('fat') : undefined;
      await burnPieces(fat ? [o, fat] : [o], (e) => court.setFire(0.7 + Math.sin(e * Math.PI) * 0.3));
      things.forEach((v, k) => (v === o || v === fat) && things.delete(k));
      return;
    }

    if (m.how === 'wave') {
      // 在耶和華面前搖一搖：舉起來，前後擺
      let o = things.get(m.item);
      if (!o) {
        o = make(m.item);
        o.position.copy(spot(m.to, m.item)).add(new V3(-1, 0, 1));
        root.add(o);
        things.set(m.item, o);
        await pop(o, 350);
      }
      held.delete(o);
      const base = o.position.clone();
      await tween(700, (e) => (o.position.y = base.y + e * 2.2));
      await tween(2200, (e) => {
        o.position.x = base.x + Math.sin(e * Math.PI * 4) * 0.8;
        o.position.y = base.y + 2.2 + Math.abs(Math.sin(e * Math.PI * 4)) * 0.3;
      }, true);
      await tween(600, (e) => { o.position.x = base.x; o.position.y = base.y + 2.2 * (1 - e); });
      return;
    }

    // carry / place / eat
    let o = things.get(m.item);
    const isAnimal = ANIMALS.has(m.item) && m.item !== 'bird';
    if (!o) {
      o = make(m.item);
      o.position.copy(m.from === 'altar' ? spot('altar', m.item) : spot(m.from ?? m.to, m.item));
      if (m.from === 'gate') o.position.x += 4;
      o.rotation.y = -Math.PI / 2;
      root.add(o);
      things.set(m.item, o);
      if (m.item === 'meat') {
        // 祭肉從躺著的祭牲來：祭牲淡出，換成一堆肉
        const a = lastAnimal();
        if (a && a[1].userData.slain) {
          o.position.copy(a[1].position).setY(0);
          await fade(a[1], 0, 500);
          a[1].removeFromParent();
          things.delete(a[0]);
          await pop(o, 400);
        }
      } else if (m.from === 'altar' && m.item === 'ash') {
        // 隔天早晨：壇上剩下灰，火變小
        court.setFire(0.2);
        await pop(o, 500);
      } else if (m.from && m.from !== 'gate') await pop(o, 350);
    }
    const dest = spot(m.to, m.item);
    if (!actor) { await walk(o, dest, 5); return; }
    const p = person(actor);

    if (isAnimal) {
      // 人牽著祭牲走：人走在祭牲頭的旁邊
      const lead = dest.clone().add(new V3(0, 0, -1.8));
      if (p.position.distanceTo(o.position) > 3) await walk(p, o.position.clone().add(new V3(-0.5, 0, -1.8)));
      await Promise.all([walk(o, dest, 3.2), walk(p, lead, 3.2)]);
      face(p, dest);
      await walk(p, v3(STAND[m.to]), 4);
      face(p, dest);
      return;
    }

    // 鳥和其他東西：拿起來、走過去、放下
    await pickUp(p, o);
    await walkTo(p, m.to, dest);
    if (m.item === 'bird') {
      // 鳥一直拿在手上（接著要放血、撕開）；送到壇上才放下
      if (m.to === 'altar') {
        held.delete(o);
        await walk(o, dest, 6);
        await armTo(p, 0, 300);
      }
    } else {
      await placePile(p, o, dest, m.to === 'altar');
    }
    if (m.how === 'eat') {
      // 吃：慢慢變淡（在聖處或營中）
      await pause(400);
      await fade(o, 0.45, 1200);
    }
  }

  /* ---------------- 宰、切塊、洗、撕開、換衣服、烤：象徵式的演出 */
  async function playAct(st: Step) {
    const a = lastAnimal();
    // 眾民由一群人代表，不另外做一個人
    const actor = st.actor === 'unstated' || st.actor === 'people' ? null : st.actor;
    const p = actor ? person(actor) : null;
    if (st.act === 'slay' && a) {
      const [k, o] = a;
      if (k === 'bird') {
        // 祭司手上的鳥：低頭、靜下來，旁邊出現接血的小盆
        await tween(900, (e) => { o.rotation.x = e * 0.9; });
        await fade(o, 0.6, 500);
        const b = basin();
        b.scale.setScalar(0.6);
        b.position.copy(v3(SPOT.side)).add(new V3(0.6, 0, 0.6));
        root.add(b);
        things.set('basin', b);
        await pop(b);
        return;
      }
      if (p) {
        face(p, o.position);
        await armTo(p, -2.7, 600);
        await pause(250);
        await armTo(p, -0.5, 220);
      }
      const r = (o.userData.r as number) ?? 0.6;
      const b = basin();
      b.position.copy(o.position).add(new V3(Math.sin(o.rotation.y), 0, Math.cos(o.rotation.y)).multiplyScalar(2.6)).setY(0);
      b.position.x += 0.8;
      // 先跪下（前腳收起），再側躺
      const legs = o.userData.legs as THREE.Group[];
      await tween(800, (e) => { o.rotation.x = 0.22 * e; legs[0].rotation.x = legs[1].rotation.x = -1.2 * e; });
      await tween(1100, (e) => { o.rotation.z = 1.45 * e; o.rotation.x = 0.22 * (1 - e); o.position.y = r * 0.9 * e; });
      o.userData.slain = true;
      things.get('basin')?.removeFromParent();
      root.add(b);
      things.set('basin', b);
      await Promise.all([pop(b, 450), fade(o, 0.55, 700)]);
      if (p) await armTo(p, 0, 300);
      return;
    }
    if (st.act === 'cut' && a) {
      const [k, o] = a;
      if (p) face(p, o.position);
      const base = o.position.clone().setY(0);
      // 先剝皮，再一刀一刀切成塊子；這一種祭用得到的才做出來（胸、右腿、皮）
      const parts: THREE.Object3D[] = [];
      const add = (item: Item, off: V) => {
        const t = make(item);
        t.position.copy(base).add(v3(off));
        root.add(t);
        things.set(item, t);
        parts.push(...(t.children.length > 1 ? t.children : [t]));
        return t;
      };
      if (uses.has('skin')) {
        const skin = add('skin', [-1.6, 0, 1.2]);
        root.remove(skin);
        parts.length = 0;
        root.add(skin);
        if (p) await lean(p, 0.28, 300);
        await pop(skin, 500);
      } else if (p) await lean(p, 0.28, 300);
      add('meat', [0, 0, 0]);
      add('fat', [0.9, 0, -0.7]);
      if (uses.has('breast')) add('breast', [-0.9, 0, -0.6]);
      if (uses.has('thigh')) add('thigh', [-1.2, 0, 0.4]);
      parts.forEach((c) => c.scale.setScalar(0.01));
      const chops = 4;
      for (let c = 0; c < chops; c++) {
        if (p) { await armTo(p, -2.5, 260); await armTo(p, -0.7, 180); }
        void fade(o, 0.5 * (1 - (c + 1) / chops), 250);
        const batch = parts.slice(Math.floor((c * parts.length) / chops), Math.floor(((c + 1) * parts.length) / chops));
        await Promise.all(batch.map((piece) => tween(260, (e) => piece.scale.setScalar(Math.max(0.01, e)))));
      }
      parts.forEach((c) => c.scale.setScalar(1));
      root.remove(o);
      things.delete(k);
      if (p) { await armTo(p, 0, 300); await lean(p, 0, 300); }
      return;
    }
    if (st.act === 'bake') {
      // 細麵在鐵鏊上做成餅
      const flour = things.get('flour');
      const cake = make('cake');
      cake.position.copy(flour?.position ?? v3(SPOT[st.at]));
      if (flour) { await fade(flour, 0, 500); flour.removeFromParent(); things.delete('flour'); }
      root.add(cake);
      things.set('cake', cake);
      await pop(cake, 600);
      return;
    }
    if (st.act === 'wash') {
      // 水澆在臟腑和腿上（經文沒說誰洗，所以沒有人動）
      const at = v3(SPOT[st.at]).setY(0.1);
      const w = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 6, 24), new THREE.MeshStandardMaterial({ color: '#7fb5d9', transparent: true, opacity: 0.9 }));
      w.rotation.x = -Math.PI / 2;
      w.position.copy(at);
      root.add(w);
      const water = new THREE.Group();
      root.add(water);
      const ds = Array.from({ length: 14 }, (_, k) => {
        const d = mesh(new THREE.SphereGeometry(0.09, 6, 5), '#8ec3e6');
        d.userData.x = (Math.random() - 0.5) * 1.6;
        d.userData.z = (Math.random() - 0.5) * 1.6;
        d.userData.delay = (k / 14) * 0.6;
        d.visible = false;
        water.add(d);
        return d;
      });
      await tween(2200, (e) => {
        ds.forEach((d) => {
          const k = Math.min(1, Math.max(0, (e - d.userData.delay) / 0.4));
          d.position.set(at.x + d.userData.x, 3.2 - k * 3.1, at.z + d.userData.z);
          d.visible = k > 0 && k < 1;
        });
        w.scale.setScalar(1 + e * 2.5);
        (w.material as THREE.MeshStandardMaterial).opacity = 0.9 * (1 - e);
      }, true);
      root.remove(w, water);
      return;
    }
    if (st.act === 'tear' && a) {
      const o = a[1];
      if (p) await walkTo(p, 'altar', v3(SPOT.altar));
      await tween(1000, (e) => o.scale.set(1.3 * (1 + Math.sin(e * Math.PI) * 0.5), 1.3 * (1 - Math.sin(e * Math.PI) * 0.25), 1.3));
      o.scale.set(1.55, 1.15, 1.3);
      return;
    }
    if (st.act === 'mark') {
      // 摩西把血抹在亞倫的右耳垂、右手大拇指、右腳大拇指上（人物面向 +Z，右邊是 -X）
      const moses = person('moses');
      const aaron = person('aaron');
      await walk(moses, aaron.position.clone().add(new V3(-1.6, 0, 1.2)));
      face(moses, aaron.position);
      face(aaron, moses.position);
      for (const at of [[-0.48, 3.42, 0.08], [-0.78, 1.42, 0.22], [-0.32, 0.06, 0.62]] as V[]) {
        await armTo(moses, -1.5, 300);
        const dot = mesh(new THREE.SphereGeometry(0.12, 8, 6), '#8e1c2c', at);
        aaron.add(dot);
        marks.push(dot);
        await pop(dot, 300);
        await armTo(moses, -0.6, 250);
      }
      await armTo(moses, 0, 300);
      return;
    }
    if (st.act === 'gather') {
      // 全會眾近前來，站在耶和華面前
      if (!crowd.length) {
        for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
          const g = figure('offerer');
          g.scale.setScalar(0.85);
          g.position.set(58 + r * 2.6, 0, -7 + c * 2.8 + (r % 2) * 1.2);
          g.rotation.y = -Math.PI / 2;
          root.add(g);
          crowd.push(g);
        }
      }
      court.flyTo(v3([62, 20, 30]), v3([32, 1, 0]));
      await Promise.all(crowd.map((g, k) => walk(g, g.position.clone().add(new V3(-18, 0, 0)), 5 + (k % 3))));
      return;
    }
    if (st.act === 'bless' && p) {
      // 舉起雙手，面向眾民
      const target = crowd[0]?.position ?? v3(SPOT.gate);
      await walk(p, v3([26, 0, 0]));
      face(p, target);
      await Promise.all([armTo(p, -2.9, 700), tween(700, (e) => ((p.userData.armL as THREE.Group).rotation.x = -2.9 * e))]);
      await pause(1600);
      await Promise.all([armTo(p, 0, 500), tween(500, (e) => ((p.userData.armL as THREE.Group).rotation.x = -2.9 * (1 - e)))]);
      return;
    }
    if (st.act === 'glory') {
      // 摩西、亞倫進入會幕，又出來祝福；榮光向眾民顯現
      const moses = person('moses');
      const aaron = person('aaron');
      court.flyTo(v3([30, 24, 42]), v3([2, 5, 0]));
      await Promise.all([walk(moses, v3([-12, 0, 1.2]), 6), walk(aaron, v3([-12, 0, -1.2]), 6)]);
      await Promise.all([walk(moses, v3([-19, 0, 1.2]), 3), walk(aaron, v3([-19, 0, -1.2]), 3)]);
      moses.visible = aaron.visible = false;
      await pause(900);
      moses.visible = aaron.visible = true;
      await Promise.all([walk(moses, v3([-10, 0, 1.6]), 3), walk(aaron, v3([-10, 0, -1.6]), 3)]);
      for (const g of [moses, aaron]) face(g, v3([40, 0, 0]));
      void Promise.all([moses, aaron].map((g) => armTo(g, -2.6, 600)));
      if (!glory) {
        glory = new THREE.Group();
        const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending }));
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff4c2', transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        const light = new THREE.PointLight(0xffd27a, 0, 120, 1.2);
        glory.add(halo, core, light);
        glory.position.set(-30, 14, 0);
        glory.userData.light = light;
        root.add(glory);
      }
      const g = glory;
      await tween(2600, (e) => { g.scale.setScalar(0.1 + e * 16); (g.userData.light as THREE.PointLight).intensity = e * 900; });
      await pause(800);
      return;
    }
    if (st.act === 'godfire') {
      // 火從耶和華面前出來，燒盡壇上的燔祭和脂油；眾民歡呼，俯伏在地
      court.flyTo(v3([52, 22, 36]), v3([10, 3, 0]));
      const ball = new THREE.Group();
      ball.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ffb14a', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })));
      const fl = new THREE.PointLight(0xff9a40, 400, 60, 1.4);
      ball.add(fl);
      root.add(ball);
      const from = v3([-14, 7, 0]);
      const to = v3([ALTAR_X, ALTAR_TOP + 1, 0]);
      await pause(500);
      await tween(1300, (e) => {
        ball.position.lerpVectors(from, to, e);
        ball.position.y += Math.sin(e * Math.PI) * 9;
      });
      root.remove(ball);
      // 壇上剩下的全部燒盡
      const onAltar = [...things.entries()].filter(([, o]) => o.position.distanceTo(v3(SPOT.altar)) < 3);
      void tween(2200, (e) => court.setFire(1 + Math.sin(e * Math.PI) * 1.4));
      smoking = 1;
      for (const [k, o] of onAltar) { void burnPieces([o], () => {}); things.delete(k); }
      // 眾民先歡呼（跳一下），再俯伏
      await Promise.all(crowd.map((c, k) => tween(500, (e) => (c.position.y = Math.sin(e * Math.PI) * 0.6 * (1 + (k % 3) * 0.2)))));
      await Promise.all(crowd.map((c) => tween(1100, (e) => (c.rotation.x = 1.25 * e))));
      await Promise.all([...people.values()].filter((g) => g.visible).map((g) => tween(1100, (e) => (g.rotation.x = 1.0 * e))));
      await pause(800);
      return;
    }
    if (st.act === 'change' && p) {
      // 換下細麻布衣服，穿上別的衣服：轉一圈，袍子換顏色
      const robe = p.userData.robe as THREE.MeshStandardMaterial;
      const from = robe.color.clone();
      const to = new THREE.Color('#c8b48e');
      const y0 = p.rotation.y;
      await tween(1400, (e) => { p.rotation.y = y0 + e * Math.PI * 2; robe.color.lerpColors(from, to, e); });
    }
  }

  function setPlace(place: PlaceId | null) {
    placeAt = place;
    ring.visible = !!place;
    if (place) {
      const p = v3(SPOT[place]);
      ring.position.set(p.x, place === 'altar' || place === 'horns' ? ALTAR_TOP + 0.1 : 0.06, p.z);
      ring.scale.setScalar(place === 'around' || place === 'altar' || place === 'horns' ? 1.9 : 1);
      placeTag.textContent = PLACE_LABEL[place];
    }
  }

  function reset(steps?: Step[]) {
    gen++;
    held.clear();
    dragging.length = 0;
    if (steps) uses = new Set(steps.flatMap((st) => (st.moves ?? []).map((m) => m.item)));
    if (campFire) { root.remove(campFire); campFire = null; }
    for (const c of crowd.splice(0)) root.remove(c);
    if (glory) { root.remove(glory); glory = null; }
    for (const d of marks.splice(0)) d.removeFromParent();
    for (const o of things.values()) root.remove(o);
    things.clear();
    stains.clear();
    if (logsOn) { root.remove(logsOn); logsOn = null; }
    smoking = 0;
    court.setFire(0.12);
    for (const [a, g] of people) home(a, g);
    person('offerer');
    person('priest');
    // 這一個選項用不到的人先退場（例如從「受膏的祭司」切到「官長」）
    if (steps) {
      const cast = new Set<Actor>(steps.map((st) => st.actor));
      for (const [a, g] of people) {
        const on = cast.has(a);
        g.visible = on;
        nameTags.get(a)!.hidden = !on;
      }
    }
    activeActor = null;
    setPlace(null);
  }
  reset();
  court.flyTo(v3(START_VIEW[0]), v3(START_VIEW[1]), true);

  return {
    async stop() {
      ff = true;
      for (const r of running.splice(0)) { r.fn(1); r.done(); }
      await cur;
      ff = false;
    },
    reset,
    overview(animate) {
      court.setRoof(false);
      court.flyTo(v3(START_VIEW[0]), v3(START_VIEW[1]), !animate);
    },
    setColor(c) {
      const probe = document.createElement('span');
      probe.style.color = c;
      document.body.append(probe);
      (ring.material as THREE.MeshBasicMaterial).color.set(getComputedStyle(probe).color);
      probe.remove();
    },
    step(st, animate, focus) {
      cur = run(st, animate, focus);
      return cur;
    },
    dispose() {
      gen++;
      court.dispose();
    },
  };

  async function run(st: Step, animate: boolean, focus: boolean) {
      live = animate;
      const myGen = gen;
      activeActor = st.actor === 'unstated' ? null : st.actor;
      setPlace(st.at);
      if (focus) {
        court.flyTo(v3(VIEW[st.at][0]), v3(VIEW[st.at][1]), !animate);
        // 進會幕裡（幔子、香壇）時掀開頂蓋
        court.setRoof(st.at === 'veil' || st.at === 'incense' || st.at === 'door');
      }
      const moves = st.moves ?? [];
      // 搬東西、處理血的步驟由動作本身帶著人走；其他步驟人先走到定位
      const selfMoving = moves.some((m) => m.how === 'carry' || m.item === 'blood' || m.item === 'fire' || m.item === 'hand' || m.how === 'burn');
      // 眾民由一群人代表，不另外走一個人出來
      if (activeActor === 'people') activeActor = null;
      if (activeActor && !selfMoving && st.act !== 'tear' && st.act !== 'glory' && st.act !== 'gather') {
        const p = person(activeActor);
        const a = lastAnimal()?.[1];
        await walkTo(p, st.at, a && a.position.distanceTo(v3(SPOT[st.at])) < 4 ? a.position : undefined);
      }
      if (myGen !== gen) return;
      // 先牽到定位、先按手，然後才宰；其餘的移動接在動作後面
      let split = -1;
      moves.forEach((m, k) => { if ((m.how === 'carry' && ANIMALS.has(m.item)) || m.item === 'hand') split = k; });
      for (const m of moves.slice(0, split + 1)) {
        if (myGen !== gen) return;
        await playMove(m, st);
      }
      if (st.act && myGen === gen) await playAct(st);
      for (const m of moves.slice(split + 1)) {
        if (myGen !== gen) return;
        await playMove(m, st);
      }
      live = true;
  }
}
