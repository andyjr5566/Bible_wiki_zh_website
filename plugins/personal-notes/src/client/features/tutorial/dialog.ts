// 筆記教學對話框：上方段落圓點與標題、中間示範區（假頁面）、下方一行說明與「上一段／重播／下一段」。
// 手機是全螢幕、桌面是置中的大卡片；← → 換段、Esc 關閉、焦點留在框內、關閉後焦點還給原本的按鈕。
// 減少動態效果（prefers-reduced-motion）時不播動畫：直接顯示每段的最後畫面，並列出編號步驟。

import { h } from "../../ui/dom"
import { initialDevice, rememberDevice, type TutorialDevice } from "./device"
import { PHONE_MAX_H, PHONE_MIN_H, runSafely, Stage, stageSize } from "./engine"
import { forDevice, SCENES, type Scene } from "./scenes"

const STORAGE_KEY = "bwz-tutorial-scene"

/** 這台裝置上次看到第幾段（從 0 起算）；讀不到就從頭。 */
export function lastSceneIndex(): number {
  try {
    const id = localStorage.getItem(STORAGE_KEY)
    const i = SCENES.findIndex((s) => s.id === id)
    return i >= 0 ? i : 0
  } catch {
    return 0
  }
}

function rememberScene(scene: Scene): void {
  try {
    localStorage.setItem(STORAGE_KEY, scene.id)
  } catch {
    // 記不住看到哪一段不影響使用
  }
}

export interface TutorialHandle {
  close(): void
  /** 教學關閉後完成 */
  closed: Promise<void>
}

/** 打開教學。opener：關閉後要把焦點還給誰。startAt：從第幾段開始（預設上次看到的）。device：電腦版或手機版（D-51）。 */
export function openTutorial(opener: HTMLElement | null, startAt = lastSceneIndex(), device: TutorialDevice = initialDevice()): TutorialHandle {
  const dlg = new TutorialDialog(opener, startAt, device)
  return { close: () => dlg.close(), closed: dlg.closed }
}

const reducedMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches

class TutorialDialog {
  readonly closed: Promise<void>
  private resolveClosed!: () => void
  private index: number
  private readonly reduced = reducedMotion()
  private run: AbortController | null = null
  /** 目前畫在示範區的那一份（手機上 fit() 要調它的高度） */
  private stage: Stage | null = null
  private runId = 0
  private dead = false

  private readonly overlay: HTMLElement
  private readonly box: HTMLElement
  private readonly kicker = h("div", { class: "bwz-tut-kicker" })
  private readonly title = h("h3", { class: "bwz-tut-title" })
  /** 標題列右側的「電腦｜手機」分段按鈕（radiogroup） */
  private readonly switcher = h("div", { class: "bwz-tut-switch", attrs: { role: "radiogroup", "aria-label": "示範版本" } })
  private readonly radios = new Map<TutorialDevice, HTMLElement>()
  private readonly dots = h("div", { class: "bwz-tut-dots", attrs: { role: "group", "aria-label": "教學段落" } })
  private readonly wrap = h("div", { class: "bwz-tut-stagewrap" })
  private readonly frame = h("div", { class: "bwz-tut-frame" })
  private readonly caption = h("p", { class: "bwz-tut-caption", attrs: { "aria-live": "polite" } })
  private readonly tryLine = h("p", { class: "bwz-tut-try" })
  private readonly steps = h("ol", { class: "bwz-tut-steps" })
  private readonly prev = h("button", { class: "bwz-tut-btn", text: "‹ 上一段", attrs: { type: "button" }, on: { click: () => this.go(this.index - 1) } })
  private readonly replay = h("button", { class: "bwz-tut-btn", text: "↻ 重播", attrs: { type: "button" }, on: { click: () => this.show(this.index) } })
  private readonly next = h("button", { class: "bwz-tut-btn primary", attrs: { type: "button" }, on: { click: () => this.go(this.index + 1) } })
  private readonly skip = h("button", { class: "bwz-tut-skip", text: "跳過示範，直接試試", attrs: { type: "button" }, on: { click: () => void this.enterTry() } })
  private readonly tryBtn = h("button", { class: "bwz-tut-skip", text: "換你試試", attrs: { type: "button" }, on: { click: () => void this.enterTry() } })
  private readonly resizer: ResizeObserver | null
  private readonly previousOverflow: string
  private readonly onKey = (e: KeyboardEvent) => this.key(e)
  private readonly onNav = () => this.close()

  constructor(
    private readonly opener: HTMLElement | null,
    startAt: number,
    private device: TutorialDevice,
  ) {
    this.index = Math.min(Math.max(startAt, 0), SCENES.length - 1)
    this.closed = new Promise((resolve) => (this.resolveClosed = resolve))
    this.box = h(
      "div",
      { class: `bwz-tut${this.reduced ? " reduced" : ""}`, attrs: { role: "dialog", "aria-modal": "true", "aria-label": "筆記教學", tabindex: "-1" } },
      h(
        "div",
        { class: "bwz-tut-head" },
        h("div", { class: "bwz-tut-headtext" }, this.kicker, this.title),
        h(
          "div",
          { class: "bwz-tut-headtools" },
          this.switcher,
          h("button", { class: "bwz-tut-close", text: "✕", attrs: { type: "button", "aria-label": "關閉教學", title: "關閉（Esc）" }, on: { click: () => this.close() } }),
        ),
      ),
      this.dots,
      this.wrap,
      h("div", { class: "bwz-tut-foot" }, this.caption, this.tryLine, this.steps, h("div", { class: "bwz-tut-skiprow" }, this.skip, this.tryBtn), h("div", { class: "bwz-tut-controls" }, this.prev, this.replay, this.next)),
    )
    this.box.dataset.device = device
    for (const [value, label] of [["desktop", "電腦"], ["touch", "手機"]] as const) {
      const radio = h("button", {
        class: "bwz-tut-radio",
        text: label,
        attrs: { type: "button", role: "radio", "aria-checked": String(value === device), tabindex: value === device ? "0" : "-1" },
        on: {
          click: () => this.setDevice(value),
          keydown: (e) => this.radioKey(e as KeyboardEvent),
        },
      })
      this.radios.set(value, radio)
      this.switcher.append(radio)
    }
    this.wrap.append(this.frame)
    SCENES.forEach((scene, i) => {
      this.dots.append(
        h("button", {
          class: "bwz-tut-dot",
          attrs: { type: "button", "aria-label": `第 ${i + 1} 段：${scene.title}` },
          on: { click: () => this.go(i) },
        }),
      )
    })
    this.overlay = h("div", {
      class: "bwz-tut-overlay",
      on: {
        click: (e) => {
          if (e.target === this.overlay) this.close()
        },
        // 在示範區的輸入框打字時，不要讓網站其他快捷鍵（例如「/」搜尋）接到
        keydown: (e) => {
          const t = e.target as HTMLElement
          if (t.matches("input, textarea")) e.stopPropagation()
        },
      },
    })
    this.overlay.append(this.box)
    this.previousOverflow = document.documentElement.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.append(this.overlay)
    document.addEventListener("keydown", this.onKey, true)
    // 網站換頁（SPA）時一起關閉
    document.addEventListener("prenav", this.onNav)
    this.resizer = typeof ResizeObserver === "function" ? new ResizeObserver(() => this.fit()) : null
    this.resizer?.observe(this.wrap)
    this.show(this.index)
    this.next.focus({ preventScroll: true })
  }

  close(): void {
    if (this.dead) return
    this.dead = true
    this.run?.abort()
    this.resizer?.disconnect()
    document.removeEventListener("keydown", this.onKey, true)
    document.removeEventListener("prenav", this.onNav)
    document.documentElement.style.overflow = this.previousOverflow
    this.overlay.remove()
    if (this.opener?.isConnected) this.opener.focus?.({ preventScroll: true })
    this.resolveClosed()
  }

  // ---------- 鍵盤 ----------

  private key(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault()
      e.stopPropagation()
      this.close()
      return
    }
    const t = e.target as HTMLElement | null
    // 「電腦｜手機」的方向鍵是用來在兩個選項間移動，不是換段
    const typing = !!t && (t.matches("input, textarea, select") || !!t.closest(".bwz-tut-switch"))
    if (!typing && !e.altKey && !e.ctrlKey && !e.metaKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault()
      this.go(this.index + (e.key === "ArrowRight" ? 1 : -1))
      return
    }
    if (e.key === "Tab") {
      const items = [...this.box.querySelectorAll<HTMLElement>("button:not(:disabled):not([hidden]), a[href], input, textarea, select")].filter(
        (el) => !el.closest("[inert], [hidden]"),
      )
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!this.box.contains(active)) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  // ---------- 換段 ----------

  private go(i: number): void {
    if (i < 0) return
    if (i >= SCENES.length) {
      this.close()
      return
    }
    this.show(i)
  }

  private get scene(): Scene {
    return SCENES[this.index]
  }

  /** 顯示某一段並開始播示範（或在減少動態效果時直接顯示最後畫面）。 */
  private show(i: number): void {
    this.index = i
    const scene = this.scene
    rememberScene(scene)
    const id = ++this.runId
    this.run?.abort()
    this.run = new AbortController()

    const v = forDevice(scene, this.device)
    // 窄螢幕（手機）隱藏「✤ 筆記教學」幾個字，只留「第 N / 8 段」，標題列才放得下「電腦｜手機」
    this.kicker.replaceChildren(h("span", { class: "bwz-tut-kicker-name", text: "✤ 筆記教學　" }), `第 ${i + 1} / ${SCENES.length} 段`)
    this.title.textContent = scene.title
    this.caption.textContent = v.caption
    this.tryLine.textContent = ""
    this.steps.replaceChildren(...v.steps.map((text) => h("li", { text })))
    ;[...this.dots.children].forEach((d, n) => {
      d.classList.toggle("on", n === i)
      d.classList.toggle("seen", n < i)
      if (n === i) d.setAttribute("aria-current", "step")
      else d.removeAttribute("aria-current")
    })
    this.prev.disabled = i === 0
    this.next.textContent = i === SCENES.length - 1 ? "完成 ✓" : "下一段 ›"
    this.box.dataset.mode = this.reduced ? "still" : "demo"

    const stage = new Stage(this.reduced ? "instant" : "demo", this.run.signal, this.device)
    stage.onSay = (text) => {
      if (id === this.runId) this.caption.textContent = text
    }
    this.mount(stage)
    scene.build(stage)
    void this.play(stage, id)
  }

  private async play(stage: Stage, id: number): Promise<void> {
    const ok = await runSafely(stage, forDevice(this.scene, this.device).demo)
    if (!ok || id !== this.runId || this.dead) return
    if (this.reduced) {
      this.box.dataset.mode = "still"
      return
    }
    // 播完停一下，讓使用者看清楚最後的畫面，再進入「換你試試」
    await new Promise((r) => setTimeout(r, 900))
    if (id === this.runId && !this.dead) void this.enterTry()
  }

  /** 換你試試：重畫一份乾淨的假頁面，使用者自己點。內容只存在記憶體，關掉就沒了。 */
  private async enterTry(): Promise<void> {
    if (this.dead) return
    ++this.runId
    this.run?.abort()
    this.run = new AbortController()
    const scene = this.scene
    const stage = new Stage("try", this.run.signal, this.device)
    const v = forDevice(scene, this.device)
    this.caption.textContent = v.caption
    this.tryLine.replaceChildren(h("span", { class: "bwz-tut-hand", text: "✋ 換你試試" }), `　${v.tryText}`)
    this.box.dataset.mode = "try"
    this.mount(stage)
    scene.build(stage)
    stage.hint(scene.tryTarget)
  }

  /** 切換「電腦｜手機」：記住選擇，停在同一段，用另一個版本重播（原本在「換你試試」就重新進入換你試試）。 */
  private setDevice(device: TutorialDevice): void {
    if (this.dead || device === this.device) return
    const trying = this.box.dataset.mode === "try"
    this.device = device
    rememberDevice(device)
    this.box.dataset.device = device
    for (const [value, radio] of this.radios) {
      radio.setAttribute("aria-checked", String(value === device))
      radio.tabIndex = value === device ? 0 : -1
    }
    if (trying) void this.enterTry()
    else this.show(this.index)
  }

  /** radiogroup 的鍵盤：方向鍵在兩個選項間移動並選取（Tab 進得去、Enter／空白鍵也能選）。 */
  private radioKey(e: KeyboardEvent): void {
    const order: TutorialDevice[] = ["desktop", "touch"]
    const at = order.findIndex((d) => this.radios.get(d) === e.currentTarget)
    let to = -1
    if (e.key === "ArrowLeft" || e.key === "ArrowUp") to = (at + order.length - 1) % order.length
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") to = (at + 1) % order.length
    else if (e.key === "Home") to = 0
    else if (e.key === "End") to = order.length - 1
    if (to < 0) return
    e.preventDefault()
    e.stopPropagation()
    this.setDevice(order[to])
    this.radios.get(order[to])?.focus()
  }

  private mount(stage: Stage): void {
    this.stage = stage
    this.frame.replaceChildren(stage.root)
    this.fit()
  }

  /** 示範區等比例縮放，塞進可用空間（手機縮小、桌面最多放大 1.5 倍）。尺寸依目前的裝置版本。 */
  private fit(): void {
    const size = stageSize(this.device)
    // 外框（wrap）的內距照 CSS；寬螢幕上看手機版時，外面還有一圈手機外框要留位置
    const cs = getComputedStyle(this.wrap)
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
    const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
    const bezel = this.device === "touch" && typeof matchMedia === "function" && matchMedia("(min-width: 701px)").matches ? 32 : 0
    const w = this.wrap.clientWidth - padX - bezel
    const hgt = this.wrap.clientHeight - padY - bezel
    if (w <= 0 || hgt <= 0) return
    if (this.device === "touch" && !bezel && this.stage) {
      // 手機上：寬度撐滿（使用者 2026-10-20：「手機螢幕已經夠小」），高度跟著剩下的空間伸縮；
      // 剩下的空間太矮時才退回「依高度縮小」，不讓示範區超出畫面
      let k = w / size.w
      let stageH = Math.min(PHONE_MAX_H, Math.floor(hgt / k))
      if (stageH < PHONE_MIN_H) {
        stageH = PHONE_MIN_H
        k = hgt / PHONE_MIN_H
      }
      this.stage.setHeight(stageH)
      this.frame.style.width = `${Math.floor(size.w * k)}px`
      this.frame.style.height = `${Math.floor(stageH * k)}px`
      this.frame.style.setProperty("--tut-scale", k.toFixed(4))
      return
    }
    const scale = Math.max(0.4, Math.min(w / size.w, hgt / size.h, 1.5))
    this.frame.style.width = `${Math.floor(size.w * scale)}px`
    this.frame.style.height = `${Math.floor(size.h * scale)}px`
    this.frame.style.setProperty("--tut-scale", scale.toFixed(4))
  }
}
