// 手機沒有左欄（左欄就是工具列＋☰ 抽屜），選擇器要出現在抽屜最上面。
// 同一個 DOM 節點依視窗寬度在「左欄的位置」和「抽屜頂端」之間搬移，不複製，所以不會有重複的 id。
import { MOBILE_QUERY } from "../pickerLogic"

const DRAWER_CLASS = "bwz-pk-in-drawer"

function place(picker: HTMLElement, slot: HTMLElement, mobile: boolean): void {
  const drawer = document.querySelector<HTMLElement>(".explorer-content")
  if (mobile && drawer) {
    if (picker.parentElement !== drawer) drawer.prepend(picker)
    drawer.classList.add(DRAWER_CLASS)
  } else {
    if (picker.parentElement !== slot) slot.append(picker)
    document.querySelector(`.${DRAWER_CLASS}`)?.classList.remove(DRAWER_CLASS)
  }
}

/** 依目前寬度擺好位置，之後視窗寬度改變也跟著搬；回傳的函式會把節點搬回左欄（換頁前先還原，頁面差異比對才不會困惑）。 */
export function initPlacement(picker: HTMLElement): () => void {
  const slot = picker.parentElement
  if (!slot) return () => {}
  const mql = window.matchMedia(MOBILE_QUERY)
  const update = () => place(picker, slot, mql.matches)
  update()
  mql.addEventListener("change", update)
  return () => {
    mql.removeEventListener("change", update)
    place(picker, slot, false)
  }
}
