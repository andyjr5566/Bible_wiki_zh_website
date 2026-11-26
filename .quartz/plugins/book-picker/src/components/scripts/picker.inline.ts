// 書卷選擇器的腳本入口：每次換頁（nav）重新初始化，全域監聽都由 addCleanup 在下次換頁前移除。
// 各項行為分在 lib/client/ 的小模組，這裡只負責接線。
import { initBookGrids } from "../../lib/client/bookGridBehavior"
import { initChapterEnd, removeChapterEnd } from "../../lib/client/chapterEnd"
import { isMobile, onDrawerToggle, openDrawer, scrollDrawerToTop } from "../../lib/client/drawer"
import { initPlacement } from "../../lib/client/pickerPlacement"
import { initModes, revealCurrentChapter, setBooksOpen } from "../../lib/client/pickerModes"
import { hideToast } from "../../lib/client/toast"
import { OPEN_PICKER_EVENT, type OpenPickerDetail } from "../../lib/pickerLogic"

interface QuartzWindow extends Window {
  addCleanup?: (fn: () => void) => void
}

function setup(): void {
  const cleanups: Array<() => void> = []
  const picker = document.querySelector<HTMLElement>(".bwz-picker")

  cleanups.push(initBookGrids())
  if (picker) {
    cleanups.push(initPlacement(picker))
    cleanups.push(initModes(picker))
    initChapterEnd(picker)
    cleanups.push(removeChapterEnd)

    const showPicker = (showBooks: boolean) => {
      if (showBooks) setBooksOpen(picker, true)
      if (isMobile()) scrollDrawerToTop()
      else picker.scrollIntoView({ block: "nearest" })
    }

    const onOpen = (event: Event) => {
      const detail = ((event as CustomEvent<OpenPickerDetail>).detail ?? {}) as OpenPickerDetail
      if (isMobile() && !openDrawer()) return
      showPicker(!!detail.showBooks)
      detail.handled = true
    }
    document.addEventListener(OPEN_PICKER_EVENT, onOpen)
    cleanups.push(() => document.removeEventListener(OPEN_PICKER_EVENT, onOpen))

    // 抽屜每次打開都回到最上面（選擇器），目前章露出來
    cleanups.push(
      onDrawerToggle(() => {
        scrollDrawerToTop()
        revealCurrentChapter(picker)
      }),
    )
  }

  cleanups.push(hideToast)
  ;(window as QuartzWindow).addCleanup?.(() => cleanups.forEach((fn) => fn()))
}

document.addEventListener("nav", setup)
