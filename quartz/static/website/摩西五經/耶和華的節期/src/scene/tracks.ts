// 時間軸：s = cue 序號 + beatProgress。鏡頭、月亮、光線都是 s 的純函數（捲回去就倒回去）。
// 所有時間點一律用 c('cue 名', 進度) 寫，cue 順序改動時不用重算數字。
import { clamp, lerp, sampleKeys, smooth, type Key } from './util';
import { BLX, BX, CX, CZ, GTX, GX, JRX, JX, NX, OX, RX, SVH, SX, WX } from './layout';
import { DX2, MOBILE_K2, MOBILE_POSES2, POSES2, UP2, XEND2, XS2, type Pose, type PosePair } from './poses2';
import { DX3, MOBILE_K3, MOBILE_POSES3, POSES3, UP3 } from './poses3';

export { BLX, BX, CX, CZ, GTX, GX, JRX, JX, NX, OX, RX, SX, WX };
void SVH;

// cue 順序＝story.yaml 的 chapters→beats 順序（cues.test.ts 會和 site.json 對）
export const CUES = [
  'title', 'new-moon', 'month', 'day-10', 'day-14', 'dusk-street', 'hyssop', 'door-shut', 'meal', 'midnight', 'wailing', 'depart', 'vigil', 'children',
  'bake', 'seven-days', 'no-leaven', 'remember',
  'barley-ripe', 'wave', 'lamb-offering', 'not-yet', 'echo-gilgal',
  'sinai', 'unclean', 'wait', 'second-month', 'echo-hezekiah',
  'count', 'two-loaves', 'weeks-offerings', 'rejoice', 'corners', 'echo-ruth',
  'summer',
  'seventh-moon', 'blow', 'trumpet-offerings', 'echo-water-gate',
  'veil', 'linen', 'lots', 'incense', 'sprinkle', 'confess', 'scapegoat', 'afflict',
  'ingathering', 'branches', 'booth', 'bulls', 'booths-rejoice', 'eighth-day', 'echo-roofs',
  // 第三批：七的節奏＋收尾
  'sv-sabbath', 'sv-creation', 'sv-ox', 'sv-weeks', 'sv-month7', 'sv-fallow', 'sv-sixth', 'sv-release', 'sv-egypt', 'sv-reading', 'sv-49', 'sv-horn', 'sv-liberty', 'sv-land',
  'echo-zedekiah', 'echo-land-rest', 'echo-oath',
  'coda-night',
] as const;
export const CUE_IDX: Record<string, number> = {};
CUES.forEach((c, i) => (CUE_IDX[c] = i));
export const N_CUES = CUES.length;
/** 在某個 cue 裡的進度 0..1（還沒到＝0，已經過＝1） */
export const lp = (s: number, name: string): number => Math.min(1, Math.max(0, s - CUE_IDX[name]));
/** cue 名＋進度 → s */
export const c = (name: string, p = 0): number => CUE_IDX[name] + p;
export const HYSSOP_IDX = CUE_IDX['hyssop'];
export const WAVE_IDX = CUE_IDX['wave'];

// ---------------------------------------------------------------- 世界與地點轉換
// 世界座標的配置在 layout.ts（各個地點搭在遠處，互不相干）

export type WorldId =
  | 'night' | 'home' | 'succoth' | 'barley' | 'gilgal' | 'sinai' | 'temple' | 'wheat' | 'ruth' | 'gate' | 'booths' | 'roofs' | 'sevens';

/** 進入這些 cue 時用直向刻線抹除轉場；抹除全蓋的時刻在 cue 開始前 0.07 */
export const WIPE_CUES = [
  'children', 'bake', 'no-leaven', 'barley-ripe', 'seventh-moon', 'veil', 'incense', 'confess', 'ingathering',
  // 第三批：每個換地點的拍（回聲拍之間也用直向抹除）
  'sv-creation', 'sv-ox', 'sv-fallow', 'sv-sixth', 'sv-release', 'sv-egypt', 'sv-reading', 'sv-horn', 'sv-liberty', 'sv-land', 'echo-land-rest', 'echo-oath',
] as const;
/** 回聲拍的「時間跳躍」抹除：進入回聲拍（正向）與離開回聲拍（反向）。離開 water-gate 回聲拍走一般的直向抹除（進 veil，規格指定）。 */
export const TJ_IN = ['echo-gilgal', 'echo-hezekiah', 'echo-ruth', 'echo-water-gate', 'echo-roofs', 'echo-zedekiah'] as const;
export const TJ_OUT = ['sinai', 'count', 'summer', 'sv-sabbath', 'coda-night'] as const;
export const CUT: Record<string, number> = {};
const CUT_BY_IDX: Record<number, number> = {};
for (const n of [...WIPE_CUES, ...TJ_IN, ...TJ_OUT]) {
  CUT[n] = CUE_IDX[n] - 0.07;
  CUT_BY_IDX[CUE_IDX[n]] = CUT[n];
}
/** 抹除轉場全蓋的時刻：在這之後才切到隔日的世界（保留舊名給 hyssop） */
export const DAY_S = CUT['children'];

export function worldAt(s: number): WorldId {
  if (s < CUT['children']) return 'night';
  if (s < CUT['bake']) return 'home';
  if (s < CUT['no-leaven']) return 'succoth';
  if (s < CUT['barley-ripe']) return 'home';
  if (s < CUT['echo-gilgal']) return 'barley';
  if (s < CUT['sinai']) return 'gilgal';
  if (s < CUT['echo-hezekiah']) return 'sinai';
  if (s < CUT['count']) return 'temple';
  if (s < CUT['echo-ruth']) return 'wheat';
  if (s < CUT['summer']) return 'ruth';
  if (s < CUT['seventh-moon']) return 'wheat';
  if (s < CUT['echo-water-gate']) return 'sinai';
  if (s < CUT['veil']) return 'gate';
  if (s < CUT['ingathering']) return 'sinai';
  if (s < CUT['echo-roofs']) return 'booths';
  if (s < CUT['sv-sabbath']) return 'roofs';
  if (s < CUT['sv-egypt']) return 'sevens';
  if (s < CUT['sv-reading']) return 'night'; // sv-egypt：回到逾越節那一章的埃及街道
  if (s < CUT['coda-night']) return 'sevens';
  return 'night'; // coda-night：回到開場的夜空
}
/** sv-egypt：埃及街道夜景重演（門已關、血在門框上、窗亮著） */
export const inEgyptReplay = (s: number): boolean => s >= CUT['sv-egypt'] && s < CUT['sv-reading'];
/** coda-night：回到開場。夜景物件的狀態一律當作 s = 0 */
export const inCoda = (s: number): boolean => s >= CUT['coda-night'];

/** 夏日過場（沿用七七節的麥田）：只在 summer 這一個 cue 裡 */
export const inSummer = (s: number): boolean => s >= CUT['summer'] && s < CUT['seventh-moon'];
/** 曠野的會幕營地是秋季的樣子（院子、帳幕）：吹角節與贖罪日 */
export const isAutumnCamp = (s: number): boolean => (s >= CUT['seventh-moon'] && s < CUT['echo-water-gate']) || (s >= CUT['veil'] && s < CUT['ingathering']);
/** 贖罪日 */
export const inAtonement = (s: number): boolean => s >= CUT['veil'] && s < CUT['ingathering'];

// ---- 回聲拍：進場的切換點（時間跳躍抹除全蓋的時刻）與離場的切換點
/** 回聲拍的 [進, 出]：出＝下一個非回聲 cue 的切換點；最後一個回聲拍沒有出口（到頁尾） */
export const ECHO_RANGES: Array<[string, number, number]> = [
  ['echo-gilgal', CUT['echo-gilgal'], CUT['sinai']],
  ['echo-hezekiah', CUT['echo-hezekiah'], CUT['count']],
  ['echo-ruth', CUT['echo-ruth'], CUT['summer']],
  ['echo-water-gate', CUT['echo-water-gate'], CUT['veil']],
  ['echo-roofs', CUT['echo-roofs'], CUT['sv-sabbath']],
  // 三個回聲拍相連（zedekiah → land-rest → oath），拍與拍之間用直向抹除，舊紙配色不換
  ['echo-zedekiah', CUT['echo-zedekiah'], CUT['coda-night']],
];
/** 回聲拍（後來的歷史）：場景改用舊紙配色 */
export function laterAt(s: number): boolean {
  for (const r of ECHO_RANGES) if (s >= r[1] && s < r[2]) return true;
  return false;
}

/** 抹除轉場的量（0..1）：每個轉場在 cut 前約 0.15 開始、cut 後約 0.17 結束 */
export const wipeAmt = (s: number): number => {
  let w = 0;
  for (const n of WIPE_CUES) {
    const cut = CUT[n];
    if (s < cut - 0.2 || s > cut + 0.2) continue;
    w = Math.max(w, smooth(cut - 0.15, cut - 0.02, s) * (1 - smooth(cut + 0.02, cut + 0.17, s)));
  }
  return w;
};

/**
 * 時間跳躍抹除（回聲拍進出）：回傳 0..2（0＝沒有；1＝舊紙色全蓋；2＝抹完），並用 dir 回報方向。
 * 進回聲拍 dir=+1（斜向由左下抹到右上），離開 dir=-1（反向抹回）。
 */
export const TJ_DIR = { dir: 1 };
const TJ_ALL: Array<[number, number]> = [...TJ_IN.map((n): [number, number] => [CUT[n], 1]), ...TJ_OUT.map((n): [number, number] => [CUT[n], -1])];
export function tjAmt(s: number): number {
  for (let i = 0; i < TJ_ALL.length; i++) {
    const cut = TJ_ALL[i][0];
    if (s < cut - 0.2 || s > cut + 0.2) continue;
    TJ_DIR.dir = TJ_ALL[i][1];
    return smooth(cut - 0.17, cut - 0.02, s) + smooth(cut + 0.02, cut + 0.17, s);
  }
  return 0;
}

// ---------------------------------------------------------------- 鏡頭
// 鏡頭欄位：[px, py, pz, tx, ty, tz, fov(垂直度), fitW(目標處至少要容納的水平寬度，公尺)]
const POSES: Record<string, PosePair> = {
  // 開場與逾越節
  title: [[0, 1.2, 36, 3, 3.3, -15, 56, 0], [0.3, 1.1, 32, 2, 3.2, -15, 56, 0]],
  'new-moon': [[0.3, 1.1, 32, 2, 3.2, -15, 56, 0], [0.3, 1.25, 31, 2.4, 5.2, -15, 56, 0]],
  month: [[0.4, 1.0, 30, 1.5, 2.6, -6, 58, 0], [0.2, 0.55, 21, 0.8, 1.9, 4, 60, 0]],
  'day-10': [[-0.4, 0.9, 17, 0.8, 2.6, 0, 60, 0], [-1.9, 1.3, 8.2, 0.9, 2.2, 0, 58, 5.2]],
  'day-14': [[-1.9, 1.3, 8.2, 0.9, 3.2, 0, 62, 5.2], [-0.2, 1.45, 6.6, 0, 1.55, 0, 46, 4.4]],
  'dusk-street': [[-10, 2.0, 10, 3, 2.2, -1, 52, 0], [-8.4, 1.95, 8.2, 4.2, 2.3, -2, 50, 0]],
  hyssop: [[0.3, 1.5, 5.7, 0.1, 1.2, 0, 40, 4.7], [0.15, 1.5, 5.2, 0.05, 1.2, 0, 40, 4.7]],
  'door-shut': [[0.5, 1.55, 5.8, 0.2, 1.35, 0, 40, 4.7], [2.2, 1.7, 8.6, 0.6, 1.6, 0, 44, 5.4]],
  meal: [[3.6, 1.8, 9.6, 0.6, 1.7, 0, 46, 6.2], [5.4, 1.9, 12, 1.0, 1.8, 0, 48, 8]],
  midnight: [[0, 3.4, 34, 0, 9, 0, 64, 48], [0, 3.8, 36, 0, 9.5, 0, 64, 48]],
  wailing: [[44, 3.2, 8, 46, 6, -30, 60, 0], [52, 2.4, -7, 46.5, 4.2, -22, 52, 11]],
  depart: [[7, 2.7, 23, -2, 4.0, 3, 46, 0], [-4, 2.4, 22, -13, 4.2, 3, 46, 0]],
  vigil: [[6, 1.6, 24, -26, 14.4, -27, 60, 0], [6, 1.5, 24, -26, 36, -27, 64, 0]],
  children: [[OX - 1.6, 1.35, 8.6, OX + 0.2, 1.25, 0, 42, 4.6], [OX - 0.6, 1.35, 7.4, OX + 0.3, 1.3, 0, 42, 4.6]],
  // 無酵節：疏割野地 → 家中
  bake: [[SX + 0.7, 1.05, 4.0, SX + 0.2, 0.3, 0, 42, 0], [SX + 0.55, 1.0, 3.7, SX + 0.15, 0.3, 0, 42, 0]],
  'seven-days': [[SX + 0.2, 1.3, 5, SX + 1, 3.0, -20, 60, 0], [SX + 0.2, 1.3, 5, SX + 2, 9.0, -20, 62, 0]],
  'no-leaven': [[OX - 8.5, 1.5, 1.6, OX - 8.5, 1.45, -4.4, 40, 0], [OX - 8.3, 1.5, 1.1, OX - 8.3, 1.45, -4.4, 40, 0]],
  remember: [[OX + 1.7, 1.3, 8.5, OX + 1.7, 1.0, 2.6, 38, 0], [OX + 1.7, 1.3, 7.8, OX + 1.7, 1.0, 2.6, 38, 0]],
  // 初熟的禾捆
  'barley-ripe': [[BX + 1.4, 1.25, 4.8, BX + 0.9, 0.75, -0.3, 42, 0], [BX - 0.3, 1.15, 4.3, BX - 0.9, 0.75, -0.3, 42, 0]],
  wave: [[BX + 9.2, 1.45, 5.7, BX + 9.2, 1.5, -1, 40, 0], [BX + 9.2, 1.45, 5.7, BX + 9.2, 1.5, -1, 40, 0]],
  'lamb-offering': [[BX + 17.4, 0.9, 4.4, BX + 17, 0.55, 0.6, 38, 0], [BX + 17.2, 0.9, 4.0, BX + 17, 0.55, 0.6, 38, 0]],
  'not-yet': [[BX + 25.7, 1.2, 6.4, BX + 25.4, 0.6, 0.5, 40, 0], [BX + 25.5, 1.2, 6.0, BX + 25.4, 0.6, 0.5, 40, 0]],
  // 二月逾越節：西乃曠野
  sinai: [[NX - 4, 4.2, 13, NX - 6, 1.8, -40, 55, 0], [NX - 4.5, 3.6, 10, NX - 6, 2.0, -40, 55, 0]],
  unclean: [[NX + 6.2, 1.5, 16.5, NX + 6.2, 1.25, 5, 40, 0], [NX + 6.2, 1.5, 16, NX + 6.2, 1.25, 5, 40, 0]],
  wait: [[NX - 1, 1.7, 12.5, NX - 5, 3.4, -12, 48, 0], [NX - 8, 1.9, -2, NX - 6, 3.4, -30, 48, 0]],
  'second-month': [[NX + 21.6, 1.5, 10, NX + 22, 1.15, 2.6, 42, 0], [NX + 21.9, 1.5, 9.5, NX + 22, 1.15, 2.6, 42, 0]],
  // 七七節
  count: [[WX - 8, 1.3, 6.5, WX - 4, 0.9, -6, 48, 0], [WX + 1, 1.3, 6.5, WX + 2, 0.9, -6, 48, 0]],
  'two-loaves': [[WX + 7.1, 1.1, 5.0, WX + 6.7, 0.2, 0.95, 36, 0], [WX + 7.0, 1.05, 4.7, WX + 6.7, 0.2, 0.95, 36, 0]],
  'weeks-offerings': [[WX + 20, 2.2, 28, WX + 20, 0.9, 1.6, 40, 0], [WX + 20, 2.1, 27, WX + 20, 0.9, 1.6, 40, 0]],
  rejoice: [[WX + 46, 1.5, 16, WX + 46, 1.1, 1.8, 42, 0], [WX + 46, 1.5, 15.2, WX + 46, 1.1, 1.8, 42, 0]],
  corners: [[WX + 56.8, 1.4, 8.5, WX + 56.8, 0.8, -3, 44, 0], [WX + 56.8, 1.35, 7.8, WX + 56.8, 0.8, -3, 44, 0]],
};

/** 手機（寬 ≤720px）：說明框蓋住下半，個別 cue 改用較遠的鏡頭，讓主體整個落在上半部 */
const MOBILE_POSES: Record<string, PosePair> = {
  'day-14': [[-0.3, 1.5, 18, 0, 1.4, 0, 46, 0], [-0.3, 1.5, 16.5, 0, 1.4, 0, 46, 0]],
  wailing: [[50, 2.9, -1, 45.5, 3.8, -23, 52, 0], [49, 2.8, -4, 45.2, 3.9, -23, 50, 0]],
  depart: [[7, 2.0, 20, -1, 1.2, 7, 46, 0], [-3, 2.0, 20, -11, 1.2, 7, 46, 0]],
  // 拾穗的人走在 x=52–55 之間，鏡頭對準那一帶
  corners: [[WX + 54.2, 1.5, 6.4, WX + 54.2, 0.8, -3, 44, 0], [WX + 54.2, 1.45, 6.0, WX + 54.2, 0.8, -3, 44, 0]],
  // 疏割的夜空：仰角大一點，月亮在上半、營火在中段
  'seven-days': [[SX + 0.2, 1.3, 5, SX + 1, 3.4, -20, 62, 0], [SX + 0.2, 1.3, 5, SX + 2, 5.4, -20, 62, 0]],
  // 西乃：手機看到的是營地的一段與月亮
  sinai: [[NX - 4, 4.2, 13, NX - 6, 2.4, -40, 58, 0], [NX - 4.5, 3.6, 10, NX - 6, 2.6, -40, 58, 0]],
};

/** 手機：新場景沿用桌機的鏡頭，但沿視線往後退這個倍數（直式畫面的水平視野窄，主體才進得了框） */
const MOBILE_K: Record<string, number> = {
  bake: 2.3,
  'no-leaven': 1.8,
  remember: 2.0,
  'barley-ripe': 2.2,
  wave: 1.7,
  'lamb-offering': 1.5,
  'not-yet': 2.0,
  unclean: 1.9,
  wait: 1.4,
  'second-month': 2.0,
  count: 1.3,
  'two-loaves': 2.2,
  'weeks-offerings': 1.5,
  rejoice: 2.0,
  corners: 1.2,
};

Object.assign(POSES, POSES2, POSES3);
Object.assign(MOBILE_POSES, MOBILE_POSES2, MOBILE_POSES3);
Object.assign(MOBILE_K, MOBILE_K2, MOBILE_K3);

function scalePose(p: Pose, k: number): Pose {
  const o = p.slice() as Pose;
  for (let i = 0; i < 3; i++) o[i] = p[3 + i] + (p[i] - p[3 + i]) * k;
  return o;
}

const isCut = (i: number): boolean => CUT_BY_IDX[i] !== undefined;
/** 一個 cue 的「開始鏡頭」在 s 的哪裡：進入新地點的 cue 在抹除全蓋之後，其餘在 cue 開始後 0.3 */
/** 這些 cue 的開始鏡頭從 cue 一開始就到位（人物一開始就在畫面裡出發） */
const EARLY_START = new Set(['scapegoat']);
const startS = (i: number): number => (isCut(i) ? CUT_BY_IDX[i] + 0.03 : EARLY_START.has(CUES[i]) ? i + 0.02 : i + 0.3);
/** 「結束鏡頭」：下一個 cue 要抹除轉場時，在全蓋之前就到位 */
const endS = (i: number): number => (isCut(i + 1) ? CUT_BY_IDX[i + 1] - 0.03 : i + 1);

function buildCam(mobile: boolean): Key[] {
  const out: Key[] = [];
  CUES.forEach((name, i) => {
    let pair = (mobile && MOBILE_POSES[name]) || POSES[name];
    const mk = mobile && !MOBILE_POSES[name] ? MOBILE_K[name] : undefined;
    if (mk) pair = [scalePose(pair[0], mk), scalePose(pair[1], mk)];
    const [a, b] = pair;
    if (i === 0) out.push({ s: 0, v: a, e: 0 });
    out.push({ s: startS(i), v: a, e: 0 });
    out.push({ s: i === N_CUES - 1 ? N_CUES : endS(i), v: b, e: 1 });
  });
  return out;
}
const CAM = buildCam(false);
const CAM_M = buildCam(true);

// ---------------------------------------------------------------- D. 運鏡加強
// 每個 cue 一種明確的運鏡，疊在上面的基礎鏡頭上：[拉遠比例, 繞目標轉的角度(度), 升降(公尺)]。
// 值都是「cue 開始時」的數字，cue 結束時等於下一個 cue 的開始值（連續）；下一個 cue 要抹除轉場的，另外在 XEND 給結束值。
type X3 = [number, number, number];
const XS: Record<string, X3> = {
  title: [0.16, -12, 0.4], // 推近＋繞行
  'new-moon': [0, 0, 0], // 緩升（月亮在沉）
  month: [-0.05, 8, 0.5],
  'day-10': [0, 0, 0],
  'day-14': [-0.04, -10, 0.1],
  'dusk-street': [0.08, 6, 0.15],
  hyssop: [0, 0, 0],
  'door-shut': [0, 0, 0],
  meal: [-0.06, 8, 0.1],
  midnight: [0, 0, 0],
  wailing: [0.06, -8, 0.2],
  depart: [-0.1, 10, 0],
  vigil: [0, -6, 0.4],
  children: [0.14, 10, 0.05],
  bake: [0.12, -12, 0.15],
  'seven-days': [0, 6, 0.2],
  'no-leaven': [0.12, 0, 0],
  remember: [-0.06, -6, 0.05],
  'barley-ripe': [0.1, 12, 0.1],
  wave: [0, 0, 0],
  'lamb-offering': [-0.02, -3, 0],
  'not-yet': [0.12, 12, 0.15],
  sinai: [0.1, -12, 0.4],
  unclean: [-0.05, 6, 0],
  wait: [0.05, -8, 0],
  'second-month': [0.1, 10, 0.1],
  count: [0.1, -10, 0.2],
  'two-loaves': [-0.08, 6, 0],
  'weeks-offerings': [0.06, -6, 0.2],
  rejoice: [-0.1, 8, 0.1],
  corners: [0.08, -8, 0.2],
};
const XEND: Record<string, X3> = {
  vigil: [0.06, -14, 0.5],
  children: [-0.06, -8, 0.1],
  'seven-days': [0.08, -6, 0.5],
  remember: [-0.08, -10, 0.2],
  'not-yet': [-0.05, -6, 0.4],
  'second-month': [-0.06, -8, 0.2],
  corners: [-0.06, 10, 0.4],
};
Object.assign(XS, XS2);
// coda-night：回到開場，運鏡也和 title 的開始一樣（最後一格才會和開場第一個畫面重合）
XS['coda-night'] = XS['title'];
Object.assign(XEND, XEND2);
function buildExtra(): Key[] {
  const out: Key[] = [];
  CUES.forEach((name, i) => {
    const st = XS[name] ?? [0, 0, 0];
    out.push({ s: i === 0 ? 0 : isCut(i) ? CUT_BY_IDX[i] + 0.03 : i, v: st, e: 1 });
    if (i === N_CUES - 1) out.push({ s: N_CUES, v: XEND[name] ?? st, e: 1 });
    else if (isCut(i + 1)) out.push({ s: CUT_BY_IDX[i + 1] - 0.03, v: XEND[name] ?? st, e: 1 });
  });
  return out;
}
const EXTRA = buildExtra();
const _xt = [0, 0, 0];
const RADIAN = Math.PI / 180;
function applyExtra(s: number, c: number[]): void {
  sampleKeys(EXTRA, s, _xt);
  const k = 1 + _xt[0];
  const om = _xt[1] * RADIAN;
  const co = Math.cos(om);
  const so = Math.sin(om);
  const dx = c[0] - c[3];
  const dy = c[1] - c[4];
  const dz = c[2] - c[5];
  c[0] = c[3] + (dx * co + dz * so) * k;
  c[2] = c[5] + (-dx * so + dz * co) * k;
  c[1] = c[4] + dy * k + _xt[2];
}

/** 每個 cue 一個定值的軌道：進入新 cue 時平順換值 */
function perCue(vals: Record<string, number[]>, dflt: number[]): Key[] {
  const out: Key[] = [];
  CUES.forEach((name, i) => {
    const v = vals[name] ?? dflt;
    if (i === 0) out.push({ s: 0, v, e: 1 });
    out.push({ s: startS(i), v, e: 1 });
    out.push({ s: i === N_CUES - 1 ? N_CUES : endS(i), v, e: 1 });
  });
  return out;
}

// 桌機構圖：把畫面往左右推（畫面寬度的比例，正值＝往右）。說明框在左的拍把主體推向右，反之亦然。
const BOX_LEFT = 0.2;
const BOX_RIGHT = -0.22;
const DX = perCue(
  {
    'new-moon': [0.1],
    'no-leaven': [BOX_RIGHT],
    remember: [BOX_LEFT],
    bake: [-0.18],
    'seven-days': [BOX_LEFT * 0.7],
    'barley-ripe': [BOX_RIGHT],
    wave: [BOX_LEFT],
    'lamb-offering': [BOX_RIGHT],
    'not-yet': [BOX_LEFT],
    sinai: [BOX_RIGHT],
    unclean: [0.3],
    wait: [BOX_RIGHT],
    'second-month': [BOX_LEFT],
    count: [BOX_LEFT],
    'two-loaves': [BOX_RIGHT],
    'weeks-offerings': [BOX_LEFT],
    rejoice: [BOX_RIGHT],
    corners: [BOX_LEFT],
    ...DX2,
    ...DX3,
  },
  [0],
);

// 手機（寬 ≤720px）說明框蓋住畫面下半（約 y>0.55h）、上方還有標題列與月份導覽（約 y<0.13h）：
// 每個 cue 的畫面整體往上推（單位：畫面高度的比例），讓主體落在 0.13h–0.55h 之間。
// hyssop 與 meal 那一拍說明框收成小條或另有安排，不推。
const UP = perCue(
  {
    title: [0.1],
    'new-moon': [0.12],
    month: [0.1],
    'day-10': [0.12],
    'day-14': [0.04],
    'dusk-street': [0.17],
    hyssop: [0],
    'door-shut': [0.17],
    meal: [0],
    midnight: [0.14],
    wailing: [0.2],
    depart: [0.22],
    vigil: [0.2],
    children: [0.2],
    bake: [0.17],
    'seven-days': [0.22],
    'no-leaven': [0.17],
    remember: [0.17],
    'barley-ripe': [0.17],
    wave: [0.12],
    'lamb-offering': [0.17],
    'not-yet': [0.17],
    sinai: [0.15],
    unclean: [0.17],
    wait: [0.15],
    'second-month': [0.17],
    count: [0.15],
    'two-loaves': [0.2],
    'weeks-offerings': [0.28],
    rejoice: [0.26],
    corners: [0.26],
    ...UP2,
    ...UP3,
  },
  [0.15],
);
/**
 * 收起說明框時推移歸零的程度（1＝歸零）。有互動按鈕的拍（塗血、烤餅、搖禾捆、數日、吹角）
 * 收起後說明框仍留著按鈕，構圖維持原樣；吃羊羔是分格構圖，也不動。
 */
const FOLD_RELIEF = perCue({ hyssop: [0], meal: [0], bake: [0], wave: [0], count: [0], blow: [0], 'sv-horn': [0] }, [1]);
const _fr = [1];
export function foldReliefAt(s: number): number {
  sampleKeys(FOLD_RELIEF, s, _fr);
  return _fr[0];
}
/** 手機說明框上限 66svh→50svh 之後，往上推移統一減掉的量（畫面高度比例）；主體本來就偏低的 cue 不減 */
const BOX_EASE = perCue({ wailing: [0], veil: [0] }, [0.07]);
const _be = [0];
export function boxEaseAt(s: number): number {
  sampleKeys(BOX_EASE, s, _be);
  return _be[0];
}
const _up = [0];
export function upShiftAt(s: number): number {
  sampleKeys(UP, s, _up);
  return _up[0];
}
const _dx = [0];
/** 桌機構圖的水平推移（畫面寬度比例） */
export function dxShiftAt(s: number): number {
  sampleKeys(DX, s, _dx);
  return _dx[0];
}

// 手機的月亮：直接指定月亮在畫面上的位置（避開標題列、日數牌、說明框）。[權重, 水平位置(0..1), 垂直位置(0..1, 由上往下)]
const MOON_S: Key[] = [
  { s: 0, v: [1, 0.46, 0.3], e: 1 },
  { s: c('new-moon', 0.3), v: [1, 0.62, 0.3], e: 1 },
  { s: c('new-moon', 0.85), v: [1, 0.62, 0.38], e: 1 },
  { s: c('month', 0.02), v: [1, 0.46, 0.38], e: 1 },
  { s: c('month', 0.4), v: [1, 0.46, 0.3], e: 1 },
  { s: c('month', 1), v: [1, 0.46, 0.3], e: 1 },
  { s: c('day-10', 0.5), v: [1, 0.46, 0.27], e: 1 },
  { s: c('day-14', 0.6), v: [1, 0.42, 0.25], e: 1 },
  { s: c('day-14', 0.95), v: [1, 0.42, 0.25], e: 1 },
  { s: c('dusk-street', 0.4), v: [0, 0.5, 0.3], e: 1 },
  { s: c('meal', 0.5), v: [0, 0.5, 0.3], e: 1 },
  { s: c('meal', 0.95), v: [1, 0.5, 0.27], e: 1 },
  { s: c('midnight', 0.9), v: [1, 0.5, 0.27], e: 1 },
  { s: c('wailing', 0.25), v: [0, 0.5, 0.3], e: 1 },
  { s: c('wailing', 0.6), v: [0, 0.5, 0.3], e: 1 },
  { s: c('depart', 0.05), v: [1, 0.5, 0.3], e: 1 },
  { s: CUT['children'], v: [1, 0.5, 0.3], e: 0 },
  // 疏割的夜空：月亮在畫面上半
  { s: CUT['bake'] + 0.03, v: [0, 0.5, 0.3], e: 1 },
  { s: c('seven-days', 0.25), v: [1, 0.5, 0.26], e: 1 },
  { s: c('seven-days', 1), v: [1, 0.5, 0.26], e: 1 },
  { s: CUT['no-leaven'], v: [0, 0.5, 0.3], e: 0 },
  // 西乃的夜空
  { s: CUT['sinai'] + 0.03, v: [1, 0.5, 0.25], e: 1 },
  { s: c('second-month', 1), v: [1, 0.5, 0.25], e: 1 },
  { s: CUT['count'] - 0.03, v: [0, 0.5, 0.25], e: 0 },
  // 吹角節：西邊低空的細月；住棚節：東邊升起的滿月與夜祭
  { s: CUT['seventh-moon'] + 0.03, v: [1, 0.64, 0.3], e: 1 },
  { s: c('blow', 1), v: [1, 0.64, 0.3], e: 1 },
  { s: c('trumpet-offerings', 0.2), v: [0, 0.5, 0.3], e: 0 },
  { s: CUT['ingathering'] + 0.03, v: [1, 0.3, 0.38], e: 1 },
  { s: c('ingathering', 1), v: [1, 0.3, 0.28], e: 1 },
  { s: c('branches', 0.3), v: [0, 0.5, 0.3], e: 0 },
  { s: c('bulls', 0.0), v: [0, 0.5, 0.3], e: 0 },
  { s: c('bulls', 0.3), v: [1, 0.5, 0.26], e: 1 },
  { s: c('bulls', 1), v: [1, 0.5, 0.26], e: 1 },
  { s: c('booths-rejoice', 0.2), v: [0, 0.5, 0.3], e: 0 },
  // 七的節奏：夜裡的幾拍，月亮放在右上（漩渦在左上角、說明框在下）
  { s: CUT['sv-sabbath'] + 0.03, v: [1, 0.76, 0.32], e: 1 },
  { s: CUT['sv-creation'] - 0.03, v: [1, 0.76, 0.32], e: 0 },
  { s: CUT['sv-creation'] + 0.03, v: [0, 0.5, 0.3], e: 0 },
  { s: c('sv-weeks', 0.4), v: [0, 0.5, 0.3], e: 1 },
  { s: c('sv-weeks', 0.75), v: [1, 0.78, 0.3], e: 1 },
  { s: CUT['sv-fallow'] - 0.03, v: [1, 0.78, 0.3], e: 0 },
  { s: CUT['sv-fallow'] + 0.03, v: [0, 0.5, 0.3], e: 0 },
  { s: CUT['sv-egypt'] + 0.03, v: [1, 0.5, 0.27], e: 0 },
  { s: CUT['sv-reading'] - 0.03, v: [1, 0.5, 0.27], e: 0 },
  { s: CUT['sv-reading'] + 0.03, v: [0, 0.5, 0.3], e: 0 },
  { s: c('sv-49', 0.55), v: [0, 0.5, 0.3], e: 1 },
  { s: c('sv-49', 0.85), v: [1, 0.76, 0.3], e: 1 },
  { s: CUT['sv-horn'] - 0.03, v: [1, 0.76, 0.3], e: 0 },
  { s: CUT['sv-horn'] + 0.03, v: [0, 0.5, 0.3], e: 0 },
  // coda：和開場第一個畫面一樣
  { s: CUT['coda-night'] + 0.03, v: [1, 0.46, 0.3], e: 0 },
];

// 月亮：[方位角(從 -z 轉向 +x，弧度), 仰角(度), 視直徑(度)]
const MOON: Key[] = [
  { s: 0, v: [0.32, 9, 8.5], e: 1 },
  { s: c('new-moon', 0.3), v: [0.17, 17, 11], e: 1 },
  { s: c('new-moon', 0.97), v: [0.16, 8, 11], e: 1 },
  { s: c('month', 0.03), v: [0.26, 9, 9.5], e: 1 },
  { s: c('month', 0.9), v: [0.23, 17, 10.5], e: 1 },
  { s: c('day-10'), v: [0.2, 22, 11.5], e: 1 },
  { s: c('day-14'), v: [0.1, 27, 14], e: 1 },
  { s: c('dusk-street'), v: [0.55, 29, 11], e: 1 },
  { s: c('hyssop'), v: [0.3, 40, 11], e: 1 },
  { s: c('midnight'), v: [0.0, 30, 11], e: 1 },
  { s: c('midnight', 1), v: [0.0, 31, 11], e: 1 },
  { s: c('midnight', 1.3), v: [0.7, 42, 11], e: 1 },
  { s: c('wailing', 1), v: [-0.2, 22, 11], e: 1 },
  { s: c('depart', 0.9), v: [-0.3, 27, 11.5], e: 1 },
  { s: c('vigil'), v: [-0.55, 34, 12], e: 0 },
  { s: CUT['children'], v: [-0.55, 46, 13], e: 0 },
  // 疏割：天剛亮月亮在西邊落下；七夜虧月
  { s: CUT['bake'] + 0.03, v: [0.5, -14, 12], e: 0 },
  { s: c('seven-days', 0), v: [0.5, -14, 12], e: 1 },
  { s: c('seven-days', 0.4), v: [0.45, 26, 12], e: 1 },
  { s: c('seven-days', 1), v: [0.42, 29, 12], e: 1 },
  { s: CUT['no-leaven'], v: [0.42, 29, 12], e: 0 },
  // 西乃：滿月
  { s: CUT['sinai'] + 0.03, v: [-0.12, 22, 12.5], e: 1 },
  { s: c('wait'), v: [-0.3, 34, 12.5], e: 1 },
  { s: c('second-month'), v: [-0.2, 40, 12.5], e: 1 },
  { s: c('second-month', 1), v: [-0.2, 42, 12.5], e: 0 },
  // 吹角節：黃昏剛過，西邊低空一彎極細的新月，隨捲動往地平線沉
  { s: CUT['seventh-moon'] + 0.03, v: [0.2, 11, 10.5], e: 1 },
  { s: c('seventh-moon', 1), v: [0.16, 9, 10.5], e: 1 },
  { s: c('blow', 1), v: [0.04, 7, 10.5], e: 1 },
  { s: c('trumpet-offerings', 1), v: [0.2, 5, 10.5], e: 0 },
  { s: CUT['veil'] + 0.03, v: [0.2, 40, 11], e: 0 },
  // 住棚節：東邊滿月升起；七夜虧月
  { s: CUT['ingathering'] + 0.03, v: [-0.78, 3, 13], e: 1 },
  { s: c('ingathering', 1), v: [-0.7, 19, 13], e: 1 },
  { s: c('branches', 1), v: [-0.5, 34, 12], e: 1 },
  { s: c('bulls', 0), v: [-0.4, 40, 12], e: 1 },
  { s: c('bulls', 1), v: [0.1, 48, 12], e: 1 },
  { s: c('eighth-day', 0.5), v: [0.4, 40, 12], e: 1 },
  { s: CUT['sv-sabbath'] - 0.03, v: [0.4, 38, 12], e: 0 },
  // 七的節奏
  { s: CUT['sv-sabbath'] + 0.03, v: [0.22, 33, 11], e: 0 },
  { s: c('sv-month7', 1), v: [-0.1, 40, 11], e: 0 },
  { s: CUT['sv-egypt'] + 0.03, v: [0.3, 40, 11], e: 0 },
  { s: CUT['sv-reading'] - 0.03, v: [0.3, 40, 11], e: 0 },
  { s: c('sv-49', 0.6), v: [0.15, 30, 11], e: 0 },
  { s: CUT['sv-horn'] - 0.03, v: [0.15, 30, 11], e: 0 },
  // coda：開場的第一彎月
  { s: CUT['coda-night'] + 0.03, v: [0.32, 9, 8.5], e: 0 },
  { s: N_CUES, v: [0.32, 9, 8.5], e: 0 },
];

// 光線：[lx, ly, lz, 環境光, 增益]
const DAYLIGHT = [0.5, 0.75, 0.55, 0.52, 1.02];
const LIGHT: Key[] = [
  { s: 0, v: [0.5, 0.6, 0.6, 0.3, 0.88], e: 1 },
  { s: c('day-14', 0.4), v: [0.75, 0.42, 0.55, 0.33, 0.95], e: 1 },
  { s: c('dusk-street'), v: [0.85, 0.32, 0.45, 0.36, 1.0], e: 0 },
  { s: c('hyssop', 0.8), v: [0.8, 0.36, 0.5, 0.36, 0.98], e: 1 },
  { s: c('meal', 0.2), v: [0.45, 0.7, 0.5, 0.3, 0.8], e: 1 },
  { s: c('midnight'), v: [0.12, 1.0, 0.3, 0.28, 0.68], e: 1 },
  { s: c('wailing', 0.5), v: [0.3, 0.8, 0.5, 0.28, 0.66], e: 1 },
  { s: CUT['children'] - 0.03, v: [0.3, 0.8, 0.5, 0.3, 0.86], e: 1 },
  { s: CUT['children'] + 0.03, v: DAYLIGHT, e: 0 },
  { s: CUT['bake'] - 0.03, v: DAYLIGHT, e: 0 },
  // 疏割天剛亮：低斜的光從右後方來；七夜是月光
  { s: CUT['bake'] + 0.03, v: [-0.55, 0.28, 0.7, 0.38, 0.95], e: 1 },
  { s: c('bake', 1), v: [-0.55, 0.28, 0.7, 0.38, 0.95], e: 1 },
  { s: c('seven-days', 0.35), v: [0.3, 0.8, 0.5, 0.32, 0.88], e: 1 },
  { s: CUT['no-leaven'] - 0.03, v: [0.3, 0.8, 0.5, 0.32, 0.88], e: 0 },
  { s: CUT['no-leaven'] + 0.03, v: [-0.55, 0.55, 0.7, 0.5, 1.0], e: 0 },
  { s: CUT['barley-ripe'] - 0.03, v: [-0.55, 0.55, 0.7, 0.5, 1.0], e: 0 },
  { s: CUT['barley-ripe'] + 0.03, v: [0.55, 0.7, 0.45, 0.5, 1.02], e: 0 },
  { s: CUT['sinai'] - 0.03, v: [0.55, 0.7, 0.45, 0.5, 1.02], e: 0 },
  { s: CUT['sinai'] + 0.03, v: [0.35, 0.85, 0.45, 0.3, 0.9], e: 0 },
  { s: CUT['echo-hezekiah'] - 0.03, v: [0.35, 0.85, 0.45, 0.3, 0.9], e: 0 },
  { s: CUT['echo-hezekiah'] + 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  { s: CUT['count'] - 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  { s: CUT['count'] + 0.03, v: [0.6, 0.7, 0.4, 0.5, 1.02], e: 0 },
  { s: CUT['seventh-moon'] - 0.03, v: [0.6, 0.7, 0.4, 0.5, 1.02], e: 0 },
  // 吹角節：夜（營火與月光）
  { s: CUT['seventh-moon'] + 0.03, v: [0.4, 0.75, 0.5, 0.34, 0.92], e: 1 },
  { s: CUT['echo-water-gate'] - 0.03, v: [0.35, 0.8, 0.5, 0.32, 0.9], e: 0 },
  { s: CUT['echo-water-gate'] + 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  { s: CUT['veil'] - 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  // 贖罪日：清晨 → 進聖所（暗）→ 白天
  { s: CUT['veil'] + 0.03, v: [-0.45, 0.4, 0.8, 0.46, 0.96], e: 1 },
  { s: c('veil', 0.4), v: [-0.45, 0.45, 0.8, 0.46, 0.96], e: 1 },
  { s: c('veil', 0.7), v: [0.2, 0.6, 0.6, 0.24, 0.62], e: 1 },
  { s: c('veil', 1), v: [0.2, 0.6, 0.6, 0.24, 0.62], e: 0 },
  { s: c('linen', 0.15), v: [0.5, 0.75, 0.55, 0.5, 1.0], e: 1 },
  { s: CUT['incense'] - 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.0], e: 0 },
  { s: CUT['incense'] + 0.03, v: [0.2, 0.6, 0.7, 0.14, 0.72], e: 0 },
  { s: CUT['confess'] - 0.03, v: [0.2, 0.6, 0.7, 0.14, 0.72], e: 0 },
  { s: CUT['confess'] + 0.03, v: [0.55, 0.7, 0.5, 0.5, 1.02], e: 0 },
  { s: CUT['ingathering'] - 0.03, v: [0.6, 0.8, 0.4, 0.5, 1.04], e: 0 },
  // 住棚節
  { s: CUT['ingathering'] + 0.03, v: [-0.6, 0.35, 0.5, 0.42, 0.98], e: 1 },
  { s: c('ingathering', 1), v: [-0.5, 0.4, 0.6, 0.44, 1.0], e: 1 },
  { s: c('branches', 0.4), v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 1 },
  { s: c('booth', 1), v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 1 },
  { s: c('bulls', 0.3), v: [0.3, 0.8, 0.5, 0.3, 0.86], e: 1 },
  { s: c('bulls', 1), v: [0.3, 0.8, 0.5, 0.3, 0.86], e: 1 },
  { s: c('booths-rejoice', 0.35), v: [0.6, 0.55, 0.5, 0.5, 1.02], e: 1 },
  { s: c('eighth-day', 0.1), v: [-0.5, 0.5, 0.7, 0.5, 1.0], e: 1 },
  { s: CUT['sv-sabbath'] - 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  // 七的節奏：安息日夜 → 創造（白天）→ 牛驢（白天）→ 傍晚到夜（漩渦長出來）→ 田（白天）……
  { s: CUT['sv-sabbath'] + 0.03, v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 0 },
  { s: CUT['sv-creation'] - 0.03, v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 0 },
  { s: CUT['sv-creation'] + 0.03, v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 0 },
  { s: c('sv-weeks', 0.05), v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 1 },
  { s: c('sv-weeks', 0.6), v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 1 },
  { s: CUT['sv-fallow'] - 0.03, v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 0 },
  { s: CUT['sv-fallow'] + 0.03, v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 0 },
  { s: CUT['sv-egypt'] - 0.03, v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 0 },
  { s: CUT['sv-egypt'] + 0.03, v: [0.45, 0.7, 0.5, 0.3, 0.8], e: 0 },
  { s: CUT['sv-reading'] - 0.03, v: [0.45, 0.7, 0.5, 0.3, 0.8], e: 0 },
  { s: CUT['sv-reading'] + 0.03, v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 0 },
  { s: c('sv-49', 0.1), v: [0.5, 0.75, 0.55, 0.52, 1.02], e: 1 },
  { s: c('sv-49', 0.7), v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 1 },
  { s: CUT['sv-horn'] - 0.03, v: [0.3, 0.8, 0.5, 0.32, 0.9], e: 0 },
  { s: CUT['sv-horn'] + 0.03, v: [0.55, 0.7, 0.5, 0.5, 1.02], e: 0 },
  { s: CUT['coda-night'] - 0.03, v: [0.5, 0.75, 0.55, 0.5, 1.02], e: 0 },
  // coda：開場第一個畫面的光
  { s: CUT['coda-night'] + 0.03, v: [0.5, 0.6, 0.6, 0.3, 0.88], e: 0 },
  { s: N_CUES, v: [0.5, 0.6, 0.6, 0.3, 0.88], e: 0 },
];

// 天空：[地平線暈染強度, 星星強度, 白天程度, 暈染偏琥珀（0＝血紅，1＝琥珀）]
const DAYSKY = [0, 0, 1, 0];
const SKYK: Key[] = [
  { s: 0, v: [0.06, 1, 0, 0], e: 1 },
  { s: c('new-moon', 0.2), v: [0.38, 0.75, 0, 0.55], e: 1 },
  { s: c('new-moon', 0.99), v: [0.34, 0.8, 0, 0.55], e: 1 },
  { s: c('month', 0.4), v: [0.12, 1, 0, 0], e: 1 },
  { s: c('day-10', 1), v: [0.3, 0.9, 0, 0], e: 1 },
  { s: c('day-14', 0.9), v: [0.92, 0.35, 0, 0], e: 0 },
  { s: c('dusk-street', 0.2), v: [0.78, 0.4, 0, 0], e: 1 },
  { s: c('hyssop', 0.5), v: [0.42, 0.7, 0, 0], e: 1 },
  { s: c('door-shut', 0.6), v: [0.1, 1, 0, 0], e: 1 },
  { s: c('meal', 0.4), v: [0.0, 1, 0, 0], e: 0 },
  { s: CUT['children'] - 0.03, v: [0.0, 1, 0, 0], e: 1 },
  { s: CUT['children'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['bake'] - 0.03, v: DAYSKY, e: 0 },
  // 疏割天剛亮 → 夜
  { s: CUT['bake'] + 0.03, v: [0.85, 0.25, 0, 1], e: 1 },
  { s: c('bake', 1), v: [0.8, 0.2, 0, 1], e: 1 },
  { s: c('seven-days', 0.45), v: [0.0, 1, 0, 0.6], e: 0 },
  { s: CUT['no-leaven'] - 0.03, v: [0.0, 1, 0, 0.6], e: 1 },
  { s: CUT['no-leaven'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['sinai'] - 0.03, v: DAYSKY, e: 0 },
  { s: CUT['sinai'] + 0.03, v: [0.0, 1, 0, 0], e: 0 },
  { s: CUT['echo-hezekiah'] - 0.03, v: [0.0, 1, 0, 0], e: 0 },
  { s: CUT['echo-hezekiah'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['count'] - 0.03, v: DAYSKY, e: 0 },
  { s: CUT['count'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['seventh-moon'] - 0.03, v: DAYSKY, e: 0 },
  // 吹角節：日落後的曠野
  { s: CUT['seventh-moon'] + 0.03, v: [0.62, 0.7, 0, 1], e: 1 },
  { s: c('blow', 0.5), v: [0.36, 0.95, 0, 1], e: 1 },
  { s: CUT['echo-water-gate'] - 0.03, v: [0.12, 1, 0, 0.6], e: 0 },
  { s: CUT['echo-water-gate'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['veil'] - 0.03, v: DAYSKY, e: 0 },
  // 贖罪日：天剛亮 → 白天
  { s: CUT['veil'] + 0.03, v: [0.82, 0.25, 0.2, 1], e: 1 },
  { s: c('veil', 0.8), v: [0.5, 0.05, 0.6, 1], e: 1 },
  { s: c('linen', 0.2), v: [0.12, 0, 1, 0.5], e: 1 },
  { s: CUT['ingathering'] - 0.03, v: DAYSKY, e: 0 },
  // 住棚節：黃昏東邊月出 → 白天 → 夜祭 → 白天 → 第八日清晨
  { s: CUT['ingathering'] + 0.03, v: [0.55, 0.45, 0.05, 0.9], e: 1 },
  { s: c('ingathering', 0.9), v: [0.45, 0.6, 0.0, 0.9], e: 1 },
  { s: c('branches', 0.5), v: DAYSKY, e: 0 },
  { s: c('bulls', 0), v: DAYSKY, e: 0 },
  { s: c('bulls', 0.25), v: [0.18, 1, 0, 0.5], e: 1 },
  { s: c('bulls', 1), v: [0.18, 1, 0, 0.5], e: 1 },
  { s: c('booths-rejoice', 0.3), v: DAYSKY, e: 0 },
  { s: c('eighth-day', 0.05), v: [0.5, 0.1, 0.55, 1], e: 1 },
  { s: c('eighth-day', 0.5), v: [0.0, 0, 1, 0.3], e: 1 },
  { s: CUT['sv-sabbath'] - 0.03, v: DAYSKY, e: 0 },
  // 七的節奏
  { s: CUT['sv-sabbath'] + 0.03, v: [0.0, 1, 0, 0.3], e: 0 },
  { s: CUT['sv-creation'] - 0.03, v: [0.0, 1, 0, 0.3], e: 0 },
  { s: CUT['sv-creation'] + 0.03, v: DAYSKY, e: 0 },
  { s: c('sv-weeks', 0.05), v: DAYSKY, e: 1 },
  { s: c('sv-weeks', 0.3), v: [0.6, 0.45, 0.05, 1], e: 1 },
  { s: c('sv-weeks', 0.65), v: [0.0, 1, 0, 0.4], e: 1 },
  { s: CUT['sv-fallow'] - 0.03, v: [0.0, 1, 0, 0.4], e: 0 },
  { s: CUT['sv-fallow'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['sv-egypt'] - 0.03, v: DAYSKY, e: 0 },
  { s: CUT['sv-egypt'] + 0.03, v: [0.0, 1, 0, 0], e: 0 },
  { s: CUT['sv-reading'] - 0.03, v: [0.0, 1, 0, 0], e: 0 },
  { s: CUT['sv-reading'] + 0.03, v: DAYSKY, e: 0 },
  { s: c('sv-49', 0.1), v: DAYSKY, e: 1 },
  { s: c('sv-49', 0.45), v: [0.62, 0.45, 0.05, 1], e: 1 },
  { s: c('sv-49', 0.8), v: [0.0, 1, 0, 0.4], e: 1 },
  { s: CUT['sv-horn'] - 0.03, v: [0.0, 1, 0, 0.4], e: 0 },
  { s: CUT['sv-horn'] + 0.03, v: DAYSKY, e: 0 },
  { s: CUT['coda-night'] - 0.03, v: DAYSKY, e: 0 },
  // coda：開場的夜空
  { s: CUT['coda-night'] + 0.03, v: [0.06, 1, 0, 0], e: 0 },
  { s: N_CUES, v: [0.06, 1, 0, 0], e: 0 },
];

export interface TrackOut {
  cam: number[];
  moon: number[];
  light: number[];
  sky: number[];
  /** 手機用：月亮的畫面位置 [權重, x, y] */
  moonS: number[];
  /** 太陽：[方位角, 仰角(度), 視直徑(度)]；仰角 < -6 表示看不到 */
  sun: number[];
  /** 夏日過場自己算的月相（0 表示照 story.day） */
  moonDay: number;
}

export function createTrackOut(): TrackOut {
  return { cam: new Array(8).fill(0), moon: new Array(3).fill(0), light: new Array(5).fill(0), sky: new Array(4).fill(0), moonS: new Array(3).fill(0), sun: [0, -40, 6], moonDay: 0 };
}

// ---------------------------------------------------------------- 日月交替（夏日過場、贖罪日末拍）
const LIGHT_DAY = [0.5, 0.75, 0.55, 0.52, 1.02];
const LIGHT_NIGHT = [0.3, 0.8, 0.5, 0.4, 0.96];
/** 依太陽仰角（度）算天空與光線 */
function skyFromSun(el: number, out: TrackOut): void {
  // 黃昏拉長成連續的過渡；夜色比一般的夜淺一點（天色混進一點白天的紙色），亮暗差變小
  const day = smooth(-14, 24, el);
  const horizon = smooth(-18, -3, el) * (1 - smooth(4, 28, el));
  out.sky[0] = horizon * 0.95;
  out.sky[1] = 1 - smooth(-12, 4, el);
  out.sky[2] = lerp(0.3, 1, day);
  out.sky[3] = 1;
  for (let i = 0; i < 5; i++) out.light[i] = lerp(LIGHT_NIGHT[i], LIGHT_DAY[i], day);
}
/** 太陽、月亮的位置：phi 是「日數」（整數＝日出；.25 正午；.5 日落；.75 子夜）。月亮與太陽相反。 */
function sunMoon(phi: number, out: TrackOut): void {
  const f = phi - Math.floor(phi);
  const sunEl = 58 * Math.sin(2 * Math.PI * f);
  // 日出在畫面左（-x），日落在右（+x，和開場「亮面朝西＝畫面右側」一致）
  const dayT = clamp(f * 2);
  out.sun[0] = lerp(-0.95, 0.95, dayT);
  out.sun[1] = sunEl;
  out.sun[2] = 7;
  const nightT = clamp((f - 0.5) * 2);
  out.moon[0] = lerp(-0.9, 0.9, nightT);
  out.moon[1] = f >= 0.5 ? 52 * Math.sin(Math.PI * nightT) : -20;
  out.moon[2] = 11;
  skyFromSun(sunEl, out);
}
export const SUMMER_DAYS = 6.25;
/** 夏日過場：6 個日夜，結束在黃昏（日落）；最後西邊低空一彎極細新月 */
/**
 * 夏日過場的日夜進度（阻尼後）：6 個日夜壓在約一個螢幕高的捲動裡，讀者快滾時畫面不能整片翻閃。
 * 所以天色不直接等於捲動值，而是隨時間追上去：時間常數 0.5 秒，並限制最大速度 0.08 進度／秒
 * （＝每秒最多半個日夜循環，亮暗翻轉每秒不超過 1 次）。這是捲動帶動的，動態關也照常追（不卡住）。
 */
export const SUMMER = { sp: 0, was: false, busy: false };
const SUMMER_TAU = 0.5;
const SUMMER_MAX = 0.08;
const summerTarget = (s: number): number => clamp((s - c('summer') - 0.08) / 0.7);
/** 每幀在算鏡頭之前呼叫；dt 已夾在 0–0.1。進入過場（或跳著進來）時直接對齊，不追 */
export function stepSummer(s: number, dt: number): void {
  const tgt = summerTarget(s);
  if (!inSummer(s) || !SUMMER.was) {
    SUMMER.sp = tgt;
    SUMMER.was = inSummer(s);
    SUMMER.busy = false;
    return;
  }
  const d = tgt - SUMMER.sp;
  let step = d * (1 - Math.exp(-Math.max(0, dt) / SUMMER_TAU));
  const mx = SUMMER_MAX * Math.max(0, dt);
  step = step > mx ? mx : step < -mx ? -mx : step;
  SUMMER.sp += step;
  if (Math.abs(tgt - SUMMER.sp) < 1e-4) SUMMER.sp = tgt;
  SUMMER.busy = SUMMER.sp !== tgt;
}
// ---- echo-land-rest：荒涼的田，日月快速交替多次。做法同夏日過場：天色不直接等於捲動值，而是隨時間追上去（時間常數 0.5 秒、最大速度 0.08 進度／秒），不可閃爍。
export const REST = { sp: 0, was: false, busy: false };
export const REST_DAYS = 4.25;
export const inRest = (s: number): boolean => s >= CUT['echo-land-rest'] && s < CUT['echo-oath'];
const restTarget = (s: number): number => clamp((s - c('echo-land-rest') - 0.08) / 0.7);
/** 每幀在算鏡頭之前呼叫；dt 已夾在 0–0.1。進入時直接對齊，不追 */
export function stepRest(s: number, dt: number): void {
  const tgt = restTarget(s);
  if (!inRest(s) || !REST.was) {
    REST.sp = tgt;
    REST.was = inRest(s);
    REST.busy = false;
    return;
  }
  const d = tgt - REST.sp;
  let step = d * (1 - Math.exp(-Math.max(0, dt) / SUMMER_TAU));
  const mx = SUMMER_MAX * Math.max(0, dt);
  step = step > mx ? mx : step < -mx ? -mx : step;
  REST.sp += step;
  if (Math.abs(tgt - REST.sp) < 1e-4) REST.sp = tgt;
  REST.busy = REST.sp !== tgt;
}
function restSky(out: TrackOut): void {
  sunMoon(0.25 + REST_DAYS * REST.sp, out);
}
function summerSky(_s: number, out: TrackOut): void {
  const p = SUMMER.sp;
  const phi = 0.25 + SUMMER_DAYS * p;
  sunMoon(phi, out);
  // 月相：由下弦虧到不見，最後換成新月
  const end = smooth(0.9, 0.975, p);
  out.moonDay = lerp(lerp(19, 29, p), 1.3, end);
  if (end > 0) {
    out.moon[0] = lerp(out.moon[0], 0.5, end);
    out.moon[1] = lerp(out.moon[1], 9, end);
    out.moon[2] = lerp(out.moon[2], 11, end);
  }
  // 結束時的黃昏：日落後的暈染
  out.sky[0] = Math.max(out.sky[0], 0.5 * end);
}
/** 贖罪日末拍 afflict：從日落到日落（初九晚上到初十晚上）：日落 → 夜 → 日出 → 白天 → 日落 */
function afflictSky(s: number, out: TrackOut): void {
  sunMoon(afflictPhi(s), out);
}
export const afflictPhi = (s: number): number => 0.49 + clamp((s - c('afflict')) / 0.8);

// ---------------------------------------------------------------- scapegoat：長距離走路
/** 羊（與人）在路上走過的距離（公尺）：起步與到達用常速（各約 12 公尺），中段高速 */
export const scapeDist = (p: number): number => 12 * smooth(0, 0.2, p) + 176 * smooth(0.18, 0.86, p) + 12 * smooth(0.84, 1, p);
/** 路線（院子座標）：出院子門往 +z 走到 TURN_Z，再轉向 -x 走進曠野 */
export const SCAPE_GATE_Z = 9.7;
export const SCAPE_TURN_Z = 40;
const _sc = [0, 0, 0, 0, 0, 0, 0, 0];
/** scapegoat 的鏡頭：先貼身跟著出營的人與羊，再慢慢拉遠、升高，營地縮成地平線上的一條線 */
function scapeCam(s: number, out: number[], mobile: boolean): void {
  const p = clamp(s - c('scapegoat'));
  const D = scapeDist(p);
  const seg1 = SCAPE_TURN_Z - SCAPE_GATE_Z;
  const gx = D < seg1 ? 0.9 : 0.9 - (D - seg1);
  const gz = D < seg1 ? SCAPE_GATE_Z + D : SCAPE_TURN_Z;
  const e = smooth(0.6, 1, p);
  const ox = NX + CX;
  const oz = CZ;
  const far = mobile ? 1.35 : 1;
  const camX = lerp(gx + 7, -96, e);
  const camY = lerp(2.2 + 1.2 * smooth(0.1, 0.6, p), 30, e * e);
  const camZ = lerp(gz + (14 + 6 * smooth(0.2, 0.6, p)) * far, 150 * far, e);
  const tX = lerp(gx - 2.5, -100, e);
  const tZ = lerp(gz, 25, e);
  _sc[0] = ox + camX;
  _sc[1] = camY;
  _sc[2] = oz + camZ;
  _sc[3] = ox + tX;
  _sc[4] = lerp(1.0, 1.5, e);
  _sc[5] = oz + tZ;
  _sc[6] = lerp(50, 60, e);
  _sc[7] = 0;
  const w = smooth(c('scapegoat'), c('scapegoat') + 0.12, s);
  for (let i = 0; i < 8; i++) out[i] = lerp(out[i], _sc[i], w);
}

// ---------------------------------------------------------------- sv-release：把人放走（長距離走路）
/** 放走的人出了門以後的步行：起步與到達用常速，中段高速（同 scapegoat 的規則）；p 是這一段的進度 0..1，回傳走過的公尺 */
export const releaseWalkP = (p: number): number => clamp((p - 0.6) / 0.3);
export const releaseDist = (p: number): number => scapeDist(releaseWalkP(p));
export const RELEASE_X0 = 2.4;
const _rc = [0, 0, 0, 0, 0, 0, 0, 0];
/** sv-release 的鏡頭：先在門口看主人把東西一件件交出去，人走出門以後鏡頭貼著他、再慢慢拉遠升高 */
function releaseCam(s: number, out: number[], mobile: boolean): void {
  const p = clamp(s - c('sv-release'));
  const w = releaseWalkP(p);
  const D = scapeDist(w);
  const e = smooth(0.55, 1, w);
  const far = mobile ? 1.3 : 1;
  const sx = SVH + RELEASE_X0 + D;
  const kn = mobile ? 2.0 : 1; // 手機：一開始就退遠一點（和 MOBILE_K3 一致），整組人與東西才進得了框
  _rc[0] = sx + lerp(-5.5 * kn, -46, e);
  _rc[1] = lerp(1.5 + 0.3 * (kn - 1), 22, e * e);
  _rc[2] = lerp(8.4 * kn, 74 * far, e);
  _rc[3] = sx;
  _rc[4] = lerp(1.2, 1.4, e);
  _rc[5] = 1.6;
  _rc[6] = 46;
  _rc[7] = 0;
  const k = smooth(0.5, 0.62, p);
  for (let i = 0; i < 8; i++) out[i] = lerp(out[i], _rc[i], k);
}

export function sampleTracks(s: number, out: TrackOut, mobile = false): void {
  sampleKeys(mobile ? CAM_M : CAM, s, out.cam);
  applyExtra(s, out.cam);
  if (s >= c('sv-release') && s < CUT['sv-egypt']) releaseCam(s, out.cam, mobile);
  // scapegoat 的結束鏡頭（poses2 的第二組）就是 scapeCam(p=1)，和後面 afflict 的開始鏡頭接得上
  if (s >= c('scapegoat') && s < c('afflict')) scapeCam(s, out.cam, mobile);
  sampleKeys(MOON_S, s, out.moonS);
  sampleKeys(MOON, s, out.moon);
  sampleKeys(LIGHT, s, out.light);
  sampleKeys(SKYK, s, out.sky);
  out.sun[0] = 0;
  out.sun[1] = -40;
  out.sun[2] = 7;
  out.moonDay = 0;
  if (inSummer(s)) summerSky(s, out);
  else if (inRest(s)) restSky(out);
  else if (s >= c('afflict') - 0.001 && s < CUT['ingathering'] - 0.04) afflictSky(s, out);
  else if (s >= CUT['veil'] && s < c('veil', 1)) {
    // 天剛亮：太陽在畫面左側地平線上升起
    const k = clamp((s - CUT['veil']) / 1.07);
    out.sun[0] = -0.75;
    out.sun[1] = lerp(1, 16, k);
    out.sun[2] = 7;
  }
}

// 各種由 s 推導的單一量 ------------------------------------------------
/** 章配色：回傳 [章 id 甲, 章 id 乙, 插值]，依章的起點切換；有抹除轉場的地方在全蓋時瞬間換 */
const CH_START: Array<[string, number]> = [
  ['opening', 0],
  ['passover', c('dusk-street')],
  ['unleavened', c('bake')],
  ['firstfruits', c('barley-ripe')],
  ['second-passover', c('sinai')],
  ['weeks', c('count')],
  ['summer', c('summer')],
  ['trumpets', c('seventh-moon')],
  ['atonement', c('veil')],
  ['booths', c('ingathering')],
  ['sevens', c('sv-sabbath')],
  ['coda', c('coda-night')],
];
/** 回聲拍的舊紙配色放在配色陣列的最後（index.ts 把 laterPalette 接在 CHAPTER_IDS 之後） */
export const LATER_IDX = CH_START.length;
export const CHAPTER_IDS = CH_START.map((x) => x[0]);
/** cue → 所在章 id（回聲拍屬於被呼應的那一章）；lab 與備用用 */
export const CUE_CHAPTER: Record<string, string> = {};
CUES.forEach((name, i) => {
  let id = CH_START[0][0];
  for (const [cid, st] of CH_START) if (st <= i) id = cid;
  CUE_CHAPTER[name] = id;
});
const _pal = { a: 0, b: 1, k: 0 };
export function paletteAt(s: number): { a: number; b: number; k: number } {
  // 開場→逾越節：平順插值（黃昏漸暗）；其餘章界都有抹除轉場，在全蓋的瞬間換
  if (s < c('dusk-street') + 0.5) {
    _pal.a = 0;
    _pal.b = 1;
    _pal.k = smooth(c('day-14', 0.4), c('dusk-street'), s);
    return _pal;
  }
  let i = 1;
  for (let j = 2; j < CH_START.length; j++) {
    const cut = CUT[CUES[Math.floor(CH_START[j][1])]] ?? CH_START[j][1] - 0.07;
    if (s >= cut) i = j;
  }
  _pal.a = i;
  _pal.b = i;
  _pal.k = 0;
  // 回聲拍：舊紙色（進出都在時間跳躍抹除全蓋的瞬間換）
  if (laterAt(s)) {
    _pal.a = LATER_IDX;
    _pal.b = LATER_IDX;
  }
  // coda：回到開場，配色也用開場的（最後一格要和開場第一個畫面一樣）
  if (s >= CUT['coda-night']) {
    _pal.a = 0;
    _pal.b = 0;
  }
  return _pal;
}
/** 開場→逾越節的配色插值（保留給舊程式；現在用 paletteAt） */
export const palK = (s: number): number => smooth(c('day-14', 0.4), c('dusk-street'), s);

/** 半夜的黑暗：帶狀遮罩從右掃到左，位置 0..1 */
export const midnightP = (s: number): number => clamp(s - c('midnight'), 0, 1);
export const inMidnight = (s: number): boolean => s >= c('midnight') && s < c('midnight') + 1.02;

/** 埃及城的窗：從 wailing 起一扇一扇熄燈（回傳門檻；亮燈 = 窗的隨機值 ≥ 門檻） */
export const windowOff = (s: number): number => smooth(c('midnight', 0.3), c('wailing', 0.35), s) * 1.02;
/** 火炬熄滅 */
export const torchOn = (s: number): number => 1 - smooth(c('wailing', 0.55), c('wailing', 0.9), s);

/** 隊伍位移（公尺，往 -x）：起步與到達用慢速，中間加速 */
export const departDist = (s: number): number => {
  const p = clamp(s - c('depart'), 0, 1);
  const f = 0.3 * p + 0.7 * (p * p * (3 - 2 * p));
  return f * 120;
};
