// 畫重點與書籤的資料操作（12 C3）。和筆記一樣是 Repository 裡的紀錄，只是 type 不同：
// - highlight：錨定在某幾節；單一節的部分文字另外記下 quote（exact／prefix／suffix）與當時經文的雜湊。
// - bookmark：錨定在某一章（或某幾節）。
// 版本、合併、同步、匯出入都沿用 repo／sync，不需要另外處理。

import type { Resolved } from "../../merge/merge"
import { chapterAnchor, type NoteRecord } from "../../model/record"
import type { Repository } from "../../repo/repository"
import type { Quote } from "../../ui/verses"

export const HIGHLIGHT_TYPE = "highlight"
export const BOOKMARK_TYPE = "bookmark"

export interface HighlightInput {
  book: string
  chapter: number
  verseStart: number
  verseEnd: number | null
  /** 單一節裡的一段文字；null＝整節（跨多節時一律整節） */
  quote: Quote | null
  /** 畫的時候那幾節經文的雜湊（之後經文改過時可以察覺） */
  hash: string | null
}

const ofType = (type: string) => (r: Resolved) => r.winner.type === type && !r.winner.deleted

export class HighlightsService {
  constructor(private readonly repoOf: () => Repository) {}

  private get repo(): Repository {
    return this.repoOf()
  }

  highlightsIn(book: string, chapter: number): Resolved[] {
    return this.repo.inChapter(book, chapter).filter(ofType(HIGHLIGHT_TYPE))
  }

  bookmarksIn(book: string, chapter: number): Resolved[] {
    return this.repo.inChapter(book, chapter).filter(ofType(BOOKMARK_TYPE))
  }

  allHighlights(): Resolved[] {
    return this.repo.visible().filter(ofType(HIGHLIGHT_TYPE))
  }

  allBookmarks(): Resolved[] {
    return this.repo.visible().filter(ofType(BOOKMARK_TYPE))
  }

  addHighlight(i: HighlightInput): Promise<NoteRecord> {
    const verseEnd = i.verseEnd && i.verseEnd !== i.verseStart ? i.verseEnd : null
    const record = this.repo.draft({
      type: HIGHLIGHT_TYPE,
      anchor: { ...chapterAnchor(i.book, i.chapter, i.verseStart, verseEnd), kind: "verse", quote: verseEnd ? null : i.quote, textHash: i.hash },
      title: "",
      body: "",
      tags: [],
    })
    return this.repo.insert(record)
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id)
  }

  findNodeBookmark(slug: string): Resolved | undefined {
    return this.allBookmarks().find((r) => r.winner.anchor.kind === "node" && r.winner.anchor.node?.slug === slug)
  }

  async toggleNodeBookmark(slug: string, title: string): Promise<"added" | "removed"> {
    const existing = this.findNodeBookmark(slug)
    if (existing) {
      await this.repo.remove(existing.id)
      return "removed"
    }
    await this.repo.insert(this.repo.draft({
      type: BOOKMARK_TYPE,
      anchor: {
        kind: "node", ref: null, book: null, chapter: null,
        verseStart: null, verseEnd: null, endRef: null,
        quote: null, textHash: null, node: { slug, title },
      },
      title: "", body: "", tags: [],
    }))
    return "added"
  }

  /** 這一章（verseStart＝null）或這幾節的書籤。 */
  findBookmark(book: string, chapter: number, verseStart: number | null, verseEnd: number | null): Resolved | undefined {
    const end = verseEnd && verseEnd !== verseStart ? verseEnd : null
    return this.bookmarksIn(book, chapter).find((r) => r.winner.anchor.verseStart === verseStart && (r.winner.anchor.verseEnd ?? null) === end)
  }

  /** 有就移除、沒有就加上。 */
  async toggleBookmark(book: string, chapter: number, verseStart: number | null, verseEnd: number | null): Promise<"added" | "removed"> {
    const existing = this.findBookmark(book, chapter, verseStart, verseEnd)
    if (existing) {
      await this.repo.remove(existing.id)
      return "removed"
    }
    const end = verseEnd && verseEnd !== verseStart ? verseEnd : null
    await this.repo.insert(this.repo.draft({ type: BOOKMARK_TYPE, anchor: chapterAnchor(book, chapter, verseStart, end), title: "", body: "", tags: [] }))
    return "added"
  }
}
