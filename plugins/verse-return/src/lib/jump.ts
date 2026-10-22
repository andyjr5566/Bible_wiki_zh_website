// 按「↩ 返回」換頁後，捲到那一節或那個標題並短暫標示（DOM 層）。
// 換頁後圖片、折疊段落還在載入，頁高會變，所以和首頁「繼續閱讀」一樣等頁高穩定再收手（時機規則 quartz/util/restorePlan.ts）；
// 位置算法在 scrollPlan.ts。目標找不到（內容改版、章節沒有那一節）就停在頁首，不丟錯。
import { readChapterDom } from "../../../../quartz/util/chapterDom"
import { RESTORE_POLL_MS, restoreAction } from "../../../../quartz/util/restorePlan"
import { requestReveal } from "../../../../quartz/util/revealEvent"
import type { ReturnPoint } from "../../../../quartz/util/returnPoint"
import { centerScrollTop, headingScrollTop, type ScrollContext } from "./scrollPlan"

export const FLASH_CLASS = "bwz-vr-flash"
const FLASH_MS = 2600
// 讀者自己動手（滾輪、觸控、按鍵）就立刻放棄，不跟讀者搶捲動。
const USER_INPUT_EVENTS = ["wheel", "touchstart", "keydown", "mousedown"] as const

export interface JumpHandle {
  cancel(): void
}

// 手機版左欄才是貼頂的工具列；桌機的左欄是整條側欄（sticky、高度等於視窗），
// 若也量它的下緣會得到「整個視窗都被遮住」，目標就永遠算成捲到 0。章節快捷列同樣只在手機出現（見 chapterQuickBar.inline.ts）。
const MOBILE_QUERY = "(max-width: 800px)"

/** 手機黏在頂端的工具列與章節快捷列佔掉的高度（桌機沒有，回傳 0）。 */
function topObstruction(): number {
  if (!window.matchMedia(MOBILE_QUERY).matches) return 0
  let total = 0
  const toolbar = document.querySelector<HTMLElement>(".sidebar.left")
  if (toolbar) {
    const position = getComputedStyle(toolbar).position
    if (position === "sticky" || position === "fixed") {
      total += Math.max(0, Math.round(toolbar.getBoundingClientRect().bottom))
    }
  }
  // 快捷列在捲過頁首後才浮出來；先算進去，捲到位後標題才不會被它蓋住
  const bar = document.querySelector<HTMLElement>(".bwz-cqb")
  if (bar) total += bar.offsetHeight
  return total
}

function context(): ScrollContext {
  return { scrollY: window.scrollY, viewportHeight: window.innerHeight, topObstruction: topObstruction() }
}

function verseElement(verse: number): HTMLElement | null {
  const dom = readChapterDom()
  if (!dom) return null
  const items = Array.from(dom.verseList.children).filter((c) => c.tagName.toLowerCase() === "li")
  const start = Number.isInteger(dom.verseList.start) ? dom.verseList.start : 1
  return (items[verse - start] as HTMLElement | undefined) ?? null
}

interface Target {
  el: HTMLElement
  scrollTop: number
}

function resolveTarget(point: ReturnPoint): Target | null {
  if (point.kind === "verse") {
    const el = verseElement(point.verse)
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return { el, scrollTop: centerScrollTop({ top: rect.top, height: rect.height }, context()) }
  }
  // 純經文模式把整理藏起來時，請 site-ux 先暫時顯示（沒人處理就是本來就看得到）
  requestReveal(point.headingId)
  const el = document.getElementById(point.headingId)
  if (!el) return null
  return { el, scrollTop: headingScrollTop({ top: el.getBoundingClientRect().top, height: 0 }, context()) }
}

export function startJump(point: ReturnPoint): JumpHandle {
  let done = false
  let timer = 0
  const startedAt = Date.now()
  let lastHeight: number | undefined
  let lastChangeAt = startedAt

  const scrollToTarget = (): Target | null => {
    const target = resolveTarget(point)
    // 網站的 CSS 預設是平滑捲動；要瞬間到位，才不會被後面的補捲打斷。
    if (target) window.scrollTo({ top: target.scrollTop, behavior: "instant" })
    return target
  }

  const finish = () => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    for (const name of USER_INPUT_EVENTS) window.removeEventListener(name, finish)
  }

  const flash = (el: HTMLElement) => {
    el.classList.add(FLASH_CLASS)
    window.setTimeout(() => el.classList.remove(FLASH_CLASS), FLASH_MS)
  }

  const tick = () => {
    if (done) return
    const now = Date.now()
    const height = document.documentElement.scrollHeight
    const action = restoreAction({ now, startedAt, height, lastHeight, lastChangeAt })
    if (action === "done") {
      // 頁高穩定了：最後對準一次，才標示（太早標示的話，標示會在後面的補捲之前就演完）
      const target = scrollToTarget()
      if (target) flash(target.el)
      finish()
      return
    }
    if (action === "apply") {
      if (height !== lastHeight) lastChangeAt = now
      lastHeight = height
      scrollToTarget()
    }
    timer = window.setTimeout(tick, RESTORE_POLL_MS)
  }

  for (const name of USER_INPUT_EVENTS) window.addEventListener(name, finish, { passive: true })
  tick()
  return { cancel: finish }
}
