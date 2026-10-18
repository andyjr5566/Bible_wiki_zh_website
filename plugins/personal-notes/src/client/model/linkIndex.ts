// 精簡連結索引的格式與建立方式：建置時由 src/index.ts 的 emitter 輸出到 static/personal-notes/links.json，給筆記的 [[條目]] 連結與自動完成用（12 C6）。
// 網站完整的 contentIndex.json 約 19.7 MB（含全文），太大；這裡只放「網址、標題、別名」。

export interface LinkPage {
  /** slug（不含 basepath，例如 link_folder/人物/寧錄） */
  s: string
  /** 顯示名稱 */
  t: string
  /** 其他可用來連結的名稱（別名、檔名），不含與 t 相同者 */
  a?: string[]
}

export interface LinkIndex {
  v: 1
  pages: LinkPage[]
}

export interface PageInfo {
  slug: string
  title?: unknown
  aliases?: unknown
}

const asStrings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : typeof v === "string" ? [v] : []

/** 從各頁的 slug、標題、別名建立索引；略過首頁、標籤頁、資料夾頁等不適合當連結目標的頁面。 */
export function buildLinkIndex(pages: PageInfo[]): LinkIndex {
  const out: LinkPage[] = []
  const seen = new Set<string>()
  for (const p of pages) {
    const slug = p.slug
    if (!slug || slug === "index" || slug.startsWith("tags/") || slug.endsWith("/index") || seen.has(slug)) continue
    seen.add(slug)
    const file = decodeURIComponent(slug.split("/").pop() ?? slug).replace(/-/g, " ")
    const title = (typeof p.title === "string" && p.title.trim()) || file
    const others = [...new Set([file, ...asStrings(p.aliases)].map((x) => x.trim()).filter((x) => x && x !== title))]
    out.push(others.length ? { s: slug, t: title, a: others } : { s: slug, t: title })
  }
  return { v: 1, pages: out }
}
