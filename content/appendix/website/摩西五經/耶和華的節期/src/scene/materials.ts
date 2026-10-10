// 材質工廠與全域共享 uniform。所有顏色在著色器裡直接輸出 sRGB，不做色彩空間轉換。
import {
  BackSide,
  CustomBlending,
  DoubleSide,
  DstColorFactor,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  ZeroFactor,
  type BufferGeometry,
  type IUniform,
  type Side,
} from 'three';
import type { Palette } from '../data/types';
import { hullGeo } from './geo';
import {
  DARK_FRAG,
  DECAL_FRAG,
  DECAL_VERT,
  FLAME_FRAG,
  FX_FRAG,
  FX_VERT,
  FS_VERT,
  GLOW_FRAG,
  GLOW_VERT,
  GRAIN_FRAG,
  HULL_FRAG,
  HULL_VERT,
  LIT_FRAG,
  LIT_VERT,
  MOON_FRAG,
  MOON_VERT,
  RING_FRAG,
  RING_VERT,
  SKY_FRAG,
  SUN_FRAG,
  TJ_FRAG,
  WIPE_FRAG,
} from './shaders';
import { hexTo } from './util';

const v3 = (hex: string): Vector3 => hexTo(hex, new Vector3());

/** 固定色（規格表） */
export const FIXED = {
  ochre: '#a88758',
  night: '#1c2340',
  nightDark: '#0b0e1c',
  blood: '#a3231b',
  bloodDeep: '#4d100d',
  paperDark: '#15130f',
  inkLightInDark: '#ece4d2',
  line: '#14110e',
};

/** 全域共享 uniform：所有材質引用同一組物件，每幀只改一處 */
export const U = {
  uViewport: { value: new Vector2(1, 1) },
  uRes: { value: new Vector2(1, 1) },
  uDpr: { value: 1 },
  uTime: { value: 0 },
  /** 只在動態開著時前進的時間（火星、煙、雲用） */
  uAnim: { value: 0 },
  uDark: { value: 0 },
  uPaper: { value: new Vector3() },
  uInk: { value: new Vector3() },
  uSilh: { value: new Vector3() },
  uGlow: { value: new Vector3() },
  uBlood: { value: v3(FIXED.blood) },
  uOchre: { value: v3(FIXED.ochre) },
  uLightDir: { value: new Vector3(0.6, 0.5, 0.6) },
  uAmb: { value: 0.3 },
  uGain: { value: 1 },
  uWind: { value: 0 },
  /** 禾捆風浪：四個浪的年齡（秒，<0 表示沒有）、起點 z 與速度 */
  uGustT: { value: new Float32Array([-1, -1, -1, -1]) },
  uGustP: { value: new Vector2(8, 16) },
  /** 吹角：聲波中心（世界 xz）、強度（story.blow.level）、時鐘（秒）：帳棚布面被推動 */
  uBlowC: { value: new Vector2(0, 0) },
  uBlowA: { value: 0 },
  uBlowT: { value: 0 },
};

const COMMON: Record<string, IUniform> = {
  uViewport: U.uViewport,
  uRes: U.uRes,
  uDpr: U.uDpr,
  uTime: U.uTime,
  uAnim: U.uAnim,
  uDark: U.uDark,
};

// ---------------------------------------------------------------- 配色
export class PalVec {
  paper = new Vector3();
  ink = new Vector3();
  accent = new Vector3();
  glow = new Vector3();
  constructor(p: Palette) {
    hexTo(p.paper, this.paper);
    hexTo(p.ink, this.ink);
    hexTo(p.accent, this.accent);
    hexTo(p.glow, this.glow);
  }
}

const DARK_PAPER = v3(FIXED.paperDark);
const DARK_INK = v3(FIXED.inkLightInDark);
const BLACKISH = new Vector3(0.04, 0.04, 0.06);
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();

export const SKY = {
  uNightL: { value: v3(FIXED.night) },
  uNightD: { value: v3(FIXED.nightDark) },
  uDaySky: { value: new Vector3() },
};

/** 依章配色（兩章插值）與暗色程度，更新紙／墨／剪影／光 */
export function setLook(a: PalVec, b: PalVec, k: number, dark: number): void {
  // 亮色
  const paperL = _a.lerpVectors(a.paper, b.paper, k);
  const inkL = _b.lerpVectors(a.ink, b.ink, k);
  // 暗色：紙與墨對調明暗
  const paperD = _c.lerpVectors(DARK_PAPER, inkL, 0.22);
  U.uPaper.value.lerpVectors(paperL, paperD, dark);
  U.uInk.value.lerpVectors(inkL, DARK_INK, dark);
  // 剪影：亮色＝深墨，暗色＝更深
  const silhL = _a.copy(inkL).lerp(BLACKISH, 0.55);
  const silhD = _c.copy(DARK_PAPER).lerp(BLACKISH, 0.55);
  U.uSilh.value.lerpVectors(silhL, silhD, dark);
  U.uGlow.value.lerpVectors(a.glow, b.glow, k);
  // 白天天空：紙色略帶光色
  const dayL = _a.lerpVectors(a.paper, b.paper, k).lerp(U.uGlow.value, 0.22);
  const dayD = _c.copy(DARK_PAPER).lerp(inkL, 0.35);
  SKY.uDaySky.value.lerpVectors(dayL, dayD, dark);
}

// ---------------------------------------------------------------- 刻線光照材質
export interface LitOpts {
  /** 'paper'＝紙色底（暗色模式隨之反轉）；'silh'＝剪影平塗；其他＝平塗色 hex（刻線陰影用墨黑） */
  base: 'paper' | 'silh' | string;
  /** 平塗模式的刻線色 */
  line?: string;
  /** 刻線角度（度）；angle2 給朝上的面 */
  angle?: number;
  angle2?: number;
  space?: number;
  bias?: number;
  seed?: number;
  cross?: boolean;
  /** 逐部件顏色（geometry 要有 aPart） */
  parts?: string[];
  partAlt?: string;
  point?: boolean;
  wind?: boolean;
  side?: Side;
  /** 禾捆風浪（大麥田） */
  gust?: boolean;
  /** 作物生長／收割（uGrow、uCut，instanceColor.g 標田角） */
  crop?: boolean;
  /** 烤餅（uBake） */
  bake?: boolean;
  /** 葉片慢搖（需要 aS 屬性） */
  sway?: boolean;
  /** 帳棚布面波動 */
  flap?: boolean;
  /** 割麥的收割線（uCutX） */
  cutx?: boolean;
  /** 收割線沿 x 走（uReap）：線以左是殘茬（伯大麥田） */
  reap?: boolean;
  /** 葉片慢搖的幅度倍率（搭配 sway） */
  swayK?: number;
}

const rad = (d: number) => (d * Math.PI) / 180;

export function litMat(o: LitOpts): ShaderMaterial {
  const isPaper = o.base === 'paper';
  const isSilh = o.base === 'silh';
  const uniforms: Record<string, IUniform> = {
    ...COMMON,
    uLightDir: U.uLightDir,
    uAmb: U.uAmb,
    uGain: U.uGain,
    uWind: U.uWind,
    uBase: isPaper ? U.uPaper : isSilh ? U.uSilh : { value: v3(o.base) },
    uLineCol: isPaper ? U.uInk : { value: v3(o.line ?? FIXED.line) },
    uInvert: { value: isPaper ? 1 : 0 },
    uAngle: { value: rad(o.angle ?? 35) },
    uAngle2: { value: rad(o.angle2 ?? (o.angle ?? 35) + 70) },
    uSpace: { value: o.space ?? 5 },
    uBias: { value: o.bias ?? (isSilh ? 1 : 0) },
    uSeed: { value: o.seed ?? 1 },
    uCross: { value: o.cross ? 1 : 0 },
    uPt: { value: new Vector4(0, 0, 0, 0) },
  };
  const defines: Record<string, string> = {};
  if (o.parts) {
    const cols: Vector3[] = [];
    for (let i = 0; i < 6; i++) cols.push(v3(o.parts[i] ?? o.parts[o.parts.length - 1]));
    uniforms.uPartCol = { value: cols };
    uniforms.uPartAlt = { value: v3(o.partAlt ?? o.parts[0]) };
    defines.USE_PART = '';
  }
  if (o.point) defines.POINT = '';
  if (o.wind) defines.WIND = '';
  if (o.gust) {
    defines.GUST = '';
    uniforms.uGustT = U.uGustT;
    uniforms.uGustP = U.uGustP;
  }
  if (o.crop) {
    defines.CROP = '';
    uniforms.uGrow = { value: 1 };
    uniforms.uCut = { value: 0 };
    uniforms.uCutAll = { value: 0 };
  }
  if (o.reap) {
    defines.REAP = '';
    uniforms.uReap = { value: -999 };
  }
  if (o.sway) {
    defines.SWAY = '';
    uniforms.uSwayK = { value: o.swayK ?? 1 };
  }
  if (o.flap) {
    defines.FLAP = '';
    uniforms.uBlowC = U.uBlowC;
    uniforms.uBlowA = U.uBlowA;
    uniforms.uBlowT = U.uBlowT;
  }
  if (o.cutx) {
    defines.CUTX = '';
    uniforms.uCutX = { value: 99 };
  }
  if (o.bake) {
    defines.BAKE = '';
    uniforms.uBake = { value: 0 };
    uniforms.uBurnCol = { value: v3('#4a2310') };
  }
  return new ShaderMaterial({
    uniforms,
    defines,
    vertexShader: LIT_VERT,
    fragmentShader: LIT_FRAG,
    side: o.side ?? 0,
  });
}

// ---------------------------------------------------------------- 倒殼輪廓
const hullCache = new Map<string, ShaderMaterial>();
export function hullMat(px: number, flat = false): ShaderMaterial {
  const key = `${px}|${flat ? 1 : 0}`;
  let m = hullCache.get(key);
  if (!m) {
    m = new ShaderMaterial({
      uniforms: { uViewport: U.uViewport, uDpr: U.uDpr, uOutlinePx: { value: px }, uOutCol: U.uInk },
      vertexShader: HULL_VERT,
      fragmentShader: HULL_FRAG,
      side: BackSide,
    });
    hullCache.set(key, m);
  }
  return m;
}

/** 釋放跨場景共用的材質 */
export function disposeShared(): void {
  hullCache.forEach((m) => m.dispose());
  hullCache.clear();
}

/** 實體＋輪廓：回傳一個 Group（含兩個 mesh） */
export function solid(geo: BufferGeometry, mat: ShaderMaterial, outlinePx = 2.6): Group {
  const g = new Group();
  const m = new Mesh(geo, mat);
  g.add(m);
  if (outlinePx > 0) {
    const h = new Mesh(hullGeo(geo), hullMat(outlinePx));
    g.add(h);
  }
  return g;
}

export function solidInstanced(geo: BufferGeometry, mat: ShaderMaterial, count: number, outlinePx = 2): { group: Group; main: InstancedMesh; hull: InstancedMesh | null } {
  const g = new Group();
  const main = new InstancedMesh(geo, mat, count);
  main.frustumCulled = false;
  g.add(main);
  let hull: InstancedMesh | null = null;
  if (outlinePx > 0) {
    hull = new InstancedMesh(hullGeo(geo), hullMat(outlinePx), count);
    hull.instanceMatrix = main.instanceMatrix;
    hull.frustumCulled = false;
    g.add(hull);
  }
  return { group: g, main, hull };
}

// ---------------------------------------------------------------- 發光平塗
export interface GlowOpts {
  on?: string;
  off?: string;
  edge?: string;
  hatch?: number;
  flick?: number;
  /** 地面上的光斑：只畫刻線，半透明疊加 */
  spill?: boolean;
  /** 光斑改成圓形光池（營火） */
  pool?: boolean;
  /** 閃動幅度由呼叫端每幀自己設（火炬） */
  fixedFlick?: boolean;
}
const GLOW_ALL: { m: ShaderMaterial; base: number }[] = [];
/** 窗光、門縫光、燈、光池的閃動：動態開時用各自的幅度，關掉就停 */
export function setGlowFlick(on: boolean): void {
  for (const g of GLOW_ALL) g.m.uniforms.uFlick.value = on ? g.base : 0;
}
export function glowMat(o: GlowOpts = {}): ShaderMaterial {
  const mat = new ShaderMaterial({
    uniforms: {
      ...COMMON,
      uOnCol: o.on ? { value: v3(o.on) } : U.uGlow,
      uOffCol: { value: v3(o.off ?? '#14110e') },
      uEdgeCol: { value: v3(o.edge ?? '#3a2a12') },
      uOn: { value: 1 },
      uOff: { value: -1 },
      uHatch: { value: o.hatch ?? 0.6 },
      uFlick: { value: o.flick ?? 0 },
    },
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    side: DoubleSide,
    defines: o.spill || o.pool ? (o.pool ? { SPILL: '', POOL: '' } : { SPILL: '' }) : {},
    transparent: !!(o.spill || o.pool),
    depthWrite: !(o.spill || o.pool),
    polygonOffset: !!(o.spill || o.pool),
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  if (!o.fixedFlick) GLOW_ALL.push({ m: mat, base: o.flick ?? (o.pool ? 0.3 : o.spill ? 0.14 : 0.16) });
  return mat;
}

// ---------------------------------------------------------------- 火焰
export function flameMat(on = '#ffd070', edge = '#d2511a'): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, uFlick: { value: 1 }, uCol: { value: v3(on) }, uEdge: { value: v3(edge) } },
    vertexShader: GLOW_VERT,
    fragmentShader: FLAME_FRAG,
    side: DoubleSide,
  });
}

// ---------------------------------------------------------------- 火星、煙、塵土
export function fxMat(kind: 'spark' | 'smoke' | 'dust' | 'cloud', size: number): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, uSize: { value: size }, uDist: { value: 0 }, uOn: { value: 1 }, uP: { value: 0 } },
    defines: kind === 'spark' ? { SPARK: '' } : kind === 'smoke' ? { SMOKE: '' } : kind === 'cloud' ? { CLOUD: '' } : { DUST: '' },
    vertexShader: FX_VERT,
    fragmentShader: FX_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
}

// ---------------------------------------------------------------- 血跡貼花
export function decalMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...COMMON,
      uCol: U.uBlood,
      uCol2: { value: v3(FIXED.bloodDeep) },
      uGrow: { value: 0 },
      uSeed: { value: 1 },
      uSize: { value: new Vector2(1, 1) },
      uRad: { value: new Vector2(0.3, 0.3) },
    },
    vertexShader: DECAL_VERT,
    fragmentShader: DECAL_FRAG,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

// ---------------------------------------------------------------- 月亮
export function moonMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...COMMON,
      uLightV: { value: new Vector3(0.7, 0.1, 0.7) },
      uBaseL: U.uGlow,
      uBaseD: U.uPaper,
      uLineL: U.uInk,
      uLineD: U.uGlow,
    },
    vertexShader: MOON_VERT,
    fragmentShader: MOON_FRAG,
  });
}

// ---------------------------------------------------------------- 夜空
export function skyMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...COMMON,
      uInvProj: { value: new Matrix4() },
      uCamWorld: { value: new Matrix4() },
      uHorizon: { value: 0 },
      uHorizonCol: { value: v3(FIXED.blood) },
      uSkyDay: { value: 0 },
      uStars: { value: 1 },
      uTwinkle: { value: 1 },
      uNightL: SKY.uNightL,
      uNightD: SKY.uNightD,
      uDaySky: SKY.uDaySky,
      uInk: U.uInk,
      uPaper: U.uPaper,
    },
    vertexShader: FS_VERT,
    fragmentShader: SKY_FRAG,
    depthTest: false,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------- 覆蓋層
export function darknessMat(): ShaderMaterial {
  const doors: Vector4[] = [];
  for (let i = 0; i < 10; i++) doors.push(new Vector4());
  return new ShaderMaterial({
    uniforms: {
      ...COMMON,
      uDoors: { value: doors },
      uDoorN: { value: 0 },
      uFront: { value: 0 },
      uBand: { value: 1 },
      uAmt: { value: 0 },
      uHorizonY: { value: 0 },
      uFlow: { value: 0 },
      uRise: { value: 0.12 },
      uCol: { value: new Vector3(0.02, 0.025, 0.05) },
    },
    vertexShader: FS_VERT,
    fragmentShader: DARK_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export function wipeMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, uWipe: { value: 0 }, uCol: { value: new Vector3(0.07, 0.065, 0.06) } },
    vertexShader: FS_VERT,
    fragmentShader: WIPE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

export function grainMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, uJitter: { value: 0 } },
    vertexShader: FS_VERT,
    fragmentShader: GRAIN_FRAG,
    transparent: true,
    blending: CustomBlending,
    blendSrc: DstColorFactor,
    blendDst: ZeroFactor,
    blendSrcAlpha: DstColorFactor,
    blendDstAlpha: ZeroFactor,
    depthTest: false,
    depthWrite: false,
  });
}

// ---------------------------------------------------------------- 太陽
export function sunMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, uCol: { value: v3('#f7d27a') }, uLine: { value: v3('#9a5a1a') } },
    vertexShader: MOON_VERT,
    fragmentShader: SUN_FRAG,
  });
}

// ---------------------------------------------------------------- 聲波環（吹角）
export function ringMat(vertical: boolean): ShaderMaterial {
  const r = new Float32Array(8).fill(-1);
  const a = new Float32Array(8);
  return new ShaderMaterial({
    uniforms: { ...COMMON, uC: { value: new Vector3() }, uR: { value: r }, uA: { value: a }, uSpd: { value: 14 } },
    defines: vertical ? { VERT: '' } : {},
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
}

// ---------------------------------------------------------------- 時間跳躍抹除（回聲拍進出）
export function tjMat(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { ...COMMON, tScene: { value: null }, uTJ: { value: 0 }, uDirT: { value: 1 }, uPaperC: { value: new Vector3() }, uInkC: { value: new Vector3() } },
    vertexShader: FS_VERT,
    fragmentShader: TJ_FRAG,
    depthTest: false,
    depthWrite: false,
  });
}
