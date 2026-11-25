// 章節頁「經文｜研讀」分頁的狀態儲存與套用：
// 改由頂端分頁列（與手機快捷列）切換，全站共用一個 localStorage 值，第一次造訪預設看「研讀」。
// 套用方式是在 <html> 加上 data-ux-view="text" | "study"，early 腳本在第一次繪製前即寫入，避免閃爍。
import type { ReadingTab } from "../../../../quartz/util/readingTabEvent"
import type { RootLike } from "./settings"

export type ReadingView = ReadingTab

export const VIEW_STORAGE_KEY = "bwz-ux-view"
export const VIEW_ATTR = "data-ux-view"

export interface ViewStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/**
 * 預設為 "study"（研讀）：首次造訪、讀不到儲存值或壞資料都看研讀。
 * 讀者明確選過的 "text"（經文）要尊重；舊版 "pure"（純經文）當年也是明確選擇，視同 "text"。
 */
export function normalizeView(value: unknown): ReadingView {
  return value === "text" || value === "pure" ? "text" : "study"
}

function localStore(): ViewStorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage
  } catch {
    return null
  }
}

/** 讀取全站共用的閱讀分頁偏好；儲存被封鎖或讀不到時退回研讀。 */
export function readView(storage: ViewStorageLike | null = localStore()): ReadingView {
  try {
    return normalizeView(storage?.getItem(VIEW_STORAGE_KEY))
  } catch {
    return "study"
  }
}

/** 寫入全站共用的閱讀分頁偏好；回傳是否成功（失敗時畫面仍會套用，只是不記住）。 */
export function writeView(view: ReadingView, storage: ViewStorageLike | null = localStore()): boolean {
  try {
    if (!storage) return false
    storage.setItem(VIEW_STORAGE_KEY, normalizeView(view))
    return true
  } catch {
    return false
  }
}

/** 兩種分頁都需要 CSS 在章節頁套用對應的隱藏規則，所以一律顯式寫出 data-ux-view（無腳本時則全部顯示）。 */
export function applyView(view: ReadingView, root: RootLike = document.documentElement): void {
  root.setAttribute(VIEW_ATTR, normalizeView(view))
}

/** 目前畫面上實際套用的分頁（讀 <html> 屬性，儲存失敗時也能與畫面一致）。 */
export function currentView(root: RootLike = document.documentElement): ReadingView {
  return normalizeView(root.getAttribute(VIEW_ATTR))
}

/** 讀取並套用（頁面載入最早期呼叫，避免第一次繪製閃爍）。 */
export function applyStoredView(
  storage: ViewStorageLike | null = localStore(),
  root: RootLike = document.documentElement,
): ReadingView {
  const view = readView(storage)
  applyView(view, root)
  return view
}
