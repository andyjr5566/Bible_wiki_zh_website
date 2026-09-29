import { CAMPS, tribesOf } from './data/tribes';
import type { CampId, ClanId, Side, TribeId } from './data/types';

/**
 * 營地示意圖的座標（未按比例）。SVG 與 3D 共用這一份，所以兩邊的位置一致。
 * 橫式：東在右、西在左、北在上。單位是「地圖像素」，3D 用 WORLD_SCALE 換成場景單位。
 *
 * 每一面三個支派的先後：經文沒寫（民2 只說「挨著他」「又有」），這裡依 GT 所說
 * 「最自然的次序是順時鐘方向」排：領頭支派先，依序順時鐘。這是示意，不是經文。
 */
export const W = 828;
export const H = 548;
export const BW = 156;
export const BH = 100;
export const GAP = 10;
export const CX = W / 2;
export const CY = H / 2;

export interface Rect { x: number; y: number; w: number; h: number }
export const center = (r: Rect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

const armSpan = 3 * BW + 2 * GAP; // 東西向排三塊的總長
const armTall = 3 * BH + 2 * GAP; // 南北向排三塊的總長

function blockRect(side: Side, i: number): Rect {
  switch (side) {
    case 'north': return { x: CX - armSpan / 2 + i * (BW + GAP), y: 0, w: BW, h: BH };
    case 'south': return { x: CX + armSpan / 2 - BW - i * (BW + GAP), y: H - BH, w: BW, h: BH };
    case 'east': return { x: W - BW, y: CY - armTall / 2 + i * (BH + GAP), w: BW, h: BH };
    case 'west': return { x: 0, y: CY + armTall / 2 - BH - i * (BH + GAP), w: BW, h: BH };
  }
}

export const TRIBE_RECT = {} as Record<TribeId, Rect>;
export const CAMP_RECT = {} as Record<CampId, Rect>;
for (const c of CAMPS) {
  const rects = tribesOf(c.id).map((t, i) => {
    const r = blockRect(c.side, i);
    TRIBE_RECT[t.id] = r;
    return r;
  });
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  CAMP_RECT[c.id] = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** 院子：100×50 肘，示意成 140×70，門朝東 */
export const COURT: Rect = { x: CX - 70, y: CY - 35, w: 140, h: 70 };

export const CLAN_RECT: Record<ClanId, Rect> = {
  priests: { x: COURT.x + COURT.w + 12, y: CY - 30, w: 70, h: 60 },
  gershon: { x: COURT.x - 12 - 70, y: CY - 30, w: 70, h: 60 },
  merari: { x: COURT.x, y: COURT.y - 12 - 48, w: COURT.w, h: 48 },
  kohath: { x: COURT.x, y: COURT.y + COURT.h + 12, w: COURT.w, h: 48 },
};

/** 各營的纛：立在領頭支派靠會幕那一側 */
export const BANNER_POS: Record<CampId, { x: number; y: number }> = {
  judah: { x: 658, y: 118 },
  reuben: { x: 508, y: 444 },
  ephraim: { x: 166, y: 338 },
  dan: { x: 174, y: 108 },
};

/** 一頂帳棚代表約一千名被數點的男丁（示意） */
export const PEOPLE_PER_TENT = 1000;
export const tentsFor = (n: number) => Math.max(1, Math.round(n / PEOPLE_PER_TENT));
export const TENT_COLS = 15;

/** 3D：地圖像素 → 場景單位；地圖中心是原點，北是 −z，東是 +x */
export const WORLD_SCALE = 0.9;
export const toWorld = (x: number, y: number): [number, number] => [(x - CX) * WORLD_SCALE, (y - CY) * WORLD_SCALE];

export const SIDE_VEC: Record<Side, [number, number]> = { east: [1, 0], south: [0, 1], west: [-1, 0], north: [0, -1] };
