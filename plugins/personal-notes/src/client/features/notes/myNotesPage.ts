// 「我的筆記」頁：全部筆記、搜尋、依書卷篩選、匯出入、帳號管理。

import type { Resolved } from "../../merge/merge"
import { BOOKS, chapterLabel, chapterSlug } from "../../model/books"
import { exportBackup, importBackup } from "../../repo/backup"
import type { Session } from "../../session/session"
import { dialog, formatTime, h, textBlock, toast, verseLabel } from "../../ui/dom"
import { isIOS, isStandalone } from "../../ui/env"
import { statusBar } from "../../ui/status"
import type { View } from "../types"
import { NotesService } from "./notes"

export class MyNotesPage implements View {
  private query = ""
  private book = ""
  private listEl!: HTMLElement
  private statusEl!: HTMLElement
  private accountEl!: HTMLElement
  private bookSelect!: HTMLSelectElement
  private unsubscribe: () => void
  private readonly notes: NotesService
  private pendingAnon = 0

  constructor(
    private readonly session: Session,
    private readonly mount: HTMLElement,
  ) {
    this.notes = new NotesService(() => session.repo)
    this.build()
    this.unsubscribe = session.onChange(() => this.refresh())
    this.refresh()
    void this.checkPendingAnon()
  }

  private async checkPendingAnon(): Promise<void> {
    const n = await this.session.pendingAnonymousCount().catch(() => 0)
    if (n !== this.pendingAnon) {
      this.pendingAnon = n
      this.renderAccount()
    }
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

  destroy(): void {
    this.unsubscribe()
    this.mount.replaceChildren()
  }

  private build(): void {
    const base = document.body.dataset.basepath ?? ""
    this.statusEl = h("div")
    this.accountEl = h("div", { class: "bwz-n-account-box" })
    const search = h("input", {
      class: "bwz-n-input",
      attrs: { type: "search", placeholder: "搜尋標題、內文、標籤…", "aria-label": "搜尋筆記" },
      on: {
        input: (e) => {
          this.query = (e.target as HTMLInputElement).value.trim().toLowerCase()
          this.renderList()
        },
      },
    })
    this.bookSelect = h("select", {
      class: "bwz-n-input",
      attrs: { "aria-label": "依書卷篩選" },
      on: {
        change: (e) => {
          this.book = (e.target as HTMLSelectElement).value
          this.renderList()
        },
      },
    })
    this.listEl = h("div", { class: "bwz-n-list" })
    const fileInput = h("input", { attrs: { type: "file", accept: "application/json,.json", hidden: true } })
    fileInput.addEventListener("change", () => void this.importFile(fileInput))
    this.mount.replaceChildren(
      this.statusEl,
      this.accountEl,
      h("div", { class: "bwz-n-filters" }, search, this.bookSelect),
      this.listEl,
      h(
        "section",
        { class: "bwz-n-section" },
        h("h3", { text: "備份" }),
        h("p", { class: "bwz-n-muted", text: "匯出的 JSON 檔包含你所有的筆記，可以隨時再匯入（重複匯入不會產生重複筆記）。" }),
        h(
          "div",
          { class: "bwz-n-row" },
          h("button", { class: "bwz-n-btn", text: "匯出備份（JSON）", attrs: { type: "button" }, on: { click: () => this.exportFile() } }),
          h("button", { class: "bwz-n-btn", text: "從備份匯入", attrs: { type: "button" }, on: { click: () => fileInput.click() } }),
          fileInput,
        ),
      ),
      h(
        "p",
        { class: "bwz-n-muted" },
        h("a", { text: "個人筆記使用說明", attrs: { href: `${base}/${encodeURI("教學/個人筆記使用說明")}` } }),
        "　·　",
        h("a", { text: "隱私權政策", attrs: { href: `${base}/${encodeURI("教學/隱私權政策")}` } }),
      ),
    )
  }

  refresh(): void {
    this.session.resetOfflineAcknowledgement()
    this.statusEl.replaceChildren(statusBar(this.session))
    this.renderAccount()
    this.renderBooks()
    this.renderList()
  }

  private renderAccount(): void {
    const s = this.session
    const parts: (HTMLElement | null)[] = []
    if (s.config.notice) parts.push(h("p", { class: "bwz-n-warn", text: s.config.notice }))
    if (!s.syncAvailable) {
      parts.push(h("p", { class: "bwz-n-muted", text: "目前未開放雲端同步，筆記只存在這台裝置。請記得定期匯出備份。" }))
    } else if (!s.account) {
      parts.push(h("p", { class: "bwz-n-muted", text: "登入 Google 後，筆記會存到你自己的 Google 雲端硬碟裡本站專用的隱藏空間，手機、平板、電腦都能看到同一份。本站看不到你雲端硬碟的其他檔案。" }))
    }
    if (!s.account && this.notes.all().length > 0) {
      // 未登入也要能一次清掉（公用電腦）
      parts.push(
        h("div", { class: "bwz-n-row" }, h("button", { class: "bwz-n-btn danger", text: "清除這台裝置上的筆記", attrs: { type: "button" }, on: { click: () => void this.clearLocal() } })),
      )
    }
    if (s.account) {
      parts.push(
        h("p", null, "目前登入：", h("strong", { text: s.account.displayName }), ` （${s.account.email}）`),
        h(
          "div",
          { class: "bwz-n-row" },
          h("button", { class: "bwz-n-btn", text: "登出", attrs: { type: "button" }, on: { click: () => void s.signOut() } }),
          h("button", { class: "bwz-n-btn", text: "中斷與 Google 的連線", attrs: { type: "button" }, on: { click: () => void s.disconnect() } }),
          h("button", { class: "bwz-n-btn danger", text: "刪除全部筆記", attrs: { type: "button" }, on: { click: () => void s.deleteEverything() } }),
        ),
      )
      if (this.pendingAnon > 0) {
        parts.push(
          h(
            "div",
            { class: "bwz-n-tip" },
            h("p", { text: `這台裝置還有 ${this.pendingAnon} 則未登入時寫的筆記，還沒加入這個帳號。` }),
            h("button", { class: "bwz-n-btn primary small", text: "加入這個帳號", attrs: { type: "button" }, on: { click: () => void s.adoptAnonymousNow().then(() => this.checkPendingAnon()) } }),
          ),
        )
      }
    }
    // D-23：iPhone 加入主畫面後，本機筆記較不會被系統清除（未登入的人更需要知道，Antigravity M-08）
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
    this.accountEl.replaceChildren(...parts.filter((x): x is HTMLElement => x !== null))
  }

  private renderBooks(): void {
    const counts = new Map<string, number>()
    for (const r of this.notes.all()) {
      const b = r.winner.anchor.book ?? ""
      counts.set(b, (counts.get(b) ?? 0) + 1)
    }
    const options = [h("option", { text: `全部書卷（${[...counts.values()].reduce((a, b) => a + b, 0)}）`, attrs: { value: "" } })]
    for (const b of BOOKS) {
      const n = counts.get(b.code)
      if (n) options.push(h("option", { text: `${b.name}（${n}）`, attrs: { value: b.code } }))
    }
    this.bookSelect.replaceChildren(...options)
    this.bookSelect.value = counts.has(this.book) ? this.book : ""
  }

  private matches(r: Resolved): boolean {
    if (this.book && r.winner.anchor.book !== this.book) return false
    if (!this.query) return true
    const q = this.query.replace(/^#/, "")
    const a = r.winner.anchor
    const place = a.book && a.chapter ? `${chapterLabel(a.book, a.chapter)} ${verseLabel(a.verseStart, a.verseEnd)}` : ""
    return [r.winner, ...r.conflicts].some((v) => `${place}\n${v.title}\n${v.body}\n${v.tags.join(" ")}`.toLowerCase().includes(q))
  }

  private renderList(): void {
    const base = document.body.dataset.basepath ?? ""
    const order = new Map(BOOKS.map((b, i) => [b.code, i]))
    const notes = this.notes
      .all()
      .filter((r) => this.matches(r))
      .sort((a, b) => {
        const x = a.winner.anchor
        const y = b.winner.anchor
        return (
          (order.get(x.book ?? "") ?? 999) - (order.get(y.book ?? "") ?? 999) ||
          (x.chapter ?? 0) - (y.chapter ?? 0) ||
          (x.verseStart ?? 0) - (y.verseStart ?? 0)
        )
      })
    if (notes.length === 0) {
      this.listEl.replaceChildren(h("p", { class: "bwz-n-empty", text: this.query || this.book ? "沒有符合的筆記。" : "還沒有筆記。到任何一章的頁面底部，按「新增筆記」開始寫。" }))
      return
    }
    const items: HTMLElement[] = []
    let lastGroup = ""
    for (const r of notes) {
      const a = r.winner.anchor
      const group = a.book && a.chapter ? `${a.book}.${a.chapter}` : "_"
      if (group !== lastGroup) {
        lastGroup = group
        const slug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
        const label = a.book && a.chapter ? chapterLabel(a.book, a.chapter) : "其他"
        items.push(
          h(
            "h3",
            { class: "bwz-n-group" },
            slug ? h("a", { text: label, attrs: { href: `${base}/${encodeURI(slug)}#bwz-notes` } }) : label,
          ),
        )
      }
      const n = r.winner
      const cardSlug = a.book && a.chapter ? chapterSlug(a.book, a.chapter) : null
      items.push(
        h(
          "article",
          { class: `bwz-n-card${r.conflicts.length ? " conflict" : ""}` },
          h(
            "div",
            { class: "bwz-n-card-head" },
            h("span", { class: "bwz-n-verse", text: verseLabel(a.verseStart, a.verseEnd) }),
            n.title ? h("strong", { text: n.title }) : null,
            h("span", { class: "bwz-n-time", text: formatTime(n.updatedAt) }),
          ),
          r.conflicts.length ? h("p", { class: "bwz-n-warn", text: "有兩個版本待選擇，請到該章頁面處理。" }) : null,
          textBlock(n.body),
          n.tags.length ? h("div", { class: "bwz-n-tags" }, ...n.tags.map((t) => h("span", { class: "bwz-n-tag", text: `#${t}` }))) : null,
          cardSlug
            ? h(
                "div",
                { class: "bwz-n-card-actions" },
                h("a", { class: "bwz-n-link", text: r.conflicts.length ? "前往該章選擇版本 →" : "前往該章編輯 →", attrs: { href: `${base}/${encodeURI(cardSlug)}#bwz-note-${r.id}` } }),
              )
            : null,
        ),
      )
    }
    this.listEl.replaceChildren(...items)
  }

  private exportFile(): void {
    const data = exportBackup(this.session.repo)
    if (data.records.length === 0) {
      toast("目前沒有筆記可以匯出")
      return
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = h("a", { attrs: { href: url, download: `聖經筆記備份-${new Date().toISOString().slice(0, 10)}.json`, "data-router-ignore": true } })
    document.body.append(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    toast(`已匯出 ${data.records.length} 則筆記`)
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
