import { CONTACT, SEPARATE, WHY } from './ch11';
import { DONE, OFFER_POOR, OFFER_RICH, PHASES, TOTAL } from './ch12';
import { HOUSE, VOICES_14 } from './ch14';
import { CASES, HEAL_BIRDS, REASON_15 } from './ch15';
import { EPIGRAPH, LENGTHS } from './story';
import type { Fact, Voice } from './types';

/**
 * 總覽：把 11–15 章所有的情況放在同一張圖上。
 * 這裡的每一句都沿用各章已經附出處的句子，只是重新排列；沒有新增經文以外的主張。
 */

export type ChapterNo = 11 | 12 | 13 | 14 | 15;

/* ------------------------------------------------------------ 時間軸：不潔淨有多久 */

export interface Span {
  id: string;
  label: string;
  /** 軸上的位置 0–1（只是示意，不按比例） */
  k: number;
  note?: string;
  items: { label: string; ch: ChapterNo; fact: Fact }[];
}

export const TIMELINE: Span[] = [
  { id: 'evening', label: '到晚上', k: 0.05, items: [
    { label: '摸死的不潔淨動物', ch: 11, fact: CONTACT[0].fact },
    { label: '吃、拿死掉的走獸', ch: 11, fact: CONTACT[3].fact },
    { label: '進去封鎖中的房子', ch: 14, fact: HOUSE.inside },
    { label: '摸漏症的人用過的東西', ch: 15, fact: CASES[0].rows[1].fact },
    { label: '夢遺、夫妻同房', ch: 15, fact: CASES[1].rows[0].fact },
    { label: '摸月經中的女人用過的東西', ch: 15, fact: CASES[2].rows[1].fact },
  ] },
  { id: 'seven', label: '七天', k: 0.18, items: [
    { label: '月經', ch: 15, fact: CASES[2].rows[0].fact },
    { label: '與月經中的女人同房', ch: 15, fact: CASES[2].rows[3].fact },
    { label: '生男孩，頭七天', ch: 12, fact: PHASES.boy[0].fact },
  ] },
  { id: 'fourteen', label: '十四天', k: 0.3, items: [
    { label: '生女孩，頭十四天', ch: 12, fact: PHASES.girl[0].fact },
  ] },
  { id: 'forty', label: '四十天', k: 0.55, note: '前七天不潔淨，後三十三天是「潔淨的日子」：不可摸聖物、不可進聖所', items: [
    { label: '生男孩：七天加三十三天', ch: 12, fact: TOTAL },
  ] },
  { id: 'eighty', label: '八十天', k: 0.8, note: '前十四天不潔淨，後六十六天是「潔淨的日子」', items: [
    { label: '生女孩：十四天加六十六天', ch: 12, fact: TOTAL },
  ] },
  { id: 'healed', label: '直到好了', k: 1, note: '好了以後還要再等，才算潔淨', items: [
    { label: '長大痲瘋：獨居營外', ch: 13, fact: LENGTHS[3].fact },
    { label: '男人的漏症', ch: 15, fact: CASES[0].rows[0].fact },
    { label: '經期以外的血漏', ch: 15, fact: CASES[3].rows[0].fact },
  ] },
];

/* ------------------------------------------------------------ 好了以後，要獻什麼 */

export interface OfferRow {
  id: string;
  situation: string;
  ch: ChapterNo;
  range: string;
  recover: Fact;
  rich: Fact;
  /** 力量不夠的；null＝經文沒有另外規定 */
  poor: Fact | null;
}

export const OFFER_ROWS: OfferRow[] = [
  { id: 'birth', situation: '生產', ch: 12, range: '利12:6-8', recover: DONE, rich: OFFER_RICH, poor: OFFER_POOR },
  { id: 'leprosy', situation: '長大痲瘋得潔淨', ch: 14, range: '利14:1-32',
    recover: { text: '營外灑七次、洗衣剃毛，在自己的帳棚外住七天，第八天到會幕門口', status: 'synthesis', refs: ['利14:7', '利14:8', '利14:10'] },
    rich: { text: '兩隻公羊羔、一隻母羊羔、調油的細麵、一羅革油', status: 'explicit', refs: ['利14:10'], q: '第八天，他要取兩隻沒有殘疾的公羊羔和一隻沒有殘疾、一歲的母羊羔' },
    poor: { text: '一隻公羊羔作贖愆祭、兩隻鳥、較少的細麵、一羅革油', status: 'explicit', refs: ['利14:21-22'], q: '他若貧窮不能預備夠數，就要取一隻公羊羔作贖愆祭' } },
  { id: 'man', situation: '男人的漏症', ch: 15, range: '利15:13-15', recover: CASES[0].rows[2].fact, rich: CASES[0].rows[3].fact, poor: HEAL_BIRDS },
  { id: 'flow', situation: '經期以外的血漏', ch: 15, range: '利15:28-30', recover: CASES[3].rows[2].fact, rich: CASES[3].rows[3].fact, poor: HEAL_BIRDS },
  { id: 'house', situation: '房屋上的災病', ch: 14, range: '利14:48-53', recover: HOUSE.clean, rich: HOUSE.birds, poor: null },
];

/** 這幾種情況，經文沒有提到要獻祭 */
export const NO_OFFER: { label: string; ch: ChapterNo; fact: Fact }[] = [
  { label: '碰到死的動物、爬物', ch: 11, fact: { text: '不潔淨到晚上，要洗衣服；這一章沒有提到獻祭', status: 'not_stated', refs: ['利11:24-40'] } },
  { label: '皮膚上的斑，祭司定為潔淨', ch: 13, fact: { text: '只要洗衣服，就潔淨了', status: 'explicit', refs: ['利13:6'], q: '那人就要洗衣服，得為潔淨' } },
  { label: '夢遺、夫妻同房', ch: 15, fact: CASES[1].rows[2].fact },
  { label: '月經', ch: 15, fact: CASES[2].rows[4].fact },
];

/* ------------------------------------------------------------ 這五章在哪裡 */

export interface ArcStop {
  key: 'start' | 'mid' | 'end';
  title: string;
  range: string;
  facts: Fact[];
}

export const ARC: ArcStop[] = [
  { key: 'start', title: '利未記 10 章', range: '利10:10', facts: [EPIGRAPH] },
  { key: 'mid', title: '利未記 11–15 章', range: '利11:44-47；利15:31', facts: [WHY, SEPARATE, REASON_15] },
  { key: 'end', title: '利未記 16 章：贖罪日', range: '利16:16-34', facts: [
    { text: '一年一次的贖罪日，連「會幕在他們污穢之中」也要在聖所行贖罪之禮', status: 'explicit', refs: ['利16:16'], q: '並因會幕在他們污穢之中' },
    { text: '把血彈在壇上七次，從壇上除掉以色列人的污穢', status: 'explicit', refs: ['利16:19'], q: '從壇上除掉以色列人諸般的污穢' },
    { text: '這要作永遠的定例：一年一次為以色列人的罪贖罪', status: 'explicit', refs: ['利16:34'], q: '要一年一次為他們贖罪' },
  ] },
];

export const ARC_NOTE: Fact = {
  text: '利15:31 說不潔淨會玷污帳幕；利16 章說，一年一次，連會幕和壇上沾染的污穢也要除掉',
  status: 'synthesis',
  refs: ['利15:31', '利16:16', '利16:19'],
};

export const VOICES_OVERVIEW: Record<string, Voice> = {
  twoBirds: VOICES_14.twoBirds,
  bh: { who: 'BH', says: '把放走活鳥比作贖罪日把羊送到曠野（利16:10）', ch: 14 },
};

export function overviewFacts(): Fact[] {
  return [
    ...TIMELINE.flatMap((s) => s.items.map((i) => i.fact)),
    ...OFFER_ROWS.flatMap((r) => [r.recover, r.rich, ...(r.poor ? [r.poor] : [])]),
    ...NO_OFFER.map((n) => n.fact),
    ...ARC.flatMap((a) => a.facts), ARC_NOTE,
  ];
}

export function overviewVoices(): Voice[] {
  return Object.values(VOICES_OVERVIEW);
}
