import { describe, expect, it } from 'vitest';
import { READING } from '../data/model';
import type { ReadingData, ReadingVerse, StageId } from '../data/types';
import {
  OVERLAY_STAGES, STAGE_LABEL, anchorPerson, buildRoute, cardText, chapterHeading, chineseNumber, entryPlan, gapAfterVerse, isListStage, jumpIndex,
  linkTargets, linksReadBefore, listFocusTarget, normalizeRef, otherStage, resolveRef, startIndex,
} from './reader-route';

const verse = (v: number, extra: Partial<ReadingVerse> = {}): ReadingVerse => ({ v, text: `第${v}節`, t: [], ...extra });

/** 小小一條路線：家譜樹的一段、職位圖的一段（中間夾著一節家譜）、再回到家譜樹 */
function sample(): ReadingData {
  return {
    start: '創4:17',
    notes: [],
    diffs: [],
    links: [
      { at: 'a', word: '耶大雅', to: [{ role: 'priests', member: 'g2' }, { tree: 'aaron' }], effect: 'returned', card: '祭司的子孫', refs: ['拉2:36'] },
      { at: 'b', word: '哈歌斯', to: [{ role: 'priests', member: 'g7' }], effect: 'lost', refs: ['拉2:61'] },
      { at: 'c', word: '沙龍', to: [{ role: 'gate' }], effect: 'link', refs: ['拉2:42'] },
    ],
    segments: [
      {
        id: 'gen4', title: '該隱和塞特的後代', group: '創世記', range: '創 4:17–26', stage: 'tree',
        chapters: [{ book: '創', bookName: '創世記', n: 4, title: '該隱和塞特的後代', verses: [verse(17), verse(18)] }],
      },
      {
        id: 'chr23', title: '利未人的班次', group: '大衛立的職位', range: '代上 23:1–24:2', stage: 'roles',
        chapters: [
          { book: '代上', bookName: '歷代志上', n: 23, title: '利未人的班次', verses: [verse(1), verse(2, { stage: 'tree', t: [{ s: 0, e: 1, k: 'p', id: 'levi' }] }), verse(3)] },
          { book: '代上', bookName: '歷代志上', n: 24, title: '利未人的班次', verses: [verse(1), verse(2)] },
        ],
      },
      {
        id: 'chr1-9', title: '歷代志上的族譜', group: '歷代志上的族譜', range: '代上 1:1–1:2', stage: 'tree',
        chapters: [{ book: '代上', bookName: '歷代志上', n: 1, title: '從亞當到以東列王', verses: [verse(1, { sec: '亞當的後代' }), verse(2, { t: [{ s: 0, e: 1, k: 'p', id: 'seth' }] })] }],
      },
      {
        id: 'ezra2', title: '從被擄之地歸回的人', group: '歸回', range: '拉 2:36–38', stage: 'tree',
        chapters: [{
          book: '拉', bookName: '以斯拉記', n: 2, title: '從被擄之地歸回的人',
          verses: [verse(36, { t: [{ s: 0, e: 1, k: 'p', link: 0 }] }), verse(37, { t: [{ s: 0, e: 1, k: 'p', link: 1 }, { s: 1, e: 2, k: 'p', link: 0 }] }), verse(38)],
        }],
      },
    ],
  };
}

describe('讀經路線：攤平與查節', () => {
  const route = buildRoute(sample());

  it('每一節都知道自己的段落、章片段、key 與畫面', () => {
    expect(route.verses.map((item) => item.key)).toEqual([
      '創4:17', '創4:18', '代上23:1', '代上23:2', '代上23:3', '代上24:1', '代上24:2', '代上1:1', '代上1:2', '拉2:36', '拉2:37', '拉2:38',
    ]);
    expect(route.verses.map((item) => item.stage)).toEqual(['tree', 'tree', 'roles', 'tree', 'roles', 'roles', 'roles', 'tree', 'tree', 'tree', 'tree', 'tree']);
    expect(route.verses[2]!.segment.id).toBe('chr23');
    expect(route.verses[5]!.chapter.n).toBe(24);
  });

  it('段落第一節、章片段第一節', () => {
    expect(route.segmentStart).toEqual([0, 2, 7, 9]);
    expect(route.verses.filter((item) => item.firstInSegment).map((item) => item.key)).toEqual(['創4:17', '代上23:1', '代上1:1', '拉2:36']);
    expect(route.verses.filter((item) => item.firstInFragment).map((item) => item.key)).toEqual(['創4:17', '代上23:1', '代上24:1', '代上1:1', '拉2:36']);
  });

  it('代上 23 和代上 1 同書卷但不同章片段，編號不重複', () => {
    const fragments = new Set(route.verses.map((item) => `${item.fragmentIndex}`));
    expect(fragments.size).toBe(5);
  });

  it('#read= 的各種寫法都能找到那一節', () => {
    expect(resolveRef(route, '代上24:1')).toBe(5);
    expect(resolveRef(route, ' 代上 24：1 ')).toBe(5);
    expect(resolveRef(route, '代上999:1')).toBeNull();
    expect(resolveRef(route, '')).toBeNull();
    expect(resolveRef(route, null)).toBeNull();
    expect(normalizeRef('拉 2：61')).toBe('拉2:61');
  });

  it('第一次從路線起點，之後從上次讀到的地方；存的位置不在路線上就回到起點', () => {
    expect(startIndex(route, '創4:17')).toBe(0);
    expect(startIndex(route, '創4:17', null, '拉2:37')).toBe(10);
    expect(startIndex(route, '創4:17', '代上23:2', '拉2:37')).toBe(3);
    expect(startIndex(route, '創4:17', null, '路99:1')).toBe(0);
    expect(startIndex(route, '創4:17', '不存在1:1', null)).toBe(0);
  });
});

describe('讀經路線：標題與標題卡', () => {
  const route = buildRoute(sample());

  it('章有自己的名字就寫「第N章　章名」，否則寫「書卷全名 第N章」', () => {
    expect(chapterHeading(route.verses[7]!)).toEqual({ kind: 'named', no: '第一章', name: '從亞當到以東列王' });
    expect(chapterHeading(route.verses[2]!)).toEqual({ kind: 'book', label: '歷代志上 第23章' });
    expect(chapterHeading(route.verses[0]!)).toEqual({ kind: 'book', label: '創世記 第4章' });
  });

  it('中文數字', () => {
    expect([1, 9, 10, 11, 19, 20, 21, 99].map(chineseNumber)).toEqual(['一', '九', '十', '十一', '十九', '二十', '二十一', '九十九']);
    expect(chineseNumber(120)).toBe('120');
  });

  it('換畫面的標題卡：印章寫畫面名，大字是段落標題，小字是書卷全名 第N章', () => {
    expect(cardText(route.verses[2]!, true)).toEqual({ seal: '職位', big: '利未人的班次', small: '歷代志上 第23章', bigIsTitle: true });
    expect(cardText(route.verses[3]!, true).seal).toBe('家譜');
    // 代上 1–9 換回家譜樹時，大字用所屬小段
    expect(cardText(route.verses[7]!, true).big).toBe('亞當的後代');
  });

  it('沒換畫面的章名卡：代上 1–9 照第一階段，其他書卷用段落標題', () => {
    expect(cardText(route.verses[7]!, false)).toEqual({ seal: '歷代志上', big: '第一章', small: '從亞當到以東列王', bigIsTitle: false });
    expect(cardText(route.verses[0]!, false)).toEqual({ seal: '創世記', big: '該隱和塞特的後代', small: '創世記 第4章', bigIsTitle: true });
  });
});

describe('進到一節：換畫面、標題卡、停多久', () => {
  const route = buildRoute(sample());
  const plan = (index: number, state: { renderedFragment: number; shown: StageId | null; follow?: boolean; wantCard?: boolean }) =>
    entryPlan(route.verses[index]!, { follow: true, wantCard: true, ...state });

  it('段落開頭又要換畫面，只出一張「換畫面」的卡', () => {
    const result = plan(2, { renderedFragment: route.verses[1]!.fragmentIndex, shown: 'tree' });
    expect(result).toEqual({ switching: true, fragmentChanged: true, card: 'switch' });
  });

  it('沒換畫面但換了章片段：出章名卡', () => {
    const result = plan(5, { renderedFragment: route.verses[4]!.fragmentIndex, shown: 'roles' });
    expect(result).toEqual({ switching: false, fragmentChanged: true, card: 'chapter' });
  });

  it('同一章裡夾著另一個畫面的節：換畫面，不用重畫經文欄', () => {
    const result = plan(3, { renderedFragment: route.verses[2]!.fragmentIndex, shown: 'roles' });
    expect(result).toEqual({ switching: true, fragmentChanged: false, card: 'switch' });
  });

  it('同一個畫面、同一章：什麼都不做', () => {
    expect(plan(1, { renderedFragment: route.verses[0]!.fragmentIndex, shown: 'tree' })).toEqual({ switching: false, fragmentChanged: false, card: null });
  });

  it('偷看另一個畫面（沒有跟隨）時不換畫面', () => {
    expect(plan(2, { renderedFragment: route.verses[1]!.fragmentIndex, shown: 'tree', follow: false }).switching).toBe(false);
  });

  it('直接跳到章中間（不要標題卡）仍然會換畫面', () => {
    expect(plan(4, { renderedFragment: -1, shown: null, wantCard: false })).toEqual({ switching: true, fragmentChanged: true, card: null });
  });

  it('有標題卡就停 2.6 秒，沒有就照速度', () => {
    expect(gapAfterVerse('switch', 1.5)).toBe(2600);
    expect(gapAfterVerse('chapter', 1)).toBe(2600);
    expect(gapAfterVerse(null, 1)).toBe(520);
    expect(gapAfterVerse(null, 1.25)).toBeCloseTo(416);
  });
});

describe('歸回連結與鏡頭目標', () => {
  const data = sample();
  const route = buildRoute(data);

  it('前綴表：路線上到某一節之前已經讀過的連結，跳回前面就變少', () => {
    expect(route.linkOrder).toEqual([0, 1, 0]);
    expect(route.linksBefore[9]).toBe(0);
    expect([...linksReadBefore(route, 9)]).toEqual([]);
    expect([...linksReadBefore(route, 10)]).toEqual([0]);
    expect([...linksReadBefore(route, 11)].sort()).toEqual([0, 1]);
    expect([...linksReadBefore(route, 3)]).toEqual([]);
  });

  it('連結目標：current 先用家譜樹上的人，沒有才用職位圖成員', () => {
    expect(linkTargets(data.links[0])).toEqual({ tree: ['aaron'], roles: ['role:priests:g2'], boxes: ['priests'], current: 'aaron' });
    expect(linkTargets(data.links[1])).toEqual({ tree: [], roles: ['role:priests:g7'], boxes: ['priests'], current: 'role:priests:g7' });
    // 只連到方塊、沒指到成員：方塊亮，沒有 current
    expect(linkTargets(data.links[2])).toEqual({ tree: [], roles: [], boxes: ['gate'], current: null });
    expect(linkTargets(undefined).current).toBeNull();
  });

  it('跳讀時鏡頭停在本小段最後出現的人', () => {
    // 代上 1 的第 2 節有 seth；代上 1:1 往前找不到（不跨小段），代上 1:2 自己就是
    expect(anchorPerson(route, 8)).toBe('seth');
    expect(anchorPerson(route, 7)).toBeNull();
    expect(anchorPerson(route, 3)).toBe('levi');
    expect(anchorPerson(route, 4)).toBe('levi');
  });
});

describe('真正的讀經路線', () => {
  const route = buildRoute(READING);

  it('每一節都有唯一的 key', () => {
    expect(new Set(route.verses.map((item) => item.key)).size).toBe(route.verses.length);
    expect(route.verses.length).toBeGreaterThan(1000);
  });

  it('起點、各種 #read= 都能打開', () => {
    expect(route.verses[startIndex(route, READING.start)]!.key).toBe(READING.start);
    for (const ref of ['創5:3', '代上24:10', '拉2:61', '路3:23', '代上2:4', '代上11:10']) {
      expect(resolveRef(route, ref), ref).not.toBeNull();
    }
  });

  it('每個段落的第一節就是 segmentStart，段落由頭到尾連續', () => {
    READING.segments.forEach((segment, index) => {
      const first = route.verses[route.segmentStart[index]!]!;
      expect(first.segmentIndex).toBe(index);
      expect(first.firstInSegment).toBe(true);
      expect(first.chapter.book).toBe(segment.chapters[0]!.book);
    });
    let last = 0;
    for (const item of route.verses) {
      expect(item.segmentIndex).toBeGreaterThanOrEqual(last);
      last = item.segmentIndex;
    }
  });

  it('歸回連結的索引都在 links 範圍內', () => {
    for (const index of route.linkOrder) expect(READING.links[index]).toBeDefined();
  });
});

describe('城牆畫面接進讀經', () => {
  const route = buildRoute(READING);

  it('尼 3 整段走城牆畫面，標題卡寫「城牆」', () => {
    const first = route.verses[resolveRef(route, '尼3:1')!]!;
    const last = route.verses[resolveRef(route, '尼3:32')!]!;
    expect(first.stage).toBe('wall');
    expect(last.stage).toBe('wall');
    expect(first.segment.id).toBe(last.segment.id);
    expect(STAGE_LABEL.wall).toEqual({ card: '城牆', view: '城牆' });
    expect(cardText(first, true).seal).toBe('城牆');
  });

  it('疊在畫布上的畫面包含城牆；城牆和名冊都是名單類', () => {
    expect(OVERLAY_STAGES).toEqual(expect.arrayContaining(['roles', 'roster', 'wall']));
    expect(OVERLAY_STAGES).not.toContain('tree');
    expect(isListStage('wall')).toBe(true);
    expect(isListStage('roster')).toBe(true);
    expect(isListStage('roles')).toBe(false);
  });

  it('從城牆讀到名冊（尼 3 → 尼 7）會換畫面；讀回前面就換回來', () => {
    const wallEnd = route.verses[resolveRef(route, '尼3:32')!]!;
    const next = route.verses[wallEnd.index + 1]!;
    expect(next.stage).toBe('roster');
    expect(entryPlan(next, { renderedFragment: wallEnd.fragmentIndex, shown: 'wall', follow: true, wantCard: true }).switching).toBe(true);
    const before = route.verses[resolveRef(route, '尼3:1')!.valueOf() - 1]!;
    expect(entryPlan(wallEnd, { renderedFragment: before.fragmentIndex, shown: before.stage, follow: true, wantCard: true }).switching).toBe(before.stage !== 'wall');
  });

  it('偷看：城牆 → 家譜樹；城牆段裡從家譜樹偷看回來還是城牆；名冊段照舊', () => {
    expect(otherStage('wall', 'wall')).toBe('tree');
    expect(otherStage('tree', 'wall')).toBe('wall');
    expect(otherStage('roles', 'wall')).toBe('wall');
    expect(otherStage('roster', 'roster')).toBe('tree');
    expect(otherStage('tree', 'roster')).toBe('roster');
    expect(otherStage('tree', 'tree')).toBe('roles');
    expect(otherStage('roles', 'tree')).toBe('tree');
  });

  it('朗讀處的鏡頭目標：名冊「roster:now」、城牆「wall:now」，其他畫面沒有', () => {
    expect(listFocusTarget('roster')).toBe('roster:now');
    expect(listFocusTarget('wall')).toBe('wall:now');
    expect(listFocusTarget('tree')).toBeNull();
    expect(listFocusTarget('roles')).toBeNull();
  });

  it('跳到某一節：寫法有空格、全形冒號都找得到；路線上沒有就是 null', () => {
    const key = '拉10:25';
    const index = jumpIndex(route, key);
    expect(index).not.toBeNull();
    expect(route.verses[index!]!.key).toBe(key);
    expect(jumpIndex(route, ' 尼 3：15 ')).toBe(resolveRef(route, '尼3:15'));
    expect(jumpIndex(route, '拉999:1')).toBeNull();
    expect(jumpIndex(route, '')).toBeNull();
  });
});
