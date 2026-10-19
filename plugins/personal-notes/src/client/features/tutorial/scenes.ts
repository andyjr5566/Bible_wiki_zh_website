// 教學的八個段落。每段是一份小小的宣告式定義：標題、說明、（減少動態效果時顯示的）步驟、畫假頁面的 build、
// 示範用的動作清單 demo、「換你試試」的提示。要改文案或動作，只動這個檔案。
//
// 假頁面上的元素用 data-t="名稱" 標記，demo 的動作用名稱指到它們（見 engine.ts 的 Step）。
// build 要把「事件處理」一起接好：示範時游標替使用者點、打字，「換你試試」時使用者自己點，走的是同一套處理。
// 模組載入時不碰 document（build 與 demo 內的函式才會碰），所以測試可以在 Node 直接檢查這份資料。

import { h } from "../../ui/dom"
import type { Stage, Step } from "./engine"
import {
  bookmarkButton,
  entryHead,
  hideToolbar,
  inline,
  mockPanel,
  pageTitle,
  toast,
  verseList,
  verseTools,
  wireSelection,
  type Mark,
} from "./mock"

export interface Scene {
  /** 不重複的代號（也用在記住看到哪一段） */
  id: string
  /** 上方標題（不含編號） */
  title: string
  /** 下方一行說明 */
  caption: string
  /** 減少動態效果時列出的步驟（至少 2 條） */
  steps: string[]
  /** 「換你試試」要做什麼 */
  tryText: string
  /** 「換你試試」一開始用光圈提示的元素（data-t） */
  tryTarget: string
  /** 畫出假頁面的起始畫面，並接好事件處理 */
  build(s: Stage): void
  /** 示範動作（8～15 秒） */
  demo: Step[]
}

/** 示範時「選取」完一段字，等於使用者點了那段字（彈出工具列）。 */
const pop = (name: string): Step => ({ run: (s) => void s.q(name).click() })

// ---------- 1 寫整章筆記 ----------

const writeNote: Scene = {
  id: "write",
  title: "寫整章筆記",
  caption: "每一章最下面都有「我的筆記」。按「＋ 新增筆記」就能寫，邊寫邊自動儲存。",
  steps: ["拉到章節最下面，找到「我的筆記」", "按「＋ 新增筆記」", "直接打字，不用按儲存，畫面會出現「已儲存」", "寫完按「完成」，筆記就收進清單"],
  tryText: "按「＋ 新增筆記」，隨便寫幾個字，再按「完成」。",
  tryTarget: "add",
  build(s) {
    const panel = mockPanel(s, { addLabel: "＋ 新增筆記", tag: "整章" })
    s.page.append(pageTitle("創世記 第 1 章", "起初"), verseList(3), panel.el)
  },
  demo: [
    { wait: 500 },
    { click: "add" },
    { wait: 300 },
    { click: "ta" },
    { type: "ta", text: "第一天，神先造光。\n祂一說話，光就有了。", ms: 90 },
    { wait: 1200 },
    { click: "done" },
    { wait: 1300 },
  ],
}

// ---------- 2 選經文 ----------

const MARKS_2: Mark[] = [
  { verse: 3, phrase: "神說：「要有光」", name: "sel" },
  { verse: 1, phrase: "起初，神創造天地", name: "sel2" },
]

const selectVerse: Scene = {
  id: "select",
  title: "選經文",
  caption: "在經文上選一段字，會跳出工具列：畫重點、書籤、便條、寫筆記。",
  steps: ["用手指或滑鼠選取一段經文", "選好後，下方跳出工具列", "按「🖍 畫重點」，那段字就畫上螢光筆", "再選一段，按「📝 寫筆記」，會開一則針對這幾節的筆記，並把經文帶進來"],
  tryText: "點一下有虛線的經文（當作選好了），再按工具列上的按鈕。",
  tryTarget: "sel",
  build(s) {
    const panel = mockPanel(s, { addLabel: "＋ 新增筆記", tag: "整章" })
    s.page.append(pageTitle("創世記 第 1 章", "起初"), verseList(5, MARKS_2), panel.el)
    wireSelection(s, "sel", () => verseTools(s, "sel", panel), "hl")
    wireSelection(s, "sel2", () => verseTools(s, "sel2", panel), "note")
  },
  demo: [
    { wait: 400 },
    { sweep: "sel", ms: 900 },
    pop("sel"),
    { wait: 250 },
    { hover: "note", ms: 420 },
    { hover: "st", ms: 320 },
    { hover: "bm", ms: 320 },
    { hover: "hl", ms: 320 },
    { click: "hl" },
    { wait: 700 },
    { say: "再選一段，按「📝 寫筆記」，經文會一起帶進筆記。" },
    { sweep: "sel2", ms: 800 },
    pop("sel2"),
    { wait: 250 },
    { click: "note" },
    { wait: 400 },
    { type: "ta", text: "天地萬物都是神造的", ms: 90 },
    { wait: 1300 },
  ],
}

// ---------- 3 便條紙 ----------

const stickyScene: Scene = {
  id: "sticky",
  title: "便條紙",
  caption: "選經文按「🗒️ 便條」，經文下方會貼上一張便條紙。能換顏色，也能收成小紙條。",
  steps: ["選取經文，按「🗒️ 便條」", "便條紙貼在那一節的下方，稍微有點歪", "寫幾個字，點小圓點換顏色，按「完成」", "按右上角的收起圖示，變成小紙條；點小紙條再展開"],
  tryText: "點一下有虛線的經文，按「🗒️ 便條」，再試試換顏色、收起、展開。",
  tryTarget: "sel",
  build(s) {
    s.page.append(pageTitle("創世記 第 1 章", "起初"), verseList(4, [{ verse: 3, phrase: "要有光", name: "sel" }]))
    wireSelection(s, "sel", () => verseTools(s, "sel"), "st")
  },
  demo: [
    { wait: 400 },
    { sweep: "sel", ms: 650 },
    pop("sel"),
    { wait: 250 },
    { click: "st" },
    { wait: 500 },
    { click: "sticky-ta" },
    { type: "sticky-ta", text: "光是第一個被造的", ms: 80 },
    { wait: 300 },
    { say: "點小圓點，就能換顏色。" },
    { click: "color-pink" },
    { wait: 250 },
    { click: "color-green" },
    { wait: 250 },
    { click: "sticky-done" },
    { wait: 400 },
    { say: "不想佔位置，就收成小紙條；點小紙條再展開。" },
    { click: "sticky-collapse" },
    { wait: 600 },
    { click: "sticky-icon" },
    { wait: 700 },
  ],
}

// ---------- 4 [[條目]] 連結 ----------

const LINK_TEXT = "信心的典範：[[亞伯拉罕]] 蒙召離開本地"

/** 條目頁：標題、簡介，以及「我的相關筆記」（指到這個條目的筆記會自動列在這裡）。 */
function entryWithRelated(s: Stage, text: string): void {
  const card = h(
    "a",
    { class: "bwz-related-card bwz-tut-in bwz-tut-flash", data: { t: "rcard" } },
    h("span", { class: "bwz-related-place" }, h("span", { text: "創世記 1 · 整章" })),
    h("span", { class: "bwz-related-preview" }, ...inline(text)),
  )
  s.page.append(
    ...entryHead(),
    h(
      "section",
      { class: "bwz-related bwz-tut-related", data: { t: "related" } },
      h("h3", { class: "bwz-related-heading" }, "我的相關筆記", h("span", { class: "bwz-related-count", text: "1" })),
      h(
        "div",
        { class: "bwz-related-group" },
        h("h4", { class: "bwz-related-group-heading" }, "連到這個條目 ", h("span", { class: "bwz-related-count", text: "1" })),
        h("p", { class: "bwz-related-description", text: "筆記裡用 [[亞伯拉罕]] 連過來的" }),
        h("div", { class: "bwz-related-cards" }, card),
      ),
    ),
  )
}

const linkScene: Scene = {
  id: "link",
  title: "[[條目]] 連結",
  caption: "在筆記裡打「[[」再加條目名，會出現候選清單，選一個就變成連結。",
  steps: ["在筆記裡輸入 [[ 和條目名稱的前幾個字", "候選清單跳出來，點選要連的條目", "筆記裡的名字變成連結", "到那個條目頁，「我的相關筆記」就列出這則筆記"],
  tryText: "在編輯框打「[[亞伯」，從候選清單選「亞伯拉罕」，再按「完成」。",
  tryTarget: "ta",
  build(s) {
    const panel = mockPanel(s, {
      addLabel: "＋ 新增筆記",
      tag: "整章",
      onSaved: (text) => {
        if (!s.trying || !text.includes("[[")) return
        const go = h("button", { class: "bwz-n-btn small bwz-tut-go bwz-tut-in", text: "→ 到〈亞伯拉罕〉條目頁看看", data: { t: "go" }, attrs: { type: "button" } })
        go.addEventListener("click", () => void s.cut(() => entryWithRelated(s, text)))
        panel.el.append(go)
        s.hint("go")
      },
    })
    s.page.append(pageTitle("創世記 第 1 章", "起初"), panel.el)
    panel.open()
  },
  demo: [
    { wait: 500 },
    { click: "ta" },
    { type: "ta", text: "信心的典範：[[亞伯", ms: 110 },
    { wait: 700 },
    { say: "從清單選一個，名字就變成條目連結。" },
    { click: "cand-亞伯拉罕" },
    { wait: 300 },
    { type: "ta", text: " 蒙召離開本地", ms: 90 },
    { wait: 500 },
    { click: "done" },
    { wait: 1500 },
    { say: "到〈亞伯拉罕〉條目頁，這則筆記自動列在「我的相關筆記」。" },
    { run: (s) => s.cut(() => entryWithRelated(s, LINK_TEXT)) },
    { wait: 2600 },
  ],
}

// ---------- 5 引用到筆記 ----------

const quoteScene: Scene = {
  id: "quote",
  title: "引用到筆記",
  caption: "在註釋或條目頁選一段字，按「❝ 引用到筆記」，引文和出處會自動寫進筆記。",
  steps: ["在註釋文字裡選取一段", "按「❝ 引用到筆記」", "筆記裡自動出現引文，和一行出處「—— 創世記 1 · 本章整理」", "在引文下面寫自己的想法，按「完成」"],
  tryText: "點一下有虛線的文字（當作選好了），按「❝ 引用到筆記」，再接著寫。",
  tryTarget: "sel",
  build(s) {
    const panel = mockPanel(s, { addLabel: "＋ 新增筆記", tag: "整章" })
    s.page.append(
      pageTitle("創世記 第 1 章", "起初"),
      verseList(1),
      h(
        "div",
        { class: "bwz-tut-commentary" },
        h("h3", { text: "本章整理" }),
        h("p", {}, "「起初」是時間的開始。", h("span", { class: "bwz-tut-phrase", text: "神在萬有之先", data: { t: "sel" } }), "，祂本身沒有起頭，也沒有終點。"),
      ),
      panel.el,
    )
    wireSelection(
      s,
      "sel",
      () => [
        {
          name: "quote",
          label: "❝ 引用到筆記",
          run: () => {
            const text = s.q("sel").textContent ?? ""
            hideToolbar(s)
            panel.open(`> ${text}\n> —— 創世記 1 · 本章整理\n`, "整章")
          },
        },
      ],
      "quote",
    )
  },
  demo: [
    { wait: 400 },
    { sweep: "sel", ms: 900 },
    pop("sel"),
    { wait: 300 },
    { click: "quote" },
    { wait: 700 },
    { say: "引文和出處自動寫好，接著寫你自己的想法。" },
    { type: "ta", text: "神是起頭，信心也從祂開始", ms: 90 },
    { wait: 1000 },
    { click: "done" },
    { wait: 1500 },
  ],
}

// ---------- 6 條目頁 ----------

const entryScene: Scene = {
  id: "entry",
  title: "條目頁",
  caption: "知識庫的條目頁也能「🔖 加入書籤」，或直接寫一則關於這個條目的筆記。",
  steps: ["打開知識庫的條目頁（例如〈亞伯拉罕〉）", "按標題下方的「🔖 加入書籤」", "按「＋ 寫一則關於〈亞伯拉罕〉的筆記」", "寫完按「完成」，筆記就收進這個條目裡"],
  tryText: "按「🔖 加入書籤」，再按「＋ 寫一則關於〈亞伯拉罕〉的筆記」寫一則。",
  tryTarget: "bm",
  build(s) {
    const panel = mockPanel(s, { addLabel: "＋ 寫一則關於〈亞伯拉罕〉的筆記", tag: "條目" })
    s.page.append(...entryHead(), h("div", { class: "bwz-tut-row-actions" }, bookmarkButton(s, "亞伯拉罕")), panel.el)
    if (s.trying) s.q("bm").addEventListener("click", () => s.hint("add"), { once: true })
  },
  demo: [
    { wait: 500 },
    { click: "bm" },
    { wait: 1500 },
    { click: "add" },
    { wait: 300 },
    { type: "ta", text: "蒙召離開本地，走向應許之地。", ms: 85 },
    { wait: 1100 },
    { click: "done" },
    { wait: 1300 },
  ],
}

// ---------- 7 〈我的筆記〉 ----------

interface Item {
  place: string
  text: string
  book: string
  chapter: number
}
type TabId = "notes" | "stickies" | "highlights" | "bookmarks"

const TABS: { id: TabId; label: string }[] = [
  { id: "notes", label: "筆記" },
  { id: "stickies", label: "便條" },
  { id: "highlights", label: "重點" },
  { id: "bookmarks", label: "書籤" },
]

const DATA: Record<TabId, Item[]> = {
  notes: [
    { place: "創世記 1 · 整章", text: "光先於日月，神一說話就成了。 #禱告", book: "創世記", chapter: 1 },
    { place: "創世記 1:3", text: "神說有光：祂的話有能力。", book: "創世記", chapter: 1 },
    { place: "出埃及記 12 · 整章", text: "逾越節的羊羔，指向基督。 #預表", book: "出埃及記", chapter: 12 },
  ],
  stickies: [
    { place: "✤ 創世記 1:3", text: "光是第一個被造的 #禱告", book: "創世記", chapter: 1 },
    { place: "✤ 創世記 1:5", text: "有晚上，有早晨", book: "創世記", chapter: 1 },
  ],
  highlights: [
    { place: "創世記 1:1", text: "起初，神創造天地", book: "創世記", chapter: 1 },
    { place: "創世記 1:3", text: "神說：「要有光」", book: "創世記", chapter: 1 },
    { place: "創世記 1:4", text: "神看光是好的", book: "創世記", chapter: 1 },
    { place: "出埃及記 12:13", text: "我看見血，就越過你們去", book: "出埃及記", chapter: 12 },
  ],
  bookmarks: [
    { place: "創世記 1", text: "整章", book: "創世記", chapter: 1 },
    { place: "〈亞伯拉罕〉", text: "知識庫條目", book: "創世記", chapter: 1 },
  ],
}

const matches = (item: Item, query: string) => {
  const hay = `${item.place} ${item.text}`
  return query
    .split(/\s+/)
    .filter(Boolean)
    .every((tok) => hay.includes(tok))
}

function buildMyNotes(s: Stage): void {
  let tab: TabId = "notes"
  let query = ""
  const open = new Set<string>()
  const summary = h("p", { class: "bwz-shell-summary", data: { t: "summary" } })
  const search = h("input", {
    class: "bwz-n-input bwz-shell-search",
    data: { t: "search" },
    attrs: { type: "search", placeholder: "搜尋（可輸入多個詞、#標籤、書卷章節）", "aria-label": "搜尋我的筆記" },
  })
  const tabBar = h("div", { class: "bwz-shell-tabs", attrs: { role: "tablist" } })
  const body = h("div", { class: "bwz-tut-lib" })
  const nums = new Map<TabId, HTMLElement>()
  const buttons = new Map<TabId, HTMLElement>()
  for (const t of TABS) {
    const num = h("span", { class: "bwz-shell-tab-num", text: String(DATA[t.id].length) })
    nums.set(t.id, num)
    const b = h(
      "button",
      { class: "bwz-shell-tab", data: { t: `tab-${t.id}` }, attrs: { type: "button", role: "tab" }, on: { click: () => { tab = t.id; if (s.trying) s.hint(query ? null : "search"); render() } } },
      h("span", { text: t.label }),
      num,
    )
    buttons.set(t.id, b)
    tabBar.append(b)
  }

  const row = (it: Item, kind: TabId) =>
    h("div", { class: `bwz-tut-lrow ${kind}` }, h("span", { class: "bwz-tut-lplace", text: it.place }), h("span", { class: "bwz-tut-ltext", text: it.text }))

  const tree = () => {
    const books = [...new Set(DATA.notes.map((n) => n.book))]
    return h(
      "div",
      { class: "bwz-tut-tree" },
      h("div", { class: "bwz-lib-title", text: "依書卷" }),
      ...books.map((book) => {
        const inBook = DATA.notes.filter((n) => n.book === book)
        const isOpen = open.has(book)
        const chapters = [...new Set(inBook.map((n) => n.chapter))]
        return h(
          "div",
          { class: `bwz-tut-book${isOpen ? " open" : ""}` },
          h(
            "button",
            { class: "bwz-tut-sum", data: { t: `book-${book}` }, attrs: { type: "button", "aria-expanded": String(isOpen) }, on: { click: () => { isOpen ? open.delete(book) : open.add(book); render() } } },
            h("span", { class: "bwz-tut-caret", text: "▸" }),
            h("span", { class: "bwz-tut-name", text: book }),
            h("span", { class: "bwz-shell-tab-num", text: String(inBook.length) }),
          ),
          ...(isOpen
            ? chapters.map((ch) => {
                const key = `${book}-${ch}`
                const chOpen = open.has(key)
                const inCh = inBook.filter((n) => n.chapter === ch)
                return h(
                  "div",
                  { class: `bwz-tut-chapter${chOpen ? " open" : ""} bwz-tut-in` },
                  h(
                    "button",
                    { class: "bwz-tut-sum", data: { t: `chap-${key}` }, attrs: { type: "button" }, on: { click: () => { chOpen ? open.delete(key) : open.add(key); render() } } },
                    h("span", { class: "bwz-tut-caret", text: "▸" }),
                    h("span", { class: "bwz-tut-name", text: `第 ${ch} 章` }),
                    h("span", { class: "bwz-shell-tab-num", text: String(inCh.length) }),
                  ),
                  ...(chOpen ? inCh.map((n) => row(n, "notes")) : []),
                )
              })
            : []),
        )
      }),
    )
  }

  const render = () => {
    summary.textContent = `共 ${DATA.notes.length} 則筆記 · ${DATA.stickies.length} 張便條 · ${DATA.highlights.length} 個重點 · ${DATA.bookmarks.length} 個書籤`
    for (const t of TABS) {
      const n = DATA[t.id].filter((it) => matches(it, query)).length
      const el = nums.get(t.id)!
      if (el.textContent !== String(n)) {
        el.textContent = String(n)
        el.classList.remove("bump")
        void el.offsetWidth
        el.classList.add("bump")
      }
      const on = t.id === tab
      buttons.get(t.id)!.classList.toggle("on", on)
      buttons.get(t.id)!.setAttribute("aria-selected", String(on))
    }
    const items = DATA[tab].filter((it) => matches(it, query))
    body.replaceChildren()
    if (query) {
      body.append(h("p", { class: "bwz-lib-count", text: items.length ? `符合 ${items.length} 則` : "沒有符合的" }), ...items.map((it) => row(it, tab)))
    } else if (tab === "notes") {
      body.append(h("div", { class: "bwz-lib-title", text: "最近" }), ...items.slice(0, 2).map((it) => row(it, tab)), tree())
    } else {
      body.append(...items.slice(0, 4).map((it) => row(it, tab)))
    }
  }
  search.addEventListener("input", () => {
    query = search.value.trim()
    render()
    if (s.trying) s.hint(query ? null : "book-創世記")
  })
  render()
  s.page.append(summary, search, tabBar, body)
}

const myNotesScene: Scene = {
  id: "mynotes",
  title: "〈我的筆記〉",
  caption: "〈我的筆記〉把全部收在一起：分頁看筆記、便條、重點、書籤，能搜尋，也能依書卷找。",
  steps: ["左上角點「我的筆記」，進入〈我的筆記〉頁", "上方分頁切換：筆記、便條、重點、書籤，後面的數字是數量", "搜尋框輸入「#禱告」，只留下有這個標籤的", "「依書卷」一層一層打開，找某一章的筆記"],
  tryText: "點上面的分頁看看；在搜尋框打「#禱告」；再打開「依書卷」裡的創世記。",
  tryTarget: "tab-stickies",
  build: buildMyNotes,
  demo: [
    { wait: 500 },
    { click: "tab-stickies" },
    { wait: 120 },
    { click: "tab-highlights" },
    { wait: 120 },
    { click: "tab-bookmarks" },
    { wait: 120 },
    { click: "tab-notes" },
    { wait: 300 },
    { say: "搜尋框輸入 #禱告，只留下有這個標籤的，分頁上的數字也跟著變。" },
    { click: "search" },
    { type: "search", text: "#禱告", ms: 120 },
    { wait: 1300 },
    {
      run: (s) => {
        const input = s.q<HTMLInputElement>("search")
        input.value = ""
        input.dispatchEvent(new Event("input", { bubbles: true }))
      },
    },
    { wait: 500 },
    { say: "「依書卷」一層一層打開，找到那一章的筆記。" },
    { click: "book-創世記" },
    { wait: 450 },
    { click: "chap-創世記-1" },
    { wait: 900 },
  ],
}

// ---------- 8 同步與備份 ----------

function buildSync(s: Stage): void {
  let signedIn = false
  const dot = h("span", { class: "bwz-n-dot" })
  const text = h("span", { class: "bwz-n-status-text", text: "尚未登入，筆記只存在這台裝置" })
  const signin = h("button", { class: "bwz-n-btn small primary", text: "用 Google 同步", data: { t: "signin" }, attrs: { type: "button" } })
  const status = h("div", { class: "bwz-n-status bwz-tut-status-bar" }, dot, text, signin)
  const settings = h("button", { class: "bwz-n-btn bwz-settings-btn", text: "⚙ 設定與備份", data: { t: "settings" }, attrs: { type: "button" } })
  const ghost = () => h("div", { class: "bwz-n-card bwz-tut-ghost" }, h("span", { class: "bwz-tut-gline long" }), h("span", { class: "bwz-tut-gline" }))
  s.page.append(
    status,
    h("div", { class: "bwz-tut-headrow" }, h("p", { class: "bwz-shell-summary", text: "共 3 則筆記 · 2 張便條" }), settings),
    h("div", { class: "bwz-shell-tabs" }, ...["筆記", "便條", "重點", "書籤"].map((l, i) => h("span", { class: `bwz-shell-tab${i === 0 ? " on" : ""}`, text: l }))),
    ghost(),
    ghost(),
  )

  const chooser = () => {
    const account = h(
      "button",
      { class: "bwz-tut-account", data: { t: "account" }, attrs: { type: "button" } },
      h("span", { class: "bwz-tut-avatar", text: "明" }),
      h("span", {}, h("b", { text: "小明" }), h("small", { text: "xiaoming@example.com" })),
    )
    const back = h("div", { class: "bwz-tut-modal-back" }, h("div", { class: "bwz-tut-chooser bwz-tut-pop" }, h("p", { text: "選擇帳戶" }), account))
    account.addEventListener("click", () => {
      back.remove()
      signedIn = true
      dot.classList.add("ok")
      text.textContent = "已登入 · 小明 · 已同步 ✓"
      signin.hidden = true
      toast(s, "已登入，筆記會自動同步")
      s.hint("settings")
    })
    s.root.append(back)
    s.hint("account")
  }
  signin.addEventListener("click", chooser)

  settings.addEventListener("click", () => {
    if (s.root.querySelector(".bwz-tut-settings")) return
    const note = h("p", { class: "bwz-n-muted bwz-tut-note", text: "備份檔放在你自己的 Google Drive，只有你看得到；之後可以合併還原。" })
    const drive = h("button", { class: "bwz-n-btn", text: "存一份到我的 Google Drive", data: { t: "drive" }, attrs: { type: "button" } })
    drive.addEventListener("click", () => {
      if (!signedIn) {
        toast(s, "先用 Google 同步登入，才能存到 Drive")
        s.hint("signin")
        return
      }
      drive.textContent = "✓ 已存一份到 Drive"
      drive.classList.add("done")
      note.textContent = "剛剛存好了。檔案在你的 Drive「聖經知識庫筆記備份」資料夾。"
      s.hint("export")
    })
    const exp = h("button", { class: "bwz-n-btn", text: "匯出備份（JSON）", data: { t: "export" }, attrs: { type: "button" } })
    exp.addEventListener("click", () => {
      toast(s, "已匯出 12 則筆記")
      s.hint("close")
    })
    const close = h("button", { class: "bwz-n-btn small primary", text: "完成", data: { t: "close" }, attrs: { type: "button" } })
    const back = h(
      "div",
      { class: "bwz-tut-modal-back" },
      h(
        "div",
        { class: "bwz-n-dialog bwz-tut-settings bwz-tut-pop", attrs: { role: "presentation" } },
        h("h3", { text: "設定與備份" }),
        h("section", {}, h("h4", { text: "備份" }), drive, note),
        h("section", {}, h("h4", { text: "匯出" }), exp, h("button", { class: "bwz-n-btn", text: "匯出 Markdown（Obsidian）", attrs: { type: "button" } })),
        h("div", { class: "bwz-n-dialog-actions" }, close),
      ),
    )
    close.addEventListener("click", () => {
      back.remove()
      s.hint(null)
    })
    s.root.append(back)
    s.hint(signedIn ? "drive" : "signin")
  })
}

const syncScene: Scene = {
  id: "sync",
  title: "同步與備份",
  caption: "登入 Google 後，手機和電腦的筆記會同步；也能另外存一份到自己的 Google Drive，或匯出成檔案。",
  steps: ["〈我的筆記〉頁上方按「用 Google 同步」，選你的帳戶", "狀態變成「已登入、已同步」，手機和電腦看到同一份", "按「⚙ 設定與備份」，再按「存一份到我的 Google Drive」", "想自己收著，就按「匯出備份（JSON）」存成檔案"],
  tryText: "按「用 Google 同步」，選帳戶，再打開「⚙ 設定與備份」。（這裡是假的，不會真的登入。）",
  tryTarget: "signin",
  build: buildSync,
  demo: [
    { wait: 500 },
    { click: "signin" },
    { wait: 500 },
    { click: "account" },
    { wait: 1300 },
    { say: "到「⚙ 設定與備份」，把筆記另外存一份到自己的 Google Drive。" },
    { click: "settings" },
    { wait: 600 },
    { click: "drive" },
    { wait: 1400 },
    { say: "也可以匯出成檔案，自己收著。" },
    { click: "export" },
    { wait: 1300 },
  ],
}

export const SCENES: readonly Scene[] = [writeNote, selectVerse, stickyScene, linkScene, quoteScene, entryScene, myNotesScene, syncScene]
