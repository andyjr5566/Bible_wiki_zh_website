// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { REVEAL_EVENT, requestReveal } from "../../../quartz/util/revealEvent"
import { MARKED_ATTR, applyMarks, initPureMode, isPureAvailable, prepareForNav, revealTarget, setReadingView } from "../src/lib/pureMode"
import { VIEW_ATTR } from "../src/lib/readingView"

const HTML = `
<article><div class="markdown-preview-view">
  <h1 id="t">出埃及記 第12章</h1>
  <div class="table-container"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
  <ol><li>一</li><li>二</li></ol>
  <h2 id="map">相關地圖</h2><ul><li>地圖</li></ul>
  <hr id="hr1">
  <h2 id="nodes">本章知識節點</h2><h3 id="n1">神學</h3><ul><li>節點</li></ul>
  <hr id="hr2">
  <h2 id="study">本章整理</h2><h3 id="s1">一、安息</h3><p id="p1">整理</p>
  <hr id="hr3">
  <h2 id="app">附錄</h2><p id="pa">附錄內容</p>
  <div class="table-container" id="foot"><table><tr><td>前一章</td><td>下一章</td></tr></table></div>
</div></article>`

const root = document.documentElement
const hidden = () => Array.from(document.querySelectorAll(".bwz-ux-hide")).map((e) => e.id || e.tagName.toLowerCase())
const shown = () => Array.from(document.querySelectorAll(".bwz-ux-reveal")).map((e) => e.id || e.tagName.toLowerCase())

beforeEach(() => {
  document.body.dataset.slug = "02-出埃及記/第12章"
  document.body.innerHTML = HTML
  root.removeAttribute(VIEW_ATTR)
  root.removeAttribute(MARKED_ATTR)
  sessionStorage.clear()
})
afterEach(() => {
  setReadingView("study")
})

describe("applyMarks", () => {
  it("標出三個區塊與緊貼的分隔線，經文、相關地圖、前後章表格不標", () => {
    applyMarks()
    const marked = hidden()
    expect(marked).toEqual(expect.arrayContaining(["hr1", "nodes", "n1", "hr2", "study", "s1", "p1", "hr3", "app", "pa"]))
    for (const keep of ["t", "map", "foot"]) expect(marked).not.toContain(keep)
    expect(document.querySelector("ol")?.classList.contains("bwz-ux-hide")).toBe(false)
    expect(document.querySelectorAll(".table-container.bwz-ux-hide")).toHaveLength(0)
  })

  it("可重複呼叫，不會越標越多", () => {
    applyMarks()
    const first = hidden().length
    applyMarks()
    expect(hidden()).toHaveLength(first)
  })

  it("標好之後 <html> 才有 data-ux-marked；換頁前先拿掉", () => {
    applyMarks()
    expect(root.hasAttribute(MARKED_ATTR)).toBe(true)
    prepareForNav()
    expect(root.hasAttribute(MARKED_ATTR)).toBe(false)
  })

  it("認不出經文清單（條目頁）時什麼都不標，也不提供純經文", () => {
    document.body.dataset.slug = "知識節點/安息"
    applyMarks()
    expect(hidden()).toEqual([])
    expect(isPureAvailable()).toBe(false)
    expect(root.hasAttribute(MARKED_ATTR)).toBe(true)
  })

  it("章節頁認得出經文清單時提供純經文", () => {
    expect(isPureAvailable()).toBe(true)
  })
})

describe("setReadingView", () => {
  it("純經文：寫進 sessionStorage 並在 <html> 加屬性；研讀：拿掉屬性", () => {
    setReadingView("pure")
    expect(root.getAttribute(VIEW_ATTR)).toBe("pure")
    expect(sessionStorage.getItem("bwz-ux-view")).toBe("pure")
    expect(localStorage.getItem("bwz-ux-view")).toBeNull()
    setReadingView("study")
    expect(root.hasAttribute(VIEW_ATTR)).toBe(false)
    expect(sessionStorage.getItem("bwz-ux-view")).toBe("study")
  })
})

describe("revealTarget（暫時顯示）", () => {
  it("研讀模式不處理", () => {
    applyMarks()
    expect(revealTarget("p1")).toBe(false)
    expect(shown()).toEqual([])
  })

  it("純經文：只顯示目標所在的那一個區塊", () => {
    setReadingView("pure")
    expect(revealTarget("p1")).toBe(true)
    const on = shown()
    expect(on).toEqual(expect.arrayContaining(["study", "s1", "p1"]))
    expect(on).not.toContain("nodes")
    expect(on).not.toContain("app")
    expect(on).not.toContain("pa")
  })

  it("目標不在被藏的區塊（經文、相關地圖）或不存在：回傳 false、不顯示任何東西", () => {
    setReadingView("pure")
    expect(revealTarget("map")).toBe(false)
    expect(revealTarget("nope")).toBe(false)
    expect(revealTarget("")).toBe(false)
    expect(shown()).toEqual([])
  })

  it("切回研讀再切純經文，暫時顯示的區塊恢復隱藏", () => {
    setReadingView("pure")
    revealTarget("p1")
    setReadingView("study")
    setReadingView("pure")
    expect(shown()).toEqual([])
  })

  it("折疊腳本把 h2 換成 details 之後（元素換了），暫時顯示的區塊仍然顯示", async () => {
    setReadingView("pure")
    initPureMode()
    revealTarget("p1")
    // 模擬 collapsible：把「本章知識節點」h2 與它的內容換成 details
    const rootEl = document.querySelector(".markdown-preview-view")!
    const nodesH2 = document.getElementById("nodes")!
    const details = document.createElement("details")
    details.className = "collapsible-section"
    details.innerHTML = `<summary><span class="collapsible-title">本章知識節點</span></summary>`
    const content = document.createElement("div")
    content.append(document.getElementById("n1")!, document.querySelector("#n1 + ul") ?? "")
    details.append(content)
    rootEl.insertBefore(details, nodesH2)
    nodesH2.remove()
    await Promise.resolve()
    await Promise.resolve()
    expect(details.classList.contains("bwz-ux-hide")).toBe(true)
    expect(details.classList.contains("bwz-ux-reveal")).toBe(false)
    // 整理仍然顯示
    expect(document.getElementById("study")?.classList.contains("bwz-ux-reveal")).toBe(true)
  })
})

describe("REVEAL_EVENT（給 verse-return 用）", () => {
  it("要看的標題在被藏的區塊裡：顯示並回報已處理", () => {
    setReadingView("pure")
    initPureMode()
    expect(requestReveal("s1")).toBe(true)
    expect(shown()).toContain("s1")
  })

  it("研讀模式、或標題本來就看得到：不處理", () => {
    initPureMode()
    expect(requestReveal("s1")).toBe(false)
    setReadingView("pure")
    expect(requestReveal("map")).toBe(false)
    expect(REVEAL_EVENT).toBe("bwz:reveal")
  })
})
