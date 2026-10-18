// 編輯框輸入 [[ 時跳出知識庫條目的候選清單（12 C6）。↑↓ 選擇、Enter／Tab 帶入、Esc 關閉，也可以直接點。

import { h } from "../../ui/dom"
import { loadResolver } from "./links"

export interface LinkComplete {
  /** 候選清單（放在編輯框下方）。 */
  el: HTMLElement
}

export function attachLinkComplete(textarea: HTMLTextAreaElement): LinkComplete {
  const list = h("ul", { class: "bwz-n-complete", attrs: { role: "listbox", "aria-label": "知識庫條目", hidden: true } })
  let items: { t: string }[] = []
  let active = 0
  let seq = 0

  const close = () => {
    list.hidden = true
    items = []
  }

  /** 游標前面是否正在輸入 [[…（還沒打 ]]）；回傳已輸入的文字。 */
  const pendingQuery = (): string | null => {
    const before = textarea.value.slice(0, textarea.selectionStart)
    const m = /\[\[([^\]\n|#]{0,40})$/.exec(before)
    return m ? m[1] : null
  }

  const choose = (title: string) => {
    const pos = textarea.selectionStart
    const before = textarea.value.slice(0, pos).replace(/\[\[([^\]\n|#]*)$/, `[[${title}]]`)
    const after = textarea.value.slice(pos).replace(/^\]\]/, "")
    textarea.value = before + after
    textarea.setSelectionRange(before.length, before.length)
    close()
    textarea.focus()
    textarea.dispatchEvent(new Event("input", { bubbles: true })) // 讓自動儲存知道內容變了
  }

  const render = () => {
    list.replaceChildren(
      ...items.map((p, i) =>
        h("li", {
          class: i === active ? "active" : "",
          text: p.t,
          attrs: { role: "option", "aria-selected": String(i === active) },
          on: {
            mousedown: (e) => {
              e.preventDefault() // 不要讓編輯框失去焦點
              choose(p.t)
            },
          },
        }),
      ),
    )
    list.hidden = items.length === 0
  }

  const update = async () => {
    const q = pendingQuery()
    if (q === null) return close()
    const my = ++seq
    const resolver = await loadResolver()
    if (my !== seq || pendingQuery() !== q) return // 等待期間又打字了
    items = resolver ? resolver.search(q, 8) : []
    active = 0
    render()
  }

  textarea.addEventListener("input", () => void update())
  textarea.addEventListener("click", () => void update())
  textarea.addEventListener("blur", () => setTimeout(close, 150))
  textarea.addEventListener("keydown", (e) => {
    if (list.hidden || items.length === 0) return
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      active = (active + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length
      render()
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault()
      choose(items[active].t)
    } else if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  })
  return { el: list }
}
