import { BibleBook } from "./bibleBooks"
import { parseBookSlug } from "./bookCatalog"

export type ReturnPoint =
  | { v: 1; slug: string; kind: "verse"; verse: number; t: number }
  | { v: 1; slug: string; kind: "study"; headingId: string; t: number }

// 寫入與讀取必須共用同一個鍵，避免返回點留在不同的儲存項目裡。
export const RETURN_POINT_KEY = "bwz-return-point"

function isChapterSlug(slug: unknown): slug is string {
  return typeof slug === "string" && parseBookSlug(slug)?.kind === "chapter"
}

function isTimestamp(t: unknown): t is number {
  return typeof t === "number" && Number.isFinite(t)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function makeVersePoint(slug: string, verse: number, t: number): ReturnPoint | null {
  if (!isChapterSlug(slug) || !Number.isInteger(verse) || verse < 1 || verse > 200 || !isTimestamp(t)) {
    return null
  }
  return { v: 1, slug, kind: "verse", verse, t }
}

export function makeStudyPoint(slug: string, headingId: string, t: number): ReturnPoint | null {
  if (!isChapterSlug(slug) || typeof headingId !== "string" || headingId.trim().length === 0 || !isTimestamp(t)) {
    return null
  }
  return { v: 1, slug, kind: "study", headingId, t }
}

/** sessionStorage 的資料可能來自舊版或手動修改；不合格式的返回點直接丟棄。 */
export function parseReturnPoint(raw: string | null | undefined): ReturnPoint | null {
  if (raw == null) return null

  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isObject(value) || value.v !== 1 || !isChapterSlug(value.slug) || !isTimestamp(value.t)) return null

  if (value.kind === "verse") {
    if (
      typeof value.verse !== "number" ||
      !Number.isInteger(value.verse) ||
      value.verse < 1 ||
      value.verse > 200
    ) {
      return null
    }
    return { v: 1, slug: value.slug, kind: "verse", verse: value.verse, t: value.t }
  }

  if (value.kind === "study" && typeof value.headingId === "string" && value.headingId.trim().length > 0) {
    return { v: 1, slug: value.slug, kind: "study", headingId: value.headingId, t: value.t }
  }
  return null
}

export function serializeReturnPoint(point: ReturnPoint): string {
  return JSON.stringify(point)
}

function chapterDetails(point: ReturnPoint): { book: BibleBook; chapter: number } | null {
  const parsed = parseBookSlug(point.slug)
  if (!parsed || parsed.kind !== "chapter" || parsed.chapter === undefined) return null
  return { book: parsed.book, chapter: parsed.chapter }
}

export function returnLabel(point: ReturnPoint): string {
  const details = chapterDetails(point)
  if (!details) return ""
  if (point.kind === "verse") {
    return "↩ 回 " + details.book.name + " " + details.chapter + ":" + point.verse
  }
  return "↩ 回 " + details.book.name + " " + details.chapter + " 章整理"
}

export function returnAriaLabel(point: ReturnPoint): string {
  const details = chapterDetails(point)
  if (!details) return ""
  if (point.kind === "verse") {
    return "回到" + details.book.name + "第 " + details.chapter + " 章第 " + point.verse + " 節"
  }
  return "回到" + details.book.name + "第 " + details.chapter + " 章的本章整理"
}

export function shouldClearOnPage(_point: ReturnPoint | null | undefined, currentSlug: string): boolean {
  return parseBookSlug(currentSlug)?.kind === "chapter"
}

export function returnHref(point: ReturnPoint, basePrefix: string): string {
  return basePrefix + "/" + encodeURI(point.slug)
}
