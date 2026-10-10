// 場景層共用的小工具：數學、關鍵影格取樣、亂數。全部不在每幀配置新物件。
import { Vector3 } from 'three';

export const clamp = (x: number, a = 0, b = 1): number => (x < a ? a : x > b ? b : x);
/** 把進度 p 的 [a,b] 一段攤成 0..1：回聲拍與有抹除轉場的拍，頭尾各有一段被抹除蓋住，動作排在中間 */
export const win = (p: number, a = 0.1, b = 0.76): number => clamp((p - a) / (b - a));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
export const smoother = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
/** 0→1→0 的小山丘，a..b 上升、b..c 下降 */
export const bump = (a: number, b: number, c: number, x: number): number => smooth(a, b, x) * (1 - smooth(b, c, x));

/** 把 #rrggbb 轉成 0..1 的 sRGB 分量（不做色彩空間轉換，著色器直接輸出） */
export function hexTo(hex: string, out: Vector3): Vector3 {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return out.set(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 關鍵影格：s 是全域時間軸（cue 序號 + beatProgress），v 是同長度的數值陣列，
 * e = 1 表示「這一格到下一格」用 smoothstep，0 表示線性。
 */
export interface Key {
  s: number;
  v: number[];
  e?: 0 | 1;
}

export function sampleKeys(keys: Key[], s: number, out: number[]): void {
  const n = keys.length;
  if (s <= keys[0].s) {
    const v = keys[0].v;
    for (let i = 0; i < v.length; i++) out[i] = v[i];
    return;
  }
  if (s >= keys[n - 1].s) {
    const v = keys[n - 1].v;
    for (let i = 0; i < v.length; i++) out[i] = v[i];
    return;
  }
  let k = 0;
  while (k < n - 2 && s > keys[k + 1].s) k++;
  const a = keys[k];
  const b = keys[k + 1];
  let t = (s - a.s) / (b.s - a.s);
  if (a.e === 1) t = t * t * (3 - 2 * t);
  for (let i = 0; i < a.v.length; i++) out[i] = a.v[i] + (b.v[i] - a.v[i]) * t;
}
