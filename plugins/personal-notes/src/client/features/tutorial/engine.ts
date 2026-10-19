// 教學的「示範區」引擎：一個固定大小的假頁面（Stage）＋虛擬游標＋一串可編輯的動作（Step）。
//
// 重點：示範時由虛擬游標「替使用者操作」同一份假頁面——點擊用真的 click()、打字用真的 input 事件，
// 所以「播放示範」和「換你試試」共用同一套事件處理，不會有兩份行為。
// 這裡沒有任何儲存：假頁面的狀態只存在 DOM 與閉包裡，關掉教學就消失（不碰資料庫、不碰帳號）。

import { h } from "../../ui/dom"
import { ICONS, svg } from "./svg"

/** 假頁面的設計尺寸；實際顯示時由外框等比例縮放。 */
export const STAGE_W = 440
export const STAGE_H = 420

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
  private readonly cursorEl: HTMLElement
  private pos = { x: STAGE_W * 0.72, y: STAGE_H * 0.78 }
  private readonly timers = new Set<ReturnType<typeof setTimeout>>()
  private hinted: HTMLElement | null = null
  private hot: HTMLElement | null = null

  constructor(
    readonly mode: StageMode,
    readonly signal: AbortSignal,
  ) {
    this.page = h("div", { class: "bwz-tut-page" })
    this.cursorEl = h("div", { class: "bwz-tut-cursor", attrs: { "aria-hidden": "true" } }, svg(ICONS.cursor))
    this.cursorEl.style.transform = this.pt(this.pos)
    this.root = h(
      "div",
      { class: `bwz-tut-canvas ${mode}`, attrs: { "aria-hidden": mode === "try" ? null : "true" } },
      h(
        "div",
        { class: "bwz-tut-bar" },
        h("span", { class: "bwz-tut-bar-dots" }, h("i"), h("i"), h("i")),
        h("span", { class: "bwz-tut-bar-url", text: "示範頁" }),
        h("span", { class: "bwz-tut-bar-tag", text: "不會存進你的筆記" }),
      ),
      this.page,
    )
    // 示範時只是「看」：不能被 Tab 或點擊碰到（程式用 click() 操作不受影響）
    if (mode !== "try") this.root.toggleAttribute("inert", true)
    if (mode === "demo") this.root.append(this.cursorEl)
    signal.addEventListener("abort", () => this.clearTimers(), { once: true })
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
      await this.move(name, at)
      await this.sleep(120)
      this.cursorEl.firstElementChild?.animate([{ transform: "scale(1)" }, { transform: "scale(.78)" }, { transform: "scale(1)" }], { duration: 260 })
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

  /** 游標移到某元素上，並把它標成「正在指著」。 */
  async hover(name: string, ms?: number): Promise<void> {
    await this.move(name, "center", ms)
    this.hot?.classList.remove("bwz-tut-hot")
    this.hot = this.q(name)
    this.hot.classList.add("bwz-tut-hot")
  }

  /** 打字：真的改 value 並送 input 事件（假頁面的自動儲存、[[ 候選清單都吃這個事件）。 */
  async type(name: string, text: string, ms = 85): Promise<void> {
    const el = this.q<HTMLInputElement | HTMLTextAreaElement>(name)
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
      else if ("sweep" in step) await this.sweep(step.sweep, step.ms)
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
