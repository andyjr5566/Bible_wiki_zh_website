// 〈我的筆記〉頁「備份到 Google Drive」設定區塊與頂端的備份提醒（F3b，D-45、13 §2.2）。
// 按鈕的處理函式要同步呼叫 session.backupNow(true)／signInFromClick()（中間不能 await，否則瀏覽器會擋 Google 視窗）。

import type { ImportResult } from "../../repo/backup"
import type { BackupListing, BackupResult, LastBackup } from "../../session/driveBackup"
import type { Session } from "../../session/session"
import { dialog, h, toast } from "../../ui/dom"
import { downloadBackupFile } from "../../ui/backupFile"
import { shellFor, type MyNotesShell } from "../../ui/myNotesShell"
import type { View } from "../types"

export class BackupView implements View {
  private readonly shell: MyNotesShell
  private readonly unsubscribe: () => void
  private destroyed = false
  private renderVersion = 0

  constructor(private readonly session: Session, host: HTMLElement) {
    this.shell = shellFor(host, session)
    this.shell.addSection({ id: "drive-backup", title: "備份到 Google Drive", order: 2.5, render: () => this.renderSection() })
    this.unsubscribe = session.onChange(() => {
      void this.onSessionChange()
    })
    void this.onSessionChange()
  }

  destroy(): void {
    this.destroyed = true
    this.unsubscribe()
    this.shell.removeSection("drive-backup")
    this.shell.setNotice("backup-reminder", null)
  }

  private async onSessionChange(): Promise<void> {
    const reminder = await this.session.backupReminder().catch(() => null)
    if (this.destroyed) return
    if (!reminder) {
      this.shell.setNotice("backup-reminder", null)
      return
    }
    const last = await this.session.lastBackup().catch(() => null)
    if (this.destroyed) return
    if (reminder.show) this.shell.setNotice("backup-reminder", this.reminderElement(reminder.daysSince, reminder.failures))
    else if (last && last.failures >= 3) this.shell.setNotice("backup-reminder", this.reminderElement(null, last.failures))
    else this.shell.setNotice("backup-reminder", null)
  }

  private reminderElement(days: number | null, failures: number): HTMLElement {
    const s = this.session
    const message = failures >= 3
      ? `自動備份最近連續失敗 ${failures} 次，可以手動再試一次。`
      : days === null ? "你的筆記還沒有備份過。" : `已經 ${days} 天沒有備份筆記了。`
    const el = h("div", { class: "bwz-n-tip bwz-backup-reminder" }, h("p", { text: message }))
    if (s.account) {
      el.append(this.backupButton("存到 Google Drive"), this.downloadButton(), this.snoozeButton())
    } else {
      el.append(this.downloadButton(true), h("button", {
        class: "bwz-n-btn small bwz-backup-button",
        text: "用 Google 同步",
        attrs: { type: "button" },
        on: { click: () => s.signInFromClick() },
      }), this.snoozeButton())
    }
    return el
  }

  private snoozeButton(): HTMLButtonElement {
    return h("button", {
      class: "bwz-n-btn small bwz-backup-button",
      text: "之後再說",
      attrs: { type: "button" },
      on: { click: () => this.session.snoozeBackupReminder() },
    })
  }

  /** primary：沒登入的人只能下載，這就是主要動作。下載完立刻重算提醒（markDownloaded 不會觸發 session 變化）。 */
  private downloadButton(primary = false): HTMLButtonElement {
    return h("button", {
      class: `bwz-n-btn${primary ? " primary" : ""} small bwz-backup-button`,
      text: "下載備份檔",
      attrs: { type: "button" },
      on: { click: () => void downloadBackupFile(this.session).then(() => this.onSessionChange()) },
    })
  }

  private backupButton(label: string): HTMLButtonElement {
    const button = h("button", {
      class: "bwz-n-btn primary small bwz-backup-button",
      text: label,
      attrs: { type: "button" },
    })
    button.addEventListener("click", () => {
      const p = this.session.backupNow(true)
      button.disabled = true
      button.textContent = "備份中…"
      void p.then((result) => this.showBackupResult(result)).catch(() => toast("備份失敗，請稍後再試")).finally(() => {
        if (button.isConnected) button.disabled = false
      })
    })
    return button
  }

  private showBackupResult(result: BackupResult): void {
    if (result.ok) toast(`已存到 Google Drive（${result.records} 則）`)
    else {
      const messages: Record<string, string> = {
        "no-scope": "沒有取得 Google Drive 權限。可以再按一次，並在 Google 授權畫面勾選「Google 雲端硬碟」。",
        denied: "沒有完成 Google 授權",
        offline: "目前無法連線網路，請稍後再試",
        auth: "需要重新連線 Google，請先按「繼續同步」",
        quota: "Google 雲端硬碟空間或流量不足",
      }
      toast(messages[result.reason] ?? "備份失敗，請稍後再試")
    }
    void this.refreshVisibleSection()
    void this.onSessionChange()
  }

  private async refreshVisibleSection(): Promise<void> {
    const section = document.querySelector<HTMLElement>('[data-section="drive-backup"]')
    if (!section) return
    const replacement = this.renderSection()
    section.replaceChildren(replacement)
  }

  private renderSection(): HTMLElement {
    const version = ++this.renderVersion
    const body = h("div", { class: "bwz-backup-section" })
    const description = h("p", { class: "bwz-n-muted bwz-backup-muted", text: "每週自動在你的 Google Drive 存一份筆記備份（最多 10 份）。" })
    // 「這是什麼？」收合放在最下面，不搶說明與按鈕的位置（使用者要求：不要讓介面很亂）
    const details = this.details()

    if (!this.session.account) {
      body.append(
        h("p", { class: "bwz-n-muted bwz-backup-muted", text: "登入 Google 同步後，可以每週自動在你的 Google Drive 存一份備份。" }),
        h("button", {
          class: "bwz-n-btn bwz-backup-button",
          text: "用 Google 同步",
          attrs: { type: "button" },
          on: { click: () => this.session.signInFromClick() },
        }),
        details,
      )
      return body
    }

    const introButton = h("button", {
      class: "bwz-n-btn primary bwz-backup-button",
      text: "存一份到我的 Google Drive",
      attrs: { type: "button" },
    })
    introButton.addEventListener("click", () => {
      const p = this.session.backupNow(true)
      introButton.disabled = true
      introButton.textContent = "備份中…"
      void p.then((result) => this.showBackupResult(result)).catch(() => toast("備份失敗，請稍後再試"))
    })

    const status = h("p", { class: "bwz-backup-status", text: "正在讀取備份狀態…" })
    const controls = h("div", { class: "bwz-backup-controls" })
    body.append(introButton, description, status, controls, details)

    void this.session.lastBackup().then((last) => {
      if (this.destroyed || version !== this.renderVersion || !body.isConnected) return
      if (last.kind === "drive") {
        body.replaceChildren(this.statusView(last), details)
      } else if (last.kind === "file") {
        // 只下載過備份檔、還沒開 Drive 權限：照樣請他開，順便顯示上次下載的時間
        body.replaceChildren(introButton, description, h("p", { class: "bwz-n-muted bwz-backup-muted", text: `上次備份：${this.ageText(last)}（下載的備份檔）` }), details)
      } else {
        body.replaceChildren(introButton, description, details)
      }
    }).catch(() => {
      if (!this.destroyed && version === this.renderVersion && body.isConnected) status.textContent = "讀不到備份狀態，請稍後再試。"
    })

    return body
  }

  private ageText(last: LastBackup): string {
    const days = last.at === null ? null : Math.max(0, Math.floor((Date.now() - last.at) / 86_400_000))
    return days === null || days === 0 ? "今天" : `${days} 天前`
  }

  private statusView(last: LastBackup): HTMLElement {
    const age = this.ageText(last)
    const source = last.kind === "drive" ? "（Google Drive）" : "（下載的備份檔）"
    const status = h("p", { class: "bwz-backup-status", text: `上次備份：${age}${source}` })
    const area = h("div", { class: "bwz-backup-status-area" }, status)
    if (last.failures >= 3) area.append(h("p", { class: "bwz-backup-warning", text: `自動備份最近連續失敗 ${last.failures} 次` }))
    const checkbox = h("input", { attrs: { type: "checkbox" } })
    checkbox.checked = last.autoEnabled
    checkbox.addEventListener("change", () => this.session.setAutoBackupEnabled(checkbox.checked))
    area.append(
      this.backupButton("立即備份"),
      h("label", { class: "bwz-backup-check" }, checkbox, h("span", { text: "每週自動備份（這台裝置）" })),
      this.listButton(),
    )
    return area
  }

  private listButton(): HTMLElement {
    const wrap = h("div", { class: "bwz-backup-list-wrap" })
    const button = h("button", {
      class: "bwz-n-btn bwz-backup-button",
      text: "查看備份與還原",
      attrs: { type: "button", "aria-expanded": "false" },
    })
    const list = h("div", { class: "bwz-backup-list", attrs: { hidden: true } })
    button.addEventListener("click", () => {
      const opening = list.hidden
      list.hidden = !opening
      button.setAttribute("aria-expanded", String(opening))
      if (opening) void this.loadList(list)
    })
    wrap.append(button, list)
    return wrap
  }

  private async loadList(list: HTMLElement): Promise<void> {
    list.replaceChildren(h("p", { class: "bwz-n-muted bwz-backup-muted", text: "正在讀取備份清單…" }))
    try {
      const items = await this.session.listBackups()
      if (!list.isConnected) return
      if (!items.length) {
        list.replaceChildren(h("p", { class: "bwz-n-muted bwz-backup-muted", text: "目前沒有 Google Drive 備份。" }))
        return
      }
      list.replaceChildren(...items.map((item) => this.listRow(item)))
    } catch {
      if (list.isConnected) list.replaceChildren(h("p", { class: "bwz-backup-warning", text: "讀不到備份清單（可能需要重新連線 Google）" }))
    }
  }

  private listRow(item: BackupListing): HTMLElement {
    const date = new Date(item.createdTime)
    const stamp = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
    const count = Number((item as BackupListing & { records?: number }).records ?? 0)
    const row = h("div", { class: "bwz-backup-row" }, h("span", { text: stamp }), h("span", { text: `${count} 則` }))
    row.append(h("button", {
      class: "bwz-n-btn bwz-backup-button",
      text: "從這份還原",
      attrs: { type: "button" },
      on: { click: () => void this.restore(item.id) },
    }))
    return row
  }

  private async restore(id: string): Promise<void> {
    const choice = await dialog({
      title: "從備份還原",
      message: "會把這份備份裡的筆記補回來；不會刪除或蓋掉現有的筆記。",
      buttons: [
        { id: "restore", label: "還原", kind: "primary" },
        { id: "cancel", label: "取消", autofocus: true },
      ],
    })
    if (choice !== "restore") return
    try {
      const result: ImportResult = await this.session.restore(id)
      toast(`還原完成：新增 ${result.added} 則、更新 ${result.updated} 則、衝突另存 ${result.copied} 則`)
      await this.onSessionChange()
    } catch {
      toast("還原失敗，請稍後再試")
    }
  }

  private details(): HTMLElement {
    return h(
      "details",
      { class: "bwz-backup-details" },
      h("summary", { text: "這是什麼？" }),
      h("ul", null,
        h("li", { text: "備份會存在雲端硬碟裡的「聖經知識庫筆記備份」資料夾。" }),
        h("li", { text: "本站只能存取自己建立的備份檔，看不到你雲端硬碟裡的其他東西。" }),
        h("li", { text: "可以從備份還原；只會補上筆記，不會刪除或蓋掉現有筆記。" }),
        h("li", { text: "每週自動備份可以在這裡關掉；每台裝置各自設定。" }),
      ),
    )
  }
}
