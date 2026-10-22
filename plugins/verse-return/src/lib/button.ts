// 「↩ 返回」浮動按鈕（DOM 層）：文字與朗讀文字由 quartz/util/returnPoint.ts 決定，這裡只負責畫與擺位置。
// 位置：桌機在中欄底部置中、手機在左下「筆記」與右下「?」那一排的上面（CSS 見 verseReturn.scss）。
import { returnAriaLabel, returnLabel, type ReturnPoint } from "../../../../quartz/util/returnPoint"

export const BUTTON_CLASS = "bwz-vr"
// 超過這個寬度才是三欄版面；窄一點時中欄幾乎佔滿，改用手機的擺法比較安全
const CENTER_QUERY = "(min-width: 1201px)"

export interface ButtonHandlers {
  onGo(): void
  onClose(): void
}

export function removeButton(): void {
  for (const el of Array.from(document.querySelectorAll(`.${BUTTON_CLASS}`))) el.remove()
}

/** 桌機：用中欄的位置與寬度擺（左右欄與右下「?」都不會被蓋到）；手機：整排置中，由 CSS 處理。 */
function placeOverCenterColumn(root: HTMLElement): void {
  const center = document.querySelector<HTMLElement>(".page > #quartz-body > .center")
  if (!window.matchMedia(CENTER_QUERY).matches || !center) {
    root.style.removeProperty("--bwz-vr-left")
    root.style.removeProperty("--bwz-vr-width")
    return
  }
  const rect = center.getBoundingClientRect()
  root.style.setProperty("--bwz-vr-left", `${Math.round(rect.left)}px`)
  root.style.setProperty("--bwz-vr-width", `${Math.round(rect.width)}px`)
}

/** 掛上按鈕；回傳移除函式。 */
export function mountButton(point: ReturnPoint, handlers: ButtonHandlers): () => void {
  removeButton()
  const root = document.createElement("div")
  root.className = BUTTON_CLASS

  const go = document.createElement("button")
  go.type = "button"
  go.className = `${BUTTON_CLASS}-go`
  go.textContent = returnLabel(point)
  go.setAttribute("aria-label", returnAriaLabel(point))
  go.addEventListener("click", handlers.onGo)

  const close = document.createElement("button")
  close.type = "button"
  close.className = `${BUTTON_CLASS}-x`
  close.textContent = "×"
  close.setAttribute("aria-label", "關閉返回按鈕")
  close.addEventListener("click", handlers.onClose)

  root.append(go, close)
  document.body.append(root)

  const place = () => placeOverCenterColumn(root)
  place()
  window.addEventListener("resize", place)
  return () => {
    window.removeEventListener("resize", place)
    root.remove()
  }
}
