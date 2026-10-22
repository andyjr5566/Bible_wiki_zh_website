// 手機 ☰ 抽屜（explorer 外掛的 .explorer）：打開、捲到最上面。
// 抽屜的開關按鈕是 explorer 外掛的（.explorer-toggle.mobile-explorer），我們只程式點擊它，不拿這個 class 當自己的按鈕。
import { MOBILE_QUERY } from "../pickerLogic"

function explorer(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".explorer")
}

export function isMobile(): boolean {
  return window.matchMedia(MOBILE_QUERY).matches
}

export function isDrawerOpen(): boolean {
  const el = explorer()
  return !!el && !el.classList.contains("collapsed")
}

/** 抽屜是收起的就打開；回傳是否有可用的抽屜。 */
export function openDrawer(): boolean {
  const el = explorer()
  const toggle = el?.querySelector<HTMLElement>(".explorer-toggle.mobile-explorer")
  if (!el || !toggle) return false
  if (el.classList.contains("collapsed")) toggle.click()
  return true
}

export function scrollDrawerToTop(): void {
  document.querySelector<HTMLElement>(".explorer-content")?.scrollTo({ top: 0 })
}

/** 抽屜每次打開（不論用哪個按鈕）都回到最上面的選擇器；explorer 外掛先切換 collapsed，所以等兩個畫面再處理。 */
export function onDrawerToggle(callback: () => void): () => void {
  const handler = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    if (!event.target.closest(".explorer-toggle.mobile-explorer")) return
    requestAnimationFrame(() => requestAnimationFrame(() => isDrawerOpen() && callback()))
  }
  document.addEventListener("click", handler)
  return () => document.removeEventListener("click", handler)
}
