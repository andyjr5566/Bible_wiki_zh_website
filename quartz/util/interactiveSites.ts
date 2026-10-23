// 互動網站探索中心的描述資料純函式：來源是網站 index.html、附錄章節檔與人工補充設定。
// 書卷名稱、簡稱、章數與順序一律取自 bibleBooks.ts，讓涵蓋章節能和站內書卷資料保持一致。
import { BIBLE_BOOKS } from "./bibleBooks"
import type { BibleBook } from "./bibleBooks"

export interface ChapterRef {
  book: number
  chapter: number
}

export type SiteScope = "narrow" | "wide"

export interface SiteOverride {
  type?: string
  extraChapters?: string[]
  deepLink?: string
  deepLabel?: string
  cover?: unknown
}

export interface SiteFiles {
  key: string
  indexHtml: string | null
  appendixChapters: unknown | undefined
  hasDist: boolean
  hasCover: boolean
}

export interface InteractiveSite {
  key: string
  title: string
  description: string
  type?: string
  scope: SiteScope
  primary?: ChapterRef
  chapters: ChapterRef[]
  entryPath: string
  coverPath: string
  hasCover: boolean
  hasDist: boolean
  deepLink?: string
  deepLabel?: string
}

export interface InteractiveRegistry {
  sites: InteractiveSite[]
  warnings: string[]
}

interface ChapterExpression {
  book: BibleBook
  start: number
  end: number
}

interface ChapterExpressionError {
  error: string
}

function decodeHtmlEntities(value: string): string {
  return value.replace(
    /&(#x[\da-f]+|#\d+|amp|quot|apos|#39|lt|gt);/gi,
    (entity, token: string) => {
      const normalized = token.toLowerCase()
      if (normalized === "amp") return "&"
      if (normalized === "quot") return "\""
      if (normalized === "apos" || normalized === "#39") return "'"
      if (normalized === "lt") return "<"
      if (normalized === "gt") return ">"

      const codePoint =
        normalized.startsWith("#x")
          ? Number.parseInt(normalized.slice(2), 16)
          : Number.parseInt(normalized.slice(1), 10)
      try {
        return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
          ? String.fromCodePoint(codePoint)
          : entity
      } catch {
        return entity
      }
    },
  )
}

function normalizeHtmlText(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim()
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {}
  const attributePattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g
  let match: RegExpExecArray | null

  while ((match = attributePattern.exec(tag)) !== null) {
    const name = match[1].toLowerCase()
    if (name === "meta") continue
    attributes[name] = match[2] ?? match[3] ?? match[4] ?? ""
  }

  return attributes
}

export function extractTitle(html: string): string | null {
  const match = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(html)
  if (!match) return null

  const title = normalizeHtmlText(match[1]).split(/[｜|]/, 1)[0].trim()
  return title || null
}

export function extractDescription(html: string): string | null {
  const metaTags = html.match(/<meta\b[^>]*>/gi) ?? []
  for (const tag of metaTags) {
    const attributes = parseAttributes(tag)
    if (attributes.name?.trim().toLowerCase() !== "description") continue
    const description = normalizeHtmlText(attributes.content ?? "")
    return description || null
  }
  return null
}

export function bookByName(name: string): BibleBook | undefined {
  return BIBLE_BOOKS.find((book) => book.name === name)
}

function parseChapterExpression(
  value: string,
  contextBook?: BibleBook,
): ChapterExpression | ChapterExpressionError {
  const parts = value.trim().split("/")
  let book: BibleBook | undefined
  let chapterText: string

  if (parts.length === 1) {
    book = contextBook
    chapterText = parts[0].trim()
    if (!book) return { error: `章節「${value}」沒有可用的所屬書卷` }
  } else if (parts.length === 2) {
    book = bookByName(parts[0].trim())
    chapterText = parts[1].trim()
    if (!book) return { error: `找不到章節「${value}」的書卷` }
  } else {
    return { error: `無法辨識章節「${value}」` }
  }

  const match = /^第(\d+)(?:[-–](\d+))?章$/.exec(chapterText)
  if (!match) return { error: `無法辨識章節「${value}」` }

  const start = Number(match[1])
  const end = Number(match[2] ?? match[1])
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end) {
    return { error: `無法辨識章節「${value}」` }
  }

  return { book, start, end }
}

function refsFromExpression(expression: ChapterExpression): ChapterRef[] {
  const first = Math.max(1, expression.start)
  const last = Math.min(expression.book.chapters, expression.end)
  const refs: ChapterRef[] = []

  for (let chapter = first; chapter <= last; chapter += 1) {
    refs.push({ book: expression.book.num, chapter })
  }
  return refs
}

export function parseChapterRefs(value: string, contextBook?: BibleBook): ChapterRef[] {
  const expression = parseChapterExpression(value, contextBook)
  if ("error" in expression) return []
  return refsFromExpression(expression)
}

export function parseAppendixChapters(
  data: unknown,
): { refs: string[]; tocOnly: boolean; warnings: string[] } {
  if (data === undefined) return { refs: [], tocOnly: false, warnings: [] }

  let values: unknown[]
  let tocOnly = false
  const warnings: string[] = []

  if (Array.isArray(data)) {
    values = data
  } else if (data !== null && typeof data === "object") {
    const record = data as Record<string, unknown>
    tocOnly = record.toc_only === true
    if (!Array.isArray(record.chapters)) {
      return {
        refs: [],
        tocOnly,
        warnings: ["附錄章節物件的 chapters 欄位不是陣列"],
      }
    }
    values = record.chapters
  } else {
    return { refs: [], tocOnly: false, warnings: ["附錄章節資料不是陣列或物件"] }
  }

  const refs: string[] = []
  values.forEach((value, index) => {
    if (typeof value === "string" && value.trim()) {
      refs.push(value.trim())
    } else {
      warnings.push(`附錄章節第 ${index + 1} 項不是有效的文字`)
    }
  })

  return { refs, tocOnly, warnings }
}

export function coverFileName(key: string): string {
  return `${key.replace(/\//g, "-")}.webp`
}

function fallbackTitle(key: string): string {
  return key.split("/").at(-1) ?? key
}

function addResolvedRef(
  value: string,
  contextBook: BibleBook | undefined,
  key: string,
  source: string,
  refs: Map<string, ChapterRef>,
  warnings: string[],
): void {
  const expression = parseChapterExpression(value, contextBook)
  if ("error" in expression) {
    warnings.push(`網站「${key}」的${source}：${expression.error}。`)
    return
  }

  if (expression.start < 1 || expression.end > expression.book.chapters) {
    warnings.push(
      `網站「${key}」的${source}章號超出${expression.book.name}的章數，已略過超出範圍的章節。`,
    )
  }

  for (const ref of refsFromExpression(expression)) {
    refs.set(`${ref.book}:${ref.chapter}`, ref)
  }
}

export function deriveSite(
  files: SiteFiles,
  override?: SiteOverride,
): { site: InteractiveSite; warnings: string[] } {
  const warnings: string[] = []
  const keyParts = files.key.split("/")
  const folder = keyParts[0] ?? files.key
  const name = fallbackTitle(files.key)
  const contextBook = bookByName(folder)
  const title = files.indexHtml === null ? null : extractTitle(files.indexHtml)
  const description = files.indexHtml === null ? "" : (extractDescription(files.indexHtml) ?? "")

  if (!title) {
    warnings.push(`網站「${files.key}」沒有 <title>，使用網站資料夾名稱「${name}」。`)
  }

  const appendix = parseAppendixChapters(files.appendixChapters)
  for (const warning of appendix.warnings) {
    warnings.push(`網站「${files.key}」：${warning}。`)
  }

  const refs = new Map<string, ChapterRef>()
  let primary: ChapterRef | undefined
  const pageMatch = contextBook ? /^第(\d+)章$/.exec(name) : null
  if (pageMatch) {
    const primaryRefs: ChapterRef[] = []
    addResolvedRef(
      `${folder}/${name}`,
      undefined,
      files.key,
      "主章",
      new Map(
        primaryRefs.map((ref) => [`${ref.book}:${ref.chapter}`, ref] as const),
      ),
      warnings,
    )
    const expression = parseChapterExpression(`${folder}/${name}`)
    if ("error" in expression) {
      warnings.push(`網站「${files.key}」的主章：${expression.error}。`)
    } else {
      if (expression.start < 1 || expression.end > expression.book.chapters) {
        warnings.push(
          `網站「${files.key}」的主章號超出${expression.book.name}的章數，已略過主章。`,
        )
      } else {
        primary = { book: expression.book.num, chapter: expression.start }
        refs.set(`${primary.book}:${primary.chapter}`, primary)
      }
    }
  }

  for (const ref of appendix.refs) {
    addResolvedRef(ref, contextBook, files.key, "附錄章節", refs, warnings)
  }

  if (override?.extraChapters !== undefined) {
    const extras = parseAppendixChapters(override.extraChapters)
    for (const warning of extras.warnings) {
      warnings.push(`網站「${files.key}」：補充章節${warning}。`)
    }
    for (const ref of extras.refs) {
      addResolvedRef(ref, contextBook, files.key, "補充章節", refs, warnings)
    }
  }

  const chapters = [...refs.values()].sort(
    (a, b) => a.book - b.book || a.chapter - b.chapter,
  )
  const scope: SiteScope = appendix.tocOnly || !contextBook ? "wide" : "narrow"

  const site: InteractiveSite = {
    key: files.key,
    title: title ?? name,
    description,
    ...(typeof override?.type === "string" ? { type: override.type } : {}),
    scope,
    ...(primary ? { primary } : {}),
    chapters,
    entryPath: `static/website/${files.key}/dist/index.html`,
    coverPath: `static/interactive-covers/${coverFileName(files.key)}`,
    hasCover: files.hasCover,
    hasDist: files.hasDist,
    ...(typeof override?.deepLink === "string" ? { deepLink: override.deepLink } : {}),
    ...(typeof override?.deepLabel === "string" ? { deepLabel: override.deepLabel } : {}),
  }

  return { site, warnings }
}

export function buildRegistry(
  files: SiteFiles[],
  overrides: Record<string, SiteOverride>,
): InteractiveRegistry {
  const warnings: string[] = []
  const foundKeys = new Set(files.map((file) => file.key))
  const sites = files.map((file) => {
    const { site, warnings: siteWarnings } = deriveSite(file, overrides[file.key])
    warnings.push(...siteWarnings)
    return site
  })

  for (const key of Object.keys(overrides)) {
    if (!foundKeys.has(key)) warnings.push(`補充設定有網站「${key}」，但找不到對應的網站資料夾。`)
  }

  // key 排序讓同一份資料在不同檔案系統的掃描順序下仍有穩定輸出。
  sites.sort((a, b) => a.key.localeCompare(b.key, "zh-Hant"))
  return { sites, warnings }
}

function compareTitleAndKey(a: InteractiveSite, b: InteractiveSite): number {
  return a.title.localeCompare(b.title, "zh-Hant") || a.key.localeCompare(b.key, "zh-Hant")
}

function compareRef(a: ChapterRef, b: ChapterRef): number {
  return a.book - b.book || a.chapter - b.chapter
}

export function sitesForChapter(
  sites: readonly InteractiveSite[],
  ref: ChapterRef,
): InteractiveSite[] {
  return sites
    .filter((site) => site.chapters.some((chapter) => chapter.book === ref.book && chapter.chapter === ref.chapter))
    .sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "narrow" ? -1 : 1

      if (a.scope === "narrow") {
        const aPrimary = a.primary?.book === ref.book && a.primary.chapter === ref.chapter
        const bPrimary = b.primary?.book === ref.book && b.primary.chapter === ref.chapter
        if (aPrimary !== bPrimary) return aPrimary ? -1 : 1
      }

      return a.chapters.length - b.chapters.length || compareTitleAndKey(a, b)
    })
}

export function coverageByBook(site: InteractiveSite): { book: BibleBook; count: number }[] {
  const counts = new Map<number, number>()
  for (const ref of site.chapters) {
    counts.set(ref.book, (counts.get(ref.book) ?? 0) + 1)
  }

  return BIBLE_BOOKS.flatMap((book) => {
    const count = counts.get(book.num) ?? 0
    return count ? [{ book, count }] : []
  })
}

export function chaptersInBook(site: InteractiveSite, book: number): number[] {
  return [...new Set(site.chapters.filter((ref) => ref.book === book).map((ref) => ref.chapter))].sort(
    (a, b) => a - b,
  )
}

export function formatRanges(chapters: readonly number[]): string {
  const sorted = [...new Set(chapters.filter((chapter) => Number.isInteger(chapter) && chapter > 0))].sort(
    (a, b) => a - b,
  )
  if (!sorted.length) return ""

  const ranges: string[] = []
  let start = sorted[0]
  let end = sorted[0]

  for (const chapter of sorted.slice(1)) {
    if (chapter === end + 1) {
      end = chapter
      continue
    }
    ranges.push(start === end ? `${start}` : `${start}–${end}`)
    start = chapter
    end = chapter
  }

  ranges.push(start === end ? `${start}` : `${start}–${end}`)
  return ranges.join("、")
}

function firstChapter(site: InteractiveSite): ChapterRef | undefined {
  return [...site.chapters].sort(compareRef)[0]
}

export function wideSites(sites: readonly InteractiveSite[]): InteractiveSite[] {
  return sites
    .filter((site) => site.scope === "wide")
    .sort((a, b) => {
      const firstA = firstChapter(a)
      const firstB = firstChapter(b)
      if (firstA && firstB) {
        const order = compareRef(firstA, firstB)
        if (order) return order
      } else if (firstA) {
        return -1
      } else if (firstB) {
        return 1
      }
      return compareTitleAndKey(a, b)
    })
}

export function axisGroups(
  sites: readonly InteractiveSite[],
): { book: BibleBook; items: { site: InteractiveSite; chapters: number[] }[] }[] {
  const narrowSites = sites.filter((site) => site.scope === "narrow")

  return BIBLE_BOOKS.flatMap((book) => {
    const items = narrowSites
      .map((site) => ({ site, chapters: chaptersInBook(site, book.num) }))
      .filter((item) => item.chapters.length > 0)
      .sort(
        (a, b) =>
          a.chapters[0] - b.chapters[0] || compareTitleAndKey(a.site, b.site),
      )
    return items.length ? [{ book, items }] : []
  })
}

export function deepLinkFor(
  site: InteractiveSite,
  ref: ChapterRef,
): { hash: string; label: string } | null {
  if (!site.deepLink || !site.deepLabel) return null
  const book = BIBLE_BOOKS.find((candidate) => candidate.num === ref.book)
  if (!book) return null

  const replaceTokens = (template: string): string =>
    template.replace(/\{(short|chapter|book)\}/g, (_match, token: string) => {
      if (token === "short") return book.short
      if (token === "chapter") return String(ref.chapter)
      return book.name
    })

  return { hash: replaceTokens(site.deepLink), label: replaceTokens(site.deepLabel) }
}

export function checkRegistry(registry: InteractiveRegistry): string[] {
  const warnings = [...registry.warnings]
  const add = (message: string): void => {
    if (!warnings.includes(message)) warnings.push(message)
  }

  for (const site of registry.sites) {
    if (!site.hasDist) add(`網站「${site.key}」缺少 dist/index.html。`)
    if (!site.description.trim()) add(`網站「${site.key}」沒有 description。`)
    if (!site.hasCover) add(`網站「${site.key}」沒有封面。`)
    if (!site.type) add(`網站「${site.key}」沒有 type 類型標籤。`)
    if (site.title === fallbackTitle(site.key)) {
      add(`網站「${site.key}」沒有 <title>，使用網站資料夾名稱「${site.title}」。`)
    }
  }

  return warnings
}
