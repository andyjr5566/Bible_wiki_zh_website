// interactiveRail.inline.ts
// 聖經研讀知識庫 - 互動網站總入口的書卷列
//
// 總入口的長軸依聖經順序排，網站越多頁面越長。軸上方有一條跟著捲動的書卷列（interactiveHast.ts 建置時產生，
// 純連結，沒有腳本也能跳）。這裡補四件事：
// 1. 點書卷：平滑捲到該卷的標題，並讓標題停在書卷列下方（手機還要再讓開貼頂的工具列）。
// 2. 捲動高亮：目前捲到哪一卷，那個按鈕就亮起來並展開成全名；長列在小螢幕上會橫向捲動，高亮的按鈕自動捲進視野。
// 3. 「全部」按鈕：書卷多到一列放不下時，列的最右邊出現按鈕，點開是一個面板，所有書卷以全名排好，一點就到。
//    （放不下的列只能橫向捲，滑鼠用戶沒有手勢可用，所以不靠橫捲，也不拿滾輪去橫捲，那樣太不直觀。）
// 4. 吸頂位置：手機左欄（工具列）是 position: sticky 貼頂，書卷列要排在它下面；位置寫進 --bwz-ia-top 給 CSS 用。
// 其他頁面找不到書卷列，什麼都不做。

const RAIL = ".bwz-ia-rail"
const CHIP = ".bwz-ia-rail-chip"
const PANEL_CLASS = "bwz-ia-rail-panel"
const ALL_CLASS = "bwz-ia-rail-all"
const RAIL_TOP_VAR = "--bwz-ia-top"
// 標題和書卷列之間留的空隙（px）
const GAP = 12
// 手機（左欄變成貼頂工具列）的寬度；和 chapterQuickBar.inline.ts 一致
const RAIL_MOBILE_QUERY = "(max-width: 800px)"

// 手機版貼頂工具列目前的下緣，沒有貼頂就是 0。
// 只在手機寬度才算：桌機的左欄是整欄貼頂的側邊欄（高度等於視窗），下緣就是視窗底，
// 當成工具列會把書卷列推到畫面最下面。
function toolbarBottom(): number {
  if (!window.matchMedia(RAIL_MOBILE_QUERY).matches) return 0
  const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
  if (!toolbar) return 0
  const pos = getComputedStyle(toolbar).position
  if (pos !== "sticky" && pos !== "fixed") return 0
  return Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
}

function setupRail() {
  const rail = document.querySelector<HTMLElement>(RAIL)
  const strip = rail?.querySelector<HTMLElement>("ol")
  if (!rail || !strip) return

  const chips = Array.from(strip.querySelectorAll<HTMLAnchorElement>(CHIP))
  const targets = chips.map((chip) => {
    const id = chip.getAttribute("href")?.slice(1) ?? ""
    return document.getElementById(id)
  })
  if (!chips.length || targets.some((target) => !target)) return

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  const behavior = (): ScrollBehavior => (reduce.matches ? "auto" : "smooth")

  // 「全部」面板：複製一份書卷連結，面板裡每顆都顯示全名（樣式見 interactive.scss）
  const panel = document.createElement("div")
  panel.className = PANEL_CLASS
  panel.id = "bwz-ia-rail-panel"
  panel.hidden = true
  const panelList = document.createElement("ul")
  chips.forEach((chip) => {
    const item = document.createElement("li")
    item.append(chip.cloneNode(true))
    panelList.append(item)
  })
  panel.append(panelList)

  const allBtn = document.createElement("button")
  allBtn.type = "button"
  allBtn.className = ALL_CLASS
  allBtn.hidden = true
  allBtn.textContent = "全部"
  allBtn.setAttribute("aria-expanded", "false")
  allBtn.setAttribute("aria-controls", panel.id)
  allBtn.setAttribute("aria-label", "全部書卷")
  rail.append(allBtn, panel)

  const panelChips = Array.from(panel.querySelectorAll<HTMLAnchorElement>(CHIP))
  const pairs = (index: number) => [chips[index], panelChips[index]]

  const setPanel = (open: boolean) => {
    panel.hidden = !open
    allBtn.setAttribute("aria-expanded", String(open))
  }

  /** 書卷標題要停的位置：工具列下緣＋書卷列高度＋一點空隙 */
  const offset = () => toolbarBottom() + rail.offsetHeight + GAP

  let activeIndex = -1
  const setActive = (index: number) => {
    if (index === activeIndex) return
    if (activeIndex >= 0) pairs(activeIndex).forEach((chip) => chip.removeAttribute("aria-current"))
    activeIndex = index
    if (index < 0) return
    pairs(index).forEach((chip) => chip.setAttribute("aria-current", "true"))
    // 只捲書卷列本身；scrollIntoView 會連整頁一起捲，使用者正在往下滑時會被拉住
    const chip = chips[index]
    const left = chip.offsetLeft - (strip.clientWidth - chip.offsetWidth) / 2
    strip.scrollTo({ left: Math.max(0, left), behavior: behavior() })
  }

  const update = () => {
    rail.style.setProperty(RAIL_TOP_VAR, `${toolbarBottom()}px`)
    // 一列放得下就不需要「全部」
    const overflow = strip.scrollWidth > strip.clientWidth + 1
    allBtn.hidden = !overflow
    if (!overflow) setPanel(false)
    const probe = offset() + 1
    let found = -1
    targets.forEach((target, i) => {
      if (target!.getBoundingClientRect().top <= probe) found = i
    })
    setActive(found)
  }

  const onClick = (event: MouseEvent) => {
    const chip = (event.target as Element).closest<HTMLAnchorElement>(CHIP)
    if (!chip) return
    const index = chips.indexOf(chip) >= 0 ? chips.indexOf(chip) : panelChips.indexOf(chip)
    const target = targets[index]
    if (!target) return
    event.preventDefault()
    setPanel(false)
    const top = target.getBoundingClientRect().top + window.scrollY - offset()
    window.scrollTo({ top: Math.max(0, top), behavior: behavior() })
  }

  const onAllClick = () => setPanel(panel.hidden)
  const onDocClick = (event: MouseEvent) => {
    if (!panel.hidden && !rail.contains(event.target as Node)) setPanel(false)
  }
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || panel.hidden) return
    setPanel(false)
    allBtn.focus()
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

  rail.addEventListener("click", onClick)
  allBtn.addEventListener("click", onAllClick)
  document.addEventListener("click", onDocClick)
  document.addEventListener("keydown", onKey)
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll, { passive: true })
  update()

  window.addCleanup?.(() => {
    rail.removeEventListener("click", onClick)
    allBtn.removeEventListener("click", onAllClick)
    document.removeEventListener("click", onDocClick)
    document.removeEventListener("keydown", onKey)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    rail.style.removeProperty(RAIL_TOP_VAR)
    allBtn.remove()
    panel.remove()
  })
}

document.addEventListener("nav", setupRail)
