// 純經文模式的 DOM 層：替要藏的區塊加 class、點到指向被藏內容的連結時暫時顯示那一個區塊。
// 「藏哪些」的規則在 quartz/util/chapterRegions.ts（經 chapterDom.ts 轉成元素），這裡不重寫；
// 模式本身（研讀｜純經文）的儲存與套用在 readingView.ts。CSS 只在 html[data-ux-view="pure"] 下才藏，
// 所以不論現在是哪種模式，class 都先標好，切換只是改 <html> 屬性。
import {
  hiddenSectionElements,
  readChapterDom,
  topLevelIndex,
} from "../../../../quartz/util/chapterDom"
import { REVEAL_EVENT, type RevealDetail } from "../../../../quartz/util/revealEvent"
import { applyView, currentView, writeView, type ReadingView } from "./readingView"

export const HIDE_CLASS = "bwz-ux-hide"
export const REVEAL_CLASS = "bwz-ux-reveal"
/** 標好之後才出現的 <html> 屬性；標好之前 CSS 先把整理等區塊遮住，避免第一次繪製時閃一下（見 appearance.scss）。 */
export const MARKED_ATTR = "data-ux-marked"

interface CleanupWindow extends Window {
  addCleanup?: (fn: () => void) => void
}

// 暫時顯示中的區塊，用標題文字記：折疊腳本之後會把 h2 換成 details（元素換了、標題文字不變）。
// 只活到換頁：每次 nav 都重設，所以「換頁後恢復」。
let revealed = new Set<string>()
let observer: MutationObserver | null = null

function clearMarks(): void {
  for (const el of Array.from(document.querySelectorAll(`.${HIDE_CLASS}`))) {
    el.classList.remove(HIDE_CLASS, REVEAL_CLASS)
  }
}

/** 重新標記。可重複呼叫（折疊腳本改了 DOM 之後會再呼叫一次）。認不出經文清單就什麼都不標。 */
export function applyMarks(): void {
  clearMarks()
  const dom = readChapterDom()
  if (dom) {
    const shown = new Set<Element>()
    const sections = hiddenSectionElements(dom)
    for (const section of sections) {
      for (const el of section.elements) {
        el.classList.add(HIDE_CLASS)
        // 兩個相鄰區塊共用中間的分隔線；任何一邊要顯示，它就顯示
        if (revealed.has(section.title)) shown.add(el)
      }
    }
    for (const el of shown) el.classList.add(REVEAL_CLASS)
  }
  document.documentElement.setAttribute(MARKED_ATTR, "")
}

/** 這一頁能不能用純經文（認得出經文清單的章節頁）。Aa 面板用它決定要不要顯示這一項。 */
export function isPureAvailable(): boolean {
  return readChapterDom() !== null
}

/** 切換閱讀模式（Aa 面板呼叫）：存進這個分頁、套用到 <html>，並清掉暫時顯示。 */
export function setReadingView(view: ReadingView): void {
  writeView(view)
  applyView(view)
  revealed = new Set()
  applyMarks()
}

/**
 * 要看到 id 這個元素；它在被藏起來的區塊裡就暫時顯示那個區塊。
 * 回傳「元素是否在被藏起來的區塊裡」（純經文模式才會是 true）。
 */
export function revealTarget(id: string): boolean {
  if (currentView() !== "pure") return false
  const el = id ? document.getElementById(id) : null
  const dom = readChapterDom()
  if (!el || !dom) return false
  const index = topLevelIndex(dom, el)
  if (index === -1) return false
  const top = dom.children[index]
  const section = hiddenSectionElements(dom).find((s) => s.elements.includes(top))
  if (!section) return false
  if (!revealed.has(section.title)) {
    revealed.add(section.title)
    applyMarks()
  }
  return true
}

function idFromHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""))
  } catch {
    return ""
  }
}

/** 顯示之後元素才有位置；Quartz 換頁時的捲動發生在它之前（那時元素還藏著），所以這裡再捲一次。 */
function scrollToId(id: string): void {
  document.getElementById(id)?.scrollIntoView()
}

/** 每次換頁（nav）呼叫一次。全域監聽都用 window.addCleanup，換頁時自動移除。 */
export function initPureMode(): void {
  const win = window as CleanupWindow
  revealed = new Set()
  observer?.disconnect()
  observer = null
  applyMarks()

  const dom = readChapterDom()
  if (dom) {
    // 折疊腳本稍後才把本章知識節點等區塊換成 <details>；換完要再標一次，標記才會落在新的元素上
    observer = new MutationObserver(() => applyMarks())
    observer.observe(dom.root, { childList: true })
  }

  // 網址帶 hash（含搜尋跳轉）指向被藏起來的區塊
  const hashId = idFromHash(location.hash)
  if (hashId && revealTarget(hashId)) scrollToId(hashId)

  // 同頁錨點（例如右欄目錄）：要在 Quartz 的點擊處理（它會 scrollIntoView）之前先顯示，所以用捕獲階段
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const link = event.target.closest<HTMLAnchorElement>("a[href*='#']")
    if (!link || link.pathname !== location.pathname) return
    revealTarget(idFromHash(link.hash))
  }
  const onHashChange = () => {
    const id = idFromHash(location.hash)
    if (id && revealTarget(id)) scrollToId(id)
  }
  // 其他外掛（verse-return 的「返回本章整理」）請我們顯示某個標題所在的區塊
  const onReveal = (event: Event) => {
    const detail = (event as CustomEvent<RevealDetail>).detail
    if (detail && revealTarget(detail.id)) detail.handled = true
  }

  document.addEventListener("click", onClick, true)
  window.addEventListener("hashchange", onHashChange)
  document.addEventListener(REVEAL_EVENT, onReveal)
  win.addCleanup?.(() => {
    document.removeEventListener("click", onClick, true)
    window.removeEventListener("hashchange", onHashChange)
    document.removeEventListener(REVEAL_EVENT, onReveal)
    observer?.disconnect()
    observer = null
  })
}

/** 換頁前呼叫：先把「已標記」拿掉，讓換頁的瞬間新內容也先被遮住（見 appearance.scss）。 */
export function prepareForNav(): void {
  document.documentElement.removeAttribute(MARKED_ATTR)
}
