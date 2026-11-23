// chapterQuickBar.inline.ts
// 聖經研讀知識庫 - 手機版章節快捷列（B3-4，B 階段改為內含「經文｜研讀」分頁切換）
//
// 章節頁（slug 形如 01-創世記/第2章）往下捲過頁首的分頁列（或「前一章｜回目錄｜下一章」表格）後，
// 畫面頂端浮出一條細快捷列：書卷章名、上一章、下一章、「經文｜研讀」分頁、回到頂端。捲回頂端就收起。
// 只在手機寬度（<= 800px）出現；桌機與平板由頁首黏頂分頁列與側欄負責。
//
// 書卷章名是可以點的按鈕：打開 ☰ 抽屜，最上面就是書卷章節選擇器（book-picker 外掛）。
// 分頁鈕透過 bwz:tab-request／bwz:tab-change 與 site-ux 同步，不直接 import 外掛。
import {
  GUIDE_ATTR,
  GUIDE_STATE_EVENT,
  requestGuideToggle,
  TABS_ATTR,
  TAB_CHANGE_EVENT,
  requestTabSwitch,
  type GuideStateDetail,
  type ReadingTab,
  type TabChangeDetail,
} from "../../util/readingTabEvent"

const CHAPTER_SLUG = /^\d+-[^/]+\/第\d+章$/
const MOBILE_QUERY = "(max-width: 800px)"
const BAR_CLASS = "bwz-cqb"
const HEIGHT_VAR = "--bwz-cqb-h"
const TOP_VAR = "--bwz-cqb-top"
const ON_CLASS = "bwz-cqb-on"

// 手機版左欄（工具列）是 position: sticky 貼在頂端；回傳它目前的下緣，沒有貼頂就回傳 0
function stickyToolbarBottom(): number {
  const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
  if (!toolbar) return 0
  const pos = getComputedStyle(toolbar).position
  if (pos !== "sticky" && pos !== "fixed") return 0
  return Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
}

function chapterTitle(slug: string): string {
  const [folder, file] = slug.split("/")
  const book = folder.replace(/^\d+-/, "")
  const num = file.match(/第(\d+)章/)?.[1] ?? ""
  return `${book} ${num}`.trim()
}

/** 頁首的上一章／下一章表格（內容同步時自動產生）；沒有就回傳 null */
function findNavTable(article: Element): { table: Element; prev?: string; next?: string } | null {
  for (const table of Array.from(article.querySelectorAll("table"))) {
    let prev: string | undefined
    let next: string | undefined
    for (const a of Array.from(table.querySelectorAll("a"))) {
      const label = (a.textContent ?? "").trim()
      const href = a.getAttribute("href")
      if (!href) continue
      if (label === "前一章") prev = href
      else if (label === "下一章") next = href
    }
    if (prev || next) return { table, prev, next }
  }
  return null
}

function currentTabFromDom(): ReadingTab {
  return document.documentElement.getAttribute("data-ux-view") === "study" ? "study" : "text"
}

function removeBar() {
  document.querySelectorAll(`.${BAR_CLASS}`).forEach((el) => el.remove())
  document.documentElement.style.removeProperty(HEIGHT_VAR)
  document.documentElement.style.removeProperty(TOP_VAR)
  document.documentElement.classList.remove(ON_CLASS)
}

/** 打開抽屜並顯示選擇器；事件沒人處理時（book-picker 沒載入）退回只打開抽屜。 */
function openPicker() {
  const detail: { handled?: boolean } = {}
  document.dispatchEvent(new CustomEvent("bwz:open-picker", { detail }))
  if (detail.handled) return
  const explorer = document.querySelector(".explorer")
  if (explorer?.classList.contains("collapsed")) {
    explorer.querySelector<HTMLElement>(".explorer-toggle.mobile-explorer")?.click()
  }
}

function makeLink(cls: string, label: string, href: string, arrow: "‹" | "›"): HTMLAnchorElement {
  const a = document.createElement("a")
  a.className = `${BAR_CLASS}-btn ${cls}`
  a.href = href
  a.innerHTML =
    arrow === "‹"
      ? `<span aria-hidden="true">‹</span>${label}`
      : `${label}<span aria-hidden="true">›</span>`
  return a
}

function makeButton(cls: string, label: string, aria?: string): HTMLButtonElement {
  const b = document.createElement("button")
  b.type = "button"
  b.className = `${BAR_CLASS}-btn ${cls}`
  b.textContent = label
  if (aria) b.setAttribute("aria-label", aria)
  return b
}

function makeTabSwitcher(signal: AbortSignal): {
  container: HTMLDivElement
  sync: (view: ReadingTab, available: boolean) => void
} {
  const container = document.createElement("div")
  container.className = `${BAR_CLASS}-tabs`
  container.setAttribute("role", "tablist")
  container.setAttribute("aria-label", "閱讀分頁")

  const specs: ReadonlyArray<readonly [ReadingTab, string]> = [
    ["text", "經文"],
    ["study", "研讀"],
  ]
  const buttons: HTMLButtonElement[] = []
  for (const [tab, label] of specs) {
    const btn = document.createElement("button")
    btn.type = "button"
    btn.className = `${BAR_CLASS}-tab`
    btn.setAttribute("role", "tab")
    btn.dataset.tab = tab
    btn.textContent = label
    btn.addEventListener(
      "click",
      () => {
        requestTabSwitch(tab)
      },
      { signal },
    )
    buttons.push(btn)
    container.append(btn)
  }

  container.addEventListener(
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
      requestTabSwitch(next.dataset.tab as ReadingTab)
    },
    { signal },
  )

  const sync = (view: ReadingTab, available: boolean) => {
    container.hidden = !available
    for (const btn of buttons) {
      const active = btn.dataset.tab === view
      btn.setAttribute("aria-selected", active ? "true" : "false")
      btn.tabIndex = active ? 0 : -1
    }
  }

  return { container, sync }
}

function setupBar() {
  removeBar()

  const slug = document.body.dataset.slug ?? ""
  if (!CHAPTER_SLUG.test(slug)) return
  const article = document.querySelector("article")
  if (!article) return

  const nav = findNavTable(article)
  // 判斷「已經捲過頁首」的參考點：優先看頁首流內的分頁列，其次上一章／下一章表格，最後退回章節標題
  const fallbackAnchor: Element | null = nav?.table ?? article.querySelector("h1")
  if (!fallbackAnchor) return

  const abort = new AbortController()
  const { signal } = abort

  const bar = document.createElement("nav")
  bar.className = BAR_CLASS
  bar.setAttribute("aria-label", "章節快捷列")

  const title = document.createElement("button")
  title.type = "button"
  title.className = `${BAR_CLASS}-title`
  title.textContent = chapterTitle(slug)
  title.setAttribute("aria-label", `${chapterTitle(slug)}，開啟書卷章節選單`)
  title.addEventListener("click", openPicker, { signal })
  bar.append(title)

  if (nav?.prev) bar.append(makeLink(`${BAR_CLASS}-prev`, "上一章", nav.prev, "‹"))
  if (nav?.next) bar.append(makeLink(`${BAR_CLASS}-next`, "下一章", nav.next, "›"))

  const tabs = makeTabSwitcher(signal)
  tabs.sync(currentTabFromDom(), document.documentElement.hasAttribute(TABS_ATTR))

  const guideBtn = makeButton(`${BAR_CLASS}-guide`, "目錄", "開啟本章導覽")
  guideBtn.setAttribute("aria-controls", "bwz-guide")
  guideBtn.setAttribute(
    "aria-expanded",
    document.documentElement.getAttribute(GUIDE_ATTR) === "open" ? "true" : "false",
  )
  guideBtn.hidden = !document.documentElement.hasAttribute(GUIDE_ATTR)
  guideBtn.addEventListener("click", () => requestGuideToggle(), { signal })

  const topBtn = makeButton(`${BAR_CLASS}-top`, "↑", "回到頂端")
  topBtn.title = "回到頂端"
  bar.append(tabs.container, guideBtn, topBtn)
  document.body.append(bar)

  const mql = window.matchMedia(MOBILE_QUERY)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const behavior = (): ScrollBehavior => ((reduce.matches ? "instant" : "smooth") as ScrollBehavior)

  document.addEventListener(
    TAB_CHANGE_EVENT,
    (event) => {
      const detail = (event as CustomEvent<TabChangeDetail>).detail
      if (!detail) return
      tabs.sync(detail.view, detail.available)
    },
    { signal },
  )

  document.addEventListener(
    GUIDE_STATE_EVENT,
    (event) => {
      const detail = (event as CustomEvent<GuideStateDetail>).detail
      if (!detail) return
      guideBtn.hidden = !detail.available
      guideBtn.setAttribute("aria-expanded", String(detail.open))
    },
    { signal },
  )

  topBtn.addEventListener(
    "click",
    () => {
      window.scrollTo({ top: 0, behavior: behavior() })
    },
    { signal },
  )

  let shown = false
  const update = () => {
    const anchor = article.querySelector(".bwz-tabs") ?? fallbackAnchor
    const want = mql.matches && anchor.getBoundingClientRect().bottom < stickyToolbarBottom()
    // 手機的工具列（選單、搜尋、Aa、深色）是 sticky 貼頂的；快捷列要排在它下面，不能蓋住它。
    // 朗讀列貼頂時再讓到兩者下面（custom.scss 用這兩個變數）。
    // 顯示期間每次捲動都重新量：視窗大小改變或字型晚載入時，工具列高度會變
    const root = document.documentElement.style
    if (want) {
      const top = stickyToolbarBottom()
      root.setProperty(TOP_VAR, `${top}px`)
      root.setProperty(HEIGHT_VAR, `${Math.ceil(top + bar.getBoundingClientRect().height)}px`)
    }
    if (want === shown) return
    shown = want
    bar.classList.toggle("is-shown", want)
    // 朗讀外掛會用 inline style 把朗讀列的 top 設成工具列高度；快捷列顯示時要由 CSS（!important）改成排在快捷列下面
    document.documentElement.classList.toggle(ON_CLASS, want)
    if (!want) {
      root.removeProperty(TOP_VAR)
      root.removeProperty(HEIGHT_VAR)
    }
  }

  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      ticking = false
      update()
    })
  }
  window.addEventListener("scroll", onScroll, { passive: true, signal })
  window.addEventListener("resize", onScroll, { passive: true, signal })
  mql.addEventListener("change", update, { signal })
  update()

  window.addCleanup?.(() => {
    abort.abort()
    removeBar()
  })
}

document.addEventListener("nav", setupBar)
