// 章節頁的閱讀位置記錄（薄 DOM 層）：何時該存由 shouldSave 決定，存什麼由 readingStorage／readingPosition 決定。
// 觸發時機：捲動（節流）、頁面變成背景（切分頁、手機鎖屏）、關閉頁面、SPA 換頁前。
import { parseBookSlug } from "../../../../quartz/util/bookCatalog"
import { ratioFromScroll, shouldSave } from "../../../../quartz/util/readingPosition"
import { applyReadingOrder } from "./readingOrder"
import { saveReading } from "./readingStorage"

export interface RecorderOptions {
  /** 回傳 true 時暫停記錄（正在捲回上次位置，頁面還沒到位）。 */
  suspended?: () => boolean
}

interface QuartzWindow extends Window {
  addCleanup?: (fn: () => void) => void
}

/** 只有「章節頁」要記；書卷目錄、導論、條目頁都不記。回傳停止記錄的函式。 */
export function startRecording(slug: string, options: RecorderOptions = {}): () => void {
  if (parseBookSlug(slug)?.kind !== "chapter") return () => {}

  let prevRatio: number | undefined
  let lastSavedAt = 0

  const save = (force: boolean) => {
    if (options.suspended?.()) return
    const ratio = ratioFromScroll(window.scrollY, document.documentElement.scrollHeight, window.innerHeight)
    const now = Date.now()
    if (!force && !shouldSave({ prevRatio, ratio, now, lastSavedAt })) return
    if (!saveReading({ slug, ratio, t: now })) return
    prevRatio = ratio
    lastSavedAt = now
    // 第一筆紀錄出現後，之後回到首頁的順序就要變成「入口在上」
    applyReadingOrder()
  }

  const onScroll = () => save(false)
  const onVisibility = () => {
    if (document.visibilityState === "hidden") save(true)
  }
  const onForce = () => save(true)

  window.addEventListener("scroll", onScroll, { passive: true })
  document.addEventListener("visibilitychange", onVisibility)
  window.addEventListener("pagehide", onForce)
  document.addEventListener("prenav", onForce)

  const stop = () => {
    window.removeEventListener("scroll", onScroll)
    document.removeEventListener("visibilitychange", onVisibility)
    window.removeEventListener("pagehide", onForce)
    document.removeEventListener("prenav", onForce)
  }
  // prenav 的處理函式會先跑，Quartz 才執行清理，所以換頁前的最後一次記錄不會漏
  ;(window as QuartzWindow).addCleanup?.(stop)
  return stop
}
