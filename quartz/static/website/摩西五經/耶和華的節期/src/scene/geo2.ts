// 第二階段（春季）新增的程序幾何：帳棚、禾捆、鐮刀、布、石頭、餅、田地起伏……
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CylinderGeometry,
  LatheGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  Quaternion,
  Matrix4,
} from 'three';
import { mergeParts, T, type Part } from './geo';
import { mulberry32 } from './util';

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0): Part => ({ g: new BoxGeometry(w, h, d), m: T(x, y, z) });

/** 黑山羊毛帳棚：人字形，前面有一小塊門洞。朝 +z。part：0 帳幕、1 門洞 */
export function tentGeo(): BufferGeometry {
  const W = 3.0;
  const L = 3.6;
  const H = 2.1;
  const hw = W / 2;
  const hl = L / 2;
  const pos: number[] = [];
  const part: number[] = [];
  const tri = (a: number[], b: number[], c: number[], p: number) => {
    pos.push(...a, ...b, ...c);
    part.push(p, p, p);
  };
  const A = [-hw, 0, -hl];
  const B = [-hw, 0, hl];
  const C = [0, H, hl];
  const D = [0, H, -hl];
  const E = [hw, 0, -hl];
  const F = [hw, 0, hl];
  tri(A, B, C, 0);
  tri(A, C, D, 0);
  tri(F, E, D, 0);
  tri(F, D, C, 0);
  tri(B, F, C, 0);
  tri(E, A, D, 0);
  const z = hl + 0.02;
  tri([-0.42, 0, z], [0.42, 0, z], [0, 1.15, z], 1);
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('aPart', new BufferAttribute(new Float32Array(part), 1));
  g.computeVertexNormals();
  return g;
}

/** 帶一點起伏的石頭（單位大小，用 scale 壓扁） */
export function rockGeo(seed = 1): BufferGeometry {
  const g = new SphereGeometry(1, 7, 5);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const h = mulberry32(Math.floor((x + 3) * 977 + (y + 3) * 131 + (z + 3) * 31 + seed * 7919))();
    const k = 0.8 + h * 0.4;
    pos.setXYZ(i, x * k, y * k, z * k);
  }
  g.computeVertexNormals();
  return g;
}

/** 麥田地面：以高度函數起伏的格網（頂面朝上） */
export function fieldGeo(sx: number, sz: number, seg: number, hf: (x: number, z: number) => number, cx = 0, cz = 0): BufferGeometry {
  const g = new PlaneGeometry(sx, sz, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(cx, 0, cz);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, hf(pos.getX(i), pos.getZ(i)));
  g.computeVertexNormals();
  return g;
}

/** 皺皺的布（包過麵盆的布）：平放在地上 */
export function clothGeo(w = 1.1, d = 0.85): BufferGeometry {
  const g = new PlaneGeometry(w, d, 10, 8);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
    const y = 0.035 * Math.sin(x * 11 + z * 5) * Math.cos(z * 9 - x * 3) + 0.03 * edge * edge * Math.sin(x * 7 + 1) + 0.012;
    pos.setY(i, Math.max(0.004, y));
  }
  g.computeVertexNormals();
  return g;
}

/** 鐮刀：原點在握把末端，刀往 +x 方向彎。part：0 刀、1 握把 */
export function sickleGeo(): BufferGeometry {
  const parts: Part[] = [];
  parts.push({ g: new CylinderGeometry(0.017, 0.02, 0.3, 5), m: T(0, 0.15, 0), part: 1 });
  const blade = new TorusGeometry(0.2, 0.011, 3, 14, Math.PI * 0.72);
  parts.push({ g: blade, m: T(0.0, 0.3 + 0.0, 0, 0, 0, -Math.PI * 0.5 - 0.15, 1, 1, 0.45), part: 0 });
  return mergeParts(parts, true);
}

/**
 * 禾捆：直立，腰間一道繩，下端切口、上端穗頭散開。原點在底部中心，高約 0.95。
 * part：0 莖、1 穗、2 繩
 */
export function sheafGeo(seed = 3, n = 34, thick = 1): BufferGeometry {
  const rnd = mulberry32(seed);
  const parts: Part[] = [];
  const bindY = 0.34;
  const up = new Vector3(0, 1, 0);
  const seg = (a: Vector3, b: Vector3, r0: number, r1: number, p: number) => {
    const d = new Vector3().subVectors(b, a);
    const len = d.length();
    const cg = new CylinderGeometry(r1, r0, len, 3, 1, true);
    cg.translate(0, len / 2, 0);
    const q = new Quaternion().setFromUnitVectors(up, d.normalize());
    parts.push({ g: cg, m: new Matrix4().compose(a, q, new Vector3(1, 1, 1)), part: p });
  };
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const f = 0.35 + rnd() * 0.65;
    const bot = new Vector3(Math.cos(a) * 0.1 * f, 0, Math.sin(a) * 0.1 * f);
    const mid = new Vector3(Math.cos(a) * 0.045 * f, bindY, Math.sin(a) * 0.045 * f);
    const topY = 0.84 + rnd() * 0.1;
    const top = new Vector3(Math.cos(a) * 0.16 * f, topY, Math.sin(a) * 0.16 * f);
    seg(bot, mid, 0.014 * thick, 0.012 * thick, 0);
    seg(mid, top, 0.012 * thick, 0.009 * thick, 0);
    const dir = new Vector3().subVectors(top, mid).normalize();
    const q = new Quaternion().setFromUnitVectors(up, dir);
    const eg = new SphereGeometry(1, 4, 3);
    parts.push({ g: eg, m: new Matrix4().compose(top.clone().addScaledVector(dir, 0.03), q, new Vector3(0.03 * Math.sqrt(thick), 0.11, 0.03 * Math.sqrt(thick))), part: 1 });
  }
  parts.push({ g: new TorusGeometry(0.058, 0.014, 4, 9), m: T(0, bindY, 0, Math.PI / 2, 0, 0, 1.05, 1.05, 1.5), part: 2 });
  return mergeParts(parts, true);
}

/** 發起來的餅：長圓形，有三道劃口。part：0 餅身、1 劃口 */
export function loafGeo(): BufferGeometry {
  const parts: Part[] = [];
  parts.push({ g: new SphereGeometry(1, 14, 9), m: T(0, 0.0, 0, 0, 0, 0, 0.36, 0.15, 0.2), part: 0 });
  for (let i = -1; i <= 1; i++) {
    parts.push({ g: new SphereGeometry(1, 6, 4), m: T(i * 0.1, 0.132, 0, 0, 0.0, 0, 0.012, 0.03, 0.15), part: 1 });
  }
  return mergeParts(parts, true);
}

/** 一疊薄餅（無酵餅）：幾片錯開的薄圓盤 */
export function flatBreadGeo(n = 1, r = 0.19): BufferGeometry {
  const parts: Part[] = [];
  for (let i = 0; i < n; i++) {
    const c = new CylinderGeometry(r * (1 - i * 0.04), r * (1 - i * 0.04), 0.022, 14);
    parts.push({ g: c, m: T(i * 0.018, 0.011 + i * 0.024, i * -0.01, 0, i * 0.5, 0) });
  }
  return mergeParts(parts);
}

/** 空的烘烤盤：淺盤，邊緣微微翻起 */
export function griddleGeo(): BufferGeometry {
  const pts = [new Vector2(0.001, 0), new Vector2(0.34, 0), new Vector2(0.37, 0.025), new Vector2(0.365, 0.055), new Vector2(0.335, 0.05), new Vector2(0.31, 0.03), new Vector2(0.001, 0.025)];
  return new LatheGeometry(pts, 18);
}

export function stoolGeo(): BufferGeometry {
  return mergeParts([
    box(0.46, 0.05, 0.34, 0, 0.4, 0),
    box(0.05, 0.38, 0.05, 0.19, 0.19, 0.12),
    box(0.05, 0.38, 0.05, -0.19, 0.19, 0.12),
    box(0.05, 0.38, 0.05, 0.19, 0.19, -0.12),
    box(0.05, 0.38, 0.05, -0.19, 0.19, -0.12),
  ]);
}

/** 牆上的架板：一塊板兩個托 */
export function shelfGeo(w = 1.9): BufferGeometry {
  return mergeParts([
    box(w, 0.07, 0.36, 0, 0, 0),
    box(0.07, 0.3, 0.07, -w * 0.38, -0.17, -0.12),
    box(0.07, 0.3, 0.07, w * 0.38, -0.17, -0.12),
  ]);
}

/** 單根肢體：原點在上端，往 -y 方向延伸 1（程式用 scale.y 調長度） */
export function limbGeo(): BufferGeometry {
  const g = new CylinderGeometry(0.066, 0.05, 1, 7);
  g.translate(0, -0.5, 0);
  return g;
}

/** 手（小球） */
export function handGeo(): BufferGeometry {
  return new SphereGeometry(0.055, 7, 5);
}

/** 營火：石圈與交疊的柴 */
export function fireBaseGeo(): BufferGeometry {
  const parts: Part[] = [];
  const rnd = mulberry32(8);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + rnd() * 0.3;
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(Math.cos(a) * 0.36, 0.06, Math.sin(a) * 0.36, rnd(), rnd(), rnd(), 0.1 + rnd() * 0.04, 0.07, 0.1), part: 0 });
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    parts.push({ g: new CylinderGeometry(0.035, 0.04, 0.55, 5), m: T(Math.cos(a) * 0.1, 0.1, Math.sin(a) * 0.1, Math.PI / 2 - 0.35, a, 0, 1, 1, 1, 'YXZ'), part: 1 });
  }
  return mergeParts(parts, true);
}

/** 火焰：兩片交叉的豎面（底邊在 y=0，高 1，寬 0.55） */
export function flamePlanesGeo(): BufferGeometry {
  const a = new PlaneGeometry(0.55, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const g = mergeParts([{ g: a }, { g: b }]);
  // mergeParts 會刪掉 uv；火焰要用 uv
  const pos = g.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    uv[i * 2] = (Math.abs(x) > Math.abs(z) ? x : z) / 0.55 + 0.5;
    uv[i * 2 + 1] = pos.getY(i);
  }
  g.setAttribute('uv', new BufferAttribute(uv, 2));
  return g;
}
