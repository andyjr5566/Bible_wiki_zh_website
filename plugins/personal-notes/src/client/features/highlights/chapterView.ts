// 章節頁的畫重點與書籤（12 C2、C3）：
// - 選取經文 → 浮出工具列〔🖍 畫重點〕〔🔖 書籤〕〔📝 寫筆記〕；點已畫的重點 →〔移除這個重點〕。
// - 在經文上標出本章的重點（找不到原文的列在下方，不會默默消失）。
// - 筆記面板下方一列：這一章的書籤開關、本章重點清單。
// 「寫筆記」透過 COMPOSE_NOTE_EVENT 交給筆記功能（功能之間不互相 import）。

import { chapterLabel } from "../../model/books"
import type { Session } from "../../session/session"
import { h, toast, verseLabel } from "../../ui/dom"
import { annotateVerses, locateQuote, selectionToVerses, textHash, unwrapAll, verseElement, verseText, wrapText, type Quote } from "../../ui/verses"
import { COMPOSE_STICKY_EVENT, COMPOSE_NOTE_EVENT, type ComposeNoteDetail, type View } from "../types"
import { HighlightsService } from "./highlights"

interface Picked {
  start: number
  end: number
  quote: Quote | null
  rect: DOMRect
}

export class ChapterHighlights implements View {
  private readonly service: HighlightsService
  private toolbar: HTMLElement
  private cleanups: (() => void)[] = []
  private missing: string[] = []
  private unsubscribe: () => void
  private timer: ReturnType<typeof setTimeout> | null = null
  /** 工具列正顯示「移除這個重點」（點擊會清掉選取，這時不要因為選取消失而收起） */
  private removeMode = false

  constructor(
    private readonly session: Session,
    private readonly host: HTMLElement,
    private readonly book: string,
    private readonly chapter: number,
  ) {
    this.service = new HighlightsService(() => session.repo)
    this.toolbar = h("div", { class: "bwz-h-toolbar", attrs: { role: "toolbar", "aria-label": "經文工具", hidden: true } })
    // 按工具列時不要讓選取消失
    this.toolbar.addEventListener("mousedown", (e) => e.preventDefault())
    document.body.append(this.toolbar)

    const onSelection = () => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.updateToolbar(), 220)
    }
    const onClick = (e: Event) => {
      const mark = (e.target as HTMLElement).closest<HTMLElement>("mark.bwz-hl")
      if (mark?.dataset.id) this.showRemove(mark)
      else if (!(e.target as HTMLElement).closest(".bwz-h-toolbar") && window.getSelection()?.isCollapsed) this.hideToolbar()
      // （點其他地方就收起；在工具列上按按鈕由按鈕自己處理）
    }
    const onScroll = () => {
      if (!this.toolbar.hidden && window.getSelection()?.isCollapsed) this.hideToolbar()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !this.toolbar.hidden) this.hideToolbar()
    }
    document.addEventListener("selectionchange", onSelection)
    document.addEventListener("keydown", onKey)
    document.addEventListener("click", onClick)
    window.addEventListener("scroll", onScroll, { passive: true })
    this.cleanups.push(
      () => document.removeEventListener("selectionchange", onSelection),
      () => document.removeEventListener("click", onClick),
      () => document.removeEventListener("keydown", onKey),
      () => window.removeEventListener("scroll", onScroll),
    )
    this.unsubscribe = session.onChange(() => this.refresh())
    this.refresh()
  }

  destroy(): void {
    this.unsubscribe()
    for (const fn of this.cleanups) fn()
    if (this.timer) clearTimeout(this.timer)
    this.toolbar.remove()
    const list = annotateVerses()
    if (list) unwrapAll(list, "mark.bwz-hl")
    this.host.replaceChildren()
  }

  private refresh(): void {
    this.applyMarks()
    this.renderBar()
  }

  // ---------- 在經文上標出重點 ----------

  private applyMarks(): void {
    const list = annotateVerses()
    this.missing = []
    if (!list) return
    unwrapAll(list, "mark.bwz-hl")
    for (const r of this.service.highlightsIn(this.book, this.chapter)) {
      const a = r.winner.anchor
      const from = a.verseStart ?? 0
      const to = a.verseEnd ?? from
      let found = false
      for (let v = from; v <= to; v++) {
        const li = verseElement(list, v)
        if (!li) continue
        const text = verseText(li)
        const range = a.quote ? locateQuote(text, a.quote) : ([0, text.length] as [number, number])
        if (!range) continue
        found = wrapText(li, range[0], range[1], "bwz-hl", { id: r.id }).length > 0 || found
      }
      if (!found) this.missing.push(r.id)
    }
  }

  // ---------- 面板下方：書籤開關與本章重點 ----------

  private renderBar(): void {
    const marked = !!this.service.findBookmark(this.book, this.chapter, null, null)
    const highlights = this.service.highlightsIn(this.book, this.chapter)
    const bookmarkBtn = h("button", {
      class: `bwz-n-btn small${marked ? " primary" : ""}`,
      text: marked ? "🔖 已加入書籤" : "🔖 把這一章加入書籤",
      attrs: { type: "button", "aria-pressed": String(marked) },
      on: { click: () => void this.toggleBookmark(null, null) },
    })
    const items = highlights.map((r) => {
      const a = r.winner.anchor
      const lost = this.missing.includes(r.id)
      return h(
        "li",
        null,
        h("a", { text: verseLabel(a.verseStart, a.verseEnd), attrs: { href: `#v${a.verseStart}` }, on: { click: (e) => this.jumpTo(e, a.verseStart) } }),
        " ",
        h("span", { text: a.quote ? `「${a.quote.exact}」` : "（整節）" }),
        lost ? h("span", { class: "bwz-n-warn", text: " 經文已更新，找不到原本畫的位置" }) : null,
        " ",
        h("button", { class: "bwz-n-btn small", text: "移除", attrs: { type: "button", "aria-label": "移除這個重點" }, on: { click: () => void this.removeHighlight(r.id) } }),
      )
    })
    this.host.replaceChildren(
      h(
        "div",
        { class: "bwz-h-bar" },
        h("div", { class: "bwz-n-row" }, bookmarkBtn, h("span", { class: "bwz-n-muted", text: "選取經文可以畫重點、加書籤、貼便條或寫筆記" })),
        highlights.length
          ? h("details", { class: "bwz-h-list" }, h("summary", { text: `本章畫了 ${highlights.length} 個重點` }), h("ul", null, ...items))
          : null,
      ),
    )
  }

  private jumpTo(e: Event, v: number | null): void {
    e.preventDefault()
    const list = annotateVerses()
    const li = list && v ? verseElement(list, v) : null
    li?.scrollIntoView({ block: "center" })
  }

  // ---------- 選取經文的工具列 ----------

  private picked(): Picked | null {
    const list = annotateVerses()
    const sel = window.getSelection()
    if (!list || !sel) return null
    const r = selectionToVerses(sel, list)
    if (!r) return null
    return { ...r, rect: sel.getRangeAt(0).getBoundingClientRect() }
  }

  private updateToolbar(): void {
    const p = this.picked()
    if (!p) {
      if (!this.removeMode && window.getSelection()?.isCollapsed !== false) this.hideToolbar()
      return
    }
    this.removeMode = false
    const label = verseLabel(p.start, p.end === p.start ? null : p.end)
    const bookmarked = !!this.service.findBookmark(this.book, this.chapter, p.start, p.end)
    this.toolbar.replaceChildren(
      h("span", { class: "bwz-h-label", text: label }),
      h("button", { class: "bwz-n-btn small", text: "🖍 畫重點", attrs: { type: "button" }, on: { click: () => void this.addHighlight(p) } }),
      h("button", { class: "bwz-n-btn small", text: bookmarked ? "🔖 取消書籤" : "🔖 書籤", attrs: { type: "button" }, on: { click: () => void this.toggleBookmark(p.start, p.end) } }),
      h("button", { class: "bwz-n-btn small", text: "🗒️ 便條", attrs: { type: "button" }, on: { click: () => {
        this.done()
        document.dispatchEvent(new CustomEvent(COMPOSE_STICKY_EVENT, { detail: { book: this.book, chapter: this.chapter, verse: p.start } }))
      } } }),
      h("button", { class: "bwz-n-btn small", text: "📝 寫筆記", attrs: { type: "button" }, on: { click: () => this.composeNote(p) } }),
    )
    this.place(p.rect)
  }

  private showRemove(mark: HTMLElement): void {
    const id = mark.dataset.id!
    this.removeMode = true
    this.toolbar.replaceChildren(
      h("button", { class: "bwz-n-btn small danger", text: "移除這個重點", attrs: { type: "button" }, on: { click: () => void this.removeHighlight(id) } }),
    )
    this.place(mark.getBoundingClientRect())
  }

  /** 工具列放在選取範圍下方（iPhone 的系統選單在上方，不會互相擋住）。 */
  private place(rect: DOMRect): void {
    this.toolbar.hidden = false
    const w = this.toolbar.offsetWidth
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8)
    this.toolbar.style.left = `${left + window.scrollX}px`
    this.toolbar.style.top = `${rect.bottom + window.scrollY + 10}px`
  }

  private hideToolbar(): void {
    this.toolbar.hidden = true
    this.removeMode = false
  }

  private done(): void {
    this.hideToolbar()
    window.getSelection()?.removeAllRanges()
  }

  // ---------- 動作 ----------

  private async addHighlight(p: Picked): Promise<void> {
    this.done()
    if (!(await this.session.gateEdit())) return
    const list = annotateVerses()
    const texts: string[] = []
    for (let v = p.start; v <= p.end; v++) {
      const li = list ? verseElement(list, v) : null
      if (li) texts.push(verseText(li))
    }
    try {
      await this.service.addHighlight({ book: this.book, chapter: this.chapter, verseStart: p.start, verseEnd: p.end === p.start ? null : p.end, quote: p.quote, hash: textHash(texts.join("\n")) })
    } catch {
      toast("畫重點失敗，請再試一次")
    }
  }

  private async removeHighlight(id: string): Promise<void> {
    this.hideToolbar()
    if (!(await this.session.gateEdit())) return
    try {
      await this.service.remove(id)
      toast("已移除重點")
    } catch {
      toast("移除失敗，請再試一次")
    }
  }

  private async toggleBookmark(start: number | null, end: number | null): Promise<void> {
    this.done()
    if (!(await this.session.gateEdit())) return
    try {
      const where = start ? `${chapterLabel(this.book, this.chapter)} ${verseLabel(start, end === start ? null : end)}` : chapterLabel(this.book, this.chapter)
      const r = await this.service.toggleBookmark(this.book, this.chapter, start, end)
      toast(r === "added" ? `已把「${where}」加入書籤` : `已移除「${where}」的書籤`)
    } catch {
      toast("書籤更新失敗，請再試一次")
    }
  }

  private composeNote(p: Picked): void {
    this.done()
    const detail: ComposeNoteDetail = { book: this.book, chapter: this.chapter, verseStart: p.start, verseEnd: p.end === p.start ? null : p.end, quote: p.quote?.exact }
    document.dispatchEvent(new CustomEvent(COMPOSE_NOTE_EVENT, { detail }))
  }
}
