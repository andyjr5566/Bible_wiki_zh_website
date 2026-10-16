import { describe, expect, it } from 'vitest';
import { DATA, READING } from '../data/model';
import { RETURN_IDS, catalogGroups, returnCards, segmentStartKey, stopFocus, stopMode, stopRefs } from './entry-model';
import { buildRoute, resolveRef } from './reader-route';

describe('目錄', () => {
  const groups = catalogGroups(READING);
  const items = groups.flatMap((group) => group.items);

  it('讀經路線的每一段都在目錄裡，次序照讀經路線', () => {
    expect(items.length).toBe(READING.segments.length);
    expect(items.map((item) => item.id)).toEqual(READING.segments.map((segment) => segment.id));
    expect(items.map((item) => item.index)).toEqual(READING.segments.map((_, i) => i));
  });

  it('照 group 分組，組的次序照第一次出現，每組裡的段落連續', () => {
    const names = groups.map((group) => group.group);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...new Set(READING.segments.map((segment) => segment.group))]);
    for (const group of groups) {
      const indexes = group.items.map((item) => item.index);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
      expect(group.items.every((item) => READING.segments[item.index]!.group === group.group)).toBe(true);
    }
  });

  it('每一段有標題、範圍、畫面、介紹；點了從第一節開始，那一節在讀經路線上', () => {
    const route = buildRoute(READING);
    for (const item of items) {
      expect(item.title, item.id).not.toBe('');
      expect(item.range, item.id).not.toBe('');
      expect(item.intro, item.id).not.toBe('');
      expect(['tree', 'roles', 'roster', 'wall']).toContain(item.stage);
      const index = resolveRef(route, item.start);
      expect(index, item.id).not.toBeNull();
      expect(route.verses[index!]!.index).toBe(route.segmentStart[item.index]);
    }
  });

  it('段落的第一節 key', () => {
    expect(segmentStartKey(READING.segments[0]!)).toBe('創4:17');
    expect(segmentStartKey({ ...READING.segments[0]!, chapters: [] })).toBe('');
  });

  it('歸回、新約等分組都在，畫面圖示對得上段落的主要畫面', () => {
    expect(groups.map((group) => group.group)).toEqual(expect.arrayContaining(['創世記', '大衛立的職位', '歸回', '新約']));
    expect(items.find((item) => item.id === 'neh3')!.stage).toBe('wall');
    expect(items.find((item) => item.id === 'ezra2')!.stage).toBe('roster');
    expect(items.find((item) => item.id === 'chr11')!.stage).toBe('roles');
    expect(items.find((item) => item.id === 'gen4')!.stage).toBe('tree');
  });
});

describe('歸回的名單', () => {
  const cards = returnCards(READING);

  it('六張卡，次序是拉 2、拉 8、拉 10、尼 3、尼 7、尼 10', () => {
    expect(RETURN_IDS).toEqual(['ezra2', 'ezra8', 'ezra10', 'neh3', 'neh7', 'neh10']);
    expect(cards.map((card) => card.id)).toEqual([...RETURN_IDS]);
    expect(cards.map((card) => card.start)).toEqual(['拉2:1', '拉8:1', '拉10:18', '尼3:1', '尼7:6', '尼10:1']);
  });

  it('尼 3 是城牆畫面，其餘是名冊', () => {
    expect(cards.map((card) => card.stage)).toEqual(['roster', 'roster', 'roster', 'wall', 'roster', 'roster']);
    for (const card of cards) expect(card.intro).not.toBe('');
  });
});

describe('導覽的最後兩站', () => {
  const stops = DATA.tour;

  it('最後兩站是一起讀經、目錄，沒有對準家譜樹的人和經節', () => {
    const [reading, catalog] = stops.slice(-2);
    expect(stopMode(reading!)).toBe('reading');
    expect(stopMode(catalog!)).toBe('catalog');
    for (const stop of [reading!, catalog!]) {
      expect(stopFocus(stop)).toEqual([]);
      expect(stopRefs(stop)).toEqual([]);
    }
  });

  it('前面的站照舊：有 focus，用 sequence 優先', () => {
    for (const stop of stops.slice(0, -2)) {
      expect(stopMode(stop)).toBe('tree');
      expect(stopFocus(stop).length).toBeGreaterThan(0);
    }
    expect(stopFocus({ focus: ['a', 'b'], sequence: ['c'] })).toEqual(['c']);
    expect(stopFocus({ focus: ['a', 'b'] })).toEqual(['a', 'b']);
    expect(stopRefs({ refs: 'a, b' })).toEqual(['a, b']);
    expect(stopRefs({ refs: ['a', 'b'] })).toEqual(['a', 'b']);
  });

  it('導覽的字沒有舊的「歷代志上」邀請', () => {
    for (const stop of stops) expect(stop.text).not.toContain('想一節一節讀歷代志上');
  });
});
