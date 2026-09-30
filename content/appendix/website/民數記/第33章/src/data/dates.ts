import type { Ref, Status } from './types';

/**
 * 經文給的日期錨點。時間軸以「從正月十五日出埃及起算，過了幾個月」定位（30 天一個月，一年 12 個月）。
 * 換算是示意：經文沒寫每個月幾天，也沒寫每站停幾天。
 */
export interface DateAnchor {
  /** 這個日期落在哪一站；none 代表在兩站之間 */
  st: number;
  label: string;
  /** 從出埃及（第一年正月十五日）起算的月數 */
  months: number;
  ref: Ref;
  q: string;
  status: Status;
  note?: string;
}

/** 出埃及後第 y 年 m 月 d 日 → 起算月數（出埃及那天是第一年正月十五日） */
export const monthsSince = (y: number, m: number, d: number) => (y - 1) * 12 + (m - 1) + (d - 15) / 30;

export const DATES: DateAnchor[] = [
  { st: 1, label: '第一年正月十五日，出蘭塞', months: 0, ref: '民33:3', q: '正月十五日，就是逾越節的次日', status: 'explicit' },
  { st: 8, label: '出埃及後第二個月十五日，到汛的曠野', months: monthsSince(1, 2, 15), ref: '出16:1', q: '在出埃及後第二個月十五日到了以琳和西乃中間、汛的曠野', status: 'explicit' },
  {
    st: 12, label: '出埃及後滿三個月，到西乃的曠野', months: 3, ref: '出19:1', q: '滿了三個月的那一天，就來到西乃的曠野', status: 'explicit',
    note: '「滿了三個月的那一天」是哪一天，各家算法不同；這裡取整整三個月。',
  },
  { st: 12, label: '第二年正月初一日，帳幕立起來', months: monthsSince(2, 1, 1), ref: '出40:17', q: '第二年正月初一日，帳幕就立起來', status: 'explicit' },
  { st: 12, label: '第二年二月初一日，在西乃曉諭摩西（民數記開頭）', months: monthsSince(2, 2, 1), ref: '民1:1', q: '第二年二月初一日，耶和華在西乃的曠野、會幕中曉諭摩西說', status: 'explicit' },
  { st: 12, label: '第二年二月二十日，雲彩收上去，離開西乃', months: monthsSince(2, 2, 20), ref: '民10:11', q: '第二年二月二十日，雲彩從法櫃的帳幕收上去', status: 'explicit' },
  {
    st: 33, label: '正月間，全會眾到了加低斯（哪一年沒寫）', months: monthsSince(40, 1, 15), ref: '民20:1', q: '正月間，以色列全會眾到了尋的曠野，就住在加低斯', status: 'interpretation',
    note: '民20:1 沒有寫年份。知識庫讀成第四十年，是因為五個月後亞倫死在第四十年（民33:38）；這裡放在第四十年正月，是這個讀法，不是經文寫的。',
  },
  { st: 34, label: '第四十年五月初一日，亞倫死在何珥山', months: monthsSince(40, 5, 1), ref: '民33:38', q: '以色列人出了埃及地後四十年，五月初一日', status: 'explicit' },
  { st: 42, label: '第四十年十一月初一日，摩西向以色列人曉諭', months: monthsSince(40, 11, 1), ref: '申1:3', q: '出埃及第四十年十一月初一日', status: 'explicit' },
];

/** 期間的說法（不是日期） */
export const SPANS = [
  { label: '從離開加低斯巴尼亞到過撒烈溪，共三十八年', ref: '申2:14', q: '共有三十八年', from: 12, to: 34 },
  { label: '飄流四十年', ref: '民14:33', q: '你們的兒女必在曠野飄流四十年', from: 15, to: 34 },
  { label: '從何烈山經過西珥山到加低斯巴尼亞有十一天的路程', ref: '申1:2', q: '有十一天的路程', from: 12, to: 33 },
] as const;

export const yearsOf = (months: number) => months / 12;

/**
 * 每一站抵達的時間（起算月數）。只有幾站有經文給的日期，其餘在兩個日期之間平均分配——
 * 特別是第 13–32 站，經文沒寫每站停多久，平均分配只是為了畫圖，不是史實。
 */
const KEYS: [station: number, months: number][] = [
  [1, 0],
  [8, monthsSince(1, 2, 15)],
  [12, 3],
  [13, monthsSince(2, 2, 20) + 0.1], // 離開西乃後三天內到第一站
  [33, monthsSince(40, 1, 15)],
  [34, monthsSince(40, 5, 1)],
  [42, monthsSince(40, 11, 1)],
];

export function stationMonths(n: number): number {
  for (let i = 1; i < KEYS.length; i++) {
    const [a, ma] = KEYS[i - 1];
    const [b, mb] = KEYS[i];
    if (n <= b) return ma + ((mb - ma) * (n - a)) / (b - a);
  }
  return KEYS[KEYS.length - 1][1];
}

/** 這一站的時間是經文直接給的，還是平均分配出來的 */
export const TIMED_EXACT = new Set([1, 8, 12, 34, 42]);

export const TOTAL_MONTHS = monthsSince(40, 11, 1);

/** 白話的時間：「第 3 個月」「第 2 年 5 月」「第 39 年」 */
export function timeLabel(months: number): string {
  if (months < 1) return `出埃及後 ${Math.max(0, Math.round(months * 30))} 天`;
  if (months < 12) return `出埃及後約 ${Math.round(months)} 個月`;
  const y = months / 12;
  return `出埃及後約 ${y.toFixed(y < 10 ? 1 : 0)} 年`;
}
