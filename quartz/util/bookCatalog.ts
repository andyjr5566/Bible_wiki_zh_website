// 從建置時的頁面清單判斷每卷「有哪些章、有沒有全書目錄／導論」。內容還在建置、章號可能缺號，
// 所以一律看實際存在的頁面，不從資料夾或章數推測。
import { BIBLE_BOOKS, BibleBook, bookByFolderSlug, canonicalSlugPath, folderSlug } from "./bibleBooks"

export type BookPageKind = "chapter" | "toc" | "intro"

export interface ParsedBookSlug {
  book: BibleBook
  kind: BookPageKind
  chapter?: number
}

export interface CatalogEntry {
  book: BibleBook
  status: "ready" | "outline" | "empty"
  chapters: number[]
  hasToc: boolean
  hasIntro: boolean
}

export interface ChapterNeighbors {
  previous?: number
  next?: number
}

function normalizedParts(slug: string): string[] {
  return canonicalSlugPath(slug).split("/")
}

export function parseBookSlug(slug: string): ParsedBookSlug | null {
  const parts = normalizedParts(slug)
  if (parts.length !== 2) return null
  const [folder, page] = parts
  const book = bookByFolderSlug(folder)
  if (!book) return null

  const chapterMatch = /^第(\d+)章$/.exec(page)
  if (chapterMatch) {
    const chapter = Number(chapterMatch[1])
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null
    return { book, kind: "chapter", chapter }
  }
  if (page === "全書目錄及綱要") return { book, kind: "toc" }
  if (page === "書卷導論") return { book, kind: "intro" }
  return null
}

export function buildCatalog(slugs: Iterable<string>): CatalogEntry[] {
  const chapters = new Map<number, Set<number>>()
  const toc = new Set<number>()
  const intro = new Set<number>()

  for (const slug of slugs) {
    const parsed = parseBookSlug(slug)
    if (!parsed) continue
    if (parsed.kind === "chapter" && parsed.chapter !== undefined) {
      const known = chapters.get(parsed.book.num) ?? new Set<number>()
      known.add(parsed.chapter)
      chapters.set(parsed.book.num, known)
    } else if (parsed.kind === "toc") {
      toc.add(parsed.book.num)
    } else {
      intro.add(parsed.book.num)
    }
  }

  return BIBLE_BOOKS.map((book) => {
    const foundChapters = [...(chapters.get(book.num) ?? [])].sort((a, b) => a - b)
    const hasToc = toc.has(book.num)
    const hasIntro = intro.has(book.num)
    const status: CatalogEntry["status"] =
      foundChapters.length > 0 ? "ready" : hasToc || hasIntro ? "outline" : "empty"
    return { book, status, chapters: foundChapters, hasToc, hasIntro }
  })
}

export function chapterSlug(book: BibleBook, n: number): string {
  return folderSlug(book) + "/第" + n + "章"
}

export function tocSlug(book: BibleBook): string {
  return folderSlug(book) + "/全書目錄及綱要"
}

export function introSlug(book: BibleBook): string {
  return folderSlug(book) + "/書卷導論"
}

export function neighbors(entry: CatalogEntry, n: number): ChapterNeighbors {
  let previous: number | undefined
  let next: number | undefined
  for (const chapter of entry.chapters) {
    if (chapter < n && (previous === undefined || chapter > previous)) previous = chapter
    if (chapter > n && (next === undefined || chapter < next)) next = chapter
  }
  return {
    ...(previous === undefined ? {} : { previous }),
    ...(next === undefined ? {} : { next }),
  }
}

