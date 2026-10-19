// 筆記面板：章節頁底部（整章筆記＋手動節數，D-15）與知識庫條目頁（D-47）共用同一份編輯器、卡片、衝突與草稿程式。
// 差別只在「目標」（PanelTarget）：筆記掛在哪、怎麼查、標題與提示文字、有沒有節數與經節標記。

import type { Resolved } from "../../merge/merge"
import { chapterLabel } from "../../model/books"
import type { NoteRecord } from "../../model/record"
import { ConflictPendingError } from "../../repo/repository"
import type { Session } from "../../session/session"
import { dialog, formatTime, h, toast, verseLabel } from "../../ui/dom"
import { renderMarkdown } from "../../ui/markdown"
import { annotateVerses, verseElement } from "../../ui/verses"
import { statusBar } from "../../ui/status"
import { COMPOSE_NOTE_EVENT, type ComposeNoteDetail, type View } from "../types"
import { applyDraft, clearDraft, newDraftKey, recoverableDrafts, releaseDraftKey, tabId, withDraftLock, writeDraft } from "./drafts"
import { attachLinkComplete } from "./linkComplete"
import { loadLinkIndex } from "../../ui/linkIndex"
import { loadResolver, type LinkResolver } from "./links"
import { NotesService, type NodeRef, type NoteInput } from "./notes"
import { relatedNotes } from "./related"
import { RelatedList } from "./relatedList"

const AUTOSAVE_MS = 600
const CONFLICT_TEXT = "這則筆記在其他裝置也被修改了，請先選擇要保留的版本"

type EditorRoot = HTMLElement & {
  /** 把還沒存的輸入存完；回傳 false 代表儲存失敗（輸入仍在編輯框裡）。 */
  flush?: () => Promise<boolean>
  /** 目前的輸入是否至少有一份本機草稿備份。 */
  backedUp?: () => boolean
  /** 同步狀態改變時更新「已儲存／已同步」文字（C9）。 */
  refreshSaved?: () => void
  draftKey?: string
}

/** 開新筆記時預先填好的內容（從經文選取「寫筆記」時）。 */
interface Prefill {
  verseStart: number | null
  verseEnd: number | null
  body: string
}

/** 面板的目標：這個面板管哪一組筆記。章節頁用 chapterTarget、條目頁用 entryTarget。 */
export interface PanelTarget {
  readonly kind: "chapter" | "entry"
  /** 有節數欄位、經節 📝 標記、網址 #v5 定位與「寫筆記」工具列事件（只有章節頁）。 */
  readonly verses: boolean
  /** 條目頁的條目（章節頁沒有）。 */
  readonly node?: NodeRef
  readonly addLabel: string
  readonly emptyText: string
  /** 新筆記與草稿的位置欄位（章節：book／chapter；條目：node，book／chapter 填 ""、0）。 */
  place(): Pick<NoteInput, "book" | "chapter" | "node">
  /** 目標底下的筆記（不含其他種類的紀錄）。 */
  notesOf(svc: NotesService): Resolved[]
  /** 畫重點工具列的「寫筆記」是不是要開在這個面板。 */
  acceptsCompose(d: ComposeNoteDetail): boolean
}

export function chapterTarget(book: string, chapter: number): PanelTarget {
  return {
    kind: "chapter",
    verses: true,
    addLabel: "＋ 新增筆記",
    emptyText: `還沒有${chapterLabel(book, chapter)}的筆記。按「新增筆記」開始寫。`,
    place: () => ({ book, chapter }),
    notesOf: (svc) => svc.forChapter(book, chapter),
    acceptsCompose: (d) => d.book === book && d.chapter === chapter,
  }
}

export function entryTarget(node: NodeRef): PanelTarget {
  return {
    kind: "entry",
    verses: false,
    node,
    addLabel: `＋ 寫一則關於〈${node.title}〉的筆記`,
    emptyText: `還沒有關於〈${node.title}〉的筆記。按上面的按鈕開始寫。`,
    place: () => ({ book: "", chapter: 0, node: { slug: node.slug, title: node.title } }),
    notesOf: (svc) => svc.forEntry(node.slug),
    acceptsCompose: () => false,
  }
}

interface EditorState {
  noteId: string | null
  root: EditorRoot
}

export class NotesPanel implements View {
  private editor: EditorState | null = null
  private listEl!: HTMLElement
  private editorHost!: HTMLElement
  private statusEl!: HTMLElement
  private headerCount!: HTMLElement
  private unsubscribe: () => void
  private chip: HTMLElement | null = null
  private addBtn!: HTMLButtonElement
  private readonly notes: NotesService
  private cleanups: (() => void)[] = []
  private resolver: LinkResolver | null = null
  private resolverRequested = false
  /** 條目頁的「我的相關筆記」（F5b）與條目的別名（來自連結索引）。 */
  private related: RelatedList | null = null
  private entryAliases: string[] = []

  constructor(
    private readonly session: Session,
    private readonly mount: HTMLElement,
    private readonly target: PanelTarget,
  ) {
    this.notes = new NotesService(() => session.repo)
    this.build()
    this.unsubscribe = session.onChange(() => this.refresh())
    // 切換帳號前把編輯中的內容存進原本的帳號，並關掉編輯器（Codex 畫面審查 #3）。
    // 存不進去、草稿備份也失敗時，丟出錯誤讓 session 不要切換（Codex 第二輪 #7）。
    this.cleanups.push(
      session.onBeforeSwitch(async () => {
        const ed = this.editor
        if (!ed) return
        const ok = (await ed.root.flush?.()) ?? true
        if (!ok && !ed.root.backedUp?.()) throw new Error("編輯中的筆記存不進去")
        await this.closeEditor(true)
      }),
    )
    // 分頁被隱藏或關閉時立刻存（Codex 畫面審查 #4）
    const flushNow = () => void this.editor?.root.flush?.()
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushNow()
    }
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("pagehide", flushNow)
    this.cleanups.push(
      () => document.removeEventListener("visibilitychange", onVisibility),
      () => window.removeEventListener("pagehide", flushNow),
    )
    this.refresh()
    void this.recoverDrafts()
    // 從「我的筆記」頁點過來（網址帶 #bwz-notes）：面板是後來才畫出的，瀏覽器不會自己捲過來
    const hash = decodeURIComponent(location.hash)
    if (hash === "#bwz-notes") requestAnimationFrame(() => this.mount.scrollIntoView({ block: "start" }))
    else if (hash.startsWith("#bwz-note-")) requestAnimationFrame(() => this.focusNote(hash.slice("#bwz-note-".length)))
    else if (this.target.verses && /^#v\d+$/.test(hash)) requestAnimationFrame(() => this.focusVerse(Number(hash.slice(2))))
    // 畫重點工具列的「寫筆記」（features/types.ts 的事件約定）；條目頁沒有經文，不接收
    if (this.target.verses) {
      const onCompose = (e: Event) => {
        const d = (e as CustomEvent<ComposeNoteDetail>).detail
        if (!d || !this.target.acceptsCompose(d)) return
        void this.openEditor(null, undefined, { verseStart: d.verseStart, verseEnd: d.verseEnd, body: d.quote ? `> ${d.quote}\n\n` : "" })
      }
      document.addEventListener(COMPOSE_NOTE_EVENT, onCompose)
      this.cleanups.push(() => document.removeEventListener(COMPOSE_NOTE_EVENT, onCompose))
    }
  }

  destroy(): void {
    // 換頁時編輯器裡還沒存的字先存起來（資料已在記憶體，不必等畫面）；存完才把草稿交給補存機制
    const ed = this.editor
    if (ed) {
      const key = ed.root.draftKey
      void (ed.root.flush?.() ?? Promise.resolve(true)).finally(() => key && releaseDraftKey(key))
    }
    this.unsubscribe()
    for (const fn of this.cleanups) fn()
    if (this.target.verses) for (const b of Array.from(document.querySelectorAll(".bwz-v-badge"))) b.remove()
    this.chip?.remove()
    this.mount.classList.remove("bwz-n-entry-panel")
    this.mount.replaceChildren()
  }

  /** 上次分頁關掉、重新整理或切換帳號時沒來得及存的草稿，補存回去（每次進入章節頁或條目頁都檢查；章節與條目的草稿互通）。 */
  private async recoverDrafts(): Promise<void> {
    const ns = this.session.account?.permissionId ?? "anon"
    let recovered = 0
    for (const { key, draft } of recoverableDrafts(ns)) {
      await withDraftLock(key, async () => {
        try {
          if (await applyDraft(this.notes, draft)) recovered++
          clearDraft(key) // 確定寫進去（或確認不需要）才刪除；失敗就留著下次再試
        } catch (e) {
          console.error("[personal-notes] 補存草稿失敗", e)
        }
      })
    }
    if (recovered > 0) toast(recovered === 1 ? "已補存上次還沒存到的筆記" : `已補存 ${recovered} 則上次還沒存到的筆記`)
  }

  private build(): void {
    this.headerCount = h("span", { class: "bwz-n-count" })
    this.statusEl = h("div")
    this.listEl = h("div", { class: "bwz-n-list" })
    this.editorHost = h("div", { class: "bwz-n-editor-host" })
    const addBtn = h("button", {
      class: "bwz-n-btn primary",
      text: this.target.addLabel,
      attrs: { type: "button" },
      on: { click: () => void this.openEditor(null, addBtn) },
    })
    this.addBtn = addBtn
    const base = document.body.dataset.basepath ?? ""
    // 條目頁的掛載點是 display: contents（不佔版面），所以邊線與間距加在這個面板自己的容器上
    if (this.target.kind === "entry") this.mount.classList.add("bwz-n-entry-panel")
    this.mount.replaceChildren(
      h(
        "div",
        { class: "bwz-n-head" },
        h("h2", { attrs: { id: "bwz-notes" } }, "我的筆記", this.headerCount),
        h(
          "span",
          { class: "bwz-n-links" },
          h("a", { class: "bwz-n-link", text: "使用說明", attrs: { href: `${base}/${encodeURI("教學/個人筆記使用說明")}` } }),
          h("a", { class: "bwz-n-link", text: "全部筆記 →", attrs: { href: `${base}/my-notes` } }),
        ),
      ),
      this.statusEl,
      h("div", { class: "bwz-n-toolbar" }, addBtn),
      this.editorHost,
      this.listEl,
      // 預留給「我的相關筆記」（之後的任務在這裡畫清單；目前是空的，不佔版面）
      h("div", { class: "bwz-related-slot", attrs: { "data-slot": "related-notes" } }),
    )
    if (this.target.node) {
      this.related = new RelatedList(this.target.node.title)
      this.mount.querySelector(".bwz-related-slot")?.append(this.related.el)
    }
    // 左下角的「筆記」按鈕：長章節可快速跳到面板（右下角是導覽說明按鈕，避免重疊）；條目頁不需要
    if (this.target.verses) {
      this.chip = h("button", {
        class: "bwz-n-chip",
        attrs: { type: "button", "aria-label": "跳到我的筆記" },
        on: { click: () => this.mount.scrollIntoView({ behavior: "smooth", block: "start" }) },
      })
      document.body.append(this.chip)
    }
  }

  /** 捲到某一節經文並短暫標示（網址 #v5）。 */
  private focusVerse(v: number): void {
    const list = annotateVerses()
    const li = list ? verseElement(list, v) : null
    if (!li) return
    li.scrollIntoView({ block: "center" })
    li.classList.add("bwz-v-flash")
    setTimeout(() => li.classList.remove("bwz-v-flash"), 2600)
  }

  /** 有筆記的經節後面加上「📝」標記，點一下跳到那則筆記（12 C2）。 */
  private renderVerseBadges(notes: Resolved[]): void {
    const list = annotateVerses()
    for (const b of Array.from(document.querySelectorAll(".bwz-v-badge"))) b.remove()
    if (!list) return
    const byVerse = new Map<number, string[]>()
    for (const r of notes) {
      const v = r.winner.anchor.verseStart
      if (v) byVerse.set(v, [...(byVerse.get(v) ?? []), r.id])
    }
    for (const [v, ids] of byVerse) {
      const li = verseElement(list, v)
      if (!li) continue
      li.append(
        h("button", {
          class: "bwz-v-ui bwz-v-badge",
          text: ids.length > 1 ? `📝${ids.length}` : "📝",
          attrs: { type: "button", "aria-label": `第 ${v} 節有 ${ids.length} 則筆記`, title: "看這一節的筆記" },
          on: { click: () => this.focusNote(ids[0]) },
        }),
      )
    }
  }

  /** 捲到某一則筆記並短暫標示（從「我的筆記」頁點過來時，C10）。 */
  private focusNote(id: string): void {
    const card = this.listEl.querySelector<HTMLElement>(`[data-note-id="${CSS.escape(id)}"]`)
    if (!card) {
      this.mount.scrollIntoView({ block: "start" })
      return
    }
    card.scrollIntoView({ block: "center" })
    card.classList.add("bwz-n-flash")
    setTimeout(() => card.classList.remove("bwz-n-flash"), 2600)
  }

  /** 筆記內文（Markdown；[[條目]] 在連結索引載入後變成連結）。 */
  private body(text: string): HTMLElement {
    const r = this.resolver
    return renderMarkdown(text, r ? { resolveWiki: (t) => r.resolve(t) } : {})
  }

  /** 有筆記用到 [[條目]] 才下載連結索引，下載完重畫一次。 */
  private maybeLoadResolver(notes: Resolved[]): void {
    if (this.resolverRequested) return
    // 條目頁一定要下載：「我的相關筆記」要用連結索引比對 [[條目]] 與別名
    const entry = this.target.node
    if (!entry && !notes.some((r) => [r.winner, ...r.conflicts].some((v) => v.body.includes("[[")))) return
    this.resolverRequested = true
    void Promise.all([loadResolver(), entry ? loadLinkIndex() : Promise.resolve(null)]).then(([r, index]) => {
      this.resolver = r
      if (entry) this.entryAliases = index?.pages.find((p) => p.s === entry.slug)?.a ?? []
      if (r || entry) this.refresh()
    })
  }

  /** 條目頁：重算「我的相關筆記」。 */
  private renderRelated(own: Resolved[]): void {
    const entry = this.target.node
    if (!this.related || !entry) return
    const r = this.resolver
    const result = relatedNotes(this.notes.all(), { slug: entry.slug, title: entry.title, aliases: this.entryAliases }, (name) => r?.resolve(name) ?? null)
    this.related.update(result, document.body.dataset.basepath ?? "", own.length > 0)
  }

  refresh(): void {
    this.session.resetOfflineAcknowledgement()
    const notes = this.target.notesOf(this.notes)
    this.maybeLoadResolver(notes)
    this.renderRelated(notes)
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
      cards.push(h("p", { class: "bwz-n-empty", text: this.target.emptyText }))
    }
    this.listEl.replaceChildren(...cards)
    this.editor?.root.refreshSaved?.()
    if (this.target.verses) this.renderVerseBadges(notes)
  }

  private noteCard(n: NoteRecord): HTMLElement {
    return h(
      "article",
      { class: "bwz-n-card", attrs: { id: `bwz-note-${n.id}`, "data-note-id": n.id } },
      h(
        "div",
        { class: "bwz-n-card-head" },
        this.target.verses ? h("span", { class: "bwz-n-verse", text: verseLabel(n.anchor.verseStart, n.anchor.verseEnd) }) : null,
        n.title ? h("strong", { text: n.title }) : null,
        h("span", { class: "bwz-n-time", text: formatTime(n.updatedAt) }),
      ),
      this.body(n.body),
      n.tags.length ? h("div", { class: "bwz-n-tags" }, ...n.tags.map((t) => h("span", { class: "bwz-n-tag", text: `#${t}` }))) : null,
      h(
        "div",
        { class: "bwz-n-card-actions" },
        h("button", { class: "bwz-n-btn small", text: "編輯", attrs: { type: "button", "data-edit": n.id }, on: { click: (e) => void this.openEditor(n.id, e.currentTarget as HTMLButtonElement) } }),
        h("button", { class: "bwz-n-btn small danger", text: "刪除", attrs: { type: "button" }, on: { click: (e) => void this.confirmDelete(n, e.currentTarget as HTMLButtonElement) } }),
      ),
    )
  }

  /** 衝突卡片：兩個版本並排，使用者選定後才能繼續編輯（03 §4.4）。 */
  private conflictCard(r: Resolved): HTMLElement {
    const versions = [r.winner, ...r.conflicts]
    const me = this.session.repo.deviceId
    const liveCount = versions.filter((v) => !v.deleted).length
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
      { class: "bwz-n-card conflict", attrs: { id: `bwz-note-${r.id}`, "data-note-id": r.id } },
      h("p", { class: "bwz-n-warn", text: "這則筆記在兩台裝置上同時被修改了。請選擇要保留哪個版本：" }),
      h(
        "div",
        { class: "bwz-n-versions" },
        ...versions.map((v) =>
          h(
            "div",
            { class: "bwz-n-version" },
            h(
              "div",
              { class: "bwz-n-card-head" },
              this.target.verses ? h("span", { class: "bwz-n-verse", text: verseLabel(v.anchor.verseStart, v.anchor.verseEnd) }) : null,
              h("span", { class: "bwz-n-time", text: `${formatTime(v.updatedAt)} 在${v.author === me ? "這台裝置" : "其他裝置"}修改` }),
            ),
            v.deleted ? h("p", { class: "bwz-n-muted", text: "（這個版本把筆記刪除了）" }) : null,
            v.title ? h("strong", { text: v.title }) : null,
            v.deleted ? null : this.body(v.body),
            !v.deleted && v.tags.length ? h("div", { class: "bwz-n-tags" }, ...v.tags.map((t) => h("span", { class: "bwz-n-tag", text: `#${t}` }))) : null,
            h("button", { class: "bwz-n-btn small primary", text: v.deleted ? "刪除這則筆記" : "保留這個版本", attrs: { type: "button" }, on: { click: () => void choose({ keep: v.hlc }) } }),
          ),
        ),
      ),
      // 兩邊都有內容才需要「兩個都保留」；一刪一改時只要選一邊
      liveCount >= 2 ? h("button", { class: "bwz-n-btn small", text: "兩個都保留（另存一則）", attrs: { type: "button" }, on: { click: () => void choose({ keepBoth: true }) } }) : null,
    )
  }

  private async confirmDelete(n: NoteRecord, trigger?: HTMLButtonElement): Promise<void> {
    const ok = await dialog({
      title: "刪除筆記",
      message: `確定要刪除「${n.title || n.body.slice(0, 20) || "這則筆記"}」嗎？`,
      buttons: [
        { id: "delete", label: "刪除", kind: "danger" },
        { id: "cancel", label: "取消", autofocus: true },
      ],
    })
    if (ok !== "delete") return
    if (trigger) {
      trigger.disabled = true
      trigger.textContent = "刪除中…"
    }
    try {
      if (!(await this.session.gateEdit())) return
      await this.notes.remove(n.id)
    } catch (e) {
      toast(e instanceof ConflictPendingError ? CONFLICT_TEXT : "刪除失敗")
    } finally {
      if (trigger?.isConnected) {
        trigger.disabled = false
        trigger.textContent = "刪除"
      }
    }
  }

  /** 開啟編輯器前先同步（D-03）。 */
  private async openEditor(noteId: string | null, trigger?: HTMLButtonElement, prefill?: Prefill): Promise<void> {
    if (this.editor && !(await this.closeEditor())) return
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
    this.editor = { noteId, root: this.buildEditor(existing?.winner ?? null, prefill) }
    this.editorHost.replaceChildren(this.editor.root)
    this.refresh()
    const ta = this.editor.root.querySelector<HTMLTextAreaElement>("textarea")
    if (prefill) this.editor.root.scrollIntoView({ block: "center" })
    ta?.focus()
    ta?.setSelectionRange(ta.value.length, ta.value.length)
  }

  /**
   * 存完再關閉編輯器。儲存失敗時保留編輯器與內容，回傳 false（Codex 畫面審查 #1）。
   * force：切換帳號時無論如何都關閉（草稿備份仍留著，之後回到原帳號會補存）。
   */
  private async closeEditor(force = false): Promise<boolean> {
    const ed = this.editor
    if (!ed) return true
    const ok = (await ed.root.flush?.()) ?? true
    if (this.editor !== ed) return true // 存檔途中已因衝突改為另存並關閉
    if (!ok && !force) {
      toast("儲存失敗，內容還在編輯框裡。請稍後再按一次「完成」。")
      return false
    }
    // 標題與內容都清空了：當作不要這則（不留下空白卡片，Antigravity 審查 M-05）
    const current = ed.noteId ? this.notes.get(ed.noteId) : undefined
    if (current && !current.winner.deleted && current.conflicts.length === 0 && !current.winner.title && !current.winner.body.trim()) {
      await this.notes.remove(current.id).catch(() => undefined)
    }
    if (ed.root.draftKey) releaseDraftKey(ed.root.draftKey) // 強制關閉時草稿可能還在，之後回到這個帳號會補存
    this.editor = null
    this.editorHost.replaceChildren()
    this.refresh()
    // 焦點回到原本那則的「編輯」按鈕，或「新增筆記」（Codex 畫面審查 #9）
    const back = (ed.noteId && this.listEl.querySelector<HTMLElement>(`[data-edit="${ed.noteId}"]`)) || this.addBtn
    if (!force) back.focus()
    return true
  }

  private async savedText(): Promise<string> {
    if (!this.session.account) return "已儲存在這台裝置"
    switch (this.session.status.kind) {
      case "needs-reconnect":
        return "已存在這台裝置（按上方「繼續同步」才會上傳雲端）"
      case "offline":
      case "error":
        return "已存在這台裝置（恢復連線後自動同步）"
      case "ready":
        return (await this.session.repo.pendingShards()) > 0 ? "已儲存，幾秒後自動同步到雲端" : "已儲存並同步到雲端 ✓"
      default:
        return "已儲存，正在同步…"
    }
  }

  private buildEditor(note: NoteRecord | null, prefill?: Prefill): EditorRoot {
    const num = (v: number | null) => (v ? String(v) : "")
    const vStart = h("input", { class: "bwz-n-input small", attrs: { type: "number", min: "1", max: "200", inputmode: "numeric", placeholder: "起", "aria-label": "起始節" } })
    const vEnd = h("input", { class: "bwz-n-input small", attrs: { type: "number", min: "1", max: "200", inputmode: "numeric", placeholder: "迄", "aria-label": "結束節" } })
    const title = h("input", { class: "bwz-n-input", attrs: { type: "text", placeholder: "標題（可不填）", maxlength: "200", "aria-label": "筆記標題" } })
    const body = h("textarea", { class: "bwz-n-textarea", attrs: { rows: "6", placeholder: "寫下你的研經筆記或讀經心得…（可用 **粗體**、- 清單；輸入 [[ 可連到知識庫條目）", "aria-label": "筆記內容" } })
    const tags = h("input", { class: "bwz-n-input", attrs: { type: "text", placeholder: "標籤，用空白或逗號分隔（可不填）", "aria-label": "標籤" } })
    const saved = h("span", { class: "bwz-n-muted", attrs: { "aria-live": "polite" } })
    vStart.value = num(note?.anchor.verseStart ?? prefill?.verseStart ?? null)
    vEnd.value = num(note?.anchor.verseEnd ?? prefill?.verseEnd ?? null)
    title.value = note?.title ?? ""
    body.value = note?.body ?? prefill?.body ?? ""
    tags.value = note?.tags.join(" ") ?? ""

    const key = newDraftKey(this.session.account?.permissionId ?? "anon")
    let timer: ReturnType<typeof setTimeout> | null = null
    let saving: Promise<boolean> = Promise.resolve(true)
    /** 有輸入還沒成功存進 IndexedDB。 */
    let dirty = false
    /** 最後一次成功存檔（或開啟時）的版本：補存草稿時用來判斷筆記有沒有被別處改過。 */
    let baseHlc: string | null = note?.hlc ?? null
    let backupOk = true
    let savedOnce = false
    const showSaved = () =>
      void this.savedText().then((t) => {
        if (savedOnce && !dirty) saved.textContent = t
      })
    const inputs = [vStart, vEnd, title, body, tags]
    const read = (): NoteInput => {
      const s = Number.parseInt(vStart.value, 10)
      const e = Number.parseInt(vEnd.value, 10)
      const a = Number.isInteger(s) && s > 0 ? s : null
      const b = Number.isInteger(e) && e > 0 ? e : null
      // 只填一格就是單節；填反了自動對調，不要默默丟掉使用者填的節數
      const lo = a !== null && b !== null ? Math.min(a, b) : (a ?? b)
      const hi = a !== null && b !== null ? Math.max(a, b) : null
      const verseStart = lo
      const verseEnd = hi !== null && hi !== lo ? hi : null
      return {
        ...this.target.place(),
        verseStart,
        verseEnd,
        title: title.value.trim(),
        body: body.value,
        tags: tags.value.split(/[\s,，、]+/).filter(Boolean),
      }
    }
    const isMine = () => this.editor?.root === root
    const save = async (): Promise<boolean> => {
      timer = null
      const ed = this.editor
      if (!ed || ed.root !== root || !dirty) return true
      dirty = false
      const input = read()
      try {
        if (!ed.noteId) {
          if (!input.title && !input.body.trim()) {
            clearDraft(key)
            saved.textContent = "寫下標題或內容後會自動儲存"
            return true
          }
          const created = await this.notes.create(input)
          ed.noteId = created.id
          baseHlc = created.hlc
        } else {
          baseHlc = (await this.notes.update(ed.noteId, input)).hlc
        }
        // 存檔期間又有輸入：更新草稿（帶上新筆記的 id 與版本，重新整理後才不會重複建立，Codex 第二輪 #5）
        if (dirty) backup()
        else clearDraft(key)
        savedOnce = true
        showSaved()
        return true
      } catch (e) {
        if (e instanceof ConflictPendingError) {
          // 別台裝置同時改了這則：把正在寫的內容另存成新筆記，一個字都不丟（Codex 畫面審查 #2）。
          // 先鎖住輸入框再讀最新內容，存檔等待期間打的字也一起存（Codex 第二輪 #6）
          for (const el of inputs) el.readOnly = true
          const latest = read()
          try {
            await this.notes.create({ ...latest, title: `${latest.title || "筆記"}（衝突時的草稿）` })
            clearDraft(key)
            releaseDraftKey(key)
            toast("這則筆記在其他裝置也被修改了。你剛寫的內容已另存成一則新筆記；原本那則請選擇要保留的版本。")
            if (isMine()) {
              this.editor = null
              this.editorHost.replaceChildren()
              this.refresh()
              this.addBtn.focus()
            }
            return true
          } catch (e2) {
            for (const el of inputs) el.readOnly = false
            console.error("[personal-notes]", e2)
          }
        } else {
          console.error("[personal-notes]", e)
        }
        dirty = true
        saved.textContent = "儲存失敗，內容還在框裡"
        return false
      }
    }
    const backup = () => {
      const place = this.target.place()
      backupOk = writeDraft(key, { book: place.book, chapter: place.chapter, ...(place.node ? { node: place.node } : {}), noteId: isMine() ? this.editor!.noteId : null, baseHlc, input: read(), at: Date.now(), tab: tabId })
    }
    const schedule = () => {
      dirty = true
      saved.textContent = "編輯中…"
      backup()
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void (saving = saving.then(save)), AUTOSAVE_MS)
    }
    for (const el of inputs) el.addEventListener("input", schedule)

    const root = h(
      "div",
      { class: "bwz-n-card editing" },
      this.target.verses ? h("div", { class: "bwz-n-row" }, h("label", { class: "bwz-n-label", text: "節數" }), vStart, h("span", { text: "–" }), vEnd, h("span", { class: "bwz-n-muted", text: "（不填＝整章）" })) : null,
      title,
      body,
      attachLinkComplete(body).el,
      tags,
      h(
        "div",
        { class: "bwz-n-card-actions" },
        saved,
        h("button", { class: "bwz-n-btn primary small", text: "完成", attrs: { type: "button" }, on: { click: () => void this.closeEditor() } }),
      ),
    ) as EditorRoot
    // 一直存到沒有新輸入為止（等待期間又打字也會存到，Codex 畫面審查 #5）
    root.flush = async () => {
      for (let i = 0; i < 5; i++) {
        if (timer) {
          clearTimeout(timer)
          timer = null
        }
        const ok = await (saving = saving.then(save))
        if (!ok) return false
        if (!timer && !dirty) return true
      }
      return !dirty
    }
    root.backedUp = () => !dirty || backupOk
    root.refreshSaved = showSaved
    root.draftKey = key
    return root
  }
}
