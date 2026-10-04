import { DB, laws, lawVerses, refText } from '../data/db';
import type { Law, Topic } from '../data/types';
import { parseQueryRef, refHits } from './refs';

export interface SearchResults {
  ref: { label: string; laws: Law[] } | null;
  laws: Law[];
  topics: Topic[];
  entries: string[];
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

/** 全站搜尋：經文參照、條文（標題／說明／經文）、主題、條目 */
export function search(q: string, limit = 8): SearchResults {
  const text = norm(q);
  const empty: SearchResults = { ref: null, laws: [], topics: [], entries: [] };
  if (!text) return empty;
  const r = parseQueryRef(q);
  const ref = r ? { label: `${r.book} ${r.chapter}${r.from ? `:${r.from}${r.to !== r.from ? `-${r.to}` : ''}` : ' 章'}`, laws: laws.filter((l) => refHits(r, l)) } : null;
  return {
    ref,
    laws: r ? [] : rank(laws, (l) => lawScore(l, text, q.trim())).slice(0, limit),
    topics: rank(DB.topics, (t) => nameScore([t.plain, t.name], text)).slice(0, limit),
    entries: rank(Object.keys(DB.entries), (e) => nameScore([e], text)).slice(0, limit),
  };
}

/** 分數高的排前面；同分照原來的順序（經文順序）。分數 0 表示沒命中。 */
function rank<T>(items: T[], score: (x: T) => number): T[] {
  return items.map((x, i) => ({ x, i, s: score(x) })).filter((e) => e.s > 0).sort((a, b) => b.s - a.s || a.i - b.i).map((e) => e.x);
}

/** 名稱：完全相同 > 開頭相同 > 包含 */
export function nameScore(names: string[], text: string): number {
  let best = 0;
  for (const n of names.map(norm)) best = Math.max(best, n === text ? 3 : n.startsWith(text) ? 2 : n.includes(text) ? 1 : 0);
  return best;
}

/** 條文：標題命中最重，其次一句話、經文出處，最後是經文本文 */
export function lawScore(l: Law, text: string, raw: string): number {
  let s = 0;
  if (norm(l.title).includes(text)) s += 4;
  if (norm(l.summary).includes(text)) s += 2;
  if (norm(refText(l)).includes(text)) s += 3;
  if (lawVerses(l).some((v) => v.text.includes(raw))) s += 1;
  return s;
}
