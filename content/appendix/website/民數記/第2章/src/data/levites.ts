import type { ClanId, Count, Fact, Ref, Side } from './types';

export interface Clan {
  id: ClanId;
  name: string;
  side: Side;
  /** 「要在帳幕後西邊安營」這類宣告方位的句子 */
  sideRef: Ref;
  sideQ: string;
  /** 祭司沒有人數 */
  count?: Count;
  leader?: { father: string; name: string; ref: Ref };
  /** 搬運或看守的東西（民3:25-37） */
  charge: { text: string; ref: Ref; q: string };
  /** 民7:7-9：分到幾輛車、幾隻牛 */
  wagons: { n: number; oxen: number; ref: Ref; q: string };
}

export const CLANS: Clan[] = [
  {
    id: 'gershon', name: '革順', side: 'west', sideRef: '民3:23', sideQ: '要在帳幕後西邊安營',
    count: { n: 7500, zh: '七千五百名', ref: '民3:22' },
    leader: { father: '拉伊勒', name: '以利雅薩', ref: '民3:24' },
    charge: { text: '帳幕和罩棚、罩棚的蓋、會幕的門簾、院子的帷子與門簾、一切使用的繩子', ref: '民3:25-26', q: '帳幕和罩棚，並罩棚的蓋與會幕的門簾' },
    wagons: { n: 2, oxen: 4, ref: '民7:7', q: '把兩輛車，四隻牛，照革順子孫所辦的事交給他們' },
  },
  {
    id: 'kohath', name: '哥轄', side: 'south', sideRef: '民3:29', sideQ: '要在帳幕的南邊安營',
    count: { n: 8600, zh: '八千六百名', ref: '民3:28' },
    leader: { father: '烏薛', name: '以利撒反', ref: '民3:30' },
    charge: { text: '約櫃、桌子、燈臺、兩座壇與聖所內使用的器皿、簾子', ref: '民3:31', q: '約櫃、桌子、燈臺、兩座壇與聖所內使用的器皿' },
    wagons: { n: 0, oxen: 0, ref: '民7:9', q: '但車與牛都沒有交給哥轄子孫' },
  },
  {
    id: 'merari', name: '米拉利', side: 'north', sideRef: '民3:35', sideQ: '他們要在帳幕的北邊安營',
    count: { n: 6200, zh: '六千二百名', ref: '民3:34' },
    leader: { father: '亞比亥', name: '蘇列', ref: '民3:35' },
    charge: { text: '帳幕的板、閂、柱子、帶卯的座，以及院子四圍的柱子、座、橛子和繩子', ref: '民3:36-37', q: '帳幕的板、閂、柱子、帶卯的座' },
    wagons: { n: 4, oxen: 8, ref: '民7:8', q: '把四輛車，八隻牛，照米拉利子孫所辦的事交給他們' },
  },
  {
    id: 'priests', name: '摩西、亞倫和亞倫的兒子', side: 'east', sideRef: '民3:38', sideQ: '在帳幕前東邊，向日出之地安營的是摩西、亞倫，和亞倫的兒子',
    charge: { text: '看守聖所，替以色列人守耶和華所吩咐的', ref: '民3:38', q: '他們看守聖所，替以色列人守耶和華所吩咐的' },
    wagons: { n: 0, oxen: 0, ref: '民3:38', q: '摩西、亞倫，和亞倫的兒子' },
  },
];

export const LEVITE_TOTAL: Count = { n: 22000, zh: '二萬二千名', ref: '民3:39' };

export const clan = (id: ClanId): Clan => CLANS.find((c) => c.id === id)!;

/** 民4:5-14：哥轄人抬的聖物，最外面蓋的是什麼 */
export interface Load {
  id: 'ark' | 'table' | 'lampstand' | 'incense' | 'altar';
  name: string;
  ref: Ref;
  /** 民4 提到的層次，由內而外 */
  layers: string[];
  outer: 'blue' | 'sealskin';
  q: string;
}

export const LOADS: Load[] = [
  { id: 'ark', name: '約櫃', ref: '民4:5-6', layers: ['遮掩櫃的幔子', '海狗皮', '純藍色的毯子'], outer: 'blue', q: '再蒙上純藍色的毯子' },
  { id: 'table', name: '陳設餅的桌子', ref: '民4:7-8', layers: ['藍色毯子', '朱紅色毯子', '海狗皮'], outer: 'sealskin', q: '再蒙上海狗皮' },
  { id: 'lampstand', name: '燈臺', ref: '民4:9-10', layers: ['藍色毯子', '海狗皮'], outer: 'sealskin', q: '包在海狗皮裡' },
  { id: 'incense', name: '金壇（香壇）', ref: '民4:11', layers: ['藍色毯子', '海狗皮'], outer: 'sealskin', q: '蒙上海狗皮' },
  { id: 'altar', name: '燔祭壇', ref: '民4:13-14', layers: ['紫色毯子', '海狗皮'], outer: 'sealskin', q: '又蒙上海狗皮' },
];

const fmt = (n: number) => n.toLocaleString('en-US');

export function clanFacts(c: Clan): Fact[] {
  const out: Fact[] = [{ text: `安營在帳幕的${{ east: '東', south: '南', west: '西', north: '北' }[c.side]}邊`, status: 'explicit', refs: [c.sideRef], q: c.sideQ }];
  if (c.count) out.push({ text: `一個月以外的男子 ${fmt(c.count.n)} 名`, status: 'explicit', refs: [c.count.ref], q: c.count.zh });
  if (c.leader) out.push({ text: `宗族首領是${c.leader.father}的兒子${c.leader.name}`, status: 'explicit', refs: [c.leader.ref], q: `${c.leader.father}的兒子${c.leader.name}` });
  out.push({ text: `職責：${c.charge.text}`, status: 'explicit', refs: [c.charge.ref], q: c.charge.q });
  if (c.id !== 'priests') {
    out.push(c.wagons.n > 0
      ? { text: `分到 ${c.wagons.n} 輛篷子車、${c.wagons.oxen} 隻牛`, status: 'explicit', refs: [c.wagons.ref], q: c.wagons.q }
      : { text: '沒有分到車和牛，聖物用肩頭抬', status: 'explicit', refs: ['民7:9'], q: '在肩頭上抬聖物' });
  }
  return out;
}
