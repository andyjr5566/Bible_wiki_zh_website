import type { Fact } from './types';

/** 面板「全圖」與「會幕」用的事實，一樣進資料閘門 */
export const TOTAL_FACT: Fact = {
  text: '被數點的共有 603,550 名（二十歲以外、能出去打仗的男丁）',
  status: 'explicit',
  refs: ['民2:32', '民1:45'],
  q: '六十萬零三千五百五十名',
};

export const LEVI_OUT_FACT: Fact = {
  text: '利未人沒有數在以色列人中，是照耶和華所吩咐摩西的',
  status: 'explicit',
  refs: ['民2:33'],
  q: '利未人沒有數在以色列人中',
};

export const OVERVIEW_FACTS: Fact[] = [
  { text: '各歸自己的纛下，在本族的旗號那裡，對著會幕的四圍安營', status: 'explicit', refs: ['民2:2'], q: '各歸自己的纛下，在本族的旗號那裡，對著會幕的四圍安營' },
  { text: '利未營在諸營中間，他們怎樣安營就怎樣往前行', status: 'explicit', refs: ['民2:17'], q: '他們怎樣安營就怎樣往前行' },
];

export const TABERNACLE_FACTS: Fact[] = [
  { text: '以色列人對著會幕的四圍安營', status: 'explicit', refs: ['民2:2'], q: '對著會幕的四圍安營' },
  { text: '利未營在諸營中間', status: 'explicit', refs: ['民2:17'], q: '有利未營在諸營中間' },
  { text: '雲彩遮蓋帳幕，夜間形狀如火', status: 'explicit', refs: ['民9:15-16'], q: '夜間形狀如火' },
  { text: '雲彩在哪裡停住，以色列人就在那裡安營', status: 'explicit', refs: ['民9:17'], q: '雲彩在哪裡停住，以色列人就在那裡安營' },
];

/** 民2、民7、民10 三處的次序 */
export const SAME_ORDER_FACT: Fact = {
  text: '十二個首領的名字和先後，在民2 安營、民7 獻壇禮、民10 起行三處完全相同',
  status: 'synthesis',
  refs: ['民2:3', '民7:12', '民10:14'],
  note: '民2、民10 依猶大、以薩迦、西布倫、流便……排；民7 是每天一位，從第一日排到第十二日。',
};

export const COUNT_FACTS: Fact[] = [
  { text: '民1 與民2 的總數相同：603,550 名', status: 'explicit', refs: ['民1:45', '民2:32'], q: '六十萬零三千五百五十名' },
  { text: '民26 第二次數點的總數：601,730 名', status: 'explicit', refs: ['民26:51'], q: '六十萬零一千七百三十名' },
];

/** 3D「營外的高處」鏡頭配的經文（民23:28、24:2、24:5）；山的位置與高度是示意 */
export const BALAAM_FACTS: Fact[] = [
  { text: '巴勒領巴蘭到下望曠野的毘珥山頂上', status: 'explicit', refs: ['民23:28'], q: '巴勒就領巴蘭到那下望曠野的毘珥山頂上' },
  { text: '巴蘭舉目，看見以色列人照著支派居住', status: 'explicit', refs: ['民24:2'], q: '巴蘭舉目，看見以色列人照著支派居住' },
  { text: '巴蘭說：雅各啊，你的帳棚何等華美！以色列啊，你的帳幕何其華麗！', status: 'explicit', refs: ['民24:5'], q: '雅各啊，你的帳棚何等華美！以色列啊，你的帳幕何其華麗！' },
];

export const PRIEST_TRUMPET_FACT: Fact = {
  text: '吹號的是亞倫子孫作祭司的',
  status: 'explicit',
  refs: ['民10:8'],
  q: '亞倫子孫作祭司的要吹這號',
};
