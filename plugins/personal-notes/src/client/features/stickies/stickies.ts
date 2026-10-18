// 便條紙的資料操作（12 N1、D-41）。和筆記一樣是 Repository 裡的紀錄，只是 type 是 "sticky"：
// - 錨定在某一節（anchor.kind "verse"、verseStart）；內文是短文字（純文字，不渲染 Markdown）。
// - 顏色存在紀錄的 color 欄位（舊版程式看不懂也會原樣保留，03 §4.7）。
// 版本、合併、同步、匯出入都沿用 repo／sync。

import type { Resolved } from "../../merge/merge"
import { chapterAnchor, type NoteRecord } from "../../model/record"
import type { ConflictChoice, Repository } from "../../repo/repository"

export const STICKY_TYPE = "sticky"
export const STICKY_MAX_LENGTH = 300
export const STICKY_COLORS = ["yellow", "pink", "green", "blue"] as const
export type StickyColor = (typeof STICKY_COLORS)[number]

export function stickyColor(r: NoteRecord): StickyColor {
  return STICKY_COLORS.includes(r.color as StickyColor) ? (r.color as StickyColor) : "yellow"
}

const clip = (text: string) => Array.from(text).slice(0, STICKY_MAX_LENGTH).join("")
const isSticky = (r: Resolved) => r.winner.type === STICKY_TYPE && !r.winner.deleted

export class StickiesService {
  constructor(private readonly repoOf: () => Repository) {}

  private get repo(): Repository {
    return this.repoOf()
  }

  /** 這一章的便條（依節數、再依建立時間）。 */
  inChapter(book: string, chapter: number): Resolved[] {
    return this.repo
      .inChapter(book, chapter)
      .filter(isSticky)
      .sort((a, b) => (a.winner.anchor.verseStart ?? 0) - (b.winner.anchor.verseStart ?? 0) || a.winner.createdAt.localeCompare(b.winner.createdAt))
  }

  all(): Resolved[] {
    return this.repo.visible().filter(isSticky)
  }

  get(id: string): Resolved | undefined {
    return this.repo.get(id)
  }

  add(book: string, chapter: number, verse: number, text: string, color: StickyColor): Promise<NoteRecord> {
    const record = this.repo.draft({
      type: STICKY_TYPE,
      anchor: { ...chapterAnchor(book, chapter, verse, null), kind: "verse" },
      title: "",
      body: clip(text),
      tags: [],
      color,
    })
    return this.repo.insert(record)
  }

  /** 改文字或顏色（有待選定的衝突時會丟例外，畫面要先讓使用者選版本）。 */
  update(id: string, changes: { text?: string; color?: StickyColor }): Promise<NoteRecord> {
    const r = this.repo.editable(id)
    return this.repo.replace(this.repo.revise(r, { body: changes.text === undefined ? undefined : clip(changes.text), color: changes.color }))
  }

  remove(id: string): Promise<void> {
    return this.repo.remove(id)
  }

  /** 剛刪除的便條放回去（內容、顏色、位置用刪除前的版本）。 */
  async restore(previous: NoteRecord): Promise<void> {
    const r = this.repo.get(previous.id)
    if (!r) return
    await this.repo.replace(this.repo.revise(r, { body: previous.body, color: previous.color, anchor: previous.anchor, deleted: false }))
  }

  resolveConflict(id: string, choice: ConflictChoice): Promise<void> {
    return this.repo.resolveConflict(id, choice)
  }
}
