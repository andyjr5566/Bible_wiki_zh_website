// 「經文｜研讀」分頁的跨外掛事件與屬性約定：
// site-ux（分頁切換）、chapterQuickBar（手機快捷列）、
// readingLayers（點擊研讀頁的經節標籤在同頁跳到該節）都只引用這一份常數，避免外掛之間直接 import 或各自寫死字串。

export type ReadingTab = "text" | "study"

/** 分頁狀態變更或初始化時由 site-ux 在 document 上發出。 */
export const TAB_CHANGE_EVENT = "bwz:tab-change"

/** 其他元件（例如手機快捷列）要求切換分頁時在 document 上發出，由 site-ux 接手執行。 */
export const TAB_REQUEST_EVENT = "bwz:tab-request"

/** 點擊研讀頁的同章經節小標籤時由 readingLayers 發出（可取消），由 site-ux 單次捲到同頁該節並短暫標示。 */
export const VERSE_JUMP_EVENT = "bwz:verse-jump"

/** 本頁有啟用「經文｜研讀」分頁時，site-ux 標在 <html> 上的屬性；沒有研讀內容或非章節頁不標。 */
export const TABS_ATTR = "data-ux-tabs"

/** 本章導覽面板開合狀態（"open" | "collapsed"），由 chapterGuide.inline.ts 標在 <html> 上；非章節頁不標。 */
export const GUIDE_ATTR = "data-bwz-guide"

/** 手機快捷列或浮動鈕點擊「目錄／本章導覽」時發出，由 chapterGuide.inline.ts 接手開合。 */
export const GUIDE_TOGGLE_EVENT = "bwz:guide-toggle"

/** 本章導覽面板開合或可用狀態改變時由 chapterGuide.inline.ts 發出。 */
export const GUIDE_STATE_EVENT = "bwz:guide-state"

export type GuideViewport = "desktop" | "tablet" | "mobile"

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

export interface GuideStateDetail {
  open: boolean
  viewport: GuideViewport
  available: boolean
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

export function requestGuideToggle(
  target: Pick<Document, "dispatchEvent"> = document,
): void {
  target.dispatchEvent(new CustomEvent<{}>(GUIDE_TOGGLE_EVENT, { detail: {} }))
}

export function dispatchGuideState(
  detail: GuideStateDetail,
  target: Pick<Document, "dispatchEvent"> = document,
): void {
  target.dispatchEvent(
    new CustomEvent<GuideStateDetail>(GUIDE_STATE_EVENT, { detail }) as unknown as CustomEvent<{}>,
  )
}
