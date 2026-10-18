// 小型 DOM 工具。所有文字一律用 textContent 寫入（筆記內容不當 HTML 解析，D-27）。

type Child = Node | string | number | null | undefined | false
type Props = {
  class?: string
  text?: string
  attrs?: Record<string, string | boolean | null | undefined>
  data?: Record<string, string>
  on?: Partial<Record<keyof HTMLElementEventMap, (e: Event) => void>>
  [key: string]: unknown
}

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, props?: Props | null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag)
  if (props) {
    if (props.class) el.className = props.class
    if (props.text !== undefined) el.textContent = props.text
    for (const [k, v] of Object.entries(props.attrs ?? {})) {
      if (v === false || v === null || v === undefined) continue
      el.setAttribute(k, v === true ? "" : v)
    }
    for (const [k, v] of Object.entries(props.data ?? {})) el.dataset[k] = v
    for (const [k, fn] of Object.entries(props.on ?? {})) if (fn) el.addEventListener(k, fn as EventListener)
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue
    el.append(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c)
  }
  return el
}

export interface DialogButton {
  id: string
  label: string
  kind?: "primary" | "danger" | "plain"
  /** 在點擊事件中「同步」執行（例如要開 Google 登入彈窗時必須用這個）。 */
  run?: () => void
  /** 這個 Promise 完成前按鈕不能按（例如 Google 登入元件還在載入）。 */
  waitFor?: Promise<unknown>
  waitingLabel?: string
  /** waitFor 失敗時按鈕顯示的文字（按鈕維持不能按）。 */
  failedLabel?: string
}

let openDialogs = 0

/** 顯示對話框，回傳使用者按的按鈕 id；按背景或 Esc（dismissible 時）回傳 null。 */
export function dialog(opts: { title: string; message: string | Node; buttons: DialogButton[]; dismissible?: boolean }): Promise<string | null> {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement as HTMLElement | null
    const close = (id: string | null) => {
      overlay.remove()
      document.removeEventListener("keydown", onKey)
      openDialogs--
      previousFocus?.focus?.()
      resolve(id)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && opts.dismissible !== false) close(null)
    }
    const body = typeof opts.message === "string" ? h("p", { text: opts.message }) : opts.message
    const buttons = opts.buttons.map((b) => {
      const btn = h("button", {
        class: `bwz-n-btn ${b.kind === "primary" ? "primary" : b.kind === "danger" ? "danger" : ""}`,
        text: b.label,
        attrs: { type: "button" },
        on: {
          click: () => {
            b.run?.()
            close(b.id)
          },
        },
      })
      if (b.waitFor) {
        btn.disabled = true
        btn.textContent = b.waitingLabel ?? `${b.label}…`
        b.waitFor.then(
          () => {
            btn.disabled = false
            btn.textContent = b.label
            if (!box.contains(document.activeElement)) btn.focus()
          },
          () => {
            btn.textContent = b.failedLabel ?? b.label
          },
        )
      }
      return btn
    })
    const box = h(
      "div",
      { class: "bwz-n-dialog", attrs: { role: "dialog", "aria-modal": "true", "aria-label": opts.title } },
      h("h3", { text: opts.title }),
      body,
      h("div", { class: "bwz-n-dialog-actions" }, ...buttons),
    )
    const overlay = h("div", {
      class: "bwz-n-overlay",
      on: {
        click: (e) => {
          if (e.target === overlay && opts.dismissible !== false) close(null)
        },
      },
    })
    overlay.append(box)
    document.body.append(overlay)
    document.addEventListener("keydown", onKey)
    openDialogs++
    buttons.find((b) => !b.disabled)?.focus()
  })
}

export function isDialogOpen(): boolean {
  return openDialogs > 0
}

let toastTimer: ReturnType<typeof setTimeout> | null = null

export function toast(message: string): void {
  let el = document.querySelector<HTMLElement>(".bwz-n-toast")
  if (!el) {
    el = h("div", { class: "bwz-n-toast", attrs: { role: "status", "aria-live": "polite" } })
    document.body.append(el)
  }
  el.textContent = message
  el.classList.add("show")
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el!.classList.remove("show"), 3500)
}

export function formatTime(iso: string | number): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  return sameDay ? hm : `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

export function verseLabel(start: number | null, end: number | null): string {
  if (!start) return "整章"
  if (!end || end === start) return `第 ${start} 節`
  return `第 ${start}–${end} 節`
}

/** 純文字內文，保留換行（不渲染 Markdown，D-27）。 */
export function textBlock(text: string, cls = "bwz-n-body"): HTMLElement {
  return h("div", { class: cls, text })
}
