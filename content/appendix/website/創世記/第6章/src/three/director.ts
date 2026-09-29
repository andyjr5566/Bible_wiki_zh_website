import type { SceneId } from '../data/types';
import { ARARAT, FLOOD_TOP, PEAK } from './terrain';
import { lerp, smooth } from './util';

/**
 * 每一幕的畫面狀態。數值型的欄位在兩幕之間線性插值；anchor／life 這類離散欄位
 * 取權重較大的一邊。鏡頭 anchor：
 *   world 絕對座標｜ark 以方舟位置為原點（不跟著轉）｜local 方舟本地座標（跟著搖晃）
 */
export type V3 = [number, number, number];
export interface Look {
  cam: V3; look: V3; anchor: 'world' | 'ark' | 'local'; fov: number;
  sunEl: number; sunAz: number; storm: number; cloud: number; rain: number; bolts: number; fog: number;
  water: number; waves: number;
  build: number; pitch: number; door: number; shutter: number; cover: number; cut: number; ramp: number; lamps: number;
  arkX: number; arkZ: number; arkYaw: number;
  life: 'procession' | 'pens' | 'exit' | 'none'; spawn: number;
  family: number; familyMode: 'board' | 'altar' | 'none'; flock: number; birds: number;
  altar: number; bow: number; mud: number; green: number; wet: number;
  exposure: number; warm: number; sat: number; vignette: number; shake: number; dims: number; fade: number;
}

export const BASE: Look = {
  cam: [-90, 30, -120], look: [0, 6, 0], anchor: 'world', fov: 45,
  sunEl: 24, sunAz: 200, storm: 0, cloud: 0.35, rain: 0, bolts: 0, fog: 1,
  water: -50, waves: 0.2,
  build: 5, pitch: 1, door: 0, shutter: 0, cover: 0, cut: 0, ramp: 1, lamps: 0,
  arkX: 0, arkZ: 0, arkYaw: 0,
  life: 'none', spawn: 0,
  family: 0, familyMode: 'none', flock: 0, birds: 0,
  altar: 0, bow: 0, mud: 0, green: 0, wet: 0,
  exposure: 1, warm: 0, sat: 1, vignette: 0.35, shake: 0, dims: 0, fade: 0,
};

const A = ARARAT;
const LAND = { x: A.x, z: A.z };
/** 洪水中方舟漂流的路線（各幕的起訖點） */
const DRIFT: Record<string, [number, number]> = {
  lift0: [0, 0], lift1: [-160, -240], mt0: [-330, -520], mt1: [PEAK.x + 110, PEAK.z + 150],
  in0: [PEAK.x + 60, PEAK.z - 60], in1: [-1000, -1560], rem0: [-1080, -1700], rem1: [LAND.x + 60, LAND.z + 90],
};

type Part = Partial<Look>;
interface Beat { from: Part; to?: Part }

const STORM: Part = { storm: 1, rain: 1, bolts: 1, cloud: 0.9, fog: 2.6, wet: 1, exposure: 0.9, warm: -0.4, sat: 0.75, vignette: 0.5, shake: 1 };
const FLOAT: Part = { ...STORM, ramp: 0, door: 1, pitch: 1, build: 5.5 };

export const HERO: Beat = {
  from: { cam: [118, 9, -122], look: [26, 9, 4], sunEl: 7, sunAz: 215, cloud: 0.5, storm: 0.2, fog: 1.2, warm: 0.55, life: 'procession', spawn: 1, flock: 1, fov: 40, exposure: 1.05 },
  to: { cam: [104, 8, -108], look: [24, 9, 4] },
};

export const BEATS: Record<SceneId, Beat> = {
  corrupt: {
    from: { cam: [230, 60, -330], look: [-120, 10, 240], build: 0, ramp: 0, sunEl: 3, sunAz: 300, storm: 0.3, cloud: 0.62, fog: 0.9, warm: 0.5, sat: 0.85, vignette: 0.55, fov: 50 },
    to: { cam: [200, 48, -290], look: [-140, 12, 260] },
  },
  command: {
    from: { cam: [-112, 44, -132], look: [26, 2, 16], build: 0.02, pitch: 0, ramp: 0, sunEl: 22, sunAz: 150, cloud: 0.32 },
    to: { cam: [-84, 30, -104], look: [24, 3, 14], build: 1.45 },
  },
  size: {
    from: { cam: [62, 74, -232], look: [22, 4, 0], build: 1.45, pitch: 0, ramp: 0, sunEl: 30, sunAz: 165, dims: 1, fov: 40 },
    to: { cam: [24, 56, -196], look: [20, 4, 0], build: 2.35 },
  },
  decks: {
    from: { cam: [-46, 10, -46], look: [8, 5.5, 4], build: 2.35, pitch: 0, ramp: 0, cut: 1, sunEl: 40, sunAz: 185, lamps: 0.7, fov: 50 },
    to: { cam: [-14, 8.5, -36], look: [14, 5.5, 4], build: 4.1 },
  },
  pitch: {
    from: { cam: [-62, 7, -62], look: [-24, 5, -11], build: 4.1, pitch: 0, ramp: 0, sunEl: 26, sunAz: 215, warm: 0.2 },
    to: { cam: [-48, 6, -48], look: [-20, 5.5, -11], build: 4.65, pitch: 1 },
  },
  animals: {
    from: { cam: [74, 11, -90], look: [22, 3, -28], sunEl: 13, sunAz: 215, warm: 0.45, life: 'procession', spawn: 1, flock: 1, cloud: 0.45, storm: 0.1 },
    to: { cam: [52, 8, -68], look: [20, 3, -26] },
  },
  family: {
    from: { cam: [38, 5.5, -52], look: [18, 2.6, -20], sunEl: 8, sunAz: 225, warm: 0.4, life: 'procession', spawn: 0, familyMode: 'board', family: 0, storm: 0.3, cloud: 0.7, fog: 1.3 },
    to: { cam: [28, 4.5, -42], look: [16, 2.8, -17], family: 1 },
  },
  door: {
    from: { cam: [34, 6, -44], look: [11, 3.4, -11.4], door: 0, storm: 0.4, cloud: 0.85, sunEl: 8, sunAz: 225, fog: 1.4, warm: -0.05, sat: 0.9, vignette: 0.5, exposure: 1.15, life: 'none', fov: 38 },
    to: { cam: [27, 5, -36], look: [11, 3.4, -11.4], door: 1 },
  },
  deep: {
    from: { ...STORM, cam: [-112, 22, -140], look: [22, 5, 8], door: 1, ramp: 0, water: -3, waves: 0.35, sunEl: 10 },
    to: { cam: [-84, 15, -106], look: [20, 5, 8], water: 9 },
  },
  lifted: {
    from: { ...FLOAT, anchor: 'ark', cam: [-70, 16, -62], look: [14, 6, 6], water: 9, waves: 0.75, arkX: DRIFT.lift0[0], arkZ: DRIFT.lift0[1], sunEl: 10 },
    to: { cam: [-50, 13, -50], look: [14, 7, 6], water: 70, waves: 1, arkX: DRIFT.lift1[0], arkZ: DRIFT.lift1[1], arkYaw: 0.25 },
  },
  mountains: {
    from: { ...FLOAT, anchor: 'ark', cam: [120, 70, 150], look: [-160, 0, -260], water: 150, waves: 1, arkX: DRIFT.mt0[0], arkZ: DRIFT.mt0[1], arkYaw: 0.25, fov: 55, sunEl: 10, fog: 1.1 },
    to: { cam: [100, 55, 120], look: [-150, 0, -240], water: FLOOD_TOP, arkX: DRIFT.mt1[0], arkZ: DRIFT.mt1[1], arkYaw: 0.5 },
  },
  inside: {
    from: { ...FLOAT, anchor: 'local', cam: [-46, 3.5, 3.4], look: [0, 3.2, -1.2], lamps: 1, life: 'pens', water: FLOOD_TOP, waves: 1, arkX: DRIFT.in0[0], arkZ: DRIFT.in0[1], arkYaw: 0.5, fov: 60, exposure: 1.1, shake: 0.4, warm: 0.3 },
    to: { cam: [-30, 3.5, 2.2], look: [12, 3.2, -1], arkX: DRIFT.in1[0], arkZ: DRIFT.in1[1], arkYaw: 0.6 },
  },
  remember: {
    from: { ...FLOAT, anchor: 'ark', cam: [-110, 34, 140], look: [-14, 8, 0], water: FLOOD_TOP, waves: 1, arkX: DRIFT.rem0[0], arkZ: DRIFT.rem0[1], arkYaw: 0.6, sunEl: 16, sunAz: 330 },
    to: { cam: [-150, 46, 190], look: [-18, 10, 0], storm: 0.15, rain: 0, bolts: 0, cloud: 0.55, fog: 1.2, waves: 0.3, wet: 0.5, exposure: 1.05, warm: 0.2, sat: 0.95, vignette: 0.4, shake: 0, arkX: DRIFT.rem1[0], arkZ: DRIFT.rem1[1], arkYaw: 0.25 },
  },
  ararat: {
    from: { anchor: 'world', cam: [A.x + 190, A.h + 38, A.z + 250], look: [A.x, A.h + 4, A.z], ramp: 0, door: 1, storm: 0.1, cloud: 0.5, fog: 1.6, water: FLOOD_TOP - 1, waves: 0.28, wet: 0.4, arkX: LAND.x + 60, arkZ: LAND.z + 90, arkYaw: 0.25, sunEl: 16, sunAz: 115, mud: 1 },
    to: { cam: [A.x + 150, A.h + 28, A.z + 190], look: [A.x, A.h + 5, A.z], water: A.h - 22, waves: 0.12, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0 },
  },
  birds: {
    from: { anchor: 'local', cam: [-62, 11, -32], look: [-30, 13, -12], ramp: 0, door: 1, shutter: 1, birds: 0, water: A.h - 22, waves: 0.1, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0, sunEl: 14, sunAz: 195, cloud: 0.4, mud: 1, fov: 58, warm: 0.2 },
    to: { cam: [-58, 11.5, -30], look: [-26, 14, -14], birds: 1, water: A.h - 60 },
  },
  dry: {
    from: { anchor: 'world', cam: [A.x - 170, A.h + 90, A.z - 190], look: [A.x, A.h + 6, A.z], door: 1, ramp: 0, cover: 0, water: A.h - 60, waves: 0.05, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0, sunEl: 36, sunAz: 170, cloud: 0.3, mud: 1, green: 0 },
    to: { cam: [A.x - 110, A.h + 56, A.z - 130], look: [A.x, A.h + 6, A.z], cover: 1, water: -60, green: 0.25 },
  },
  exit: {
    from: { anchor: 'ark', cam: [60, 14, -85], look: [8, 4, -20], door: 1, ramp: 0, cover: 1, water: -60, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0, sunEl: 30, sunAz: 200, cloud: 0.35, mud: 1, green: 0.3, life: 'exit', flock: 0.6 },
    to: { cam: [40, 10, -66], look: [8, 3, -24], door: 0, green: 0.6 },
  },
  altar: {
    from: { anchor: 'ark', cam: [62, 7, -88], look: [22, 3, -46], door: 0, ramp: 0, cover: 1, water: -60, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0, sunEl: 6, sunAz: 250, warm: 0.6, cloud: 0.45, mud: 0.8, green: 0.6, life: 'exit', altar: 1, familyMode: 'altar' },
    to: { cam: [44, 5, -70], look: [22, 3, -46] },
  },
  bow: {
    from: { anchor: 'ark', cam: [40, 9, -150], look: [-10, 30, 40], door: 0, ramp: 0, cover: 1, water: -60, arkX: LAND.x, arkZ: LAND.z, arkYaw: 0, sunEl: 9, sunAz: 165, storm: 0.45, cloud: 0.75, fog: 1.2, mud: 0.7, green: 0.75, wet: 0.4, fov: 62, bow: 0, warm: 0.35, sat: 1.08, exposure: 1.05 },
    to: { cam: [55, 11, -185], look: [-10, 34, 40], bow: 1 },
  },
};

export const EXPLORE: Look = {
  ...BASE,
  cam: [-70, 26, -80], look: [0, 6, 0], sunEl: 30, sunAz: 200, cloud: 0.3, build: 5, pitch: 1, door: 0, ramp: 1, life: 'none', fov: 45,
};

const DISCRETE = new Set(['anchor', 'life', 'familyMode']);

export function resolve(b: Part): Look {
  return { ...BASE, ...b } as Look;
}

export function mix(a: Look, b: Look, t: number): Look {
  const out = { ...a } as Record<string, unknown>;
  for (const k of Object.keys(BASE) as (keyof Look)[]) {
    const va = a[k], vb = b[k];
    if (DISCRETE.has(k)) out[k] = t < 0.5 ? va : vb;
    else if (Array.isArray(va)) out[k] = (va as number[]).map((x, i) => lerp(x, (vb as number[])[i], t));
    else out[k] = lerp(va as number, vb as number, t);
  }
  return out as unknown as Look;
}

/** 某一幕在 u（0–1）的狀態 */
export function beatAt(beat: Beat, u: number): Look {
  const f = resolve(beat.from);
  const to = resolve({ ...beat.from, ...(beat.to ?? {}) });
  return mix(f, to, smooth(u));
}
