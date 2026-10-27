export const WIKI_BASE = (
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_WIKI_BASE) ||
  'https://andyjr5566.github.io/Bible_wiki_zh_website'
).replace(/\/+$/, '');

export function entryUrl(type: string, title: string): string {
  return `${WIKI_BASE}/link_folder/${encodeURIComponent(type)}/${encodeURIComponent(title)}`;
}

export function chapterUrl(bookFolder: string, chapter: number): string {
  return `${WIKI_BASE}/${encodeURIComponent(bookFolder)}/${encodeURIComponent(`第${chapter}章`)}`;
}

export function siblingSiteUrl(book: string, chapter: string, hash = ''): string {
  const suffix = hash ? (hash.startsWith('#') ? hash : `#${hash}`) : '';
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname.includes('/dist/')) {
      return `../../../${encodeURIComponent(book)}/${encodeURIComponent(chapter)}/dist/index.html${suffix}`;
    }
    if (window.location.protocol !== 'http:' || window.location.port !== '3024') {
      return `../../${encodeURIComponent(book)}/${encodeURIComponent(chapter)}/index.html${suffix}`;
    }
  }
  return `${WIKI_BASE}/website/${encodeURIComponent(book)}/${encodeURIComponent(chapter)}/index.html${suffix}`;
}

export function genealogyUrl(personId: string): string {
  return siblingSiteUrl('全聖經', '亞當到耶穌', `p=${encodeURIComponent(personId)}`);
}

export function wildernessUrl(): string {
  return siblingSiteUrl('民數記', '第33章');
}
