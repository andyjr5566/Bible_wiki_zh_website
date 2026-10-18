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
}
