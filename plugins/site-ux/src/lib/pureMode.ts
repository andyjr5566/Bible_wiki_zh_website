// 章節頁「經文｜研讀」分頁的 DOM 層：
//   1. 依據 quartz/util/chapterRegions.ts 標記研讀區（.bwz-ux-hide）與經文區（.bwz-ux-text-only）。
//   2. 在章節標題／導覽表下方掛載「經文｜研讀」分頁列（桌機、平板黏在頂端；手機在頁首流內，捲動後由快捷列接手）。
//   3. 點擊研讀頁的經節小標籤（bwz:verse-jump）→ 切回經文頁、單次捲到該節並短暫標示（沿用 verse-return 樣式）。
//   4. 保留原純經文模式的暫時顯示（點到指向被藏內容的錨點、URL hash、verse-return 的 bwz:reveal），換頁後清除。
//   5. 透過 bwz:tab-change／bwz:tab-request 與手機快捷列、朗讀外掛同步，不直接 import 別的外掛。
import {
  chapterTabElements,
  readChapterDom,
  topLevelIndex,
  verseElementByNumber,
  type ChapterDom,
} from "../../../../quartz/util/chapterDom"
import { REVEAL_EVENT, type RevealDetail } from "../../../../quartz/util/revealEvent"
import {
  TABS_ATTR,
  TAB_REQUEST_EVENT,
  VERSE_JUMP_EVENT,
  dispatchTabChange,
  type TabRequestDetail,
  type VerseJumpDetail,
} from "../../../../quartz/util/readingTabEvent"
import { applyView, currentView, writeView, type ReadingView } from "./readingView"

export const HIDE_CLASS = "bwz-ux-hide"
export const TEXT_ONLY_CLASS = "bwz-ux-text-only"
export const REVEAL_CLASS = "bwz-ux-reveal"
/** 標好之後才出現的 <html> 屬性；標好之前 CSS 先把非當下分頁的內容遮住，避免第一次繪製閃爍。 */
export const MARKED_ATTR = "data-ux-marked"
export const TABS_CLASS = "bwz-tabs"
/** 沿用 verse-return 的短暫標示樣式 */
export const FLASH_CLASS = "bwz-vr-flash"

const MOBILE_QUERY = "(max-width: 800px)"
const FLASH_MS = 2500
const HEADING_GAP_PX = 12

interface CleanupWindow extends Window {
  addCleanup?: (fn: () => void) => void
}

export interface SetViewOptions {
  /** 從捲動後的黏頂分頁列或手機快捷列切換時，捲回新分頁開頭；預設 false */
  scrollIfPastBar?: boolean
}

export interface VerseScrollInput {
  rectTop: number
  rectHeight: number
  scrollY: number
  viewportHeight: number
  topObstruction: number
}

export interface HeadingScrollInput {
  rectTop: number
  scrollY: number
  topObstruction: number
  gap?: number
}

// 暫時顯示中的研讀區塊用標題文字記：折疊腳本把 h2 換成 details 後，元素會換但標題文字不變。
// 每次換頁（nav）與主動切分頁都會重設。
let revealed = new Set<string>()
let verseRevealed = false
let observer: MutationObserver | null = null
let controller: AbortController | null = null
let flashTimer: number | null = null

/** 桌機與平板分頁列旁邊的簡短說明文字。 */
export function tabHintText(view: ReadingView): string {
  return view === "text"
    ? "只看經文；按「研讀」直接看本章整理"
    : "本章整理與知識節點；按「經文」回到經文"
}

/** 計算跳到單一經節時的目標 scrollY：在未被頂端遮住的可見區置中；經節較高則對齊上緣。 */
export function computeVerseScrollTop(input: VerseScrollInput): number {
  const visible = Math.max(0, input.viewportHeight - input.topObstruction)
  const offset = input.rectHeight >= visible ? HEADING_GAP_PX : (visible - input.rectHeight) / 2
  return Math.max(0, Math.round(input.scrollY + input.rectTop - input.topObstruction - offset))
}

/** 計算跳到標題時的目標 scrollY：對齊頂端固定列下方並留白。 */
export function computeHeadingScrollTop(input: HeadingScrollInput): number {
  const gap = input.gap ?? HEADING_GAP_PX
  return Math.max(0, Math.round(input.scrollY + input.rectTop - input.topObstruction - gap))
}

function clearMarks(): void {
  for (const el of Array.from(document.querySelectorAll(`.${HIDE_CLASS}, .${TEXT_ONLY_CLASS}`))) {
    el.classList.remove(HIDE_CLASS, TEXT_ONLY_CLASS, REVEAL_CLASS)
  }
}

function removeTabBar(): void {
  for (const el of Array.from(document.querySelectorAll(`.${TABS_CLASS}`))) el.remove()
}

function syncTabBarUi(view: ReadingView): void {
  const bar = document.querySelector<HTMLElement>(`.${TABS_CLASS}`)
  if (!bar) return
  for (const btn of Array.from(bar.querySelectorAll<HTMLButtonElement>("[role='tab']"))) {
    const active = btn.dataset.tab === view
    btn.setAttribute("aria-selected", active ? "true" : "false")
    btn.tabIndex = active ? 0 : -1
  }
  const hint = bar.querySelector<HTMLElement>(".bwz-tabs-hint")
  if (hint) hint.textContent = tabHintText(view)
}

function stickyObstructionHeight(): number {
  const isMobile = typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches
  if (isMobile) {
    let total = 0
    const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
    if (toolbar) {
      const pos = getComputedStyle(toolbar).position
      if (pos === "sticky" || pos === "fixed") {
        total += Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
      }
    }
    const quickBar = document.querySelector<HTMLElement>(".bwz-cqb")
    if (quickBar) total += quickBar.offsetHeight
    return total
  }
  const tabs = document.querySelector<HTMLElement>(`.${TABS_CLASS}`)
  if (tabs && getComputedStyle(tabs).position === "sticky") {
    return Math.max(0, Math.round(tabs.getBoundingClientRect().height))
  }
  return 0
}

function stickyToolbarBottomMobile(): number {
  const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
  if (!toolbar) return 0
  const pos = getComputedStyle(toolbar).position
  if (pos !== "sticky" && pos !== "fixed") return 0
  return Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
}

/** 若讀者已往下捲過頁首才切換分頁，捲回新分頁開頭（避免停在頁尾）；原本就在頂端則不捲。 */
function scrollToTabTopIfNeeded(): void {
  const bar = document.querySelector<HTMLElement>(`.${TABS_CLASS}`)
  if (!bar) return
  const isMobile = typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches
  if (isMobile) {
    const toolbarBottom = stickyToolbarBottomMobile()
    const barTop = bar.getBoundingClientRect().top
    if (barTop < toolbarBottom) {
      const target = Math.max(0, Math.round(window.scrollY + barTop - toolbarBottom - 8))
      window.scrollTo({ top: target, behavior: "instant" })
    }
    return
  }
  // 桌機與平板：分頁列本身是 sticky，用它前一個兄弟節點的下緣判斷是否已捲過頁首
  const prev = bar.previousElementSibling
  if (!prev) return
  const prevBottom = prev.getBoundingClientRect().bottom
  if (prevBottom < 0) {
    const target = Math.max(0, Math.round(window.scrollY + prevBottom))
    window.scrollTo({ top: target, behavior: "instant" })
  }
}

function makeTabIcon(kind: ReadingView): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg"
  const svg = document.createElementNS(ns, "svg")
  svg.setAttribute("viewBox", "0 0 20 20")
  svg.setAttribute("width", "16")
  svg.setAttribute("height", "16")
  svg.setAttribute("fill", "none")
  svg.setAttribute("stroke", "currentColor")
  svg.setAttribute("stroke-width", "1.8")
  svg.setAttribute("stroke-linecap", "round")
  svg.setAttribute("stroke-linejoin", "round")
  svg.setAttribute("aria-hidden", "true")
  svg.classList.add("bwz-tab-icon")

  if (kind === "text") {
    // 攤開的書本：代表經文
    const p1 = document.createElementNS(ns, "path")
    p1.setAttribute("d", "M2.5 4.5h5a2.5 2.5 0 0 1 2.5 2.5v9a2 2 0 0 0-2-2h-5.5z")
    const p2 = document.createElementNS(ns, "path")
    p2.setAttribute("d", "M17.5 4.5h-5A2.5 2.5 0 0 0 10 7v9a2 2 0 0 1 2-2h5.5z")
    svg.append(p1, p2)
  } else {
    // 放大鏡：代表研讀
    const c = document.createElementNS(ns, "circle")
    c.setAttribute("cx", "9")
    c.setAttribute("cy", "9")
    c.setAttribute("r", "5.5")
    const p = document.createElementNS(ns, "path")
    p.setAttribute("d", "M13.2 13.2L17 17")
    svg.append(c, p)
  }
  return svg
}

function buildTabBar(view: ReadingView, signal: AbortSignal): HTMLElement {
  const wrap = document.createElement("div")
  wrap.className = TABS_CLASS

  const seg = document.createElement("div")
  seg.className = "bwz-tabs-seg"
  seg.setAttribute("role", "tablist")
  seg.setAttribute("aria-label", "閱讀分頁")

  const tabs: ReadonlyArray<readonly [ReadingView, string]> = [
    ["text", "經文"],
    ["study", "研讀"],
  ]
  const buttons: HTMLButtonElement[] = []
  for (const [value, label] of tabs) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = "bwz-tab"
    btn.setAttribute("role", "tab")
    btn.dataset.tab = value
    const active = value === view
    btn.setAttribute("aria-selected", active ? "true" : "false")
    btn.tabIndex = active ? 0 : -1
    const text = document.createElement("span")
    text.textContent = label
    btn.append(makeTabIcon(value), text)
    btn.addEventListener(
      "click",
      () => {
        if (currentView() === value) return
        setReadingView(value, { scrollIfPastBar: true })
      },
      { signal },
    )
    buttons.push(btn)
    seg.append(btn)
  }

  seg.addEventListener(
    "keydown",
    (event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[role='tab']")
      if (!target) return
      const idx = buttons.indexOf(target)
      if (idx === -1) return
      let nextIdx: number | null = null
      if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIdx = (idx + 1) % buttons.length
      else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        nextIdx = (idx - 1 + buttons.length) % buttons.length
      } else if (event.key === "Home") nextIdx = 0
      else if (event.key === "End") nextIdx = buttons.length - 1
      if (nextIdx === null) return
      event.preventDefault()
      const next = buttons[nextIdx]
      next.focus()
      const nextTab = next.dataset.tab as ReadingView
      if (currentView() !== nextTab) setReadingView(nextTab, { scrollIfPastBar: true })
    },
    { signal },
  )

  const hint = document.createElement("span")
  hint.className = "bwz-tabs-hint"
  hint.textContent = tabHintText(view)

  wrap.append(seg, hint)
  return wrap
}

function mountTabBar(dom: ChapterDom, view: ReadingView, signal: AbortSignal): boolean {
  removeTabBar()
  const info = chapterTabElements(dom)
  if (!info.hasStudyContent || !info.tabAnchor) return false
  const bar = buildTabBar(view, signal)
  if (info.tabAnchor.position === "after") info.tabAnchor.element.after(bar)
  else info.tabAnchor.element.before(bar)
  return true
}

/** 重新標記。可重複呼叫（折疊腳本或朗讀列改了 DOM 後會再呼叫一次）。認不出經文清單或沒有研讀內容時什麼都不標。 */
export function applyMarks(): boolean {
  clearMarks()
  const dom = readChapterDom()
  const html = document.documentElement
  let available = false

  if (dom) {
    const info = chapterTabElements(dom)
    if (info.hasStudyContent) {
      available = true
      const shown = new Set<Element>()
      for (const section of info.sections) {
        for (const el of section.elements) {
          el.classList.add(HIDE_CLASS)
          // 兩個相鄰區塊共用中間的分隔線；任何一邊要顯示，它就顯示
          if (revealed.has(section.title)) shown.add(el)
        }
      }
      for (const el of info.textOnlyElements) {
        el.classList.add(TEXT_ONLY_CLASS)
        if (verseRevealed && el === dom.verseList) shown.add(el)
      }
      for (const el of shown) el.classList.add(REVEAL_CLASS)
    }
  }

  if (available) html.setAttribute(TABS_ATTR, "")
  else html.removeAttribute(TABS_ATTR)
  html.setAttribute(MARKED_ATTR, "")
  return available
}

/** 這一頁能不能用「經文｜研讀」分頁（同時有經文清單與研讀內容的章節頁）。 */
export function isPureAvailable(): boolean {
  const dom = readChapterDom()
  if (!dom) return false
  return chapterTabElements(dom).hasStudyContent
}

/** 切換閱讀分頁：寫入 localStorage、套用到 <html>、清除暫時顯示、同步分頁列並通知其他元件。 */
export function setReadingView(view: ReadingView, options: SetViewOptions = {}): void {
  writeView(view)
  applyView(view)
  revealed = new Set()
  verseRevealed = false
  const available = applyMarks()
  syncTabBarUi(view)
  dispatchTabChange({ view, available })
  if (options.scrollIfPastBar && available) {
    scrollToTabTopIfNeeded()
  }
}

/**
 * 要看到 id 這個元素；它在目前被隱藏的分頁區塊裡就暫時顯示那個區塊（不改使用者偏好）。
 * 回傳「元素原本被隱藏、已暫時顯示」與否。
 */
export function revealTarget(id: string): boolean {
  const el = id ? document.getElementById(id) : null
  const dom = readChapterDom()
  if (!el || !dom) return false
  const info = chapterTabElements(dom)
  if (!info.hasStudyContent) return false

  const view = currentView()
  if (view === "text") {
    const index = topLevelIndex(dom, el)
    if (index === -1) return false
    const top = dom.children[index]
    const section = info.sections.find((s) => s.elements.includes(top))
    if (!section) return false
    if (!revealed.has(section.title)) {
      revealed.add(section.title)
      applyMarks()
    }
    return true
  }

  // 研讀分頁下，若目標在經文清單裡（例如 verse-return 回到經節或重點列表點進 #vN），暫時顯示經文清單
  if (dom.verseList.contains(el)) {
    if (!verseRevealed) {
      verseRevealed = true
      applyMarks()
    }
    return true
  }
  return false
}

function idFromHash(hash: string): string {
  try {
    return decodeURIComponent(hash.replace(/^#/, ""))
  } catch {
    return ""
  }
}

/** 不用 scrollIntoView 避免連帶捲動外層容器；只單次捲動到目標位置。 */
function scrollToId(id: string): void {
  const target = document.getElementById(id)
  if (!target) return
  const rect = target.getBoundingClientRect()
  const top = computeHeadingScrollTop({
    rectTop: rect.top,
    scrollY: window.scrollY,
    topObstruction: stickyObstructionHeight(),
  })
  window.scrollTo({ top, behavior: "instant" })
}

function flashElement(target: HTMLElement): void {
  for (const old of Array.from(document.querySelectorAll(`.${FLASH_CLASS}`))) {
    old.classList.remove(FLASH_CLASS)
  }
  if (flashTimer !== null) {
    window.clearTimeout(flashTimer)
    flashTimer = null
  }
  // 強制 reflow 讓重複點同一節時動畫可以重播
  void target.offsetWidth
  target.classList.add(FLASH_CLASS)
  flashTimer = window.setTimeout(() => {
    target.classList.remove(FLASH_CLASS)
    flashTimer = null
  }, FLASH_MS)
}

/** 點研讀頁裡的經節小標籤：切到經文分頁、單次捲到那一節並短暫標示。 */
export function jumpToVerseOnTab(verse: number): boolean {
  const dom = readChapterDom()
  if (!dom) return false
  if (currentView() !== "text") {
    setReadingView("text", { scrollIfPastBar: false })
  }
  const target = verseElementByNumber(dom, verse)
  if (!target) return false
  const rect = target.getBoundingClientRect()
  const top = computeVerseScrollTop({
    rectTop: rect.top,
    rectHeight: rect.height,
    scrollY: window.scrollY,
    viewportHeight: window.innerHeight,
    topObstruction: stickyObstructionHeight(),
  })
  // 剛切換分頁時整頁高度改變，比照 verse-return 用瞬間定位避免捲動動畫落後或被中斷
  window.scrollTo({ top, behavior: "instant" })
  flashElement(target)
  return true
}

function teardown(): void {
  controller?.abort()
  controller = null
  observer?.disconnect()
  observer = null
  if (flashTimer !== null) {
    window.clearTimeout(flashTimer)
    flashTimer = null
  }
}

/** 每次換頁（nav）呼叫一次。所有監聽器都掛在 AbortController，換頁時一併清掉。 */
export function initPureMode(): void {
  const win = window as CleanupWindow
  teardown()
  revealed = new Set()
  verseRevealed = false

  const abort = new AbortController()
  controller = abort
  const { signal } = abort

  const view = currentView()
  // 若前面有其他外掛的 prescript 因 localStorage 被封鎖而中斷，這裡補設一次 data-ux-view
  applyView(view)
  const dom = readChapterDom()
  const available = applyMarks()
  if (dom && available) {
    mountTabBar(dom, view, signal)
    // 掛完分頁列再開始觀察子節點變動，避免自己的插入觸發多餘重標；
    // 之後折疊腳本（details）或朗讀列（.bwz-ra）插入時再自動補標。
    observer = new MutationObserver(() => {
      applyMarks()
    })
    observer.observe(dom.root, { childList: true })
  } else {
    removeTabBar()
  }

  dispatchTabChange({ view, available })

  // 網址帶 hash（含搜尋跳轉）指向被藏起來的區塊
  const hashId = idFromHash(location.hash)
  if (hashId && revealTarget(hashId)) scrollToId(hashId)

  // 同頁錨點（例如互動網站上方一行、右欄目錄、重點列表）：捕獲階段先顯示，讓接下來的捲動找得到座標
  document.addEventListener(
    "click",
    (event) => {
      if (!(event.target instanceof Element)) return
      const link = event.target.closest<HTMLAnchorElement>("a[href*='#']")
      if (!link || link.pathname !== location.pathname) return
      // 經節小標籤走 bwz:verse-jump 切換分頁，不走暫時顯示
      if (link.classList.contains("bwz-rl-vref") && link.dataset.rlVerse) return
      revealTarget(idFromHash(link.hash))
    },
    { capture: true, signal },
  )

  window.addEventListener(
    "hashchange",
    () => {
      const id = idFromHash(location.hash)
      if (id && revealTarget(id)) scrollToId(id)
    },
    { signal },
  )

  // 其他外掛（verse-return 的「返回本章整理」或「返回經節」）請我們暫時顯示某個目標
  document.addEventListener(
    REVEAL_EVENT,
    (event) => {
      const detail = (event as CustomEvent<RevealDetail>).detail
      if (detail && revealTarget(detail.id)) detail.handled = true
    },
    { signal },
  )

  // 手機快捷列等外部元件要求切換分頁
  document.addEventListener(
    TAB_REQUEST_EVENT,
    (event) => {
      const detail = (event as CustomEvent<TabRequestDetail>).detail
      if (detail?.view === "text" || detail?.view === "study") {
        if (currentView() !== detail.view) {
          setReadingView(detail.view, { scrollIfPastBar: true })
        }
      }
    },
    { signal },
  )

  // 研讀頁經節小標籤跳回經文頁該節
  document.addEventListener(
    VERSE_JUMP_EVENT,
    (event) => {
      const detail = (event as CustomEvent<VerseJumpDetail>).detail
      if (!detail || !Number.isInteger(detail.verse) || detail.verse < 1) return
      if (jumpToVerseOnTab(detail.verse)) {
        event.preventDefault()
      }
    },
    { signal },
  )

  win.addCleanup?.(() => {
    teardown()
  })
}

/** 換頁前呼叫：清掉已標記旗標以防新頁閃爍，但保留 data-ux-tabs 讓 home-hub 在 prenav 量到正確的舊頁高度。 */
export function prepareForNav(): void {
  teardown()
  document.documentElement.removeAttribute(MARKED_ATTR)
}
