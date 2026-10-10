// 第三批（七的節奏＋收尾）各 cue 的鏡頭與構圖資料。純資料；tracks.ts 合併進主時間軸。
// 鏡頭欄位：[px, py, pz, tx, ty, tz, fov(垂直度), fitW(目標處至少要容納的水平寬度，公尺)]
// 鏡頭在相鄰 cue 之間是直線移動：同一個地點的相鄰 cue（結束鏡頭 → 下一個開始鏡頭）之間不可有物體，
// 換地點的 cue 都有抹除轉場（見 tracks.ts 的 WIPE_CUES／TJ_IN／TJ_OUT），鏡頭在抹除全蓋時才跳。
import { SVC, SVF, SVH, SVJ, SVL, SVO, SVP, SVR, SVV, SVW } from './layout';
import type { PosePair } from './poses2';

export const POSES3: Record<string, PosePair> = {
  // ---- 一戶人家的院子（房子正面在 z=-6，院子在 z>-6）
  'sv-sabbath': [[SVH + 3.2, 1.5, 10.5, SVH + 0.6, 1.5, 0, 46, 0], [SVH + 2.4, 1.45, 9, SVH + 0.6, 1.5, 0, 46, 0]],
  'sv-ox': [[SVH + 2.6, 1.9, 12.5, SVH + 1.0, 1.0, 0.5, 46, 0], [SVH + 2.0, 1.8, 11, SVH + 1.0, 1.0, 0.5, 46, 0]],
  // 往上看天：漩渦在天上，院子只剩下方一線
  'sv-weeks': [[SVH + 2.0, 1.8, 11, SVH + 1.0, 1.0, 0.5, 46, 0], [SVH + 0.8, 1.5, 13, SVH + 0.8, 8.5, -14, 60, 0]],
  'sv-month7': [[SVH + 0.8, 1.5, 13, SVH + 0.8, 8.5, -14, 60, 0], [SVH + 0.8, 1.5, 13, SVH + 0.8, 10, -14, 62, 0]],
  'sv-release': [[SVH - 3.6, 1.6, 9.4, SVH + 0.6, 1.4, 0.6, 44, 0], [SVH - 2.6, 1.55, 8.4, SVH + 0.6, 1.4, 0.6, 44, 0]],
  // ---- 天地海
  'sv-creation': [[SVC - 2.5, 2.2, 10, SVC - 3, 4.0, -24, 56, 0], [SVC - 2.5, 2.4, 8.5, SVC - 3, 4.2, -24, 56, 0]],
  // ---- 不耕的田、穀堆
  'sv-fallow': [[SVF + 0.5, 1.8, 15, SVF, 1.0, -8, 48, 0], [SVF + 1.5, 1.9, 13, SVF, 1.0, -8, 48, 0]],
  'sv-sixth': [[SVF + 90, 1.8, 16.5, SVF + 90, 1.0, 0, 44, 0], [SVF + 90.4, 1.8, 15, SVF + 90, 1.0, 0, 44, 0]],
  // ---- 住棚節的村子：宣讀律法 → 抬頭看四十九年的漩渦
  'sv-reading': [[SVV, 1.8, 19, SVV, 1.4, -3, 46, 0], [SVV, 1.75, 17, SVV, 1.4, -3, 46, 0]],
  'sv-49': [[SVV, 1.75, 17, SVV, 1.4, -3, 46, 0], [SVV, 1.6, 24, SVV, 11, -30, 60, 0]],
  // ---- 贖罪日的角聲
  'sv-horn': [[SVP, 3.6, 5, SVP, 4.4, -16, 50, 0], [SVP, 3.6, 3.5, SVP, 4.4, -16, 50, 0]],
  // ---- 第五十年
  'sv-liberty': [[SVL - 1, 10, 44, SVL - 1, 1.0, -13, 50, 0], [SVL, 9, 40, SVL - 1, 1.0, -13, 50, 0]],
  // ---- 地是我的：從近景帳棚拉到整片地
  'sv-land': [[SVW - 5, 1.8, 10, SVW - 3.5, 1.3, 0, 44, 0], [SVW, 40, 62, SVW, 0, -42, 56, 0]],
  // 沿用逾越節那一章的埃及街道夜景（dusk-street 的鏡頭）
  'sv-egypt': [[-10, 2.0, 10, 3, 2.2, -1, 52, 0], [-8.4, 1.95, 8.2, 4.2, 2.3, -2, 50, 0]],
  // ---- 回聲拍
  'echo-zedekiah': [[SVJ, 2.2, 17, SVJ, 1.5, -8, 48, 0], [SVJ, 2.2, 15, SVJ, 1.5, -8, 48, 0]],
  'echo-land-rest': [[SVR, 1.9, 17, SVR, 1.5, -8, 48, 0], [SVR + 1.5, 2.2, 14, SVR, 1.5, -8, 48, 0]],
  'echo-oath': [[SVO, 2.4, 21, SVO, 1.6, -6, 46, 0], [SVO, 2.2, 18.5, SVO, 1.6, -6, 46, 0]],
  // ---- 回到開場的第一個畫面（和 title 的開始鏡頭一模一樣）
  'coda-night': [[0, 1.2, 36, 3, 3.3, -15, 56, 0], [0, 1.2, 36, 3, 3.3, -15, 56, 0]],
};

// 手機：個別 cue 用較遠的鏡頭（沿視線往後退的倍數）。
export const MOBILE_POSES3: Record<string, PosePair> = {};
export const MOBILE_K3: Record<string, number> = {
  'sv-sabbath': 1.9,
  'sv-ox': 2.0,
  'sv-weeks': 1.2,
  'sv-month7': 1.2,
  'sv-release': 2.0,
  'sv-creation': 1.9,
  'sv-fallow': 1.7,
  'sv-sixth': 2.0,
  'sv-reading': 1.7,
  'sv-49': 1.2,
  'sv-horn': 1.4,
  'sv-egypt': 1.8,
  'sv-liberty': 1.0,
  'sv-land': 1.0,
  'echo-zedekiah': 1.5,
  'echo-land-rest': 1.5,
  'echo-oath': 1.6,
};

/** 桌機：主體的左右推移（畫面寬度比例；說明框在左→正值）。左右依 ui/beats.ts 的奇偶交替：sv-sabbath 起 左、右、左…… */
const L = 0.2;
const R = -0.22;
export const DX3: Record<string, number[]> = {
  'sv-sabbath': [L], 'sv-creation': [R], 'sv-ox': [L], 'sv-weeks': [0], 'sv-month7': [0], 'sv-fallow': [R], 'sv-sixth': [L], 'sv-release': [R],
  'sv-egypt': [L], 'sv-reading': [R], 'sv-49': [0], 'sv-horn': [R], 'sv-liberty': [L], 'sv-land': [R],
  'echo-zedekiah': [L], 'echo-land-rest': [R], 'echo-oath': [L], 'coda-night': [0],
};
/** 手機：畫面整體往上推的比例（說明框蓋住下半，主體要落在標題列與說明框之間） */
export const UP3: Record<string, number[]> = {
  'sv-sabbath': [0.24], 'sv-creation': [0.22], 'sv-ox': [0.26], 'sv-weeks': [0.26], 'sv-month7': [0.26], 'sv-fallow': [0.26], 'sv-sixth': [0.26],
  'sv-release': [0.26], 'sv-egypt': [0.26], 'sv-reading': [0.26], 'sv-49': [0.26], 'sv-horn': [0.2], 'sv-liberty': [0.22], 'sv-land': [0.27],
  'echo-zedekiah': [0.26], 'echo-land-rest': [0.26], 'echo-oath': [0.26], 'coda-night': [0.1],
};
