// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { REVEAL_EVENT, requestReveal } from "../../../quartz/util/revealEvent"
import {
  TABS_ATTR,
  TAB_CHANGE_EVENT,
  VERSE_JUMP_EVENT,
  requestTabSwitch,
  type TabChangeDetail,
} from "../../../quartz/util/readingTabEvent"
import {
  FLASH_CLASS,
  MARKED_ATTR,
  TEXT_ONLY_CLASS,
  applyMarks,
  computeHeadingScrollTop,
  computeVerseScrollTop,
  initPureMode,
  isPureAvailable,
  prepareForNav,
  revealTarget,
  setReadingView,
  tabHintText,
} from "../src/lib/pureMode"
import { VIEW_ATTR, VIEW_STORAGE_KEY } from "../src/lib/readingView"

const HTML = `
<article><div class="markdown-preview-view">
  <h1 id="t">出埃及記 第12章</h1>
  <div class="table-container" id="top-nav"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
  <div class="bwz-ra" id="ra">朗讀列</div>
  <a class="bwz-ia-line" id="ia" href="#互動網站">互動網站提示</a>
  <ol id="verses"><li id="v1">一</li><li id="v2">二</li></ol>
  <hr id="hr1">
  <h2 id="nodes">本章知識節點</h2><h3 id="n1">神學</h3><ul><li>節點</li></ul>
  <hr id="hr2">
  <h2 id="study">本章整理</h2><h3 id="s1">一、安息</h3><p id="p1">整理</p>
  <hr id="hr3">
  <h2 id="app">附錄</h2><h3 id="互動網站">互動網站</h3><p id="pa">附錄內容</p>
  <div class="table-container" id="foot"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
</div></article>`

const VERSES_ONLY_HTML = `
<article><div class="markdown-preview-view">
  <h1 id="t">創世記 第99章</h1>
  <div class="table-container" id="top-nav"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
  <ol id="verses"><li id="v1">一</li><li id="v2">二</li></ol>
  <div class="table-container" id="foot"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
</div></article>`

const root = document.documentElement
const hidden = () => Array.from(document.querySelectorAll(".bwz-ux-hide")).map((e) => e.id || e.tagName.toLowerCase())
const textOnly = () => Array.from(document.querySelectorAll(`.${TEXT_ONLY_CLASS}`)).map((e) => e.id || e.tagName.toLowerCase())
const shown = () => Array.from(document.querySelectorAll(".bwz-ux-reveal")).map((e) => e.id || e.tagName.toLowerCase())

beforeEach(() => {
  document.body.dataset.slug = "02-出埃及記/第12章"
  document.body.innerHTML = HTML
  root.setAttribute(VIEW_ATTR, "text")
  root.removeAttribute(MARKED_ATTR)
  root.removeAttribute(TABS_ATTR)
  localStorage.clear()
  sessionStorage.clear()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  prepareForNav()
})

describe("純函式計算", () => {
  it("tabHintText 依目前分頁回傳白話說明", () => {
    expect(tabHintText("text")).toContain("研讀")
    expect(tabHintText("study")).toContain("經文")
  })

  it("computeVerseScrollTop 在可見區域置中且不回傳負數", () => {
    expect(
      computeVerseScrollTop({
        rectTop: 1000,
        rectHeight: 80,
        scrollY: 0,
        viewportHeight: 800,
        topObstruction: 60,
      }),
    ).toBe(610)
    expect(
      computeVerseScrollTop({
        rectTop: 10,
        rectHeight: 80,
        scrollY: 0,
        viewportHeight: 800,
        topObstruction: 60,
      }),
    ).toBe(0)
  })

  it("computeHeadingScrollTop 扣掉頂端遮擋高度並留白", () => {
    expect(computeHeadingScrollTop({ rectTop: 500, scrollY: 100, topObstruction: 60 })).toBe(528)
    expect(computeHeadingScrollTop({ rectTop: 10, scrollY: 0, topObstruction: 60 })).toBe(0)
  })
})

describe("applyMarks 與分頁範圍", () => {
  it("分別標出研讀區與經文專屬區；保留標題、導覽表格與互動網站提示", () => {
    expect(applyMarks()).toBe(true)
    expect(hidden()).toEqual(
      expect.arrayContaining(["hr1", "nodes", "n1", "hr2", "study", "s1", "p1", "hr3", "app", "互動網站", "pa"]),
    )
    expect(textOnly()).toEqual(["ra", "verses", "hr1"])
    for (const keep of ["t", "top-nav", "ia", "foot"]) {
      expect(hidden()).not.toContain(keep)
      expect(textOnly()).not.toContain(keep)
    }
    expect(root.hasAttribute(TABS_ATTR)).toBe(true)
    expect(root.hasAttribute(MARKED_ATTR)).toBe(true)
  })

  it("沒有研讀區塊的章節頁不顯示分頁，也不把經文標為可隱藏", () => {
    document.body.innerHTML = VERSES_ONLY_HTML
    expect(applyMarks()).toBe(false)
    expect(hidden()).toEqual([])
    expect(textOnly()).toEqual([])
    expect(isPureAvailable()).toBe(false)
    expect(root.hasAttribute(TABS_ATTR)).toBe(false)
    expect(root.hasAttribute(MARKED_ATTR)).toBe(true)
  })

  it("非章節頁（條目頁）什麼都不標、不掛分頁列", () => {
    document.body.dataset.slug = "link_folder/主題/安息"
    initPureMode()
    expect(hidden()).toEqual([])
    expect(textOnly()).toEqual([])
    expect(document.querySelector(".bwz-tabs")).toBeNull()
    expect(isPureAvailable()).toBe(false)
  })
})

describe("分頁列掛載、記憶與事件同步", () => {
  it("掛載在頁首導覽表之後，點擊切換並存進 localStorage、發出 bwz:tab-change", () => {
    const events: TabChangeDetail[] = []
    const onTab = (e: Event) => events.push((e as CustomEvent<TabChangeDetail>).detail)
    document.addEventListener(TAB_CHANGE_EVENT, onTab)

    initPureMode()
    const bar = document.querySelector<HTMLElement>(".bwz-tabs")
    expect(bar).not.toBeNull()
    expect(document.getElementById("top-nav")?.nextElementSibling).toBe(bar)
    expect(events[events.length - 1]).toEqual({ view: "text", available: true })

    const studyBtn = bar!.querySelector<HTMLButtonElement>('[data-tab="study"]')!
    studyBtn.click()
    expect(root.getAttribute(VIEW_ATTR)).toBe("study")
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe("study")
    expect(sessionStorage.getItem(VIEW_STORAGE_KEY)).toBeNull()
    expect(studyBtn.getAttribute("aria-selected")).toBe("true")
    expect(events[events.length - 1]).toEqual({ view: "study", available: true })

    // 鍵盤左鍵切回經文
    studyBtn.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }))
    expect(root.getAttribute(VIEW_ATTR)).toBe("text")
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe("text")

    // 外部（手機快捷列）透過 bwz:tab-request 要求切換
    requestTabSwitch("study")
    expect(root.getAttribute(VIEW_ATTR)).toBe("study")
    expect(studyBtn.getAttribute("aria-selected")).toBe("true")

    // prepareForNav 只移除 data-ux-marked，保留 data-ux-tabs 以維持舊頁高度（供繼續閱讀記錄）
    prepareForNav()
    expect(root.hasAttribute(MARKED_ATTR)).toBe(false)
    expect(root.hasAttribute(TABS_ATTR)).toBe(true)

    // 即使 prescript 未能寫入 data-ux-view（例如 localStorage 被封鎖），initPureMode 仍補上預設 text
    root.removeAttribute(VIEW_ATTR)
    initPureMode()
    expect(root.getAttribute(VIEW_ATTR)).toBe("text")

    document.removeEventListener(TAB_CHANGE_EVENT, onTab)
  })
})

describe("經節小標籤跳轉（bwz:verse-jump）", () => {
  it("研讀分頁下觸發 bwz:verse-jump：切到經文分頁、單次捲動並以 bwz-vr-flash 標示", () => {
    setReadingView("study")
    initPureMode()
    const ev = new CustomEvent(VERSE_JUMP_EVENT, { cancelable: true, detail: { verse: 2 } })
    document.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(root.getAttribute(VIEW_ATTR)).toBe("text")
    expect(localStorage.getItem(VIEW_STORAGE_KEY)).toBe("text")
    expect(window.scrollTo).toHaveBeenCalledTimes(1)
    expect(document.getElementById("v2")?.classList.contains(FLASH_CLASS)).toBe(true)
  })
})

describe("revealTarget 與 REVEAL_EVENT（雙向暫時顯示）", () => {
  it("經文分頁：只暫時顯示目標所在的那一個研讀區塊，換分頁後恢復", () => {
    setReadingView("text")
    initPureMode()
    expect(requestReveal("s1")).toBe(true)
    expect(shown()).toEqual(expect.arrayContaining(["study", "s1", "p1"]))
    expect(shown()).not.toContain("nodes")
    expect(shown()).not.toContain("app")

    setReadingView("study")
    setReadingView("text")
    expect(shown()).toEqual([])
  })

  it("研讀分頁：收到指向經文節的 reveal 時暫時顯示經文清單，不改變偏好", () => {
    setReadingView("study")
    initPureMode()
    expect(requestReveal("v2")).toBe(true)
    expect(shown()).toContain("verses")
    expect(root.getAttribute(VIEW_ATTR)).toBe("study")
    expect(REVEAL_EVENT).toBe("bwz:reveal")
  })

  it("折疊腳本把 h2 換成 details 之後，仍正確標記並維持暫時顯示狀態", async () => {
    setReadingView("text")
    initPureMode()
    revealTarget("p1")

    const rootEl = document.querySelector(".markdown-preview-view")!
    const nodesH2 = document.getElementById("nodes")!
    const details = document.createElement("details")
    details.className = "collapsible-section"
    details.innerHTML = `<summary><span class="collapsible-title">本章知識節點</span></summary>`
    rootEl.insertBefore(details, nodesH2)
    nodesH2.remove()
    await Promise.resolve()
    await Promise.resolve()

    expect(details.classList.contains("bwz-ux-hide")).toBe(true)
    expect(details.classList.contains("bwz-ux-reveal")).toBe(false)
    expect(document.getElementById("study")?.classList.contains("bwz-ux-reveal")).toBe(true)
  })
})
