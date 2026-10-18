// 〈我的筆記〉的清單元件（D-42）：最近編輯 10 則＋依書卷（書卷→章）折疊；搜尋時改成平鋪的結果、每次 20 則。
// 筆記很多時頁面也不會變長：書卷與章預設收起、只顯示數量，章打開時才畫出裡面的項目。
// 上半部是純函式（分組、篩選、排序），可在 Node 測試；下半部的 Library 類別負責畫面。

import { BOOKS, chapterLabel, chapterSlug } from "../model/books"
import { h } from "./dom"

export interface LibraryItem {
  id: string
  book: string | null
  chapter: number | null
  verse: number | null
  /** ISO 時間，用來排「最近編輯」 */
  updated: string
  /** 搜尋用的文字（書卷章節、標題、內文…） */
  text: string
  tags: string[]
  /** 沒有書卷的項目（例如知識庫條目書籤）在「依書卷」裡的分組名稱；沒寫就是「其他」 */
  groupLabel?: string
  render(): HTMLElement
}

const bookOrder = new Map(BOOKS.map((b, i) => [b.code, i]))
const bookName = new Map(BOOKS.map((b) => [b.code, b.name]))

/** 依經文順序：書卷、章、節，最後是時間（新的在前）。 */
export function byPlace(a: LibraryItem, b: LibraryItem): number {
  return (
    (bookOrder.get(a.book ?? "") ?? 999) - (bookOrder.get(b.book ?? "") ?? 999) ||
    (a.chapter ?? 0) - (b.chapter ?? 0) ||
    (a.verse ?? 0) - (b.verse ?? 0) ||
    b.updated.localeCompare(a.updated)
  )
}

export function recent(items: readonly LibraryItem[], n: number): LibraryItem[] {
  return [...items].sort((a, b) => b.updated.localeCompare(a.updated)).slice(0, n)
}

/** 每個詞都要符合（AND）；「#標籤」比對標籤開頭，其他比對 text 與標籤。不分大小寫。 */
export function matchesQuery(item: LibraryItem, query: string): boolean {
  const terms = query.toLowerCase().split(/\s+/).filter((t) => t && t !== "#")
  if (terms.length === 0) return true
  const tags = item.tags.map((t) => t.toLowerCase())
  const text = `${item.text}\n${tags.join(" ")}`.toLowerCase()
  return terms.every((t) => (t.startsWith("#") ? tags.some((tag) => tag.startsWith(t.slice(1))) : text.includes(t)))
}

export interface ChapterGroup {
  key: string
  chapter: number | null
  items: LibraryItem[]
}

export interface BookGroup {
  key: string
  label: string
  count: number
  chapters: ChapterGroup[]
}

/** 依書卷→章分組（依經文順序）；沒有書卷的項目依 groupLabel 分組放在最後。 */
export function groupByBook(items: readonly LibraryItem[]): BookGroup[] {
  const books = new Map<string, BookGroup>()
  for (const item of [...items].sort(byPlace)) {
    const key = item.book ?? `_${item.groupLabel ?? "其他"}`
    let g = books.get(key)
    if (!g) {
      g = { key, label: item.book ? (bookName.get(item.book) ?? item.book) : (item.groupLabel ?? "其他"), count: 0, chapters: [] }
      books.set(key, g)
    }
    g.count++
    const ck = `${key}.${item.chapter ?? "_"}`
    let c = g.chapters.find((x) => x.key === ck)
    if (!c) {
      c = { key: ck, chapter: item.chapter, items: [] }
      g.chapters.push(c)
    }
    c.items.push(item)
  }
  return [...books.values()]
}

// ---------- 畫面 ----------

export interface LibraryOptions {
  /** 「最近編輯」顯示幾則 */
  recentCount?: number
  /** 搜尋結果每次顯示幾則 */
  pageSize?: number
  /** 項目的稱呼，例如「則筆記」「張便條」 */
  unit: string
  /** 完全沒有項目時的說明 */
  empty: string
  /** 章的旁邊要不要放「前往該章 →」 */
  chapterLinks?: boolean
}

export class Library {
  readonly el = h("div", { class: "bwz-lib" })
  private items: LibraryItem[] = []
  private query = ""
  private shown: number
  /** 使用者打開過的書卷與章（重新畫的時候維持打開） */
  private readonly opened = new Set<string>()

  constructor(private readonly opts: LibraryOptions) {
    this.shown = opts.pageSize ?? 20
  }

  setItems(items: LibraryItem[]): void {
    this.items = items
    this.render()
  }

  setQuery(query: string): void {
    if (query === this.query) return
    this.query = query
    this.shown = this.opts.pageSize ?? 20
    this.render()
  }

  /** 符合目前搜尋的數量（分頁標籤上顯示）。 */
  get matchCount(): number {
    return this.query ? this.items.filter((i) => matchesQuery(i, this.query)).length : this.items.length
  }

  private render(): void {
    if (this.items.length === 0) {
      this.el.replaceChildren(h("p", { class: "bwz-n-empty", text: this.opts.empty }))
      return
    }
    if (this.query) {
      this.el.replaceChildren(...this.renderResults())
      return
    }
    const n = this.opts.recentCount ?? 10
    this.el.replaceChildren(
      h("section", { class: "bwz-lib-recent" }, h("h3", { class: "bwz-lib-title", text: "最近編輯" }), h("div", { class: "bwz-lib-items" }, ...recent(this.items, n).map((i) => i.render()))),
      h("section", { class: "bwz-lib-books" }, h("h3", { class: "bwz-lib-title", text: "依書卷" }), ...groupByBook(this.items).map((g) => this.renderBook(g))),
    )
  }

  private renderResults(): HTMLElement[] {
    const hits = this.items.filter((i) => matchesQuery(i, this.query)).sort(byPlace)
    if (hits.length === 0) return [h("p", { class: "bwz-n-empty", text: `沒有符合的${this.opts.unit.replace(/^[則張個]/, "")}。` })]
    const page = hits.slice(0, this.shown)
    const out: HTMLElement[] = [h("p", { class: "bwz-lib-count", text: `找到 ${hits.length} ${this.opts.unit}` }), h("div", { class: "bwz-lib-items" }, ...page.map((i) => i.render()))]
    if (hits.length > page.length) out.push(this.moreButton(hits.length - page.length))
    return out
  }

  private moreButton(rest: number): HTMLElement {
    const step = this.opts.pageSize ?? 20
    return h("button", {
      class: "bwz-n-btn bwz-lib-more",
      text: `再顯示 ${Math.min(step, rest)} ${this.opts.unit}（還有 ${rest}）`,
      attrs: { type: "button" },
      on: {
        click: () => {
          this.shown += step
          this.render()
        },
      },
    })
  }

  /** <details> 打開時才畫內容；記住打開狀態。 */
  private fold(key: string, summary: HTMLElement, content: () => HTMLElement[], cls: string): HTMLElement {
    const box = h("details", { class: cls }, summary)
    const fill = () => {
      if (box.childElementCount === 1) box.append(...content())
    }
    if (this.opened.has(key)) {
      box.open = true
      fill()
    }
    box.addEventListener("toggle", () => {
      if (box.open) {
        this.opened.add(key)
        fill()
      } else this.opened.delete(key)
    })
    return box
  }

  private renderBook(g: BookGroup): HTMLElement {
    const summary = h("summary", { class: "bwz-lib-sum" }, h("span", { class: "bwz-lib-name", text: g.label }), h("span", { class: "bwz-lib-num", text: String(g.count) }))
    const single = g.chapters.length === 1 && g.chapters[0].chapter === null
    return this.fold(g.key, summary, () => (single ? [h("div", { class: "bwz-lib-items" }, ...g.chapters[0].items.map((i) => i.render()))] : g.chapters.map((c) => this.renderChapter(c))), "bwz-lib-book")
  }

  private renderChapter(c: ChapterGroup): HTMLElement {
    const first = c.items[0]
    const label = first.book && c.chapter ? chapterLabel(first.book, c.chapter).replace(/^\S+?\s*(?=第)/, "") : "其他"
    const slug = first.book && c.chapter ? chapterSlug(first.book, c.chapter) : null
    const base = document.body.dataset.basepath ?? ""
    const summary = h(
      "summary",
      { class: "bwz-lib-sum" },
      h("span", { class: "bwz-lib-name", text: label }),
      h("span", { class: "bwz-lib-num", text: String(c.items.length) }),
      this.opts.chapterLinks && slug ? h("a", { class: "bwz-lib-go", text: "前往該章 →", attrs: { href: `${base}/${encodeURI(slug)}` } }) : null,
    )
    return this.fold(c.key, summary, () => [h("div", { class: "bwz-lib-items" }, ...c.items.map((i) => i.render()))], "bwz-lib-chapter")
  }
}
