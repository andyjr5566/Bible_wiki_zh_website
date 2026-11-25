import fs from "node:fs"
import { BIBLE_BOOKS, type BibleBook } from "./bibleBooks"
import { chapterSlug } from "./bookCatalog"

/**
 * 經文搜尋的小型提示資料（手動維護的詞表與單節釘選），建置時依「已發布的章節」裁剪後
 * 輸出成 static/verseSearchHints.json。資料來源：
 *   quartz/data/verse-search-related.json  詞 → 本站和合本（1919）寫法
 *   quartz/data/verse-search-pins.json     搜尋詞 + 經節 + 該節的和合本用字
 */

export type RawRelatedTable = Record<string, readonly string[]>

export interface RawPinEntry {
  query: string
  ref: string
  cuv: string
}

export interface ShippedPin {
  query: string
  /** 與經文索引相同的節編號：`<章 slug>#v<節>`。 */
  id: string
  cuv: string
}

export interface VerseSearchHints {
  version: 1
  related: Record<string, string[]>
  pins: ShippedPin[]
}

/** 只需要經文索引的這幾個欄位，方便測試。 */
export interface HintsChapter {
  slug: string
  start: number
  verses: readonly string[]
}

type Warn = (message: string) => void

function loadJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")) as T
}

export function loadVerseSearchHintsSource(): { related: unknown; pins: unknown } {
  return {
    related: loadJson("verse-search-related.json"),
    pins: loadJson("verse-search-pins.json"),
  }
}

/** 書名可寫全名或單字縮寫（創、申…），其後接「章:節」。 */
export function parsePinRef(
  ref: string,
): { book: BibleBook; chapter: number; verse: number } | null {
  const match = /^\s*(.+?)\s*(\d+)\s*[:：]\s*(\d+)\s*$/u.exec(ref.normalize("NFKC"))
  if (!match) return null
  const name = match[1]!
  const book = BIBLE_BOOKS.find((entry) => entry.name === name || entry.short === name)
  if (!book) return null
  const chapter = Number(match[2])
  const verse = Number(match[3])
  if (chapter < 1 || verse < 1) return null
  return { book, chapter, verse }
}

export function buildRelatedHints(
  raw: unknown,
  verseTexts: readonly string[],
  warn: Warn = console.warn,
): Record<string, string[]> {
  const related: Record<string, string[]> = {}
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    warn("[verse-search-hints] 相關詞表格式不對（需為物件），已略過")
    return related
  }
  const hasHit = new Map<string, boolean>()
  const published = (word: string) => {
    let known = hasHit.get(word)
    if (known === undefined) {
      // 與前端的相容比對不同：這裡只做字面 includes；前端另有字形折疊，寬鬆一些。
      known = verseTexts.some((text) => text.includes(word))
      hasHit.set(word, known)
    }
    return known
  }

  for (const [key, targets] of Object.entries(raw as Record<string, unknown>)) {
    if (!key.trim() || !Array.isArray(targets)) {
      warn(`[verse-search-hints] 相關詞「${key}」的內容不是詞語清單，已略過`)
      continue
    }
    const kept = [
      ...new Set(
        targets.filter(
          (target): target is string =>
            typeof target === "string" && target.trim() !== "" && target !== key,
        ),
      ),
    ].filter(published)
    if (kept.length > 0) related[key] = kept
  }
  return related
}

export function buildPinHints(
  raw: unknown,
  chapters: readonly HintsChapter[],
  warn: Warn = console.warn,
): ShippedPin[] {
  if (!Array.isArray(raw)) {
    warn("[verse-search-hints] 單節釘選表格式不對（需為陣列），已略過")
    return []
  }
  const bySlug = new Map(chapters.map((chapter) => [chapter.slug, chapter]))
  const pins: ShippedPin[] = []

  for (const entry of raw as unknown[]) {
    const { query, ref, cuv } = (entry ?? {}) as Partial<RawPinEntry>
    const label = `${String(query)} | ${String(ref)} | ${String(cuv)}`
    if (
      typeof query !== "string" ||
      typeof ref !== "string" ||
      typeof cuv !== "string" ||
      !query.trim() ||
      !cuv.trim()
    ) {
      warn(`[verse-search-hints] 釘選項目欄位不完整，已略過：${label}`)
      continue
    }
    const parsed = parsePinRef(ref)
    if (!parsed) {
      warn(`[verse-search-hints] 釘選項目的經節無法解析，已略過：${label}`)
      continue
    }
    const chapter = bySlug.get(chapterSlug(parsed.book, parsed.chapter))
    if (!chapter) continue // 章節尚未發布：可以先備好，發布後自動生效
    const text = chapter.verses[parsed.verse - chapter.start]
    if (text === undefined || parsed.verse < chapter.start) {
      warn(`[verse-search-hints] 釘選的經節不存在，已略過：${label}`)
      continue
    }
    if (!text.includes(cuv.trim())) {
      warn(`[verse-search-hints] 釘選的經節裡找不到「${cuv.trim()}」，已略過：${label}`)
      continue
    }
    pins.push({
      query: query.trim(),
      id: `${chapter.slug}#v${parsed.verse}`,
      cuv: cuv.trim(),
    })
  }
  return pins
}

export function buildVerseSearchHints(
  chapters: readonly HintsChapter[],
  rawRelated: unknown,
  rawPins: unknown,
  warn: Warn = console.warn,
): VerseSearchHints {
  const verseTexts = chapters.flatMap((chapter) => chapter.verses)
  return {
    version: 1,
    related: buildRelatedHints(rawRelated, verseTexts, warn),
    pins: buildPinHints(rawPins, chapters, warn),
  }
}
