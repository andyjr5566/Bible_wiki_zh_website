// 「回到剛才的經節」：每次換頁（nav）時決定要不要顯示「↩ 返回」按鈕、要不要記錄、要不要捲動。
// 各件事的規則在 ../../lib（linkRules、pointForLink、store、scrollPlan），這個檔案只負責接起來。
import { canonicalSlugPath } from "../../../../../quartz/util/bibleBooks"
import { returnHref, shouldClearOnPage, type ReturnPoint } from "../../../../../quartz/util/returnPoint"
import { mountButton, removeButton } from "../../lib/button"
import { startJump, type JumpHandle } from "../../lib/jump"
import { startRecording } from "../../lib/recorder"
import { clearReturnPoint, readReturnPoint } from "../../lib/store"

interface RouterWindow extends Window {
  spaNavigate?: (url: URL, isBack?: boolean) => Promise<void>
  addCleanup?: (fn: () => void) => void
}

// 按下按鈕到換頁完成之間，要記得「這次要捲到哪裡」。只放記憶體：一般換頁不會有，所以不會被捲動。
let pendingJump: ReturnPoint | null = null
let jump: JumpHandle | null = null

function goBack(point: ReturnPoint): void {
  clearReturnPoint()
  removeButton()
  const url = new URL(returnHref(point, document.body.dataset.basepath ?? ""), location.href)
  const win = window as RouterWindow
  if (!win.spaNavigate) {
    location.assign(url)
    return
  }
  pendingJump = point
  // 換頁完成（nav 已發出）後旗標就不該留著，免得之後手動打開同一章被捲動
  win.spaNavigate(url).finally(() => {
    pendingJump = null
  })
}

function onNav(): void {
  const win = window as RouterWindow
  jump?.cancel()
  jump = null
  removeButton()
  const slug = document.body.dataset.slug ?? ""

  if (pendingJump) {
    const target = pendingJump
    pendingJump = null
    if (canonicalSlugPath(target.slug) === canonicalSlugPath(slug)) jump = startJump(target)
  }

  let point = readReturnPoint()
  if (point && shouldClearOnPage(point, slug)) {
    clearReturnPoint()
    point = null
  }
  if (point) {
    const shown = point
    const unmount = mountButton(shown, {
      onGo: () => goBack(shown),
      onClose: () => {
        clearReturnPoint()
        unmount()
      },
    })
    win.addCleanup?.(unmount)
  }

  const stopRecording = startRecording()
  win.addCleanup?.(() => {
    stopRecording()
    jump?.cancel()
  })
}

document.addEventListener("nav", onNav)
