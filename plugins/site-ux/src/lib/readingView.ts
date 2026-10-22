// 閱讀模式：研讀（預設，全部內容）｜純經文（只看經文，暫時隱藏本章知識節點、本章整理、附錄）。
// 和 Aa 的其他設定不同：只在「這個分頁」有效（sessionStorage，不是 localStorage），關掉分頁就回到研讀，
// 所以另外放一個檔案、不混進 settings.ts。套用方式一樣是在 <html> 加屬性，early 腳本在第一次繪製前套用。
import type { RootLike } from "./settings"

export type ReadingView = "study" | "pure"

export const VIEW_STORAGE_KEY = "bwz-ux-view"
export const VIEW_ATTR = "data-ux-view"

export interface ViewStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export function normalizeView(value: unknown): ReadingView {
  return value === "pure" ? "pure" : "study"
}

function sessionStore(): ViewStorageLike | null {
  try {
    return typeof sessionStorage === "undefined" ? null : sessionStorage
  } catch {
    return null
  }
}

/** 讀取這個分頁的閱讀模式；儲存被封鎖或讀不到時回到研讀。 */
export function readView(storage: ViewStorageLike | null = sessionStore()): ReadingView {
  try {
    return normalizeView(storage?.getItem(VIEW_STORAGE_KEY))
  } catch {
    return "study"
  }
}

/** 寫入；回傳是否成功（失敗時畫面仍會套用，只是換章後不會記住）。 */
export function writeView(view: ReadingView, storage: ViewStorageLike | null = sessionStore()): boolean {
  try {
    if (!storage) return false
    storage.setItem(VIEW_STORAGE_KEY, normalizeView(view))
    return true
  } catch {
    return false
  }
}

/** 研讀是預設，不留屬性，所以預設外觀不會被任何 CSS 影響。 */
export function applyView(view: ReadingView, root: RootLike = document.documentElement): void {
  if (view === "pure") root.setAttribute(VIEW_ATTR, "pure")
  else root.removeAttribute(VIEW_ATTR)
}

/** 目前畫面上實際套用的模式（讀 <html> 屬性，所以儲存失敗時也和畫面一致）。 */
export function currentView(root: RootLike = document.documentElement): ReadingView {
  return normalizeView(root.getAttribute(VIEW_ATTR))
}

/** 讀取並套用（頁面載入最早期呼叫，避免閃一下完整內容）。 */
export function applyStoredView(
  storage: ViewStorageLike | null = sessionStore(),
  root: RootLike = document.documentElement,
): ReadingView {
  const view = readView(storage)
  applyView(view, root)
  return view
}
