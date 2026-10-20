// 教學的「示範區」引擎：一個固定大小的假頁面（Stage）＋虛擬游標＋一串可編輯的動作（Step）。
//
// 重點：示範時由虛擬游標「替使用者操作」同一份假頁面——點擊用真的 click()、打字用真的 input 事件，
// 所以「播放示範」和「換你試試」共用同一套事件處理，不會有兩份行為。
// 這裡沒有任何儲存：假頁面的狀態只存在 DOM 與閉包裡，關掉教學就消失（不碰資料庫、不碰帳號）。

import { h } from "../../ui/dom"
import type { TutorialDevice } from "./device"
import { ICONS, svg } from "./svg"

/** 假頁面的設計尺寸；實際顯示時由外框等比例縮放。電腦版橫的 440×420。 */
export const STAGE_W = 440
export const STAGE_H = 420
/** 手機版是直式。寬固定 360；高度在手機上會跟著螢幕剩下的空間伸縮（見 Stage.setHeight），600 是預設值。 */
export const PHONE_W = 360
export const PHONE_H = 600
/** 手機上伸縮的範圍：太矮放不下筆記面板＋鍵盤，太高底下只是空白。 */
export const PHONE_MIN_H = 500
export const PHONE_MAX_H = 760

/** 某個裝置版本的示範區設計尺寸（手機版直式、電腦版橫式）。 */
export function stageSize(device: TutorialDevice): { w: number; h: number } {
  return device === "touch" ? { w: PHONE_W, h: PHONE_H } : { w: STAGE_W, h: STAGE_H }
}

/** 虛擬鍵盤佔示範區高度的比例（手機版打字時從下方升起）。 */
const KEYBOARD_RATIO = 0.38

export type Where = "center" | "left" | "right" | "top" | "bottom"

/** 動作的目標是假頁面裡標了 data-t="名稱" 的元素。 */
export type Step =
  | { wait: number }
  | { say: string }
  | { move: string; at?: Where; ms?: number }
  | { hover: string; ms?: number }
  | { click: string; at?: Where }
  | { type: string; text: string; ms?: number }
  | { sweep: string; ms?: number }
  | { longpress: string; ms?: number }
  | { keyboard: "up" | "down" }
  | { run: (s: Stage) => void | Promise<void> }

class Stopped extends Error {}

/** demo＝游標示範；instant＝不播動畫、直接做到最後一步（減少動態效果）；try＝換你試試 */
export type StageMode = "demo" | "instant" | "try"

export class Stage {
  /** 設計尺寸的畫布（外框會用 transform 縮放它）。 */
  readonly root: HTMLElement
  /** 內容區（網址列下方）；各情境的假頁面畫在這裡。 */
  readonly page: HTMLElement
  /** 說明文字要換掉時（示範中途切換說明）。 */
  onSay: ((text: string) => void) | null = null
  /** 這個示範區的設計尺寸（依裝置版本）。 */
  size: { w: number; h: number }
  private readonly cursorEl: HTMLElement
  private pos: { x: number; y: number }
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private hinted: HTMLElement | null = null
  private hot: HTMLElement | null = null
  /** 手機版：目前選取範圍的兩個把手與「系統選單」示意。 */
  private selUi: { el: HTMLElement; nodes: HTMLElement[] } | null = null
  /** 手機版：升起來的虛擬鍵盤。 */
  private kbd: HTMLElement | null = null

  constructor(
    readonly mode: StageMode,
    readonly signal: AbortSignal,
    readonly device: TutorialDevice = "desktop",
  ) {
    this.size = stageSize(device)
    this.pos = { x: this.size.w * 0.72, y: this.size.h * 0.78 }
    this.page = h("div", { class: "bwz-tut-page" })
    // 電腦版是箭頭；手機版是「手指」：半透明圓點，長按時外圈會慢慢長滿
    this.cursorEl =
      device === "touch"
        ? h("div", { class: "bwz-tut-cursor finger", attrs: { "aria-hidden": "true" } }, h("span", { class: "bwz-tut-finger-dot" }), svg(ICONS.ring))
        : h("div", { class: "bwz-tut-cursor", attrs: { "aria-hidden": "true" } }, svg(ICONS.cursor))
    this.cursorEl.style.transform = this.pt(this.pos)
    this.root = h(
      "div",
      { class: `bwz-tut-canvas ${mode}`, data: { device }, attrs: { "aria-hidden": mode === "try" ? null : "true" } },
      h(
        "div",
        { class: "bwz-tut-bar" },
        h("span", { class: "bwz-tut-bar-dots" }, h("i"), h("i"), h("i")),
        h("span", { class: "bwz-tut-bar-url", text: "示範頁" }),
        h("span", { class: "bwz-tut-bar-tag", text: "不會存進你的筆記" }),
      ),
      this.page,
    )
    this.root.style.width = `${this.size.w}px`
    this.root.style.height = `${this.size.h}px`
    // 示範時只是「看」：不能被 Tab 或點擊碰到（程式用 click() 操作不受影響）
    if (mode !== "try") this.root.toggleAttribute("inert", true)
    if (mode === "demo") this.root.append(this.cursorEl)
    signal.addEventListener("abort", () => this.clearTimers(), { once: true })
  }

  /** 手機版：示範區高度跟著螢幕剩下的空間伸縮，寬度不變（讓示範區撐滿手機寬度）。 */
  setHeight(h: number): void {
    if (h === this.size.h) return
    this.size = { w: this.size.w, h }
    this.root.style.height = `${h}px`
  }

  get trying(): boolean {
    return this.mode === "try"
  }

  // ---------- 取得元素 ----------

  q<T extends HTMLElement = HTMLElement>(name: string): T {
    const el = this.root.querySelector<T>(`[data-t="${name}"]`)
    if (!el) throw new Error(`教學示範區找不到 ${name}`)
    return el
  }

  has(name: string): boolean {
    return this.root.querySelector(`[data-t="${name}"]`) !== null
  }

  // ---------- 時間 ----------

  /** 等一段時間；教學關閉或換段時會中斷（丟出 Stopped）。instant 模式不等待。 */
  sleep(ms: number): Promise<void> {
    if (this.signal.aborted) return Promise.reject(new Stopped())
    if (this.mode === "instant") return Promise.resolve()
    return new Promise((resolve, reject) => {
      const stop = () => {
        clearTimeout(t)
        reject(new Stopped())
      }
      const t = setTimeout(() => {
        this.signal.removeEventListener("abort", stop)
        resolve()
      }, ms)
      this.signal.addEventListener("abort", stop, { once: true })
    })
  }

  /** 假頁面裡的計時器（例如「輸入後 0.6 秒自動儲存」）；教學關閉時一起清掉。 */
  later(fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const t = setTimeout(() => {
      this.timers.delete(t)
      if (!this.signal.aborted) fn()
    }, this.mode === "instant" ? 0 : ms)
    this.timers.add(t)
    return t
  }

  cancel(t: ReturnType<typeof setTimeout> | undefined): void {
    if (t === undefined) return
    clearTimeout(t)
    this.timers.delete(t)
  }

  private clearTimers(): void {
    for (const t of this.timers) clearTimeout(t)
    this.timers.clear()
  }

  // ---------- 提示 ----------

  /** 「換你試試」時用光圈提示下一個要點的地方；null＝清掉。 */
  hint(name: string | null): void {
    this.hinted?.classList.remove("bwz-tut-hint")
    this.hinted = null
    if (name && this.trying && this.has(name)) {
      this.hinted = this.q(name)
      this.hinted.classList.add("bwz-tut-hint")
    }
  }

  // ---------- 座標（設計尺寸的畫布座標，不受縮放影響） ----------

  private get ratio(): number {
    return this.root.offsetWidth ? this.root.getBoundingClientRect().width / this.root.offsetWidth : 1
  }

  point(el: HTMLElement, at: Where = "center"): { x: number; y: number } {
    const rr = this.root.getBoundingClientRect()
    const rects = el.getClientRects()
    const r = (at === "right" ? rects[rects.length - 1] : rects[0]) ?? el.getBoundingClientRect()
    const k = this.ratio
    const cx = (r.left - rr.left + r.width / 2) / k
    const cy = (r.top - rr.top + r.height / 2) / k
    switch (at) {
      case "left":
        return { x: (r.left - rr.left) / k + 2, y: cy }
      case "right":
        return { x: (r.right - rr.left) / k - 2, y: cy }
      case "top":
        return { x: cx, y: (r.top - rr.top) / k + 3 }
      case "bottom":
        return { x: cx, y: (r.bottom - rr.top) / k - 3 }
      default:
        return { x: cx, y: cy }
    }
  }

  private pt(p: { x: number; y: number }): string {
    return `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`
  }

  // ---------- 虛擬游標 ----------

  /** 游標滑到某個點（帶一點弧度，比直線自然）。 */
  async glide(to: { x: number; y: number }, ms = 800): Promise<void> {
    const from = this.pos
    this.pos = to
    if (this.mode !== "demo") return
    const dx = to.x - from.x
    const dy = to.y - from.y
    const dist = Math.hypot(dx, dy)
    if (dist < 2) return
    const bend = Math.min(36, dist * 0.14)
    const mid = { x: from.x + dx / 2 - (dy / dist) * bend, y: from.y + dy / 2 + (dx / dist) * bend }
    this.cursorEl.style.transform = this.pt(to)
    const a = this.cursorEl.animate(
      [{ transform: this.pt(from) }, { transform: this.pt(mid), offset: 0.5 }, { transform: this.pt(to) }],
      { duration: ms, easing: "cubic-bezier(.45,.05,.25,1)" },
    )
    try {
      await this.sleep(ms)
    } finally {
      a.cancel()
    }
  }

  async move(name: string, at: Where = "center", ms?: number): Promise<void> {
    const to = this.point(this.q(name), at)
    await this.glide(to, ms ?? Math.round(Math.min(1100, 420 + Math.hypot(to.x - this.pos.x, to.y - this.pos.y) * 2.2)))
  }

  /** 按下去：游標縮一下＋波紋，然後真的點一下。 */
  async click(name: string, at: Where = "center"): Promise<void> {
    const el = this.q(name)
    if (this.mode === "demo") {
      // 手機版：點的不是輸入框（例如「完成」）就先把鍵盤收起來（點候選清單時鍵盤還在，跟真的手機一樣）
      if (this.kbd && !el.matches("input, textarea") && !el.closest(".bwz-tut-complete")) await this.keyboard("down")
      await this.move(name, at)
      await this.sleep(120)
      const press = this.device === "touch" ? ".6" : ".78"
      this.cursorEl.firstElementChild?.animate([{ transform: "scale(1)" }, { transform: `scale(${press})` }, { transform: "scale(1)" }], { duration: 260 })
      this.ripple()
      await this.sleep(180)
    }
    el.click()
    if (this.mode === "demo") await this.sleep(260)
  }

  private ripple(): void {
    const r = h("span", { class: "bwz-tut-ripple" })
    r.style.left = `${this.pos.x}px`
    r.style.top = `${this.pos.y}px`
    this.root.append(r)
    const a = r.animate(
      [
        { transform: "translate(-50%, -50%) scale(.25)", opacity: 0.75 },
        { transform: "translate(-50%, -50%) scale(1.7)", opacity: 0 },
      ],
      { duration: 560, easing: "ease-out" },
    )
    a.onfinish = () => r.remove()
  }

  /**
   * 游標移到某元素上，並把它標成「正在指著」。
   * 手機沒有 hover：手機版的劇本不該用這個步驟（之後會拿掉）；這裡仍讓它能跑（手指移過去＋標記），避免出錯。
   */
  async hover(name: string, ms?: number): Promise<void> {
    await this.move(name, "center", ms)
    this.hot?.classList.remove("bwz-tut-hot")
    this.hot = this.q(name)
    this.hot.classList.add("bwz-tut-hot")
  }

  /** 打字：真的改 value 並送 input 事件（假頁面的自動儲存、[[ 候選清單都吃這個事件）。 */
  async type(name: string, text: string, ms = 85): Promise<void> {
    const el = this.q<HTMLInputElement | HTMLTextAreaElement>(name)
    // 手機版：開始打字就升起鍵盤，並把輸入框捲到鍵盤上方
    if (this.device === "touch") await this.keyboard("up", el)
    el.classList.add("bwz-tut-typing")
    if (this.mode === "instant") {
      el.value += text
      el.dispatchEvent(new Event("input", { bubbles: true }))
    } else {
      for (const ch of text) {
        el.value += ch
        el.dispatchEvent(new Event("input", { bubbles: true }))
        await this.sleep(ms)
      }
    }
    el.classList.remove("bwz-tut-typing")
  }

  /** 選取經文：游標從字的左邊拖到右邊，選取範圍跟著掃過。 */
  async sweep(name: string, ms = 1100): Promise<void> {
    const el = this.q(name)
    if (this.mode === "demo") {
      await this.glide(this.point(el, "left"), 700)
      await this.sleep(150)
      el.classList.add("sel")
      const from = this.point(el, "left")
      const to = this.point(el, "right")
      const a = el.animate([{ backgroundSize: "0% 100%" }, { backgroundSize: "100% 100%" }], { duration: ms, easing: "linear" })
      this.pos = to
      this.cursorEl.style.transform = this.pt(to)
      const c = this.cursorEl.animate([{ transform: this.pt(from) }, { transform: this.pt(to) }], { duration: ms, easing: "linear" })
      try {
        await this.sleep(ms)
      } finally {
        a.cancel()
        c.cancel()
      }
      await this.sleep(150)
    } else {
      el.classList.add("sel")
    }
  }

  /**
   * 手機版選字：手指移到字的開頭、按住約 0.6 秒（外圈慢慢長滿），選取範圍出現，
   * 兩端有水滴形把手，上方浮出「系統選單」示意。工具列由場景的 pop／click 接著跳出（放在選取範圍下方）。
   */
  async longpress(name: string, ms = 600): Promise<void> {
    const el = this.q(name)
    this.clearSelectionUi()
    if (this.mode !== "demo") {
      el.classList.add("sel")
      return
    }
    const start = this.point(el, "left")
    start.x += 6
    await this.glide(start, 700)
    await this.sleep(150)
    // 按住：圓點縮小、外圈長滿
    const dot = this.cursorEl.firstElementChild
    const ring = this.cursorEl.querySelector("circle")
    this.cursorEl.classList.add("holding")
    const anims = [
      dot?.animate([{ transform: "scale(1)" }, { transform: "scale(.7)" }], { duration: 160, fill: "forwards" }),
      ring?.animate([{ strokeDashoffset: 100 }, { strokeDashoffset: 0 }], { duration: ms, easing: "linear", fill: "forwards" }),
    ]
    try {
      await this.sleep(ms)
      // 放開：選取範圍冒出來（從左邊長出一點再填滿），把手與系統選單跟著出現
      el.classList.add("sel")
      anims.push(el.animate([{ backgroundSize: "35% 100%" }, { backgroundSize: "100% 100%" }], { duration: 180, easing: "ease-out" }))
      this.ripple()
      this.showSelectionUi(el)
      await this.sleep(550)
    } finally {
      this.cursorEl.classList.remove("holding")
      for (const a of anims) a?.cancel()
    }
  }

  /** 一段字的範圍（畫布座標）：第一行的左上、最後一行的右下。 */
  private edges(el: HTMLElement): { left: number; top: number; right: number; bottom: number } {
    const rr = this.root.getBoundingClientRect()
    const rects = el.getClientRects()
    const first = rects[0] ?? el.getBoundingClientRect()
    const last = rects[rects.length - 1] ?? first
    const k = this.ratio
    return { left: (first.left - rr.left) / k, top: (first.top - rr.top) / k, right: (last.right - rr.left) / k, bottom: (last.bottom - rr.top) / k }
  }

  /** 目前選取範圍屬於哪一段字（沒有就是 null）；wireSelection 用它決定點擊後要不要保留把手。 */
  get selectionFor(): HTMLElement | null {
    return this.selUi?.el ?? null
  }

  /** 手機版：在選取範圍兩端畫水滴把手，上方畫灰色「系統選單」（拷貝｜分享）示意——那是手機自己的選單，不是網站的。 */
  showSelectionUi(el: HTMLElement, animate = true): void {
    this.clearSelectionUi()
    const e = this.edges(el)
    const pop = animate ? " bwz-tut-pop" : ""
    const start = h("span", { class: `bwz-tut-handle start${pop}` })
    const end = h("span", { class: `bwz-tut-handle end${pop}` })
    start.style.left = `${e.left - 15}px`
    start.style.top = `${e.bottom - 1}px`
    end.style.left = `${e.right}px`
    end.style.top = `${e.bottom - 1}px`
    const menu = h(
      "div",
      { class: `bwz-tut-sysmenu${pop}`, data: { t: "sysmenu" } },
      h("span", { class: "bwz-tut-sysmenu-bar" }, h("span", { text: "拷貝" }), h("i"), h("span", { text: "分享" })),
      h("small", { text: "手機自己的選單" }),
    )
    this.root.append(start, end, menu)
    const w = menu.offsetWidth
    const hgt = menu.offsetHeight
    menu.style.left = `${Math.max(6, Math.min(this.size.w - w - 6, (e.left + e.right) / 2 - w / 2))}px`
    menu.style.top = `${Math.max(28, e.top - hgt - 8)}px`
    this.selUi = { el, nodes: [start, end, menu] }
  }

  /** 收掉把手與系統選單（工具列關掉、或下一次選取開始時）。 */
  clearSelectionUi(): void {
    if (!this.selUi) return
    for (const n of this.selUi.nodes) n.remove()
    this.selUi = null
  }

  // ---------- 手機版的虛擬鍵盤 ----------

  /** 鍵盤升起（把輸入框捲到鍵盤上方）或收起。只有手機版示範（demo）才會畫；instant 與 try 都不畫。 */
  async keyboard(dir: "up" | "down", reveal?: HTMLElement): Promise<void> {
    if (this.mode !== "demo" || this.device !== "touch") return
    const kbH = Math.round(this.size.h * KEYBOARD_RATIO)
    if (dir === "up") {
      if (!this.kbd) {
        const keys = (labels: string[], cls = "") => h("div", { class: "bwz-tut-kbd-row" }, ...labels.map((l) => h("span", { class: `bwz-tut-key${l === " " ? " space" : ""}${cls}`, text: l === " " ? "空白" : l })))
        this.kbd = h(
          "div",
          { class: "bwz-tut-kbd", attrs: { "aria-hidden": "true" } },
          keys([..."qwertyuiop"]),
          keys([..."asdfghjkl"]),
          keys(["⇧", ..."zxcvbnm", "⌫"]),
          keys(["123", ",", " ", ".", "↵"]),
        )
        this.kbd.style.height = `${kbH}px`
        this.root.append(this.kbd)
        // 頁面可視範圍縮到鍵盤上方（跟真的手機一樣），多留一點可捲動的空間
        this.page.style.bottom = `${kbH}px`
        this.page.style.paddingBottom = "90px"
        this.kbd.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: 280, easing: "cubic-bezier(.2,.8,.25,1)" })
      }
      if (reveal) this.revealAbove(reveal)
      await this.sleep(reveal ? 450 : 300)
    } else if (this.kbd) {
      const kbd = this.kbd
      this.kbd = null
      this.page.style.bottom = ""
      this.page.style.paddingBottom = ""
      const a = kbd.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: 240, easing: "ease-in", fill: "forwards" })
      try {
        await this.sleep(240)
      } finally {
        a.cancel()
        kbd.remove()
      }
    }
  }

  /** 把輸入框（連同它的編輯卡片）捲到頁面可視範圍裡；不用 scrollIntoView，避免連外層一起捲。 */
  private revealAbove(el: HTMLElement): void {
    const target = el.closest<HTMLElement>("[data-t='editor'], .bwz-sticky") ?? el
    const pr = this.page.getBoundingClientRect()
    const tr = target.getBoundingClientRect()
    const k = this.ratio
    const over = (tr.bottom - pr.bottom) / k + 12
    const room = (tr.top - pr.top) / k - 6
    const delta = Math.min(over, room)
    if (delta > 0) this.page.scrollTo({ top: this.page.scrollTop + delta, behavior: "smooth" })
  }

  /** 假頁面內容換成另一個畫面（淡出淡入）。 */
  async cut(draw: () => void): Promise<void> {
    if (this.mode === "demo") {
      const out = this.page.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" })
      try {
        await this.sleep(200)
      } finally {
        out.cancel()
      }
    }
    this.page.replaceChildren()
    draw()
    if (this.mode === "demo") this.page.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 260 })
  }

  // ---------- 執行一串動作 ----------

  async play(steps: readonly Step[]): Promise<void> {
    for (const step of steps) {
      if (this.signal.aborted) throw new Stopped()
      if ("wait" in step) await this.sleep(step.wait)
      else if ("say" in step) this.onSay?.(step.say)
      else if ("move" in step) await this.move(step.move, step.at, step.ms)
      else if ("hover" in step) await this.hover(step.hover, step.ms)
      else if ("click" in step) await this.click(step.click, step.at)
      else if ("type" in step) await this.type(step.type, step.text, step.ms)
      // 手機版的 sweep 自動當成 longpress（手指沒有「拖曳掃過」這種動作），所以舊場景不用改
      else if ("sweep" in step) await (this.device === "touch" ? this.longpress(step.sweep) : this.sweep(step.sweep, step.ms))
      else if ("longpress" in step) await (this.device === "touch" ? this.longpress(step.longpress, step.ms) : this.sweep(step.longpress))
      else if ("keyboard" in step) await this.keyboard(step.keyboard)
      else await step.run(this)
    }
    this.hot?.classList.remove("bwz-tut-hot")
  }
}

/** 執行一串動作；被中斷（換段、關閉）回傳 false，跑完回傳 true。其他錯誤也當作「示範到此為止」。 */
export async function runSafely(stage: Stage, steps: readonly Step[]): Promise<boolean> {
  try {
    await stage.play(steps)
    return true
  } catch (e) {
    if (!(e instanceof Stopped)) console.warn("[tutorial] 示範中斷", e)
    return false
  }
}
