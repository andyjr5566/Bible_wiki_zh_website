// 建置時把「哪些書卷有哪些章」嵌進首頁元件，瀏覽器端還原成 CatalogEntry 後交給 pickResume。
// 資料只放章號（整個站約兩百多個數字），所以不用另外下載目錄。
import { BIBLE_BOOKS } from "../../../../quartz/util/bibleBooks"
import type { CatalogEntry } from "../../../../quartz/util/bookCatalog"

/** [書卷序號, 章號清單, 有全書目錄(0/1), 有書卷導論(0/1)]；沒有任何頁面的書卷不放。 */
export type CompactCatalog = Array<[number, number[], 0 | 1, 0 | 1]>

export function compactCatalog(catalog: readonly CatalogEntry[]): CompactCatalog {
  return catalog
    .filter((entry) => entry.status !== "empty")
    .map((entry) => [entry.book.num, entry.chapters, entry.hasToc ? 1 : 0, entry.hasIntro ? 1 : 0])
}

/** 資料來自 HTML 屬性，壞掉時整份當成空的（首頁照常顯示、只是沒有繼續閱讀卡）。 */
export function expandCatalog(raw: string | null | undefined): CatalogEntry[] {
  let value: unknown
  try {
    value = JSON.parse(raw ?? "")
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []

  const entries: CatalogEntry[] = []
  for (const row of value) {
    if (!Array.isArray(row) || typeof row[0] !== "number" || !Array.isArray(row[1])) continue
    const book = BIBLE_BOOKS.find((candidate) => candidate.num === row[0])
    if (!book) continue
    const chapters = row[1].filter((n): n is number => Number.isInteger(n))
    const hasToc = row[2] === 1
    const hasIntro = row[3] === 1
    const status: CatalogEntry["status"] =
      chapters.length > 0 ? "ready" : hasToc || hasIntro ? "outline" : "empty"
    entries.push({ book, status, chapters, hasToc, hasIntro })
  }
  return entries
}
