import type { Ref, Voice } from './types';

/**
 * 同一段路，三處經文的站名不同（次序也不盡同）。
 * 每個名字都必須出現在所引經節（閘門檢查）。`same` 標出「大家都認為是同一個地方」的對應。
 */
export interface CmpItem {
  name: string;
  ref: Ref;
  q: string;
  /** 同一組 same 代表同一個地方 */
  same?: string;
  /** 為什麼算同一個：identical＝名字相同；CT＝CT 的讀法 */
  via?: 'identical' | 'CT';
}

const CT_RAW = 'raw_data/ccbiblestudy_CT_numbers_33.txt';
const DISPUTE = 'link_folder/解經爭議/民21 與民33 的站名為何不同.md';
const FHL = 'appendix/fhl_maps/maps/024.md';

/** 表一：從何珥山到摩押平原（民33:37-49 對民20:22–22:1） */
export const COMPARE_A = {
  title: '從何珥山到摩押平原',
  left: {
    label: '民33 的清單',
    items: [
      { name: '何珥山', ref: '民33:37', q: '安營在何珥山', same: 'hor', via: 'identical' },
      { name: '撒摩拿', ref: '民33:41', q: '安營在撒摩拿' },
      { name: '普嫩', ref: '民33:42', q: '安營在普嫩' },
      { name: '阿伯', ref: '民33:43', q: '安營在阿伯', same: 'oboth', via: 'identical' },
      { name: '以耶亞巴琳', ref: '民33:44', q: '安營在以耶亞巴琳', same: 'iye', via: 'identical' },
      { name: '底本迦得', ref: '民33:45', q: '安營在底本迦得' },
      { name: '亞門低比拉太音', ref: '民33:46', q: '安營在亞門低比拉太音' },
      { name: '亞巴琳山', ref: '民33:47', q: '安營在尼波對面的亞巴琳山裡' },
      { name: '摩押平原', ref: '民33:48', q: '安營在摩押平原', same: 'moab', via: 'identical' },
    ] satisfies CmpItem[],
  },
  right: {
    label: '民20–22 的記載',
    items: [
      { name: '何珥山', ref: '民20:22', q: '到了何珥山', same: 'hor', via: 'identical' },
      { name: '阿伯', ref: '民21:10', q: '安營在阿伯', same: 'oboth', via: 'identical' },
      { name: '以耶亞巴琳', ref: '民21:11', q: '安營在以耶亞巴琳', same: 'iye', via: 'identical' },
      { name: '撒烈谷', ref: '民21:12', q: '安營在撒烈谷' },
      { name: '亞嫩河那邊', ref: '民21:13', q: '安營在亞嫩河那邊' },
      { name: '比珥', ref: '民21:16', q: '到了比珥' },
      { name: '瑪他拿', ref: '民21:18', q: '往瑪他拿去' },
      { name: '拿哈列', ref: '民21:19', q: '從瑪他拿到拿哈列' },
      { name: '巴末', ref: '民21:19', q: '從拿哈列到巴末' },
      { name: '毘斯迦的山頂', ref: '民21:20', q: '又到那下望曠野之毘斯迦的山頂' },
      { name: '摩押平原', ref: '民22:1', q: '在摩押平原、約但河東，對著耶利哥安營', same: 'moab', via: 'identical' },
    ] satisfies CmpItem[],
  },
  voices: [
    { who: 'FHL〈民圖五〉', says: '民20–21 說「從何珥山起行，要繞過以東地」，兩者不盡相符', quote: '除進行的方向都是往什亭而去之外，站口的名稱全不相同，而且還多記了從希實本往北征服亞摩利王西宏和巴珊王噩的戰爭紀事', file: FHL, plain: true },
    { who: 'GT 丁良才', says: '民33 從以耶亞巴琳到摩押平原只有四站，民21 記了八站，也許只記重要的站口', quote: '本章從以耶亞巴琳到摩押平原，只記有四站，二十一11-20節卻記八站，或者只記重要的站口。', file: DISPUTE },
  ] satisfies Voice[],
};

/** 表二：從摩西錄到約巴他（民33:30-33 對申10:6-7），次序相反 */
export const COMPARE_B = {
  title: '從摩西錄到約巴他',
  left: {
    label: '民33:30-33',
    items: [
      { name: '摩西錄', ref: '民33:30', q: '安營在摩西錄', same: 'moseroth', via: 'CT' },
      { name: '比尼亞干', ref: '民33:31', q: '安營在比尼亞干', same: 'jaakan', via: 'CT' },
      { name: '曷哈及甲', ref: '民33:32', q: '安營在曷哈及甲', same: 'gidgad', via: 'CT' },
      { name: '約巴他', ref: '民33:33', q: '安營在約巴他', same: 'jotbathah', via: 'identical' },
    ] satisfies CmpItem[],
  },
  right: {
    label: '申10:6-7',
    items: [
      { name: '比羅比尼亞干', ref: '申10:6', q: '從比羅比尼亞干', same: 'jaakan', via: 'CT' },
      { name: '摩西拉', ref: '申10:6', q: '到了摩西拉', same: 'moseroth', via: 'CT' },
      { name: '谷歌大', ref: '申10:7', q: '到了谷歌大', same: 'gidgad', via: 'CT' },
      { name: '約巴他', ref: '申10:7', q: '到了有溪水之地的約巴他', same: 'jotbathah', via: 'identical' },
    ] satisfies CmpItem[],
  },
  voices: [
    { who: 'CT', says: '摩西錄就是摩西拉，亞倫死在那裡', quote: '聖經學者認為摩西錄(複數詞)就是單數詞的摩西拉(參申十6)。亞倫的死亡和埋葬，以及以利亞撒的接任發生在那裡。', file: CT_RAW, plain: true },
    { who: 'CT', says: '比尼亞干又名比羅比尼亞干；申命記的記載剛好相反', quote: '『比尼亞干(Benejaakan)』第二十八站，又名比羅比尼亞干或亞干井，《申命記》的記載剛好相反', file: CT_RAW, plain: true },
    { who: 'CT', says: '曷哈及甲又名谷歌大', quote: '『曷哈及甲(Horhagidgad)』第二十九站，又名谷歌大(參申十7)', file: CT_RAW, plain: true },
    { who: 'GT 丁良才', says: '次序不同，也許因為申10:7 說的是第四十年從北向南走的時候', quote: '本節之名字的次序，和申十7節之名字的次序不同，或者是因申十7節論以色列人出埃及地後第四十年，從北向南行的那個時候。', file: DISPUTE },
  ] satisfies Voice[],
};

/** 為什麼名字對不上：GT 丁良才的三種緣故，與賈斯樂郝威的七點（主檔有轉述） */
export const WHY_DIFFERENT: Voice[] = [
  { who: 'GT 丁良才', says: '本章的名字和別處的名字有時不同，有三種緣故：以色列人自己起的名字、依地形或小村莊起的名字、有時同時在兩處安營', quote: '本章的名字和別處的名字有時不同，有幾種緣故', file: DISPUTE },
  { who: 'GT 引賈斯樂郝威', says: '其中一點：兩章所列的行程都不是完整的行程，有些只列出作者認為重要的', quote: '兩章所列的行程並非完整的行程；有些只列出作者他認為重要的', file: '04 民數記/第33章.md' },
];
