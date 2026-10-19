// 功能模組介面（見 dev-notes/personal-notes/11-code-structure.md §4）。
//
// 每個功能（筆記；日後的畫重點、書籤…）放在 features/<名稱>/，用 Feature 宣告它在哪些「掛載點」上提供畫面。
// 頁面上的掛載點是 Quartz 元件輸出的 <… data-bwz-notes="種類">；app.ts 依種類找出所有提供該種類畫面的功能，
// 各給一個容器掛上去。新增功能＝新增資料夾＋在 features/index.ts 登記，不必改其他功能。

import type { Session } from "../session/session"

export interface View {
  /** 換頁或掛載點被移除時呼叫：解除事件、收掉浮動元素、存檔未存的輸入。 */
  destroy(): void
}

export interface MountContext {
  session: Session
  /** 這個畫面專用的容器（已在掛載點裡）。 */
  host: HTMLElement
  /** 掛載點的 data-* 屬性（例如 book、chapter）。 */
  data: DOMStringMap
}

export interface Feature {
  id: string
  /** 掛載點種類 → 建立畫面；回傳 null 代表這個掛載點不適用。 */
  views: Partial<Record<string, (ctx: MountContext) => View | null>>
  /** 某種掛載點上要排在最前面（例如「我的筆記」頁最上方的設定按鈕）；沒寫就依登記順序排在後面。 */
  first?: string[]
}

// ---------- 功能之間的事件（功能模組不互相 import，需要互動時用 document 上的事件） ----------

/** 要求筆記功能開一則「針對某幾節」的新筆記（例如畫重點工具列上的「寫筆記」）。 */
export const COMPOSE_NOTE_EVENT = "bwz:compose-note"

/** 要求便條紙功能在某一節貼一張新便條（畫重點工具列上的「便條」）。 */
export const COMPOSE_STICKY_EVENT = "bwz:compose-sticky"

/**
 * 要求筆記功能把一段引文放進這一頁的筆記（「❝ 引用到筆記」）：
 * 這一頁有開著的編輯器就插在游標位置，沒有就開一則新筆記（章節頁＝整章筆記、條目頁＝條目筆記）。
 */
export const COMPOSE_QUOTE_EVENT = "bwz:compose-quote"

export interface ComposeQuoteDetail {
  page: { kind: "chapter"; book: string; chapter: number } | { kind: "entry"; slug: string }
  /** 已排好的 Markdown 引文（含出處連結，結尾留一個空行） */
  markdown: string
}

export interface ComposeStickyDetail {
  book: string
  chapter: number
  verse: number
}

export interface ComposeNoteDetail {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number | null
  /** 選取的經文（會放進筆記開頭當引用） */
  quote?: string
}
