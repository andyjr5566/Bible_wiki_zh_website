import source from './genealogy.json';
import verseSource from './verses.json';
import type { GenealogyData, Person, Relation, VerseMap } from './types';

export const DATA = source as unknown as GenealogyData;
export const VERSES = verseSource as VerseMap;
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

export interface PersonGraph {
  byId: Map<string, Person>;
  children: Map<string, string[]>;
  spineIds: Set<string>;
}

export function buildGraph(data: GenealogyData): PersonGraph {
  const byId = new Map(data.persons.map((person) => [person.id, person]));
  const children = new Map<string, string[]>();
  const addChild = (parentId: string, childId: string) => {
    if (!byId.has(parentId) || !byId.has(childId) || parentId === childId) return;
    const items = children.get(parentId) ?? [];
    if (!items.includes(childId)) items.push(childId);
    children.set(parentId, items);
  };
  const spineIds = new Set(Object.values(data.spine.lines).flat());
  // 樹的連線每人只掛一處，避免同一個孩子同時出現在父親和母親底下、後代數重複計算：
  // 優先掛父親；經文沒記父親才掛母親；都沒有才用「後裔（代數不詳）」。
  // 主線上的人只掛在主線的父親底下（由主線版面處理），這裡不再掛到旁支。
  // 其餘的父母、後裔關係照樣在資訊卡列出。
  for (const person of data.persons) {
    const parents = person.parents ?? [];
    const father = parents.find((relation) => relation.role !== '母');
    const mother = parents.find((relation) => relation.role === '母');
    const descend = (person.descends ?? [])[0];
    const treeParent = father ?? mother ?? descend;
    if (!treeParent) continue;
    if (spineIds.has(person.id)) {
      if (father) addChild(father.id, person.id);
      continue;
    }
    addChild(treeParent.id, person.id);
  }
  return { byId, children, spineIds };
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
    total += 1;
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
