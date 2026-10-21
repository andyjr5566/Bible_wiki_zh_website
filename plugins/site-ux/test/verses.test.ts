// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { VERSE_LIST_CLASS, findVerseListElement, markVerseList } from "../src/lib/verses"

function makeDocument(markup: string): Document {
  const doc = document.implementation.createHTMLDocument("測試")
  doc.body.innerHTML = markup
  return doc
}

describe("findVerseListElement", () => {
  it("第一條分隔線之前的第一個有序清單就是經文清單", () => {
    const doc = makeDocument(`
      <article>
        <p>前言</p>
        <ol id="v"><li><a href="#">神</a></li><li>第二節</li></ol>
        <hr>
        <ol id="after"><li><a href="#">本章整理的清單</a></li></ol>
      </article>`)
    expect(findVerseListElement(doc)?.id).toBe("v")
  })

  it("有序清單在第一條分隔線之後時沒有經文清單", () => {
    const doc = makeDocument(`<article><hr><ol><li>x</li></ol></article>`)
    expect(findVerseListElement(doc)).toBeNull()
  })

  it("只看內文根節點的直接子節點，巢狀在其他元素裡的清單不算", () => {
    const doc = makeDocument(`<article><div><ol><li>x</li></ol></div></article>`)
    expect(findVerseListElement(doc)).toBeNull()
  })

  it("有 .markdown-preview-view 時以它為內文根節點", () => {
    const doc = makeDocument(`
      <article><nav><ol><li>導覽</li></ol></nav>
      <div class="markdown-preview-view"><ol id="v"><li>經文</li></ol></div></article>`)
    expect(findVerseListElement(doc)?.id).toBe("v")
  })

  it("空清單、超過 200 個 li、沒有 article 都回傳 null", () => {
    expect(findVerseListElement(makeDocument(`<article><ol></ol></article>`))).toBeNull()
    const many = "<li>x</li>".repeat(201)
    expect(findVerseListElement(makeDocument(`<article><ol>${many}</ol></article>`))).toBeNull()
    const ok = "<li>x</li>".repeat(200)
    expect(findVerseListElement(makeDocument(`<article><ol>${ok}</ol></article>`))).not.toBeNull()
    expect(findVerseListElement(makeDocument(`<div><ol><li>x</li></ol></div>`))).toBeNull()
  })
})

describe("markVerseList", () => {
  it("只標記經文清單，不碰其他清單與連結", () => {
    const doc = makeDocument(`
      <article>
        <ol id="v"><li><a href="#">神</a></li></ol>
        <hr>
        <ol id="other"><li><a href="#">整理</a></li></ol>
      </article>`)
    const list = markVerseList(doc)
    expect(list?.id).toBe("v")
    expect(doc.querySelector("#v")?.classList.contains(VERSE_LIST_CLASS)).toBe(true)
    expect(doc.querySelector("#other")?.classList.contains(VERSE_LIST_CLASS)).toBe(false)
  })

  it("清掉舊頁面殘留的標記；沒有經文清單時什麼都不標", () => {
    const doc = makeDocument(`<article><p>x</p><ol id="stale" class="${VERSE_LIST_CLASS}"><li>x</li></ol></article>`)
    // 這一頁的經文清單在分隔線之後 → 沒有經文清單
    doc.querySelector("article")!.insertBefore(doc.createElement("hr"), doc.querySelector("#stale"))
    expect(markVerseList(doc)).toBeNull()
    expect(doc.querySelector(`.${VERSE_LIST_CLASS}`)).toBeNull()
  })
})
