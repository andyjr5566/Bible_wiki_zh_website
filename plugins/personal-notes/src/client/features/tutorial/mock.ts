// 示範區用的「假零件」：經文清單、選取工具列、筆記面板與編輯框、便條紙、條目頁。
// 外觀盡量沿用真正的 class（工具列、便條紙、重點、候選清單…），這樣樣式、深色模式與真的畫面一致；
// 行為則是單純的假行為，全部只改 DOM，不讀寫任何資料。

import { h } from "../../ui/dom"
import type { Stage } from "./engine"
import { STAGE_W } from "./engine"
import { ICONS, svg } from "./svg"

// ---------- 經文 ----------

/** 創世記 1:1–5（和合本）。示範用的假頁面只放最短的幾節。 */
export const GEN1 = [
  "起初，神創造天地。",
  "地是空虛混沌，淵面黑暗；神的靈運行在水面上。",
  "神說：「要有光」，就有了光。",
  "神看光是好的，就把光暗分開了。",
  "神稱光為晝，稱暗為夜。有晚上，有早晨，這是頭一日。",
] as const

/** 經文裡可以「選取」的一段字（data-t 是 name）。 */
export interface Mark {
  verse: number
  phrase: string
  name: string
}

export function verseList(count: number, marks: readonly Mark[] = []): HTMLOListElement {
  const list = h("ol", { class: "bwz-tut-verses" })
  GEN1.slice(0, count).forEach((text, i) => {
    const n = i + 1
    const body = h("span", { class: "bwz-tut-vt" })
    const mark = marks.find((m) => m.verse === n)
    const at = mark ? text.indexOf(mark.phrase) : -1
    if (mark && at >= 0) {
      body.append(
        text.slice(0, at),
        h("span", { class: "bwz-tut-phrase", text: mark.phrase, data: { t: mark.name } }),
        text.slice(at + mark.phrase.length),
      )
    } else body.append(text)
    list.append(h("li", { class: "bwz-tut-verse", data: { v: String(n), t: `v${n}` } }, h("div", { class: "bwz-tut-vrow" }, h("span", { class: "bwz-tut-vn", text: String(n) }), body)))
  })
  return list
}

export function pageTitle(kicker: string, title: string): HTMLElement {
  return h("div", { class: "bwz-tut-ptitle" }, h("h2", { text: title }), h("small", { text: kicker }))
}

// ---------- 提示 ----------

export function toast(s: Stage, text: string): void {
  s.root.querySelector(".bwz-tut-toast")?.remove()
  const t = h("div", { class: "bwz-tut-toast", text })
  s.root.append(t)
  s.later(() => t.remove(), 2200)
}

// ---------- 小型 Markdown（只用 DOM API，不用 innerHTML） ----------

export function inline(text: string): (Node | string)[] {
  return text
    .split(/(\[\[[^\]\n]+\]\]|#[^\s#，。、]+)/)
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("[[")) return h("a", { class: "bwz-tut-link", text: part.slice(2, -2) })
      if (part.startsWith("#")) return h("span", { class: "bwz-n-tag", text: part })
      return part
    })
}

/** 筆記卡片裡的內文：段落、「> 」引文、[[條目]] 連結、#標籤。 */
export function renderMini(text: string): HTMLElement {
  const body = h("div", { class: "bwz-n-body bwz-n-md bwz-tut-md" })
  let quote: HTMLElement | null = null
  for (const line of text.split("\n")) {
    if (line.startsWith("> ")) {
      quote ??= body.appendChild(h("blockquote"))
      const content = line.slice(2)
      quote.append(h("p", { class: content.startsWith("——") ? "bwz-tut-cite" : "" }, ...inline(content)))
      continue
    }
    quote = null
    if (line.trim()) body.append(h("p", {}, ...inline(line)))
  }
  return body
}

export function noteCard(text: string, tag: string, time = "剛剛"): HTMLElement {
  return h(
    "article",
    { class: "bwz-n-card bwz-tut-card bwz-tut-in", data: { t: "card" } },
    h("div", { class: "bwz-n-card-head" }, h("span", { class: "bwz-n-verse", text: tag }), h("span", { class: "bwz-n-time", text: time })),
    renderMini(text),
  )
}

// ---------- 選取工具列 ----------

export interface ToolDef {
  name: string
  label: string
  run(): void
}

export function hideToolbar(s: Stage): void {
  s.root.querySelector(".bwz-tut-toolbar")?.remove()
  for (const el of s.root.querySelectorAll(".bwz-tut-phrase.sel")) el.classList.remove("sel")
}

/** 在選取的那段字上方彈出工具列（跟真的一樣用 .bwz-h-toolbar）。 */
export function showToolbar(s: Stage, anchor: HTMLElement, defs: readonly ToolDef[]): HTMLElement {
  s.root.querySelector(".bwz-tut-toolbar")?.remove()
  const bar = h(
    "div",
    { class: "bwz-h-toolbar bwz-tut-toolbar bwz-tut-pop", data: { t: "toolbar" }, attrs: { role: "toolbar" } },
    ...defs.map((d) =>
      h("button", {
        class: "bwz-n-btn small",
        text: d.label,
        data: { t: d.name },
        attrs: { type: "button" },
        on: {
          click: () => {
            d.run()
          },
        },
      }),
    ),
  )
  s.root.append(bar)
  const cx = s.point(anchor, "center").x
  const top = s.point(anchor, "top").y - 3
  const bottom = s.point(anchor, "bottom").y + 3
  const w = bar.offsetWidth
  const hgt = bar.offsetHeight
  bar.style.left = `${Math.max(6, Math.min(STAGE_W - w - 6, cx - w / 2))}px`
  bar.style.top = `${top - hgt - 8 > 30 ? top - hgt - 8 : bottom + 8}px`
  return bar
}

/**
 * 讓一段字可以「選取」：點一下就視為選好了，彈出工具列。
 * 示範時游標掃過之後呼叫 phrase.click()；「換你試試」時使用者自己點。點別處收起工具列。
 */
export function wireSelection(s: Stage, name: string, defs: () => readonly ToolDef[], next?: string): HTMLElement {
  const phrase = s.q(name)
  phrase.addEventListener("click", () => {
    hideToolbar(s)
    phrase.classList.add("sel")
    showToolbar(s, phrase, defs())
    s.hint(next ?? null)
  })
  if (!s.root.dataset.outside) {
    s.root.dataset.outside = "1"
    s.root.addEventListener("click", (e) => {
      const t = e.target as HTMLElement
      if (!t.closest(".bwz-tut-toolbar, .bwz-tut-phrase")) hideToolbar(s)
    })
  }
  return phrase
}

/** 把選取的字變成螢光筆重點。 */
export function highlight(phrase: HTMLElement): HTMLElement {
  const m = h("mark", { class: "bwz-hl bwz-tut-hl bwz-tut-flash", text: phrase.textContent ?? "" })
  m.dataset.t = phrase.dataset.t ?? ""
  phrase.replaceWith(m)
  return m
}

/** 經文前面的小書籤。 */
export function bookmarkVerse(li: HTMLElement): void {
  if (li.querySelector(".bwz-tut-ribbon")) return
  li.querySelector(".bwz-tut-vn")?.after(h("span", { class: "bwz-tut-ribbon", text: "🔖" }))
}

// ---------- 筆記面板與編輯框 ----------

const CANDIDATES = ["亞伯", "亞伯拉罕", "亞伯蘭", "亞當", "以撒"]

/** 輸入 [[ 時的條目候選清單（跟真的一樣：打字就篩選，點一個就補成 [[名稱]]）。 */
function attachComplete(ta: HTMLTextAreaElement, after: HTMLElement): void {
  let list: HTMLUListElement | null = null
  const close = () => {
    list?.remove()
    list = null
  }
  ta.addEventListener("input", () => {
    const caret = document.activeElement === ta ? ta.selectionStart : ta.value.length
    const before = ta.value.slice(0, caret)
    const m = /\[\[([^\]\n]*)$/.exec(before)
    if (!m) return close()
    const q = m[1]
    const names = CANDIDATES.filter((n) => n.includes(q)).slice(0, 3)
    if (!names.length) return close()
    close()
    list = h(
      "ul",
      { class: "bwz-n-complete bwz-tut-complete bwz-tut-pop", data: { t: "complete" } },
      ...names.map((n, i) =>
        h("li", {
          class: i === 0 ? "active" : "",
          text: n,
          data: { t: `cand-${n}` },
          on: {
            click: () => {
              const tail = ta.value.slice(caret)
              const head = before.slice(0, m.index)
              ta.value = `${head}[[${n}]]${tail}`
              const pos = head.length + n.length + 4
              ta.setSelectionRange(pos, pos)
              close()
              ta.dispatchEvent(new Event("input", { bubbles: true }))
            },
          },
        }),
      ),
    )
    after.after(list)
  })
}

export interface PanelOptions {
  addLabel: string
  /** 卡片左上的小標，例如「整章」「第 3 節」 */
  tag: string
  /** 完成一則筆記之後 */
  onSaved?: (text: string) => void
}

export interface MockPanel {
  el: HTMLElement
  /** 開一個新的編輯框（initial＝一開始就寫好的內容，例如引文）。 */
  open(initial?: string, tag?: string): void
}

export function mockPanel(s: Stage, opt: PanelOptions): MockPanel {
  const count = h("span", { class: "bwz-tut-count", text: "0", data: { t: "count" } })
  const add = h("button", { class: "bwz-n-btn small", text: opt.addLabel, data: { t: "add" }, attrs: { type: "button" } })
  const list = h("div", { class: "bwz-tut-list", data: { t: "list" } })
  const el = h("section", { class: "bwz-tut-panel", data: { t: "panel" } }, h("div", { class: "bwz-tut-panel-head" }, h("h4", {}, "我的筆記", count), add), list)
  let n = 0
  let editing = false

  const open = (initial = "", tag = opt.tag) => {
    if (editing) return
    editing = true
    add.hidden = true
    const ta = h("textarea", {
      class: "bwz-n-textarea bwz-tut-ta",
      data: { t: "ta" },
      attrs: { "aria-label": "筆記內容", placeholder: "寫下你的想法…", rows: String(Math.max(2, initial.split("\n").length)) },
    })
    ta.value = initial
    const status = h("span", { class: "bwz-tut-status", data: { t: "status" } })
    const setStatus = (kind: "idle" | "typing" | "saved") => {
      status.className = `bwz-tut-status ${kind}`
      status.replaceChildren(
        ...(kind === "saved" ? [h("span", { class: "bwz-tut-saved" }, svg(ICONS.check)), "已儲存在這台裝置"] : [kind === "typing" ? "輸入中…" : "自動儲存"]),
      )
    }
    setStatus(initial ? "saved" : "idle")
    let timer: ReturnType<typeof setTimeout> | undefined
    ta.addEventListener("input", () => {
      setStatus("typing")
      s.cancel(timer)
      timer = s.later(() => setStatus("saved"), 600)
      s.hint("done")
    })
    const done = h("button", { class: "bwz-n-btn small primary", text: "完成", data: { t: "done" }, attrs: { type: "button" } })
    const card = h(
      "div",
      { class: "bwz-n-card editing bwz-tut-card bwz-tut-in", data: { t: "editor" } },
      h("div", { class: "bwz-n-card-head" }, h("span", { class: "bwz-n-verse", text: tag })),
      ta,
      h("div", { class: "bwz-tut-editfoot" }, status, done),
    )
    done.addEventListener("click", () => {
      s.cancel(timer)
      const text = ta.value.trim()
      card.remove()
      editing = false
      add.hidden = false
      s.hint(null)
      if (!text) return
      n += 1
      count.textContent = String(n)
      count.classList.remove("bump")
      void count.offsetWidth
      count.classList.add("bump")
      list.prepend(noteCard(text, tag))
      opt.onSaved?.(text)
    })
    list.prepend(card)
    s.page.scrollTop = s.page.scrollHeight
    attachComplete(ta, ta)
    s.hint("ta")
  }
  add.addEventListener("click", () => open())
  return { el, open }
}

// ---------- 便條紙 ----------

type StickyColor = "yellow" | "pink" | "green" | "blue"
const COLORS: readonly StickyColor[] = ["yellow", "pink", "green", "blue"]
const COLOR_NAMES: Record<StickyColor, string> = { yellow: "麥黃", pink: "胭脂", green: "橄欖", blue: "黛藍" }

/** 在某一節下面貼一張便條（編輯中）。完成後變成紙箋；可收成小紙條、再展開。 */
export function mountSticky(s: Stage, li: HTMLElement, label: string): void {
  li.querySelector(".bwz-tut-sticky-host")?.remove()
  li.querySelector(".bwz-sticky-slot")?.remove()
  const host = h("div", { class: "bwz-tut-sticky-host" })
  const slot = h("span", { class: "bwz-sticky-slot" })
  li.append(host)
  li.querySelector(".bwz-tut-vt")?.append(slot)
  let color: StickyColor = "yellow"
  let text = ""

  const edit = (first: boolean) => {
    slot.replaceChildren()
    const ta = h("textarea", { class: "bwz-tut-sticky-ta", data: { t: "sticky-ta" }, attrs: { "aria-label": "便條內容", rows: "2" } })
    ta.value = text
    const el = h("div", { class: `bwz-sticky bwz-sticky-tilt-a ${first ? "bwz-tut-land" : "bwz-sticky-motion"}`, data: { color, t: "sticky" } })
    const dots = COLORS.map((c) =>
      h("button", {
        class: "bwz-sticky-color",
        data: { color: c, t: `color-${c}` },
        attrs: { type: "button", "aria-label": COLOR_NAMES[c], title: COLOR_NAMES[c], "aria-pressed": String(c === color) },
        on: {
          click: () => {
            color = c
            el.dataset.color = c
            for (const d of dots) d.setAttribute("aria-pressed", String(d.dataset.color === c))
            el.classList.remove("bwz-tut-recolor")
            void el.offsetWidth
            el.classList.add("bwz-tut-recolor")
            s.hint("sticky-done")
          },
        },
      }),
    )
    const done = h("button", { text: "完成", data: { t: "sticky-done" }, attrs: { type: "button", "aria-label": "完成" } })
    done.addEventListener("click", () => {
      text = ta.value.trim()
      if (!text) {
        host.remove()
        slot.remove()
        return
      }
      view()
    })
    ta.addEventListener("input", () => s.hint("color-pink"))
    el.append(h("div", { class: "bwz-sticky-label", text: label }), ta, h("div", { class: "bwz-sticky-actions" }, ...dots, done))
    host.replaceChildren(el)
    s.hint("sticky-ta")
  }

  const view = () => {
    slot.replaceChildren()
    const el = h("div", { class: "bwz-sticky bwz-sticky-tilt-a bwz-sticky-motion", data: { color, t: "sticky" } })
    const btn = (name: string, aria: string, icon: string, run: () => void) =>
      h("button", { class: "bwz-n-btn small", data: { t: name }, attrs: { type: "button", "aria-label": aria, title: aria }, on: { click: run } }, svg(icon))
    el.append(
      h("div", { class: "bwz-sticky-label", text: label }),
      h("div", { class: "bwz-sticky-text", text, on: { click: () => edit(false) } }),
      h(
        "div",
        { class: "bwz-sticky-actions" },
        btn("sticky-edit", "編輯便條", ICONS.edit, () => edit(false)),
        btn("sticky-collapse", "收起便條", ICONS.collapse, () => collapse(el)),
        btn("sticky-remove", "刪除便條", ICONS.remove, () => {
          host.remove()
          slot.remove()
          s.hint(null)
        }),
      ),
    )
    host.replaceChildren(el)
    s.hint("sticky-collapse")
  }

  const collapse = (el: HTMLElement) => {
    el.style.transformOrigin = "left top"
    const a = el.animate(
      [
        { opacity: 1, transform: "scale(1) rotate(-0.8deg)" },
        { opacity: 0, transform: "translateY(-18px) scale(.12) rotate(-8deg)" },
      ],
      { duration: 280, easing: "ease-in", fill: "forwards" },
    )
    const finish = () => {
      host.replaceChildren()
      slot.dataset.color = color
      const icon = h(
        "button",
        { class: "bwz-sticky-icon bwz-tut-pop", data: { t: "sticky-icon" }, attrs: { type: "button", "aria-label": "展開便條", title: "展開便條" } },
        svg(ICONS.noteFilled),
      )
      icon.addEventListener("click", () => {
        slot.replaceChildren()
        view()
        s.hint(null)
      })
      slot.replaceChildren(icon)
      s.hint("sticky-icon")
    }
    if (s.mode === "instant") finish()
    else a.onfinish = finish
  }

  edit(true)
}

// ---------- 條目頁 ----------

export function bookmarkButton(s: Stage, noun: string): HTMLButtonElement {
  const b = h("button", { class: "bwz-n-btn small bwz-tut-bm", text: "🔖 加入書籤", data: { t: "bm" }, attrs: { type: "button" } })
  b.addEventListener("click", () => {
    const on = !b.classList.contains("on")
    b.classList.toggle("on", on)
    b.textContent = on ? "🔖 已加入書籤" : "🔖 加入書籤"
    toast(s, on ? `已把「${noun}」加入書籤` : "已移除書籤")
    s.hint(null)
  })
  return b
}

export function entryHead(): HTMLElement[] {
  return [
    pageTitle("知識庫條目 · 人物", "亞伯拉罕"),
    h("p", { class: "bwz-tut-intro", text: "信心之父。神呼召他離開本地、本族、父家，往神所指示的地去。" }),
  ]
}

// ---------- 經文選取工具列的四個按鈕 ----------

/** 選了經文（name 那一段字）之後的工具列：畫重點、書籤、便條、寫筆記。沒有筆記面板的情境，「寫筆記」只提示。 */
export function verseTools(s: Stage, name: string, panel?: MockPanel): ToolDef[] {
  const phrase = () => s.q(name)
  const li = () => phrase().closest("li") as HTMLElement
  const verse = () => li().dataset.v ?? "1"
  return [
    {
      name: "hl",
      label: "🖍 畫重點",
      run: () => {
        const p = phrase()
        hideToolbar(s)
        highlight(p)
        s.hint(null)
      },
    },
    {
      name: "bm",
      label: "🔖 書籤",
      run: () => {
        bookmarkVerse(li())
        hideToolbar(s)
        toast(s, "已加入書籤")
        s.hint(null)
      },
    },
    {
      name: "st",
      label: "🗒️ 便條",
      run: () => {
        const l = li()
        const v = verse()
        hideToolbar(s)
        mountSticky(s, l, `✤ 創世記 1:${v}`)
      },
    },
    {
      name: "note",
      label: "📝 寫筆記",
      run: () => {
        const text = phrase().textContent ?? ""
        const v = verse()
        hideToolbar(s)
        if (panel) panel.open(`> ${text}\n`, `第 ${v} 節`)
        else toast(s, "「寫筆記」在第 2 段示範")
      },
    },
  ]
}
