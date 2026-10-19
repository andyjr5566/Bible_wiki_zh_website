// 〈我的筆記〉頁的外框（D-42）：同步狀態、總覽一行、搜尋、分頁標籤（筆記／便條／重點／書籤）、「⚙ 設定與備份」。
// 各功能模組彼此不 import；它們各自在自己的掛載容器裡畫內容，再向這個外框登記分頁與設定區塊。
// 外框放在掛載點最上方，一個掛載點只有一個（用 WeakMap 找回）。

import type { Session } from "../session/session"
import { dialog, h } from "./dom"
import { statusBar } from "./status"

export interface ShellTab {
  id: string
  /** 分頁名稱，例如「筆記」 */
  label: string
  /** 總覽一行用的單位，例如「則筆記」 */
  unit: string
  order: number
  /** 這個分頁的內容（顯示／隱藏由外框控制） */
  el: HTMLElement
  /** 目前的數量（搜尋時是符合的數量） */
  count(): number
  /** 全部的數量（總覽一行） */
  total(): number
  /** 搜尋文字變了 */
  onQuery(query: string): void
}

export interface ShellAction {
  id: string
  /** 按鈕文字，例如「▶ 筆記教學」 */
  label: string
  /** 小的排前面；都排在「⚙ 設定與備份」左邊 */
  order: number
  /** 按下時呼叫（傳入按鈕本身，方便功能模組在關閉後把焦點還給它） */
  onClick(button: HTMLButtonElement): void
}

export interface ShellSection {
  id: string
  title: string
  order: number
  /** 打開「設定與備份」時畫出這個區塊 */
  render(): HTMLElement
}

const TAB_KEY = "bwz-mynotes-tab"
const shells = new WeakMap<HTMLElement, MyNotesShell>()

/** 取得（或建立）某個掛載點的外框。host 是功能模組拿到的容器。 */
export function shellFor(host: HTMLElement, session: Session): MyNotesShell {
  const mount = (host.closest("[data-bwz-notes]") as HTMLElement | null) ?? host
  let shell = shells.get(mount)
  if (!shell || !shell.root.isConnected) {
    shell = new MyNotesShell(mount, session)
    shells.set(mount, shell)
  }
  return shell
}

export class MyNotesShell {
  readonly root = h("div", { class: "bwz-shell" })
  private readonly tabs = new Map<string, ShellTab>()
  private readonly sections = new Map<string, ShellSection>()
  private readonly actions = new Map<string, { action: ShellAction; button: HTMLButtonElement }>()
  private readonly actionsEl = h("div", { class: "bwz-shell-actions" })
  private readonly settingsBtn = h("button", { class: "bwz-n-btn bwz-settings-btn", text: "⚙ 設定與備份", attrs: { type: "button", "data-shell": "settings" }, on: { click: () => void this.openSettings() } })
  private readonly statusEl = h("div", { class: "bwz-shell-status" })
  private readonly summaryEl = h("p", { class: "bwz-shell-summary" })
  private readonly tabBar = h("div", { class: "bwz-shell-tabs", attrs: { role: "tablist", "aria-label": "筆記種類" } })
  private readonly noticeEl = h("div", { class: "bwz-shell-notice" })
  private readonly search: HTMLInputElement
  /** 使用者選的分頁（記在 localStorage）；那個分頁還沒登記時先顯示第一個，登記後自動切過去 */
  private preferred: string | null = null
  private active: string | null = null
  private query = ""
  private readonly unsubscribe: () => void

  constructor(
    private readonly mount: HTMLElement,
    private readonly session: Session,
  ) {
    try {
      this.preferred = localStorage.getItem(TAB_KEY)
    } catch {
      this.preferred = null
    }
    this.search = h("input", {
      class: "bwz-n-input bwz-shell-search",
      attrs: { type: "search", placeholder: "搜尋（可輸入多個詞、#標籤、書卷章節）", "aria-label": "搜尋我的筆記" },
      on: { input: () => this.setQuery(this.search.value.trim()) },
    })
    const base = document.body.dataset.basepath ?? ""
    this.root.append(
      h(
        "div",
        { class: "bwz-shell-head" },
        this.statusEl,
        this.actionsEl,
      ),
      this.summaryEl,
      this.noticeEl,
      this.search,
      this.tabBar,
    )
    const footer = h(
      "p",
      { class: "bwz-shell-footer bwz-n-muted" },
      h("a", { text: "個人筆記使用說明", attrs: { href: `${base}/${encodeURI("教學/個人筆記使用說明")}` } }),
      "　·　",
      h("a", { text: "隱私權政策", attrs: { href: `${base}/${encodeURI("教學/隱私權政策")}` } }),
    )
    mount.prepend(this.root)
    mount.append(footer)
    this.unsubscribe = session.onChange(() => this.renderStatus())
    this.renderStatus()
    // 掛載點被清空（換頁）時一起收掉
    this.footer = footer
    this.layoutActions()
  }

  private readonly footer: HTMLElement

  addTab(tab: ShellTab): void {
    this.tabs.set(tab.id, tab)
    tab.el.classList.add("bwz-shell-panel")
    tab.el.setAttribute("role", "tabpanel")
    tab.onQuery(this.query)
    this.update()
  }

  removeTab(id: string): void {
    this.tabs.delete(id)
    this.update()
    this.disposeIfEmpty()
  }

  /** 在標題列「⚙ 設定與備份」旁加一個按鈕（功能模組不要自己改外框的 DOM）。同一個 id 再加一次會取代。 */
  addAction(action: ShellAction): void {
    this.actions.get(action.id)?.button.remove()
    const button = h("button", {
      class: "bwz-n-btn bwz-settings-btn",
      text: action.label,
      attrs: { type: "button" },
      data: { action: action.id },
    })
    button.addEventListener("click", () => action.onClick(button))
    this.actions.set(action.id, { action, button })
    this.layoutActions()
  }

  removeAction(id: string): void {
    this.actions.get(id)?.button.remove()
    this.actions.delete(id)
    this.layoutActions()
    this.disposeIfEmpty()
  }

  private layoutActions(): void {
    const sorted = [...this.actions.values()].sort((a, b) => a.action.order - b.action.order)
    this.actionsEl.replaceChildren(...sorted.map((a) => a.button), this.settingsBtn)
  }

  addSection(section: ShellSection): void {
    this.sections.set(section.id, section)
  }

  removeSection(id: string): void {
    this.sections.delete(id)
    this.disposeIfEmpty()
  }

  /** 顯示在分頁上方的提醒（例如「這台裝置還有 N 則未登入時寫的筆記」）；null＝清掉。 */
  setNotice(id: string, el: HTMLElement | null): void {
    this.noticeEl.querySelector(`[data-notice="${id}"]`)?.remove()
    if (el) {
      el.dataset.notice = id
      this.noticeEl.append(el)
    }
  }

  /** 設定搜尋文字（例如點標籤時）。 */
  setQuery(query: string): void {
    if (this.search.value.trim() !== query) this.search.value = query
    this.query = query
    for (const t of this.tabs.values()) t.onQuery(query)
    this.update()
  }

  get currentQuery(): string {
    return this.query
  }

  /** 數量變了（資料更新後由分頁呼叫）。 */
  update(): void {
    const tabs = [...this.tabs.values()].sort((a, b) => a.order - b.order)
    if (tabs.length === 0) return
    this.active = this.preferred && this.tabs.has(this.preferred) ? this.preferred : tabs[0].id
    this.tabBar.replaceChildren(
      ...tabs.map((t) => {
        const on = t.id === this.active
        return h(
          "button",
          {
            class: `bwz-shell-tab${on ? " on" : ""}`,
            attrs: { type: "button", role: "tab", "aria-selected": String(on), id: `bwz-tab-${t.id}` },
            on: { click: () => this.select(t.id) },
          },
          h("span", { text: t.label }),
          h("span", { class: "bwz-shell-tab-num", text: String(t.count()) }),
        )
      }),
    )
    for (const t of tabs) {
      t.el.hidden = t.id !== this.active
      t.el.setAttribute("aria-labelledby", `bwz-tab-${t.id}`)
    }
    // 頁尾永遠在最後（功能模組的容器是之後才加進來的）
    if (this.mount.lastElementChild !== this.footer) this.mount.append(this.footer)
    const parts = tabs.filter((t) => t.total() > 0).map((t) => `${t.total()} ${t.unit}`)
    this.summaryEl.textContent = parts.length ? `共 ${parts.join(" · ")}` : ""
  }

  private select(id: string): void {
    this.preferred = id
    try {
      localStorage.setItem(TAB_KEY, id)
    } catch {
      // 無法儲存偏好不影響使用
    }
    this.update()
  }

  private renderStatus(): void {
    this.session.resetOfflineAcknowledgement()
    this.statusEl.replaceChildren(statusBar(this.session))
  }

  private async openSettings(): Promise<void> {
    const body = h("div", { class: "bwz-settings" })
    const fill = () => {
      const sections = [...this.sections.values()].sort((a, b) => a.order - b.order)
      body.replaceChildren(...sections.map((s) => h("section", { class: "bwz-settings-section", data: { section: s.id } }, h("h4", { text: s.title }), s.render())))
    }
    fill()
    // 開著的時候登入、登出、刪除…之後內容跟著更新
    const off = this.session.onChange(fill)
    try {
      await dialog({ title: "設定與備份", message: body, buttons: [{ id: "done", label: "完成" }] })
    } finally {
      off()
    }
  }

  private disposeIfEmpty(): void {
    if (this.tabs.size > 0 || this.sections.size > 0 || this.actions.size > 0) return
    this.unsubscribe()
    this.root.remove()
    this.footer.remove()
    shells.delete(this.mount)
  }
}
