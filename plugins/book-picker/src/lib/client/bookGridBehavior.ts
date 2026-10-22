// 頁面上所有 .bwz-bookgrid（左欄選擇器、首頁入口）共用的行為：分頁切換與鍵盤、依閱讀紀錄選預設的約、灰色書卷提示。
// 用事件委派，所以首頁入口外掛畫的格子不必另外附腳本。
import type { Testament } from "../../../../../quartz/util/bibleBooks"
import { testamentOf, lockedMessage } from "../pickerLogic"
import { recentReadBook } from "./readingRecent"
import { showToast } from "./toast"

const TABS = ".bwz-bg-tab"

export function selectTab(grid: HTMLElement, testament: Testament, focus = false): void {
  for (const tab of Array.from(grid.querySelectorAll<HTMLElement>(TABS))) {
    const selected = tab.dataset.testament === testament
    tab.setAttribute("aria-selected", String(selected))
    tab.tabIndex = selected ? 0 : -1
    if (selected && focus) tab.focus()
    const panel = document.getElementById(tab.getAttribute("aria-controls") ?? "")
    if (panel) panel.hidden = !selected
  }
}

/** 沒有「目前書卷」的格子，依最近讀過那卷所屬的約決定預設分頁；沒有紀錄就維持伺服器端畫的預設。 */
function applyAutoTab(grid: HTMLElement): void {
  if (grid.dataset.autoTab !== "true") return
  const recent = recentReadBook()
  if (recent) selectTab(grid, testamentOf(recent))
}

/** 灰色書卷桌機滑鼠移上去用 title 顯示同一句話（觸控沒有 hover，點了才有提示）。 */
function labelLockedBooks(grid: HTMLElement): void {
  const summary = grid.dataset.openSummary ?? ""
  for (const button of Array.from(grid.querySelectorAll<HTMLElement>(".bwz-bg-book.is-locked"))) {
    button.title = lockedMessage(button.dataset.book ?? button.textContent ?? "", summary)
  }
}

function onClick(event: MouseEvent): void {
  if (!(event.target instanceof Element)) return
  const tab = event.target.closest<HTMLElement>(TABS)
  const grid = tab?.closest<HTMLElement>(".bwz-bookgrid")
  if (tab && grid) {
    selectTab(grid, (tab.dataset.testament as Testament) ?? "ot")
    return
  }
  const locked = event.target.closest<HTMLElement>(".bwz-bg-book.is-locked")
  if (locked?.title) showToast(locked.title)
}

/** 分頁的方向鍵：左右切換、Home／End 到頭尾（WAI-ARIA tabs 慣例）。 */
function onKeydown(event: KeyboardEvent): void {
  if (!(event.target instanceof Element)) return
  const tab = event.target.closest<HTMLElement>(TABS)
  const grid = tab?.closest<HTMLElement>(".bwz-bookgrid")
  if (!tab || !grid) return
  const tabs = Array.from(grid.querySelectorAll<HTMLElement>(TABS))
  const index = tabs.indexOf(tab)
  let next = -1
  if (event.key === "ArrowRight") next = (index + 1) % tabs.length
  else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length
  else if (event.key === "Home") next = 0
  else if (event.key === "End") next = tabs.length - 1
  if (next < 0) return
  event.preventDefault()
  selectTab(grid, (tabs[next].dataset.testament as Testament) ?? "ot", true)
}

/** 初始化目前頁面上的格子，並掛上委派的監聽；回傳移除監聽的函式。 */
export function initBookGrids(): () => void {
  for (const grid of Array.from(document.querySelectorAll<HTMLElement>(".bwz-bookgrid"))) {
    labelLockedBooks(grid)
    applyAutoTab(grid)
  }
  document.addEventListener("click", onClick)
  document.addEventListener("keydown", onKeydown)
  return () => {
    document.removeEventListener("click", onClick)
    document.removeEventListener("keydown", onKeydown)
  }
}
