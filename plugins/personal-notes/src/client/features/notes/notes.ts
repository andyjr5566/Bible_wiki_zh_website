// 筆記功能的資料操作：把畫面上的輸入（書卷、章、節、標題、內文、標籤）轉成紀錄（type "note"）。
// 版本、合併、同步都交給 repo／sync，這裡只決定「筆記」的欄位怎麼用。

import type { Resolved } from "../../merge/merge"
import { chapterAnchor, type Anchor, type NoteRecord } from "../../model/record"
import type { ConflictChoice, Repository } from "../../repo/repository"

/** 知識庫條目（link_folder/ 下的頁面）：slug 是頁面 slug，title 是當時的條目名稱。 */
export interface NodeRef {
  slug: string
  title: string
}

export interface NoteInput {
  /**
   * 掛在知識庫條目上的筆記（F5，D-47）：有值時以條目為錨點，book／chapter／節數一律忽略
   * （慣例上填 ""、0、null）；沒有值就是章節筆記。
   */
  node?: NodeRef | null
  book: string
  chapter: number
  verseStart: number | null
  verseEnd: number | null
  title: string
  body: string
  tags: string[]
}

export const NOTE_TYPE = "note"

const isNote = (r: Resolved) => r.winner.type === NOTE_TYPE

/** 這則紀錄是否掛在知識庫條目上。 */
export const isNodeAnchor = (a: Pick<Anchor, "kind">) => a.kind === "node"

/** 條目錨點：欄位與 highlights.toggleNodeBookmark 的條目書籤相同（shard 為 _NODE）。 */
export function nodeAnchor(node: NodeRef): Anchor {
  return {
    kind: "node",
    ref: null,
    book: null,
    chapter: null,
    verseStart: null,
    verseEnd: null,
    endRef: null,
    quote: null,
    textHash: null,
    node: { slug: node.slug, title: node.title },
  }
}

function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim()).filter(Boolean))]
}

export class NotesService {
  /** repoOf：切換帳號時 Repository 會換成另一個，所以每次都重新取得。 */
  constructor(private readonly repoOf: () => Repository) {}

  private get repo(): Repository {
    return this.repoOf()
  }

  /** 所有筆記（不含其他種類的紀錄）。 */
  all(): Resolved[] {
    return this.repo.visible().filter(isNote)
  }

  /** 章節筆記（條目筆記沒有書卷與章，不會出現在這裡）。 */
  forChapter(book: string, chapter: number): Resolved[] {
    return this.repo.inChapter(book, chapter).filter((r) => isNote(r) && !isNodeAnchor(r.winner.anchor))
  }

  /** 掛在某個知識庫條目（依 slug）上的筆記，依建立時間排序。 */
  forEntry(slug: string): Resolved[] {
    return this.all()
      .filter((r) => isNodeAnchor(r.winner.anchor) && r.winner.anchor.node?.slug === slug)
      .sort((a, b) => a.winner.createdAt.localeCompare(b.winner.createdAt))
  }

  get(id: string): Resolved | undefined {
    return this.repo.get(id)
  }

  create(input: NoteInput): Promise<NoteRecord> {
    const record = this.repo.draft({
      type: NOTE_TYPE,
      anchor: input.node ? nodeAnchor(input.node) : chapterAnchor(input.book, input.chapter, input.verseStart, input.verseEnd),
      title: input.title,
      body: input.body,
      tags: cleanTags(input.tags),
    })
    return this.repo.insert(record)
  }

  /** 修改；有待選定的衝突時丟 ConflictPendingError。 */
  update(id: string, patch: Partial<NoteInput>): Promise<NoteRecord> {
    return this.repo.withCas(async () => {
      const r = this.repo.editable(id)
      const a = r.winner.anchor
      const record = this.repo.revise(r, {
        anchor: this.updatedAnchor(a, patch),
        title: patch.title,
        body: patch.body,
        tags: cleanTags(patch.tags ?? r.winner.tags),
      })
      return this.repo.replace(record)
    })
  }

  /**
   * 修改後的錨點（Codex Sol 審查 F5a #2–#4）：
   * - 條目筆記：只有明確換到另一個條目（patch.node 的 slug 不同）才換；同一個條目、只是頁面標題不同時保留原錨點。
   * - 章節筆記：收到條目資訊（跨種類輸入）一律忽略；沒帶位置欄位、或位置其實沒變時原樣保留（不覆蓋 quote 等欄位）；
   *   書卷是空的就不重建，不會掉進 "_FREE"。
   */
  private updatedAnchor(a: Anchor, patch: Partial<NoteInput>): Anchor {
    if (isNodeAnchor(a)) return patch.node && patch.node.slug !== a.node?.slug ? nodeAnchor(patch.node) : a
    if (patch.node) return a
    if (patch.book === undefined && patch.chapter === undefined && patch.verseStart === undefined && patch.verseEnd === undefined) return a
    const book = patch.book || a.book
    const chapter = patch.chapter || a.chapter
    if (!book || !chapter) return a
    const verseStart = patch.verseStart !== undefined ? patch.verseStart : a.verseStart
    const verseEnd = patch.verseEnd !== undefined ? patch.verseEnd : a.verseEnd
    const next = chapterAnchor(book, chapter, verseStart, verseEnd)
    const unchanged = next.book === a.book && next.chapter === a.chapter && next.verseStart === a.verseStart && (next.verseEnd ?? null) === (a.verseEnd ?? null)
    return unchanged ? a : { ...a, ...next }
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id)
  }

  resolveConflict(id: string, choice: ConflictChoice): Promise<void> {
    return this.repo.resolveConflict(id, choice)
  }
}
