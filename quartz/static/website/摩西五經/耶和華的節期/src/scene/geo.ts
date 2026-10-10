// 程序生成的低面數幾何：人物剪影、羊、棕櫚、房屋、牛膝草、麥穗……全部合併成少數幾個 BufferGeometry。
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  Matrix4,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mulberry32 } from './util';

const _e = new Euler();
const _q = new Quaternion();
const _p = new Vector3();
const _s = new Vector3();

/** 建一個 TRS 矩陣（只在建構階段用） */
export function T(px: number, py: number, pz: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx, order: 'XYZ' | 'ZYX' | 'YXZ' = 'XYZ'): Matrix4 {
  _e.set(rx, ry, rz, order);
  _q.setFromEuler(_e);
  return new Matrix4().compose(_p.set(px, py, pz), _q, _s.set(sx, sy, sz));
}

export interface Part {
  g: BufferGeometry;
  m?: Matrix4;
  part?: number;
}

/** 把多個部件合併成單一非索引幾何；withPart 時加上 aPart（每個部件一個編號，著色器依此選色） */
export function mergeParts(parts: Part[], withPart = false): BufferGeometry {
  const list = parts.map((pt) => {
    const g = pt.g.index ? pt.g.toNonIndexed() : pt.g.clone();
    if (pt.m) g.applyMatrix4(pt.m);
    if (g.attributes.uv) g.deleteAttribute('uv');
    if (withPart) {
      const n = g.attributes.position.count;
      g.setAttribute('aPart', new BufferAttribute(new Float32Array(n).fill(pt.part ?? 0), 1));
    }
    return g;
  });
  const out = mergeGeometries(list, false);
  if (!out) throw new Error('mergeParts failed');
  return out;
}

/** 倒殼輪廓用：全平滑法線，讓盒子的稜角不會裂開 */
export function hullGeo(g: BufferGeometry): BufferGeometry {
  return toCreasedNormals(g.clone(), Math.PI);
}

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0): Part => ({ g: new BoxGeometry(w, h, d), m: T(x, y, z) });

// ---------------------------------------------------------------- 人物（剪影）
export interface PersonOpts {
  /** 左手（+x 側）[前擺, 外展]，弧度 */
  armL?: [number, number];
  armR?: [number, number];
  staff?: boolean;
  staffSide?: 'L' | 'R';
  bundle?: boolean;
  /** 上半身繞腰前傾 */
  bow?: number;
  belt?: boolean;
  /** 頭巾 */
  wrap?: boolean;
  /** 整體高度縮放 */
  scale?: number;
  /** 窄長袍（袍擺不外擴，像一般站立的人） */
  slim?: boolean;
  /** 低面數（隊伍、遠景用） */
  low?: boolean;
  /** 更低：只有袍與頭 */
  tiny?: boolean;
  /** 坐姿：袍擺收成一堆，膝向前 */
  sit?: boolean;
  /** 不畫手臂與杖（手臂由程式另外裝，例如舉禾捆的祭司） */
  noArms?: boolean;
  /** 長頭巾（披到肩上） */
  veil?: boolean;
}

/** part：0 長袍、1 頭與手（剪影墨色）、2 頭巾、3 杖、4 腰帶、5 包袱布 */
export function personGeo(o: PersonOpts = {}): BufferGeometry {
  const parts: Part[] = [];
  const low = !!o.low;
  const seg = low ? 7 : 12;
  const skirtPts = o.slim
    ? [new Vector2(0.235, 0), new Vector2(0.255, 0.02), new Vector2(0.245, 0.32), new Vector2(0.225, 0.7), new Vector2(0.2, 0.96)]
    : [new Vector2(0.31, 0), new Vector2(0.37, 0.02), new Vector2(0.345, 0.32), new Vector2(0.285, 0.7), new Vector2(0.225, 0.96)];
  const hipY = o.sit ? 0.5 : 0.95;
  if (o.sit) {
    parts.push({ g: new LatheGeometry(skirtPts, seg), m: T(0, 0, 0, 0, 0, 0, 1.2, 0.52, 0.98), part: 0 });
    parts.push({ g: new SphereGeometry(0.17, low ? 6 : 9, low ? 4 : 6), m: T(0, 0.15, 0.2, 0, 0, 0, 1.5, 0.85, 1.25), part: 0 });
  } else {
    parts.push({ g: new LatheGeometry(skirtPts, seg), m: T(0, 0, 0, 0, 0, 0, 1, 1, 0.78), part: 0 });
  }

  const bow = o.bow ?? 0;
  const hip = T(0, hipY, 0, bow, 0, 0);
  const up = (m: Matrix4) => hip.clone().multiply(m);

  const torsoPts = [new Vector2(0.225, 0), new Vector2(0.245, 0.18), new Vector2(0.27, 0.36), new Vector2(0.22, 0.45), new Vector2(0.09, 0.49), new Vector2(0.001, 0.5)];
  parts.push({ g: new LatheGeometry(torsoPts, seg), m: up(T(0, 0, 0, 0, 0, 0, 1, 1, 0.74)), part: 0 });
  parts.push({ g: new SphereGeometry(0.115, low ? 7 : 10, low ? 5 : 8), m: up(T(0, 0.63, 0.025)), part: 1 });
  if (o.tiny) {
    const g = mergeParts(parts, true);
    const sc = o.scale ?? 1;
    if (sc !== 1) g.scale(sc, sc, sc);
    return g;
  }
  if (o.wrap !== false) {
    parts.push({ g: new SphereGeometry(0.14, low ? 7 : 10, low ? 3 : 6, 0, Math.PI * 2, 0, Math.PI * 0.58), m: up(T(0, 0.655, -0.005)), part: 2 });
    parts.push({ g: new BoxGeometry(0.2, 0.2, 0.05), m: up(T(0, 0.55, -0.1, 0.25)), part: 2 });
    if (o.veil) {
      parts.push({ g: new SphereGeometry(0.155, low ? 7 : 10, low ? 4 : 7, 0, Math.PI * 2, 0, Math.PI * 0.72), m: up(T(0, 0.65, -0.015)), part: 2 });
      parts.push({ g: new BoxGeometry(0.34, 0.46, 0.07), m: up(T(0, 0.38, -0.12, 0.12)), part: 2 });
    }
  }
  if (o.belt) parts.push({ g: new TorusGeometry(0.235, 0.022, low ? 3 : 5, low ? 8 : 14), m: up(T(0, 0.03, 0, Math.PI / 2, 0, 0, 1, 0.74, 1)), part: 4 });

  const armG = new CylinderGeometry(0.068, 0.05, 0.62, low ? 5 : 8);
  armG.translate(0, -0.31, 0);
  const handG = new SphereGeometry(0.052, low ? 5 : 7, low ? 4 : 6);
  const addArm = (side: 1 | -1, swing: number, splay: number): Vector3 => {
    const m = up(T(side * 0.235, 0.43, 0, -swing, 0, side * splay, 1, 1, 1, 'ZYX'));
    parts.push({ g: armG, m, part: 0 });
    parts.push({ g: handG, m: m.clone().multiply(T(0, -0.64, 0)), part: 1 });
    return new Vector3(0, -0.64, 0).applyMatrix4(m);
  };
  const aL = o.armL ?? [0.05, 0.12];
  const aR = o.armR ?? [0.05, 0.12];
  const handL = o.noArms ? new Vector3() : addArm(1, aL[0], aL[1]);
  const handR = o.noArms ? new Vector3() : addArm(-1, aR[0], aR[1]);

  if (o.staff && !o.noArms) {
    const h = o.staffSide === 'R' ? handR : handL;
    parts.push({ g: new CylinderGeometry(0.02, 0.025, 1.85, low ? 4 : 6), m: T(h.x, 0.9, h.z), part: 3 });
  }
  if (o.bundle) {
    parts.push({ g: new BoxGeometry(0.46, 0.2, 0.32), m: up(T(0.14, 0.62, -0.06, 0.15, 0.3, -0.25)), part: 5 });
    if (!low) parts.push({ g: new TorusGeometry(0.14, 0.02, 4, 8), m: up(T(0.14, 0.62, -0.06, 0.15, 0.3, -0.25)), part: 4 });
  }
  const g = mergeParts(parts, true);
  const sc = o.scale ?? 1;
  if (sc !== 1) g.scale(sc, sc, sc);
  return g;
}
/** 人物手的位置（人物本地座標，未縮放）：拿東西的道具用 */
export function personHand(o: PersonOpts, side: 'L' | 'R'): Vector3 {
  const hip = T(0, o.sit ? 0.5 : 0.95, 0, o.bow ?? 0, 0, 0);
  const a = (side === 'L' ? o.armL : o.armR) ?? [0.05, 0.12];
  const sd = side === 'L' ? 1 : -1;
  const m = hip.clone().multiply(T(sd * 0.235, 0.43, 0, -a[0], 0, sd * a[1], 1, 1, 1, 'ZYX'));
  return new Vector3(0, -0.64, 0).applyMatrix4(m).multiplyScalar(o.scale ?? 1);
}

// ---------------------------------------------------------------- 羊與牛
/** 朝 +z。part：0 羊毛／身體、1 頭與腿。piece：整隻、只有身體（含腿）、只有頭（含耳與角） */
export type Piece = 'all' | 'body' | 'head';
export const LAMB_NECK = new Vector3(0, 0.6, 0.42);
export const COW_NECK = new Vector3(0, 1.1, 0.55);
export function lambGeo(low = false, kind: 'lamb' | 'ram' | 'goat' = 'lamb', piece: Piece = 'all'): BufferGeometry {
  const body: Part[] = [];
  const head: Part[] = [];
  const S = (r: number) => new SphereGeometry(r, low ? 6 : 9, low ? 4 : 7);
  if (kind === 'ram') {
    // 公綿羊：頭兩側盤角
    for (const sx of [1, -1]) head.push({ g: new TorusGeometry(0.085, 0.024, 4, 9, Math.PI * 1.45), m: T(sx * 0.1, 0.72, 0.5, 0, sx * 1.35, sx * 0.25), part: 1 });
  } else if (kind === 'goat') {
    // 公山羊：向後的短角與下巴的鬚
    for (const sx of [1, -1]) head.push({ g: new ConeGeometry(0.03, 0.26, 4), m: T(sx * 0.07, 0.8, 0.46, -0.9, 0, sx * 0.25), part: 1 });
    head.push({ g: new ConeGeometry(0.03, 0.15, 4), m: T(0, 0.52, 0.7, 3.4), part: 1 });
  }
  body.push({ g: S(1), m: T(0, 0.52, 0, 0, 0, 0, 0.3, 0.33, 0.54), part: 0 });
  for (let i = 0; i < 6; i++) {
    const z = -0.38 + i * 0.15;
    body.push({ g: S(0.17), m: T(i % 2 ? 0.1 : -0.1, 0.62, z), part: 0 });
  }
  body.push({ g: S(0.075), m: T(0, 0.55, -0.56), part: 0 });
  for (const [x, z] of [[0.12, 0.3], [-0.12, 0.3], [0.12, -0.3], [-0.12, -0.3]]) {
    body.push({ g: new CylinderGeometry(0.035, 0.028, 0.36, 5), m: T(x, 0.18, z), part: 1 });
  }
  head.push({ g: S(0.13), m: T(0, 0.66, 0.56, 0, 0, 0, 1, 1, 1.15), part: 1 });
  head.push({ g: S(0.055), m: T(0, 0.6, 0.69), part: 1 });
  head.push({ g: S(0.07), m: T(0.13, 0.74, 0.5, 0, 0, 0.6, 1.5, 0.45, 0.6), part: 1 });
  head.push({ g: S(0.07), m: T(-0.13, 0.74, 0.5, 0, 0, -0.6, 1.5, 0.45, 0.6), part: 1 });
  const list = piece === 'all' ? [...body, ...head] : piece === 'body' ? body : head;
  return mergeParts(list, true);
}

export function cattleGeo(low = false, piece: Piece = 'all'): BufferGeometry {
  const body: Part[] = [];
  const head: Part[] = [];
  const S = (r: number) => new SphereGeometry(r, low ? 6 : 9, low ? 4 : 7);
  body.push({ g: S(1), m: T(0, 1.02, 0, 0, 0, 0, 0.42, 0.5, 1.0), part: 0 });
  head.push({ g: S(0.3), m: T(0, 1.12, 0.85, 0, 0, 0, 0.9, 0.95, 1.2), part: 1 });
  for (const [x, z] of [[0.2, 0.55], [-0.2, 0.55], [0.2, -0.55], [-0.2, -0.55]]) {
    body.push({ g: new CylinderGeometry(0.07, 0.055, 0.85, 5), m: T(x, 0.42, z), part: 1 });
  }
  head.push({ g: new ConeGeometry(0.045, 0.28, 5), m: T(0.17, 1.4, 0.82, 0, 0, -0.9), part: 1 });
  head.push({ g: new ConeGeometry(0.045, 0.28, 5), m: T(-0.17, 1.4, 0.82, 0, 0, 0.9), part: 1 });
  body.push({ g: new CylinderGeometry(0.03, 0.02, 0.6, 4), m: T(0, 1.0, -1.0, 0.4), part: 1 });
  const list = piece === 'all' ? [...body, ...head] : piece === 'body' ? body : head;
  return mergeParts(list, true);
}

// ---------------------------------------------------------------- 椰棗樹
export function palmTrunkGeo(h = 7, lean = 0.9): BufferGeometry {
  const g = new CylinderGeometry(0.15, 0.27, h, 7, 6, true);
  g.translate(0, h / 2, 0);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = y / h;
    pos.setX(i, pos.getX(i) + lean * t * t);
  }
  g.computeVertexNormals();
  return g;
}

export function palmFrondsGeo(h = 7, lean = 0.9, seed = 3): BufferGeometry {
  const rnd = mulberry32(seed);
  const pos: number[] = [];
  const sw: number[] = [];
  const idx: number[] = [];
  const n = 11;
  const seg = 6;
  for (let k = 0; k < n; k++) {
    const th = (k / n) * Math.PI * 2 + rnd() * 0.3;
    const L = 2.6 + rnd() * 1.2;
    const droop = 1.6 + rnd() * 1.2;
    const dx = Math.cos(th);
    const dz = Math.sin(th);
    const base = pos.length / 3;
    for (let i = 0; i <= seg; i++) {
      const s = i / seg;
      const cx = lean + dx * s * L;
      const cy = h + 0.35 * Math.sin(s * 2.2) * (1 - s) - droop * s * s;
      const cz = dz * s * L;
      const w = 0.5 * Math.sin(Math.PI * Math.pow(s, 0.65)) + 0.02;
      const px = -dz * w;
      const pz = dx * w;
      pos.push(cx + px, cy, cz + pz, cx - px, cy, cz - pz);
      sw.push(s, s);
    }
    for (let i = 0; i < seg; i++) {
      const a = base + i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aS', new BufferAttribute(new Float32Array(sw), 1));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// ---------------------------------------------------------------- 房屋
export interface HouseOpts {
  w: number;
  h: number;
  d: number;
  /** 門中心的 x；undefined 表示無門 */
  doorX?: number;
  doorW?: number;
  doorH?: number;
  /** 門洞深度（門板後的發光背板在此深度） */
  tunnel?: number;
  roofHut?: boolean;
}

/** 房屋主體（泥磚）：前牆開門洞，後面是實心；z 從 0（前牆）往 -d。 */
export function houseBodyGeo(o: HouseOpts): BufferGeometry {
  const parts: Part[] = [];
  const { w, h, d } = o;
  const td = o.tunnel ?? 1.2;
  if (o.doorX === undefined) {
    parts.push(box(w, h, d, 0, h / 2, -d / 2));
  } else {
    const dw = o.doorW ?? 1.5;
    const dh = o.doorH ?? 2.3;
    const x0 = o.doorX - dw / 2;
    const x1 = o.doorX + dw / 2;
    parts.push(box(x0 + w / 2, h, td, (x0 - w / 2) / 2, h / 2, -td / 2));
    parts.push(box(w / 2 - x1, h, td, (x1 + w / 2) / 2, h / 2, -td / 2));
    parts.push(box(dw, h - dh, td, o.doorX, dh + (h - dh) / 2, -td / 2));
    parts.push(box(w, h, d - td, 0, h / 2, -td - (d - td) / 2));
  }
  parts.push(box(w + 0.3, 0.22, d + 0.3, 0, h + 0.1, -d / 2));
  if (o.roofHut) parts.push(box(1.6, 0.9, 1.4, w * 0.25, h + 0.65, -d * 0.6));
  return mergeParts(parts);
}

/** 門框：兩根門柱＋門楣，凸出牆面 */
export function doorFrameGeo(dw = 1.5, dh = 2.3, t = 0.3, depth = 0.26): BufferGeometry {
  const parts: Part[] = [
    box(t, dh + t, depth, -(dw / 2 + t / 2), (dh + t) / 2, depth / 2 - 0.03),
    box(t, dh + t, depth, dw / 2 + t / 2, (dh + t) / 2, depth / 2 - 0.03),
    box(dw + 2 * t, t, depth, 0, dh + t / 2, depth / 2 - 0.03),
  ];
  return mergeParts(parts);
}

/** 門板：樞軸在 x=0，板向 +x 延伸 */
export function doorLeafGeo(w = 1.36, h = 2.2): BufferGeometry {
  const g = new BoxGeometry(w, h, 0.08);
  g.translate(w / 2, h / 2, 0);
  return g;
}

// ---------------------------------------------------------------- 器物
export function basinGeo(): { bowl: BufferGeometry; blood: BufferGeometry } {
  const pts = [
    new Vector2(0.001, 0),
    new Vector2(0.17, 0),
    new Vector2(0.3, 0.1),
    new Vector2(0.37, 0.24),
    new Vector2(0.4, 0.3),
    new Vector2(0.35, 0.3),
    new Vector2(0.31, 0.22),
    new Vector2(0.001, 0.07),
  ];
  const bowl = new LatheGeometry(pts, 14);
  const blood = new CircleGeometry(0.335, 16);
  blood.rotateX(-Math.PI / 2);
  blood.translate(0, 0.235, 0);
  return { bowl, blood };
}

export const HYSSOP_LEN = 1.15;

/** 牛膝草束與持握的前臂（分兩個幾何，前臂只在被拿起時顯示）。原點在草尖，往 -y 延伸。
 * 草束 part：0 莖、1 葉（蘸血變紅）、2 綁繩；前臂 part：0 袖、1 手 */
export function hyssopGeo(): { bundle: BufferGeometry; arm: BufferGeometry } {
  const rnd = mulberry32(11);
  const parts: Part[] = [];
  const n = 9;
  const Lh = HYSSOP_LEN;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd() * 0.5;
    const r = 0.02 + rnd() * 0.075;
    const topX = Math.cos(a) * r;
    const topZ = Math.sin(a) * r;
    // 莖：底（0,-Lh,0）→ 頂（topX, 0, topZ）
    const len = Math.hypot(topX, Lh, topZ);
    const g = new CylinderGeometry(0.006, 0.009, len, 4);
    g.translate(0, len / 2, 0);
    const dir = new Vector3(topX, Lh, topZ).normalize();
    const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), dir);
    const m = new Matrix4().compose(new Vector3(0, -Lh, 0), q, new Vector3(1, 1, 1));
    parts.push({ g, m, part: 0 });
    for (let k = 0; k < 8; k++) {
      const f = 0.42 + k * 0.07 + rnd() * 0.03;
      const lx = topX * f * 1.0;
      const lz = topZ * f * 1.0;
      const ly = -Lh + Lh * f;
      parts.push({ g: new SphereGeometry(1, 5, 4), m: T(lx, ly, lz, rnd() * 3, rnd() * 3, rnd() * 3, 0.022, 0.055, 0.012), part: 1 });
    }
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(topX, 0.01, topZ, 0, 0, 0, 0.02, 0.05, 0.012), part: 1 });
  }
  parts.push({ g: new TorusGeometry(0.04, 0.012, 4, 8), m: T(0, -Lh + 0.18, 0, Math.PI / 2), part: 2 });
  const sleeve = new CylinderGeometry(0.075, 0.24, 7, 8);
  sleeve.translate(0, -Lh - 0.1 - 3.5, 0);
  const arm = mergeParts(
    [
      { g: sleeve, part: 0 },
      { g: new SphereGeometry(0.078, 8, 6), m: T(0, -Lh - 0.0, 0, 0, 0, 0, 1, 1.3, 1), part: 1 },
    ],
    true,
  );
  return { bundle: mergeParts(parts, true), arm };
}

// ---------------------------------------------------------------- 麥穗
/** 單株麥：莖（高度正規化為 1）＋穗。part：0 莖、1 穗 */
export function barleyGeo(o: { earW?: number; earTop?: number; leafLen?: number; stem?: number } = {}): BufferGeometry {
  const stem = o.stem ?? 1;
  const earW = o.earW ?? 0.034;
  const earTop = o.earTop ?? 1.18;
  const leafLen = o.leafLen ?? 1;
  const pos: number[] = [];
  const nor: number[] = [];
  const part: number[] = [];
  const tri = (a: number[], b: number[], c: number[], p: number) => {
    pos.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) nor.push(0, 0, 1);
    part.push(p, p, p);
  };
  const widths = [0.02 * stem, 0.014 * stem, 0.006 * stem];
  const ys = [0, 0.5, 0.9];
  for (let i = 0; i < 2; i++) {
    const y0 = ys[i];
    const y1 = ys[i + 1];
    const w0 = widths[i];
    const w1 = widths[i + 1];
    tri([-w0, y0, 0], [w0, y0, 0], [-w1, y1, 0], 0);
    tri([w0, y0, 0], [w1, y1, 0], [-w1, y1, 0], 0);
  }
  // 穗：兩片交叉的菱形（穗長約莖高的 1/4）
  const ear = (rot: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    const a = [0, 0.84, 0];
    const b = [-earW * c, 0.97, -earW * s];
    const d = [earW * c, 0.97, earW * s];
    const e = [0, earTop, 0];
    tri(a, d, b, 1);
    tri(b, d, e, 1);
  };
  ear(0);
  ear(Math.PI / 2);
  // 兩片葉：從莖下段斜斜長出
  const leaf = (rot: number, len: number) => {
    const c = Math.cos(rot);
    const s = Math.sin(rot);
    tri([0.016 * s, 0.1, -0.016 * c], [-0.016 * s, 0.1, 0.016 * c], [len * c, 0.1 + len * 1.6, len * s], 0);
  };
  leaf(0.7, 0.2 * leafLen);
  leaf(3.9, 0.17 * leafLen);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('normal', new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute('aPart', new BufferAttribute(new Float32Array(part), 1));
  return g;
}

// ---------------------------------------------------------------- 小件
export function torchGeo(): BufferGeometry {
  const parts: Part[] = [
    { g: new CylinderGeometry(0.05, 0.07, 1.6, 5), m: T(0, 0.8, 0) },
    { g: new CylinderGeometry(0.16, 0.08, 0.3, 6), m: T(0, 1.7, 0) },
  ];
  return mergeParts(parts);
}

export function flameGeo(): BufferGeometry {
  const g = new ConeGeometry(0.2, 0.62, 6);
  g.translate(0, 0.31, 0);
  return g;
}

export function quadGeo(w: number, h: number): PlaneGeometry {
  return new PlaneGeometry(w, h);
}

export function bedGeo(): BufferGeometry {
  const parts: Part[] = [
    box(1.9, 0.12, 0.9, 0, 0.55, 0),
    box(0.1, 0.55, 0.1, 0.9, 0.275, 0.4),
    box(0.1, 0.55, 0.1, -0.9, 0.275, 0.4),
    box(0.1, 0.55, 0.1, 0.9, 0.275, -0.4),
    box(0.1, 0.55, 0.1, -0.9, 0.275, -0.4),
    { g: new SphereGeometry(1, 8, 6), m: T(0.15, 0.78, 0, 0, 0, 0, 0.8, 0.14, 0.34), part: 1 },
  ];
  return mergeParts(parts);
}

export function tableGeo(): BufferGeometry {
  return mergeParts([
    box(1.6, 0.08, 0.8, 0, 0.62, 0),
    box(0.08, 0.6, 0.08, 0.7, 0.3, 0.32),
    box(0.08, 0.6, 0.08, -0.7, 0.3, 0.32),
    box(0.08, 0.6, 0.08, 0.7, 0.3, -0.32),
    box(0.08, 0.6, 0.08, -0.7, 0.3, -0.32),
  ]);
}

export function breadGeo(): BufferGeometry {
  const g = new CylinderGeometry(0.17, 0.17, 0.025, 14);
  return g;
}

export function dishGeo(): BufferGeometry {
  const pts = [new Vector2(0.001, 0), new Vector2(0.16, 0), new Vector2(0.22, 0.05), new Vector2(0.2, 0.05), new Vector2(0.15, 0.025), new Vector2(0.001, 0.02)];
  return new LatheGeometry(pts, 12);
}










