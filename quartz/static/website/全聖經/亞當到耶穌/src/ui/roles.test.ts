import { describe, expect, it } from 'vitest';
import rolesJson from '../data/roles.json';
import type { RoleBox, RolesData } from '../data/types';
import { pathSegments, roleSealRows, roleSealWidth, sealRectsOverlap, segmentHitsRect } from './ink';
import {
  MINI_H, MINI_W, buildRolesIndex, cellIsLit, cellKey, chineseNumber, compareModel, groupLayout, miniLayout, monthLabel, parseRef, pidOf, polar,
  qualifierOf, refCoversVerse, shouldBreathe, refInRange, refText, roleTarget, sectorPath,
} from './roles';

const roles = rolesJson as unknown as RolesData;

describe('出處', () => {
  it('讀出書卷、章、起訖節', () => {
    expect(parseRef('代上12:1-7')).toEqual({ book: '代上', ch: 12, v1: 1, v2: 7 });
    expect(parseRef('撒下8:16')).toEqual({ book: '撒下', ch: 8, v1: 16, v2: 16 });
    expect(parseRef('代上27:32–34')).toEqual({ book: '代上', ch: 27, v1: 32, v2: 34 });
    expect(parseRef('沒有章節')).toBeNull();
  });
  it('一節落在一段範圍裡才算', () => {
    expect(refInRange('代上12:24', '代上12:23-40')).toBe(true);
    expect(refInRange('代上12:22', '代上12:23-40')).toBe(false);
    expect(refInRange('代上12:24', '代上13:23-40')).toBe(false);
    expect(refInRange('代上12:24', '撒下12:23-40')).toBe(false);
  });
  it('出處在畫面上用頓號', () => {
    expect(refText('代上18:15, 撒下8:16, 撒下20:23')).toBe('代上18:15、撒下8:16、撒下20:23');
    expect(refText('代上11:10-19')).toBe('代上11:10-19');
  });
});

describe('這一節出處的卡', () => {
  it('出處含目前這一節（單節、範圍、多處）才呼吸', () => {
    expect(refCoversVerse('王上4:12', '王上4:12')).toBe(true);
    expect(refCoversVerse('王上4:12', '王上4:13')).toBe(false);
    expect(refCoversVerse('代上11:10-19', '代上11:15')).toBe(true);
    expect(refCoversVerse('代上27:5, 代上27:6', '代上27:6')).toBe(true);
    expect(refCoversVerse('代上11:41', '撒下11:41')).toBe(false);
    const index = buildRolesIndex(roles);
    const hit = [...index.byCell.values()].filter((place) => refCoversVerse(place.member.ref, '代上11:41')).map((place) => place.member.name);
    expect(hit).toEqual(expect.arrayContaining(['烏利亞']));
  });
});

describe('呼吸要等名字讀到', () => {
  it('名字還沒讀到（沒亮）就不呼吸；讀到了而且出處在這一節才呼吸', () => {
    expect(shouldBreathe(false, '王上4:3', '王上4:3')).toBe(false);
    expect(shouldBreathe(true, '王上4:3', '王上4:3')).toBe(true);
    expect(shouldBreathe(true, '王上4:4', '王上4:3')).toBe(false);
    expect(shouldBreathe(true, '王上4:3', null)).toBe(false);
  });
});

describe('數字與月份', () => {
  it('中文數字', () => {
    expect([1, 7, 10, 11, 12, 20, 24].map(chineseNumber)).toEqual(['一', '七', '十', '十一', '十二', '二十', '二十四']);
  });
  it('十二個月', () => {
    expect([1, 2, 3, 10, 11, 12].map(monthLabel)).toEqual(['正月', '二月', '三月', '十月', '十一月', '十二月']);
  });
});

describe('環與輪盤的幾何', () => {
  it('角度從正上方起算、順時針', () => {
    expect(polar(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
    expect(polar(100, 100, 50, 90)).toEqual({ x: 150, y: 100 });
    expect(polar(100, 100, 50, 180)).toEqual({ x: 100, y: 150 });
    expect(polar(100, 100, 50, 270)).toEqual({ x: 50, y: 100 });
  });
  it('一格是外弧、內弧夾起來的封閉形狀', () => {
    const d = sectorPath(100, 100, 40, 80, 0, 90);
    expect(d).toBe('M100 20A80 80 0 0 1 180 100L140 100A40 40 0 0 0 100 60Z');
  });
  it('超過半圈要用大弧', () => {
    expect(sectorPath(0, 0, 10, 20, 0, 200)).toContain('0 1 1');
  });
});

describe('歸回連結指到的格子', () => {
  it('切出方塊 id 和成員 key（key 裡的冒號保留）', () => {
    expect(roleTarget('role:priests:耶大雅#第二班')).toEqual({ box: 'priests', key: '耶大雅#第二班' });
    expect(roleTarget('role:a:b:c')).toEqual({ box: 'a', key: 'b:c' });
    expect(roleTarget('約押')).toBeNull();
    expect(roleTarget('role:only')).toBeNull();
  });
});

describe('職位資料', () => {
  const index = buildRolesIndex(roles);
  it('五類、方塊都在', () => {
    expect(roles.categories.map((category) => category.id)).toEqual(['court', 'army', 'temple', 'tribes', 'solomon']);
    expect(index.boxes.size).toBeGreaterThan(20);
  });
  it('二十四班的環有二十四格、十二月輪盤有十二個月', () => {
    for (const { box } of index.boxes.values()) {
      if (box.kind === 'ring24') expect(new Set(box.members.map((member) => member.order))).toEqual(new Set(Array.from({ length: 24 }, (_, i) => i + 1)));
      if (box.kind === 'wheel12') expect(new Set(box.members.map((member) => member.order))).toEqual(new Set(Array.from({ length: 12 }, (_, i) => i + 1)));
    }
  });
  it('一人多職：比拿雅（耶何耶大的兒子）在護衛長、勇士首領、三月班長，還有所羅門的臣子', () => {
    const places = index.byPid.get('比拿雅#耶何耶大之子') ?? [];
    expect(places.map((place) => place.box.id)).toEqual(['guards', 'chiefs', 'monthly', 'solomon-court']);
  });
  it('每個成員的格子都找得到，key 在方塊內不重複', () => {
    for (const { box } of index.boxes.values()) {
      const keys = box.members.map((member) => member.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const member of box.members) expect(index.byCell.get(cellKey(box.id, member.key))?.member).toBe(member);
    }
  });
  it('樹上有的人用 id，只在職位圖上的人用 rid', () => {
    const joab = index.byPid.get('約押');
    expect(joab?.[0]?.member.id).toBe('約押');
    expect(pidOf({ key: 'k', rid: 'r', name: 'n', ref: '' })).toBe('r');
    expect(pidOf({ key: 'k', id: 'i', name: 'n', ref: '' })).toBe('i');
  });
  it('投奔大衛的人：人數落在各自那一組，沒有掉在外面的', () => {
    const ziklag = index.boxes.get('ziklag')!.box;
    const { groups, rest } = groupLayout(ziklag);
    expect(rest).toEqual([]);
    expect(groups.reduce((sum, group) => sum + group.figures.length, 0)).toBe(ziklag.figures!.length);
    // 每一組的成員都找得到
    expect(groups.reduce((sum, group) => sum + group.members.length, 0)).toBe(ziklag.groups!.reduce((sum, group) => sum + group.keys.length, 0));
    // 人數照字串原樣
    const last = groups.at(-1)!;
    expect(last.figures.find((figure) => figure.label === '猶大支派')?.count).toBe('六千八百人');
  });
  it('沒有對到任何一組的人數放在最後', () => {
    const box: RoleBox = {
      id: 'x', title: 'x', ref: '', kind: 'groups', seal: 'x', members: [],
      groups: [{ title: 'a', ref: '代上12:1-7', keys: [] }],
      figures: [{ label: '甲', count: '一人', ref: '代上12:3' }, { label: '乙', count: '二人', ref: '代上12:30' }],
    };
    const { groups, rest } = groupLayout(box);
    expect(groups[0]!.figures.map((figure) => figure.label)).toEqual(['甲']);
    expect(rest.map((figure) => figure.label)).toEqual(['乙']);
  });
});

describe('讀經的小縮影', () => {
  const layout = miniLayout(roles);
  it('每個方塊都有位置，且都在縮影範圍內', () => {
    const all = roles.categories.flatMap((category) => category.boxes);
    expect(layout.boxes.size).toBe(all.length);
    for (const rect of layout.boxes.values()) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThan(layout.plaque.y + layout.plaque.h);
      expect(rect.x + rect.w).toBeLessThanOrEqual(MINI_W);
      expect(rect.y + rect.h).toBeLessThanOrEqual(MINI_H);
    }
  });
  it('同一欄的方塊由上往下排，不重疊', () => {
    for (const category of roles.categories) {
      const rects = category.boxes.map((box) => layout.boxes.get(box.id)!);
      for (let i = 1; i < rects.length; i += 1) expect(rects[i]!.y).toBeGreaterThanOrEqual(rects[i - 1]!.y + rects[i - 1]!.h);
    }
  });
  it('四欄由左往右', () => {
    const firsts = roles.categories.filter((category) => category.id !== 'solomon').map((category) => layout.boxes.get(category.boxes[0]!.id)!.x);
    expect([...firsts].sort((a, b) => a - b)).toEqual(firsts);
  });
  it('從大衛到所羅門橫跨整個版面，排在四欄的底下', () => {
    const court = layout.boxes.get('solomon-court')!;
    const officials = layout.boxes.get('solomon-officials')!;
    expect(court.w).toBeGreaterThan(MINI_W * 0.8);
    expect(officials.y).toBeGreaterThanOrEqual(court.y + court.h);
    for (const category of roles.categories.filter((item) => item.id !== 'solomon')) {
      for (const box of category.boxes) {
        const rect = layout.boxes.get(box.id)!;
        expect(rect.y + rect.h).toBeLessThanOrEqual(court.y);
      }
    }
  });
});

describe('從大衛到所羅門', () => {
  const index = buildRolesIndex(roles);
  const court = index.boxes.get('solomon-court')!.box;
  const rows = compareModel(court, index.people);
  const row = (office: string) => rows.find((item) => item.office === office)!;
  const noTree = () => undefined;

  it('每個職位一列，照資料的次序', () => {
    expect(court.kind).toBe('compare');
    expect(rows.map((item) => item.office)).toEqual(court.rows!.map((item) => item.office));
  });
  it('同一人：一張金框卡，帶限定詞；大衛時的出處取人物資料裡不是王上的', () => {
    expect(rows.filter((item) => item.same)).toHaveLength(court.rows!.filter((item) => item.same).length);
    const scribe = row('史官');
    expect(scribe.same?.kind).toBe('same');
    expect(scribe.same?.member.key).toBe('約沙法#亞希律之子');
    expect(scribe.solomon).toEqual([]);
    expect(scribe.same?.davidRefs).toEqual(['代上18:15', '撒下8:16', '撒下20:24']);
    expect(qualifierOf(scribe.same!.member, index.people, noTree)).toBe('亞希律的兒子');
  });
  it('換了職位：紅框，寫原本的職位', () => {
    const marshal = row('元帥');
    expect(marshal.same).toBeUndefined();
    expect(marshal.solomon).toHaveLength(1);
    expect(marshal.solomon[0]).toMatchObject({ kind: 'moved', from: '統轄基利提人和比利提人' });
  });
  it('沒有寫 same 的人不合併：撒督、亞比亞他在兩欄各出現，都是一般的卡', () => {
    const priests = row('祭司長');
    expect(priests.same).toBeUndefined();
    expect(priests.david.map((item) => item.name)).toContain('撒督');
    expect(priests.solomon.map((card) => card.member.name)).toEqual(['撒督', '亞比亞他']);
    expect(priests.solomon.every((card) => card.kind === 'plain')).toBe(true);
  });
  it('一欄好幾個人並排；空欄照資料留空', () => {
    expect(row('書記').david).toHaveLength(3);
    expect(row('書記').solomon).toHaveLength(2);
    expect(row('統轄基利提人和比利提人').solomon).toEqual([]);
    expect(row('家宰').david).toEqual([]);
    expect(row('家宰').solomon).toHaveLength(1);
  });
  it('王上 4 的臣子都畫出來了，沒有漏、沒有重複', () => {
    const drawn = rows.flatMap((item) => [...(item.same ? [item.same.member.key] : []), ...item.solomon.map((card) => card.member.key)]);
    expect(new Set(drawn).size).toBe(drawn.length);
    expect([...drawn].sort()).toEqual(court.members.map((member) => member.key).sort());
  });
  it('讀到誰亮誰：約沙法那張金框卡亮（一張卡橫跨兩欄），比拿雅那張紅框卡亮', () => {
    const same = row('史官').same!.member;
    expect(cellIsLit(new Set([pidOf(same)]), pidOf(same), 'solomon-court', same.key)).toBe(true);
    expect(cellIsLit(new Set(['約沙法#帕路亞的兒子']), pidOf(same), 'solomon-court', same.key)).toBe(false);
    const moved = row('元帥').solomon[0]!.member;
    expect(cellIsLit(new Set([pidOf(moved)]), pidOf(moved), 'solomon-court', moved.key)).toBe(true);
    // 歸回連結直接指到這一格
    expect(cellIsLit(new Set([`role:solomon-court:${same.key}`]), 'x', 'solomon-court', same.key)).toBe(true);
  });
  it('方塊和成員都找得到（讀經的鏡頭和小地圖用）', () => {
    expect(index.boxes.has('solomon-court')).toBe(true);
    expect(index.boxes.has('solomon-officials')).toBe(true);
    expect(index.byPid.has('約沙法#亞希律之子')).toBe(true);
    expect(index.byCell.has(cellKey('solomon-court', '約沙法#亞希律之子'))).toBe(true);
    expect(index.byPid.get('約沙法#帕路亞的兒子')?.[0]?.box.id).toBe('solomon-officials');
  });
});

describe('十二個官吏', () => {
  const index = buildRolesIndex(roles);
  const box = index.boxes.get('solomon-officials')!.box;
  it('正好十二位，沒有序號、沒有月份；標題下引王上 4:7 的原句', () => {
    expect(box.kind).toBe('tiles');
    expect(box.members).toHaveLength(12);
    for (const member of box.members) {
      expect(member.order).toBeUndefined();
      expect(`${member.name}${member.detail ?? ''}`).not.toMatch(/[0-9０-９]|月/);
    }
    expect(box.quote).toEqual({ ref: '王上4:7', text: '每年各人供給一月' });
  });
  it('同名的人分得開：兩位巴拿、一位約沙法各有限定詞', () => {
    const same = box.members.filter((member) => member.name === '巴拿' || member.name === '約沙法');
    expect(same).toHaveLength(3);
    for (const member of same) expect(qualifierOf(member, index.people, () => undefined)).not.toBe('');
  });
  it('娶了所羅門女兒的兩位連到家譜樹上的妻子', () => {
    expect(box.members.filter((member) => member.spouse).map((member) => member.spouse!.name)).toEqual(['他法', '巴實抹']);
  });
});

describe('職位印的幾何（家譜樹）', () => {
  it('寬度隨字數', () => {
    expect(roleSealWidth('元帥')).toBe(34);
    expect(roleSealWidth('第三班')).toBe(46);
  });
  it('一行放不下就換行', () => {
    const one = roleSealRows(['元帥'], 120);
    expect(one.items).toEqual([{ label: '元帥', x: 0, y: 0, w: 34 }]);
    expect(one.height).toBe(17);
    const many = roleSealRows(['祭司長', '族長', '獻祭', '祭司'], 100);
    expect(many.items.some((item) => item.y > 0)).toBe(true);
    expect(many.width).toBeLessThanOrEqual(100);
    expect(roleSealRows([], 100)).toEqual({ items: [], width: 0, height: 0 });
  });
  it('把連線路徑拆成線段', () => {
    expect(pathSegments('M10 20 H30 V40 H50')).toEqual([[10, 20, 30, 20], [30, 20, 30, 40], [30, 40, 50, 40]]);
    expect(pathSegments('M0 0 L10 10')).toEqual([[0, 0, 10, 10]]);
    expect(pathSegments('M5 5 V25')).toEqual([[5, 5, 5, 25]]);
  });
  it('矩形重疊與線段穿過矩形', () => {
    const a = { l: 0, t: 0, r: 10, b: 10 };
    expect(sealRectsOverlap(a, { l: 5, t: 5, r: 15, b: 15 })).toBe(true);
    expect(sealRectsOverlap(a, { l: 11, t: 0, r: 20, b: 10 })).toBe(false);
    expect(sealRectsOverlap(a, { l: 11, t: 0, r: 20, b: 10 }, 2)).toBe(true);
    expect(segmentHitsRect([-5, 5, 15, 5], a)).toBe(true);
    expect(segmentHitsRect([5, 20, 5, 30], a)).toBe(false);
    expect(segmentHitsRect([5, 12, 5, 30], a, 3)).toBe(true);
    expect(segmentHitsRect([-5, -5, 15, 15], a)).toBe(true);
    expect(segmentHitsRect([20, 0, 30, 10], a)).toBe(false);
  });
});
