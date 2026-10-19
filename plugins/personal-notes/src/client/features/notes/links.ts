// 筆記裡的 [[條目]]：把名稱對到網站的頁面，並提供輸入 [[ 時的自動完成（12 C6）。
// 索引由建置時的 emitter 輸出（格式見 model/linkIndex.ts），第一次需要時才下載。

import type { LinkIndex, LinkPage } from "../../model/linkIndex"
import { loadLinkIndex } from "../../ui/linkIndex"

export interface LinkResolver {
  /** [[名稱]] 對應的 slug；找不到回傳 null。 */
  resolve(target: string): string | null
  /** 自動完成：依輸入找最多 limit 個候選。 */
  search(query: string, limit?: number): LinkPage[]
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, " ")

export function createResolver(index: LinkIndex): LinkResolver {
  const byKey = new Map<string, string>()
  const add = (key: string, slug: string) => {
    const k = norm(key)
    if (k && !byKey.has(k)) byKey.set(k, slug)
  }
  // 優先順序：完整 slug → 標題 → 別名／檔名（先登記的勝出）
  for (const p of index.pages) add(p.s, p.s)
  for (const p of index.pages) add(p.t, p.s)
  for (const p of index.pages) for (const a of p.a ?? []) add(a, p.s)
  return {
    resolve(target) {
      const t = target.split(/[#|]/)[0]
      return byKey.get(norm(t)) ?? byKey.get(norm(decodeURIComponent(t.split("/").pop() ?? t))) ?? null
    },
    search(query, limit = 8) {
      const q = norm(query)
      if (!q) return index.pages.slice(0, limit)
      const starts: LinkPage[] = []
      const contains: LinkPage[] = []
      for (const p of index.pages) {
        const names = [p.t, ...(p.a ?? [])].map(norm)
        if (names.some((n) => n.startsWith(q))) starts.push(p)
        else if (names.some((n) => n.includes(q))) contains.push(p)
        if (starts.length >= limit) break
      }
      return [...starts, ...contains].slice(0, limit)
    },
  }
}

let loading: Promise<LinkResolver | null> | null = null

/** 下載索引（只下載一次）；失敗時回傳 null，筆記照常顯示，只是 [[條目]] 不會變成連結。 */
export function loadResolver(): Promise<LinkResolver | null> {
  if (!loading) loading = loadLinkIndex().then((index) => (index ? createResolver(index) : null))
  return loading
}
