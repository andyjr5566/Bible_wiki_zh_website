// 手機章節頁最後：「出埃及記・本卷章節」＋本卷章號格＋「換一卷書」。
// 章號格直接複製伺服器端已畫好的那一份（不再算一次，也不會和左欄不一致）。桌機由 CSS 隱藏（左欄一直在畫面上）。
import { OPEN_PICKER_EVENT, type OpenPickerDetail } from "../pickerLogic"

const SECTION_CLASS = "bwz-chend"

export function removeChapterEnd(): void {
  document.querySelectorAll(`.${SECTION_CLASS}`).forEach((el) => el.remove())
}

export function initChapterEnd(picker: HTMLElement): void {
  removeChapterEnd()
  if (picker.dataset.kind !== "chapter") return
  const article = document.querySelector("article")
  const grid = picker.querySelector(".bwz-chgrid-wrap")
  const bookName = picker.dataset.bookName
  if (!article || !grid || !bookName) return

  const section = document.createElement("section")
  section.className = SECTION_CLASS
  section.setAttribute("aria-labelledby", "bwz-chend-title")

  const title = document.createElement("h2")
  title.className = "bwz-chend-title"
  title.id = "bwz-chend-title"
  title.textContent = `${bookName}・本卷章節`

  const actions = document.createElement("div")
  actions.className = "bwz-chend-actions"
  const change = document.createElement("button")
  change.type = "button"
  change.className = "bwz-chend-change"
  change.textContent = "換一卷書"
  change.addEventListener("click", () => {
    const detail: OpenPickerDetail = { showBooks: true }
    document.dispatchEvent(new CustomEvent(OPEN_PICKER_EVENT, { detail }))
  })
  actions.append(change)
  const toc = picker.querySelector<HTMLAnchorElement>(".bwz-pk-link")
  if (toc?.textContent?.trim() === "全書目錄及綱要") {
    const link = document.createElement("a")
    link.className = "bwz-chend-toc"
    link.href = toc.getAttribute("href") ?? "#"
    link.textContent = "全書目錄及綱要"
    actions.append(link)
  }

  section.append(title, grid.cloneNode(true), actions)
  article.append(section)
}
