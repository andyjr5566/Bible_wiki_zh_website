// interactiveRail.inline.ts
// 聖經研讀知識庫 - 互動網站總入口的書卷列
//
// 總入口的長軸依聖經順序排，網站越多頁面越長。軸上方有一條跟著捲動的書卷列（interactiveHast.ts 建置時產生，
// 純連結，沒有腳本也能跳）。這裡補三件事：
// 1. 點書卷：平滑捲到該卷的標題，並讓標題停在書卷列下方（手機還要再讓開貼頂的工具列）。
// 2. 捲動高亮：目前捲到哪一卷，那個按鈕就亮起來並展開成全名；長列在小螢幕上會橫向捲動，高亮的按鈕自動捲進視野。
// 3. 吸頂位置：手機左欄（工具列）是 position: sticky 貼頂，書卷列要排在它下面；位置寫進 --bwz-ia-top 給 CSS 用。
// 其他頁面找不到書卷列，什麼都不做。

const RAIL = ".bwz-ia-rail"
const CHIP = ".bwz-ia-rail-chip"
const RAIL_TOP_VAR = "--bwz-ia-top"
// 標題和書卷列之間留的空隙（px）
const GAP = 12

// 和 chapterQuickBar.inline.ts 相同：貼頂的工具列目前的下緣，沒有貼頂就是 0
function toolbarBottom(): number {
  const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
  if (!toolbar) return 0
  const pos = getComputedStyle(toolbar).position
  if (pos !== "sticky" && pos !== "fixed") return 0
  return Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
}

function setupRail() {
  const rail = document.querySelector<HTMLElement>(RAIL)
  if (!rail) return

  const chips = Array.from(rail.querySelectorAll<HTMLAnchorElement>(CHIP))
  const targets = chips.map((chip) => {
    const id = chip.getAttribute("href")?.slice(1) ?? ""
    return document.getElementById(id)
  })
  if (!chips.length || targets.some((target) => !target)) return

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)")
  let activeIndex = -1

  /** 書卷標題要停的位置：工具列下緣＋書卷列高度＋一點空隙 */
  const offset = () => toolbarBottom() + rail.offsetHeight + GAP

  const setActive = (index: number) => {
    if (index === activeIndex) return
    if (activeIndex >= 0) chips[activeIndex].removeAttribute("aria-current")
    activeIndex = index
    if (index < 0) return
    const chip = chips[index]
    chip.setAttribute("aria-current", "true")
    // 只捲書卷列本身；scrollIntoView 會連整頁一起捲，使用者正在往下滑時會被拉住
    const left = chip.offsetLeft - (rail.clientWidth - chip.offsetWidth) / 2
    rail.scrollTo({ left: Math.max(0, left), behavior: reduce.matches ? "auto" : "smooth" })
  }

  const update = () => {
    rail.style.setProperty(RAIL_TOP_VAR, `${toolbarBottom()}px`)
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
    const target = targets[chips.indexOf(chip)]
    if (!target) return
    event.preventDefault()
    const top = target.getBoundingClientRect().top + window.scrollY - offset()
    window.scrollTo({ top: Math.max(0, top), behavior: reduce.matches ? "auto" : "smooth" })
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
  window.addEventListener("scroll", onScroll, { passive: true })
  window.addEventListener("resize", onScroll, { passive: true })
  update()

  window.addCleanup?.(() => {
    rail.removeEventListener("click", onClick)
    window.removeEventListener("scroll", onScroll)
    window.removeEventListener("resize", onScroll)
    rail.style.removeProperty(RAIL_TOP_VAR)
  })
}

document.addEventListener("nav", setupRail)
