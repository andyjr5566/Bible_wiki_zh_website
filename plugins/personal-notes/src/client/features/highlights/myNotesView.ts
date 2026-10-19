// 「我的筆記」頁的「重點」與「書籤」兩個分頁（12 C3、D-42）：最近 10 則＋依書卷折疊，點一下回到經文。
// 知識庫條目的書籤（12 N2）放在「依書卷」最後的「知識庫條目」分組；條目搬移或改名後連到新網址，找不到時標示（D-46）。

import type { Resolved } from "../../merge/merge"
import { chapterLabel, chapterSlug } from "../../model/books"
import type { Relocation } from "../../model/nodeLocate"
import { locateNodeRecords } from "../../repo/nodeHeal"
import type { Session } from "../../session/session"
import { formatTime, h, toast, verseLabel } from "../../ui/dom"
import { Library, type LibraryItem } from "../../ui/library"
import { loadLinkIndex } from "../../ui/linkIndex"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { View } from "../types"
import { HighlightsService } from "./highlights"

export class HighlightsPage implements View {
  private readonly service: HighlightsService
  private readonly shell: MyNotesShell
  private readonly highlightsEl = h("div", { class: "bwz-h-page" })
  private readonly bookmarksEl = h("div", { class: "bwz-h-page" })
  private readonly highlights = new Library({ unit: "個重點", empty: "還沒有畫重點。在章節頁選取經文，按「🖍 畫重點」。" })
  private readonly bookmarks = new Library({ unit: "個書籤", empty: "還沒有書籤。章節頁可以把整章或選取的經文加入書籤；知識庫條目頁也可以加入書籤。" })
  private readonly unsubscribe: () => void
  /** 條目書籤目前該連到哪裡（id → 結果）；索引還沒載入時是 null（照原網址）。 */
  private relocations: Map<string, Relocation> | null = null
  private indexRequested = false

  constructor(
    private readonly session: Session,
    private readonly host: HTMLElement,
  ) {
    this.service = new HighlightsService(() => session.repo)
    this.shell = shellFor(host, session)
    this.highlightsEl.append(this.highlights.el)
    this.bookmarksEl.append(this.bookmarks.el)
    host.replaceChildren(this.highlightsEl, this.bookmarksEl)
    this.shell.addTab({
      id: "highlights",
      label: "重點",
      unit: "個重點",
      order: 3,
      el: this.highlightsEl,
      count: () => this.highlights.matchCount,
      total: () => this.service.allHighlights().length,
      onQuery: (q) => this.highlights.setQuery(q),
    })
    this.shell.addTab({
      id: "bookmarks",
      label: "書籤",
      unit: "個書籤",
      order: 4,
      el: this.bookmarksEl,
      count: () => this.bookmarks.matchCount,
      total: () => this.service.allBookmarks().length,
      onQuery: (q) => this.bookmarks.setQuery(q),
    })
    this.unsubscribe = session.onChange(() => this.render())
    this.render()
  }

  destroy(): void {
    this.unsubscribe()
    this.shell.removeTab("highlights")
    this.shell.removeTab("bookmarks")
    this.host.replaceChildren()
  }

  /** 該章（或該節）、或知識庫條目的網址。 */
  private href(r: Resolved): string | null {
    const a = r.winner.anchor
    const base = document.body.dataset.basepath ?? ""
    if (a.kind === "node") {
      const loc = this.relocations?.get(r.id)
      if (loc?.kind === "missing") return null
      const slug = loc?.kind === "moved" ? loc.slug : a.node?.slug
      return slug ? `${base}/${encodeURI(slug)}` : null
    }
    const slug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
    if (!slug) return null
    return `${base}/${encodeURI(slug)}${a.verseStart ? `#v${a.verseStart}` : ""}`
  }

  private place(r: Resolved): string {
    const a = r.winner.anchor
    if (a.kind === "node") {
      const loc = this.relocations?.get(r.id)
      const title = loc?.kind === "moved" ? loc.title : (a.node?.title ?? a.node?.slug ?? "其他")
      return `📚 ${title}${loc?.kind === "missing" ? "（條目可能已改名或刪除）" : ""}`
    }
    if (!a.book || !a.chapter) return "其他"
    return `${chapterLabel(a.book, a.chapter)}${a.verseStart ? ` ${verseLabel(a.verseStart, a.verseEnd)}` : "（整章）"}`
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

  private row(r: Resolved, what: string, quote: string | null): HTMLElement {
    const href = this.href(r)
    const place = this.place(r)
    return h(
      "div",
      { class: "bwz-lib-row", data: { id: r.id } },
      h("div", { class: "bwz-lib-row-main" }, href ? h("a", { class: "bwz-lib-place", text: place, attrs: { href } }) : h("span", { class: "bwz-lib-place", text: place }), quote ? h("span", { class: "bwz-h-quote", text: quote }) : null),
      h("span", { class: "bwz-n-time", text: formatTime(r.winner.updatedAt) }),
      h("button", { class: "bwz-n-btn small", text: "移除", attrs: { type: "button", "aria-label": `移除${what}` }, on: { click: () => void this.remove(r.id, what) } }),
    )
  }

  private item(r: Resolved, what: string, quote: string | null): LibraryItem {
    const a = r.winner.anchor
    const node = a.kind === "node"
    return {
      id: r.id,
      book: node ? null : a.book,
      chapter: node ? null : a.chapter,
      verse: node ? null : a.verseStart,
      updated: r.winner.updatedAt,
      text: [this.place(r), quote ?? ""].join("\n"),
      tags: [],
      groupLabel: node ? "知識庫條目" : undefined,
      render: () => this.row(r, what, quote),
    }
  }

  /** 有條目書籤時才下載連結索引，算出每一筆現在的網址。 */
  private async locateNodes(): Promise<void> {
    this.indexRequested = true
    const index = await loadLinkIndex()
    if (!index || !this.host.isConnected) return
    const nodes = this.service.allBookmarks().filter((r) => r.winner.anchor.kind === "node" && r.winner.anchor.node?.slug)
    this.relocations = locateNodeRecords(nodes, index.pages)
    this.render()
  }

  private render(): void {
    const hasNode = this.service.allBookmarks().some((r) => r.winner.anchor.kind === "node")
    if (hasNode && this.relocations && this.service.allBookmarks().some((r) => r.winner.anchor.kind === "node" && !this.relocations!.has(r.id))) this.indexRequested = false
    if (hasNode && !this.indexRequested) void this.locateNodes()
    this.highlights.setItems(this.service.allHighlights().map((r) => this.item(r, "重點", r.winner.anchor.quote ? `「${r.winner.anchor.quote.exact}」` : "（整節）")))
    this.bookmarks.setItems(this.service.allBookmarks().map((r) => this.item(r, "書籤", null)))
    this.shell.update()
  }
}
