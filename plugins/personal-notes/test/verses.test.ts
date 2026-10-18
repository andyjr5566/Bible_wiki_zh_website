import { describe, expect, it } from "vitest"
import { locateQuote, textHash, selectionToVerses } from "../src/client/ui/verses"

describe("畫重點：在經文裡找回位置（C3）", () => {
  const text = "神說：要有光，就有了光。神看光是好的。"

  it("只出現一次：直接找到", () => {
    expect(locateQuote(text, { exact: "神看光是好的", prefix: "光。", suffix: "。" })).toEqual([12, 18])
  })

  it("出現多次：用前後文挑對的那一個", () => {
    // 「光」出現三次；前文「就有了」→ 第二個
    expect(locateQuote(text, { exact: "光", prefix: "就有了", suffix: "。神看" })).toEqual([10, 11])
    expect(locateQuote(text, { exact: "光", prefix: "要有", suffix: "，就有" })).toEqual([5, 6])
  })

  it("經文改過、找不到原文：回傳 null", () => {
    expect(locateQuote(text, { exact: "要有空氣", prefix: "", suffix: "" })).toBeNull()
    expect(locateQuote(text, { exact: "", prefix: "", suffix: "" })).toBeNull()
  })

  it("雜湊：相同文字相同、不同文字不同", () => {
    expect(textHash(text)).toBe(textHash(text))
    expect(textHash(text)).not.toBe(textHash(text + "。"))
    expect(textHash("")).toMatch(/^[0-9a-f]{8}$/)
  })
})

it("便條 UI 裡的選取不算經文（起點或終點任一在 UI 內）", () => {
  // 此專案沒有 DOM 測試套件；用選取介面替身驗證提前拒絕 UI 的分支。
  const ui = { nodeType: 1, closest: (selector: string) => selector === ".bwz-v-ui" ? {} : null }
  const text = { nodeType: 3, parentElement: ui }
  const verse = { nodeType: 1, closest: () => null }
  for (const [startContainer, endContainer] of [[text, text], [verse, text], [text, verse]]) {
    const selection = { rangeCount: 1, isCollapsed: false, getRangeAt: () => ({ startContainer, endContainer }) } as unknown as Selection
    expect(selectionToVerses(selection, {} as HTMLElement)).toBeNull()
  }
})
