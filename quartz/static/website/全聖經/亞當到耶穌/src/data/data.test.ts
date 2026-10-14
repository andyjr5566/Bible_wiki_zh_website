import { describe, expect, it } from 'vitest';
import { DATA, VERSES, branchRoots, expandVerseRefs, lookupVerses, buildGraph, makeSyntheticData, pathToFirstAncestor, searchNameForms, searchPeople } from './model';
import type { GenealogyData } from './types';
import { computeLayout } from '../ui/layout';
import { groupUnattachedPeople } from '../ui/unconnected';

function allReferenceKeys(data: GenealogyData): string[] {
  const refs: string[] = [];
  const add = (ref?: string) => { if (ref) refs.push(...expandVerseRefs(ref)); };
  for (const person of data.persons) {
    for (const name of person.names ?? []) add(name.ref);
    for (const relation of [...(person.parents ?? []), ...(person.spouses ?? []), ...(person.siblings ?? []), ...(person.kin ?? []), ...(person.descends ?? [])]) add(relation.ref);
    for (const candidate of person.maybeSame ?? []) for (const ref of candidate.refs) add(ref);
  }
  for (const witness of data.witnesses) add(witness.ref);
  for (const age of data.ages.people) for (const ref of age.refs ?? []) add(ref);
  for (const note of data.notes) for (const entry of note.scripture ?? []) add(entry.ref);
  for (const stop of data.tour) for (const ref of (Array.isArray(stop.refs) ? stop.refs : [stop.refs])) add(ref);
  return refs;
}

function firstNamed(data: GenealogyData, name: string) {
  return data.persons.find((person) => person.name === name || person.id === name);
}

function findOverlaps(nodes: ReturnType<typeof computeLayout>['nodes']): string[] {
  const sorted = [...nodes].sort((a, b) => (a.x - a.width / 2) - (b.x - b.width / 2));
  const active: typeof sorted = [];
  const overlaps: string[] = [];
  for (const node of sorted) {
    const left = node.x - node.width / 2;
    for (let i = active.length - 1; i >= 0; i -= 1) if (active[i]!.x + active[i]!.width / 2 <= left) active.splice(i, 1);
    const top = node.y - node.height / 2;
    const bottom = node.y + node.height / 2;
    for (const other of active) {
      if (top < other.y + other.height / 2 && bottom > other.y - other.height / 2) overlaps.push(`${node.id} × ${other.id}`);
    }
    active.push(node);
  }
  return overlaps;
}

describe('家譜資料閘門', () => {
  it('未接主線分頁只列資料名單，且每人恰好屬於一組', () => {
    const unattachedIds = DATA.unattached ?? [];
    const result = groupUnattachedPeople(DATA);
    const displayedIds = [...result.families.flatMap((group) => group.members.map((person) => person.id)),
      ...result.singles.map((person) => person.id)];
    const countById = new Map<string, number>();
    for (const id of displayedIds) countById.set(id, (countById.get(id) ?? 0) + 1);

    expect(result.people.length).toBe(unattachedIds.length);
    expect(displayedIds.length).toBe(unattachedIds.length);
    expect(new Set(displayedIds).size).toBe(unattachedIds.length);
    for (const id of unattachedIds) expect(countById.get(id), id).toBe(1);
  });

  it('人物搜尋只比對姓名和別名，並優先顯示主線候選', () => {
    const results = searchPeople('約瑟', DATA);
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((person) => searchNameForms(person, '約瑟').length > 0)).toBe(true);
    const exactNames = results.filter((person) => searchNameForms(person, '約瑟').some((name) => name === '約瑟'));
    const spineIds = buildGraph(DATA).spineIds;
    expect(exactNames.filter((person) => spineIds.has(person.id)).length).toBeGreaterThan(0);
    const idOnlyMatches = DATA.persons.filter((person) => person.id.includes('約瑟') && !searchNameForms(person, '約瑟').length);
    expect(results.some((person) => idOnlyMatches.some((candidate) => candidate.id === person.id))).toBe(false);
    const rank = (person: (typeof results)[number]) => Math.max(0, ...searchNameForms(person, '約瑟').map((name) =>
      name === '約瑟' ? 3 : name.startsWith('約瑟') ? 2 : 1));
    for (let index = 1; index < results.length; index += 1) {
      const previous = results[index - 1]!;
      const current = results[index]!;
      expect(rank(previous)).toBeGreaterThanOrEqual(rank(current));
      if (rank(previous) === rank(current) && !spineIds.has(previous.id)) expect(spineIds.has(current.id)).toBe(false);
    }
  });

  it('兩條主線都有有效起點，路線人物都存在於資料中', () => {
    const routes = Object.values(DATA.spine.lines);
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes[0]?.[0]).toBeTruthy();
    for (const route of routes) {
      expect(route.length).toBeGreaterThan(0);
      expect(route[0]).toBe(routes[0]?.[0]);
      expect(route.every((id) => DATA.persons.some((person) => person.id === id))).toBe(true);
    }
  });

  it('兩條主線從亞當經父子或 link 連續到耶穌', () => {
    const adam = firstNamed(DATA, '亞當')!;
    const jesus = firstNamed(DATA, '耶穌')!;
    const routes = Object.values(DATA.spine.lines);
    for (const route of routes) {
      expect(route[0]).toBe(adam.id);
      expect(route.at(-1)).toBe(jesus.id);
      for (let index = 1; index < route.length; index += 1) {
        const parent = route[index - 1]!;
        const child = DATA.persons.find((person) => person.id === route[index]);
        const connected = child?.parents?.some((item) => item.id === parent) || child?.descends?.some((item) => item.id === parent) ||
          DATA.persons.find((person) => person.id === parent)?.kin?.some((item) => item.id === route[index]);
        expect(connected, `${parent} → ${route[index]}`).toBe(true);
      }
    }
  });

  it('施洗約翰追溯到亞當時保留以利沙伯通往亞倫的後裔關係', () => {
    const john = DATA.persons.find((person) => person.id.includes('施洗'))!;
    const elizabeth = DATA.persons.find((person) => person.name === '以利沙伯')!;
    const aaron = DATA.persons.find((person) => person.name === '亞倫')!;
    const route = pathToFirstAncestor(john.id, DATA, buildGraph(DATA));
    expect(route?.ids).toContain(elizabeth.id);
    expect(route?.ids).toContain(aaron.id);
    expect(route?.edges).toContainEqual({ from: elizabeth.id, to: aaron.id, kind: 'descends' });
  });

  it('每筆 parents、kin 關係都指向存在的人物', () => {
    const ids = new Set(DATA.persons.map((person) => person.id));
    for (const person of DATA.persons) {
      for (const relation of [...(person.parents ?? []), ...(person.kin ?? [])]) expect(ids.has(relation.id), `${person.id} → ${relation.id}`).toBe(true);
    }
  });

  it('可能同一人的候選都能連到人物，引用經節都存在', () => {
    const ids = new Set(DATA.persons.map((person) => person.id));
    for (const person of DATA.persons) {
      for (const candidate of person.maybeSame ?? []) {
        expect(ids.has(candidate.id), `${person.id} ≈ ${candidate.id}`).toBe(true);
        expect(candidate.refs.length).toBeGreaterThan(0);
        for (const ref of candidate.refs) expect(VERSES[ref], `${person.id}: ${ref}`).toBeTruthy();
      }
    }
  });

  it('每個導覽焦點與經節都存在於匯出資料', () => {
    const ids = new Set(DATA.persons.map((person) => person.id));
    for (const stop of DATA.tour) {
      for (const focus of stop.focus) expect(ids.has(focus), `${stop.id}: ${focus}`).toBe(true);
      const refs = Array.isArray(stop.refs) ? stop.refs : [stop.refs];
      for (const ref of refs.flatMap((value) => expandVerseRefs(value))) {
        expect(VERSES[ref], `${stop.id}: ${ref}`).toBeTruthy();
      }
    }
  });

  it('每站導覽序列都只用主線人物，且每個人都有版面節點', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA);
    const layoutIds = new Set(layout.nodes.map((node) => node.id));
    for (const stop of DATA.tour) {
      expect(stop.sequence?.length, `${stop.id}: sequence`).toBeGreaterThan(0);
      for (const id of stop.sequence ?? []) {
        expect(graph.spineIds.has(id), `${stop.id}: ${id} should be on the spine`).toBe(true);
        expect(layoutIds.has(id), `${stop.id}: ${id} should have a layout node`).toBe(true);
      }
    }
  });

  it('所有人物、見證、年歲、註記與導覽引用都能在 verses.json 找到', () => {
    for (const ref of allReferenceKeys(DATA)) expect(VERSES[ref], ref).toBeTruthy();
  });

  it('資訊卡上每一個經文標籤（含範圍、逗號、跨章）都查得到全文', () => {
    const refs = new Set<string>();
    const add = (ref?: string) => { if (ref) refs.add(ref); };
    for (const person of DATA.persons) {
      for (const name of person.names ?? []) add(name.ref);
      for (const relation of [...(person.parents ?? []), ...(person.spouses ?? []), ...(person.siblings ?? []), ...(person.kin ?? []), ...(person.descends ?? [])]) add(relation.ref);
    }
    for (const witness of DATA.witnesses) add(witness.ref);
    for (const note of DATA.notes) for (const entry of note.scripture ?? []) add(entry.ref);
    expect(refs.size).toBeGreaterThan(500);
    for (const ref of refs) {
      const lines = lookupVerses(ref);
      expect(lines.length, ref).toBeGreaterThan(0);
      expect(lines.filter((line) => !line.text).map((line) => line.key), ref).toEqual([]);
    }
  });

  it('名字字義：主線人物幾乎都有原文，經文說明的引句真的在經文裡', () => {
    const spine = new Set(Object.values(DATA.spine.lines).flat());
    const withOrig = [...spine].filter((id) => DATA.persons.find((person) => person.id === id)?.nameMeaning?.orig);
    expect(withOrig.length / spine.size).toBeGreaterThan(0.9);
    let withMeaning = 0;
    for (const person of DATA.persons) {
      const info = person.nameMeaning;
      if (!info) continue;
      if (info.meaningEn) { withMeaning += 1; expect(info.meaningZh, person.id).toBeTruthy(); }
      for (const item of info.scripture) {
        const text = lookupVerses(item.ref).map((line) => line.text ?? '').join('');
        expect(text.includes(item.quote), `${person.id} ${item.ref}`).toBe(true);
      }
    }
    expect(withMeaning).toBeGreaterThan(1000);
    expect(DATA.persons.find((person) => person.id === '塞特')?.nameMeaning?.meaningZh).toBe('補償');
  });

  it('經文範圍展開：同章、逗號、跨章', () => {
    const verses = { '創1:30': 'a', '創1:31': 'b', '創2:1': 'c', '創2:2': 'd', '創3:5': 'e' };
    expect(expandVerseRefs('創1:30-31', verses)).toEqual(['創1:30', '創1:31']);
    expect(expandVerseRefs('創1:30-2:2', verses)).toEqual(['創1:30', '創1:31', '創2:1', '創2:2']);
    expect(expandVerseRefs('創1:31-3:5', verses)).toEqual(['創1:31', '創2:1', '創2:2', '創3:1', '創3:2', '創3:3', '創3:4', '創3:5']);
    expect(expandVerseRefs('創2:1, 創3:5', verses)).toEqual(['創2:1', '創3:5']);
    expect(expandVerseRefs('創2:1、2', verses)).toEqual(['創2:1', '創2:2']);
  });

  it('主線與預設收合旁支的節點框不重疊', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA, new Set());
    expect(findOverlaps(layout.nodes)).toEqual([]);
    expect(layout.nodes.length).toBeGreaterThanOrEqual(graph.spineIds.size);
  });

});

describe('三千人物版面壓力測試', () => {
  const synthetic = makeSyntheticData(3000);
  const expanded = new Set(branchRoots(synthetic, buildGraph(synthetic)).map((item) => item.rootId));

  it('合成資料有兩條 76 代主線、旁支與多種關係', () => {
    const routes = Object.values(synthetic.spine.lines);
    expect(routes.every((route) => route.length === 76)).toBe(true);
    expect(routes.every((route) => synthetic.persons.find((person) => person.id === route[0])?.name === '亞當')).toBe(true);
    expect(routes.every((route) => synthetic.persons.find((person) => person.id === route.at(-1))?.name === '耶穌')).toBe(true);
    expect(synthetic.persons.length).toBeGreaterThanOrEqual(2900);
    expect(synthetic.persons.length).toBeLessThanOrEqual(3100);
    expect(synthetic.persons.some((person) => (person.parents?.length ?? 0) > 1)).toBe(true);
    expect(synthetic.persons.some((person) => (person.descends?.length ?? 0) > 0)).toBe(true);
    expect(synthetic.persons.some((person) => (person.kin?.length ?? 0) > 0)).toBe(true);
    for (const route of routes) {
      for (let index = 1; index < route.length; index += 1) {
        const prior = route[index - 1]!;
        const child = synthetic.persons.find((person) => person.id === route[index]);
        expect(child?.parents?.some((relation) => relation.id === prior), `${prior} → ${route[index]}`).toBe(true);
      }
    }
  });

  it('全部旁支收合時，節點框也不重疊', () => {
    const layout = computeLayout(synthetic);
    expect(findOverlaps(layout.nodes).slice(0, 1)).toEqual([]);
  });

  it('全部展開時節點不重疊，版面計算低於 500 毫秒', () => {
    const start = performance.now();
    const layout = computeLayout(synthetic, expanded);
    const elapsed = performance.now() - start;
    expect(layout.nodes.length).toBe(synthetic.persons.length);
    const collisions = findOverlaps(layout.nodes);
    const collisionNodes = layout.nodes.filter((node) => collisions[0]?.split(' × ').includes(node.id));
    const details = collisionNodes.map((node) => ({
      node,
      root: layout.nodes.find((candidate) => candidate.id === node.sideRoot),
      parent: synthetic.persons.find((person) => person.id === node.id)?.parents,
    }));
    expect(collisions.slice(0, 1), JSON.stringify(details)).toEqual([]);
    expect(elapsed).toBeLessThan(500);
  });
});
