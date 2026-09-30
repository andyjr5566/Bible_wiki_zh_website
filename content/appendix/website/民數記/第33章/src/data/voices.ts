import type { Fact, Voice } from './types';

const MAIN = '04 民數記/第33章.md';

/** 兩種分段方式的出處（主檔「本章整理」二） */
export const SEGMENT_VOICES: Record<'ct' | 'gt', Voice[]> = {
  ct: [
    { who: 'CT', says: '分成三段：從出埃及到西乃山十二站、從西乃山到加低斯二十一站、從加低斯到約但河東岸九站', keys: ['從出埃及到西乃山十二站', '從西乃山到加低斯二十一站', '從加低斯到約但河東岸九站'], file: MAIN },
  ],
  gt: [
    { who: 'GT《民數記串珠聖經註釋》', says: '排成六程、每程七站', quote: '四十二為七的倍數', file: MAIN },
    { who: 'GT《民數記串珠聖經註釋》', says: '數字上的對應不似巧合，而有象徵的意義', quote: '這些都不似巧合，而是在數字上有象徵的意義。', file: MAIN },
  ],
};

/**
 * GT 串珠指出的數字對應（依「蘭塞是第 1 站」計算）。
 * 這是 GT 的讀法，屬註釋解讀；站號由主檔的表格與段落逐項對出。
 */
export interface Pattern {
  id: string;
  label: string;
  text: string;
  stations: number[];
  /** 主檔裡必須出現的關鍵詞 */
  keys: string[];
}

export const GT_PATTERNS: Pattern[] = [
  { id: 'firsts', label: '出埃及・過海・律法', text: '第 1 站神領以色列民出埃及；第 7 站過紅海；第 12 站（西乃山）頒發律法', stations: [1, 7, 12], keys: ['神領以色列民出埃及', '過紅海', '頒發律法'] },
  { id: 'water', label: '第五站：供水', text: '第一程與第五程的第五站，都是神供水的地方：瑪拉與加低斯', stations: [5, 33], keys: ['神供水的地方（瑪拉與加低斯）'] },
  { id: 'deaths', label: '第六站：死亡', text: '第四、五、六程的第六站，都是亞倫和摩西死的地方', stations: [27, 34, 41], keys: ['亞倫和摩西死的地方'] },
  { id: 'wonders', label: '神蹟奇事', text: '第一程與第二程各站的事完全類同：第 1 與第 8 站都是神蹟奇事', stations: [1, 8], keys: ['第一站與第八站都是神蹟奇事'] },
  { id: 'battles', label: '爭戰得勝', text: '第 4 與第 11 站都是爭戰得勝', stations: [4, 11], keys: ['第四站與第十一站都是爭戰得勝'] },
  { id: 'supply', label: '水和食物', text: '第 6 與第 13 站都是供應水和食物', stations: [6, 13], keys: ['第六站與第十三站都是供應水和食物'] },
];

/** 總覽卡：這份清單的來歷、起點、終點 */
export const OVERVIEW_FACTS: Fact[] = [
  { text: '這份路程是摩西遵著耶和華的吩咐記載的', status: 'explicit', refs: ['民33:2'], q: '摩西遵著耶和華的吩咐記載他們所行的路程' },
  { text: '從蘭塞出發，是正月十五日，逾越節的次日', status: 'explicit', refs: ['民33:3'], q: '正月十五日，就是逾越節的次日' },
  { text: '亞倫死在出埃及後第四十年五月初一日', status: 'explicit', refs: ['民33:38'], q: '以色列人出了埃及地後四十年，五月初一日' },
  { text: '最後一站是摩押平原，在約但河邊、耶利哥對面', status: 'explicit', refs: ['民33:48'], q: '安營在摩押平原' },
];

/** 民33:50-56：過河之前的吩咐 */
export const CROSSING_FACTS: Fact[] = [
  { text: '耶和華在摩押平原、約但河邊、耶利哥對面曉諭摩西', status: 'explicit', refs: ['民33:50'], q: '曉諭摩西說' },
  { text: '你們過約但河進迦南地的時候', status: 'explicit', refs: ['民33:51'], q: '你吩咐以色列人說：你們過約但河進迦南地的時候' },
  { text: '三道命令：趕出居民、毀滅偶像、拆毀邱壇', status: 'explicit', refs: ['民33:52'], q: '就要從你們面前趕出那裡所有的居民，毀滅他們一切鏨成的石像和他們一切鑄成的偶像，又拆毀他們一切的邱壇' },
  { text: '奪那地、住在其中，因為神把那地賜給他們為業', status: 'explicit', refs: ['民33:53'], q: '你們要奪那地，住在其中，因我把那地賜給你們為業' },
  { text: '按家室拈鬮，人多的多分，人少的少分', status: 'explicit', refs: ['民33:54'], q: '你們要按家室拈鬮，承受那地；人多的，要把產業多分給他們；人少的，要把產業少分給他們' },
  { text: '不趕出居民，所容留的就必作眼中的刺、肋下的荊棘', status: 'explicit', refs: ['民33:55'], q: '所容留的居民就必作你們眼中的刺，肋下的荊棘' },
  { text: '神素常有意怎樣待他們，也必照樣待你們', status: 'explicit', refs: ['民33:56'], q: '我素常有意怎樣待他們，也必照樣待你們' },
  { text: '約書亞清早離開什亭，來到約但河，等候過河（下一步）', status: 'explicit', refs: ['書3:1'], q: '就住在那裡，等候過河' },
];

export const CROSSING_VOICES: Voice[] = [
  { who: 'CT', says: '分配土地的三個原則', keys: ['以家室為單位', '按照拈鬮結果', '土地大小依據人數多少'], file: MAIN },
  { who: 'CT', says: '拈鬮和「人多多得」之間有張力，但神這樣定規', quote: '拈鬮的方法是很難達成人多就多得，人少就少得的要求的，但神定規了這樣作。', file: MAIN },
  { who: 'CT', says: '兩個「刺」的意思', quote: '『眼中的刺』形容令人難受；『肋下的荊棘』形容無法動彈，寢食難安', file: MAIN },
  { who: 'GT 丁良才', says: '第56節顯明神不偏待人', quote: '顯明神不偏待人', file: MAIN },
];
