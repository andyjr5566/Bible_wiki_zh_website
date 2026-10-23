// 「條目落點」：從章節頁點連結進到條目頁時，在「定義」後顯示本章摘要卡（U-23 後續，2026-10-23）。
// 這裡是純規則：記錄格式、要不要顯示、卡片文字；記錄與畫卡片在 plugins/verse-return（recorder.ts、relatedCard.ts）。
// 記錄只用一次、45 秒過期，所以直接開條目、重新整理、從別的條目跳過來都不會顯示。
import { canonicalSlugPath } from "./bibleBooks"
import { parseBookSlug } from "./bookCatalog"

export interface EntryLanding {
  v: 1
  fromSlug: string
  toSlug: string
  t: number
}

export const ENTRY_LANDING_KEY = "bwz-entry-landing"
export const ENTRY_LANDING_TTL_MS = 45 * 1000

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

function isChapterSlug(value: unknown): value is string {
  return typeof value === "string" && parseBookSlug(value)?.kind === "chapter"
}

function isEntrySlug(value: string): boolean {
  const slug = canonicalSlugPath(value)
  return slug.startsWith("link_folder/") && slug.length > "link_folder/".length
}

export function makeEntryLanding(fromSlug: string, toSlug: string, t: number): EntryLanding | null {
  if (!isChapterSlug(fromSlug) || !isEntrySlug(toSlug) || !isTimestamp(t)) return null
  return { v: 1, fromSlug, toSlug, t }
}

/** sessionStorage 的內容可能是舊版或手動修改；不合格式或過期就丟棄。 */
export function parseEntryLanding(raw: string | null | undefined, now = Date.now()): EntryLanding | null {
  if (raw == null) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.v !== 1 || typeof record.fromSlug !== "string" || typeof record.toSlug !== "string") return null
  if (!isTimestamp(record.t) || !isTimestamp(now)) return null

  const age = now - record.t
  if (age < 0 || age > ENTRY_LANDING_TTL_MS) return null

  return makeEntryLanding(record.fromSlug, record.toSlug, record.t)
}

export function serializeEntryLanding(landing: EntryLanding): string {
  return JSON.stringify(landing)
}

export function shouldShowEntryLanding(landing: EntryLanding | null | undefined, currentSlug: string): boolean {
  if (!landing || !isEntrySlug(currentSlug)) return false
  return canonicalSlugPath(landing.toSlug) === canonicalSlugPath(currentSlug)
}

export function entryLandingLabels(fromSlug: string): { cardTitle: string; ariaLabel: string } | null {
  const parsed = parseBookSlug(fromSlug)
  if (!parsed || parsed.kind !== "chapter" || parsed.chapter === undefined) return null

  return {
    cardTitle: parsed.book.name + " " + parsed.chapter + " 章 · 與本條目",
    ariaLabel: "本條目在" + parsed.book.name + "第 " + parsed.chapter + " 章的重點",
  }
}
