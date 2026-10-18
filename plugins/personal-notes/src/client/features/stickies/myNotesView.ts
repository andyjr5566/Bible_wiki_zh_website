// 「我的筆記」頁的「便條」分頁（D-42）與「⚙ 設定與備份」裡的便條顯示設定（D-41）。

import type { Resolved } from "../../merge/merge"
import { chapterLabel, chapterSlug } from "../../model/books"
import type { Session } from "../../session/session"
import { formatTime, h } from "../../ui/dom"
import { Library, type LibraryItem } from "../../ui/library"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { View } from "../types"
import { getStickyMode, setStickyMode } from "./settings"
import { StickiesService, stickyColor } from "./stickies"

const miniPaper = '<svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M3 2h9l5 4v12H3z"/><path d="M12 2v4h5"/><path d="M6 10h8M6 13h8M6 16h5"/></svg>'
const miniIcon = '<svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"><path d="M4 3h8l4 4v11H4z"/><path d="M12 3v4h4"/></svg>'

/** 固定的示意圖 SVG（本檔常數，不是使用者內容）。 */
function svg(markup: string): Element {
  return document.importNode(new DOMParser().parseFromString(markup, "text/html").body.firstElementChild!, true)
}

export class StickiesPage implements View {
  private readonly service: StickiesService
  private readonly shell: MyNotesShell
  private readonly library = new Library({ unit: "張便條", empty: "還沒有便條。在章節頁選取經文，按「🗒️ 便條」貼一張。", chapterLinks: true })
  private readonly unsubscribe: () => void

  constructor(
    session: Session,
    private readonly host: HTMLElement,
  ) {
    this.service = new StickiesService(() => session.repo)
    this.shell = shellFor(host, session)
    host.replaceChildren(this.library.el)
    this.shell.addTab({
      id: "stickies",
      label: "便條",
      unit: "張便條",
      order: 2,
      el: host,
      count: () => this.library.matchCount,
      total: () => this.service.all().length,
      onQuery: (q) => this.library.setQuery(q),
    })
    this.shell.addSection({ id: "stickies", title: "便條紙", order: 3, render: () => this.settings() })
    this.unsubscribe = session.onChange(() => this.render())
    this.render()
  }

  destroy(): void {
    this.unsubscribe()
    this.shell.removeTab("stickies")
    this.shell.removeSection("stickies")
    this.host.replaceChildren()
  }

  private render(): void {
    this.library.setItems(this.service.all().map((r) => this.item(r)))
    this.shell.update()
  }

  private item(r: Resolved): LibraryItem {
    const a = r.winner.anchor
    const place = a.book && a.chapter ? `${chapterLabel(a.book, a.chapter)} ${a.verseStart ?? ""}`.trim() : "其他"
    return {
      id: r.id,
      book: a.book,
      chapter: a.chapter,
      verse: a.verseStart,
      updated: r.winner.updatedAt,
      text: `${place}\n${r.winner.body}`,
      tags: [],
      render: () => this.card(r),
    }
  }

  /** 清單裡的迷你紙箋：小標、兩行預覽、回到經文。 */
  private card(r: Resolved): HTMLElement {
    const a = r.winner.anchor
    const base = document.body.dataset.basepath ?? ""
    const slug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
    const label = a.book && a.chapter ? `✤ ${chapterLabel(a.book, a.chapter).replace(/\s*第(\d+)章$/, " $1")}:${a.verseStart ?? ""}` : "✤"
    const parts: (HTMLElement | null)[] = [
      h("div", { class: "bwz-lib-sticky-head" }, h("span", { class: "bwz-lib-sticky-label", text: label }), h("span", { class: "bwz-n-time", text: formatTime(r.winner.updatedAt) })),
      h("div", { class: "bwz-lib-sticky-text", text: r.conflicts.length ? `${r.winner.body}\n（有兩個版本待選擇，請到該章處理）` : r.winner.body }),
      slug ? h("a", { class: "bwz-lib-sticky-go", text: "回到經文 →", attrs: { href: `${base}/${encodeURI(slug)}${a.verseStart ? `#v${a.verseStart}` : ""}` } }) : null,
    ]
    const card = h("article", { class: "bwz-lib-sticky", data: { id: r.id, color: stickyColor(r.winner) } })
    card.append(...parts.filter((x): x is HTMLElement => x !== null))
    return card
  }

  private settings(): HTMLElement {
    const body = h("div", { class: "bwz-sticky-options" }, h("p", { class: "bwz-n-muted", text: "便條紙平常要：" }))
    const mode = getStickyMode()
    for (const [value, label, illustration] of [
      ["open", "展開，直接貼在經文下方", miniPaper],
      ["icon", "收起成小紙條，點了才看", miniIcon],
    ] as const) {
      const input = h("input", { attrs: { type: "radio", name: "bwz-sticky-mode", value }, on: { change: () => setStickyMode(value) } })
      input.checked = mode === value
      const icon = h("span", { class: "bwz-sticky-option-icon" })
      icon.append(svg(illustration))
      body.append(h("label", { class: "bwz-sticky-option" }, input, icon, h("span", { text: label })))
    }
    return body
  }
}
