// 記錄返回點（DOM 層）：點經文某一節或本章整理裡的站內連結、或在懸停預覽裡點連結離開時，把「從哪裡走的」存起來。
// 同時記「條目落點」：從章節頁文章裡的任何站內連結離開時記下來源章節，條目頁據此顯示「↓ 某章的相關內容」。
// 規則：linkRules.ts（哪些點擊算數）、pointForLink.ts（對應哪個返回點）、quartz/util/entryLanding.ts（落點）、store.ts（存取）。
import { parseBookSlug } from "../../../../quartz/util/bookCatalog"
import { canonicalSlugPath } from "../../../../quartz/util/bibleBooks"
import { makeEntryLanding } from "../../../../quartz/util/entryLanding"
import type { ReturnPoint } from "../../../../quartz/util/returnPoint"
import { isInternalPageLink, isPlainLeftClick, popoverSourceValid, type TimedSource } from "./linkRules"
import { pointForLink } from "./pointForLink"
import { writeEntryLanding, writeReturnPoint } from "./store"

function internalLinkOf(target: EventTarget | null): HTMLAnchorElement | null {
  if (!(target instanceof Element)) return null
  const link = target.closest<HTMLAnchorElement>("a[href]")
  return link && link.classList.contains("internal") ? link : null
}

function slugForLink(link: HTMLAnchorElement): string {
  if (link.dataset.slug) return link.dataset.slug

  try {
    let slug = canonicalSlugPath(new URL(link.href, location.href).pathname)
    const basepath = canonicalSlugPath(document.body.dataset.basepath ?? "")
    if (basepath && slug.startsWith(basepath + "/")) slug = slug.slice(basepath.length + 1)
    return slug
  } catch {
    return ""
  }
}

function saveEntryLanding(fromSlug: string, toSlug: string, now: number): void {
  const landing = makeEntryLanding(fromSlug, toSlug, now)
  if (landing) writeEntryLanding(landing)
}

/** 開始記錄；回傳停止函式（換頁時由 window.addCleanup 呼叫）。 */
export function startRecording(): () => void {
  // 最近一次從哪個連結打開預覽（沒有點到經文或整理的連結時是 null）
  let hoverSource: TimedSource<ReturnPoint> | null = null
  // 同上，給條目落點用：只要是章節頁文章裡的連結就算
  let hoverLandingSource: TimedSource<{ fromSlug: string }> | null = null

  const onOver = (event: MouseEvent) => {
    const link = internalLinkOf(event.target)
    // 滑進預覽本身不算新的來源，來源要留到點下去
    if (!link || link.closest(".popover")) return

    const now = Date.now()
    const point = pointForLink(link, now)
    hoverSource = point ? { point, t: now } : null

    const fromSlug = document.body.dataset.slug ?? ""
    hoverLandingSource =
      link.closest("article") && parseBookSlug(fromSlug)?.kind === "chapter"
        ? { point: { fromSlug }, t: now }
        : null
  }

  const onClick = (event: MouseEvent) => {
    const link = internalLinkOf(event.target)
    if (!link || !isPlainLeftClick(event)) return
    if (!isInternalPageLink({ href: link.href, target: link.target, download: link.hasAttribute("download") }, location.href)) {
      return
    }

    const now = Date.now()
    const toSlug = slugForLink(link)
    if (link.closest(".popover")) {
      if (popoverSourceValid(hoverSource, now)) writeReturnPoint({ ...hoverSource.point, t: now })
      if (popoverSourceValid(hoverLandingSource, now)) {
        saveEntryLanding(hoverLandingSource.point.fromSlug, toSlug, now)
      }
      return
    }

    const point = pointForLink(link, now)
    if (point) writeReturnPoint(point)

    const fromSlug = document.body.dataset.slug ?? ""
    if (link.closest("article") && parseBookSlug(fromSlug)?.kind === "chapter") {
      saveEntryLanding(fromSlug, toSlug, now)
    }
  }

  // 捕獲階段：要在 Quartz 的換頁處理（會換掉頁面內容）之前先記下來源
  document.addEventListener("mouseover", onOver)
  document.addEventListener("click", onClick, true)
  return () => {
    document.removeEventListener("mouseover", onOver)
    document.removeEventListener("click", onClick, true)
  }
}
