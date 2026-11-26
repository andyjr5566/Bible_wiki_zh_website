// 首頁區塊的先後順序：有閱讀紀錄時入口在最上面；沒有時「第一次來嗎？」導覽卡在最上面。
// 只看自己的閱讀紀錄、不讀導覽的儲存資料。結果寫成 <html data-bwz-reading="has|none">，
// 由 CSS 的 order 排版；因為在 <head> 就先寫好，第一次繪製就是對的順序，不會跳動。
import { hasReading, type ReadingStorage } from "./readingStorage"

export const READING_ATTR = "data-bwz-reading"

export type ReadingOrder = "has" | "none"

interface RootLike {
  setAttribute(name: string, value: string): void
}

export function readingOrder(storage?: ReadingStorage | null): ReadingOrder {
  // undefined 走預設（localStorage）；null 代表「讀不到儲存空間」，一律當作沒有紀錄
  return hasReading(storage) ? "has" : "none"
}

export function applyReadingOrder(
  root: RootLike = document.documentElement,
  storage?: ReadingStorage | null,
): ReadingOrder {
  const order = readingOrder(storage)
  root.setAttribute(READING_ATTR, order)
  return order
}
