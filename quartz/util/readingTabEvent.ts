// 「經文｜研讀」分頁的跨外掛事件與屬性約定：
// site-ux（分頁切換）、chapterQuickBar（手機快捷列）、read-aloud（切換到研讀時停止朗讀）、
// readingLayers（點擊研讀頁的經節標籤跳回經文）都只引用這一份常數，避免外掛之間直接 import 或各自寫死字串。

export type ReadingTab = "text" | "study"

/** 分頁狀態變更或初始化時由 site-ux 在 document 上發出。 */
export const TAB_CHANGE_EVENT = "bwz:tab-change"

/** 其他元件（例如手機快捷列）要求切換分頁時在 document 上發出，由 site-ux 接手執行。 */
export const TAB_REQUEST_EVENT = "bwz:tab-request"

/** 點擊研讀頁的同章經節小標籤時由 readingLayers 發出（可取消），由 site-ux 切回經文並跳到該節。 */
export const VERSE_JUMP_EVENT = "bwz:verse-jump"

/** 本頁有啟用「經文｜研讀」分頁時，site-ux 標在 <html> 上的屬性；沒有研讀內容或非章節頁不標。 */
export const TABS_ATTR = "data-ux-tabs"

export interface TabChangeDetail {
  view: ReadingTab
  available: boolean
}

export interface TabRequestDetail {
  view: ReadingTab
}

export interface VerseJumpDetail {
  verse: number
}

export function dispatchTabChange(
  detail: TabChangeDetail,
  target: Pick<Document, "dispatchEvent"> = document,
): void {
  target.dispatchEvent(new CustomEvent<TabChangeDetail>(TAB_CHANGE_EVENT, { detail }))
}

export function requestTabSwitch(
  view: ReadingTab,
  target: Pick<Document, "dispatchEvent"> = document,
): void {
  target.dispatchEvent(new CustomEvent<TabRequestDetail>(TAB_REQUEST_EVENT, { detail: { view } }))
}
