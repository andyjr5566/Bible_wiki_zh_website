// 左欄選擇器的展開／收起：book 版面按「換卷」、home 版面按「書卷 ▸」。
// 其他頁的書卷格子本來就是展開的，沒有按鈕。狀態不記住（U-22：每頁照規則）。
import { scrollTopToReveal } from "../pickerLogic"

export function isBooksOpen(picker: HTMLElement): boolean {
  return picker.classList.contains("is-books-open")
}

export function setBooksOpen(picker: HTMLElement, open: boolean): void {
  const books = picker.querySelector<HTMLElement>(".bwz-pk-books")
  if (!books || picker.dataset.mode === "other") return
  books.hidden = !open
  picker.classList.toggle("is-books-open", open)
  for (const button of Array.from(picker.querySelectorAll<HTMLElement>(".bwz-pk-switch, .bwz-pk-collapse"))) {
    button.setAttribute("aria-expanded", String(open))
  }
  if (!open) revealCurrentChapter(picker)
}

/** 章號很多時只露出約 8 行，把目前章捲進可視範圍（只動章號區自己的捲動，不捲整頁）。 */
export function revealCurrentChapter(picker: HTMLElement): void {
  const wrap = picker.querySelector<HTMLElement>(".bwz-chgrid-wrap")
  const current = wrap?.querySelector<HTMLElement>("a[aria-current='page']")
  if (!wrap || !current || wrap.clientHeight === 0) return
  wrap.scrollTop = scrollTopToReveal(
    wrap.scrollTop,
    wrap.clientHeight,
    current.offsetTop - wrap.offsetTop,
    current.offsetHeight,
    wrap.scrollHeight,
  )
}

export function initModes(picker: HTMLElement): () => void {
  const onClick = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    if (event.target.closest(".bwz-pk-switch, .bwz-pk-collapse")) setBooksOpen(picker, !isBooksOpen(picker))
  }
  picker.addEventListener("click", onClick)
  revealCurrentChapter(picker)
  return () => picker.removeEventListener("click", onClick)
}
