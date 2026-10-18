// 筆記功能的資料操作：把畫面上的輸入（書卷、章、節、標題、內文、標籤）轉成紀錄（type "note"）。
// 版本、合併、同步都交給 repo／sync，這裡只決定「筆記」的欄位怎麼用。

import type { Resolved } from "../../merge/merge"
import { chapterAnchor, type NoteRecord } from "../../model/record"
import type { ConflictChoice, Repository } from "../../repo/repository"

export interface NoteInput {
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

  forChapter(book: string, chapter: number): Resolved[] {
    return this.repo.inChapter(book, chapter).filter(isNote)
  }

  get(id: string): Resolved | undefined {
    return this.repo.get(id)
  }

  create(input: NoteInput): Promise<NoteRecord> {
    const record = this.repo.draft({
      type: NOTE_TYPE,
      anchor: chapterAnchor(input.book, input.chapter, input.verseStart, input.verseEnd),
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
      const book = patch.book ?? a.book ?? "_FREE"
      const chapter = patch.chapter ?? a.chapter ?? 0
      const verseStart = patch.verseStart !== undefined ? patch.verseStart : a.verseStart
      const verseEnd = patch.verseEnd !== undefined ? patch.verseEnd : a.verseEnd
      const record = this.repo.revise(r, {
        anchor: { ...a, ...chapterAnchor(book, chapter, verseStart, verseEnd) },
        title: patch.title,
        body: patch.body,
        tags: patch.tags ? cleanTags(patch.tags) : undefined,
      })
      return this.repo.replace(record)
    })
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id)
  }

  resolveConflict(id: string, choice: ConflictChoice): Promise<void> {
    return this.repo.resolveConflict(id, choice)
  }
}
