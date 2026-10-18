// 章節頁底部的「我的筆記」面板（MVP：整章筆記＋手動節數，D-15）。

import type { Resolved } from "../../merge/merge"
import { chapterLabel } from "../../model/books"
import type { NoteRecord } from "../../model/record"
import { ConflictPendingError } from "../../repo/repository"
import type { Session } from "../../session/session"
import { dialog, formatTime, h, textBlock, toast, verseLabel } from "../../ui/dom"
import { statusBar } from "../../ui/status"
import type { View } from "../types"
import { NotesService } from "./notes"

const AUTOSAVE_MS = 600
const CONFLICT_TEXT = "這則筆記在其他裝置也被修改了，請先選擇要保留的版本"

type EditorRoot = HTMLElement & { flush?: () => Promise<void> }

interface EditorState {
  noteId: string | null
  root: EditorRoot
}

export class ChapterPanel implements View {
  private editor: EditorState | null = null
  private listEl!: HTMLElement
  private editorHost!: HTMLElement
  private statusEl!: HTMLElement
  private headerCount!: HTMLElement
  private unsubscribe: () => void
  private chip: HTMLElement | null = null
  private readonly notes: NotesService

  constructor(
    private readonly session: Session,
    private readonly mount: HTMLElement,
    private readonly book: string,
    private readonly chapter: number,
  ) {
    this.notes = new NotesService(() => session.repo)
    this.build()
    this.unsubscribe = session.onChange(() => this.refresh())
    this.refresh()
  }

  destroy(): void {
    // 換頁時編輯器裡還沒存的字先存起來（資料已在記憶體，不必等畫面）
    void this.editor?.root.flush?.()
    this.unsubscribe()
    this.chip?.remove()
    this.mount.replaceChildren()
  }

  private build(): void {
    this.headerCount = h("span", { class: "bwz-n-count" })
    this.statusEl = h("div")
    this.listEl = h("div", { class: "bwz-n-list" })
    this.editorHost = h("div", { class: "bwz-n-editor-host" })
    const addBtn = h("button", {
      class: "bwz-n-btn primary",
      text: "＋ 新增筆記",
      attrs: { type: "button" },
      on: { click: () => void this.openEditor(null, addBtn as HTMLButtonElement) },
    })
    const base = document.body.dataset.basepath ?? ""
    this.mount.replaceChildren(
      h("div", { class: "bwz-n-head" }, h("h2", { attrs: { id: "bwz-notes" } }, "我的筆記", this.headerCount), h("a", { class: "bwz-n-link", text: "全部筆記 →", attrs: { href: `${base}/my-notes` } })),
      this.statusEl,
      h("div", { class: "bwz-n-toolbar" }, addBtn),
      this.editorHost,
      this.listEl,
    )
    // 左下角的「筆記」按鈕：長章節可快速跳到面板（右下角是導覽說明按鈕，避免重疊）
    this.chip = h("button", {
      class: "bwz-n-chip",
      attrs: { type: "button", "aria-label": "跳到我的筆記" },
      on: { click: () => this.mount.scrollIntoView({ behavior: "smooth", block: "start" }) },
    })
    document.body.append(this.chip)
  }

  private chapterNotes(): Resolved[] {
    return this.notes.forChapter(this.book, this.chapter)
  }

  refresh(): void {
    this.session.resetOfflineAcknowledgement()
    const notes = this.chapterNotes()
    this.headerCount.textContent = notes.length ? `（${notes.length}）` : ""
    if (this.chip) this.chip.textContent = notes.length ? `📝 筆記 ${notes.length}` : "📝 筆記"
    this.statusEl.replaceChildren(statusBar(this.session))
    // 編輯器放在獨立容器，重畫列表時不移動它（避免打字時失去焦點）
    const editingId = this.editor?.noteId ?? null
    const cards: HTMLElement[] = []
    for (const r of notes) {
      if (r.id === editingId && r.conflicts.length === 0) continue
      cards.push(r.conflicts.length ? this.conflictCard(r) : this.noteCard(r.winner))
    }
    if (cards.length === 0 && !this.editor) {
      cards.push(h("p", { class: "bwz-n-empty", text: `還沒有${chapterLabel(this.book, this.chapter)}的筆記。按「新增筆記」開始寫。` }))
    }
    this.listEl.replaceChildren(...cards)
  }

  private noteCard(n: NoteRecord): HTMLElement {
    return h(
      "article",
      { class: "bwz-n-card" },
      h(
        "div",
        { class: "bwz-n-card-head" },
        h("span", { class: "bwz-n-verse", text: verseLabel(n.anchor.verseStart, n.anchor.verseEnd) }),
        n.title ? h("strong", { text: n.title }) : null,
        h("span", { class: "bwz-n-time", text: formatTime(n.updatedAt) }),
      ),
      textBlock(n.body),
      n.tags.length ? h("div", { class: "bwz-n-tags" }, ...n.tags.map((t) => h("span", { class: "bwz-n-tag", text: `#${t}` }))) : null,
      h(
        "div",
        { class: "bwz-n-card-actions" },
        h("button", { class: "bwz-n-btn small", text: "編輯", attrs: { type: "button" }, on: { click: (e) => void this.openEditor(n.id, e.currentTarget as HTMLButtonElement) } }),
        h("button", { class: "bwz-n-btn small danger", text: "刪除", attrs: { type: "button" }, on: { click: () => void this.confirmDelete(n) } }),
      ),
    )
  }

  /** 衝突卡片：兩個版本並排，使用者選定後才能繼續編輯（03 §4.4）。 */
  private conflictCard(r: Resolved): HTMLElement {
    const versions = [r.winner, ...r.conflicts]
    const choose = async (choice: { keep: string } | { keepBoth: true }) => {
      try {
        await this.notes.resolveConflict(r.id, choice)
        toast("已選定版本")
      } catch (e) {
        toast(e instanceof Error ? e.message : "處理失敗")
      }
    }
    return h(
      "article",
      { class: "bwz-n-card conflict" },
      h("p", { class: "bwz-n-warn", text: "這則筆記在兩台裝置上同時被修改了。請選擇要保留哪個版本：" }),
      h(
        "div",
        { class: "bwz-n-versions" },
        ...versions.map((v) =>
          h(
            "div",
            { class: "bwz-n-version" },
            h("div", { class: "bwz-n-card-head" }, h("span", { class: "bwz-n-time", text: `${formatTime(v.updatedAt)} 修改` })),
            v.deleted ? h("p", { class: "bwz-n-muted", text: "（這個版本把筆記刪除了）" }) : null,
            v.title ? h("strong", { text: v.title }) : null,
            v.deleted ? null : textBlock(v.body),
            h("button", { class: "bwz-n-btn small primary", text: v.deleted ? "刪除這則筆記" : "保留這個版本", attrs: { type: "button" }, on: { click: () => void choose({ keep: v.hlc }) } }),
          ),
        ),
      ),
      h("button", { class: "bwz-n-btn small", text: "兩個都保留（另存一則）", attrs: { type: "button" }, on: { click: () => void choose({ keepBoth: true }) } }),
    )
  }

  private async confirmDelete(n: NoteRecord): Promise<void> {
    const ok = await dialog({
      title: "刪除筆記",
      message: `確定要刪除「${n.title || n.body.slice(0, 20) || "這則筆記"}」嗎？`,
      buttons: [
        { id: "delete", label: "刪除", kind: "danger" },
        { id: "cancel", label: "取消" },
      ],
    })
    if (ok !== "delete") return
    if (!(await this.session.gateEdit())) return
    try {
      await this.notes.remove(n.id)
    } catch (e) {
      toast(e instanceof ConflictPendingError ? CONFLICT_TEXT : "刪除失敗")
    }
  }

  /** 開啟編輯器前先同步（D-03）。 */
  private async openEditor(noteId: string | null, trigger?: HTMLButtonElement): Promise<void> {
    if (this.editor) await this.closeEditor()
    const label = trigger?.textContent ?? ""
    if (trigger) {
      trigger.disabled = true
      trigger.textContent = "同步中…"
    }
    let allowed = false
    try {
      allowed = await this.session.gateEdit()
    } finally {
      if (trigger) {
        trigger.disabled = false
        trigger.textContent = label
      }
    }
    if (!allowed) return
    const existing = noteId ? this.notes.get(noteId) : undefined
    if (noteId && (!existing || existing.conflicts.length)) {
      toast("這則筆記剛在其他裝置被修改，請先選擇版本")
      this.refresh()
      return
    }
    this.editor = { noteId, root: this.buildEditor(existing?.winner ?? null) }
    this.editorHost.replaceChildren(this.editor.root)
    this.refresh()
    this.editor.root.querySelector<HTMLTextAreaElement>("textarea")?.focus()
  }

  private async closeEditor(): Promise<void> {
    const ed = this.editor
    if (!ed) return
    await ed.root.flush?.()
    this.editor = null
    this.editorHost.replaceChildren()
    this.refresh()
  }

  private buildEditor(note: NoteRecord | null): EditorRoot {
    const num = (v: number | null) => (v ? String(v) : "")
    const vStart = h("input", { class: "bwz-n-input small", attrs: { type: "number", min: "1", max: "200", inputmode: "numeric", placeholder: "起", "aria-label": "起始節" } })
    const vEnd = h("input", { class: "bwz-n-input small", attrs: { type: "number", min: "1", max: "200", inputmode: "numeric", placeholder: "迄", "aria-label": "結束節" } })
    const title = h("input", { class: "bwz-n-input", attrs: { type: "text", placeholder: "標題（可不填）", maxlength: "200" } })
    const body = h("textarea", { class: "bwz-n-textarea", attrs: { rows: "6", placeholder: "寫下你的研經筆記…可以用 [[人物]] 連到知識節點" } })
    const tags = h("input", { class: "bwz-n-input", attrs: { type: "text", placeholder: "標籤，用空白或逗號分隔（可不填）" } })
    const saved = h("span", { class: "bwz-n-muted", attrs: { "aria-live": "polite" } })
    vStart.value = num(note?.anchor.verseStart ?? null)
    vEnd.value = num(note?.anchor.verseEnd ?? null)
    title.value = note?.title ?? ""
    body.value = note?.body ?? ""
    tags.value = note?.tags.join(" ") ?? ""

    let timer: ReturnType<typeof setTimeout> | null = null
    let saving: Promise<void> = Promise.resolve()
    const read = () => {
      const s = Number.parseInt(vStart.value, 10)
      const e = Number.parseInt(vEnd.value, 10)
      const verseStart = Number.isInteger(s) && s > 0 ? s : null
      const verseEnd = verseStart && Number.isInteger(e) && e >= verseStart ? e : null
      return {
        book: this.book,
        chapter: this.chapter,
        verseStart,
        verseEnd,
        title: title.value.trim(),
        body: body.value,
        tags: tags.value.split(/[\s,，、]+/).filter(Boolean),
      }
    }
    const save = async () => {
      timer = null
      const input = read()
      const ed = this.editor
      if (!ed || ed.root !== root) return
      try {
        if (!ed.noteId) {
          if (!input.title && !input.body.trim()) return
          const created = await this.notes.create(input)
          ed.noteId = created.id
        } else {
          await this.notes.update(ed.noteId, input)
        }
        saved.textContent = this.session.account ? "已儲存，稍後自動同步" : "已儲存在這台裝置"
      } catch (e) {
        if (e instanceof ConflictPendingError) {
          toast(CONFLICT_TEXT)
          this.editor = null
          this.editorHost.replaceChildren()
          this.refresh()
        } else {
          saved.textContent = "儲存失敗"
          console.error("[personal-notes]", e)
        }
      }
    }
    const schedule = () => {
      saved.textContent = "編輯中…"
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => (saving = saving.then(save)), AUTOSAVE_MS)
    }
    for (const el of [vStart, vEnd, title, body, tags]) el.addEventListener("input", schedule)

    const root = h(
      "div",
      { class: "bwz-n-card editing" },
      h("div", { class: "bwz-n-row" }, h("label", { class: "bwz-n-label", text: "節數" }), vStart, h("span", { text: "–" }), vEnd, h("span", { class: "bwz-n-muted", text: "（不填＝整章）" })),
      title,
      body,
      tags,
      h(
        "div",
        { class: "bwz-n-card-actions" },
        saved,
        h("button", { class: "bwz-n-btn primary small", text: "完成", attrs: { type: "button" }, on: { click: () => void this.closeEditor() } }),
      ),
    ) as EditorRoot
    root.flush = async () => {
      if (timer) {
        clearTimeout(timer)
        saving = saving.then(save)
      }
      await saving
    }
    return root
  }
}
