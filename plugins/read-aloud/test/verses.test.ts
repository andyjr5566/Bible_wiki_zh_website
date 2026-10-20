// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { findScriptureVerses, verseText } from "../src/lib/verses"

function makeDocument(markup: string): Document {
  const doc = document.implementation.createHTMLDocument("經文測試")
  doc.body.innerHTML = markup
  return doc
}

describe("經文擷取", () => {
  it("只取導覽表之後、第一條分隔線之前的第一個有序清單", () => {
    const doc = makeDocument(`
      <article>
        <nav><ol><li>導覽項目</li></ol></nav>
        <ol><li>第一節</li><li>第二節</li></ol>
        <hr>
        <ol><li>分隔線之後</li></ol>
      </article>
    `)

    expect(findScriptureVerses(doc)?.map((verse) => verse.text)).toEqual([
      "第一節",
      "第二節",
    ])
  })

  it("有序清單在第一條分隔線之後時回傳空值", () => {
    const doc = makeDocument(`
      <article><hr><ol><li>經文</li></ol></article>
    `)

    expect(findScriptureVerses(doc)).toBeNull()
  })

  it("沒有有序清單時回傳空值", () => {
    const doc = makeDocument("<article><p>沒有經文清單</p></article>")

    expect(findScriptureVerses(doc)).toBeNull()
  })

  it("沒有直接經節時回傳空值", () => {
    const doc = makeDocument("<article><ol></ol></article>")

    expect(findScriptureVerses(doc)).toBeNull()
  })

  it("直接經節超過兩百節時回傳空值", () => {
    const items = Array.from(
      { length: 201 },
      (_, index) => `<li>第${index + 1}節</li>`,
    ).join("")
    const doc = makeDocument(`<article><ol>${items}</ol></article>`)

    expect(findScriptureVerses(doc)).toBeNull()
  })

  it("節數從有序清單的起始節數開始", () => {
    const doc = makeDocument(`
      <article><ol start="5"><li>第五節</li><li>第六節</li></ol></article>
    `)

    expect(findScriptureVerses(doc)?.map((verse) => verse.number)).toEqual([
      5, 6,
    ])
  })

  it("保留連結中的經文文字", () => {
    const doc = makeDocument(`
      <article><ol><li>起初 <a href="/神">神</a>創造</li></ol></article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("起初 神創造")
  })

  it("保留畫重點標記中的經文文字", () => {
    const doc = makeDocument(`
      <article><ol><li>起初 <mark>神創造</mark>天地</li></ol></article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("起初 神創造天地")
  })

  it("略過個人筆記介面中的文字", () => {
    const doc = makeDocument(`
      <article>
        <ol><li>經文<span class="bwz-v-ui">📝私人筆記</span>內容</li></ol>
      </article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("經文內容")
  })

  it("略過 aria-hidden 元素中的文字", () => {
    const doc = makeDocument(`
      <article><ol><li>經文<span aria-hidden="true">🔖</span>內容</li></ol></article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("經文內容")
  })

  it("略過隱藏、指令碼與樣式元素中的文字", () => {
    const doc = makeDocument(`
      <article>
        <ol>
          <li>可見
            <span hidden>隱藏文字</span>
            <script>指令碼文字</script>
            <style>樣式文字</style>
            經文
          </li>
        </ol>
      </article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("可見 經文")
  })

  it("把連續空白與換行整理成單一空白", () => {
    const doc = makeDocument(`
      <article>
        <ol><li>  起初 <span>  神創造
          天地</span>  </li></ol>
      </article>
    `)

    expect(findScriptureVerses(doc)?.[0].text).toBe("起初 神創造 天地")
    expect(verseText(doc.querySelector("li") as HTMLLIElement)).toBe(
      "起初 神創造 天地",
    )
  })

  it("有預覽容器時只從直接子預覽容器擷取", () => {
    const doc = makeDocument(`
      <article>
        <ol><li>文章外層清單</li></ol>
        <div class="markdown-preview-view">
          <ol><li>預覽容器經文</li></ol>
        </div>
      </article>
    `)

    expect(findScriptureVerses(doc)?.map((verse) => verse.text)).toEqual([
      "預覽容器經文",
    ])
  })

  it("沒有預覽容器時直接從文章擷取", () => {
    const doc = makeDocument(`
      <article><ol><li>文章經文</li></ol></article>
    `)

    expect(findScriptureVerses(doc)?.map((verse) => verse.text)).toEqual([
      "文章經文",
    ])
  })

  it("巢狀有序清單中的項目不另算一節", () => {
    const doc = makeDocument(`
      <article>
        <ol>
          <li>第一節<ol><li>巢狀文字</li></ol></li>
          <li>第二節</li>
        </ol>
      </article>
    `)
    const verses = findScriptureVerses(doc)

    expect(verses?.map((verse) => verse.number)).toEqual([1, 2])
    expect(verses?.map((verse) => verse.text)).toEqual([
      "第一節巢狀文字",
      "第二節",
    ])
  })

  it("擷取經文時不修改原有清單或經節", () => {
    const doc = makeDocument(`
      <article><ol><li>經文</li></ol></article>
    `)
    const list = doc.querySelector("ol")
    const item = doc.querySelector("li")

    findScriptureVerses(doc)

    expect(list?.classList.contains("bwz-verses")).toBe(false)
    expect(item?.hasAttribute("data-v")).toBe(false)
    expect(item?.hasAttribute("id")).toBe(false)
  })
})
