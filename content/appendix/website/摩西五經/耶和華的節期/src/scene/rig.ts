// 可動的人物與動物：身體、頭、雙臂各自有樞軸，才做得出呼吸、轉頭、舉手、低頭吃草。
// 近景的人用 RigPerson（每人約 10 個 draw call）；成群的遠景用 PersonCrowd／AnimalCrowd（實例化，每幀只改矩陣）。
// 動態分兩層：idle（呼吸、微晃、轉頭、吃草）受 motion 開關控制；pose（舉手、走路等捲動帶動的動作）永遠照常。
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  LatheGeometry,
  Matrix4,
  Mesh,
  Quaternion,
  type ShaderMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { COW_NECK, LAMB_NECK, cattleGeo, hullGeo, lambGeo, mergeParts, T, type Part } from './geo';
import { handGeo, limbGeo } from './geo2';
import { hullMat, solidInstanced } from './materials';
import { clamp, smooth } from './util';

const fract = (x: number): number => x - Math.floor(x);
const hash = (n: number): number => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

// ---------------------------------------------------------------- 共用的 solid（輪廓幾何快取）
const hullCache = new WeakMap<BufferGeometry, BufferGeometry>();
function solidShared(geo: BufferGeometry, mat: ShaderMaterial, px: number): Group {
  const g = new Group();
  g.add(new Mesh(geo, mat));
  if (px > 0) {
    let h = hullCache.get(geo);
    if (!h) {
      h = hullGeo(geo);
      hullCache.set(geo, h);
    }
    g.add(new Mesh(h, hullMat(px)));
  }
  return g;
}

// ---------------------------------------------------------------- 人物部件幾何（有快取）
interface PersonParts {
  lower: BufferGeometry;
  torso: BufferGeometry;
  head: BufferGeometry;
  arm: BufferGeometry;
  staff: BufferGeometry;
}
export interface RigOpts {
  slim?: boolean;
  sit?: boolean;
  veil?: boolean;
  wrap?: boolean;
  belt?: boolean;
  bundle?: boolean;
  staff?: boolean;
  staffSide?: 'L' | 'R';
  scale?: number;
  /** 孩子：呼吸與微晃幅度加倍 */
  kid?: boolean;
  /** 初始上身前傾（弧度） */
  bow?: number;
  armL?: [number, number];
  armR?: [number, number];
  seed?: number;
  outline?: number;
  /** 不畫手臂（手臂由程式另外裝，例如舉禾捆的祭司） */
  noArms?: boolean;
  /** 細麻布的內袍加褲子（利16:4）：袍擺提高，下面露出兩條褲管 */
  linen?: boolean;
}

const partCache = new Map<string, PersonParts>();
function personParts(o: RigOpts): PersonParts {
  const key = `${o.slim ? 1 : 0}${o.sit ? 1 : 0}${o.veil ? 1 : 0}${o.wrap === false ? 0 : 1}${o.belt ? 1 : 0}${o.bundle ? 1 : 0}${o.linen ? 1 : 0}`;
  let c = partCache.get(key);
  if (c) return c;
  const seg = 12;
  const skirtPts = o.slim
    ? [new Vector2(0.235, 0), new Vector2(0.255, 0.02), new Vector2(0.245, 0.32), new Vector2(0.225, 0.7), new Vector2(0.2, 0.96)]
    : [new Vector2(0.31, 0), new Vector2(0.37, 0.02), new Vector2(0.345, 0.32), new Vector2(0.285, 0.7), new Vector2(0.225, 0.96)];
  const lowerParts: Part[] = o.sit
    ? [
        { g: new LatheGeometry(skirtPts, seg), m: T(0, 0, 0, 0, 0, 0, 1.2, 0.52, 0.98), part: 0 },
        { g: new SphereGeometry(0.17, 9, 6), m: T(0, 0.15, 0.2, 0, 0, 0, 1.5, 0.85, 1.25), part: 0 },
      ]
    : o.linen
      ? [
          { g: new LatheGeometry(skirtPts, seg), m: T(0, 0.22, 0, 0, 0, 0, 0.9, 0.77, 0.7), part: 0 },
          { g: new CylinderGeometry(0.085, 0.07, 0.3, 7), m: T(0.1, 0.15, 0), part: 0 },
          { g: new CylinderGeometry(0.085, 0.07, 0.3, 7), m: T(-0.1, 0.15, 0), part: 0 },
        ]
      : [{ g: new LatheGeometry(skirtPts, seg), m: T(0, 0, 0, 0, 0, 0, 1, 1, 0.78), part: 0 }];
  const torsoPts = [new Vector2(0.225, 0), new Vector2(0.245, 0.18), new Vector2(0.27, 0.36), new Vector2(0.22, 0.45), new Vector2(0.09, 0.49), new Vector2(0.001, 0.5)];
  const torsoParts: Part[] = [{ g: new LatheGeometry(torsoPts, seg), m: T(0, 0, 0, 0, 0, 0, 1, 1, 0.74), part: 0 }];
  if (o.belt) torsoParts.push({ g: new TorusGeometry(0.235, 0.022, 5, 14), m: T(0, 0.03, 0, Math.PI / 2, 0, 0, 1, 0.74, 1), part: 4 });
  if (o.bundle) {
    torsoParts.push({ g: new BoxGeometry(0.46, 0.2, 0.32), m: T(0.14, 0.62, -0.06, 0.15, 0.3, -0.25), part: 5 });
    torsoParts.push({ g: new TorusGeometry(0.14, 0.02, 4, 8), m: T(0.14, 0.62, -0.06, 0.15, 0.3, -0.25), part: 4 });
  }
  // 頭：樞軸在脖子（上身座標 y=0.5）
  const headParts: Part[] = [{ g: new SphereGeometry(0.115, 10, 8), m: T(0, 0.13, 0.025), part: 1 }];
  if (o.wrap !== false) {
    headParts.push({ g: new SphereGeometry(0.14, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58), m: T(0, 0.155, -0.005), part: 2 });
    headParts.push({ g: new BoxGeometry(0.2, 0.2, 0.05), m: T(0, 0.05, -0.1, 0.25), part: 2 });
    if (o.veil) {
      headParts.push({ g: new SphereGeometry(0.155, 10, 7, 0, Math.PI * 2, 0, Math.PI * 0.72), m: T(0, 0.15, -0.015), part: 2 });
      headParts.push({ g: new BoxGeometry(0.34, 0.46, 0.07), m: T(0, -0.12, -0.12, 0.12), part: 2 });
    }
  }
  const armG = new CylinderGeometry(0.068, 0.05, 0.62, 8);
  armG.translate(0, -0.31, 0);
  const arm = mergeParts([{ g: armG, part: 0 }, { g: new SphereGeometry(0.052, 7, 6), m: T(0, -0.64, 0), part: 1 }], true);
  const staff = mergeParts([{ g: new CylinderGeometry(0.02, 0.025, 1.85, 6), part: 3 }], true);
  c = { lower: mergeParts(lowerParts, true), torso: mergeParts(torsoParts, true), head: mergeParts(headParts, true), arm, staff };
  partCache.set(key, c);
  return c;
}

const _v = new Vector3();

/** 一個可動的人物：root（位置、轉向由呼叫端設）→ lower 袍擺、upper 上身（樞軸在腰）→ torso、頭、雙臂 */
export class RigPerson {
  group = new Group();
  upper = new Group();
  headPivot = new Group();
  armL = new Group();
  armR = new Group();
  handL = new Group();
  handR = new Group();
  staff: Group | null = null;
  // --- 姿勢（捲動帶動的動作寫這裡，永遠照常）
  bow: number;
  twist = 0;
  lean = 0;
  swingL: number;
  splayL: number;
  swingR: number;
  splayR: number;
  headYaw = 0;
  headPitch = 0;
  headRoll = 0;
  /** 拿杖的手換握：0＝原本那隻手，1＝另一隻手 */
  staffMix = 0;
  /** 整體站姿高度修正（蹲下用） */
  crouch = 0;
  baseScale: number;
  private kid: boolean;
  private ph: number;
  private period: number;
  private hipY: number;
  private staffSide: 'L' | 'R' | null;

  constructor(o: RigOpts, mat: ShaderMaterial) {
    const parts = personParts(o);
    const px = o.outline ?? 2.2;
    const seed = o.seed ?? Math.random() * 100;
    this.ph = hash(seed) * Math.PI * 2;
    this.period = 6 + hash(seed + 5) * 6;
    this.kid = !!o.kid;
    this.baseScale = o.scale ?? 1;
    this.hipY = o.sit ? 0.5 : 0.95;
    this.bow = o.bow ?? 0;
    this.swingL = o.armL?.[0] ?? 0.05;
    this.splayL = o.armL?.[1] ?? 0.12;
    this.swingR = o.armR?.[0] ?? 0.05;
    this.splayR = o.armR?.[1] ?? 0.12;
    this.staffSide = o.staff ? (o.staffSide ?? 'L') : null;
    this.group.add(solidShared(parts.lower, mat, px));
    this.upper.position.y = this.hipY;
    this.group.add(this.upper);
    this.upper.add(solidShared(parts.torso, mat, px));
    this.headPivot.position.set(0, 0.5, 0);
    this.headPivot.add(solidShared(parts.head, mat, px));
    this.upper.add(this.headPivot);
    this.armL.position.set(0.235, 0.43, 0);
    this.armR.position.set(-0.235, 0.43, 0);
    this.armL.rotation.order = 'ZYX';
    this.armR.rotation.order = 'ZYX';
    this.armL.add(solidShared(parts.arm, mat, px));
    this.armR.add(solidShared(parts.arm, mat, px));
    this.handL.position.set(0, -0.64, 0);
    this.handR.position.set(0, -0.64, 0);
    this.armL.add(this.handL);
    this.armR.add(this.handR);
    this.upper.add(this.armL, this.armR);
    if (o.noArms) {
      this.armL.visible = false;
      this.armR.visible = false;
    }
    if (o.staff) {
      this.staff = solidShared(parts.staff, mat, px);
      this.group.add(this.staff);
    }
    this.update(0, false);
  }

  /** 讓一隻手臂指向某個方向（人物座標、未前傾時）：舉到嘴邊、伸向某物 */
  aim(side: 'L' | 'R', dx: number, dy: number, dz: number): void {
    const l = Math.hypot(dx, dy, dz) || 1;
    const swing = Math.asin(clamp(dz / l, -1, 1));
    const phi = Math.atan2(dx, -dy);
    if (side === 'L') {
      this.swingL = swing;
      this.splayL = phi;
    } else {
      this.swingR = swing;
      this.splayR = -phi;
    }
  }

  /** 走路的手臂擺動與上下起伏；回傳該加在 y 上的起伏量 */
  gait(phase: number, amount: number): number {
    const s = Math.sin(phase);
    this.swingL = 0.5 * amount * s;
    this.swingR = -0.5 * amount * s;
    this.twist = 0.06 * amount * s;
    return Math.abs(Math.cos(phase)) * 0.035 * amount;
  }

  /** 把姿勢與 idle 合成到各個樞軸。t：秒；motion：動態開關 */
  update(t: number, motion: boolean): void {
    const m = motion ? 1 : 0;
    const k = this.kid ? 2 : 1;
    const breath = m * 0.01 * k * Math.sin(t * 1.5708 + this.ph);
    this.group.scale.set(this.baseScale, this.baseScale * (1 + breath) * (1 - this.crouch * 0.3), this.baseScale);
    const sx = m * 0.013 * k * Math.sin(t * 0.83 + this.ph * 1.7);
    const sz = m * 0.026 * k * Math.sin(t * 0.61 + this.ph);
    this.upper.rotation.set(this.bow + sx + this.crouch * 0.5, this.twist, sz + this.lean);
    // 轉頭：每 6–12 秒一次，±15°，歷時 1.2 秒（無狀態：由時間決定）
    const P = this.period;
    const u = (t + this.ph * 3) / P;
    const kk = Math.floor(u);
    const f = (u - kk) * P;
    const st = hash(kk * 7.3 + this.ph) * (P - 1.4);
    let turn = 0;
    if (f > st && f < st + 1.2) turn = (hash(kk * 3.1 + this.ph * 2) * 2 - 1) * 0.26 * Math.sin((Math.PI * (f - st)) / 1.2);
    this.headPivot.rotation.set(this.headPitch, this.headYaw + m * turn, this.headRoll);
    const jL = this.staffSide === 'L' ? m * 0.035 * Math.sin(t * 1.3 + this.ph) : 0;
    const jR = this.staffSide === 'R' ? m * 0.035 * Math.sin(t * 1.3 + this.ph) : 0;
    this.armL.rotation.set(-(this.swingL + jL), 0, this.splayL);
    this.armR.rotation.set(-(this.swingR + jR), 0, -this.splayR);
    if (this.staff) {
      this.upper.updateMatrix();
      const main = this.staffSide === 'R' ? this.armR : this.armL;
      const other = this.staffSide === 'R' ? this.armL : this.armR;
      main.updateMatrix();
      _v.set(0, -0.64, 0).applyMatrix4(main.matrix).applyMatrix4(this.upper.matrix);
      let x = _v.x;
      let z = _v.z;
      if (this.staffMix > 0) {
        other.updateMatrix();
        _v.set(0, -0.64, 0).applyMatrix4(other.matrix).applyMatrix4(this.upper.matrix);
        x += (_v.x - x) * this.staffMix;
        z += (_v.z - z) * this.staffMix;
      }
      this.staff.position.set(x, 0.9, z);
    }
  }
}

// ---------------------------------------------------------------- 動物（單隻）
export type Species = 'lamb' | 'ram' | 'goat' | 'cow';
const animalCache = new Map<string, { body: BufferGeometry; head: BufferGeometry }>();
function animalParts(kind: Species): { body: BufferGeometry; head: BufferGeometry } {
  let c = animalCache.get(kind);
  if (!c) {
    c =
      kind === 'cow'
        ? { body: cattleGeo(false, 'body'), head: cattleGeo(false, 'head') }
        : { body: lambGeo(false, kind, 'body'), head: lambGeo(false, kind, 'head') };
    animalCache.set(kind, c);
  }
  return c;
}

/** 低頭吃草的節奏：回傳 0..1（0＝頭抬著，1＝頭低到地面），8–14 秒一輪 */
function grazeAmt(t: number, ph: number, per: number): number {
  const u = fract((t + ph * 3) / per);
  return smooth(0.1, 0.24, u) * (1 - smooth(0.52, 0.66, u));
}

export class Animal {
  group = new Group();
  headPivot = new Group();
  private ph: number;
  private per: number;
  private neck: Vector3;
  private cow: boolean;
  /** 原地小踏步（拴著的羊羔） */
  stomp = false;
  /** 低頭吃草（false＝走動時不吃） */
  graze = true;
  /** 捲動帶動的頭部姿勢 */
  headYaw = 0;
  headPitch = 0;
  baseScale = 1;
  private y0 = 0;

  constructor(kind: Species, mat: ShaderMaterial, px = 2.2, seed = 1) {
    const p = animalParts(kind);
    this.cow = kind === 'cow';
    this.neck = this.cow ? COW_NECK : LAMB_NECK;
    this.ph = hash(seed) * 6.28;
    this.per = 8 + hash(seed + 3) * 6;
    this.group.add(solidShared(p.body, mat, px));
    this.headPivot.position.copy(this.neck);
    const hg = solidShared(p.head, mat, px);
    hg.position.set(-this.neck.x, -this.neck.y, -this.neck.z);
    this.headPivot.add(hg);
    this.group.add(this.headPivot);
  }

  update(t: number, motion: boolean): void {
    const m = motion ? 1 : 0;
    let pitch = this.headPitch;
    let yaw = this.headYaw;
    let roll = 0;
    if (this.cow) {
      pitch += m * (0.1 * Math.sin(t * 0.9 + this.ph) + 0.35 * grazeAmt(t, this.ph, this.per) * (this.graze ? 1 : 0));
    } else {
      pitch += m * 0.62 * grazeAmt(t, this.ph, this.per) * (this.graze ? 1 : 0);
      pitch += m * 0.03 * Math.sin(t * 9 + this.ph) * grazeAmt(t, this.ph, this.per);
      const fl = fract(t / 5.3 + this.ph);
      if (fl < 0.07) roll += m * 0.1 * Math.sin(fl * 140);
      yaw += m * 0.06 * Math.sin(t * 0.37 + this.ph);
    }
    this.headPivot.rotation.set(pitch, yaw, roll);
    const sc = this.baseScale;
    if (this.stomp && motion) {
      this.group.position.y = this.y0 + Math.abs(Math.sin(t * 3.2 + this.ph)) * 0.025;
      this.group.rotation.z = Math.sin(t * 3.2 + this.ph) * 0.035;
    } else if (this.stomp) {
      this.group.position.y = this.y0;
      this.group.rotation.z = 0;
    }
    this.group.scale.setScalar(sc);
  }
  setBaseY(y: number): void {
    this.y0 = y;
    this.group.position.y = y;
  }
}

// ---------------------------------------------------------------- 成群的動物（實例化）
export interface AItem {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sc: number;
  ph: number;
  roll: number;
  /** 走動中：頭不低下去 */
  walking?: boolean;
}
const _m1 = new Matrix4();
const _m2 = new Matrix4();
const _m3 = new Matrix4();
const _p = new Vector3();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();

export class AnimalCrowd {
  group = new Group();
  body: InstancedMesh;
  head: InstancedMesh;
  items: AItem[] = [];
  private neck: Vector3;
  private cow: boolean;
  constructor(kind: Species, mat: ShaderMaterial, n: number, px = 1.4) {
    const p = animalParts(kind);
    this.cow = kind === 'cow';
    this.neck = this.cow ? COW_NECK : LAMB_NECK;
    const b = solidInstanced(p.body, mat, n, px);
    const h = solidInstanced(p.head, mat, n, px);
    this.body = b.main;
    this.head = h.main;
    this.group.add(b.group, h.group);
    for (let i = 0; i < n; i++) this.items.push({ x: 0, y: -50, z: 0, yaw: 0, sc: 0.001, ph: i * 1.37, roll: 0 });
  }
  /** 依 items 重算矩陣。graze：0..1，吃草的整體權重 */
  update(t: number, motion: boolean, graze = 1): void {
    const m = motion ? 1 : 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      _q.setFromEuler(_e.set(0, it.yaw, it.roll));
      _m1.compose(_p.set(it.x, it.y, it.z), _q, _s.setScalar(it.sc));
      this.body.setMatrixAt(i, _m1);
      const per = 8 + (i % 7);
      let pitch = 0;
      if (this.cow) pitch = m * (0.1 * Math.sin(t * 0.9 + it.ph) + (it.walking ? 0 : 0.35 * grazeAmt(t, it.ph, per) * graze));
      else pitch = m * (it.walking ? 0.03 * Math.sin(t * 6 + it.ph) : 0.62 * grazeAmt(t, it.ph, per) * graze);
      _m2.makeTranslation(this.neck.x, this.neck.y, this.neck.z);
      _m3.makeRotationX(pitch);
      _m2.multiply(_m3);
      _m3.makeTranslation(-this.neck.x, -this.neck.y, -this.neck.z);
      _m2.multiply(_m3);
      _m1.multiply(_m2);
      this.head.setMatrixAt(i, _m1);
    }
    this.body.instanceMatrix.needsUpdate = true;
    this.head.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- 成群的人（實例化）
export interface PItem {
  x: number;
  y: number;
  z: number;
  yaw: number;
  sc: number;
  ph: number;
  /** 蹲下／起身：上下縮放（1＝站直） */
  sy?: number;
  /** 前傾 */
  lean?: number;
  visible?: boolean;
}

export class PersonCrowd {
  main: InstancedMesh;
  group: Group;
  items: PItem[] = [];
  constructor(geo: BufferGeometry, mat: ShaderMaterial, n: number, px = 1.6) {
    const r = solidInstanced(geo, mat, n, px);
    this.main = r.main;
    this.group = r.group;
    for (let i = 0; i < n; i++) this.items.push({ x: 0, y: -50, z: 0, yaw: 0, sc: 0.001, ph: i * 2.31 });
  }
  update(t: number, motion: boolean): void {
    const m = motion ? 1 : 0;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      const vis = it.visible !== false;
      const breath = m * 0.01 * Math.sin(t * 1.5708 + it.ph);
      const sy = (it.sy ?? 1) * (1 + breath);
      _q.setFromEuler(_e.set((it.lean ?? 0) + m * 0.013 * Math.sin(t * 0.83 + it.ph * 1.7), it.yaw, m * 0.026 * Math.sin(t * 0.61 + it.ph)));
      _m1.compose(_p.set(it.x, vis ? it.y : -50, it.z), _q, _s.set(it.sc, it.sc * sy, it.sc));
      this.main.setMatrixAt(i, _m1);
    }
    this.main.instanceMatrix.needsUpdate = true;
  }
}


// ---------------------------------------------------------------- 單獨的手臂（只露出一隻手：擦麵盆、舉餅）
const DOWN = new Vector3(0, -1, 0);
const _d = new Vector3();
export class ArmProp {
  group = new Group();
  private limb: Group;
  private hand: Group;
  constructor(mat: ShaderMaterial, handMat: ShaderMaterial) {
    this.limb = solidShared(limbGeo(), mat, 2.0);
    this.hand = solidShared(handGeo(), handMat, 1.6);
    this.hand.scale.setScalar(1.25);
    this.group.add(this.limb, this.hand);
  }
  set(shoulder: Vector3, hand: Vector3): void {
    _d.subVectors(hand, shoulder);
    const len = _d.length();
    this.group.position.copy(shoulder);
    this.group.quaternion.setFromUnitVectors(DOWN, _d.multiplyScalar(1 / Math.max(len, 1e-4)));
    this.limb.scale.set(1, len, 1);
    this.hand.position.set(0, -len, 0);
  }
}
