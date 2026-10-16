import { describe, expect, it } from 'vitest';
import rosterSource from '../data/roster.json';
import type { ReadingLink, Roster, RosterData, RosterRow } from '../data/types';
import {
  countText, familyLead, familyTags, isPlain, namesBar, pipAllowed, rosterClassName, rosterMark, rowKind, sealTilt, sectionHasTitle, tileClassName, totalUnitText,
  PIP_COMPACT_CARDS, PIP_MAX_CARDS, barFraction, barProgress, barWidth, charsShown, numberLength, currentRowIndex, flattenRows, formatCount, hasBar, isLandmark, linkMark, mergeMarks, miniLayout, nameShown,
  pickPipLinks, pipChain, pipNames, pipPeople, pipTitle, reached, refGroups, refLabel, refsText, rowState, verseIndex,
} from './roster-model';

const roster: Roster = {
  segment: 'ezra2',
  title: '歸回的名冊',
  verses: ['拉2:1', '拉2:2', '拉2:3', '拉2:4', '拉2:5', '拉2:6'],
  max: 3630,
  sections: [
    {
      title: '帶領回來的',
      rows: [
        { at: '拉2:2', s: 0, names: [{ t: '所羅巴伯', s: 3 }, { t: '耶書亞', s: 8, link: 0 }, { t: '尼希米', s: 12 }] },
      ],
    },
    {
      title: '照家族',
      rows: [
        { at: '拉2:3', s: 2, label: '巴錄的子孫', count: 2172, n: 10, unit: '名', links: [1] },
        { at: '拉2:4', s: 0, label: '示法提雅的子孫', count: 372, unit: '名' },
        { at: '拉2:5', s: 4, label: '亞拉的子孫', count: 775, n: 9, unit: '名', differs: true },
      ],
    },
    {
      title: '尋不著的',
      lost: true,
      rows: [{ at: '拉2:6', s: 0, label: '何巴雅', quote: { t: '卻尋不著', s: 5 } }],
    },
  ],
};

const rowOf = (at: string): RosterRow => roster.sections.flatMap((section) => section.rows).find((row) => row.at === at)!;

describe('文字', () => {
  it('千分位', () => {
    expect(formatCount(2172)).toBe('2,172');
    expect(formatCount(42360)).toBe('42,360');
    expect(formatCount(61)).toBe('61');
  });
  it('出處在書卷和章之間加一個空格', () => {
    expect(refLabel('代上9:12')).toBe('代上 9:12');
    expect(refLabel('撒下19:31-39')).toBe('撒下 19:31-39');
    expect(refLabel('尼7:5')).toBe('尼 7:5');
    expect(refLabel('代上 9:12')).toBe('代上 9:12');
    expect(refsText(['代上9:17', '拉2:42'])).toBe('代上 9:17、拉 2:42');
  });
});

describe('讀到哪寫到哪', () => {
  it('經節的位置', () => {
    expect(verseIndex(roster, '拉2:1')).toBe(0);
    expect(verseIndex(roster, '拉2:5')).toBe(4);
    expect(verseIndex(roster, '尼7:5')).toBe(-1);
  });

  it('前面的節整節都算讀過，這一節要讀到那個字，後面的節還沒讀', () => {
    expect(reached(3, 2, 0, 99)).toBe(true);
    expect(reached(3, 3, 4, 4)).toBe(true);
    expect(reached(3, 3, 3, 4)).toBe(false);
    expect(reached(3, 4, 999, 0)).toBe(false);
    expect(reached(-1, 0, 5, 0)).toBe(false);
    expect(reached(3, -1, 5, 0)).toBe(false);
  });

  it('一行：讀到 s 才出現，讀到 n 人數條才伸滿、數字才出現', () => {
    const row = rowOf('拉2:3');
    const idx = verseIndex(roster, row.at);
    expect(rowState(row, idx, idx, 1)).toMatchObject({ visible: false, filled: false });
    expect(rowState(row, idx, idx, 2)).toMatchObject({ visible: true, filled: false });
    expect(rowState(row, idx, idx, 9)).toMatchObject({ visible: true, filled: false });
    expect(rowState(row, idx, idx, 10)).toMatchObject({ visible: true, filled: true });
    // 讀到後面的節，這一行整個畫好
    expect(rowState(row, idx + 1, idx, 0)).toMatchObject({ visible: true, filled: true });
    // 還沒讀到這一節
    expect(rowState(row, idx - 1, idx, 999)).toMatchObject({ visible: false, filled: false });
  });

  it('沒有 n 的行：數字跟著行一起出現', () => {
    const row = rowOf('拉2:4');
    const idx = verseIndex(roster, row.at);
    expect(rowState(row, idx, idx, 0)).toMatchObject({ visible: true, filled: true });
  });

  it('名字一個個出現', () => {
    const row = rowOf('拉2:2');
    const idx = verseIndex(roster, row.at);
    const names = row.names!;
    expect(rowState(row, idx, idx, 2).namesShown).toBe(0);
    expect(rowState(row, idx, idx, 3).namesShown).toBe(1);
    expect(rowState(row, idx, idx, 11).namesShown).toBe(2);
    expect(rowState(row, idx, idx, 12).namesShown).toBe(3);
    expect(rowState(row, idx + 1, idx, 0).namesShown).toBe(3);
    expect(nameShown(names[1]!, idx, idx, 7)).toBe(false);
    expect(nameShown(names[1]!, idx, idx, 8)).toBe(true);
  });

  it('引句：讀到 quote.s 才出現', () => {
    const row = rowOf('拉2:6');
    const idx = verseIndex(roster, row.at);
    expect(rowState(row, idx, idx, 4).quoteShown).toBe(false);
    expect(rowState(row, idx, idx, 5).quoteShown).toBe(true);
    expect(rowState(rowOf('拉2:4'), 3, 3, 99).quoteShown).toBe(false);
  });

  it('跳回前面：後面的行就少掉', () => {
    const flat = flattenRows(roster);
    const visible = (cur: number, chars: number) => flat.filter((item) => rowState(item.row, cur, item.idx, chars).visible).length;
    expect(visible(5, 99)).toBe(5);
    expect(visible(3, 0)).toBe(3);
    expect(visible(2, 0)).toBe(1);
    expect(visible(1, 0)).toBe(1);
    expect(visible(0, 0)).toBe(0);
  });

  it('目前讀到的那一行是已經出現的最後一行', () => {
    const flat = flattenRows(roster);
    expect(currentRowIndex(flat, 0, 0)).toBe(-1);
    expect(currentRowIndex(flat, 2, 0)).toBe(0);
    expect(currentRowIndex(flat, 2, 2)).toBe(1);
    expect(currentRowIndex(flat, 3, 0)).toBe(2);
    expect(currentRowIndex(flat, 5, 99)).toBe(4);
  });

  it('人數條：有人數、行與分區沒說不畫才畫', () => {
    const section = { bars: undefined as boolean | undefined };
    expect(hasBar(section, rowOf('拉2:3'))).toBe(true);
    expect(hasBar(section, { ...rowOf('拉2:3'), bar: false })).toBe(false);
    expect(hasBar({ bars: false }, rowOf('拉2:3'))).toBe(false);
    expect(hasBar({ bars: false }, { ...rowOf('拉2:3'), bar: true })).toBe(true);
    expect(hasBar(section, rowOf('拉2:6'))).toBe(false);
    expect(hasBar(section, { at: '拉2:3', s: 0, count: 392, total: true })).toBe(false);
    expect(hasBar(section, { at: '拉2:64', s: 0, count: 42360, big: true })).toBe(false);
  });

  it('人數條長度＝人數 ÷ 最大的一行', () => {
    expect(barFraction(3630, 3630)).toBe(1);
    expect(barFraction(1815, 3630)).toBe(0.5);
    expect(barFraction(5000, 3630)).toBe(1);
    expect(barFraction(10, 0)).toBe(0);
    expect(barFraction(0, 3630)).toBe(0);
  });
});

describe('冊上有名、家譜裡有這座城', () => {
  const links: ReadingLink[] = [
    { at: '拉2:2', word: '耶書亞', to: [{ tree: '耶書亞' }], effect: 'link', refs: ['代上9:12'] },
    { at: '拉2:3', word: '巴錄', to: [{ tree: '巴錄' }], effect: 'returned', refs: ['代上9:13', '代上9:14'] },
    { at: '拉2:21', word: '伯利恆', to: [{ tree: '薩瑪' }], effect: 'town', refs: ['代上2:51'], pip: '伯利恆之祖薩瑪' },
    { at: '拉2:61', word: '哈歌斯', to: [{ role: 'priests', member: 'x' }], effect: 'lost', refs: ['代上24:10'] },
    { at: '拉2:42', word: '沙龍', to: [{ tree: '沙龍' }], effect: 'link', card: '「守門的是沙龍」', refs: ['代上9:17'] },
    { at: '拉2:42', word: '達們', to: [{ tree: '達們' }], effect: 'link', refs: ['代上9:17'] },
  ];

  it('returned 與 link 讀到才算冊上有名，出處照連結', () => {
    expect(linkMark(links, [1], new Set([1]))).toEqual({ kind: 'named', refs: ['代上9:13', '代上9:14'] });
    expect(linkMark(links, [0], new Set([0]))).toEqual({ kind: 'named', refs: ['代上9:12'] });
  });
  it('還沒讀到的連結不算；跳回前面（links 變少）標記就拿掉', () => {
    expect(linkMark(links, [1], new Set())).toEqual({ kind: null, refs: [] });
    expect(linkMark(links, [0, 1], new Set([0]))).toEqual({ kind: 'named', refs: ['代上9:12'] });
    expect(linkMark(links, [0, 1], new Set())).toEqual({ kind: null, refs: [] });
  });
  it('town 是較淡的標記；lost 不加金色', () => {
    expect(linkMark(links, [2], new Set([2]))).toEqual({ kind: 'town', refs: ['代上2:51'] });
    expect(linkMark(links, [3], new Set([3]))).toEqual({ kind: null, refs: [] });
  });
  it('兩種都讀到時冊上有名優先', () => {
    expect(linkMark(links, [1, 2], new Set([1, 2]))).toEqual({ kind: 'named', refs: ['代上9:13', '代上9:14'] });
  });
  it('沒有的索引不出錯', () => {
    expect(linkMark(links, [99], new Set([99]))).toEqual({ kind: null, refs: [] });
  });
  it('名字行的標記合併、出處併行', () => {
    const a = linkMark(links, [4], new Set([4, 5]));
    const b = linkMark(links, [5], new Set([4, 5]));
    expect(mergeMarks([a, b])).toEqual({ kind: 'named', refs: ['代上9:17'] });
    expect(mergeMarks([{ kind: null, refs: [] }])).toEqual({ kind: null, refs: [] });
    expect(refGroups([{ label: '沙龍', refs: ['代上9:17'] }, { label: '達們', refs: ['代上9:17'] }, { label: '亞薩', refs: ['代上25:1'] }, { label: '無', refs: [] }]))
      .toEqual([{ labels: ['沙龍', '達們'], refs: '代上 9:17' }, { labels: ['亞薩'], refs: '代上 25:1' }]);
  });

  it('子母畫面：目前這一節、讀到的、不是 lost、有家譜樹上的人', () => {
    const onTree = (id: string) => id !== '不在樹上';
    expect(pickPipLinks(links, '拉2:42', new Set([4, 5]), onTree)).toEqual([4, 5]);
    expect(pickPipLinks(links, '拉2:42', new Set([4]), onTree)).toEqual([4]);
    expect(pickPipLinks(links, '拉2:42', new Set(), onTree)).toEqual([]);
    expect(pickPipLinks(links, '拉2:43', new Set([4, 5]), onTree)).toEqual([]);
    expect(pickPipLinks(links, '拉2:61', new Set([3]), onTree)).toEqual([]);
    expect(pickPipLinks(links, '拉2:42', new Set([4]), () => false)).toEqual([]);
  });

  it('小窗的人：不重複，最多三位', () => {
    const onTree = () => true;
    expect(pipPeople(links, [4, 5], onTree)).toEqual(['沙龍', '達們']);
    expect(pipPeople(links, [4, 4, 5], onTree)).toEqual(['沙龍', '達們']);
    const many: ReadingLink[] = ['甲', '乙', '丙', '丁'].map((id) => ({ at: 'x', word: id, to: [{ tree: id }], effect: 'link', refs: [] }));
    expect(pipPeople(many, [0, 1, 2, 3], onTree)).toEqual(['甲', '乙', '丙']);
  });

  it('小窗標題：有 pip 用 pip，沒有用人名，用頓號接', () => {
    const onTree = () => true;
    const nameOf = (id: string) => id;
    expect(pipNames(links, [2], onTree, nameOf)).toEqual(['伯利恆之祖薩瑪']);
    expect(pipNames(links, [4, 5], onTree, nameOf)).toEqual(['沙龍', '達們']);
    expect(pipNames(links, [2, 4], onTree, nameOf)).toEqual(['伯利恆之祖薩瑪', '沙龍']);
    expect(pipTitle(['沙龍', '達們', '亞谷'])).toBe('家譜樹上的沙龍、達們、亞谷');
  });
});

describe('家譜樹的一小角', () => {
  // 讀者認得的人：大衛、亞倫、以色列的兒子（這裡用「猶大」「利未」代表）
  const anchors = new Set(['大衛', '亞倫', '猶大', '利未']);
  const isAnchor = (id: string) => anchors.has(id);
  const ids = (items: ReturnType<typeof pipChain>) => items.map((item) => ('gap' in item ? '⋮' : item.id));

  it('讀者認得的人：大衛、亞倫、以色列的兒子；父母裡有以色列的人', () => {
    expect(isLandmark('大衛', ['耶西'])).toBe(true);
    expect(isLandmark('亞倫', ['暗蘭'])).toBe(true);
    expect(isLandmark('利未', ['以色列', '利亞'])).toBe(true);
    expect(isLandmark('以色列', ['以撒'])).toBe(true);
    expect(isLandmark('沙龍', ['可利'])).toBe(false);
    expect(isLandmark('撒拉鐵', ['耶哥尼雅'])).toBe(false);
  });

  it('5 張以內全取，由上往下排，最後一張是那個人', () => {
    expect(ids(pipChain(['沙龍', '可利', '以比雅撒', '可拉', '利未'], isAnchor))).toEqual(['利未', '可拉', '以比雅撒', '可利', '沙龍']);
    expect(ids(pipChain(['人', 'b', '利未'], isAnchor))).toEqual(['利未', 'b', '人']);
  });

  it('停在第一位讀者認得的人，不再往上', () => {
    expect(ids(pipChain(['薩瑪', '戶珥', '猶大', '以色列', '以撒'], isAnchor))).toEqual(['猶大', '戶珥', '薩瑪']);
    expect(ids(pipChain(['人', '父', '大衛', '耶西', '俄備得'], isAnchor))).toEqual(['大衛', '父', '人']);
  });

  it('所羅巴伯：接到大衛，超過 5 張取最上面＋⋮＋最近 3 位', () => {
    const path = ['所羅巴伯', '撒拉鐵', '耶哥尼雅', '約雅敬', '約西亞', '亞們', '瑪拿西', '大衛', '耶西', '亞當'];
    expect(ids(pipChain(path, isAnchor))).toEqual(['大衛', '⋮', '耶哥尼雅', '撒拉鐵', '所羅巴伯']);
    const short = ['所羅巴伯', '撒拉鐵', '耶哥尼雅', '大衛', '耶西', '亞當'];
    expect(ids(pipChain(short, isAnchor))).toEqual(['大衛', '耶哥尼雅', '撒拉鐵', '所羅巴伯']);
  });

  it('那個人自己就是認得的人：多帶他的父親一層', () => {
    expect(ids(pipChain(['大衛', '耶西', '俄備得'], isAnchor))).toEqual(['耶西', '大衛']);
    expect(ids(pipChain(['大衛'], isAnchor))).toEqual(['大衛']);
  });

  it('一路都沒遇到：停在亞當前面的最後一位', () => {
    expect(ids(pipChain(['人', 'b', 'c', '亞當'], () => false))).toEqual(['c', 'b', '人']);
    expect(ids(pipChain(['人', '亞當'], () => false))).toEqual(['人']);
    // 路徑沒有走到亞當（只有他自己）：照原樣
    expect(ids(pipChain(['人'], () => false))).toEqual(['人']);
    expect(ids(pipChain(['人', 'b', 'c'], () => false))).toEqual(['c', 'b', '人']);
  });

  it('超過 5 張：最上面一位＋⋮＋離他最近的 3 位；剛好 5 張不截斷', () => {
    expect(ids(pipChain(['人', 'b', 'c', 'd', 'e', 'f', 'g'], () => false))).toEqual(['g', '⋮', 'c', 'b', '人']);
    expect(ids(pipChain(['人', 'b', 'c', 'd', 'e', 'f'], () => false))).toEqual(['f', '⋮', 'c', 'b', '人']);
    const five = pipChain(['人', 'b', 'c', 'd', 'e'], () => false);
    expect(five.length).toBe(5);
    expect(five.length).toBeLessThanOrEqual(PIP_MAX_CARDS + 1);
  });

  it('手機：最多 3 張卡，最上面那位＋⋮＋那個人', () => {
    expect(ids(pipChain(['人', 'b', 'c', 'd'], () => false, PIP_COMPACT_CARDS))).toEqual(['d', '⋮', '人']);
    expect(ids(pipChain(['人', 'b', 'c'], () => false, PIP_COMPACT_CARDS))).toEqual(['c', 'b', '人']);
    expect(ids(pipChain(['所羅巴伯', '撒拉鐵', '耶哥尼雅', '大衛', '耶西'], isAnchor, PIP_COMPACT_CARDS))).toEqual(['大衛', '⋮', '所羅巴伯']);
  });

  it('空的路徑回空的', () => {
    expect(pipChain([], isAnchor)).toEqual([]);
  });
});

describe('縮圖', () => {
  it('座標在 0–1 之間，每一行都有位置', () => {
    const layout = miniLayout(roster);
    expect(layout.rowPos.length).toBe(flattenRows(roster).length);
    for (const line of layout.lines) {
      expect(line.y).toBeGreaterThanOrEqual(0);
      expect(line.y).toBeLessThanOrEqual(1);
      expect(line.x1).toBeGreaterThanOrEqual(0);
      expect(line.x2).toBeLessThanOrEqual(1);
      expect(line.x2).toBeGreaterThan(line.x1);
    }
    for (const pos of layout.rowPos) {
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.x).toBeLessThan(1);
    }
  });
  it('每個分區一條標題線，行的位置由上往下', () => {
    const layout = miniLayout(roster);
    expect(layout.lines.filter((line) => line.kind === 'head').length).toBe(roster.sections.length);
    const ys = layout.rowPos.map((pos) => pos.y);
    expect([...ys].sort((a, b) => a - b)).toEqual(ys);
  });
  it('空名冊不出錯', () => {
    const layout = miniLayout({ ...roster, sections: [] });
    expect(layout.lines).toEqual([]);
    expect(layout.rowPos).toEqual([]);
  });
});

describe('一個字一個字寫上去', () => {
  it('中文數字有幾個字', () => {
    expect(numberLength('巴錄的子孫二千一百七十二名；', 5)).toBe(7);
    expect(numberLength('他們有馬七百三十六匹', 4)).toBe(5);
    expect(numberLength('共一百三十九名。', 1)).toBe(5);
    expect(numberLength('猶大人三十名', 3)).toBe(2);
    expect(numberLength('兩千名', 0)).toBe(2);
    expect(numberLength('一萬零五十', 0)).toBe(5);
    expect(numberLength('數字在最後一二', 5)).toBe(2);
    expect(numberLength('沒有數字', 1)).toBe(0);
    expect(numberLength('', 0)).toBe(0);
    expect(numberLength('二', 5)).toBe(0);
  });

  it('讀到第 i 個字（chars ≥ start + i）那個字才出現', () => {
    // 這一節：label 從第 13 個字起，共 5 個字
    expect(charsShown(13, 5, 2, 2, 12)).toBe(0);
    expect(charsShown(13, 5, 2, 2, 13)).toBe(1);
    expect(charsShown(13, 5, 2, 2, 15)).toBe(3);
    expect(charsShown(13, 5, 2, 2, 17)).toBe(5);
    expect(charsShown(13, 5, 2, 2, 99)).toBe(5);
    // 讀到的位置可以是小數（兩個字之間）
    expect(charsShown(13, 5, 2, 2, 14.6)).toBe(2);
    expect(charsShown(13, 5, 2, 2, 12.9)).toBe(0);
  });

  it('前面的節整段都在、後面的節一個字都沒有、不在名冊裡什麼都沒有', () => {
    expect(charsShown(13, 5, 3, 2, 0)).toBe(5);
    expect(charsShown(13, 5, 2, 3, 99)).toBe(0);
    expect(charsShown(13, 5, -1, 2, 99)).toBe(0);
    expect(charsShown(13, 5, 2, -1, 99)).toBe(0);
    expect(charsShown(0, 0, 2, 2, 99)).toBe(0);
  });

  it('人數條跟著唸數字的字伸長', () => {
    // 數字從第 18 個字起，共 7 個字
    expect(barProgress(18, 7, 2, 2, 17)).toBe(0);
    expect(barProgress(18, 7, 2, 2, 18)).toBe(0);
    expect(barProgress(18, 7, 2, 2, 21.5)).toBeCloseTo(0.5, 5);
    expect(barProgress(18, 7, 2, 2, 25)).toBe(1);
    expect(barProgress(18, 7, 2, 2, 99)).toBe(1);
    expect(barProgress(18, 7, 3, 2, 0)).toBe(1);
    expect(barProgress(18, 7, 2, 3, 99)).toBe(0);
    expect(barProgress(18, 7, -1, 2, 99)).toBe(0);
    // 數字長度不知道時，唸到第一個字就伸滿
    expect(barProgress(5, 0, 2, 2, 4)).toBe(0);
    expect(barProgress(5, 0, 2, 2, 5)).toBe(1);
  });

  it('條寬＝人數比例 × 唸到哪', () => {
    expect(barWidth(3630, 3630, 1)).toBe(1);
    expect(barWidth(1815, 3630, 1)).toBe(0.5);
    expect(barWidth(1815, 3630, 0.5)).toBe(0.25);
    expect(barWidth(1815, 3630, 0)).toBe(0);
    expect(barWidth(1815, 3630, 2)).toBe(0.5);
    expect(barWidth(1815, 3630, -1)).toBe(0);
  });

  it('阿拉伯數字要等數字唸完才出現（chars ≥ n + 字數）', () => {
    const row = rowOf('拉2:3');
    const idx = verseIndex(roster, row.at);
    // 數字從第 10 個字起，共 7 個字（測試用的名冊 n 是 10）
    expect(rowState(row, idx, idx, 16, 7).filled).toBe(false);
    expect(rowState(row, idx, idx, 17, 7).filled).toBe(true);
    expect(rowState(row, idx + 1, idx, 0, 7).filled).toBe(true);
  });
});

const real = rosterSource as unknown as RosterData;
const realRoster = (segment: string): Roster => real.rosters.find((item) => item.segment === segment)!;
const allRows = (roster: Roster) => roster.sections.flatMap((section) => section.rows.map((row) => ({ section, row })));

describe('量詞', () => {
  it('沒有量詞（經文「男丁二百」）只顯示數字，「人」寫「150 人」，「名」照舊', () => {
    expect(countText(200, '')).toBe('200');
    expect(countText(200)).toBe('200');
    expect(countText(150, '人')).toBe('150 人');
    expect(countText(2172, '名')).toBe('2,172 名');
  });
  it('小計、總數：沒給量詞沿用「名」，空字串＝沒有量詞', () => {
    expect(totalUnitText()).toBe(' 名');
    expect(totalUnitText('人')).toBe(' 人');
    expect(totalUnitText('')).toBe('');
  });
  it('拉 8 沒有量詞、量詞「人」的行都畫人數條，比例照這份名冊自己的最大一行（300）', () => {
    const ezra8 = realRoster('ezra8');
    expect(ezra8.max).toBe(300);
    const bare = allRows(ezra8).find((item) => item.row.at === '拉8:4')!;
    expect(bare.row.unit).toBe('');
    expect(rowKind(bare.section, bare.row)).toBe('names');
    expect(namesBar(bare.section, bare.row)).toBe(true);
    expect(barFraction(bare.row.count!, ezra8.max)).toBeCloseTo(200 / 300, 5);
    const person = allRows(ezra8).find((item) => item.row.at === '拉8:3')!;
    expect(person.row.unit).toBe('人');
    expect(namesBar(person.section, person.row)).toBe(true);
    expect(barFraction(150, ezra8.max)).toBe(0.5);
  });
  it('沒有標籤的名字行（拉 2:42）照舊只有小計，不畫人數條', () => {
    const guards = allRows(realRoster('ezra2')).find((item) => item.row.at === '拉2:42')!;
    expect(namesBar(guards.section, guards.row)).toBe(false);
  });
  it('只有人數沒有名字的行（拉 8:20 尼提寧）畫人數條', () => {
    const item = allRows(realRoster('ezra8')).find((entry) => entry.row.at === '拉8:20')!;
    expect(rowKind(item.section, item.row)).toBe('bar');
  });
});

describe('中性的名冊（拉 10）', () => {
  const links: ReadingLink[] = [{ at: '拉10:18', word: '耶書亞', to: [{ tree: '耶書亞' }], effect: 'link', refs: ['代上9:12'] }];
  it('tone: plain 即使資料裡有連結也沒有標記，不開子母畫面', () => {
    const ezra10 = realRoster('ezra10');
    expect(isPlain(ezra10)).toBe(true);
    expect(rosterMark(ezra10, links, [0], new Set([0]))).toEqual({ kind: null, refs: [] });
    expect(pipAllowed(ezra10)).toBe(false);
    expect(rosterClassName(ezra10)).not.toContain('is-seal');
  });
  it('其他名冊照舊：有標記、開子母畫面', () => {
    const ezra2 = realRoster('ezra2');
    expect(isPlain(ezra2)).toBe(false);
    expect(rosterMark(ezra2, links, [0], new Set([0]))).toEqual({ kind: 'named', refs: ['代上9:12'] });
    expect(pipAllowed(ezra2)).toBe(true);
  });
  it('分區沒有標題就不畫標題（拉 10:44 的引句）', () => {
    const ezra10 = realRoster('ezra10');
    const last = ezra10.sections[ezra10.sections.length - 1]!;
    expect(last.title).toBe('');
    expect(sectionHasTitle(last)).toBe(false);
    expect(sectionHasTitle(ezra10.sections[0]!)).toBe(true);
    expect(last.rows[0]!.quote?.t).toBe('這些人都娶了外邦女子為妻，其中也有生了兒女的');
    expect(rowKind(last, last.rows[0]!)).toBe('quote');
  });
});

describe('簽名蓋印（尼 10）', () => {
  it('seal 名冊的名字牌有蓋印 class，其他沒有', () => {
    expect(tileClassName(realRoster('neh10'))).toBe('ag-rs-tile is-seal');
    expect(rosterClassName(realRoster('neh10'))).toContain('is-seal');
    expect(tileClassName(realRoster('ezra2'))).toBe('ag-rs-tile');
    expect(tileClassName(realRoster('ezra10'))).toBe('ag-rs-tile');
  });
  it('蓋印微微歪一點，角度固定、循環使用', () => {
    expect(sealTilt(0)).toBe(sealTilt(8));
    expect(Math.abs(sealTilt(3))).toBeLessThan(3);
    expect(sealTilt(-1)).toBe(sealTilt(7));
  });
});

describe('家族軌跡小籤', () => {
  const ezra2 = realRoster('ezra2');
  const row = allRows(ezra2).find((item) => item.row.at === '拉2:3')!.row;

  it('拉 2:3 那一行有「拉 10:25」「尼 7:8」兩個小籤，沒有自己', () => {
    const tags = familyTags(real.families, row.fam, ezra2.segment);
    expect(tags.map((tag) => tag.text)).toEqual(['拉 10:25', '尼 7:8 2,172 名']);
    expect(tags.map((tag) => tag.at)).toEqual(['拉10:25', '尼7:8']);
    expect(tags.some((tag) => tag.at === '拉2:3')).toBe(false);
    expect(tags[0]!.family).toBe('巴錄的子孫');
  });
  it('有人數寫人數加量詞，沒有量詞只寫數字，沒有人數只寫經節', () => {
    const family = real.families!.findIndex((item) => item.name === '巴哈摩押的子孫');
    const tags = familyTags(real.families, [family], 'neh7');
    expect(tags.map((tag) => tag.text)).toEqual(['拉 2:6 2,812 名', '拉 8:4 200', '拉 10:30']);
  });
  it('沒有家族、索引不存在、整份都是自己這份名冊：沒有小籤', () => {
    expect(familyTags(real.families, undefined, 'ezra2')).toEqual([]);
    expect(familyTags(real.families, [999], 'ezra2')).toEqual([]);
    expect(familyTags(undefined, [0], 'ezra2')).toEqual([]);
    const only = [{ name: '甲', places: [{ at: '拉2:1', seg: 'ezra2' }] }];
    expect(familyTags(only, [0], 'ezra2')).toEqual([]);
  });
  it('好幾個家族同一節只列一次', () => {
    const two = [
      { name: '甲', places: [{ at: '拉2:1', seg: 'ezra2' }, { at: '尼7:1', seg: 'neh7' }] },
      { name: '乙', places: [{ at: '尼7:1', seg: 'neh7' }, { at: '尼10:1', seg: 'neh10' }] },
    ];
    expect(familyTags(two, [0, 1], 'ezra2').map((tag) => tag.at)).toEqual(['尼7:1', '尼10:1']);
  });
  it('開頭那句：家族名和標籤、名字相同或被包含就只寫「也在」，不同才寫家族名', () => {
    const tags = familyTags(real.families, row.fam, ezra2.segment);
    expect(familyLead(tags, [row.label])).toBe('也在');
    expect(familyLead(tags, [undefined])).toBe('巴錄的子孫　也在');
    expect(familyLead(tags, ['耶書亞的子孫巴錄的子孫'])).toBe('也在');
    expect(familyLead(tags, ['巴錄的後裔'])).toBe('巴錄的子孫　也在');
    expect(familyLead(tags, ['甲'], '甲')).toBe('甲（巴錄的子孫）　也在');
    expect(familyLead([{ ...tags[0]!, family: '利未人耶書亞' }], ['耶書亞', undefined], '耶書亞')).toBe('利未人耶書亞　也在');
    expect(familyLead([{ ...tags[0]!, family: '西萊雅' }], ['西萊雅', undefined], '西萊雅')).toBe('西萊雅　也在');
  });
  it('每份名冊的小籤都指向別的名單，經節格式正確', () => {
    for (const roster of real.rosters) {
      for (const { row: item } of allRows(roster)) {
        for (const fam of [item.fam, ...(item.names ?? []).map((name) => name.fam)]) {
          for (const tag of familyTags(real.families, fam, roster.segment)) {
            expect(tag.ref).toMatch(/^\D+ \d+:\d+/);
            expect(tag.at).not.toBe('');
          }
        }
      }
    }
  });
});
