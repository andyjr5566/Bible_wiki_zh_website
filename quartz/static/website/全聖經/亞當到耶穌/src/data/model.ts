import source from './genealogy.json';
import readingSource from './reading.json';
import verseSource from './verses.json';
import type { GenealogyData, Person, PlacementItem, PlacementNode, ReadingData, Relation, RolesData, RosterData, VerseMap, WallData } from './types';

export const DATA = source as unknown as GenealogyData;
export const VERSES = verseSource as VerseMap;
export const READING = readingSource as unknown as ReadingData;
/** 大衛立的職位：分頁打開或讀到時才載入（另一個檔案，不拖慢首頁） */
export const loadRoles = (): Promise<RolesData> => import('./roles.json').then((module) => module.default as unknown as RolesData);
/** 歸回的名冊（拉 2、尼 7）：讀到時才載入 */
export const loadRoster = (): Promise<RosterData> => import('./roster.json').then((module) => module.default as unknown as RosterData);
/** 修造城牆的人（尼 3）：讀到時才載入 */
export const loadWall = (): Promise<WallData> => import('./wall.json').then((module) => module.default as unknown as WallData);
/**
 * 把「代上8:30-31」「創11:10-12:1」「創5:1-3, 路3:38」這類寫法展開成逐節的 key（和 verses.json 一致）。
 * 跨章的範圍靠 verses.json 有哪些節來判斷章尾；後面的片段沒寫書卷時沿用前一段的書卷。
 */
export function expandVerseRefs(ref: string, verses: VerseMap = VERSES): string[] {
  const keys: string[] = [];
  let book = '';
  let chapter = 0;
  for (const raw of ref.split(/[、，,;；]/)) {
    const part = raw.trim();
    if (!part) continue;
    let match = /^(.*?)(\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/.exec(part);
    if (!match) {
      const bare = /^(\d+)(?:-(\d+))?$/.exec(part);
      if (!bare || !book) { keys.push(part); continue; }
      match = [part, book, String(chapter), bare[1]!, undefined, bare[2]] as unknown as RegExpExecArray;
    }
    book = match[1]?.trim() || book;
    chapter = Number(match[2]);
    const startVerse = Number(match[3]);
    const endChapter = match[4] ? Number(match[4]) : chapter;
    const endVerse = match[5] ? Number(match[5]) : startVerse;
    if (endChapter === chapter) {
      if (endVerse < startVerse || endVerse - startVerse > 250) { keys.push(part); continue; }
      for (let verse = startVerse; verse <= endVerse; verse += 1) keys.push(`${book}${chapter}:${verse}`);
    } else {
      for (let verse = startVerse; verses[`${book}${chapter}:${verse}`] !== undefined; verse += 1) keys.push(`${book}${chapter}:${verse}`);
      for (let middle = chapter + 1; middle < endChapter; middle += 1) {
        for (let verse = 1; verses[`${book}${middle}:${verse}`] !== undefined; verse += 1) keys.push(`${book}${middle}:${verse}`);
      }
      for (let verse = 1; verse <= endVerse; verse += 1) keys.push(`${book}${endChapter}:${verse}`);
    }
    chapter = endChapter;
  }
  return keys;
}

export interface VerseLine { key: string; text: string | null }

/** 逐節取經文全文；verses.json 沒有的節 text 為 null。 */
export function lookupVerses(ref: string, verses: VerseMap = VERSES): VerseLine[] {
  return expandVerseRefs(ref, verses).map((key) => ({ key, text: verses[key] ?? null }));
}

/** 範圍合成一段純文字（供提示文字用）；全部查無時回傳 null。 */
export function verseText(ref: string, verses: VerseMap = VERSES): string | null {
  const lines = lookupVerses(ref, verses).filter((line) => line.text);
  return lines.length ? lines.map((line) => line.text).join('') : null;
}

export const WIKI_BASE = ((import.meta.env?.VITE_WIKI_BASE as string | undefined) ||
  'https://andyjr5566.github.io/Bible_wiki_zh_website').replace(/\/+$/, '');

export type PlacedKind = PlacementNode['kind'] | 'link';

export interface PersonGraph {
  byId: Map<string, Person>;
  children: Map<string, string[]>;
  spineIds: Set<string>;
  /** 每個節點在大圖上掛在誰底下（主線上的人不在這裡）。 */
  treeParent: Map<string, string>;
  /** 經由大圖安置掛上去的節點：名單牌子、區域、各家牌子，以及各家的根。 */
  placed: Map<string, { kind: PlacedKind; side: PlacementItem['side']; via: PlacementItem['via'] }>;
  /** 妻子欄的「↗」卡 → 妻子本人 */
  bornOf: Map<string, string>;
  /** 兒女欄裡主線兒女的「↗」卡 → 主線上那個人 */
  childRefs: Map<string, string>;
  /** 妻子欄的每一張卡（本人或「↗」卡）：丈夫是誰、妻子是誰、經文有沒有記成夫妻（沒有就標「生母」） */
  wifeSlots: Map<string, { husband: string; wife: string; spouse: boolean }>;
  /** 妻子 → 疊在他上面的祖先，一層一層由上而下；最下面一層是他的父親（記了兩個名字的並排：以連、亞米利） */
  ancestry: Map<string, string[][]>;
  /** 妻子 → 排在他卡片下面的另一位丈夫（拔示巴的烏利亞、亞比該的拿八） */
  otherHusbands: Map<string, string[]>;
  /** 「母親未記載」→ 丈夫 */
  noMother: Map<string, string>;
}

const PLACEMENT_KINDS = new Set(['list', 'region', 'family']);
/** 名單牌子、同時代區域、區域裡各家的牌子：在畫布上是可以展開收合的標示，不是人物。 */
export const isPlacementNode = (person: Person | undefined | null): boolean => Boolean(person && PLACEMENT_KINDS.has(String(person.kind)));

function placementPerson(node: PlacementNode): Person {
  return {
    id: node.id, name: node.title, qualifier: node.ref, kind: node.kind, names: [], parents: [], spouses: [], siblings: [],
    kin: [], descends: [], desc: null, note: null, entry: null, entryGloss: '', gen: {}, lines: [], marks: [], notes: [],
    imported: null, anchor: null, ...(node.family ? { family: node.family } : {}),
  };
}

export function buildGraph(data: GenealogyData): PersonGraph {
  const byId = new Map(data.persons.map((person) => [person.id, person]));
  for (const node of data.placements?.nodes ?? []) byId.set(node.id, placementPerson(node));
  const children = new Map<string, string[]>();
  const treeParent = new Map<string, string>();
  const addChild = (parentId: string, childId: string) => {
    if (!byId.has(parentId) || !byId.has(childId) || parentId === childId) return;
    const items = children.get(parentId) ?? [];
    if (!items.includes(childId)) items.push(childId);
    children.set(parentId, items);
    treeParent.set(childId, parentId);
  };
  const spineIds = new Set(Object.values(data.spine.lines).flat());
  // 樹的連線每人只掛一處，避免同一個孩子同時出現在父親和母親底下、後代數重複計算：
  // 優先掛父親；經文沒記父親才掛母親；都沒有才用「後裔（代數不詳）」。
  // 主線上的人只掛在主線的父親底下（由主線版面處理），這裡不再掛到旁支。
  // 其餘的父母、後裔關係照樣在資訊卡列出。（和匯出程式 _tree_parents 同一條規則）
  for (const person of data.persons) {
    const parents = person.parents ?? [];
    const father = parents.find((relation) => relation.role !== '母' && byId.has(relation.id));
    const mother = parents.find((relation) => relation.role === '母' && byId.has(relation.id));
    const descend = (person.descends ?? []).find((relation) => byId.has(relation.id));
    const parent = father ?? mother ?? descend;
    if (!parent) continue;
    if (spineIds.has(person.id)) {
      if (father) {
        const items = children.get(father.id) ?? [];
        if (!items.includes(person.id)) items.push(person.id);
        children.set(father.id, items);
      }
      continue;
    }
    addChild(parent.id, person.id);
  }
  // 主線往下接不到的家族：照匯出時決定的位置掛上去（排在真正的子女後面）
  const placed: PersonGraph['placed'] = new Map();
  for (const node of data.placements?.nodes ?? []) {
    addChild(node.under, node.id);
    placed.set(node.id, { kind: node.kind, side: 'same', via: null });
  }
  for (const item of data.placements?.items ?? []) {
    if (treeParent.has(item.root)) continue;
    addChild(item.under, item.root);
    const under = byId.get(item.under);
    placed.set(item.root, { kind: isPlacementNode(under) ? (under!.kind as PlacedKind) : 'link', side: item.side, via: item.via });
  }
  // ── 一家人的排法：丈夫 → 妻子一欄 → 兒女一欄 ──
  // 每位有記妻子（或孩子的母親）的男人：妻子們排在同一欄，兒女排在下一欄，各自接在自己的母親底下；
  // 經文沒寫母親的兒女接在同一欄的「母親未記載」底下。主線上的兒女（所羅門）不能搬家，在母親底下放一張「↗」卡。
  // 妻子本人的卡怎麼來：
  //   1. 本來就排在丈夫旁邊、或和丈夫在同一處（西庇太一家）→ 直接用本人。
  //   2. 娘家只有一條祖先線、而且掛在這一家裡面（瑪迦的祖父亞米忽、父親達買掛在他兒子押沙龍底下）
  //      → 本人搬到妻子欄，祖先改成疊在他上面的小卡（亞米忽 → 達買 → 瑪迦）。
  //   3. 娘家是另外一大支（利亞、拉結在拉班底下）→ 妻子欄放一張「↗」卡，寫「拉班的女兒」，點了跳過去。
  const bornOf = new Map<string, string>();
  const childRefs = new Map<string, string>();
  const wifeSlots: PersonGraph['wifeSlots'] = new Map();
  const ancestry = new Map<string, string[][]>();
  const otherHusbands = new Map<string, string[]>();
  const noMother = new Map<string, string>();
  const remove = (parentId: string | undefined, id: string) => {
    const items = parentId === undefined ? undefined : children.get(parentId);
    const index = items ? items.indexOf(id) : -1;
    if (items && index >= 0) items.splice(index, 1);
  };
  const attach = (parentId: string, id: string) => {
    remove(treeParent.get(id), id);
    children.set(parentId, [...(children.get(parentId) ?? []), id]);
    treeParent.set(id, parentId);
  };
  const reaches = (from: string | undefined, target: string) => {
    for (let cur = from, steps = 0; cur !== undefined && steps < 500; cur = treeParent.get(cur), steps += 1) if (cur === target) return true;
    return false;
  };
  const subtree = (id: string): string[] => [id, ...(children.get(id) ?? []).flatMap(subtree)];
  const fatherOf = (person: Person) => (person.parents ?? []).find((relation) => relation.role !== '母' && byId.has(relation.id))?.id;
  const motherOf = (person: Person) => (person.parents ?? []).find((relation) => relation.role === '母' && byId.has(relation.id))?.id;
  const spousesOf = new Map<string, string[]>();
  for (const person of data.persons) {
    for (const spouse of person.spouses ?? []) {
      if (!byId.has(spouse.id) || spouse.id === person.id) continue;
      for (const [a, b] of [[person.id, spouse.id], [spouse.id, person.id]] as const) {
        const items = spousesOf.get(a) ?? [];
        if (!items.includes(b)) items.push(b);
        spousesOf.set(a, items);
      }
    }
  }
  const claimed = new Set<string>();
  const byFather = new Map<string, Person[]>();
  for (const person of data.persons) {
    const father = fatherOf(person);
    if (father) byFather.set(father, [...(byFather.get(father) ?? []), person]);
  }
  for (const husband of data.persons) {
    if (husband.sex === 'f') continue;
    const kids = (byFather.get(husband.id) ?? []).filter((person) => spineIds.has(person.id) || treeParent.get(person.id) === husband.id);
    const wives: string[] = [];
    for (const kid of kids) {
      const mother = motherOf(kid);
      if (mother && !spineIds.has(mother) && !wives.includes(mother)) wives.push(mother);
    }
    const kidIds = new Set(kids.map((kid) => kid.id));
    for (const spouse of spousesOf.get(husband.id) ?? []) {
      if (byId.get(spouse)?.sex === 'm' || spineIds.has(spouse) || kidIds.has(spouse) || wives.includes(spouse)) continue;
      wives.push(spouse);
    }
    // 沒有兒女、妻子也不在他旁邊的（烏利亞只是掛在拔示巴旁邊）：不另外排一家
    if (!wives.length || (!kids.length && !wives.some((wife) => treeParent.get(wife) === husband.id))) continue;
    const slotOf = new Map<string, string>();
    for (const wife of wives) {
      let own = false;
      const at = treeParent.get(wife);
      if (!claimed.has(wife)) {
        if (at === husband.id || (at !== undefined && at === treeParent.get(husband.id))) own = true;
        else {
          const chain: string[] = [];
          let cur = wife;
          let inside = false;
          for (let steps = 0; steps < 60; steps += 1) {
            const up = treeParent.get(cur);
            if (up === undefined) break;
            // 一路往上都是父親（達買、亞米忽）就收進祖先線；走到不是父親的那一層，看那一層是不是在這一家裡面（押沙龍）
            if (byId.get(cur)?.parents?.some((relation) => relation.id === up) && up !== husband.id) {
              chain.unshift(up);
              cur = up;
              continue;
            }
            // 掛在主線上的兒子底下也算（西比亞掛在他兒子約阿施底下）
            inside = reaches(up, husband.id) || kidIds.has(up);
            break;
          }
          const top = chain[0] ?? wife;
          const keep = new Set([...chain, ...subtree(wife)]);
          if (inside && subtree(top).every((id) => keep.has(id))) {
            own = true;
            if (chain.length) {
              remove(treeParent.get(top), top);
              chain.forEach((id, index) => { remove(id, chain[index + 1] ?? wife); treeParent.set(id, wife); });
              ancestry.set(wife, chain.map((id) => [id]));
            }
          }
        }
      }
      let slot = wife;
      if (own) {
        claimed.add(wife);
        attach(husband.id, wife);
      } else {
        slot = `${BORN_OF_PREFIX}${husband.id}:${wife}`;
        byId.set(slot, bornOfPerson(slot, byId.get(wife)!, byId));
        bornOf.set(slot, wife);
        attach(husband.id, slot);
      }
      wifeSlots.set(slot, { husband: husband.id, wife, spouse: (spousesOf.get(husband.id) ?? []).includes(wife) });
      slotOf.set(wife, slot);
    }
    let capsule: string | undefined;
    for (const kid of kids) {
      const mother = motherOf(kid);
      let target = mother ? slotOf.get(mother) : undefined;
      if (!target) {
        if (!capsule) {
          capsule = `${NO_MOTHER_PREFIX}${husband.id}`;
          byId.set(capsule, markerPerson(capsule, '母親未記載', 'no-mother', husband.lines ?? []));
          noMother.set(capsule, husband.id);
          attach(husband.id, capsule);
        }
        target = capsule;
      }
      if (spineIds.has(kid.id)) {
        const ref = `${CHILD_REF_PREFIX}${target}:${kid.id}`;
        byId.set(ref, { ...bornOfPerson(ref, kid, byId), qualifier: kid.qualifier || firstReference(kid), lines: kid.lines ?? [] });
        childRefs.set(ref, kid.id);
        attach(target, ref);
      } else attach(target, kid.id);
    }
    // 本人排進妻子欄的妻子：底下掛著的父親（另一個名字）移到上面那一排，另一位丈夫移到卡片下面，不混進兒女欄
    for (const wife of wives) {
      if (slotOf.get(wife) !== wife) continue;
      const self = byId.get(wife)!;
      for (const id of [...(children.get(wife) ?? [])]) {
        const other = byId.get(id);
        if (self.parents?.some((relation) => relation.id === id)) {
          remove(wife, id);
          const rows = ancestry.get(wife) ?? [[]];
          if (!rows.length) rows.push([]);
          rows[rows.length - 1]!.push(id);
          ancestry.set(wife, rows);
        } else if ((spousesOf.get(wife) ?? []).includes(id) && (other?.sex === 'm' || !other?.sex) && !(children.get(id) ?? []).length) {
          remove(wife, id);
          otherHusbands.set(wife, [...(otherHusbands.get(wife) ?? []), id]);
        }
      }
    }
    // 妻子欄排在最前面（照經文出現的順序），「母親未記載」接在後面，其他掛在他旁邊的（名單牌子、親屬）再後面
    const column = [...wives.map((wife) => slotOf.get(wife)!), ...(capsule ? [capsule] : [])];
    children.set(husband.id, [...column, ...(children.get(husband.id) ?? []).filter((id) => !column.includes(id))]);
  }
  return { byId, children, spineIds, treeParent, placed, bornOf, childRefs, wifeSlots, ancestry, otherHusbands, noMother };
}

const CHILD_REF_PREFIX = '主線:';
const NO_MOTHER_PREFIX = '未記母親:';
const BORN_OF_PREFIX = '所生:';
/** 一家人排法用的標示卡：妻子的「↗」卡、主線兒女的「↗」卡（kind born-of），「母親未記載」（kind no-mother）。不是人物，不算後代人數。 */
export const isBornOfNode = (person: Person | undefined | null): boolean => Boolean(person && person.kind === 'born-of');
export const isMarkerNode = (person: Person | undefined | null): boolean => Boolean(person && (person.kind === 'born-of' || person.kind === 'no-mother'));
function markerPerson(id: string, name: string, kind: string, lines: string[]): Person {
  return {
    id, name, qualifier: '', kind, names: [], parents: [], spouses: [], siblings: [],
    kin: [], descends: [], desc: null, note: null, entry: null, entryGloss: '', gen: {}, lines, marks: [], notes: [],
    imported: null, anchor: null,
  };
}
function bornOfPerson(id: string, person: Person, byId: Map<string, Person>): Person {
  // 第二行寫出身：「拉班的女兒」；沒記父親的寫經節
  const father = (person.parents ?? []).find((relation) => relation.role !== '母' && byId.has(relation.id));
  const origin = father ? `${byId.get(father.id)!.name}的${person.sex === 'm' ? '兒子' : '女兒'}` : person.qualifier || firstReference(person);
  return { ...markerPerson(id, person.name, 'born-of', person.lines ?? []), qualifier: origin };
}
// 資訊卡的「子女」：父母記載裡有這個人的都算（不論父親或母親），和畫布的樹（每人只掛一處）不同。
const recordedChildren = new WeakMap<PersonGraph, Map<string, Person[]>>();
export function childrenOf(personId: string, graph: PersonGraph): Person[] {
  let index = recordedChildren.get(graph);
  if (!index) {
    index = new Map();
    for (const person of graph.byId.values()) {
      for (const relation of person.parents ?? []) {
        const items = index.get(relation.id) ?? [];
        if (!items.includes(person)) items.push(person);
        index.set(relation.id, items);
      }
    }
    recordedChildren.set(graph, index);
  }
  return index.get(personId) ?? [];
}

export function branchRoots(data: GenealogyData, graph = buildGraph(data)): Array<{ parentId: string; rootId: string }> {
  const roots: Array<{ parentId: string; rootId: string }> = [];
  for (const parentId of graph.spineIds) {
    for (const rootId of graph.children.get(parentId) ?? []) {
      if (!graph.spineIds.has(rootId)) roots.push({ parentId, rootId });
    }
  }
  return roots;
}

export function descendantCount(personId: string, graph: PersonGraph): number {
  let total = 0;
  const seen = new Set<string>([personId]);
  const queue = [...(graph.children.get(personId) ?? [])];
  while (queue.length) {
    const id = queue.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    // 主線兒女的「↗」卡代表一個人，算進去；妻子的「↗」卡、「母親未記載」不算
    if (!isMarkerNode(graph.byId.get(id)) || graph.childRefs.has(id)) total += 1;
    queue.push(...(graph.children.get(id) ?? []));
  }
  return total;
}

export function firstReference(person: Person): string {
  return person.names?.find((item) => item.ref)?.ref ??
    person.parents?.find((item) => item.ref)?.ref ?? '';
}

export function personQualifier(person: Person, graph: PersonGraph): string {
  if (person.qualifier) return person.qualifier;
  const motherName = person.mother_name ?? '';
  const parent = person.parents?.find((item) => !/母|mother/i.test(`${item.role ?? ''} ${item.type ?? ''}`) && graph.byId.get(item.id)?.name !== motherName) ?? person.parents?.[0];
  const parentName = parent ? graph.byId.get(parent.id)?.name : undefined;
  if (parentName) return `${parentName}的${person.sex === 'f' ? '女兒' : '兒子'}`;
  return firstReference(person) ? `見 ${firstReference(person)}` : '';
}

export function relationName(relation: Relation, graph: PersonGraph): string {
  const person = graph.byId.get(relation.id);
  const qualifier = relation.qualifier ? `（${relation.qualifier}）` : '';
  return `${person?.name ?? relation.id}${qualifier}`;
}

export function searchNameForms(person: Person, query: string): string[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return [...new Set([person.name, ...(person.names ?? []).map((name) => name.as)])]
    .filter((form) => form.toLocaleLowerCase().includes(needle));
}

function nameMatchRank(form: string, needle: string): number {
  const normalized = form.toLocaleLowerCase();
  if (normalized === needle) return 3;
  if (normalized.startsWith(needle)) return 2;
  return normalized.includes(needle) ? 1 : 0;
}

export function searchPeople(query: string, data: GenealogyData, graph = buildGraph(data)): Person[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  return data.persons
    .map((person, index) => ({
      person,
      index,
      rank: Math.max(0, ...searchNameForms(person, needle).map((form) => nameMatchRank(form, needle))),
    }))
    .filter((result) => result.rank > 0)
    .sort((a, b) => b.rank - a.rank || Number(graph.spineIds.has(b.person.id)) - Number(graph.spineIds.has(a.person.id)) || a.index - b.index)
    .slice(0, 50)
    .map(({ person }) => person);
}

export interface AncestorPath {
  ids: string[];
  edges: Array<{ from: string; to: string; kind: 'parent' | 'descends' }>;
  hasUnknownGenerations: boolean;
}

export function pathToFirstAncestor(personId: string, data: GenealogyData, graph = buildGraph(data)): AncestorPath | null {
  const routes = Object.values(data.spine.lines);
  const first = routes[0]?.[0];
  if (!first || !graph.byId.has(personId)) return null;
  const queue: Array<{ id: string; ids: string[]; edges: AncestorPath['edges'] }> = [{ id: personId, ids: [personId], edges: [] }];
  const visited = new Set([personId]);
  while (queue.length) {
    const current = queue.shift()!;
    if (current.id === first) {
      return {
        ...current,
        hasUnknownGenerations: current.edges.some((edge) => edge.kind === 'descends'),
      };
    }
    const person = graph.byId.get(current.id)!;
    const candidates = [
      ...(person.parents ?? []).map((relation) => ({ relation, kind: 'parent' as const })),
      ...(person.descends ?? []).map((relation) => ({ relation, kind: 'descends' as const })),
    ];
    candidates.sort((a, b) => {
      const priority = (item: typeof candidates[number]) => {
        const target = graph.byId.get(item.relation.id);
        const onSpine = target && graph.spineIds.has(target.id);
        const imported = Boolean(item.relation.source && /代上|import/i.test(String(item.relation.source)));
        return (onSpine ? 0 : 10) + (imported ? 20 : 0) + (item.kind === 'parent' ? 0 : 1);
      };
      return priority(a) - priority(b);
    });
    for (const { relation, kind } of candidates) {
      if (!graph.byId.has(relation.id) || visited.has(relation.id)) continue;
      visited.add(relation.id);
      queue.push({
        id: relation.id,
        ids: [...current.ids, relation.id],
        edges: [...current.edges, { from: current.id, to: relation.id, kind }],
      });
    }
  }
  return null;
}

function relation(id: string, ref?: string, extra: Partial<Relation> = {}): Relation {
  return { id, ...(ref ? { ref } : {}), ...extra };
}

/** Deterministic stress fixture for the development canvas and geometry gate. */
export function makeSyntheticData(targetSize = 3000): GenealogyData {
  const persons: Person[] = [];
  const create = (id: string, name: string, lines: string[], parents: Relation[] = []): Person => {
    const person: Person = {
      id, name, qualifier: '', sex: 'm', kind: 'person', names: [{ as: name }], parents,
      spouses: [], siblings: [], kin: [], descends: [], desc: null, note: null,
      entry: null, entryGloss: '', gen: {}, lines: lines as Person['lines'], marks: [], notes: [],
      imported: null, anchor: null,
    };
    persons.push(person);
    return person;
  };
  const common: string[] = [];
  for (let i = 0; i < 38; i += 1) {
    const id = i === 0 ? '亞當' : `common-${i}`;
    common.push(id);
    create(id, i === 0 ? '亞當' : `共同祖先 ${i + 1}`, i === 0 ? ['common', '馬太', '路加'] : ['common', '馬太', '路加'],
      i ? [relation(common[i - 1])] : []);
  }
  const matthew: string[] = [...common];
  const luke: string[] = [...common];
  for (let i = 38; i < 75; i += 1) {
    const mId = `m-${i}`;
    const lId = `l-${i}`;
    matthew.push(mId);
    luke.push(lId);
    create(mId, `馬太支線 ${i + 1}`, ['馬太'], [relation(matthew[matthew.length - 2])]);
    create(lId, `路加支線 ${i + 1}`, ['路加'], [relation(luke[luke.length - 2])]);
  }
  const jesusId = '耶穌';
  matthew.push(jesusId);
  luke.push(jesusId);
  create(jesusId, '耶穌', ['common', '馬太', '路加'], [relation(matthew[matthew.length - 2]), relation(luke[luke.length - 2])]);
  const parentCounts = new Map<string, number>();
  for (const person of persons) {
    for (const item of person.parents ?? []) parentCounts.set(item.id, (parentCounts.get(item.id) ?? 0) + 1);
  }
  const makeSideChild = (parentId: string, serial: number): Person => {
    const id = `side-${serial}`;
    return create(id, `旁支人物 ${serial}`, [], [relation(parentId)]);
  };
  let serial = 1;
  const pending: Array<{ id: string; depth: number }> = [];
  for (let i = 0; i < [...new Set([...matthew, ...luke])].length && persons.length < targetSize; i += 1) {
    const parentId = [...new Set([...matthew, ...luke])][i]!;
    const spineChildCount = parentCounts.get(parentId) ?? 0;
    const totalLimit = Math.max(0, 8 - spineChildCount);
    const offshoots = Math.min(totalLimit, (i * 7 + 3) % 9);
    for (let j = 0; j < offshoots && persons.length < targetSize; j += 1) {
      const child = makeSideChild(parentId, serial++);
      pending.push({ id: child.id, depth: 1 });
      parentCounts.set(parentId, (parentCounts.get(parentId) ?? 0) + 1);
    }
  }
  let cursor = 0;
  while (cursor < pending.length && persons.length < targetSize) {
    const { id, depth } = pending[cursor++]!;
    if (depth >= 6) continue;
    const count = 1 + ((cursor * 13) % 4);
    for (let i = 0; i < count && persons.length < targetSize; i += 1) {
      const child = makeSideChild(id, serial++);
      pending.push({ id: child.id, depth: depth + 1 });
      parentCounts.set(id, (parentCounts.get(id) ?? 0) + 1);
    }
  }
  for (let i = 3; i < persons.length; i += 97) {
    const person = persons[i]!;
    const sibling = persons[Math.max(0, i - 1)]!;
    person.kin = [relation(sibling.id, undefined, { rel: '親族' })];
  }
  const unknown = persons.find((person) => person.id.startsWith('side-'));
  if (unknown) unknown.descends = [relation('亞當', undefined, { rel: '代數不詳' })];
  const branchPerson = persons.find((person) => person.id.startsWith('side-'));
  if (branchPerson && branchPerson.parents?.[0]) {
    branchPerson.parents.push(relation(common[2]!, undefined, { source: '代上匯入' }));
  }
  const matthewOnly = new Set(matthew);
  for (const person of persons) {
    person.gen = {
      ...(matthewOnly.has(person.id) ? { 馬太: matthew.indexOf(person.id) + 1 } : {}),
      ...(luke.includes(person.id) ? { 路加: luke.indexOf(person.id) + 1 } : {}),
    };
  }
  return {
    persons,
    spine: {
      segments: [
        { id: 'common', title: '共同家譜', lines: { common } },
        { id: 'two-lines', title: '兩條家譜', lines: { 馬太: matthew.slice(38), 路加: luke.slice(38) } },
      ],
      lines: { 馬太: matthew, 路加: luke },
    },
    witnesses: [
      { id: 'synthetic-matthew', title: '馬太家譜', ref: '', line: '馬太', entries: matthew.map((id) => ({ id })) },
      { id: 'synthetic-luke', title: '路加家譜', ref: '', line: '路加', entries: luke.map((id) => ({ id })) },
    ],
    ages: { people: [], events: [], notes: [] },
    notes: [],
    tour: [{ id: 'synthetic-tour', title: '從頭開始', focus: ['亞當', jesusId], refs: '', text: '這是合成測試資料。' }],
    families: [],
    ntFamilies: [],
    sources: [],
  };
}
