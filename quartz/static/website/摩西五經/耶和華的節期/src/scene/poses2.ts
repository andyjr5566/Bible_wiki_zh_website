// 第二批（秋季＋舊約回聲）各 cue 的鏡頭與構圖資料。純資料；tracks.ts 合併進主時間軸。
// 鏡頭欄位：[px, py, pz, tx, ty, tz, fov(垂直度), fitW(目標處至少要容納的水平寬度，公尺)]
import { BLX, CX, CZ, GTX, GX, JRX, JX, NX, RX, WX } from './layout';

export type Pose = [number, number, number, number, number, number, number, number];
export type PosePair = [Pose, Pose];
export type X3 = [number, number, number];

/** 西乃營地群組（會幕院子）的座標 → 世界座標 */
const C = (x: number, z: number): [number, number] => [NX + CX + x, CZ + z];

const _g = C(0, 0);
void _g;

export const POSES2: Record<string, PosePair> = {
  // ---- 舊約回聲（章尾）
  'echo-gilgal': [[GX + 2.5, 1.5, 6.5, GX, 1.0, -2, 46, 0], [GX - 2.5, 1.5, 6, GX, 1.0, -2, 46, 0]],
  'echo-hezekiah': [[JX - 3, 2.0, 14, JX, 1.6, -6, 44, 0], [JX + 2, 2.2, 12, JX, 1.6, -5, 44, 0]],
  'echo-ruth': [[RX + 1, 1.3, 6.5, RX - 2, 0.8, -1, 44, 0], [RX + 14, 1.3, 6.5, RX + 11, 0.8, -1, 44, 0]],
  'echo-water-gate': [[GTX, 2.8, 17, GTX, 2.9, -8, 46, 0], [GTX, 3.0, 13, GTX, 3.1, -8, 46, 0]],
  'echo-roofs': [[JRX - 2, 3.2, 16, JRX, 2.8, -8, 50, 0], [JRX + 2, 4, 13, JRX, 3, -8, 50, 0]],
  // ---- 夏日過場
  summer: [[WX + 13, 1.2, 6.5, WX + 16, 4.0, -2, 58, 0], [WX + 16, 1.4, 6, WX + 17, 4.2, -2, 58, 0]],
  // ---- 吹角節（曠野的會幕營地；院子門口在世界座標 (NX-6, -28.5)）
  'seventh-moon': [[NX - 10, 1.5, -2, NX - 6, 2.4, -30, 54, 0], [NX - 8, 1.5, -5, NX - 6, 2.4, -30, 54, 0]],
  blow: [[NX - 5.7, 1.7, -4, NX - 6, 2.0, -30, 50, 0], [NX - 6, 1.7, -6.5, NX - 6, 2.0, -30, 50, 0]],
  'trumpet-offerings': [[NX - 9, 3.2, -24, NX - 12, 0.9, -32.7, 50, 0], [NX - 8, 3.0, -25, NX - 11, 0.9, -32.7, 50, 0]],
  // ---- 贖罪日（會幕院子中心在 (NX-6, -36)）
  // 結尾停在會幕門口外（門在 z≈-34）往裡看：轉到 linen 時鏡頭從門口出來，不穿過側牆
  veil: [[NX - 7.4, 1.6, -12, NX - 6.6, 1.6, -34, 58, 0], [NX - 6.2, 1.5, -33.6, NX - 6, 1.4, -40, 62, 0]],
  linen: [[NX + 2, 1.9, -32.8, NX - 3.8, 1.0, -32.1, 44, 0], [NX + 1.5, 1.8, -32.2, NX - 3.8, 1.05, -32.1, 44, 0]],
  // 跟 linen 同一側（東邊往西看），鏡頭不必穿過羊群
  lots: [[NX + 1.2, 2.0, -29.4, NX - 5.8, 0.8, -31.8, 50, 0], [NX + 0.6, 2.0, -29.6, NX - 5.8, 0.8, -31.8, 50, 0]],
  incense: [[NX - 6.75, 1.45, -39.85, NX - 5.8, 0.85, -43, 62, 0], [NX - 6.8, 1.4, -40, NX - 5.9, 0.9, -43.2, 60, 0]],
  sprinkle: [[NX - 6.75, 1.6, -39.9, NX - 5.9, 0.45, -42.4, 58, 0], [NX - 6.7, 1.55, -40, NX - 5.9, 0.4, -42.6, 56, 0]],
  confess: [[NX - 1.2, 1.7, -29.2, NX - 6.6, 0.9, -32, 46, 0], [NX - 2, 1.6, -29.6, NX - 6.6, 0.9, -32, 44, 0]],
  scapegoat: [[NX - 3, 1.8, -17, NX - 6.5, 1.0, -22, 50, 0], [NX - 102, 30, 114, NX - 106, 1.5, -11, 60, 0]],
  afflict: [[NX - 4.5, 1.5, 0.5, NX - 6, 1.2, -18, 56, 0], [NX - 4, 2.2, 2.5, NX - 6, 1.3, -18, 56, 0]],
  // ---- 住棚節
  ingathering: [[BLX - 9, 1.7, 9.5, BLX - 13, 1.8, -4, 50, 0], [BLX - 6, 1.8, 8, BLX - 10, 1.6, -4, 50, 0]],
  branches: [[BLX, 1.6, 10.5, BLX, 0.9, 3.4, 44, 0], [BLX + 1, 1.5, 9.5, BLX, 0.9, 3.4, 44, 0]],
  booth: [[BLX - 2, 2.2, 15, BLX - 2, 1.4, -6, 50, 0], [BLX - 3, 2.0, 12, BLX - 3, 1.4, -6, 50, 0]],
  bulls: [[BLX - 3, 2.2, 21, BLX - 3, 1.0, 2, 50, 0], [BLX - 1, 2.6, 19, BLX - 3, 1.0, 2, 50, 0]],
  'booths-rejoice': [[BLX + 1, 1.6, 13, BLX + 1, 1.1, 3.5, 44, 0], [BLX + 2, 1.7, 12, BLX + 1, 1.1, 3.5, 44, 0]],
  'eighth-day': [[BLX, 2.6, 18, BLX, 1.2, 4, 50, 0], [BLX, 3.4, 16, BLX, 1.2, 4, 50, 0]],
};

export const MOBILE_POSES2: Record<string, PosePair> = {
  // 手機：說明框蓋住下半，主體要落在標題列與說明框之間的一條帶子裡，所以鏡頭拉低、拉近、視野放寬
  afflict: [[NX - 3, 1.7, 2, NX - 7, 0.9, -12, 62, 0], [NX - 2.6, 1.9, 3, NX - 7, 0.9, -12, 62, 0]],
  ingathering: [[BLX - 11, 1.6, 10, BLX - 14, 1.1, -11, 56, 0], [BLX - 10, 1.7, 9, BLX - 13, 1.1, -11, 56, 0]],
};
/** 手機：沿視線往後退的倍數（直式畫面水平視野窄，主體才進得了框） */
export const MOBILE_K2: Record<string, number> = {
  'echo-gilgal': 2.05,
  'echo-hezekiah': 1.65,
  'echo-ruth': 2.1,
  'echo-water-gate': 1.5,
  'echo-roofs': 1.4,
  'second-month': 2.6,
  summer: 1.3,
  'seventh-moon': 1.3,
  blow: 1.3,
  'trumpet-offerings': 1.5,
  linen: 1.6,
  lots: 1.3,
  confess: 1.6,
  branches: 1.6,
  booth: 1.5,
  bulls: 1.2,
  'booths-rejoice': 1.8,
  'eighth-day': 1.4,
};
export const XS2: Record<string, X3> = {};
export const XEND2: Record<string, X3> = {};
/** 桌機構圖的水平推移（畫面寬度比例，正值＝往右）：說明框在左的拍把主體推向右，反之亦然（說明框左右依 ui/beats.ts 的奇偶交替） */
const L = 0.2;
const R = -0.22;
export const DX2: Record<string, number[]> = {
  'echo-gilgal': [L], 'echo-hezekiah': [R], 'echo-ruth': [R], summer: [0],
  'seventh-moon': [R], blow: [L], 'trumpet-offerings': [R], 'echo-water-gate': [L],
  veil: [R], linen: [L], lots: [R], incense: [L], sprinkle: [R], confess: [L], scapegoat: [R], afflict: [L],
  ingathering: [R], branches: [L], booth: [R], bulls: [0], 'booths-rejoice': [R], 'eighth-day': [L], 'echo-roofs': [R],
};
/** 手機：畫面整體往上推的比例（說明框蓋住下半） */
export const UP2: Record<string, number[]> = {
  'echo-gilgal': [0.29], 'echo-hezekiah': [0.27], 'echo-ruth': [0.28], summer: [0.04],
  'seventh-moon': [0.17], blow: [0.17], 'trumpet-offerings': [0.2], 'echo-water-gate': [0.254],
  veil: [0.12], linen: [0.17], lots: [0.17], incense: [0.14], sprinkle: [0.27], confess: [0.17], scapegoat: [0.15], afflict: [0.3],
  ingathering: [0.1], branches: [0.18], booth: [0.2], bulls: [0.3], 'booths-rejoice': [0.2], 'eighth-day': [0.287], 'echo-roofs': [0.3], 'second-month': [0.23], 'seven-days': [0.29],
};
