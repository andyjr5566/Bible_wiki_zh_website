import type { CampId, Count, Fact, Matriarch, Ref, Side, TribeId } from './types';

export interface Tribe {
  id: TribeId;
  name: string;
  camp: CampId;
  /** 在自己那一營裡的順序：1 是領頭支派，2 是「挨著他」，3 是「又有」 */
  rank: 1 | 2 | 3;
  leader: string;
  /** 首領的父親，例如「亞米拿達」 */
  father: string;
  /** 民2 裡交代首領與位置的那一節 */
  campRef: Ref;
  /** 該節裡交代在營中位置的那一句（領頭支派是方位句） */
  placeQ: string;
  /** 民10 行軍段落裡統領這支派的那一節 */
  marchRef: Ref;
  c2: Count;
  c1: Count;
  c26: Count;
  /** 民7 十二日獻禮，第幾天 */
  day: number;
  dayRef: Ref;
  mother: Matriarch;
}

export interface Camp {
  id: CampId;
  side: Side;
  /** 民2 裡宣告方位的那一句 */
  sideQ: string;
  sideRef: Ref;
  head: TribeId;
  members: [TribeId, TribeId, TribeId];
  total: Count;
  /** 「要作第一隊往前行」這句 */
  orderQ: string;
  orderName: string;
  bannerName: string;
}

const t = (
  id: TribeId, name: string, camp: CampId, rank: 1 | 2 | 3, father: string, leader: string,
  campRef: Ref, placeQ: string, marchRef: Ref,
  c2: [number, string, string], c1: [number, string, string], c26: [number, string, string],
  day: number, dayRef: Ref, mother: Matriarch,
): Tribe => ({
  id, name, camp, rank, father, leader, campRef, placeQ, marchRef,
  c2: { n: c2[0], zh: c2[1], ref: c2[2] },
  c1: { n: c1[0], zh: c1[1], ref: c1[2] },
  c26: { n: c26[0], zh: c26[1], ref: c26[2] },
  day, dayRef, mother,
});

export const TRIBES: Tribe[] = [
  t('judah', '猶大', 'judah', 1, '亞米拿達', '拿順', '民2:3', '在東邊，向日出之地', '民10:14',
    [74600, '七萬四千六百名', '民2:4'], [74600, '七萬四千六百名', '民1:26'], [76500, '七萬六千五百名', '民26:22'], 1, '民7:12', 'leah'),
  t('issachar', '以薩迦', 'judah', 2, '蘇押', '拿坦業', '民2:5', '挨著他安營的是以薩迦支派', '民10:15',
    [54400, '五萬四千四百名', '民2:6'], [54400, '五萬四千四百名', '民1:28'], [64300, '六萬四千三百名', '民26:25'], 2, '民7:18', 'leah'),
  t('zebulun', '西布倫', 'judah', 3, '希倫', '以利押', '民2:7', '又有西布倫支派', '民10:16',
    [57400, '五萬七千四百名', '民2:8'], [57400, '五萬七千四百名', '民1:30'], [60500, '六萬零五百名', '民26:27'], 3, '民7:24', 'leah'),

  t('reuben', '流便', 'reuben', 1, '示丟珥', '以利蓿', '民2:10', '在南邊', '民10:18',
    [46500, '四萬六千五百名', '民2:11'], [46500, '四萬六千五百名', '民1:20'], [43730, '四萬三千七百三十名', '民26:7'], 4, '民7:30', 'leah'),
  t('simeon', '西緬', 'reuben', 2, '蘇利沙代', '示路蔑', '民2:12', '挨著他安營的是西緬支派', '民10:19',
    [59300, '五萬九千三百名', '民2:13'], [59300, '五萬九千三百名', '民1:22'], [22200, '二萬二千二百名', '民26:14'], 5, '民7:36', 'leah'),
  t('gad', '迦得', 'reuben', 3, '丟珥', '以利雅薩', '民2:14', '又有迦得支派', '民10:20',
    [45650, '四萬五千六百五十名', '民2:15'], [45650, '四萬五千六百五十名', '民1:24'], [40500, '四萬零五百名', '民26:18'], 6, '民7:42', 'zilpah'),

  t('ephraim', '以法蓮', 'ephraim', 1, '亞米忽', '以利沙瑪', '民2:18', '在西邊', '民10:22',
    [40500, '四萬零五百名', '民2:19'], [40500, '四萬零五百名', '民1:32'], [32500, '三萬二千五百名', '民26:37'], 7, '民7:48', 'rachel'),
  t('manasseh', '瑪拿西', 'ephraim', 2, '比大蓿', '迦瑪列', '民2:20', '挨著他的是瑪拿西支派', '民10:23',
    [32200, '三萬二千二百名', '民2:21'], [32200, '三萬二千二百名', '民1:34'], [52700, '五萬二千七百名', '民26:34'], 8, '民7:54', 'rachel'),
  t('benjamin', '便雅憫', 'ephraim', 3, '基多尼', '亞比但', '民2:22', '又有便雅憫支派', '民10:24',
    [35400, '三萬五千四百名', '民2:23'], [35400, '三萬五千四百名', '民1:36'], [45600, '四萬五千六百名', '民26:41'], 9, '民7:60', 'rachel'),

  t('dan', '但', 'dan', 1, '亞米沙代', '亞希以謝', '民2:25', '在北邊', '民10:25',
    [62700, '六萬二千七百名', '民2:26'], [62700, '六萬二千七百名', '民1:38'], [64400, '六萬四千四百名', '民26:43'], 10, '民7:66', 'bilhah'),
  t('asher', '亞設', 'dan', 2, '俄蘭', '帕結', '民2:27', '挨著他安營的是亞設支派', '民10:26',
    [41500, '四萬一千五百名', '民2:28'], [41500, '四萬一千五百名', '民1:40'], [53400, '五萬三千四百名', '民26:47'], 11, '民7:72', 'zilpah'),
  t('naphtali', '拿弗他利', 'dan', 3, '以南', '亞希拉', '民2:29', '又有拿弗他利支派', '民10:27',
    [53400, '五萬三千四百名', '民2:30'], [53400, '五萬三千四百名', '民1:42'], [45400, '四萬五千四百名', '民26:50'], 12, '民7:78', 'bilhah'),
];

export const CAMPS: Camp[] = [
  { id: 'judah', side: 'east', sideQ: '在東邊，向日出之地', sideRef: '民2:3', head: 'judah', members: ['judah', 'issachar', 'zebulun'],
    total: { n: 186400, zh: '十八萬六千四百名', ref: '民2:9' }, orderQ: '要作第一隊往前行', orderName: '第一隊', bannerName: '猶大營的纛' },
  { id: 'reuben', side: 'south', sideQ: '在南邊', sideRef: '民2:10', head: 'reuben', members: ['reuben', 'simeon', 'gad'],
    total: { n: 151450, zh: '十五萬一千四百五十名', ref: '民2:16' }, orderQ: '要作第二隊往前行', orderName: '第二隊', bannerName: '流便營的纛' },
  { id: 'ephraim', side: 'west', sideQ: '在西邊', sideRef: '民2:18', head: 'ephraim', members: ['ephraim', 'manasseh', 'benjamin'],
    total: { n: 108100, zh: '十萬零八千一百名', ref: '民2:24' }, orderQ: '要作第三隊往前行', orderName: '第三隊', bannerName: '以法蓮營的纛' },
  { id: 'dan', side: 'north', sideQ: '在北邊', sideRef: '民2:25', head: 'dan', members: ['dan', 'asher', 'naphtali'],
    total: { n: 157600, zh: '十五萬七千六百名', ref: '民2:31' }, orderQ: '要歸本纛作末隊往前行', orderName: '末隊', bannerName: '但營的纛' },
];

/** 民2:32 與民1:45 的總數 */
export const TOTAL_2: Count = { n: 603550, zh: '六十萬零三千五百五十名', ref: '民2:32' };
export const TOTAL_1: Count = { n: 603550, zh: '六十萬零三千五百五十名', ref: '民1:45' };
/** 民26:51 第二次數點的總數 */
export const TOTAL_26: Count = { n: 601730, zh: '六十萬零一千七百三十名', ref: '民26:51' };

export const SIDE_LABEL: Record<Side, string> = { east: '東', south: '南', west: '西', north: '北' };

export const MATRIARCH: Record<Matriarch, { name: string; role: string; color: string }> = {
  leah: { name: '利亞', role: '妻', color: '#8b5a9e' },
  rachel: { name: '拉結', role: '妻', color: '#2f7a7a' },
  bilhah: { name: '辟拉', role: '拉結的使女', color: '#b0703a' },
  zilpah: { name: '悉帕', role: '利亞的使女', color: '#6b7a2f' },
};

export const tribe = (id: TribeId): Tribe => TRIBES.find((x) => x.id === id)!;
export const camp = (id: CampId): Camp => CAMPS.find((x) => x.id === id)!;
export const tribesOf = (id: CampId): Tribe[] => TRIBES.filter((x) => x.camp === id).sort((a, b) => a.rank - b.rank);

const fmt = (n: number) => n.toLocaleString('en-US');
export { fmt };

/** 一支派的事實列：營位、首領、人數、同營位置、獻禮日、母系 */
export function tribeFacts(x: Tribe): Fact[] {
  const c = camp(x.camp);
  const facts: Fact[] = [];
  if (x.rank === 1) {
    facts.push({ text: `${c.bannerName}在${SIDE_LABEL[c.side]}邊`, status: 'explicit', refs: [c.sideRef], q: c.sideQ });
  } else {
    facts.push({ text: `編在${c.bannerName}裡，${x.rank === 2 ? '挨著領頭的' + tribe(c.head).name : '排在第三'}`, status: 'explicit', refs: [x.campRef], q: x.placeQ });
  }
  facts.push({ text: `首領是${x.father}的兒子${x.leader}`, status: 'explicit', refs: [x.campRef], q: `${x.father}的兒子${x.leader}` });
  facts.push({ text: `被數點的軍隊 ${fmt(x.c2.n)} 名`, status: 'explicit', refs: [x.c2.ref], q: x.c2.zh });
  return facts;
}

/** 面板「更多」：民1、民26、民10、民7、母系 */
export function tribeExtraFacts(x: Tribe): Fact[] {
  const d = x.c26.n - x.c2.n;
  const out: Fact[] = [
    { text: `民1 第一次數點：${fmt(x.c1.n)} 名，和民2 相同`, status: 'explicit', refs: [x.c1.ref], q: x.c1.zh },
    {
      text: `民26 第二次數點：${fmt(x.c26.n)} 名（比民2 ${d >= 0 ? '增加' : '減少'} ${fmt(Math.abs(d))}）`,
      status: 'explicit', refs: [x.c26.ref], q: x.c26.zh,
      note: x.id === 'dan' ? '民26:42-43 但的眾子只有書含一族，這個數字記在「書含所有的各族」名下。' : undefined,
    },
    { text: `民10 行軍時，統領${x.name}的是${x.leader}`, status: 'explicit', refs: [x.marchRef], q: `${x.father}的兒子${x.leader}` },
    { text: `民7 獻壇禮，${x.name}的首領${x.leader}是第 ${x.day} 日獻供物的`, status: 'explicit', refs: [x.dayRef], q: x.leader },
  ];
  const m = MATRIARCH[x.mother];
  const viaJoseph = x.id === 'ephraim' || x.id === 'manasseh';
  out.push({
    text: viaJoseph
      ? `母系：拉結一系。${x.name}是約瑟的兒子，約瑟是拉結所生`
      : `母系：${m.name}${m.role === '妻' ? '' : '（' + m.role + '）'}所生`,
    status: 'explicit',
    refs: viaJoseph ? [MOTHER_REF, '創41:50'] : [MOTHER_REF],
    q: MOTHER_Q[x.mother],
    note: viaJoseph ? `${x.name}的母親是亞西納（創41:50）；民2 的營位把他們歸在拉結的後裔那一營。` : undefined,
  });
  return out;
}

export function campFacts(c: Camp): Fact[] {
  return [
    { text: `${c.bannerName}在${SIDE_LABEL[c.side]}邊`, status: 'explicit', refs: [c.sideRef], q: c.sideQ },
    { text: `全營被數的共有 ${fmt(c.total.n)} 名，${c.orderName === '末隊' ? '要歸本纛作末隊往前行' : '要作' + c.orderName + '往前行'}`, status: 'explicit', refs: [c.total.ref], q: c.orderQ },
  ];
}

export const MOTHER_REF: Ref = '創35:23-26';
export const MOTHER_Q: Record<Matriarch, string> = {
  leah: '利亞所生的是雅各的長子流便，還有西緬、利未、猶大、以薩迦、西布倫',
  rachel: '拉結所生的是約瑟、便雅憫',
  bilhah: '拉結的使女辟拉所生的是但、拿弗他利',
  zilpah: '利亞的使女悉帕所生的是迦得、亞設',
};
