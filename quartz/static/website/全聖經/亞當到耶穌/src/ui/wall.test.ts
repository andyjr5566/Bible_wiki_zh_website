import { describe, expect, it } from 'vitest';
import wallJson from '../data/wall.json';
import type { WallData } from '../data/types';
import {
  allocateRing, boxesOverlap, estimateLabelSize, estimateTagSize, itemStart, layoutWall, miniReserve, returnReserve, ringPoint, shownCount,
  tagLines, tagThresholds, wallIndexes, wallState, type Box, type Placed,
} from './wall-model';

const wall = wallJson as unknown as WallData;
const parts = wall.ring.filter((item) => item.kind === 'part');

describe('位置分配', () => {
  const slots = allocateRing(wall.ring, 0.04);

  it('每一項都有位置，次序和經文次序一致', () => {
    expect(slots.length).toBe(wall.ring.length);
    for (let i = 1; i < slots.length; i += 1) expect(slots[i]!.tc).toBeGreaterThan(slots[i - 1]!.tc);
  });

  it('第一個門在起點（正上方），繞回起點的門在 t=1，同一個點', () => {
    const shape = { cx: 0, cy: 0, rx: 100, ry: 100 };
    const first = ringPoint(shape, slots[0]!.tc);
    const last = ringPoint(shape, slots[slots.length - 1]!.tc);
    expect(first.x).toBeCloseTo(last.x, 3);
    expect(first.y).toBeCloseTo(last.y, 3);
    expect(first.y).toBeLessThan(-80);
    expect(wall.ring[0]!.kind).toBe('gate');
    expect(wall.ring[wall.ring.length - 1]!.back).toBe(true);
  });

  it('每一段等長，連續兩個點不會疊在一起', () => {
    const widths = slots.filter((slot) => slot.kind === 'part').map((slot) => slot.t1 - slot.t0);
    for (const width of widths) expect(width).toBeCloseTo(widths[0]!, 9);
    for (let i = 1; i < slots.length; i += 1) {
      expect(slots[i]!.t0).toBeGreaterThanOrEqual(slots[i - 1]!.t1 - 1e-9);
    }
  });

  it('逆時針：從正上方出發先往左（西）、再往下（南）、再往右（東）', () => {
    const shape = { cx: 0, cy: 0, rx: 100, ry: 100 };
    expect(ringPoint(shape, 0.25).x).toBeLessThan(-80);
    expect(ringPoint(shape, 0.5).y).toBeGreaterThan(80);
    expect(ringPoint(shape, 0.75).x).toBeGreaterThan(80);
  });
});

describe('讀到哪寫到哪', () => {
  const idx = wallIndexes(wall);
  const verseLen = () => 60;

  it('每一項所在的節都找得到', () => {
    for (const at of idx) expect(at).toBeGreaterThanOrEqual(0);
  });

  it('還沒讀到這一節：一項都沒有；讀完整圈：全部讀過', () => {
    const none = wallState(wall, idx, -1, 99, verseLen);
    expect(none.reached.every((value) => !value)).toBe(true);
    expect(none.nowItem).toBe(-1);
    const all = wallState(wall, idx, wall.verses.length - 1, 999, verseLen);
    expect(all.reached.every(Boolean)).toBe(true);
    wall.ring.forEach((item, i) => { if (item.kind === 'part') expect(all.progress[i]).toBe(1); });
  });

  it('從尼 3:15 直接打開：3:1–3:14 的段都已經讀過', () => {
    const cur = wall.verses.indexOf('尼3:15');
    const state = wallState(wall, idx, cur, 0, verseLen);
    wall.ring.forEach((item, i) => {
      if (item.kind !== 'part') return;
      const verse = wall.verses.indexOf(item.at);
      if (verse < cur) { expect(state.reached[i], item.at).toBe(true); expect(state.progress[i]).toBe(1); }
      if (verse > cur) expect(state.reached[i], item.at).toBe(false);
    });
  });

  it('段的進度：從第一個名字開始到節尾', () => {
    const index = wall.ring.findIndex((item) => item.kind === 'part' && item.at === '尼3:15');
    const start = itemStart(wall.ring[index]!);
    const cur = wall.verses.indexOf('尼3:15');
    expect(wallState(wall, idx, cur, start - 1, () => 61).reached[index]).toBe(false);
    expect(wallState(wall, idx, cur, start, () => 61).reached[index]).toBe(true);
    expect(wallState(wall, idx, cur, start, () => 61).progress[index]).toBe(0);
    const middle = wallState(wall, idx, cur, start + (61 - start) / 2, () => 61).progress[index]!;
    expect(middle).toBeGreaterThan(0.45);
    expect(middle).toBeLessThan(0.55);
    expect(wallState(wall, idx, cur, 61, () => 61).progress[index]).toBe(1);
  });

  it('門讀到它的名字才亮；繞回起點那一項在尼 3:32', () => {
    const gate = wall.ring.findIndex((item) => item.kind === 'gate' && item.t === '魚門');
    const cur = wall.verses.indexOf('尼3:3');
    expect(wallState(wall, idx, cur, 7, verseLen).reached[gate]).toBe(false);
    expect(wallState(wall, idx, cur, 8, verseLen).reached[gate]).toBe(true);
    const back = wall.ring.length - 1;
    const last = wall.verses.indexOf('尼3:32');
    expect(wallState(wall, idx, last, 10, verseLen).reached[back]).toBe(false);
    expect(wallState(wall, idx, last, 11, verseLen).reached[back]).toBe(true);
  });

  it('shownCount：前面的節整段、後面的節沒有、這一節看門檻', () => {
    expect(shownCount([2, 3, 5], 4, 3, 0)).toBe(3);
    expect(shownCount([2, 3, 5], 4, 5, 99)).toBe(0);
    expect(shownCount([2, 3, 5], 4, 4, 3)).toBe(2);
    expect(shownCount([2, 3, 5], -1, 4, 9)).toBe(0);
  });
});

describe('名牌上的字', () => {
  it('名字之間用「、」，「、」跟著下一個名字出現；名字不拆開', () => {
    const lines = tagLines([{ t: '耶利哥人', s: 3 }, { t: '撒刻', s: 18 }], 8);
    expect(lines.map((line) => line.map((c) => c.ch).join('')).join('|')).toBe('耶利哥人、撒刻');
    expect(lines[0]!.find((c) => c.ch === '、')!.at).toBe(18);
    const wrapped = tagLines([{ t: '米拉提', s: 6 }, { t: '雅頓', s: 13 }, { t: '基遍人', s: 16 }, { t: '米斯巴人', s: 29 }], 8);
    expect(wrapped.length).toBeGreaterThan(1);
    for (const line of wrapped) expect(line.length).toBeLessThanOrEqual(9);
  });

  it('門檻單調不減（一個字一個字寫上去）', () => {
    for (const item of parts) {
      const thresholds = tagThresholds(tagLines(item.names!, 8));
      for (let i = 1; i < thresholds.length; i += 1) expect(thresholds[i]).toBeGreaterThanOrEqual(thresholds[i - 1]!);
    }
  });
});

describe('名牌不重疊', () => {
  const sizes = (fontTag: number, fontLabel: number) => {
    const landmarkSize = new Map<number, { w: number; h: number }>();
    const tagSize = new Map<number, { w: number; h: number }>();
    wall.ring.forEach((item, i) => {
      if (item.kind === 'part') tagSize.set(i, estimateTagSize(tagLines(item.names!, 8), fontTag, item.names!.some((name) => name.fam) ? 1 : 0));
      else landmarkSize.set(i, estimateLabelSize(item.t ?? '', fontLabel));
    });
    return { landmarkSize, tagSize };
  };

  function assertNoOverlap(boxes: Array<{ id: string; box: Box }>) {
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(boxesOverlap(boxes[i]!.box, boxes[j]!.box), `${boxes[i]!.id} 與 ${boxes[j]!.id} 重疊`).toBe(false);
      }
    }
  }

  const collect = (layout: ReturnType<typeof layoutWall>) => [
    ...[...layout.landmarks].flatMap(([i, p]) => (p ? [{ id: `門${i}`, box: p.box }] : [])),
    ...[...layout.tags].flatMap(([i, p]) => (p ? [{ id: `牌${i}`, box: p.box }] : [])),
  ];

  it('桌機：三十一段全部讀過，任兩個名牌（連同門名）的外框都不相交，也不蓋小地圖', () => {
    for (const board of [{ w: 855, h: 665 }, { w: 760, h: 640 }, { w: 1100, h: 700 }]) {
      const { landmarkSize, tagSize } = sizes(13.5, 13);
      const layout = layoutWall({
        data: wall, board, compact: false, landmarkSize, tagSize, unit: 20, thickness: 12,
        obstacles: [miniReserve(board, 1280), returnReserve(board, 1280)],
      });
      // 門名都放得下，而且離自己的門不遠；寬敞的畫面名牌全部在圈外
      expect([...layout.landmarks.values()].every(Boolean), `${board.w}×${board.h} 有門名放不下`).toBe(true);
      if (board.w >= 850) expect(layout.inside, `${board.w}×${board.h} 有名牌在圈裡`).toBe(0);
      assertNoOverlap(collect(layout));
      const mini = miniReserve(board, 1280);
      for (const { id, box } of collect(layout)) expect(boxesOverlap(box, mini), `${id} 蓋到小地圖`).toBe(false);
      expect([...layout.tags.values()].filter((placed) => placed === null).length, `${board.w}×${board.h} 有名牌放不下`).toBe(0);
    }
  });

  it('手機：目前這一段加上點開的一段，名牌互不相交，也不蓋小地圖鈕', () => {
    const board = { w: 390, h: 295 };
    const { landmarkSize, tagSize } = sizes(14, 10.5);
    const partIndexes = wall.ring.flatMap((item, i) => (item.kind === 'part' ? [i] : []));
    for (let k = 0; k < partIndexes.length; k += 1) {
      const want = [partIndexes[k]!, partIndexes[(k + 7) % partIndexes.length]!];
      const layout = layoutWall({
        data: wall, board, compact: true, landmarkSize, tagSize, unit: 15, thickness: 8,
        obstacles: [miniReserve(board, 390), returnReserve(board, 390)], wantTags: want,
      });
      const placed = layout.tags.get(want[0]!) as Placed | null;
      expect(placed, `第 ${want[0]} 項放得下`).not.toBeNull();
      assertNoOverlap(collect(layout));
      // 目前這一段的名牌一定在；極少數名牌帶著家族小籤、特別大時，最多讓一個門名先不顯示
      expect([...layout.landmarks.values()].filter((value) => value === null).length, '手機門名放不下太多').toBeLessThanOrEqual(1);
      for (const { id, box } of collect(layout)) expect(boxesOverlap(box, miniReserve(board, 390)), `${id} 蓋到小地圖鈕`).toBe(false);
    }
  });
});
