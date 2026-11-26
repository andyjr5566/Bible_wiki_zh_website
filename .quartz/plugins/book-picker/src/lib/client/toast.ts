// 畫面下方短暫提示（role="status"，約 3 秒消失）。
// 先放進空的 status 區再填字：螢幕閱讀器只會念「在已存在的區塊裡改變的文字」。
export const TOAST_MS = 3000
const TOAST_CLASS = "bwz-toast"

let timer: number | undefined

export function hideToast(): void {
  window.clearTimeout(timer)
  document.querySelectorAll(`.${TOAST_CLASS}`).forEach((el) => el.remove())
}

export function showToast(text: string): void {
  hideToast()
  const el = document.createElement("div")
  el.className = TOAST_CLASS
  el.setAttribute("role", "status")
  document.body.append(el)
  requestAnimationFrame(() => {
    el.textContent = text
  })
  timer = window.setTimeout(hideToast, TOAST_MS)
}
