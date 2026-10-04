import raw from './explorer.json';
import type { Book, Explorer, Group, Law, Relation, RelationType, Section, Topic, VerseLink } from './types';
import { chapterUrl, entryUrl } from './links';

export const DB = raw as unknown as Explorer;

const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));

export const books: Book[] = DB.books;
export const bookByName = new Map(books.map((b) => [b.name, b]));
export const bookByAbbr = new Map(books.map((b) => [b.abbr, b]));
export const groupById = byId(DB.groups);
export const topicById = byId(DB.topics);
export const sectionById = byId(DB.sections);
export const lawById = byId(DB.laws);

/** 五經順序：書卷 → 章 → 起始節 */
export const lawOrder = (l: Law) => bookByName.get(l.book)!.num * 1e6 + l.chapter * 1e3 + l.refs[0][0];
export const laws: Law[] = [...DB.laws].sort((a, b) => lawOrder(a) - lawOrder(b));

export const abbrOf = (bookName: string) => bookByName.get(bookName)?.abbr ?? bookName;

/** 「出21:2-6」；同章多段時「申22:5、9-12」 */
export function refText(l: { book: string; chapter: number; refs: [number, number][] }): string {
  const parts = l.refs.map(([a, b]) => (a === b ? `${a}` : `${a}-${b}`));
  return `${abbrOf(l.book)}${l.chapter}:${parts.join('、')}`;
}

export const versesOfLaw = (l: Law): number[] => l.refs.flatMap(([a, b]) => Array.from({ length: b - a + 1 }, (_, i) => a + i));

export interface VerseView {
  n: number;
  text: string;
  links: VerseLink[];
}
export const lawVerses = (l: Law): VerseView[] =>
  versesOfLaw(l).map((n) => {
    const key = `${abbrOf(l.book)}${l.chapter}:${n}`;
    return { n, text: DB.verses[key] ?? '', links: DB.links[key] ?? [] };
  });

/** 經文自己交代理由的節（和合本原句） */
export const lawWhy = (l: Law): { n: number; ref: string; text: string }[] =>
  l.why.map((n) => ({ n, ref: `${abbrOf(l.book)}${l.chapter}:${n}`, text: DB.verses[`${abbrOf(l.book)}${l.chapter}:${n}`] ?? '' })).filter((x) => x.text);

/** 這條律法的經文連到的條目（依出現順序、不重複） */
export function lawEntries(l: Law): string[] {
  const seen = new Set<string>();
  for (const v of lawVerses(l)) for (const k of v.links) seen.add(k.target);
  return [...seen];
}

export const groupOfTopic = (topicId: string): Group | undefined => groupById.get(topicById.get(topicId)?.group ?? '');
export const groupOfLaw = (l: Law): Group | undefined => groupOfTopic(l.topics[0]);

export const lawsOfTopic = (topicId: string): Law[] => laws.filter((l) => l.topics.includes(topicId));
export const lawsOfGroup = (groupId: string): Law[] => {
  const ts = new Set(groupById.get(groupId)?.topics ?? []);
  return laws.filter((l) => l.topics.some((t) => ts.has(t)));
};

/** 提到某條目的律法：經文裡連到它，或條文直接掛了它 */
export const lawsOfEntry = (title: string): Law[] =>
  laws.filter((l) => l.entries.includes(title) || lawEntries(l).includes(title));

export const relationsOf = (lawId: string): { rel: Relation; other: Law; outgoing: boolean }[] =>
  DB.relations
    .filter((r) => r.from === lawId || r.to === lawId)
    .map((rel) => ({ rel, outgoing: rel.from === lawId, other: lawById.get(rel.from === lawId ? rel.to : rel.from)! }));

export const relationBetween = (a: string, b: string): Relation | undefined =>
  DB.relations.find((r) => (r.from === a && r.to === b) || (r.from === b && r.to === a));

/** 由關聯連在一起的律法群組（跨卷重述），只留兩條以上的 */
export function relationClusters(): Law[][] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    const p = parent.get(x) ?? x;
    if (p === x) return x;
    const root = find(p);
    parent.set(x, root);
    return root;
  };
  for (const r of DB.relations) {
    const a = find(r.from);
    const b = find(r.to);
    parent.set(r.from, parent.get(r.from) ?? r.from);
    parent.set(r.to, parent.get(r.to) ?? r.to);
    if (a !== b) parent.set(a, b);
  }
  const groups = new Map<string, Law[]>();
  for (const l of laws) {
    if (!parent.has(l.id)) continue;
    const root = find(l.id);
    groups.set(root, [...(groups.get(root) ?? []), l]);
  }
  return [...groups.values()].filter((g) => g.length > 1);
}

/**
 * 關聯的說法，從「目前這一條」看另一條。
 * relations.yaml 的 from 是先出現的那一條，to 是後來補充、重述或引用它的那一條。
 */
export function relationLabel(type: RelationType, otherIsLater: boolean): string {
  switch (type) {
    case 'parallel': return '同一條又記了一次';
    case 'supplement': return otherIsLater ? '後來補充了這一條' : '這一條補充了它';
    case 'case': return otherIsLater ? '照這一條處理的事例' : '這件事照它處理';
    case 'cites': return otherIsLater ? '引用了這一條' : '這一條引用了它';
  }
}

/** 兩條之間的關係寫成一句：「申15:12-18 補充了出21:2-6」 */
export function relationSentence(rel: Relation): string {
  const a = refText(lawById.get(rel.from)!);
  const b = refText(lawById.get(rel.to)!);
  switch (rel.type) {
    case 'parallel': return `${b}和${a}記的是同一條`;
    case 'supplement': return `${b}補充了${a}`;
    case 'case': return `${b}是照${a}處理的事例`;
    case 'cites': return `${b}引用了${a}`;
  }
}

/** 某一章的律法 */
export const lawsOfChapter = (bookName: string, chapter: number): Law[] => laws.filter((l) => l.book === bookName && l.chapter === chapter);

export const sectionOf = (l: Law): Section | undefined => sectionById.get(l.section);
export const topicsOf = (l: Law): Topic[] => l.topics.map((t) => topicById.get(t)!).filter(Boolean);

export const entryHref = (title: string): string => entryUrl(DB.entries[title]?.type ?? '主題', title);
export const chapterHref = (bookName: string, chapter: number): string =>
  chapterUrl(bookByName.get(bookName)!.num, bookName, chapter);

/** 在律法裡常和某條目一起出現的其他條目 */
export function cooccurring(title: string, limit = 12): [string, number][] {
  const count = new Map<string, number>();
  for (const l of lawsOfEntry(title)) for (const e of new Set([...lawEntries(l), ...l.entries])) if (e !== title) count.set(e, (count.get(e) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/** 和某主題共同標在同一條律法上的其他主題 */
export function relatedTopics(topicId: string): [Topic, number][] {
  const count = new Map<string, number>();
  for (const l of lawsOfTopic(topicId)) for (const t of l.topics) if (t !== topicId) count.set(t, (count.get(t) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => [topicById.get(t)!, n]);
}
