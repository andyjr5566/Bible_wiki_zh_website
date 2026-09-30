import BASEMAP from './data/basemap.json';
import { SITES } from './data/sites';
import type { Level, PosMode } from './data/sites';

/**
 * 地圖投影與每一站在圖上的位置。
 * 等距圓柱投影，經度乘 cos(30°)（西乃一帶的緯度）。座標單位是 SVG 使用者單位。
 * 所有位置都是示意：經文沒給座標，見 data/sites.ts。
 */
export const BBOX = BASEMAP.bbox;
const K = Math.cos((30 * Math.PI) / 180);
/** 每一緯度多少單位 */
export const S = 165;
export const W = Math.round((BBOX.e - BBOX.w) * K * S);
export const H = Math.round((BBOX.n - BBOX.s) * S);

export type XY = [number, number];
export const project = (lon: number, lat: number): XY => [(lon - BBOX.w) * K * S, (BBOX.n - lat) * S];

export interface Pos {
  n: number;
  /** 圖上的位置（zone 的站：中間值附近，擠在一起時被輕輕撥開） */
  x: number;
  y: number;
  /** 站名擺在標記的哪一側（標記自己的座標，未縮放） */
  lx: number;
  ly: number;
  anchor: 'start' | 'middle' | 'end';
  /** 沒有畫在候選地點上（依路線補位，或和別站同一點而散開） */
  mode: PosMode;
  level: Level;
  /** span：另一端 */
  x2?: number;
  y2?: number;
  /** zone：中間值的位置與淡圈的半徑（地圖單位） */
  zx?: number;
  zy?: number;
  zr?: number;
}

/** 同一個座標的站，畫在圖上會疊在一起：以這個半徑（度）散成一圈 */
const FAN_DEG = 0.075;

/** 每公里對應多少地圖單位（緯度方向；經度已乘 cos30，所以各方向一致） */
export const UNITS_PER_KM = S / 111;

/**
 * 三十八年飄流那一段的站，候選常常同一個座標、或彼此只差幾公里，畫上去會疊成一堆。
 * 從各自的中間值出發，兩兩靠得太近就互相推開、離開太遠就輕輕拉回；次數固定、順序固定，結果每次一樣。
 */
export const ZONE_MIN_GAP = 24;
function relaxZones(out: Pos[]) {
  const movers = out.filter((p) => p.mode === 'zone');
  const others = out.filter((p) => p.mode !== 'zone' && p.mode !== 'route');
  const home = new Map(movers.map((p) => [p, { x: p.x, y: p.y }]));
  for (let iter = 0; iter < 120; iter++) {
    for (let i = 0; i < movers.length; i++) {
      const a = movers[i];
      const push = (b: Pos, share: number, salt: number) => {
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d = Math.hypot(dx, dy);
        if (d >= ZONE_MIN_GAP) return;
        if (d < 0.01) { const ang = (salt * 2.399963) % (Math.PI * 2); dx = Math.cos(ang); dy = Math.sin(ang); d = 1; } // 完全重疊：依站號往不同方向
        const move = ((ZONE_MIN_GAP - d) * share) / d;
        a.x += dx * move;
        a.y += dy * move;
      };
      for (let j = 0; j < movers.length; j++) if (j !== i) push(movers[j], 0.5, i * 31 + j + 1);
      for (const o of others) push(o, 1, i + 7);
      const h = home.get(a)!;
      a.x += (h.x - a.x) * 0.03;
      a.y += (h.y - a.y) * 0.03;
    }
  }
}

export function resolvePositions(): Pos[] {
  const out: Pos[] = SITES.map((s) => {
    const [x, y] = Number.isNaN(s.lon) ? [NaN, NaN] : project(s.lon, s.lat);
    const p: Pos = { n: s.n, x, y, lx: 11, ly: 4, anchor: 'start', mode: s.mode, level: s.level };
    if (s.lon2 !== undefined && s.lat2 !== undefined) {
      const [x2, y2] = project(s.lon2, s.lat2);
      p.x2 = x2;
      p.y2 = y2;
    }
    return p;
  });

  // span：站點畫在兩端的中點
  for (const p of out) if (p.mode === 'span') { p.x = (p.x + (p.x2 ?? p.x)) / 2; p.y = (p.y + (p.y2 ?? p.y)) / 2; }

  // zone：記下中間值與淡圈半徑（此時 x、y 就是中間值）
  out.forEach((p, i) => {
    if (p.mode !== 'zone') return;
    p.zx = p.x;
    p.zy = p.y;
    p.zr = SITES[i].zone!.rKm * UNITS_PER_KM;
  });

  // 沒有座標的站：前後兩個有座標的站之間平均分配
  for (let i = 0; i < out.length; i++) {
    if (!Number.isNaN(out[i].x)) continue;
    let a = i - 1;
    let b = i + 1;
    while (a >= 0 && Number.isNaN(out[a].x)) a--;
    while (b < out.length && Number.isNaN(out[b].x)) b++;
    const t = (i - a) / (b - a);
    out[i].x = out[a].x + (out[b].x - out[a].x) * t;
    out[i].y = out[a].y + (out[b].y - out[a].y) * t;
  }

  // 同一點的站散成一圈
  const groups = new Map<string, number[]>();
  out.forEach((p, i) => {
    if (p.mode === 'span' || p.mode === 'route' || p.mode === 'zone') return;
    const k = `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
    groups.set(k, [...(groups.get(k) ?? []), i]);
  });
  const r = FAN_DEG * K * S;
  for (const idx of groups.values()) {
    if (idx.length < 2) continue;
    idx.forEach((i, j) => {
      const a = (j / idx.length) * Math.PI * 2 - Math.PI / 2;
      out[i].x += Math.cos(a) * r;
      out[i].y += Math.sin(a) * r;
    });
  }
  relaxZones(out);
  return out;
}

/** 底圖的陸地輪廓（開場小圖用）；每個多邊形一條 path 的 d */
export function landPaths(): string[] {
  const ring = (r: number[][]) => `M${r.map(([lon, lat]) => project(lon, lat).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;
  return BASEMAP.land.map((poly) => poly.map(ring).join(''));
}

export const POSITIONS = resolvePositions();
export const pos = (n: number): Pos => POSITIONS[n - 1];

/** 三十八年那一段各站與它們的外框（鏡頭要看整片時用） */
export const ZONE_STATIONS = POSITIONS.filter((p) => p.mode === 'zone').map((p) => p.n);

/** 兩點連成的路線，長度是各段之和（走動的人依它計算位置） */
export function routeLengths(points: XY[]): number[] {
  const acc = [0];
  for (let i = 1; i < points.length; i++) acc.push(acc[i - 1] + Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]));
  return acc;
}

/** progress 是「第幾站」的小數（1–42）；回傳路線上的位置與前進方向（弧度） */
export function pointAt(progress: number): { x: number; y: number; angle: number } {
  const p = Math.max(1, Math.min(POSITIONS.length, progress));
  const i = Math.min(POSITIONS.length - 1, Math.floor(p));
  const t = p - i;
  const a = POSITIONS[i - 1];
  const b = POSITIONS[i];
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** 第 i 站到第 i+1 站的直線距離（地圖單位） */
const LEGS = POSITIONS.slice(1).map((b, i) => Math.hypot(b.x - POSITIONS[i].x, b.y - POSITIONS[i].y));
export const legLength = (i: number): number => LEGS[Math.max(1, Math.min(41, i)) - 1];
const CUM = LEGS.reduce<number[]>((acc, l) => [...acc, acc[acc.length - 1] + l], [0]);

/** 沿路線從第 1 站走到 p 的距離 */
export function distAt(p: number): number {
  const q = Math.max(1, Math.min(42, p));
  const i = Math.min(41, Math.floor(q));
  return CUM[i - 1] + LEGS[i - 1] * (q - i);
}

/** 從第 1 站走到 p 的軌跡（SVG path 的 d）：經過的站都連起來，最後一段到 p 的位置為止 */
export function trailD(p: number): string {
  const q = Math.max(1, Math.min(42, p));
  const i = Math.floor(q);
  let d = `M${POSITIONS[0].x.toFixed(1)} ${POSITIONS[0].y.toFixed(1)}`;
  for (let k = 2; k <= i; k++) d += `L${POSITIONS[k - 1].x.toFixed(1)} ${POSITIONS[k - 1].y.toFixed(1)}`;
  const pt = pointAt(q);
  return `${d}L${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
}

/** 一組站的外框（地圖聚焦用），含邊界留白 */
export function boundsOf(ns: number[], pad = 40): { x: number; y: number; w: number; h: number } {
  const xs = ns.map((n) => pos(n).x);
  const ys = ns.map((n) => pos(n).y);
  const x0 = Math.min(...xs) - pad;
  const y0 = Math.min(...ys) - pad;
  return { x: x0, y: y0, w: Math.max(...xs) + pad - x0, h: Math.max(...ys) + pad - y0 };
}
