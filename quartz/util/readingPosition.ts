// 「繼續閱讀」的規則（U-22：每卷一筆、記章與捲動比例、只算章節頁、只存本機）。
// 這裡只有純函式；讀寫 localStorage、監聽捲動放在外掛的薄外層。
import { BibleBook, bookByFolderSlug, folderSlug } from "./bibleBooks"
import { CatalogEntry, parseBookSlug, tocSlug } from "./bookCatalog"

// localStorage 的鍵：寫入（home-hub）和讀取（book-picker 的預設分頁）共用這一個名稱。
export const READING_STORAGE_KEY = "bwz-reading"

export interface ReadingRecord {
  slug: string
  ratio: number
  t: number
}

export interface ReadingState {
  v: 1
  books: Record<string, ReadingRecord>
}

export const EMPTY_READING: ReadingState = { v: 1, books: {} }

export interface ReadingUpdate {
  slug: string
  ratio: number
  t: number
}

export interface RecentReading extends ReadingRecord {
  book: BibleBook
  chapter: number
}

export interface ResumeReading {
  book: BibleBook
  slug: string
  chapter?: number
  ratio: number
  t: number
  kind: "chapter" | "toc"
}

export interface SaveCheck {
  prevRatio: number | undefined
  ratio: number
  now: number
  lastSavedAt: number
}

// 捲動時不必每一格都寫入：至少隔 1 秒、而且位置變動超過 2% 才存，手機上才不會一直寫 localStorage。
export const READING_SAVE_INTERVAL_MS = 1000
export const READING_SAVE_RATIO_THRESHOLD = 0.02

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function clampRatio(ratio: number): number {
  if (Number.isNaN(ratio)) return 0
  return Math.min(1, Math.max(0, ratio))
}

function asLimit(limit: number): number {
  if (limit === Number.POSITIVE_INFINITY) return limit
  if (!Number.isFinite(limit)) return 0
  return Math.max(0, Math.floor(limit))
}

/** 資料來自使用者的瀏覽器，可能被別的版本或手動改壞；壞掉的那一筆跳過，其他照用。 */
export function parseReading(raw: string | null | undefined): ReadingState {
  if (raw == null) return EMPTY_READING

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return EMPTY_READING
  }
  if (!isObject(value) || value.v !== 1 || !isObject(value.books)) return EMPTY_READING

  const books: Record<string, ReadingRecord> = {}
  for (const [key, candidate] of Object.entries(value.books)) {
    if (!isObject(candidate)) continue
    const { slug, ratio, t } = candidate
    if (
      typeof slug !== "string" ||
      typeof ratio !== "number" ||
      !Number.isFinite(ratio) ||
      typeof t !== "number" ||
      !Number.isFinite(t)
    ) {
      continue
    }
    books[key] = { slug, ratio: clampRatio(ratio), t }
  }
  return { v: 1, books }
}

export function serializeReading(state: ReadingState): string {
  return JSON.stringify(state)
}

export function recordReading(state: ReadingState, reading: ReadingUpdate): ReadingState {
  const parsed = parseBookSlug(reading.slug)
  if (!parsed || parsed.kind !== "chapter") return state

  const key = folderSlug(parsed.book)
  return {
    v: 1,
    books: {
      ...state.books,
      [key]: { slug: reading.slug, ratio: clampRatio(reading.ratio), t: reading.t },
    },
  }
}

export function recentReadings(state: ReadingState, limit: number): RecentReading[] {
  const readings: RecentReading[] = []
  for (const [key, reading] of Object.entries(state.books)) {
    const book = bookByFolderSlug(key)
    const parsed = parseBookSlug(reading.slug)
    if (!book || !parsed || parsed.kind !== "chapter" || parsed.book.num !== book.num) continue
    readings.push({ ...reading, book, chapter: parsed.chapter! })
  }
  return readings.sort((a, b) => b.t - a.t).slice(0, asLimit(limit))
}

/** 內容會改版：章被刪了就退回該卷全書目錄，整卷都沒有頁面了就不顯示。 */
export function pickResume(
  state: ReadingState,
  catalog: readonly CatalogEntry[],
  limit: number,
): ResumeReading[] {
  const entries = new Map(catalog.map((entry) => [entry.book.num, entry]))
  const resumes: ResumeReading[] = []

  for (const reading of recentReadings(state, Number.POSITIVE_INFINITY)) {
    const entry = entries.get(reading.book.num)
    if (!entry || entry.status === "empty") continue

    if (entry.chapters.includes(reading.chapter)) {
      resumes.push({
        book: reading.book,
        slug: reading.slug,
        chapter: reading.chapter,
        ratio: reading.ratio,
        t: reading.t,
        kind: "chapter",
      })
    } else {
      resumes.push({
        book: reading.book,
        slug: tocSlug(reading.book),
        ratio: 0,
        t: reading.t,
        kind: "toc",
      })
    }
  }

  return resumes.slice(0, asLimit(limit))
}

export function ratioFromScroll(scrollY: number, scrollHeight: number, viewportHeight: number): number {
  const range = Math.max(0, scrollHeight - viewportHeight)
  if (!Number.isFinite(range) || range === 0) return 0
  return clampRatio(scrollY / range)
}

// 記錄與還原用同一個公式（以整頁可捲範圍為基準），所以不用另外扣掉黏頂工具列的高度。
export function scrollFromRatio(ratio: number, scrollHeight: number, viewportHeight: number): number {
  const range = Math.max(0, scrollHeight - viewportHeight)
  if (!Number.isFinite(range) || range === 0) return 0
  return Math.min(range, Math.max(0, clampRatio(ratio) * range))
}

export function shouldSave({ prevRatio, ratio, now, lastSavedAt }: SaveCheck): boolean {
  if (prevRatio === undefined) return true
  return (
    now - lastSavedAt >= READING_SAVE_INTERVAL_MS &&
    Math.abs(ratio - prevRatio) >= READING_SAVE_RATIO_THRESHOLD
  )
}

