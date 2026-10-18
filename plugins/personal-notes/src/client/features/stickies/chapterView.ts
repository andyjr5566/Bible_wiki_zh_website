import type { Resolved } from "../../merge/merge"
import type { Session } from "../../session/session"
import { h, toast } from "../../ui/dom"
import { annotateVerses, verseElement } from "../../ui/verses"
import { COMPOSE_STICKY_EVENT, type ComposeStickyDetail, type View } from "../types"
import { getStickyMode, onStickyModeChange, type StickyMode } from "./settings"
import { StickiesService, STICKY_COLORS, STICKY_MAX_LENGTH, stickyColor, type StickyColor } from "./stickies"

interface Card {
  el: HTMLElement
  id?: string
  verse: number
  editor?: HTMLTextAreaElement
  color: StickyColor
  saved: string
  timer?: ReturnType<typeof setTimeout>
  closing?: boolean
  signature?: string
}
const button = (text: string, run: () => void, label = text) => h("button", {
  class: "bwz-n-btn small bwz-v-ui", text, attrs: { type: "button", "aria-label": label }, on: { click: run },
})
function lastColor(): StickyColor {
  try { const c = localStorage.getItem("bwz-sticky-color"); return STICKY_COLORS.includes(c as StickyColor) ? c as StickyColor : "yellow" } catch { return "yellow" }
}

export class ChapterStickies implements View {
  private service: StickiesService
  private repo: Session["repo"]
  private cards = new Set<Card>()
  private overrides = new Map<string, StickyMode>()
  private mode = getStickyMode()
  private allMode?: StickyMode
  private queue: Promise<void> = Promise.resolve()
  private writing = 0
  private dead = false
  private pop?: HTMLElement
  private popId?: string
  private cleanups: (() => void)[] = []

  constructor(private readonly session: Session, private readonly host: HTMLElement, private readonly book: string, private readonly chapter: number) {
    this.repo = session.repo
    this.service = new StickiesService(() => this.repo)
    const compose = (e: Event) => {
      const d = (e as CustomEvent<ComposeStickyDetail>).detail
      if (d?.book === book && d.chapter === chapter && Number.isInteger(d.verse) && d.verse > 0) this.act(() => this.edit(undefined, d.verse))
    }
    const visibility = () => { if (document.hidden) this.act(() => this.flush()) }
    const outside = (e: Event) => { if (this.pop && !this.pop.contains(e.target as Node) && !(e.target as Element).closest?.(".bwz-sticky-icon")) this.closePop() }
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") this.closePop() }
    document.addEventListener(COMPOSE_STICKY_EVENT, compose)
    document.addEventListener("visibilitychange", visibility)
    document.addEventListener("click", outside)
    document.addEventListener("keydown", key)
    this.cleanups.push(
      () => document.removeEventListener(COMPOSE_STICKY_EVENT, compose),
      () => document.removeEventListener("visibilitychange", visibility),
      () => document.removeEventListener("click", outside),
      () => document.removeEventListener("keydown", key),
      session.onChange(() => this.refresh()),
      session.onBeforeSwitch(() => this.flush()),
      onStickyModeChange(mode => { this.mode = mode; this.allMode = undefined; this.overrides.clear(); this.closePop(); this.refresh() }),
    )
    this.refresh()
  }
  private act(run: () => Promise<unknown>): void {
    void run().catch(() => { if (!this.dead) toast("便條儲存失敗，請再試一次") })
  }
  // 所有寫入共用一條串列；一次失敗不阻塞後續重試。
  private enqueue(run: () => Promise<void>): Promise<void> {
    const next = this.queue.then(async () => {
      this.writing++
      try { await run() } finally { this.writing--; this.refresh() }
    })
    this.queue = next.catch(() => {})
    return next
  }
  private displayMode(id: string): StickyMode { return this.overrides.get(id) ?? this.allMode ?? this.mode }
  private clearCards(): void {
    for (const c of this.cards) { clearTimeout(c.timer); c.el.remove() }
    this.cards.clear()
    this.closePop()
  }
  private refresh(): void {
    if (this.dead || this.writing) return
    if (this.repo !== this.session.repo) { this.clearCards(); this.repo = this.session.repo; this.overrides.clear() }
    const records = this.service.inChapter(this.book, this.chapter)
    const byId = new Map(records.map(r => [r.id, r]))
    for (const c of this.cards) {
      if (c.id && !byId.has(c.id)) { clearTimeout(c.timer); c.el.remove(); this.cards.delete(c) }
    }
    const list = annotateVerses()
    if (list) for (const r of records) {
      let c = [...this.cards].find(c => c.id === r.id)
      if (!c) {
        const li = verseElement(list, r.winner.anchor.verseStart ?? 0)
        if (!li) continue
        c = { el: h("div", { class: "bwz-v-ui" }), id: r.id, verse: r.winner.anchor.verseStart!, color: stickyColor(r.winner), saved: "" }
        this.cards.add(c); li.append(c.el)
      }
      if (!c.editor) this.render(c, r)
    }
    if (this.popId) {
      const c = [...this.cards].find(c => c.id === this.popId)
      const r = byId.get(this.popId)
      if (!c || !r || this.displayMode(r.id) !== "icon") this.closePop()
      else this.showPop(c, r)
    }
    const hasOpen = records.some(r => this.displayMode(r.id) === "open")
    this.host.replaceChildren(...(records.length ? [h("div", { class: "bwz-sticky-bar bwz-n-row bwz-v-ui" },
      h("span", { class: "bwz-v-ui", text: "🗒 本章 " + records.length + " 張便條" }),
      button(hasOpen ? "全部收起" : "全部展開", () => { this.allMode = hasOpen ? "icon" : "open"; this.overrides.clear(); this.closePop(); this.refresh() }),
    )] : []))
  }
  private render(c: Card, r: Resolved): void {
    const mode = this.displayMode(r.id)
    const signature = JSON.stringify([r.winner, r.conflicts, mode])
    if (c.signature === signature) return
    c.signature = signature
    c.color = stickyColor(r.winner)
    c.el.dataset.id = r.id
    c.el.dataset.color = c.color
    if (mode === "icon") {
      c.el.className = "bwz-sticky-slot bwz-v-ui"
      const icon = button("🗒", () => this.showPop(c, r), "查看便條")
      icon.className = "bwz-sticky-icon bwz-v-ui"
      c.el.replaceChildren(icon)
    } else {
      c.el.className = "bwz-sticky bwz-v-ui"
      c.el.replaceChildren(...this.contents(c, r, false))
    }
  }
  private contents(c: Card, r: Resolved, pop: boolean): HTMLElement[] {
    if (r.conflicts.length) return [
      h("p", { class: "bwz-v-ui", text: "這張便條在兩台裝置上同時被改過，選一個要保留的：" }),
      ...[r.winner, ...r.conflicts].map(v => h("div", { class: "bwz-sticky-version bwz-v-ui" },
        h("div", { class: "bwz-sticky-text bwz-v-ui", text: v.body }),
        button("保留這個", () => this.act(async () => {
          if (await this.session.gateEdit()) await this.enqueue(() => this.service.resolveConflict(r.id, { keep: v.hlc }))
        })),
      )),
    ]
    return [
      h("div", { class: "bwz-sticky-text bwz-v-ui", text: r.winner.body, on: { click: () => this.act(() => this.edit(c)) } }),
      h("div", { class: "bwz-sticky-actions bwz-v-ui" },
        pop ? button("展開", () => { this.overrides.set(r.id, "open"); this.closePop(); this.refresh() }) : null,
        button(pop ? "編輯" : "✎ 編輯", () => this.act(() => this.edit(c)), "編輯便條"),
        pop ? null : button("－ 收起", () => { this.overrides.set(r.id, "icon"); this.refresh() }, "收起便條"),
        button(pop ? "刪除" : "✕ 刪除", () => this.act(() => this.remove(r.id)), "刪除便條"),
      ),
    ]
  }
  private closePop(): void { this.pop?.remove(); this.pop = undefined; this.popId = undefined }
  private showPop(c: Card, r: Resolved): void {
    this.closePop()
    const icon = c.el.querySelector<HTMLElement>(".bwz-sticky-icon")
    if (!icon) return
    const rect = icon.getBoundingClientRect()
    this.pop = h("div", { class: "bwz-sticky-pop bwz-v-ui", data: { color: stickyColor(r.winner) }, attrs: { role: "dialog", "aria-label": "便條" } }, ...this.contents(c, r, true))
    this.popId = r.id
    document.body.append(this.pop)
    this.pop.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - this.pop.offsetWidth - 8)) + window.scrollX + "px"
    this.pop.style.top = rect.bottom + window.scrollY + "px"
  }
  private async edit(existing?: Card, verse?: number): Promise<void> {
    if (!(await this.session.gateEdit()) || this.dead) return
    if (existing?.editor) { existing.editor.focus(); return }
    const r = existing?.id ? this.service.get(existing.id) : undefined
    if (existing && (!this.cards.has(existing) || !r || r.winner.deleted || r.conflicts.length)) return
    this.closePop()
    let c = existing
    if (!c) {
      const list = annotateVerses()
      const li = list && verse ? verseElement(list, verse) : null
      if (!li) return
      c = { el: h("div", { class: "bwz-sticky bwz-v-ui" }), verse: verse!, color: lastColor(), saved: "" }
      this.cards.add(c); li.append(c.el)
    }
    const card = c
    card.signature = undefined
    card.color = r ? stickyColor(r.winner) : card.color
    card.saved = r ? JSON.stringify([r.winner.body, card.color]) : ""
    card.el.className = "bwz-sticky bwz-v-ui"
    card.el.dataset.color = card.color
    const input = h("textarea", { class: "bwz-v-ui", attrs: { maxlength: String(STICKY_MAX_LENGTH), "aria-label": "便條內容" } })
    input.value = r?.winner.body ?? ""
    card.editor = input
    input.addEventListener("input", () => {
      clearTimeout(card.timer)
      card.timer = setTimeout(() => this.act(() => this.save(card)), 600)
    })
    input.addEventListener("blur", () => this.act(() => this.save(card)))
    input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.act(() => this.finish(card)) } })
    const colors = STICKY_COLORS.map(color => {
      const b = button(({ yellow: "黃", pink: "粉", green: "綠", blue: "藍" })[color], () => {
        if (card.closing) return
        card.color = color; card.el.dataset.color = color
        try { localStorage.setItem("bwz-sticky-color", color) } catch { /* 偏好儲存不可阻擋編輯 */ }
        colors.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.color === color)))
        this.act(() => this.save(card))
      })
      b.className = "bwz-sticky-color bwz-v-ui"; b.dataset.color = color
      b.setAttribute("aria-pressed", String(color === card.color))
      return b
    })
    card.el.replaceChildren(input, h("div", { class: "bwz-sticky-actions bwz-v-ui" }, ...colors, button("完成", () => this.act(() => this.finish(card)))))
    input.focus()
  }
  private save(c: Card, finish = false): Promise<void> {
    clearTimeout(c.timer)
    if (!c.editor) return this.queue
    const text = c.editor.value
    const color = c.color
    const repo = this.repo
    const service = new StickiesService(() => repo)
    return this.enqueue(async () => {
      if (finish && !text.trim()) {
        if (c.id) await service.remove(c.id)
        return
      }
      if (!c.id && !text.trim()) return
      const signature = JSON.stringify([text, color])
      if (c.saved === signature) return
      if (c.id) await service.update(c.id, { text, color })
      else { const record = await service.add(this.book, this.chapter, c.verse, text, color); c.id = record.id; c.el.dataset.id = record.id }
      c.saved = signature
    })
  }
  private async finish(c: Card): Promise<void> {
    if (!c.editor || c.closing) return
    c.closing = true
    c.editor.disabled = true
    try {
      await this.save(c, true)
      c.editor = undefined
      c.signature = undefined
      if (!c.id || !this.service.get(c.id) || this.service.get(c.id)!.winner.deleted) { c.el.remove(); this.cards.delete(c) }
      this.refresh()
    } finally { c.closing = false; if (c.editor) { c.editor.disabled = false; c.editor.focus() } }
  }
  private async flush(): Promise<void> { await Promise.all([...this.cards].filter(c => c.editor).map(c => this.save(c))) }
  private async remove(id: string): Promise<void> {
    if (!(await this.session.gateEdit()) || this.dead) return
    const repo = this.repo
    const service = new StickiesService(() => repo)
    await this.enqueue(async () => {
      const previous = service.get(id)?.winner
      if (!previous || previous.deleted) return
      await service.remove(id)
      this.closePop()
      toast("已刪除便條", { label: "復原", run: () => this.act(() => this.enqueue(() => service.restore(previous))) })
    })
  }
  destroy(): void {
    const pending = this.flush()
    this.dead = true
    this.cleanups.forEach(off => off())
    this.clearCards()
    this.host.replaceChildren()
    void pending.catch(() => toast("便條儲存失敗，請回到原章節確認"))
  }
}
