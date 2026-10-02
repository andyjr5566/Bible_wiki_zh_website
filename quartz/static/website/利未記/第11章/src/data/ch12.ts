import type { Beat, Fact, Reel, Voice } from './types';

/**
 * 利未記 12 章：生產之後。
 * 原文欄位取自本庫 raw_data/stepbible_leviticus_12.txt（STEP Bible／STEPBible-Data，CC BY 4.0），
 * 經由第 12 章主檔「本章整理」的整理；辭典義只是可能義域。
 */

export const VOICES_12: Record<string, Voice> = {
  husband: { who: 'GT《串珠聖經註釋》', says: '頭七天的實際規矩', quote: '期間她的丈夫也不可接近她', ch: 12 },
  onlyHoly: { who: 'GT《串珠聖經註釋》', says: '後一段只是不能碰聖物', quote: '只是不許接觸聖物而已', ch: 12 },
  add: { who: 'GT 丁良才', says: '兩段日子要相加：七加三十三是四十', quote: '原文作仍要家居三十三天，顯明頭七天不在那三十三天之內', ch: 12 },
  forty: { who: 'GT《舊約聖經背景註釋》', says: '四十天有實際的根據', quote: '產後出血可以長至二至六個星期，所以這個估計十分恰當。', ch: 12 },
  day8: { who: 'GT 丁良才', says: '第八天，母親最不潔淨的日子剛過去', quote: '有人摟她，就不至於沾染不潔', ch: 12 },
  eight: { who: 'GT《聖經精讀本》', says: '「八」這個數字', quote: '八是復活的數字(創17:12)', ch: 12 },
  dove: { who: 'GT《啟導本》', says: '為什麼斑鳩、雛鴿二選一', quote: '班鳩為候鳥，在非洲過冬，四至十月分才飛來巴勒斯坦', ch: 12 },
  poor: { who: 'CT', says: '兩隻鳥一樣蒙悅納', quote: '斑鳩只是表明些微的奉獻，似乎無足輕重，但是救恩的享受方面並未減少，不比龐大的公牛差。可見信心的表現不在量一方面，而是其物件。', ch: 12 },
  mary: { who: 'GT《啟導本》', says: '馬利亞和約瑟獻的是鳥', quote: '耶穌降生後，祂的父母照聖經規定獻祭，所用祭牲為鳥類，說明約瑟當時家貧，無力獻羊只為祭。', ch: 12 },
  ritual: { who: 'GT《舊約聖經背景註釋》', says: '「贖罪祭」在這裡更像「潔淨祭」', quote: '這裡並沒有需『贖』之『罪』，只有在壇上被清除的不潔。', ch: 12 },
  orderDing: { who: 'GT 丁良才', says: '這是禮節上的贖罪祭，重點在燔祭', quote: '因為這贖罪祭不是為什麼指定的罪獻的，乃是禮節上的贖罪祭', ch: 12 },
  orderCT: { who: 'CT', says: '人還沒有完全為神活著，所以先燔祭', quote: '人的不潔，因未完全為神活著，所以先獻燔祭後獻贖罪祭', ch: 12 },
  orderKC: { who: 'KC', says: '燔祭排在前面，所以帶著重點；先明白燔祭，才明白一點贖罪祭的意思', ch: 12 },
  orderJD: { who: 'GT《聖經精讀本》', says: '一個是感謝，一個是除去不潔', quote: '燔祭是對順利生產表示感謝和奉獻,贖罪祭是為除去伴隨生產的不潔。', ch: 12 },
};

const B = (time: string, story: string, rule: Fact, cues: Beat['cues'], voice?: Voice): Beat => ({ time, story, rule, cues, voice });

export const REEL_12: Reel = {
  id: 'c12',
  title: '家裡添了一個男孩',
  color: 'var(--c12)',
  next: '父親的回答，接在下面',
  beats: [
    B('那天夜裡', '那天夜裡，母親要生了。她進了帳棚，父親和女兒在外面等。',
      { text: '這一章從婦人懷孕生產說起', status: 'explicit', refs: ['利12:2'], q: '若有婦人懷孕' },
      [{ t: 'sky', sky: 'night' }, { t: 'at', who: 'mother', to: 'home' }, { t: 'at', who: 'father', to: 'beside' }, { t: 'at', who: 'daughter', to: 'pot' },
        { t: 'cam', view: 'birthNight' }, { t: 'wait', ms: 700 }, { t: 'show', who: 'mother', on: false },
        { t: 'act', who: 'father', act: 'look', to: 'daughter' }, { t: 'wait', ms: 600 }]),
    B('天快亮的時候', '天快亮的時候，帳棚裡傳出嬰孩的哭聲。是個男孩。母親抱著他走到門口。',
      { text: '這條例是為生育的婦人', status: 'explicit', refs: ['利12:7'], q: '這條例是為生育的婦人，無論是生男生女' },
      [{ t: 'sky', sky: 'dawn' }, { t: 'sayAt', at: 'home', text: '哇——哇——' }, { t: 'wait', ms: 500 },
        { t: 'show', who: 'mother', on: true }, { t: 'prop', id: 'baby', state: 'carry:mother' },
        { t: 'together', cues: [{ t: 'walk', who: 'father', to: 'yard' }, { t: 'walk', who: 'daughter', to: 'seatBy' }] },
        { t: 'cam', view: 'yard' }, { t: 'say', who: 'daughter', text: '是弟弟！', to: 'mother' }]),
    B('第 1 到 7 天', '照經文的規矩，從這一天起，她不潔淨七天，和月經的日子一樣。',
      { text: '生男孩，不潔淨七天，和月經的日子一樣', status: 'explicit', refs: ['利12:2'], q: '他就不潔淨七天，像在月經污穢的日子不潔淨一樣' },
      [{ t: 'sky', sky: 'day' }, { t: 'mark', who: 'mother', mark: 'seven' }, { t: 'cam', view: 'skyline' }, { t: 'wait', ms: 900 }, { t: 'count', from: 1, to: 7, label: '第 {n} 天' }],
      VOICES_12.husband),
    B('第 8 天', '第八天，全家圍著孩子，為他行割禮。',
      { text: '第八天，要給孩子行割禮', status: 'explicit', refs: ['利12:3'], q: '第八天，要給嬰孩行割禮' },
      [{ t: 'day', text: '第 8 天' }, { t: 'prop', id: 'baby', state: 'carry:father' }, { t: 'cam', view: 'yard' },
        { t: 'together', cues: [{ t: 'act', who: 'father', act: 'bow' }, { t: 'act', who: 'mother', act: 'bow', to: 'father' }, { t: 'act', who: 'daughter', act: 'look', to: 'father' }] }],
      VOICES_12.day8),
    B('第 8 到 40 天', '前七天過去了，接著是三十三天「潔淨的日子」。這段日子，她不可摸聖物，也不可進聖所。',
      { text: '再等三十三天；日子未滿，不可摸聖物、不可進聖所', status: 'explicit', refs: ['利12:4'], q: '要家居三十三天。他潔淨的日子未滿，不可摸聖物，也不可進入聖所' },
      [{ t: 'mark', who: 'mother', mark: 'purify' }, { t: 'cam', view: 'reach' }, { t: 'bar', on: true }, { t: 'wait', ms: 1600 }, { t: 'cam', view: 'skyline' }, { t: 'wait', ms: 1000 }, { t: 'count', from: 8, to: 40, label: '第 {n} 天' }],
      VOICES_12.onlyHoly),
    B('第 40 天', '日子滿了。全家一起往會幕去：母親牽著一歲的羊羔，女兒捧著一隻雛鴿。',
      { text: '滿了潔淨的日子，帶一歲的羊羔作燔祭、一隻雛鴿作贖罪祭', status: 'explicit', refs: ['利12:6'], q: '他要把一歲的羊羔為燔祭，一隻雛鴿或是一隻斑鳩為贖罪祭' },
      [{ t: 'bar', on: false }, { t: 'day', text: '第 40 天' }, { t: 'prop', id: 'lamb', state: 'lead:mother' }, { t: 'prop', id: 'dove', state: 'carry:daughter' },
        { t: 'at', who: 'priest', to: 'doorP' }, { t: 'follow', who: 'mother' },
        { t: 'together', cues: [
          { t: 'walk', who: 'mother', to: 'door', via: ['path', 'gate'] },
          { t: 'walk', who: 'daughter', to: 'doorD', via: ['pathD', 'gateF'] },
          { t: 'walk', who: 'father', to: 'doorF', via: ['pathF', 'gateF'] },
        ] }, { t: 'cam', view: 'doorFamily' }]),
    B('第 40 天', '到了會幕門口，她把羊羔和雛鴿交給祭司。',
      { text: '帶到會幕門口，交給祭司', status: 'explicit', refs: ['利12:6'], q: '帶到會幕門口交給祭司' },
      [{ t: 'prop', id: 'lamb', state: 'lead:priest' }, { t: 'prop', id: 'dove', state: 'carry:priest' }, { t: 'act', who: 'mother', act: 'bow', to: 'priest' }, { t: 'cam', view: 'door' }]),
    B('第 40 天', '祭司把羊羔獻為燔祭，雛鴿獻為贖罪祭，為她贖罪。她潔淨了。',
      { text: '祭司獻在耶和華面前，為她贖罪，她就潔淨了', status: 'explicit', refs: ['利12:7'], q: '祭司要獻在耶和華面前，為他贖罪，他的血源就潔淨了' },
      [{ t: 'cam', view: 'altar' }, { t: 'act', who: 'priest', act: 'offer' }, { t: 'prop', id: 'lamb', state: 'hide' }, { t: 'prop', id: 'dove', state: 'hide' },
        { t: 'mark', who: 'mother', mark: 'clean' }, { t: 'cam', view: 'doorFamily' }],
      VOICES_12.ritual),
    B('回家的路上', '回家的路上，女兒問父親：「為什麼媽媽要等四十天？如果生的是妹妹呢？」',
      { text: '生女孩，不潔淨的日子加倍', status: 'explicit', refs: ['利12:5'], q: '他若生女孩，就不潔淨兩個七天' },
      [{ t: 'day', text: '' }, { t: 'cam', view: 'pathView' },
        { t: 'together', cues: [
          { t: 'walk', who: 'mother', to: 'path', via: ['gate'] },
          { t: 'walk', who: 'daughter', to: 'pathD', via: ['gateF'] },
          { t: 'walk', who: 'father', to: 'pathF', via: ['gateF'] },
        ] },
        { t: 'say', who: 'daughter', text: '為什麼要等四十天？如果是妹妹呢？', to: 'father' }]),
  ],
};

/* ------------------------------------------------------------ 日曆 */

export type Baby = 'boy' | 'girl';

export interface Phase {
  key: 'unclean' | 'purify' | 'done';
  from: number;
  to: number;
  label: string;
  fact: Fact;
}

export const PHASES: Record<Baby, Phase[]> = {
  boy: [
    { key: 'unclean', from: 1, to: 7, label: '不潔淨七天', fact: { text: '不潔淨七天，像月經的日子一樣', status: 'explicit', refs: ['利12:2'], q: '他就不潔淨七天，像在月經污穢的日子不潔淨一樣' } },
    { key: 'purify', from: 8, to: 40, label: '潔淨的日子：再三十三天', fact: { text: '再等三十三天；不可摸聖物、不可進聖所', status: 'explicit', refs: ['利12:4'], q: '要家居三十三天。他潔淨的日子未滿，不可摸聖物，也不可進入聖所' } },
  ],
  girl: [
    { key: 'unclean', from: 1, to: 14, label: '不潔淨兩個七天', fact: { text: '生女孩，不潔淨兩個七天', status: 'explicit', refs: ['利12:5'], q: '他若生女孩，就不潔淨兩個七天' } },
    { key: 'purify', from: 15, to: 80, label: '潔淨的日子：再六十六天', fact: { text: '再等六十六天', status: 'explicit', refs: ['利12:5'], q: '要在產血不潔之中，家居六十六天' } },
  ],
};

export const CIRCUMCISION: Fact = { text: '第八天，男孩受割禮', status: 'explicit', refs: ['利12:3'], q: '第八天，要給嬰孩行割禮' };
export const DONE: Fact = {
  text: '日子滿了，帶祭物到會幕門口；不論生男生女，獻的祭一樣',
  status: 'explicit',
  refs: ['利12:6'],
  q: '滿了潔淨的日子，無論是為男孩是為女孩',
};
export const TOTAL: Fact = {
  text: '兩段日子相加：生男孩 7＋33＝40 天，生女孩 14＋66＝80 天',
  status: 'synthesis',
  refs: ['利12:2-5'],
};
export const LIKE_MENSES: Fact = { text: '「像月經的日子一樣」：月經的規矩寫在第 15 章', status: 'synthesis', refs: ['利12:2', '利15:19-23'] };
export const GIRL_WHY: Fact = { text: '生女孩為什麼日子加倍，經文沒有說', status: 'not_stated', refs: ['利12:5'] };

/* ------------------------------------------------------------ 祭物 */

export const OFFER_RICH: Fact = { text: '一歲的羊羔作燔祭，一隻雛鴿或斑鳩作贖罪祭', status: 'explicit', refs: ['利12:6'], q: '他要把一歲的羊羔為燔祭，一隻雛鴿或是一隻斑鳩為贖罪祭' };
export const OFFER_POOR: Fact = { text: '兩隻斑鳩或兩隻雛鴿：一隻燔祭，一隻贖罪祭', status: 'explicit', refs: ['利12:8'], q: '他就要取兩隻斑鳩或是兩隻雛鴿，一隻為燔祭，一隻為贖罪祭' };
export const ORDER: Fact = { text: '這一章燔祭寫在贖罪祭前面；14、15 章的次序都是先贖罪祭、後燔祭', status: 'synthesis', refs: ['利12:6', '利12:8', '利14:19', '利15:15'] };

/* ------------------------------------------------------------ 新約 */

export const NT_12: Fact = {
  text: '馬利亞生了耶穌，滿了潔淨的日子，照律法獻上的是鳥',
  status: 'explicit',
  refs: ['路2:22', '路2:24'],
  q: '或用一對斑鳩，或用兩隻雛鴿獻祭',
};
export const NT_12B: Fact = { text: '耶穌也是第八天受割禮', status: 'explicit', refs: ['路2:21'], q: '滿了八天，就給孩子行割禮' };

/* ------------------------------------------------------------ 原文 */

export const HEBREW_12: Fact[] = [
  { text: 'v2「懷孕」是 זָרַע（H2232）的使役形，簡要辭典作「to sow」（撒種）', status: 'explicit', refs: ['利12:2'] },
  { text: 'v4、v5 的天數，原文拆開寫成「三十天和三天」「六十天和六天」；v5「兩個七天」是 שָׁבוּעַ（H7620H）的雙數形', status: 'explicit', refs: ['利12:4-5'] },
  { text: 'v4「聖物」是 קֹדֶשׁ（H6944G），「聖所」是 מִקְדָּשׁ（H4720），兩個不同的字', status: 'explicit', refs: ['利12:4'] },
  { text: 'v7「血源」的「源」是 מָקוֹר（H4726），簡要義域是「fountain」（泉源）', status: 'explicit', refs: ['利12:7'] },
  { text: '「贖罪祭」的 חַטָּאת（H2403H），簡要辭典同時列出「罪」與「贖罪祭」兩義', status: 'explicit', refs: ['利12:6'] },
];

export function ch12Facts(): Fact[] {
  return [
    ...REEL_12.beats.map((b) => b.rule),
    ...PHASES.boy.map((p) => p.fact), ...PHASES.girl.map((p) => p.fact),
    CIRCUMCISION, DONE, TOTAL, LIKE_MENSES, GIRL_WHY, OFFER_RICH, OFFER_POOR, ORDER, NT_12, NT_12B, ...HEBREW_12,
  ];
}

export function ch12Voices(): Voice[] {
  return Object.values(VOICES_12);
}
