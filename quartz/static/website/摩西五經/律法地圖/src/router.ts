/**
 * Hash 路由：#/law/ex21-02?d=research
 * 用 hash 是因為頁面以 file:// 打開也要能用、能上一頁、能分享。
 */
export interface Route {
  name: string;
  params: string[];
  query: URLSearchParams;
}

export function parse(hash = location.hash): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const parts = path.split('/').filter(Boolean).map((p) => decodeURIComponent(p));
  return { name: parts[0] ?? '', params: parts.slice(1), query: new URLSearchParams(qs) };
}

/** 產生站內連結 */
export const href = (...parts: (string | number)[]) => `#/${parts.map((p) => encodeURIComponent(String(p))).join('/')}`;

export const go = (hash: string) => {
  location.hash = hash;
};
