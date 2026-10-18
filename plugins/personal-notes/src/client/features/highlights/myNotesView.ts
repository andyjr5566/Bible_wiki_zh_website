// 「我的筆記」頁的書籤與重點清單（12 C3），依書卷章節排序，點一下回到經文。

import type { Resolved } from "../../merge/merge"
import { BOOKS, chapterLabel, chapterSlug } from "../../model/books"
import type { Session } from "../../session/session"
import { h, toast, verseLabel } from "../../ui/dom"
import type { View } from "../types"
import { HighlightsService } from "./highlights"

const order = new Map(BOOKS.map((b, i) => [b.code, i]))

function byPlace(a: Resolved, b: Resolved): number {
  const x = a.winner.anchor
  const y = b.winner.anchor
  return (order.get(x.book ?? "") ?? 999) - (order.get(y.book ?? "") ?? 999) || (x.chapter ?? 0) - (y.chapter ?? 0) || (x.verseStart ?? 0) - (y.verseStart ?? 0)
}

export class HighlightsPage implements View {
  private readonly service: HighlightsService
  private unsubscribe: () => void

  constructor(
    private readonly session: Session,
    private readonly host: HTMLElement,
  ) {
    this.service = new HighlightsService(() => session.repo)
    this.unsubscribe = session.onChange(() => this.render())
    this.render()
  }

  destroy(): void {
    this.unsubscribe()
    this.host.replaceChildren()
  }

  /** 該章（或該節）的網址。 */
  private href(r: Resolved): string | null {
    const a = r.winner.anchor
    const slug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
    if (!slug) return null
    return `${document.body.dataset.basepath ?? ""}/${encodeURI(slug)}${a.verseStart ? `#v${a.verseStart}` : ""}`
  }

  private place(r: Resolved): string {
    const a = r.winner.anchor
    if (!a.book || !a.chapter) return "其他"
    return `${chapterLabel(a.book, a.chapter)}${a.verseStart ? ` ${verseLabel(a.verseStart, a.verseEnd)}` : ""}`
  }

  private async remove(id: string, what: string): Promise<void> {
    if (!(await this.session.gateEdit())) return
    try {
      await this.service.remove(id)
      toast(`已移除${what}`)
    } catch {
      toast("移除失敗，請再試一次")
    }
  }

  private render(): void {
    const bookmarks = this.service.allBookmarks().sort(byPlace)
    const highlights = this.service.allHighlights().sort(byPlace)
    if (bookmarks.length === 0 && highlights.length === 0) {
      this.host.replaceChildren(
        h("section", { class: "bwz-n-section" }, h("h3", { text: "書籤與重點" }), h("p", { class: "bwz-n-muted", text: "在章節頁選取經文，就可以畫重點或加書籤；章節頁下方也可以把整章加入書籤。" })),
      )
      return
    }
    const row = (r: Resolved, extra: HTMLElement | null, what: string) => {
      const href = this.href(r)
      return h(
        "li",
        null,
        href ? h("a", { text: this.place(r), attrs: { href } }) : h("span", { text: this.place(r) }),
        extra,
        " ",
        h("button", { class: "bwz-n-btn small", text: "移除", attrs: { type: "button", "aria-label": `移除${what}` }, on: { click: () => void this.remove(r.id, what) } }),
      )
    }
    this.host.replaceChildren(
      h(
        "section",
        { class: "bwz-n-section bwz-h-page" },
        h("h3", { text: `🔖 書籤（${bookmarks.length}）` }),
        bookmarks.length ? h("ul", null, ...bookmarks.map((r) => row(r, null, "書籤"))) : h("p", { class: "bwz-n-muted", text: "還沒有書籤。" }),
        h("h3", { text: `🖍 畫的重點（${highlights.length}）` }),
        highlights.length
          ? h("ul", null, ...highlights.map((r) => row(r, h("span", { class: "bwz-h-quote", text: r.winner.anchor.quote ? `「${r.winner.anchor.quote.exact}」` : "（整節）" }), "重點")))
          : h("p", { class: "bwz-n-muted", text: "還沒有畫重點。" }),
      ),
    )
  }
}
