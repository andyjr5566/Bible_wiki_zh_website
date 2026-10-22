// 按「繼續」換頁後，捲到上次的位置。公式和記錄時相同（scrollFromRatio 對應 ratioFromScroll），
// 所以不需要另外扣掉黏在頂端的工具列高度。這裡是薄薄的 DOM 層：規則與計算在 quartz/util/readingPosition.ts，
// 「何時再捲一次」在 restorePlan.ts。
import { scrollFromRatio } from "../../../../quartz/util/readingPosition"
import { RESTORE_POLL_MS, restoreAction } from "./restorePlan"

// 讀者自己動手（滾輪、觸控、按鍵）就立刻放棄，不跟讀者搶捲動。
const USER_INPUT_EVENTS = ["wheel", "touchstart", "keydown", "mousedown"] as const

export interface RestoreHandle {
  /** 還在還原中：這段時間頁面還停在「還沒捲到」的位置，不可以把它記成新的閱讀位置。 */
  active(): boolean
  cancel(): void
}

export function restoreScroll(ratio: number): RestoreHandle {
  let done = false
  let timer = 0
  const startedAt = Date.now()
  let lastHeight: number | undefined
  let lastChangeAt = startedAt

  const finish = () => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    for (const name of USER_INPUT_EVENTS) window.removeEventListener(name, finish)
  }

  const tick = () => {
    if (done) return
    const now = Date.now()
    const height = document.documentElement.scrollHeight
    const action = restoreAction({ now, startedAt, height, lastHeight, lastChangeAt })
    if (action === "done") return finish()
    if (action === "apply") {
      if (height !== lastHeight) lastChangeAt = now
      lastHeight = height
      // 網站的 CSS 預設是平滑捲動；還原要瞬間到位，才不會被後面的補捲打斷。
      window.scrollTo({ top: scrollFromRatio(ratio, height, window.innerHeight), behavior: "instant" })
    }
    timer = window.setTimeout(tick, RESTORE_POLL_MS)
  }

  for (const name of USER_INPUT_EVENTS) window.addEventListener(name, finish, { passive: true })
  tick()

  return { active: () => !done, cancel: finish }
}
