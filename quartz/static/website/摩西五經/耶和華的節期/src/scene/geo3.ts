// 第二批（秋季＋舊約回聲）新增的程序幾何：會幕、約櫃、香壇、住棚的枝葉、木臺、城牆……
// 全部低面數、合併成少數幾個 BufferGeometry。aPart 的編號依各函式的註解（著色器依此選色）。
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  LatheGeometry,
  PlaneGeometry,
  Quaternion,
  Matrix4,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeParts, T, type Part } from './geo';
import { mulberry32 } from './util';

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0, part?: number): Part => ({ g: new BoxGeometry(w, h, d), m: T(x, y, z), part });
const UP = new Vector3(0, 1, 0);

/** 一根從 a 到 b 的細圓柱 */
function rod(a: Vector3, b: Vector3, r0: number, r1: number, part: number, seg = 4): Part {
  const d = new Vector3().subVectors(b, a);
  const len = d.length();
  const g = new CylinderGeometry(r1, r0, len, seg, 1, true);
  g.translate(0, len / 2, 0);
  const q = new Quaternion().setFromUnitVectors(UP, d.normalize());
  return { g, m: new Matrix4().compose(a, q, new Vector3(1, 1, 1)), part };
}

// ---------------------------------------------------------------- 會幕院子
/** 院子的帷幕圍牆：四面，前面（+z）中間留門。h：牆高。回傳單一幾何（白色細麻布） */
export function fenceGeo(w: number, d: number, gap: number, h: number): BufferGeometry {
  const parts: Part[] = [];
  const t = 0.07;
  const post = (x: number, z: number) => parts.push(box(0.14, h + 0.28, 0.14, x, (h + 0.28) / 2, z));
  const seg = (x0: number, x1: number, z: number, alongX: boolean) => {
    const L = Math.abs(x1 - x0);
    const mid = (x0 + x1) / 2;
    // 布幔：略低於柱頂，下緣離地一點
    if (alongX) parts.push(box(L, h * 0.9, t, mid, h * 0.5 + 0.08, z));
    else parts.push(box(t, h * 0.9, L, z, h * 0.5 + 0.08, mid));
    // 柱距約 3 公尺
    const n = Math.max(1, Math.round(L / 3));
    for (let i = 0; i <= n; i++) {
      const k = x0 + (x1 - x0) * (i / n);
      if (alongX) post(k, z);
      else post(z, k);
    }
  };
  const hw = w / 2;
  const hd = d / 2;
  seg(-hw, hw, -hd, true); // 後
  seg(-hd, hd, -hw, false); // 左
  seg(-hd, hd, hw, false); // 右
  seg(-hw, -gap / 2, hd, true); // 前（左半）
  seg(gap / 2, hw, hd, true); // 前（右半）
  // 門的兩根高柱
  for (const sx of [-1, 1]) parts.push(box(0.16, h + 0.9, 0.16, sx * gap / 2, (h + 0.9) / 2, hd));
  return mergeParts(parts);
}

/** 會幕外殼：深色羊毛帳幕，朝 +z 開門。長 L（z 方向）、寬 W、高 H；回傳外殼與內襯分開的幾何 */
export function tabernacleGeo(W: number, L: number, H: number, doorW: number, doorH: number): { shell: BufferGeometry; roof: BufferGeometry } {
  const th = 0.16;
  const hw = W / 2;
  const sw = (W - doorW) / 2;
  const shell: Part[] = [
    box(th, H, L, -hw + th / 2, H / 2, 0), // 左壁
    box(th, H, L, hw - th / 2, H / 2, 0), // 右壁
    box(W, H, th, 0, H / 2, -L / 2 + th / 2), // 後壁
    box(sw, H, th, -hw + sw / 2, H / 2, L / 2 - th / 2), // 前壁左段
    box(sw, H, th, hw - sw / 2, H / 2, L / 2 - th / 2), // 前壁右段
    box(doorW, H - doorH, th, 0, doorH + (H - doorH) / 2, L / 2 - th / 2), // 門楣
  ];
  const roof: Part[] = [box(W + 0.5, 0.14, L + 0.5, 0, H + 0.07, 0)];
  return { shell: mergeParts(shell), roof: mergeParts(roof) };
}

/** 燈臺：基座、主幹、六枝（左右各三，U 形再垂直上去）、七個燈碗。part 0 金屬、1 燈碗（頂端小圓）。高約 1.45 */
export function lampstandGeo(): BufferGeometry {
  const parts: Part[] = [];
  const H = 1.4;
  parts.push({ g: new CylinderGeometry(0.2, 0.28, 0.1, 8), m: T(0, 0.05, 0), part: 0 });
  parts.push({ g: new CylinderGeometry(0.035, 0.05, H, 6), m: T(0, H / 2, 0), part: 0 });
  parts.push({ g: new SphereGeometry(0.085, 7, 5), m: T(0, 0.62, 0), part: 0 });
  parts.push({ g: new SphereGeometry(0.075, 7, 5), m: T(0, 0.95, 0), part: 0 });
  for (const sx of [-1, 1]) {
    for (let k = 1; k <= 3; k++) {
      const r = 0.1 + k * 0.1;
      const y = 0.45 + k * 0.17;
      const arc = new TorusGeometry(r, 0.022, 4, 10, Math.PI);
      parts.push({ g: arc, m: T(sx * r, y, 0, 0, 0, Math.PI), part: 0 });
      const x2 = sx * r * 2;
      parts.push(rod(new Vector3(x2, y, 0), new Vector3(x2, H - 0.05, 0), 0.022, 0.022, 0, 4));
      parts.push({ g: new SphereGeometry(0.052, 6, 4), m: T(x2, H, 0), part: 1 });
    }
  }
  parts.push({ g: new SphereGeometry(0.052, 6, 4), m: T(0, H + 0.02, 0), part: 1 });
  return mergeParts(parts, true);
}

/** 陳設餅的桌子：桌面、四腳、十二個薄餅（兩疊六個）。part 0 桌、1 餅 */
export function showbreadTableGeo(): BufferGeometry {
  const parts: Part[] = [
    box(0.9, 0.06, 0.5, 0, 0.75, 0, 0),
    box(0.06, 0.74, 0.06, 0.4, 0.37, 0.2, 0),
    box(0.06, 0.74, 0.06, -0.4, 0.37, 0.2, 0),
    box(0.06, 0.74, 0.06, 0.4, 0.37, -0.2, 0),
    box(0.06, 0.74, 0.06, -0.4, 0.37, -0.2, 0),
  ];
  for (let s = 0; s < 2; s++) for (let i = 0; i < 6; i++) parts.push({ g: new CylinderGeometry(0.16, 0.16, 0.026, 9), m: T(-0.2 + s * 0.4, 0.795 + i * 0.03, 0, 0, i * 0.4, 0), part: 1 });
  return mergeParts(parts, true);
}

/** 香壇（小）：方形壇身、四個角，金色。高 0.9 */
export function incenseAltarGeo(): BufferGeometry {
  const parts: Part[] = [box(0.46, 0.8, 0.46, 0, 0.4, 0, 0), box(0.56, 0.06, 0.56, 0, 0.83, 0, 0)];
  for (const [x, z] of [[0.24, 0.24], [-0.24, 0.24], [0.24, -0.24], [-0.24, -0.24]]) parts.push({ g: new ConeGeometry(0.035, 0.12, 4), m: T(x, 0.92, z), part: 0 });
  return mergeParts(parts, true);
}

/** 約櫃與施恩座：櫃身、蓋（施恩座）、兩根抬櫃的槓。朝 +z。part 0 櫃、1 蓋、2 槓。櫃長 1.1 寬 0.66 高 0.6 */
export function arkGeo(): BufferGeometry {
  const parts: Part[] = [
    box(1.1, 0.56, 0.66, 0, 0.28, 0, 0),
    box(1.16, 0.05, 0.72, 0, 0.585, 0, 1),
    box(1.06, 0.04, 0.62, 0, 0.62, 0, 1),
  ];
  for (const z of [0.4, -0.4]) parts.push({ g: new CylinderGeometry(0.025, 0.025, 1.9, 5), m: T(0, 0.34, z, 0, 0, Math.PI / 2), part: 2 });
  return mergeParts(parts, true);
}

/** 基路伯的翅膀大輪廓（平面，雙面）：從翼根向上、向外展開，下緣是一排羽毛的缺口。翼根在原點，朝 +x。高約 1.6、長約 1.1 */
export function wingGeo(): BufferGeometry {
  const sh = new Shape();
  sh.moveTo(0, 0);
  // 前緣（上緣）
  sh.bezierCurveTo(0.12, 0.7, 0.45, 1.4, 1.1, 1.62);
  // 翼尖往下，下緣 6 片羽毛的缺口
  const tip = new Vector2(1.1, 1.62);
  const base = new Vector2(0.08, 0.04);
  const n = 6;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const x = tip.x + (base.x - tip.x) * t - 0.02;
    const y = tip.y + (base.y - tip.y) * t - 0.34 * Math.sin(Math.PI * t) - 0.1 * t;
    const mx = tip.x + (base.x - tip.x) * (t - 0.5 / n) + 0.05;
    const my = tip.y + (base.y - tip.y) * (t - 0.5 / n) - 0.5 * Math.sin(Math.PI * (t - 0.5 / n)) - 0.1 * t - 0.12;
    sh.quadraticCurveTo(mx, my, x, y);
  }
  sh.lineTo(0, 0);
  return new ShapeGeometry(sh, 10);
}

/** 銅祭壇：方壇、四角的角、頂上的柴火格。part 0 壇、1 角與邊。1.5 × 0.9 × 1.5 */
export function altarGeo(): BufferGeometry {
  const parts: Part[] = [box(1.5, 0.84, 1.5, 0, 0.42, 0, 0), box(1.62, 0.1, 1.62, 0, 0.88, 0, 1), box(1.2, 0.06, 1.2, 0, 0.8, 0, 1)];
  for (const [x, z] of [[0.74, 0.74], [-0.74, 0.74], [0.74, -0.74], [-0.74, -0.74]]) parts.push({ g: new ConeGeometry(0.09, 0.3, 5), m: T(x, 1.08, z), part: 1 });
  // 前面的斜坡
  parts.push({ g: new BoxGeometry(0.8, 0.06, 1.9), m: T(0, 0.35, 1.9, -0.3), part: 1 });
  return mergeParts(parts, true);
}

/** 洗濯盆：腳座＋淺盆。part 0 銅、1 水（黑色的水面） */
export function laverGeo(): BufferGeometry {
  const pts = [new Vector2(0.001, 0), new Vector2(0.24, 0), new Vector2(0.14, 0.12), new Vector2(0.1, 0.7), new Vector2(0.3, 0.78), new Vector2(0.52, 0.9), new Vector2(0.55, 0.98), new Vector2(0.48, 0.98), new Vector2(0.001, 0.9)];
  const parts: Part[] = [{ g: new LatheGeometry(pts, 14), part: 0 }];
  const water = new CircleGeometry(0.47, 14);
  water.rotateX(-Math.PI / 2);
  parts.push({ g: water, m: T(0, 0.945, 0), part: 1 });
  return mergeParts(parts, true);
}

// ---------------------------------------------------------------- 村子與農作
/** 酒罈：圓肚、窄頸、尖底（立在地上的罈座） */
export function jarGeo(): BufferGeometry {
  const pts = [new Vector2(0.001, 0), new Vector2(0.12, 0.02), new Vector2(0.28, 0.2), new Vector2(0.34, 0.45), new Vector2(0.24, 0.72), new Vector2(0.13, 0.84), new Vector2(0.16, 0.92), new Vector2(0.001, 0.92)];
  return new LatheGeometry(pts, 10);
}
/** 蓋罈的布（圓盤） */
export function jarLidGeo(): BufferGeometry {
  return new CylinderGeometry(0.2, 0.2, 0.04, 9);
}

/** 穀堆：圓錐狀小丘，底寬 1、高 0.6（用 scale 調整） */
export function moundGeo(): BufferGeometry {
  const pts = [new Vector2(0.5, 0), new Vector2(0.5, 0.06), new Vector2(0.34, 0.28), new Vector2(0.16, 0.5), new Vector2(0.001, 0.62)];
  return new LatheGeometry(pts, 10);
}

/** 扛在肩上的穀袋 */
export function sackGeo(): BufferGeometry {
  return mergeParts([{ g: new SphereGeometry(1, 8, 6), m: T(0, 0.17, 0, 0, 0, 0, 0.17, 0.26, 0.15) }, { g: new SphereGeometry(1, 6, 4), m: T(0, 0.4, 0, 0, 0, 0, 0.07, 0.07, 0.07) }]);
}

/** 籃子：淺碗＋提把。part 0 籃身、1 提把 */
export function basketGeo(): BufferGeometry {
  const pts = [new Vector2(0.001, 0), new Vector2(0.11, 0), new Vector2(0.16, 0.05), new Vector2(0.19, 0.14), new Vector2(0.17, 0.14), new Vector2(0.001, 0.02)];
  const parts: Part[] = [{ g: new LatheGeometry(pts, 9), part: 0 }, { g: new TorusGeometry(0.17, 0.012, 4, 9, Math.PI), m: T(0, 0.13, 0, 0, 0, 0), part: 1 }];
  return mergeParts(parts, true);
}

/** 葡萄架：兩根立柱、橫線、枝葉與成串的葡萄。part 0 木、1 葉、2 葡萄。寬 2.4、高 1.5 */
export function vineGeo(seed = 1): BufferGeometry {
  const rnd = mulberry32(seed);
  const parts: Part[] = [
    { g: new CylinderGeometry(0.04, 0.05, 1.6, 5), m: T(-1.2, 0.8, 0), part: 0 },
    { g: new CylinderGeometry(0.04, 0.05, 1.6, 5), m: T(1.2, 0.8, 0), part: 0 },
    { g: new CylinderGeometry(0.012, 0.012, 2.4, 3), m: T(0, 1.45, 0, 0, 0, Math.PI / 2), part: 0 },
    { g: new CylinderGeometry(0.012, 0.012, 2.4, 3), m: T(0, 0.95, 0, 0, 0, Math.PI / 2), part: 0 },
    { g: new CylinderGeometry(0.03, 0.04, 0.4, 5), m: T(0, 0.2, 0), part: 0 },
  ];
  for (let i = 0; i < 14; i++) {
    const x = (rnd() - 0.5) * 2.2;
    const y = 0.9 + rnd() * 0.6;
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(x, y, (rnd() - 0.5) * 0.12, rnd() * 3, rnd() * 3, rnd() * 3, 0.17, 0.05, 0.14), part: 1 });
  }
  for (let i = 0; i < 6; i++) {
    const x = -0.9 + i * 0.36 + (rnd() - 0.5) * 0.15;
    const y = 0.88 - rnd() * 0.1;
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05;
      const rr = 0.045 * (1 - k / 8);
      parts.push({ g: new SphereGeometry(0.045, 5, 4), m: T(x + Math.cos(a) * rr, y - k * 0.04, Math.sin(a) * rr), part: 2 });
    }
  }
  return mergeParts(parts, true);
}

/** 果樹：樹幹、樹冠（幾團大球）、果子。part 0 幹、1 葉、2 果。高約 3 */
export function fruitTreeGeo(seed = 1, crown = 1.3): BufferGeometry {
  const rnd = mulberry32(seed);
  const parts: Part[] = [{ g: new CylinderGeometry(0.1, 0.18, 1.6, 6), m: T(0, 0.8, 0), part: 0 }, { g: new CylinderGeometry(0.05, 0.08, 0.8, 5), m: T(0.25, 1.9, 0.05, 0, 0, -0.5), part: 0 }];
  for (let i = 0; i < 6; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * crown * 0.55;
    parts.push({ g: new SphereGeometry(1, 8, 6), m: T(Math.cos(a) * r, 2.15 + rnd() * 0.5, Math.sin(a) * r, 0, 0, 0, crown * (0.5 + rnd() * 0.25), crown * 0.38, crown * (0.5 + rnd() * 0.25)), part: 1 });
  }
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2;
    const r = crown * (0.35 + rnd() * 0.45);
    parts.push({ g: new SphereGeometry(0.075, 5, 4), m: T(Math.cos(a) * r, 1.95 + rnd() * 0.5, Math.sin(a) * r), part: 2 });
  }
  return mergeParts(parts, true);
}

// ---------------------------------------------------------------- 四種植物的枝子（利23:40）
/** 結圓形果子的樹枝：part 0 枝、1 葉、2 果。長約 1.4，沿 +y 往上 */
export function fruitBranchGeo(): BufferGeometry {
  const rnd = mulberry32(5);
  const parts: Part[] = [];
  const top = new Vector3(0.1, 1.4, 0);
  parts.push(rod(new Vector3(0, 0, 0), top, 0.028, 0.012, 0, 5));
  for (let i = 0; i < 5; i++) {
    const t = 0.32 + i * 0.13;
    const sx = i % 2 ? 1 : -1;
    const bx = top.x * t;
    const by = top.y * t;
    const tip = new Vector3(bx + sx * (0.2 + rnd() * 0.08), by + 0.2, (rnd() - 0.5) * 0.1);
    parts.push(rod(new Vector3(bx, by, 0), tip, 0.012, 0.006, 0, 4));
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(tip.x + sx * 0.05, tip.y + 0.03, tip.z, 0, 0, sx * 0.7, 0.1, 0.035, 0.05), part: 1 });
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(bx + sx * 0.06, by + 0.04, 0.02, 0, 0, sx * 0.9, 0.085, 0.03, 0.045), part: 1 });
    // 果子垂在枝下
    parts.push({ g: new SphereGeometry(0.065, 7, 5), m: T(bx + sx * 0.12, by - 0.08, 0.03), part: 2 });
  }
  parts.push({ g: new SphereGeometry(1, 5, 4), m: T(top.x, top.y + 0.04, 0, 0, 0, 0, 0.06, 0.1, 0.04), part: 1 });
  return mergeParts(parts, true);
}

/** 棕樹枝：一根彎的中脈，兩側垂下的細長小葉。part 0 脈、1 小葉。長約 1.9 */
export function palmFrondBranchGeo(): BufferGeometry {
  const parts: Part[] = [];
  const pts: Vector3[] = [];
  const n = 8;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push(new Vector3(0.28 * Math.sin(t * 2.0) * t, t * 1.9, 0));
  }
  for (let i = 0; i < n; i++) parts.push(rod(pts[i], pts[i + 1], 0.024 * (1 - i / n) + 0.006, 0.02 * (1 - (i + 1) / n) + 0.005, 0, 4));
  for (let i = 1; i <= n; i++) {
    const p = pts[i];
    const len = 0.5 * Math.sin(Math.PI * Math.min(1, i / (n + 0.5))) + 0.08;
    for (const sz of [1, -1]) {
      parts.push({ g: new SphereGeometry(1, 4, 3), m: T(p.x, p.y - len * 0.28, sz * len * 0.5, sz * 0.9, 0, 0, 0.014, 0.012, len * 0.5), part: 1 });
    }
  }
  return mergeParts(parts, true);
}

/** 茂密樹的枝條：粗枝上叢生的橢圓葉子。part 0 枝、1 葉。長約 1.3 */
export function leafyBranchGeo(): BufferGeometry {
  const rnd = mulberry32(9);
  const parts: Part[] = [];
  const top = new Vector3(-0.05, 1.3, 0);
  parts.push(rod(new Vector3(0, 0, 0), top, 0.03, 0.012, 0, 5));
  for (let i = 0; i < 22; i++) {
    const t = 0.18 + rnd() * 0.82;
    const a = rnd() * Math.PI * 2;
    const r = 0.04 + t * 0.18;
    parts.push({ g: new SphereGeometry(1, 5, 4), m: T(top.x * t + Math.cos(a) * r, top.y * t + (rnd() - 0.3) * 0.06, Math.sin(a) * r, rnd() * 2, a, rnd() * 2, 0.13, 0.025, 0.06), part: 1 });
  }
  return mergeParts(parts, true);
}

/** 河旁的柳枝：長長下垂的細枝與窄葉。part 0 枝、1 葉。長約 1.8 */
export function willowBranchGeo(): BufferGeometry {
  const rnd = mulberry32(13);
  const parts: Part[] = [];
  const top = new Vector3(0, 1.6, 0);
  parts.push(rod(new Vector3(0, 0, 0), top, 0.025, 0.014, 0, 5));
  for (let k = 0; k < 7; k++) {
    const t = 0.55 + k * 0.07;
    const sx = k % 2 ? 1 : -1;
    const o = new Vector3(top.x * t + sx * 0.02, top.y * t, (rnd() - 0.5) * 0.12);
    const e = new Vector3(o.x + sx * (0.2 + rnd() * 0.12), o.y - 0.7 - rnd() * 0.5, o.z + (rnd() - 0.5) * 0.12);
    parts.push(rod(o, e, 0.008, 0.004, 0, 3));
    for (let i = 1; i <= 7; i++) {
      const u = i / 8;
      const px = o.x + (e.x - o.x) * u;
      const py = o.y + (e.y - o.y) * u;
      const pz = o.z + (e.z - o.z) * u;
      for (const sz of [-1, 1]) parts.push({ g: new SphereGeometry(1, 4, 3), m: T(px + sz * 0.03, py, pz, 0, 0, sz * 0.5, 0.012, 0.075, 0.022), part: 1 });
    }
  }
  return mergeParts(parts, true);
}

/** 一片樹葉（搭棚用）：扁橢圓，aS 給風吹搖（尖端大） */
export function boothLeafGeo(): BufferGeometry {
  const g = new SphereGeometry(1, 5, 4);
  g.scale(0.22, 0.03, 0.1);
  const pos = g.attributes.position;
  const aS = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) aS[i] = Math.min(1, Math.max(0, (pos.getX(i) / 0.22 + 1) / 2));
  g.setAttribute('aS', new BufferAttribute(aS, 1));
  return g;
}
/** 搭棚用的樹幹（立柱）：單位長 1 的細圓柱，原點在底部 */
export function boothPostGeo(): BufferGeometry {
  const g = new CylinderGeometry(0.035, 0.05, 1, 5);
  g.translate(0, 0.5, 0);
  return g;
}
/** 橫枝：單位長 1，沿 x 軸，原點在中心 */
export function boothBeamGeo(): BufferGeometry {
  const g = new CylinderGeometry(0.026, 0.03, 1, 4);
  g.rotateZ(Math.PI / 2);
  return g;
}

// ---------------------------------------------------------------- 回聲拍的建物
/** 木臺（尼8:4）：四根（再加兩根中柱）高柱撐起的平臺、欄杆、一道斜階。臺面高 H，寬 W、深 D。part 0 木、1 臺面 */
export function platformGeo(W: number, D: number, H: number): BufferGeometry {
  const parts: Part[] = [];
  for (const sx of [-1, 0, 1]) for (const sz of [-1, 1]) parts.push({ g: new CylinderGeometry(0.1, 0.12, H, 6), m: T(sx * (W / 2 - 0.12), H / 2, sz * (D / 2 - 0.12)), part: 0 });
  parts.push(box(W, 0.14, D, 0, H, 0, 1));
  // 橫撐
  for (const sz of [-1, 1]) parts.push(box(W, 0.08, 0.08, 0, H * 0.45, sz * (D / 2 - 0.12), 0));
  // 欄杆（後與左右）
  const rail = 0.8;
  parts.push(box(W, 0.06, 0.06, 0, H + rail, -D / 2 + 0.06, 0));
  parts.push(box(0.06, 0.06, D, -W / 2 + 0.06, H + rail, 0, 0));
  parts.push(box(0.06, 0.06, D, W / 2 - 0.06, H + rail, 0, 0));
  for (let i = 0; i <= 6; i++) {
    const x = -W / 2 + 0.06 + (W - 0.12) * (i / 6);
    parts.push(box(0.05, rail, 0.05, x, H + rail / 2, -D / 2 + 0.06, 0));
  }
  for (const sx of [-1, 1]) for (let i = 0; i <= 2; i++) parts.push(box(0.05, rail, 0.05, sx * (W / 2 - 0.06), H + rail / 2, -D / 2 + 0.06 + (D - 0.12) * (i / 2), 0));
  // 斜階（朝 +z）
  parts.push({ g: new BoxGeometry(1.1, 0.1, Math.hypot(2.6, H)), m: T(W * 0.18, H / 2, D / 2 + 1.3, Math.atan2(H, 2.6) * -1, 0, 0), part: 0 });
  return mergeParts(parts, true);
}

/** 書卷：兩根軸與一張紙。紙沿 x 展開（scale.x 0..1），原點在左軸。part 0 紙、1 軸。完全展開寬 1.0、高 0.5 */
export function scrollGeo(): BufferGeometry {
  const parts: Part[] = [
    { g: new PlaneGeometry(1, 0.5), m: T(0.5, 0, 0), part: 0 },
    { g: new CylinderGeometry(0.03, 0.03, 0.6, 6), m: T(0, 0, 0), part: 1 },
  ];
  return mergeParts(parts, true);
}
export function scrollRodGeo(): BufferGeometry {
  return new CylinderGeometry(0.03, 0.03, 0.6, 6);
}

/** 城牆：一段牆（寬 w、高 h、厚 t），牆頭有垛口。回傳 box 零件清單用的幾何 */
export function wallSegGeo(w: number, h: number, t: number): BufferGeometry {
  const parts: Part[] = [box(w, h, t, 0, h / 2, 0)];
  const n = Math.max(2, Math.round(w / 1.4));
  for (let i = 0; i < n; i++) {
    if (i % 2) continue;
    parts.push(box(w / n * 0.85, 0.5, t + 0.1, -w / 2 + w / n * (i + 0.5), h + 0.25, 0));
  }
  return mergeParts(parts);
}
/** 城門：兩座門樓＋門洞上的拱楣。門洞寬 gw、高 gh。朝 +z */
export function gateTowerGeo(gw: number, gh: number, h: number): BufferGeometry {
  const tw = 3.2;
  const parts: Part[] = [
    box(tw, h, 3.4, -(gw / 2 + tw / 2), h / 2, 0),
    box(tw, h, 3.4, gw / 2 + tw / 2, h / 2, 0),
    box(gw + 0.4, h - gh, 3.0, 0, gh + (h - gh) / 2, 0),
  ];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) parts.push(box(0.7, 0.5, 3.6, sx * (gw / 2 + 0.55 + i * 1.1), h + 0.25, 0));
  for (let i = 0; i < 4; i++) parts.push(box(0.7, 0.5, 3.2, -gw / 2 + 0.4 + i * 1.0, h + 0.25, 0));
  // 拱：門洞上緣用一個半圓柱倒出圓角
  parts.push({ g: new CylinderGeometry(gw / 2, gw / 2, 3.0, 10, 1, false, 0, Math.PI), m: T(0, gh, 0, Math.PI / 2, Math.PI / 2, 0) });
  return mergeParts(parts);
}

/** 聖殿主體：台基三級、殿身、前廊的柱子。朝 +z。part 0 牆、1 柱與台基 */
export function templeGeo(): BufferGeometry {
  const parts: Part[] = [];
  parts.push(box(26, 0.6, 15, 0, 0.3, 0, 1));
  parts.push(box(23, 0.6, 13, 0, 0.9, 0, 1));
  parts.push(box(20, 0.6, 11, 0, 1.5, 0, 1));
  parts.push(box(14, 9, 8.5, 0, 6.3, -0.8, 0));
  parts.push(box(15, 0.7, 9.5, 0, 11.1, -0.8, 1));
  // 前廊
  parts.push(box(16, 0.5, 3.2, 0, 10.0, 5.6, 1));
  for (let i = 0; i < 6; i++) parts.push({ g: new CylinderGeometry(0.34, 0.4, 7.6, 7), m: T(-6.5 + i * 2.6, 5.8, 5.6), part: 1 });
  return mergeParts(parts, true);
}

/** 一段圍牆（聖殿院子）：矮牆＋柱廊的頂 */
export function courtWallGeo(len: number, h: number): BufferGeometry {
  const parts: Part[] = [box(len, h, 0.6, 0, h / 2, 0), box(len + 0.5, 0.3, 1.1, 0, h + 0.15, 0)];
  const n = Math.round(len / 4);
  for (let i = 0; i <= n; i++) parts.push(box(0.5, h + 0.3, 0.9, -len / 2 + (len * i) / n, (h + 0.3) / 2, 0));
  return mergeParts(parts);
}

/** 嗎哪：一小片薄的白色圓片（平放） */
export function mannaGeo(): BufferGeometry {
  const g = new CircleGeometry(1, 6);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** 小丘上的圓石／頭顱形的小石堆 */
export function pebbleGeo(): BufferGeometry {
  return new SphereGeometry(1, 6, 4);
}

/** 約櫃之前的幔子：高 H、寬 W 的布，下半部分段以便每幀改頂點做擺動 */
export function veilGeo(W: number, H: number): PlaneGeometry {
  const g = new PlaneGeometry(W, H, 10, 12);
  g.translate(0, H / 2, 0);
  return g;
}

/** 荒地上的乾灌木：幾根交叉的枯枝 */
export function scrubGeo(): BufferGeometry {
  const rnd = mulberry32(21);
  const parts: Part[] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const tip = new Vector3(Math.cos(a) * 0.32, 0.3 + rnd() * 0.22, Math.sin(a) * 0.32);
    parts.push(rod(new Vector3(0, 0, 0), tip, 0.014, 0.004, 0, 3));
  }
  return mergeParts(parts, true);
}

/** 大祭司的冠冕（利16:4）：簡單的白色細麻布纏頭，圓筒形、頂略收。原點在頭頂中心（y 往上） */
export function mitreGeo(): BufferGeometry {
  const g = mergeParts([
    { g: new CylinderGeometry(0.11, 0.135, 0.15, 10), m: T(0, 0.3, -0.005) },
    { g: new SphereGeometry(0.11, 9, 5, 0, Math.PI * 2, 0, Math.PI * 0.5), m: T(0, 0.375, -0.005) },
    { g: new TorusGeometry(0.135, 0.022, 4, 12), m: T(0, 0.235, -0.005, Math.PI / 2, 0, 0) },
  ]);
  return g;
}
