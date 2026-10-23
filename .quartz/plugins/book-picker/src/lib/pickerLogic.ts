// 書卷選擇器的判斷規則（純函式，不碰 DOM、不讀儲存），方便單元測試。
// 書卷資料、章節目錄、閱讀位置規則都在 quartz/util（單一來源），這裡只放「選擇器自己的決定」：
// 左欄用哪一種版面、預設開哪一個約、灰色書卷的提示句、相對連結。
import { BIBLE_BOOKS, BOOK_GROUPS, type BibleBook, type Testament } from "../../../../quartz/util/bibleBooks"
import { chapterSlug, parseBookSlug, tocSlug, introSlug, type CatalogEntry } from "../../../../quartz/util/bookCatalog"

/** 左欄的三種情況（U-22）：書卷相關頁只放本卷、首頁收成一行、其他頁直接展開書卷格子。 */
export type PickerMode = "book" | "home" | "other"

export function pickerMode(slug: string): PickerMode {
  if (parseBookSlug(slug)) return "book"
  if (slug === "index") return "home"
  return "other"
}

/** 目前頁面屬於哪一卷（章節頁、全書目錄、書卷導論都算）；其他頁回傳 undefined。 */
export function currentBookOf(slug: string): BibleBook | undefined {
  return parseBookSlug(slug)?.book
}

export function testamentOf(book: BibleBook): Testament {
  return BOOK_GROUPS.find((group) => group.id === book.group)?.testament ?? "ot"
}

/**
 * 書卷格子預設開哪一個約：目前這卷所屬的約 → 最近讀過那卷所屬的約 → 舊約。
 * 最近讀過的紀錄只存在讀者的瀏覽器，所以由用戶端再套用一次；伺服器端只能先給「目前書卷或舊約」。
 */
export function defaultTestament(current?: BibleBook, recent?: BibleBook): Testament {
  if (current) return testamentOf(current)
  if (recent) return testamentOf(recent)
  return "ot"
}

/**
 * 「開放」的定義只有這一處：有章節，或至少有全書目錄／導論，點了進得去。
 * 完全沒有頁面的書卷才是灰色的（內容還在整理中，每次同步都可能多開幾卷）。
 * 只有全書目錄的書卷也算開放：讀者點了能進全書目錄，比灰掉什麼都看不到有用。
 */
export function isBookOpen(entry: CatalogEntry): boolean {
  return entry.status !== "empty"
}

/** 點下書卷後要去哪一頁：先看全書目錄（裡面有章節清單），沒有才直接進導論或第一章。 */
export function bookLinkSlug(entry: CatalogEntry): string | undefined {
  if (!isBookOpen(entry)) return undefined
  if (entry.hasToc) return tocSlug(entry.book)
  if (entry.chapters.length > 0) return chapterSlug(entry.book, entry.chapters[0])
  return entry.hasIntro ? introSlug(entry.book) : undefined
}

/** 把連續的開放書卷合成「創世記到約書亞記」，不連續就用頓號列出（例：創世記、利未記到民數記）。 */
export function openBooksSummary(catalog: readonly CatalogEntry[]): string {
  const open = catalog.filter(isBookOpen).sort((a, b) => a.book.num - b.book.num)
  const runs: CatalogEntry[][] = []
  for (const entry of open) {
    const last = runs.at(-1)
    if (last && last.at(-1)!.book.num === entry.book.num - 1) last.push(entry)
    else runs.push([entry])
  }
  return runs
    .map((run) => (run.length === 1 ? run[0].book.name : `${run[0].book.name}到${run.at(-1)!.book.name}`))
    .join("、")
}

/** 點到灰色書卷時的提示（使用者確認過的定稿）。沒有任何開放書卷時退回不提「已開放」的說法。 */
export function lockedMessage(bookName: string, summary: string): string {
  return summary
    ? `${bookName}的研讀頁還在整理中，目前已開放${summary}。`
    : `${bookName}的研讀頁還在整理中，會陸續開放。`
}

/** 與 Quartz 的 resolveRelative 相同的結果：從目前頁的資料夾深度往上，再接目標 slug。 */
export function relativeHref(fromSlug: string, toSlug: string): string {
  const depth = fromSlug.split("/").filter(Boolean).length - 1
  const prefix = depth <= 0 ? "." : Array.from({ length: depth }, () => "..").join("/")
  return `${prefix}/${toSlug}`
}

export function findBook(num: number): BibleBook | undefined {
  return BIBLE_BOOKS.find((book) => book.num === num)
}

/**
 * 章號區可以捲動時，要把目前章捲進可視範圍：回傳新的 scrollTop。
 * 已經完全看得到就不動（回傳原值）；否則盡量讓它出現在中間，避免貼著邊緣。
 */
export function scrollTopToReveal(
  currentScrollTop: number,
  viewportHeight: number,
  itemTop: number,
  itemHeight: number,
  contentHeight: number,
): number {
  const itemBottom = itemTop + itemHeight
  if (itemTop >= currentScrollTop && itemBottom <= currentScrollTop + viewportHeight) return currentScrollTop
  const centered = itemTop - (viewportHeight - itemHeight) / 2
  return Math.min(Math.max(0, contentHeight - viewportHeight), Math.max(0, centered))
}

/** 手機版面（沒有左欄、探索收進 ☰ 抽屜）的斷點；和 explorer 外掛、custom.scss 的 800px 一致。 */
export const MOBILE_QUERY = "(max-width: 800px)"

/** 「請打開選擇器」事件：章節快捷列的書名、章末的「換一卷書」發出，由選擇器的腳本處理。 */
export const OPEN_PICKER_EVENT = "bwz:open-picker"

export interface OpenPickerDetail {
  /** 打開後直接顯示書卷格子（而不是本卷章號）。 */
  showBooks?: boolean
  /** 選擇器處理後設成 true；發送者看到沒被處理就自己退回（例如直接點開抽屜）。 */
  handled?: boolean
}
