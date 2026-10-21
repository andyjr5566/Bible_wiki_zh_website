// chapterQuickBar.inline.ts
// 聖經研讀知識庫 - 手機版章節快捷列（B3-4）
//
// 章節頁（slug 形如 01-創世記/第2章）往下捲過頁首的「前一章｜回目錄｜下一章」表格後，
// 畫面頂端浮出一條細快捷列：書卷章名、上一章、下一章、本章整理、回到頂端。捲回頂端就收起。
// 只在手機寬度（<= 800px）出現；桌機有左側目錄與右側目錄，不需要。
// 其他頁面不做任何事；找不到表格或「本章整理」時，對應的按鈕就不顯示。
//
// 另外：手機的探索抽屜每次打開時，把目前章節捲到抽屜中間（explorer 外掛只在畫面建好時捲一次，
// 抽屜那時還是隱藏的，之後換頁又會還原上一頁的捲動位置，所以停在別的地方）。

const CHAPTER_SLUG = /^\d+-[^/]+\/第\d+章$/
const MOBILE_QUERY = "(max-width: 800px)"
const BAR_CLASS = "bwz-cqb"
const HEIGHT_VAR = "--bwz-cqb-h"
const TOP_VAR = "--bwz-cqb-top"

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

/** 「本章整理」：先找 h2，再找已被折疊成 <details> 的區塊標題 */
function findSummaryTarget(article: Element): HTMLElement | null {
  const h2 = Array.from(article.querySelectorAll<HTMLElement>("h2")).find((h) =>
    (h.textContent ?? "").trim().startsWith("本章整理"),
  )
  if (h2) return h2
  const title = Array.from(
    article.querySelectorAll<HTMLElement>("details.collapsible-section > summary .collapsible-title"),
  ).find((t) => (t.textContent ?? "").trim().startsWith("本章整理"))
  return (title?.closest("summary") as HTMLElement | null) ?? null
}

function removeBar() {
  document.querySelectorAll(`.${BAR_CLASS}`).forEach((el) => el.remove())
  document.documentElement.style.removeProperty(HEIGHT_VAR)
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

function setupBar() {
  removeBar()

  const slug = document.body.dataset.slug ?? ""
  if (!CHAPTER_SLUG.test(slug)) return
  const article = document.querySelector("article")
  if (!article) return

  const nav = findNavTable(article)
  // 判斷「已經捲過頁首」的參考點：上一章／下一章表格；沒有表格就用章節標題
  const anchor: Element | null = nav?.table ?? article.querySelector("h1")
  if (!anchor) return

  const bar = document.createElement("nav")
  bar.className = BAR_CLASS
  bar.setAttribute("aria-label", "章節快捷列")

  const title = document.createElement("span")
  title.className = `${BAR_CLASS}-title`
  title.textContent = chapterTitle(slug)
  bar.append(title)

  if (nav?.prev) bar.append(makeLink(`${BAR_CLASS}-prev`, "上一章", nav.prev, "‹"))
  if (nav?.next) bar.append(makeLink(`${BAR_CLASS}-next`, "下一章", nav.next, "›"))

  const summaryBtn = makeButton(`${BAR_CLASS}-summary`, "本章整理")
  const topBtn = makeButton(`${BAR_CLASS}-top`, "↑", "回到頂端")
  topBtn.title = "回到頂端"
  bar.append(summaryBtn, topBtn)
  document.body.append(bar)

  const mql = window.matchMedia(MOBILE_QUERY)
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const behavior = (): ScrollBehavior => ((reduce.matches ? "instant" : "smooth") as ScrollBehavior)

  const refreshSummaryButton = () => {
    summaryBtn.hidden = !findSummaryTarget(article)
  }
  refreshSummaryButton()
  // 折疊區塊是 nav 之後才在用戶端建起來的，稍後再確認一次
  const timers = [setTimeout(refreshSummaryButton, 500), setTimeout(refreshSummaryButton, 1800)]

  summaryBtn.addEventListener("click", () => {
    const target = findSummaryTarget(article)
    if (!target) return
    const details = target.closest("details")
    if (details) details.open = true
    const top = target.getBoundingClientRect().top + window.scrollY - stickyToolbarBottom() - bar.offsetHeight - 12
    window.scrollTo({ top: Math.max(0, top), behavior: behavior() })
  })
  topBtn.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: behavior() })
  })

  let shown = false
  const update = () => {
    const want = mql.matches && anchor.getBoundingClientRect().bottom < 0
    if (want === shown) return
    shown = want
    bar.classList.toggle("is-shown", want)
    // 手機的工具列（選單、搜尋、Aa、深色）是 sticky 貼頂的；快捷列要排在它下面，不能蓋住它。
    // 朗讀列貼頂時再讓到兩者下面（custom.scss 用這兩個變數）
    const root = document.documentElement.style
    if (want) {
      const top = stickyToolbarBottom()
      root.setProperty(TOP_VAR, `${top}px`)
      root.setProperty(HEIGHT_VAR, `${top + bar.offsetHeight}px`)
    } else {
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
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll, { passive: true })
  mql.addEventListener("change", update)
  update()

  window.addCleanup?.(() => {
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    mql.removeEventListener("change", update)
    timers.forEach(clearTimeout)
    removeBar()
  })
}

document.addEventListener("nav", setupBar)

// ---- 手機探索抽屜：打開時把目前章節捲到中間 ----
const drawerWindow = window as Window & { __bwzDrawerRevealBound?: boolean }
if (!drawerWindow.__bwzDrawerRevealBound) {
  drawerWindow.__bwzDrawerRevealBound = true

  const reveal = (explorer: Element) => {
    if (explorer.classList.contains("collapsed")) return
    const list = explorer.querySelector<HTMLElement>(".explorer-ul")
    const active = list?.querySelector<HTMLElement>("a.active")
    if (!list || !active) return
    const listRect = list.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    if (listRect.height === 0) return
    // 只動清單自己的捲動位置，不用 scrollIntoView（它會連整個頁面一起捲）
    list.scrollTop += activeRect.top - listRect.top - (listRect.height - activeRect.height) / 2
  }

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof Element)) return
    const toggle = event.target.closest(".explorer-toggle.mobile-explorer")
    const explorer = toggle?.closest(".explorer")
    if (!explorer) return
    // 外掛的點擊處理先切換 collapsed，下一個畫面再量位置
    requestAnimationFrame(() => requestAnimationFrame(() => reveal(explorer)))
  })
}
