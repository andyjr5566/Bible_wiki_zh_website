// 記錄返回點（DOM 層）：點經文某一節或本章整理裡的站內連結、或在懸停預覽裡點連結離開時，把「從哪裡走的」存起來。
// 規則：linkRules.ts（哪些點擊算數）、pointForLink.ts（對應哪個返回點）、store.ts（存取）。
import { isInternalPageLink, isPlainLeftClick, popoverSourceValid, type TimedSource } from "./linkRules"
import { pointForLink } from "./pointForLink"
import { writeReturnPoint } from "./store"
import type { ReturnPoint } from "../../../../quartz/util/returnPoint"

function internalLinkOf(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>("a[href]")
  return link && link.classList.contains("internal") ? link : null
}

/** 開始記錄；回傳停止函式（換頁時由 window.addCleanup 呼叫）。 */
export function startRecording(): () => void {
  // 最近一次從哪個連結打開預覽（沒有點到經文或整理的連結時是 null）
  let hoverSource: TimedSource<ReturnPoint> | null = null

  const onOver = (event: MouseEvent) => {
    const link = internalLinkOf(event.target)
    // 滑進預覽本身不算新的來源，來源要留到點下去
    if (!link || link.closest(".popover")) return
    const point = pointForLink(link, Date.now())
    hoverSource = point ? { point, t: Date.now() } : null
  }

  const onClick = (event: MouseEvent) => {
    const link = internalLinkOf(event.target)
    if (!link || !isPlainLeftClick(event)) return
    if (!isInternalPageLink({ href: link.href, target: link.target, download: link.hasAttribute("download") }, location.href)) {
      return
    }
    const now = Date.now()
    if (link.closest(".popover")) {
      if (popoverSourceValid(hoverSource, now)) writeReturnPoint({ ...hoverSource.point, t: now })
      return
    }
    const point = pointForLink(link, now)
    if (point) writeReturnPoint(point)
  }

  // 捕獲階段：要在 Quartz 的換頁處理（會換掉頁面內容）之前先記下來源
  document.addEventListener("mouseover", onOver)
  document.addEventListener("click", onClick, true)
  return () => {
    document.removeEventListener("mouseover", onOver)
    document.removeEventListener("click", onClick, true)
  }
}
