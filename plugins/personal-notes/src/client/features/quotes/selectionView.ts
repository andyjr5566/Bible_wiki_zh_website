// 引用到筆記（F6）：在章節頁經文以外的內容、條目頁內文選字 → 選取範圍下方浮出「❝ 引用到筆記」。
// 版面與位置比照經文工具列（highlights/chapterView.ts）；兩個工具列的範圍互斥：
// 這裡只在選取範圍完全不碰經文清單時出現，經文工具列只在選取落在經文清單裡時出現。
// 實際插入／開新筆記由筆記功能接手（COMPOSE_QUOTE_EVENT，功能之間不互相 import）。

import { h, toast } from "../../ui/dom"
import { annotateVerses } from "../../ui/verses"
import { COMPOSE_QUOTE_EVENT, type ComposeQuoteDetail, type View } from "../types"
import { formatQuote, isQuotable, MAX_QUOTE_CHARS, type HeadingCandidate } from "./quote"

export interface QuotePage {
  target: ComposeQuoteDetail["page"]
  /** 出處連結用的頁面 slug */
  slug: string
  /** 出處顯示用的頁面名稱（例如「創世記 1」） */
  label: string
  /** 章節頁才有經文清單 */
  hasVerses: boolean
}

interface Pending {
  text: string
  headings: HeadingCandidate[]
  rect: DOMRect
}

/** 本外掛自己的畫面、輸入框與浮出預覽：從 article 往上找，遇到就不引用。 */
function inOwnUi(node: Node, article: Element): boolean {
  for (let el: Element | null = node.nodeType === 1 ? (node as Element) : node.parentElement; el && el !== article; el = el.parentElement) {
    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || (el as HTMLElement).isContentEditable) return true
    if (el.classList.contains("popover")) return true
    for (const c of Array.from(el.classList)) if (c.startsWith("bwz-")) return true
  }
  return false
}

export class QuoteSelection implements View {
  private readonly toolbar: HTMLElement
  private cleanups: (() => void)[] = []
  private timer: ReturnType<typeof setTimeout> | null = null
  private pending: Pending | null = null

  constructor(private readonly page: QuotePage) {
    this.toolbar = h("div", { class: "bwz-h-toolbar bwz-q-toolbar", attrs: { role: "toolbar", "aria-label": "引用工具", hidden: true } })
    // 按工具列時不要讓選取消失
    this.toolbar.addEventListener("mousedown", (e) => e.preventDefault())
    document.body.append(this.toolbar)

    const onSelection = () => {
      if (this.timer) clearTimeout(this.timer)
      this.timer = setTimeout(() => this.update(), 220)
    }
    const onClick = (e: Event) => {
      if (!(e.target as HTMLElement).closest(".bwz-q-toolbar") && window.getSelection()?.isCollapsed) this.hide()
    }
    const onScroll = () => {
      if (!this.toolbar.hidden && window.getSelection()?.isCollapsed) this.hide()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !this.toolbar.hidden) this.hide()
    }
    document.addEventListener("selectionchange", onSelection)
    document.addEventListener("click", onClick)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onScroll, { passive: true })
    this.cleanups.push(
      () => document.removeEventListener("selectionchange", onSelection),
      () => document.removeEventListener("click", onClick),
      () => document.removeEventListener("keydown", onKey),
      () => window.removeEventListener("scroll", onScroll),
    )
  }

  destroy(): void {
    for (const fn of this.cleanups) fn()
    if (this.timer) clearTimeout(this.timer)
    this.toolbar.remove()
  }

  /** 目前的選取如果可以引用，回傳文字、前面的小標題與位置。 */
  private read(): Pending | null {
    const sel = window.getSelection()
    const article = document.querySelector("article")
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed || !article) return null
    const range = sel.getRangeAt(0)
    const text = sel.toString()
    const list = this.page.hasVerses ? annotateVerses() : null
    const inArticle = article.contains(range.startContainer) && article.contains(range.endContainer)
    if (
      !isQuotable({
        empty: !text.trim(),
        inArticle,
        inOwnUi: inArticle && (inOwnUi(range.startContainer, article) || inOwnUi(range.endContainer, article)),
        touchesVerses: !!list && range.intersectsNode(list),
      })
    ) {
      return null
    }
    return { text, headings: this.headingsBefore(article, range.startContainer), rect: range.getBoundingClientRect() }
  }

  /**
   * 選取位置之前的小標題（依文件順序）。除了 h1–h6，也看可收合區塊的 summary
   * （被改成 details.collapsible-section 的 h2 在畫面上沒有 id，標題文字在 summary 裡）。
   */
  private headingsBefore(article: Element, start: Node): HeadingCandidate[] {
    const out: HeadingCandidate[] = []
    for (const el of Array.from(article.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,summary"))) {
      if (el.tagName !== "SUMMARY" && el.closest("summary")) continue // 已由 summary 代表
      if (el.closest(".popover") || inOwnUi(el, article)) continue
      if (!(el.compareDocumentPosition(start) & (Node.DOCUMENT_POSITION_FOLLOWING | Node.DOCUMENT_POSITION_CONTAINED_BY)) && el !== start) continue
      const clone = el.cloneNode(true) as HTMLElement
      for (const x of Array.from(clone.querySelectorAll("a[role='anchor'], svg, .bwz-v-ui"))) x.remove()
      const text = (clone.textContent ?? "").replace(/\s+/g, " ").trim()
      const inner = el.tagName === "SUMMARY" ? el.querySelector<HTMLElement>("[id]") : null
      out.push({ text, id: el.id || inner?.id || (el.tagName === "SUMMARY" ? el.parentElement?.id : "") || null })
    }
    return out
  }

  private update(): void {
    const p = this.read()
    if (!p) {
      this.hide()
      return
    }
    this.pending = p
    this.toolbar.replaceChildren(
      h("button", { class: "bwz-n-btn small", text: "❝ 引用到筆記", attrs: { type: "button" }, on: { click: () => this.quote() } }),
    )
    this.place(p.rect)
  }

  /** 工具列放在選取範圍下方（iPhone 的系統選單在上方，不會互相擋住）。 */
  private place(rect: DOMRect): void {
    this.toolbar.hidden = false
    const w = this.toolbar.offsetWidth
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8)
    this.toolbar.style.left = `${left + window.scrollX}px`
    this.toolbar.style.top = `${rect.bottom + window.scrollY + 10}px`
  }

  private hide(): void {
    this.toolbar.hidden = true
    this.pending = null
  }

  private quote(): void {
    const p = this.pending
    this.hide()
    window.getSelection()?.removeAllRanges()
    if (!p) return
    const q = formatQuote(p.text, { slug: this.page.slug, pageLabel: this.page.label, headings: p.headings })
    if (!q) return
    if (q.truncated) toast(`引文太長，只取前 ${MAX_QUOTE_CHARS} 字`)
    const detail: ComposeQuoteDetail = { page: this.page.target, markdown: q.markdown }
    document.dispatchEvent(new CustomEvent(COMPOSE_QUOTE_EVENT, { detail }))
  }
}
