import { describe, expect, it } from "vitest"
import { formatQuote, isQuotable, MAX_QUOTE_CHARS, normalizeQuoteText, pickSource } from "../src/client/features/quotes/quote"
import { parseMarkdown } from "../src/client/ui/markdown"
import { insertAtCaret } from "../src/client/ui/textInsert"

const page = { slug: "01-創世記/第1章", pageLabel: "創世記 1" }

describe("引用到筆記：引文格式", () => {
  it("單行加出處與結尾空行", () => {
    const q = formatQuote("起初神創造天地。", { ...page, headings: [{ text: "本章整理", id: "本章整理" }] })!
    expect(q.markdown).toBe("> 起初神創造天地。\n> —— [[01-創世記/第1章#本章整理|創世記 1 · 本章整理]]\n\n")
    expect(q.truncated).toBe(false)
  })

  it("多行時每一行都加 >，空行變成單獨的 >", () => {
    const q = formatQuote("第一行\n第二行\n\n\n\n第三行  \n", { ...page, headings: [] })!
    expect(q.markdown).toBe("> 第一行\n> 第二行\n>\n> 第三行\n> —— [[01-創世記/第1章|創世記 1]]\n\n")
  })

  it("沒有小標題：只連到頁面", () => {
    const q = formatQuote("文字", { slug: "link_folder/人物/寧錄", pageLabel: "寧錄", headings: [] })!
    expect(q.markdown).toContain("> —— [[link_folder/人物/寧錄|寧錄]]")
  })

  it("用最近的小標題；顯示文字清掉會破壞連結的字元", () => {
    const q = formatQuote("x", { ...page, headings: [{ text: "A", id: "a" }, { text: "本章 [知識] | 節點", id: "b" }] })!
    expect(q.markdown).toContain("[[01-創世記/第1章#b|創世記 1 · 本章 知識 節點]]")
  })

  it("最近的標題沒有 id（可收合區塊）：標題文字用最近的、連結用前面最近有 id 的，都沒有就只連頁面", () => {
    const q = formatQuote("x", { ...page, headings: [{ text: "本章整理", id: "本章整理" }, { text: "本章知識節點", id: null }] })!
    expect(q.markdown).toContain("[[01-創世記/第1章#本章整理|創世記 1 · 本章知識節點]]")
    const none = formatQuote("x", { ...page, headings: [{ text: "來源依據", id: null }] })!
    expect(none.markdown).toContain("[[01-創世記/第1章|創世記 1 · 來源依據]]")
    expect(pickSource([{ text: "", id: "x" }])).toBeNull()
  })

  it("超過 1000 字只取前 1000 字並標記 truncated", () => {
    const q = formatQuote("字".repeat(1500), { ...page, headings: [] })!
    expect(q.truncated).toBe(true)
    expect(q.markdown.split("\n")[0]).toBe(`> ${"字".repeat(MAX_QUOTE_CHARS)}`)
    expect(normalizeQuoteText("字".repeat(MAX_QUOTE_CHARS)).truncated).toBe(false)
  })

  it("以字元計算，不把代理對切成兩半", () => {
    const { text, truncated } = normalizeQuoteText("𠀀".repeat(1001))
    expect(truncated).toBe(true)
    expect(Array.from(text)).toHaveLength(MAX_QUOTE_CHARS)
  })

  it("空白選取回傳 null", () => {
    expect(formatQuote(" \n\t ", { ...page, headings: [] })).toBeNull()
  })

  it("產生的出處能被 Markdown 解析成 [[連結]]，目標帶小標題", () => {
    const q = formatQuote("經文註釋", { ...page, headings: [{ text: "本章整理", id: "本章整理" }] })!
    const blocks = parseMarkdown(q.markdown)
    expect(blocks).toHaveLength(1)
    expect(JSON.stringify(blocks[0])).toContain('"t":"wiki","target":"01-創世記/第1章#本章整理","label":"創世記 1 · 本章整理"')
  })
})

describe("引用到筆記：能不能引用", () => {
  const ok = { empty: false, inArticle: true, inOwnUi: false, touchesVerses: false }
  it("內文選字可以", () => expect(isQuotable(ok)).toBe(true))
  it("空選取、article 之外、我們的畫面、碰到經文清單都不行", () => {
    expect(isQuotable({ ...ok, empty: true })).toBe(false)
    expect(isQuotable({ ...ok, inArticle: false })).toBe(false)
    expect(isQuotable({ ...ok, inOwnUi: true })).toBe(false)
    expect(isQuotable({ ...ok, touchesVerses: true })).toBe(false)
  })
})

describe("在游標位置插入", () => {
  const q = "> a\n> —— [[s|l]]\n\n"
  it("空內容直接放", () => {
    expect(insertAtCaret("", 0, q)).toEqual({ value: q, caret: q.length })
  })
  it("前面有字：補成空行再接", () => {
    expect(insertAtCaret("想法", null, q).value).toBe(`想法\n\n${q}`)
    expect(insertAtCaret("想法\n", 3, q).value).toBe(`想法\n\n${q}`)
    expect(insertAtCaret("想法\n\n", 4, q).value).toBe(`想法\n\n${q}`)
  })
  it("游標在中間：後面的字另起一段，游標停在引文下方的空行", () => {
    const r = insertAtCaret("前面後面", 2, q)
    expect(r.value).toBe(`前面\n\n${q}\n\n後面`)
    expect(r.value.slice(r.caret)).toBe("\n\n後面")
  })
  it("游標超出範圍會被夾住；連續插入兩段", () => {
    const first = insertAtCaret("", 99, q)
    const second = insertAtCaret(first.value, first.caret, q)
    expect(second.value).toBe(q + q)
  })
})
