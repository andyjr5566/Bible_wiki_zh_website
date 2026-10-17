// 「我的筆記」頁：全部筆記、搜尋、依書卷篩選、匯出入、帳號管理。

import type { Controller } from "../controller"
import { BOOKS, bookByCode, chapterLabel, chapterSlug } from "../model/books"
import type { Resolved } from "../merge/merge"
import { isIOS, isStandalone } from "../auth/gis"
import { formatTime, h, textBlock, toast, verseLabel } from "./dom"
import { statusBar } from "./status"

export class MyNotesPage {
  private query = ""
  private book = ""
  private listEl!: HTMLElement
  private statusEl!: HTMLElement
  private accountEl!: HTMLElement
  private bookSelect!: HTMLSelectElement
  private unsubscribe: () => void

  constructor(
    private readonly c: Controller,
    private readonly mount: HTMLElement,
  ) {
    this.build()
    this.unsubscribe = c.onChange(() => this.refresh())
    this.refresh()
  }

  destroy(): void {
    this.unsubscribe()
    this.mount.replaceChildren()
  }

  private build(): void {
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
    )
  }

  refresh(): void {
    this.c.resetOfflineAcknowledgement()
    this.statusEl.replaceChildren(statusBar(this.c, { showAccount: true }))
    this.renderAccount()
    this.renderBooks()
    this.renderList()
  }

  private renderAccount(): void {
    const c = this.c
    const parts: (HTMLElement | null)[] = []
    if (c.config.notice) parts.push(h("p", { class: "bwz-n-warn", text: c.config.notice }))
    if (!c.syncAvailable) {
      parts.push(h("p", { class: "bwz-n-muted", text: "目前未開放雲端同步，筆記只存在這台裝置。請記得定期匯出備份。" }))
    } else if (!c.account) {
      parts.push(h("p", { class: "bwz-n-muted", text: "登入 Google 後，筆記會存到你自己的 Google 雲端硬碟（隱藏資料夾），手機、平板、電腦都能看到同一份。本站看不到你雲端硬碟的其他檔案。" }))
    } else {
      parts.push(
        h("p", null, "目前登入：", h("strong", { text: c.account.displayName }), ` （${c.account.email}）`),
        h(
          "div",
          { class: "bwz-n-row" },
          h("button", { class: "bwz-n-btn", text: "登出", attrs: { type: "button" }, on: { click: () => void c.signOut() } }),
          h("button", { class: "bwz-n-btn", text: "中斷與 Google 的連線", attrs: { type: "button" }, on: { click: () => void c.disconnect() } }),
          h("button", { class: "bwz-n-btn danger", text: "刪除全部筆記", attrs: { type: "button" }, on: { click: () => void c.deleteEverything() } }),
        ),
      )
      // D-23：iPhone 加入主畫面後，本機筆記較不會被系統清除
      if (isIOS() && !isStandalone()) {
        parts.push(h("p", { class: "bwz-n-tip", text: "小提醒：在 iPhone 上把本站「加入主畫面」後再使用，筆記會更穩定地儲存在手機上，登入也更順。（主畫面圖示和 Safari 的儲存空間是分開的，請先登入同步。）" }))
      }
    }
    this.accountEl.replaceChildren(...parts.filter((x): x is HTMLElement => x !== null))
  }

  private renderBooks(): void {
    const counts = new Map<string, number>()
    for (const r of this.c.engine.visible()) {
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
    const all = [r.winner, ...r.conflicts]
    return all.some((v) => `${v.title}\n${v.body}\n${v.tags.join(" ")}`.toLowerCase().includes(this.query))
  }

  private renderList(): void {
    const base = document.body.dataset.basepath ?? ""
    const order = new Map(BOOKS.map((b, i) => [b.code, i]))
    const notes = this.c.engine
      .visible()
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
            bookByCode(a.book ?? "") ? null : h("span", { class: "bwz-n-muted", text: "（這一章的頁面尚未上線）" }),
          ),
        )
      }
      const n = r.winner
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
        ),
      )
    }
    this.listEl.replaceChildren(...items)
  }

  private exportFile(): void {
    const data = this.c.engine.exportData()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = h("a", { attrs: { href: url, download: `聖經筆記備份-${new Date().toISOString().slice(0, 10)}.json` } })
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
      const r = await this.c.engine.importData(data)
      toast(`匯入完成：新增 ${r.added}、更新 ${r.updated}、另存 ${r.copied}、略過 ${r.skipped}${r.invalid ? `、無效 ${r.invalid}` : ""}`)
    } catch (e) {
      toast(e instanceof Error ? `匯入失敗：${e.message}` : "匯入失敗")
    }
  }
}
