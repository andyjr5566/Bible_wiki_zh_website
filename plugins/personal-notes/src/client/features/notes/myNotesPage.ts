// 「我的筆記」頁的筆記分頁（D-42）：最近編輯 10 則＋依書卷折疊、搜尋與標籤、兩行預覽的卡片；
// 帳號、備份與匯出、刪除放在外框的「⚙ 設定與備份」。外框與清單元件在 ui/myNotesShell.ts、ui/library.ts。

import type { Resolved } from "../../merge/merge"
import { chapterLabel, chapterSlug } from "../../model/books"
import { exportBackup, importBackup } from "../../repo/backup"
import type { Session } from "../../session/session"
import { dialog, formatTime, h, toast, verseLabel } from "../../ui/dom"
import { isIOS, isStandalone } from "../../ui/env"
import { Library, type LibraryItem } from "../../ui/library"
import { renderMarkdown } from "../../ui/markdown"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { View } from "../types"
import { loadResolver, type LinkResolver } from "./links"
import { exportMarkdownZip } from "./markdownExport"
import { NotesService } from "./notes"

export class MyNotesPage implements View {
  private readonly notes: NotesService
  private readonly shell: MyNotesShell
  private readonly library = new Library({ unit: "則筆記", empty: "還沒有筆記。到任何一章的頁面底部，按「新增筆記」開始寫。", chapterLinks: true })
  private readonly tagsEl = h("div", { class: "bwz-n-tag-filter" })
  private readonly fileInput = h("input", { attrs: { type: "file", accept: "application/json,.json", hidden: true } })
  private unsubscribe: () => void
  private pendingAnon = 0
  private resolver: LinkResolver | null = null
  private resolverRequested = false

  constructor(
    private readonly session: Session,
    private readonly host: HTMLElement,
  ) {
    this.notes = new NotesService(() => session.repo)
    this.shell = shellFor(host, session)
    this.fileInput.addEventListener("change", () => void this.importFile(this.fileInput))
    host.replaceChildren(this.tagsEl, this.library.el, this.fileInput)
    this.shell.addTab({
      id: "notes",
      label: "筆記",
      unit: "則筆記",
      order: 1,
      el: host,
      count: () => this.library.matchCount,
      total: () => this.notes.all().length,
      onQuery: (q) => {
        this.library.setQuery(q)
        this.renderTags()
      },
    })
    this.shell.addSection({ id: "account", title: "帳號與同步", order: 1, render: () => this.accountSection() })
    this.shell.addSection({ id: "backup", title: "備份與匯出", order: 2, render: () => this.backupSection() })
    this.shell.addSection({ id: "danger", title: "刪除資料", order: 9, render: () => this.dangerSection() })
    this.unsubscribe = session.onChange(() => this.refresh())
    this.refresh()
    void this.checkPendingAnon()
  }

  destroy(): void {
    this.unsubscribe()
    this.shell.removeTab("notes")
    for (const id of ["account", "backup", "danger"]) this.shell.removeSection(id)
    this.shell.setNotice("anon", null)
    this.host.replaceChildren()
  }

  refresh(): void {
    const all = this.notes.all()
    if (!this.resolverRequested && all.some((r) => r.winner.body.includes("[["))) {
      this.resolverRequested = true
      void loadResolver().then((res) => {
        this.resolver = res
        if (res) this.refresh()
      })
    }
    this.library.setItems(all.map((r) => this.item(r)))
    this.renderTags()
    this.renderNotice()
    this.shell.update()
  }

  // ---------- 清單 ----------

  private place(r: Resolved): string {
    const a = r.winner.anchor
    if (!a.book || !a.chapter) return "其他"
    return `${chapterLabel(a.book, a.chapter)}${a.verseStart ? ` ${verseLabel(a.verseStart, a.verseEnd)}` : ""}`
  }

  private item(r: Resolved): LibraryItem {
    const a = r.winner.anchor
    const place = this.place(r)
    return {
      id: r.id,
      book: a.book,
      chapter: a.chapter,
      verse: a.verseStart,
      updated: r.winner.updatedAt,
      text: [place, ...[r.winner, ...r.conflicts].flatMap((v) => [v.title, v.body])].join("\n"),
      tags: r.winner.tags,
      render: () => this.card(r, place),
    }
  }

  private body(text: string): HTMLElement {
    const res = this.resolver
    return renderMarkdown(text, res ? { resolveWiki: (t) => res.resolve(t) } : {})
  }

  /** 兩行預覽的卡片；內容較長時可以「展開全文」。 */
  private card(r: Resolved, place: string): HTMLElement {
    const base = document.body.dataset.basepath ?? ""
    const n = r.winner
    const a = n.anchor
    const slug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
    const preview = h("div", { class: "bwz-lib-preview" }, this.body(n.body))
    const long = n.body.length > 60 || n.body.trim().includes("\n")
    const card = h("article", { class: `bwz-n-card bwz-lib-card${long ? " long" : ""}${r.conflicts.length ? " conflict" : ""}`, data: { id: r.id } })
    const toggle = long
      ? h("button", {
          class: "bwz-lib-toggle",
          text: "展開全文",
          attrs: { type: "button", "aria-expanded": "false" },
          on: {
            click: () => {
              const open = card.classList.toggle("open")
              toggle!.textContent = open ? "收起" : "展開全文"
              toggle!.setAttribute("aria-expanded", String(open))
            },
          },
        })
      : null
    const parts: (HTMLElement | null)[] = [
      h(
        "div",
        { class: "bwz-n-card-head" },
        h("span", { class: "bwz-lib-place", text: place }),
        n.title ? h("strong", { class: "bwz-lib-heading", text: n.title }) : null,
        h("span", { class: "bwz-n-time", text: formatTime(n.updatedAt) }),
      ),
      r.conflicts.length ? h("p", { class: "bwz-n-warn", text: "有兩個版本待選擇，請到該章頁面處理。" }) : null,
      preview,
      h(
        "div",
        { class: "bwz-lib-card-foot" },
        n.tags.length ? h("span", { class: "bwz-n-tags" }, ...n.tags.map((t) => h("span", { class: "bwz-n-tag", text: `#${t}` }))) : null,
        toggle,
        slug ? h("a", { class: "bwz-n-link", text: r.conflicts.length ? "前往該章選擇版本 →" : "前往該章編輯 →", attrs: { href: `${base}/${encodeURI(slug)}#bwz-note-${r.id}` } }) : null,
      ),
    ]
    card.append(...parts.filter((x): x is HTMLElement => x !== null))
    return card
  }

  /** 所有標籤與筆數；點一下就加進搜尋，再點一次取消（12 C5）。 */
  private renderTags(): void {
    const counts = new Map<string, number>()
    for (const r of this.notes.all()) for (const t of r.winner.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    if (counts.size === 0) {
      this.tagsEl.replaceChildren()
      return
    }
    const terms = this.shell.currentQuery.toLowerCase().split(/\s+/).filter(Boolean)
    const chips = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-Hant"))
      .map(([tag, n]) => {
        const term = `#${tag.toLowerCase()}`
        const on = terms.includes(term)
        return h("button", {
          class: `bwz-n-tag${on ? " on" : ""}`,
          text: `#${tag}（${n}）`,
          attrs: { type: "button", "aria-pressed": String(on) },
          on: { click: () => this.shell.setQuery((on ? terms.filter((t) => t !== term) : [...terms, term]).join(" ")) },
        })
      })
    this.tagsEl.replaceChildren(h("span", { class: "bwz-n-muted", text: "標籤：" }), ...chips)
  }

  // ---------- 分頁上方的提醒 ----------

  private async checkPendingAnon(): Promise<void> {
    const n = await this.session.pendingAnonymousCount().catch(() => 0)
    if (n !== this.pendingAnon) {
      this.pendingAnon = n
      this.renderNotice()
    }
  }

  private renderNotice(): void {
    const s = this.session
    if (!s.account || this.pendingAnon === 0) {
      this.shell.setNotice("anon", null)
      return
    }
    this.shell.setNotice(
      "anon",
      h(
        "div",
        { class: "bwz-n-tip" },
        h("p", { text: `這台裝置還有 ${this.pendingAnon} 則未登入時寫的筆記，還沒加入這個帳號。` }),
        h("button", { class: "bwz-n-btn primary small", text: "加入這個帳號", attrs: { type: "button" }, on: { click: () => void s.adoptAnonymousNow().then(() => this.checkPendingAnon()) } }),
      ),
    )
  }

  // ---------- ⚙ 設定與備份 ----------

  private accountSection(): HTMLElement {
    const s = this.session
    const parts: (HTMLElement | null)[] = []
    if (s.config.notice) parts.push(h("p", { class: "bwz-n-warn", text: s.config.notice }))
    if (!s.syncAvailable) {
      parts.push(h("p", { class: "bwz-n-muted", text: "目前未開放雲端同步，筆記只存在這台裝置。請記得定期匯出備份。" }))
    } else if (!s.account) {
      parts.push(h("p", { class: "bwz-n-muted", text: "登入 Google 後，筆記會存到你自己的 Google 雲端硬碟裡本站專用的隱藏空間，手機、平板、電腦都能看到同一份。本站看不到你雲端硬碟的其他檔案。" }))
      parts.push(h("p", { class: "bwz-n-muted", text: "要登入，請按頁面上方狀態列的「用 Google 同步」。" }))
    } else {
      parts.push(
        h("p", null, "目前登入：", h("strong", { text: s.account.displayName }), ` （${s.account.email}）`),
        h(
          "div",
          { class: "bwz-n-row" },
          h("button", { class: "bwz-n-btn", text: "登出", attrs: { type: "button" }, on: { click: () => void s.signOut() } }),
          h("button", { class: "bwz-n-btn", text: "中斷與 Google 的連線", attrs: { type: "button" }, on: { click: () => void s.disconnect() } }),
        ),
      )
    }
    // D-23：iPhone 加入主畫面後，本機筆記較不會被系統清除（Antigravity M-08）
    if (isIOS() && !isStandalone()) {
      parts.push(
        h("p", {
          class: "bwz-n-tip",
          text: s.account
            ? "小提醒：在 iPhone 上把本站「加入主畫面」後再使用，筆記會更穩定地儲存在手機上，登入也更順。（主畫面圖示和 Safari 的儲存空間是分開的，請先登入同步。）"
            : "小提醒：iPhone 長時間沒開的網站資料可能被系統清除。建議登入 Google 同步，或把本站「加入主畫面」並定期匯出備份。",
        }),
      )
    }
    return h("div", null, ...parts)
  }

  private backupSection(): HTMLElement {
    return h(
      "div",
      null,
      h("p", { class: "bwz-n-muted", text: "匯出的 JSON 檔包含你所有的筆記、便條、重點與書籤，可以隨時再匯入（重複匯入不會產生重複）。Markdown 檔可以直接放進 Obsidian 等筆記軟體閱讀（只匯出、不能匯入回來）。" }),
      h(
        "div",
        { class: "bwz-n-row" },
        h("button", { class: "bwz-n-btn", text: "匯出備份（JSON）", attrs: { type: "button" }, on: { click: () => this.exportFile() } }),
        h("button", { class: "bwz-n-btn", text: "從備份匯入", attrs: { type: "button" }, on: { click: () => this.fileInput.click() } }),
        h("button", { class: "bwz-n-btn", text: "匯出 Markdown（Obsidian）", attrs: { type: "button" }, on: { click: () => this.exportMarkdown() } }),
      ),
    )
  }

  private dangerSection(): HTMLElement {
    const s = this.session
    if (s.account) {
      return h(
        "div",
        null,
        h("p", { class: "bwz-n-muted", text: "刪除雲端與這台裝置上的所有筆記、便條、重點與書籤，無法復原。建議先匯出備份。" }),
        h("button", { class: "bwz-n-btn danger", text: "刪除全部筆記", attrs: { type: "button" }, on: { click: () => void s.deleteEverything() } }),
      )
    }
    if (this.session.repo.visible().length > 0) {
      // 未登入也要能一次清掉（公用電腦）
      return h(
        "div",
        null,
        h("p", { class: "bwz-n-muted", text: "清除這台裝置上未登入時寫的所有資料，無法復原。" }),
        h("button", { class: "bwz-n-btn danger", text: "清除這台裝置上的筆記", attrs: { type: "button" }, on: { click: () => void this.clearLocal() } }),
      )
    }
    return h("p", { class: "bwz-n-muted", text: "目前沒有可以刪除的資料。" })
  }

  private async clearLocal(): Promise<void> {
    const choice = await dialog({
      title: "清除這台裝置上的筆記",
      message: "這會刪除這台裝置上所有未登入時寫的筆記，無法復原。建議先按「匯出備份」。",
      buttons: [
        { id: "clear", label: "清除", kind: "danger" },
        { id: "cancel", label: "取消", autofocus: true },
      ],
    })
    if (choice !== "clear") return
    await this.session.clearLocal()
    toast("已清除這台裝置上的筆記")
  }

  private exportFile(): void {
    const data = exportBackup(this.session.repo)
    if (data.records.length === 0) {
      toast("目前沒有筆記可以匯出")
      return
    }
    this.download(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }), `聖經筆記備份-${new Date().toISOString().slice(0, 10)}.json`)
    toast(`已匯出 ${data.records.length} 則筆記`)
  }

  /** 匯出成 Obsidian 可用的 Markdown 檔（ZIP，12 C4）。 */
  private exportMarkdown(): void {
    const base = `${location.origin}${document.body.dataset.basepath ?? ""}`
    const { zip, count } = exportMarkdownZip([...this.notes.all(), ...this.session.repo.visible().filter((r) => r.winner.type === "sticky")], (book, chapter) => {
      const slug = chapterSlug(book, chapter)
      return slug ? `${base}/${encodeURI(slug)}` : null
    })
    if (count === 0) {
      toast("目前沒有筆記可以匯出")
      return
    }
    this.download(new Blob([zip as BlobPart], { type: "application/zip" }), `聖經筆記-${new Date().toISOString().slice(0, 10)}.zip`)
    toast(`已匯出 ${count} 個 Markdown 檔（ZIP）`)
  }

  /** 下載檔案。加 data-router-ignore：Quartz 的 SPA 會把同源的 blob 連結當成換頁攔截。 */
  private download(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob)
    const a = h("a", { attrs: { href: url, download: filename, "data-router-ignore": true } })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }

  private async importFile(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const r = await importBackup(this.session.repo, data)
      toast(`匯入完成：新增 ${r.added}、更新 ${r.updated}、另存 ${r.copied}、略過 ${r.skipped}${r.invalid ? `、無效 ${r.invalid}` : ""}`)
    } catch (e) {
      toast(e instanceof Error ? `匯入失敗：${e.message}` : "匯入失敗")
    }
  }
}
