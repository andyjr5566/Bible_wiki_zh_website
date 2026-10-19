// 依精簡連結索引找回搬移或改名後的知識庫條目，供書籤與條目筆記重新定位（D-46、13 §3.3）。
// 僅使用索引資料比對，不依賴瀏覽器環境。

import type { LinkPage } from "./linkIndex"

export interface NodeRef {
  slug: string
  title?: string | null
}

export type Relocation =
  | { kind: "same"; slug: string }
  | { kind: "moved"; slug: string; title: string }
  | { kind: "missing" }

const norm = (value: string): string => value.trim().toLowerCase().replace(/[\s_-]+/g, " ")

const lastSegment = (slug: string): string => {
  const segment = slug.split("/").pop() ?? slug
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

interface PageLookup {
  bySlug: Map<string, LinkPage>
  byName: Map<string, Set<LinkPage>>
}

function buildLookup(pages: LinkPage[]): PageLookup {
  const bySlug = new Map<string, LinkPage>()
  const byName = new Map<string, Set<LinkPage>>()

  const addName = (key: string, page: LinkPage) => {
    if (!key) return
    let matches = byName.get(key)
    if (!matches) {
      matches = new Set<LinkPage>()
      byName.set(key, matches)
    }
    matches.add(page)
  }

  for (const page of pages) {
    bySlug.set(page.s, page)
    if (!page.s.startsWith("link_folder/")) continue

    const titleKey = norm(page.t)
    const fileKey = norm(lastSegment(page.s).replace(/-/g, " "))
    addName(titleKey, page)
    addName(fileKey, page)
    for (const alias of page.a ?? []) addName(norm(alias), page)
  }

  return { bySlug, byName }
}

function relocateWithLookup(ref: NodeRef, lookup: PageLookup): Relocation {
  if (lookup.bySlug.has(ref.slug)) return { kind: "same", slug: ref.slug }

  const oldFileKey = norm(lastSegment(ref.slug).replace(/-/g, " "))
  const oldTitleKey = typeof ref.title === "string" ? norm(ref.title) : ""

  const candidates = new Set<LinkPage>()
  if (oldTitleKey) {
    for (const page of lookup.byName.get(oldTitleKey) ?? []) candidates.add(page)
  }
  for (const page of lookup.byName.get(oldFileKey) ?? []) candidates.add(page)

  if (candidates.size !== 1) return { kind: "missing" }
  const page = candidates.values().next().value as LinkPage
  return { kind: "moved", slug: page.s, title: page.t }
}

export function relocateNode(ref: NodeRef, pages: LinkPage[]): Relocation {
  return relocateWithLookup(ref, buildLookup(pages))
}

export function relocateAll<T extends NodeRef>(refs: T[], pages: LinkPage[]): Map<T, Relocation> {
  const lookup = buildLookup(pages)
  const result = new Map<T, Relocation>()
  for (const ref of refs) result.set(ref, relocateWithLookup(ref, lookup))
  return result
}
