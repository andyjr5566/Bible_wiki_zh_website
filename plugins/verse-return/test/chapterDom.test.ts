// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  hiddenSectionElements,
  readChapterDom,
  studyHeadingIdOf,
  topLevelIndex,
  verseNumberOf,
} from "../../../quartz/util/chapterDom"
import { chapterDocument } from "./fixtures"

describe("readChapterDom", () => {
  it("章節頁認得出經文清單", () => {
    const dom = readChapterDom(chapterDocument())
    expect(dom?.verseList.tagName).toBe("OL")
    expect(dom?.verseListIndex).toBe(2)
  })

  it("不是章節頁（條目）一律不處理，即使有有序清單", () => {
    expect(readChapterDom(chapterDocument("知識節點/安息"))).toBeNull()
    expect(readChapterDom(chapterDocument(""))).toBeNull()
  })

  it("第一條分隔線之前沒有有序清單就是 null", () => {
    const doc = document.implementation.createHTMLDocument("x")
    doc.body.dataset.slug = "02-出埃及記/第12章"
    doc.body.innerHTML = "<article><h1>t</h1><hr><ol><li>x</li></ol></article>"
    expect(readChapterDom(doc)).toBeNull()
  })

  it("沒有 article 時是 null；經文清單是空的也是 null", () => {
    const doc = document.implementation.createHTMLDocument("x")
    doc.body.dataset.slug = "02-出埃及記/第12章"
    expect(readChapterDom(doc)).toBeNull()
    doc.body.innerHTML = "<article><ol></ol></article>"
    expect(readChapterDom(doc)).toBeNull()
  })
})

describe("verseNumberOf", () => {
  it("用 li 的順序加上 ol 的 start，不需要 id", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    expect(verseNumberOf(dom, doc.querySelector("#a a")!)).toBe(3)
    expect(verseNumberOf(dom, doc.querySelector("#b")!)).toBe(4)
    expect(verseNumberOf(dom, doc.querySelector("#c")!)).toBe(5)
  })
  it("經文清單以外回傳 null", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    expect(verseNumberOf(dom, doc.querySelector("#map")!)).toBeNull()
    expect(verseNumberOf(dom, doc.querySelector("#p1 a")!)).toBeNull()
  })
})

describe("studyHeadingIdOf", () => {
  it("回傳最近的上一個 h3；沒有 h3 就是本章整理標題", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    expect(studyHeadingIdOf(dom, doc.querySelector("#p1 a")!)).toBe("s1")
    expect(studyHeadingIdOf(dom, doc.querySelector("#p2 a")!)).toBe("s2")
    expect(studyHeadingIdOf(dom, doc.querySelector("#p0 a")!)).toBe("study")
  })
  it("不在本章整理裡（經文、知識節點、附錄）回傳 null", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    expect(studyHeadingIdOf(dom, doc.querySelector("#a a")!)).toBeNull()
    expect(studyHeadingIdOf(dom, doc.querySelector("#n1")!)).toBeNull()
    expect(studyHeadingIdOf(dom, doc.querySelector("#app")!)).toBeNull()
  })
  it("collapsible 把整理包成 details 後（標題沒有 id）回傳 null，不亂記", () => {
    const doc = document.implementation.createHTMLDocument("x")
    doc.body.dataset.slug = "02-出埃及記/第12章"
    doc.body.innerHTML = `<article><ol><li>a</li></ol><hr>
      <details class="collapsible-section"><summary><span class="collapsible-title">本章整理</span></summary><p id="q"><a href="/x">x</a></p></details></article>`
    const dom = readChapterDom(doc)!
    expect(studyHeadingIdOf(dom, doc.querySelector("#q a")!)).toBeNull()
  })
})

describe("topLevelIndex 與 hiddenSectionElements", () => {
  it("每個區塊分開，標題文字可用來在 collapsible 之後認出同一區塊", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    const sections = hiddenSectionElements(dom)
    expect(sections.map((s) => s.title)).toEqual(["本章知識節點", "本章整理", "附錄"])
    expect(sections[1].elements.map((e) => e.id).filter(Boolean)).toContain("s1")
    // 前後章表格（頁尾那一份）不被藏
    const hiddenTables = sections.flatMap((s) => s.elements).filter((e) => e.classList.contains("table-container"))
    expect(hiddenTables).toHaveLength(0)
  })

  it("topLevelIndex 找出元素在第一層的哪個子節點", () => {
    const doc = chapterDocument()
    const dom = readChapterDom(doc)!
    expect(topLevelIndex(dom, doc.querySelector("#p1 a")!)).toBe(dom.children.indexOf(doc.querySelector("#p1")!))
    expect(topLevelIndex(dom, doc.body)).toBe(-1)
  })

  it("details 形式的區塊用 summary 的標題文字", () => {
    const doc = document.implementation.createHTMLDocument("x")
    doc.body.dataset.slug = "02-出埃及記/第12章"
    doc.body.innerHTML = `<article><ol><li>a</li></ol><hr>
      <details class="collapsible-section"><summary><span class="collapsible-title">本章知識節點</span><span class="collapsible-badge">3 條目</span></summary><p>x</p></details></article>`
    const dom = readChapterDom(doc)!
    expect(hiddenSectionElements(dom).map((s) => s.title)).toEqual(["本章知識節點"])
  })
})
