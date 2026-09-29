import type { CampId, ClanId, Fact, Ref } from './types';
import type { SignalId } from './trumpets';

/**
 * 兩種行軍次序：
 * - 民2：安營時「第一隊、第二隊……」，會幕與利未營插在流便營之後（v17）
 * - 民10：實際上路。利未人分成兩批：革順與米拉利抬帳幕先走，哥轄抬聖物在流便營之後
 */
export type MarchMode = 'num10' | 'num2';

export interface MarchStep {
  key: string;
  /** 這一步出發的是哪些營／族 */
  camps?: CampId[];
  clans?: ClanId[];
  /** 會幕本身（民2:17 把會幕當成一個單位） */
  tabernacle?: boolean;
  label: string;
  /** 帶著什麼 */
  carries?: string;
  ref: Ref;
  q: string;
  status: 'explicit' | 'synthesis';
  signal?: SignalId;
  note?: string;
}

/** 起點：什麼時候拔營 */
export const TRIGGER: Fact[] = [
  { text: '雲彩幾時從帳幕收上去，以色列人就幾時起行', status: 'explicit', refs: ['民9:17'], q: '雲彩幾時從帳幕收上去，以色列人就幾時起行' },
  { text: '第二年二月二十日，雲彩從法櫃的帳幕收上去，以色列人初次往前行', status: 'explicit', refs: ['民10:11-13'], q: '第二年二月二十日，雲彩從法櫃的帳幕收上去' },
  { text: '雲彩在夜間形狀如火', status: 'explicit', refs: ['民9:15-16'], q: '夜間形狀如火' },
  { text: '雲彩在帳幕上停留多久，他們就住營多久', status: 'explicit', refs: ['民9:18'], q: '雲彩在帳幕上停住幾時，他們就住營幾時' },
  { text: '安營、起行都是遵耶和華的吩咐', status: 'explicit', refs: ['民9:23'], q: '他們遵耶和華的吩咐安營，也遵耶和華的吩咐起行' },
];

/** 民10:35-36：約櫃往前行、停住的時候，摩西說的話 */
export const ARK_WORDS: Fact[] = [
  { text: '約櫃往前行的時候，摩西說', status: 'explicit', refs: ['民10:35'], q: '耶和華啊，求你興起！願你的仇敵四散！願恨你的人從你面前逃跑！' },
  { text: '約櫃停住的時候，他說', status: 'explicit', refs: ['民10:36'], q: '耶和華啊，求你回到以色列的千萬人中！' },
];

export const MARCH_NUM10: MarchStep[] = [
  { key: 'judah', camps: ['judah'], label: '猶大營（猶大、以薩迦、西布倫）', carries: '猶大營的纛', ref: '民10:14-16', q: '按著軍隊首先往前行的是猶大營的纛', status: 'explicit', signal: 'alarm1' },
  { key: 'gershon-merari', clans: ['gershon', 'merari'], label: '革順與米拉利的子孫', carries: '拆卸下來的帳幕', ref: '民10:17', q: '革順的子孫和米拉利的子孫就抬著帳幕先往前行', status: 'explicit' },
  { key: 'reuben', camps: ['reuben'], label: '流便營（流便、西緬、迦得）', carries: '流便營的纛', ref: '民10:18-20', q: '按著軍隊往前行的是流便營的纛', status: 'synthesis', signal: 'alarm2', note: '順序是照經文敘述的先後排的。號聲對應見民10:6。' },
  { key: 'kohath', clans: ['kohath'], label: '哥轄人', carries: '聖物', ref: '民10:21', q: '哥轄人抬著聖物先往前行', status: 'synthesis', note: '他們未到以前，抬帳幕的已經把帳幕支好（民10:21）。' },
  { key: 'ephraim', camps: ['ephraim'], label: '以法蓮營（以法蓮、瑪拿西、便雅憫）', carries: '以法蓮營的纛', ref: '民10:22-24', q: '按著軍隊往前行的是以法蓮營的纛', status: 'synthesis' },
  { key: 'dan', camps: ['dan'], label: '但營（但、亞設、拿弗他利）', carries: '但營的纛，殿後', ref: '民10:25-27', q: '在諸營末後的是但營的纛', status: 'explicit' },
];

export const MARCH_NUM2: MarchStep[] = [
  { key: 'judah', camps: ['judah'], label: '猶大營', ref: '民2:9', q: '要作第一隊往前行', status: 'explicit' },
  { key: 'reuben', camps: ['reuben'], label: '流便營', ref: '民2:16', q: '要作第二隊往前行', status: 'explicit' },
  { key: 'tabernacle', tabernacle: true, clans: ['gershon', 'kohath', 'merari'], label: '會幕與利未營', carries: '會幕', ref: '民2:17', q: '會幕要往前行，有利未營在諸營中間', status: 'explicit' },
  { key: 'ephraim', camps: ['ephraim'], label: '以法蓮營', ref: '民2:24', q: '要作第三隊往前行', status: 'explicit' },
  { key: 'dan', camps: ['dan'], label: '但營', ref: '民2:31', q: '要歸本纛作末隊往前行', status: 'explicit' },
];

export const MARCHES: Record<MarchMode, { title: string; blurb: string; steps: MarchStep[] }> = {
  num10: {
    title: '民10 實際上路的行列',
    blurb: '第二年二月二十日雲彩收上去，以色列人初次起行。利未人分成兩批，插在營與營之間。',
    steps: MARCH_NUM10,
  },
  num2: {
    title: '民2 安營時的次序',
    blurb: '民2 宣告「第一隊、第二隊、第三隊、末隊」，並說會幕與利未營在諸營中間（v17）。',
    steps: MARCH_NUM2,
  },
};

/** 民2:34、民10:28 的結語 */
export const MARCH_END: Fact[] = [
  { text: '以色列人這樣安營起行，都是照耶和華所吩咐摩西的', status: 'explicit', refs: ['民2:34'], q: '都是照耶和華所吩咐摩西的' },
  { text: '以色列人按著軍隊往前行，就是這樣', status: 'explicit', refs: ['民10:28'], q: '以色列人按著軍隊往前行，就是這樣' },
];

/** 民2 與民10 差在哪裡（綜合整理，兩邊經文都可對） */
export const MARCH_DIFF: Fact[] = [
  { text: '民2:17 把「會幕」放在流便營之後、以法蓮營之前；民10:17 卻是帳幕先行，跟在猶大營後面', status: 'synthesis', refs: ['民2:17', '民10:17'] },
  { text: '民10 把利未人分成兩批：革順、米拉利抬帳幕，哥轄抬聖物；哥轄在流便營後面', status: 'synthesis', refs: ['民10:17', '民10:21'] },
];
