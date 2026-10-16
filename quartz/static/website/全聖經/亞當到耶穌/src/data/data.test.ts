import { describe, expect, it } from 'vitest';
import rolesSource from './roles.json';
import { householdAliasByVerse } from '../ui/tree-stage';
import type { ReadingData, RolesData } from './types';
import { DATA, READING, VERSES, branchRoots, expandVerseRefs, lookupVerses, buildGraph, makeSyntheticData, pathToFirstAncestor, searchNameForms, searchPeople } from './model';
import type { GenealogyData } from './types';
import { computeLayout } from '../ui/layout';

/** 全部展開：每位主線人物的旁支、「N 位子女」、「某某所生」底下各個孩子、名單牌子和區域都打開。 */
function everythingOpen(data: GenealogyData): Set<string> {
  const graph = buildGraph(data);
  const open = new Set<string>(branchRoots(data, graph).map((item) => item.rootId));
  for (const id of graph.byId.keys()) open.add(id);
  for (const id of graph.spineIds) for (const direction of [-1, 1]) open.add(`siblings:${id}:${direction}`);
  for (const node of data.placements?.nodes ?? []) open.add(node.id);
  return open;
}

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
  it('每個人物在大圖上都有自己的節點（全部展開時）', () => {
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const ids = new Set(layout.nodes.map((node) => node.id));
    const missing = DATA.persons.filter((person) => !ids.has(person.id)).map((person) => person.id);
    expect(missing).toEqual([]);
    for (const node of DATA.placements?.nodes ?? []) expect(ids.has(node.id), node.id).toBe(true);
  });

  it('全部展開時節點框不重疊', () => {
    const layout = computeLayout(DATA, everythingOpen(DATA));
    expect(findOverlaps(layout.nodes).slice(0, 5)).toEqual([]);
  });

  it('經文記載的母親：孩子在圖上時，不是掛在母親（或「某某所生」）底下，就是有母子線或「母親：某某」', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const ids = new Set(layout.nodes.map((node) => node.id));
    const mothers = new Set(layout.edges.filter((edge) => edge.kind === 'mother').map((edge) => `${edge.from}|${edge.to}`));
    const tags = new Set(layout.farLinks.filter((item) => item.label === '母親').map((item) => `${item.other}|${item.id}`));
    const missing: string[] = [];
    for (const person of DATA.persons) {
      if (!ids.has(person.id)) continue;
      for (const parent of person.parents ?? []) {
        if (parent.role !== '母' || !graph.byId.has(parent.id)) continue;
        const tree = graph.treeParent.get(person.id);
        const underMother = tree === parent.id || graph.bornOf.get(tree ?? '') === parent.id;
        if (!underMother && !mothers.has(`${parent.id}|${person.id}`) && !tags.has(`${parent.id}|${person.id}`)) missing.push(`${parent.id} → ${person.id}`);
      }
    }
    expect(missing).toEqual([]);
    // 以實瑪利掛在夏甲底下；流便在「利亞所生」底下；猶大（主線）頭上標「母親：利亞」
    expect(graph.treeParent.get('以實瑪利')).toBe('夏甲');
    expect(graph.bornOf.get(graph.treeParent.get('流便') ?? '')).toBe('利亞');
    expect(tags.has('利亞|猶大')).toBe(true);
    // 母親底下看得到他生的每一個孩子，主線上的也是（代上3:5 拔示巴生示米亞、朔罷、拿單、所羅門）
    const bathsheba = graph.treeParent.get('朔罷')!;
    const shown = (graph.children.get(bathsheba) ?? []).map((id) => graph.childRefs.get(id) ?? id);
    expect(shown).toEqual(['示米亞#大衛', '朔罷', '拿單', '所羅門']);
    for (const [card, mother] of graph.bornOf) {
      const father = graph.treeParent.get(card)!;
      const recorded = DATA.persons.filter((person) => person.parents?.some((r) => r.id === mother && r.role === '母') && person.parents?.some((r) => r.id === father));
      const under = new Set((graph.children.get(card) ?? []).map((id) => graph.childRefs.get(id) ?? id));
      expect(recorded.filter((person) => !under.has(person.id)).map((person) => person.id), card).toEqual([]);
    }
    // 分身卡不是人物；父母本來就排在同一處的（西庇太一家），不放分身卡，免得同一位母親在旁邊出現兩次
    expect(DATA.persons.some((person) => graph.bornOf.has(person.id))).toBe(false);
    for (const [card, mother] of graph.bornOf) {
      const father = graph.treeParent.get(card)!;
      expect(graph.treeParent.get(mother) === graph.treeParent.get(father) && graph.treeParent.has(father), card).toBe(false);
    }
  });

  it('經文記載的夫妻：兩人都在圖上時，不是有夫妻線，就是名字上方標出配偶', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const linked = new Set(layout.edges.flatMap((edge) => [`${edge.from}|${edge.to}`, `${edge.to}|${edge.from}`]));
    const chips = new Set(layout.farLinks.map((item) => `${item.id}|${item.other}`));
    const ids = new Set(layout.nodes.map((node) => node.id));
    const missing: string[] = [];
    for (const person of DATA.persons) {
      for (const spouse of person.spouses ?? []) {
        if (spouse.id === person.id || !ids.has(person.id) || !ids.has(spouse.id)) continue;
        const key = `${person.id}|${spouse.id}`;
        // 丈夫旁邊有妻子的分身卡（以色列旁邊的利亞）也算標出來了
        const card = graph.bornOf.has(`所生:${person.id}:${spouse.id}`) || graph.bornOf.has(`所生:${spouse.id}:${person.id}`);
        const tagged = (chips.has(key) || card) && (chips.has(`${spouse.id}|${person.id}`) || card);
        if (!linked.has(key) && !tagged) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
    // 撒拉本人在亞伯拉罕的妻子欄，卡上標「妻子」
    expect(graph.wifeSlots.get('撒拉')).toEqual({ husband: '亞伯拉罕', wife: '撒拉', spouse: true });
  });

  it('經文記的「某人的後代」：不是畫虛線，就是名字上方標「祖先：某某」', () => {
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const ids = new Set(layout.nodes.map((node) => node.id));
    const lines = new Set(layout.edges.filter((edge) => edge.kind === 'descends').map((edge) => `${edge.from}|${edge.to}`));
    const tags = new Set(layout.farLinks.filter((item) => item.label === '祖先').map((item) => `${item.other}|${item.id}`));
    const missing = DATA.persons.flatMap((person) => (person.descends ?? [])
      .filter((ancestor) => ids.has(person.id) && ids.has(ancestor.id) && !lines.has(`${ancestor.id}|${person.id}`) && !tags.has(`${ancestor.id}|${person.id}`))
      .map((ancestor) => `${ancestor.id} → ${person.id}`));
    expect(missing).toEqual([]);
  });

  it('一家人的層次：丈夫 → 妻子欄 → 兒女欄，兒女都在同一層', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const at = new Map(layout.nodes.map((node) => [node.id, node]));
    const wrong: string[] = [];
    for (const [slot, item] of graph.wifeSlots) {
      // 妻子欄的卡都掛在丈夫底下，兒女都掛在某張妻子卡或「母親未記載」底下
      if (graph.treeParent.get(slot) !== item.husband) wrong.push(`${slot} 不在 ${item.husband} 底下`);
    }
    for (const person of DATA.persons) {
      const father = person.parents?.find((relation) => relation.role !== '母' && graph.byId.has(relation.id))?.id;
      if (!father || graph.spineIds.has(person.id)) continue;
      const column = (graph.children.get(father) ?? []).filter((id) => graph.wifeSlots.has(id) || graph.noMother.has(id));
      if (!column.length || !at.has(person.id)) continue;
      const up = graph.treeParent.get(person.id);
      if (!up || !column.includes(up)) continue; // 經文另外把他放在別處的（例如名單牌子）
      // 同一位父親的兒女在同一個水平位置（同一欄）
      const siblings = DATA.persons.filter((other) => other.parents?.some((relation) => relation.id === father) && column.includes(graph.treeParent.get(other.id) ?? ''));
      const xs = new Set(siblings.map((other) => Math.round(at.get(other.id)?.x ?? NaN)).filter((x) => !Number.isNaN(x)));
      if (xs.size > 1) wrong.push(`${father} 的兒女不在同一欄`);
    }
    // 瑪迦的祖先疊在他上面；拔示巴上面是以連、亞米利，下面是烏利亞；他生的四個兒子都在他底下
    expect(graph.ancestry.get('瑪迦')).toEqual([['亞米忽#達買之父'], ['達買']]);
    expect(graph.ancestry.get('拔示巴')?.flat().sort()).toEqual(['亞米利#拔書亞之父', '以連'].sort());
    expect(graph.otherHusbands.get('拔示巴')).toEqual(['烏利亞']);
    expect([...new Set(wrong)]).toEqual([]);
  });

  it('名單牌子掛在圖上的人底下，區域在主線人物旁邊而且不畫連到主線的線', () => {
    const graph = buildGraph(DATA);
    const layout = computeLayout(DATA, everythingOpen(DATA));
    const placements = DATA.placements!;
    expect(placements.nodes.filter((node) => node.kind === 'list').length).toBeGreaterThan(10);
    for (const node of placements.nodes) {
      expect(graph.byId.has(node.under), `${node.id} → ${node.under}`).toBe(true);
      if (node.kind === 'region') {
        expect(graph.spineIds.has(node.under), node.id).toBe(true);
        expect(layout.edges.some((edge) => edge.to === node.id), `${node.id} 不該有線`).toBe(false);
      }
      if (node.kind === 'list') expect(layout.edges.some((edge) => edge.from === node.under && edge.to === node.id && edge.kind === 'list'), node.id).toBe(true);
    }
    // 新約家族頁的每一位都在大圖上
    const ids = new Set(layout.nodes.map((node) => node.id));
    for (const family of DATA.ntFamilies) for (const member of family.members ?? []) expect(ids.has(member), member).toBe(true);
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

  it('導覽最後兩站介紹帶你讀經、打開目錄；每一段讀經都有目錄介紹', () => {
    expect(DATA.tour.slice(-2).map((stop) => stop.kind)).toEqual(['reading', 'catalog']);
    for (const segment of READING.segments) {
      expect(segment.intro, segment.id).toBeTruthy();
      expect(segment.intro!.length, segment.id).toBeLessThanOrEqual(60);
      expect(segment.intro, segment.id).not.toMatch(/[「」]/);
    }
  });

  it('每個導覽焦點與經節都存在於匯出資料', () => {
    const ids = new Set(DATA.persons.map((person) => person.id));
    for (const stop of DATA.tour) {
      for (const focus of stop.focus ?? []) expect(ids.has(focus), `${stop.id}: ${focus}`).toBe(true);
      const refs = Array.isArray(stop.refs) ? stop.refs : stop.refs ? [stop.refs] : [];
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
      // 介紹帶你讀經、打開目錄的兩站不對準家譜樹上的人
      if (stop.kind) continue;
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

describe('讀經資料閘門（整條路線）', () => {
  const verses = READING.segments.flatMap((segment) => segment.chapters.flatMap((chapter) =>
    chapter.verses.map((verse) => ({ segment, key: `${chapter.book}${chapter.n}:${verse.v}`, verse }))));
  const personIds = new Set(DATA.persons.map((person) => person.id));
  const chronicles = verses.filter((item) => item.segment.id === 'chr1-9');

  it('路線 39 段，從創 4:17 開始；代上 1–9 的 407 節全收；經文和正式經文逐字相同', () => {
    expect(READING.segments.length).toBe(39);
    expect(READING.start).toBe('創4:17');
    expect(verses[0]!.key).toBe('創4:17');
    expect(verses.at(-1)!.key).toBe('路3:38');
    expect(chronicles.length).toBe(407);
    expect(new Set(verses.map((item) => item.key)).size).toBe(verses.length);
    for (const { key, verse } of verses) expect(verse.text, key).toBe(VERSES[key]);
  });

  it('每個標記的位置都在經文裡，前後不重疊', () => {
    const errors: string[] = [];
    for (const { key, verse } of verses) {
      let end = 0;
      for (const token of verse.t) {
        if (token.s < end || token.e <= token.s || token.e > verse.text.length) errors.push(`${key} ${token.s}-${token.e}`);
        end = token.e;
      }
    }
    expect(errors).toEqual([]);
  });

  it('人名對到的人物都存在，而且在大圖上有節點', () => {
    const layoutIds = new Set(computeLayout(DATA, everythingOpen(DATA)).nodes.map((node) => node.id));
    const missing: string[] = [];
    for (const { key, verse } of verses) {
      for (const token of verse.t) {
        // 職稱可以屬於只在職位圖上的人（rid），那些另在職位資料的測試裡檢查
        const owner = token.of && !personIds.has(token.of) ? undefined : token.of;
        for (const id of [token.id, owner, ...(token.from ?? []), ...(token.to ?? [])].filter((value): value is string => Boolean(value))) {
          if (!personIds.has(id) || !layoutIds.has(id)) missing.push(`${key} ${id}`);
        }
      }
    }
    expect(missing).toEqual([]);
    expect(chronicles.reduce((sum, { verse }) => sum + verse.t.filter((token) => token.k === 'p' && token.id).length, 0)).toBeGreaterThan(1500);
  });

  it('人名標記的字是那個人的名字或別名（避免把一個名字連到別人）', () => {
    const forms = new Map(DATA.persons.map((person) => [person.id, new Set([person.name, ...(person.names ?? []).map((name) => name.as)])]));
    const wrong: string[] = [];
    for (const { key, verse } of verses) {
      for (const token of verse.t) {
        const word = verse.text.slice(token.s, token.e);
        if (token.id && !forms.get(token.id)?.has(word)) wrong.push(`${key}「${word}」≠ ${token.id}`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it('同一段裡標過的人名，在別節出現也要有標記（漏標閘門；支派名、族名用法除外）', () => {
    const tribes = new Set(['以色列', '猶大', '利未', '瑪拿西', '便雅憫', '迦得', '流便', '以薩迦', '亞設', '以法蓮', '西布倫', '拿弗他利', '西緬', '但', '約瑟']);
    // 支派名後面接這些字，才是指支派、國家、土地；其餘（「流便往田裡去」）是本人，照樣檢查
    const tribeUse = /^(?:(?:、[^、，。；：\s]{1,4})*[一二三兩]?半?支派|人|族(?!長)|子孫|的子孫|女子|的?(?:一切)?城邑|的?地|的?王|的神|營|諸王|和耶路撒冷|的外事)/;
    const missed: string[] = [];
    for (const segment of READING.segments) {
      const tagged = new Set<string>();
      for (const chapter of segment.chapters) for (const verse of chapter.verses) {
        for (const token of verse.t) if (token.k === 'p' && (token.id || token.rid)) tagged.add(verse.text.slice(token.s, token.e));
      }
      const forms = [...tagged].filter((form) => form.length >= 2);
      const all = [...new Set([...tagged].filter((form) => form.length >= 2)), ...tribes];
      for (const chapter of segment.chapters) for (const verse of chapter.verses) {
        const text = verse.text;
        const spans = verse.t.map((token) => [token.s, token.e] as const);
        const longer = [...spans, ...all.flatMap((form) => [...text.matchAll(new RegExp(form, 'g'))].map((m) => [m.index!, m.index! + form.length] as const))];
        for (const form of forms) {
          for (let start = text.indexOf(form); start >= 0; start = text.indexOf(form, start + 1)) {
            const end = start + form.length;
            const inside = longer.some(([s, e]) => s <= start && end <= e && e - s > form.length);
            // 「亞瑪力族長」是人，不是族名
            const clan = (['族', '人'].includes(text.slice(end, end + 1)) && text.slice(end, end + 2) !== '族長')
              || ['女子', '子孫'].includes(text.slice(end, end + 2)) || text.slice(end, end + 3) === '的子孫'
              || (tribes.has(form) && tribeUse.test(text.slice(end)));
            const covered = spans.some(([s, e]) => s < end && start < e);
            if (!inside && !clan && !covered) missed.push(`${chapter.book}${chapter.n}:${verse.v}「${form}」`);
          }
        }
      }
    }
    expect(missed).toEqual([]);
  });

  it('名單牌子、讀經提醒、差異小卡、歸回連結都對得上', () => {
    const plaques = new Set((DATA.placements?.nodes ?? []).map((node) => node.id));
    for (const { key, verse } of verses) {
      if (verse.hold) expect(plaques.has(verse.hold), `${key} ${verse.hold}`).toBe(true);
      if (verse.note !== undefined) expect(READING.notes[verse.note], key).toBeTruthy();
      for (const index of verse.diff ?? []) expect(READING.diffs[index], key).toBeTruthy();
      for (const token of verse.t) if (token.link !== undefined) expect(READING.links[token.link]?.at, key).toBe(key);
    }
    for (const note of READING.notes) {
      expect(note.text).toBeTruthy();
      for (const noteKey of note.verses) expect(VERSES[noteKey], noteKey).toBeTruthy();
    }
    for (const diff of READING.diffs) {
      for (const side of diff.sides) expect(lookupVerses(side.ref).map((line) => line.text ?? '').join(''), side.ref).toContain(side.text);
    }
  });
});

describe('讀經時妻子停在丈夫家裡那張卡', () => {
  const table = householdAliasByVerse(READING, buildGraph(DATA));
  const at = (key: string, wife: string) => table.get(key)?.get(wife) ?? wife;

  it('讀到丈夫這一家：鏡頭順著丈夫 → 妻子 → 兒女，不跳回娘家', () => {
    expect(at('創36:2', '阿何利巴瑪#亞拿')).toBe('所生:以掃:阿何利巴瑪#亞拿');
    expect(at('創36:5', '阿何利巴瑪#亞拿')).toBe('所生:以掃:阿何利巴瑪#亞拿');
    expect(at('創36:14', '阿何利巴瑪#亞拿')).toBe('所生:以掃:阿何利巴瑪#亞拿');
    expect(at('創29:32', '利亞')).toBe('所生:以色列:利亞');
    // 段落第一節「耶和華見利亞失寵……拉結卻不生育」：沒提雅各、也沒提娘家，用丈夫家裡那張卡
    expect(at('創29:31', '利亞')).toBe('所生:以色列:利亞');
    expect(at('創29:31', '拉結')).toBe('所生:以色列:拉結');
    // 「神顧念拉結」沒提雅各和孩子：照這一段前面的決定接下去
    expect(at('創30:22', '拉結')).toBe('所生:以色列:拉結');
  });

  it('只講娘家的經節用本人', () => {
    // 「亞拿的女兒是阿何利巴瑪」
    expect(at('創36:25', '阿何利巴瑪#亞拿')).toBe('阿何利巴瑪#亞拿');
  });

  it('前一節講娘家用本人，下一節都沒提時沿用本人', () => {
    // 創 29:16「拉班有兩個女兒」講娘家 → 本人；29:17「利亞的眼睛沒有神氣，拉結卻生得美貌俊秀」沒提誰 → 沿用本人
    const token = (id: string) => ({ s: 0, e: 1, k: 'p' as const, id });
    const reading = {
      start: '創29:16', notes: [], diffs: [], links: [],
      segments: [{
        id: 't', title: 't', group: 't', range: 't', stage: 'tree',
        chapters: [{ book: '創', n: 29, verses: [
          { v: 16, text: '', t: [token('拉班'), token('利亞'), token('拉結')] },
          { v: 17, text: '', t: [token('利亞'), token('拉結')] },
        ] }],
      }],
    } as unknown as ReadingData;
    const local = householdAliasByVerse(reading, buildGraph(DATA));
    for (const key of ['創29:16', '創29:17']) {
      expect(local.get(key)?.get('利亞') ?? '利亞', key).toBe('利亞');
      expect(local.get(key)?.get('拉結') ?? '拉結', key).toBe('拉結');
    }
  });

  it('每張卡都真的在大圖上', () => {
    const graph = buildGraph(DATA);
    for (const [key, alias] of table) for (const slot of alias.values()) expect(graph.byId.has(slot), `${key} ${slot}`).toBe(true);
  });
});

describe('大衛立的職位與歸回連結', () => {
  const roles = rolesSource as unknown as RolesData;
  const personIds = new Set(DATA.persons.map((person) => person.id));
  const rids = new Set(roles.people.map((person) => person.rid));
  const boxes = new Map(roles.categories.flatMap((category) => category.boxes.map((box) => [box.id, box] as const)));
  const verses = READING.segments.flatMap((segment) => segment.chapters.flatMap((chapter) =>
    chapter.verses.map((verse) => ({ key: `${chapter.book}${chapter.n}:${verse.v}`, verse, stage: verse.stage ?? segment.stage }))));

  it('五類職位（第五類從大衛到所羅門）；每個成員對到家譜樹上的人或只在職位圖上的人', () => {
    expect(roles.categories.map((category) => category.id)).toEqual(['court', 'army', 'temple', 'tribes', 'solomon']);
    const problems: string[] = [];
    for (const box of boxes.values()) {
      const keys = new Set<string>();
      for (const member of box.members) {
        if (keys.has(member.key)) problems.push(`${box.id} 代號重複 ${member.key}`);
        keys.add(member.key);
        if (member.id ? !personIds.has(member.id) : !member.rid || !rids.has(member.rid)) problems.push(`${box.id} ${member.name}`);
        if (member.id && member.rid) problems.push(`${box.id} ${member.name} 同時有 id 和 rid`);
      }
      if (box.kind === 'ring24') expect(new Set(box.members.map((member) => member.order)).size, box.id).toBe(24);
      if (box.kind === 'wheel12') expect(new Set(box.members.map((member) => member.order)).size, box.id).toBe(12);
    }
    expect(problems).toEqual([]);
  });

  it('讀經標記裡只在職位圖上的人都存在；職位印的人都在家譜樹上', () => {
    const missing: string[] = [];
    for (const { key, verse } of verses) {
      for (const token of verse.t) {
        if (token.rid && !rids.has(token.rid)) missing.push(`${key} ${token.rid}`);
        if (token.of && !personIds.has(token.of) && !rids.has(token.of)) missing.push(`${key} 職稱 ${token.of}`);
      }
      if (verse.box && !boxes.has(verse.box)) missing.push(`${key} 方塊 ${verse.box}`);
    }
    for (const seal of DATA.roleSeals ?? []) {
      if (!personIds.has(seal.id)) missing.push(`印 ${seal.id}`);
      if (!boxes.has(seal.box)) missing.push(`印的方塊 ${seal.box}`);
    }
    expect(missing).toEqual([]);
    expect((DATA.roleSeals ?? []).length).toBeGreaterThan(20);
  });

  it('歸回連結：目標存在；耶大雅、哈琳、音麥子孫歸回，哈歌斯族譜尋不著', () => {
    for (const link of READING.links) {
      for (const target of link.to) {
        if (target.tree) expect(personIds.has(target.tree), `${link.at} ${target.tree}`).toBe(true);
        if (target.role) {
          const box = boxes.get(target.role);
          expect(box, `${link.at} ${target.role}`).toBeTruthy();
          if (target.member) expect(box!.members.some((member) => member.key === target.member), `${link.at} ${target.member}`).toBe(true);
        }
      }
    }
    const effect = (at: string) => READING.links.find((link) => link.at === at)?.effect;
    expect(effect('拉2:36')).toBe('returned');
    expect(effect('拉2:37')).toBe('returned');
    expect(effect('拉2:39')).toBe('returned');
    expect(effect('拉2:61')).toBe('lost');
  });

  it('職位章換成職位圖，夾在中間的家譜換回家譜樹', () => {
    const stageOf = (key: string) => verses.find((item) => item.key === key)?.stage;
    expect(stageOf('代上9:44')).toBe('tree');
    expect(stageOf('代上11:10')).toBe('roles');
    expect(stageOf('代上23:7')).toBe('tree');
    expect(stageOf('代上24:10')).toBe('roles');
    expect(stageOf('代上27:5')).toBe('roles');
  });

  it('拉 2、尼 7 讀到時是名冊；段內的祭司班次、尋不著譜系照舊在職位圖', () => {
    const stageOf = (key: string) => verses.find((item) => item.key === key)?.stage;
    for (const key of ['拉2:1', '拉2:10', '拉2:42', '拉2:64', '尼7:8', '尼7:73']) expect(stageOf(key), key).toBe('roster');
    for (const key of ['拉2:36', '拉2:39', '拉2:61', '拉2:62', '尼7:39', '尼7:63']) expect(stageOf(key), key).toBe('roles');
    expect(stageOf('拉7:1')).toBe('tree');
    // 第三階段：拉 8、拉 10、尼 10 是名冊，尼 3 是城牆，王上 4 是職位圖
    for (const key of ['拉8:1', '拉8:20', '拉10:18', '拉10:44', '尼10:1', '尼10:27']) expect(stageOf(key), key).toBe('roster');
    for (const key of ['尼3:1', '尼3:26', '尼3:32']) expect(stageOf(key), key).toBe('wall');
    for (const key of ['王上4:1', '王上4:19']) expect(stageOf(key), key).toBe('roles');
  });

  it('家譜裡有這座城：標在地名上（不是人名），子母畫面的標題是經文裡的字', () => {
    const tokenOf = new Map<number, { k: string; key: string }>();
    for (const { key, verse } of verses) for (const token of verse.t) if (token.link !== undefined) tokenOf.set(token.link, { k: token.k, key });
    const towns = READING.links.map((link, index) => ({ link, index })).filter(({ link }) => link.effect === 'town');
    expect(towns.length).toBeGreaterThan(10);
    for (const { link, index } of towns) {
      expect(tokenOf.get(index)?.k, `${link.at} ${link.word}`).toBe('l');
      if (link.pip) {
        expect(link.to.some((target) => target.tree), `${link.at} pip 要有家譜樹上的人`).toBe(true);
        expect(lookupVerses(link.refs.join(',')).map((line) => line.text ?? '').join(''), link.at).toContain(link.pip);
      }
    }
    // 冊上有名的家族都連到家譜樹上的人
    for (const at of ['拉2:2', '拉2:38', '尼7:41']) {
      const link = READING.links.find((item) => item.at === at && item.effect === 'link');
      expect(link?.to.some((target) => target.tree), at).toBe(true);
    }
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
