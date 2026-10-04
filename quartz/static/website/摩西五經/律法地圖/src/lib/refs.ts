/** 搜尋框的經文參照：「申15:12」「申 15」「申命記15章」「出21：2-6」 */
export interface QueryRef {
  book: string;
  chapter: number;
  from?: number;
  to?: number;
}

const BOOKS: [string, string][] = [
  ['創世記', '創'],
  ['出埃及記', '出'],
  ['利未記', '利'],
  ['民數記', '民'],
  ['申命記', '申'],
];

export function parseQueryRef(q: string): QueryRef | null {
  const m = /^\s*(創世記|出埃及記|利未記|民數記|申命記|創|出|利|民|申)\s*(\d+)\s*(?:章)?\s*(?:[:：]\s*(\d+)(?:\s*[-–~～]\s*(\d+))?)?\s*節?\s*$/.exec(q);
  if (!m) return null;
  const book = BOOKS.find(([name, abbr]) => name === m[1] || abbr === m[1])![0];
  const ref: QueryRef = { book, chapter: Number(m[2]) };
  if (m[3]) {
    ref.from = Number(m[3]);
    ref.to = Number(m[4] ?? m[3]);
  }
  return ref;
}

export function refHits(ref: QueryRef, law: { book: string; chapter: number; refs: [number, number][] }): boolean {
  if (ref.book !== law.book || ref.chapter !== law.chapter) return false;
  if (ref.from === undefined) return true;
  return law.refs.some(([a, b]) => ref.from! <= b && ref.to! >= a);
}
