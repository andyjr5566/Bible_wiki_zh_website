import { describe, expect, it } from "vitest"
import {
  POPOVER_SOURCE_TTL_MS,
  isInternalPageLink,
  isPlainLeftClick,
  popoverSourceValid,
} from "../src/lib/linkRules"

const PAGE = "https://example.com/Bible_wiki_zh_website/01-創世記/第2章"
const click = { button: 0, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false }

describe("isPlainLeftClick", () => {
  it("只認沒按修飾鍵的左鍵", () => {
    expect(isPlainLeftClick(click)).toBe(true)
    expect(isPlainLeftClick({ ...click, button: 1 })).toBe(false)
    expect(isPlainLeftClick({ ...click, ctrlKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...click, metaKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...click, shiftKey: true })).toBe(false)
    expect(isPlainLeftClick({ ...click, altKey: true })).toBe(false)
  })
})

describe("isInternalPageLink", () => {
  it("同網站的另一頁算", () => {
    expect(isInternalPageLink({ href: "https://example.com/Bible_wiki_zh_website/安息" }, PAGE)).toBe(true)
    expect(isInternalPageLink({ href: "https://example.com/Bible_wiki_zh_website/安息#定義" }, PAGE)).toBe(true)
  })
  it("同頁錨點（含只有 hash 的連結）不算", () => {
    expect(isInternalPageLink({ href: PAGE + "#v6" }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: PAGE }, PAGE)).toBe(false)
  })
  it("外部連結與其他協定不算", () => {
    expect(isInternalPageLink({ href: "https://other.example/x" }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: "mailto:a@b.c" }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: "javascript:void(0)" }, PAGE)).toBe(false)
  })
  it("另開分頁與下載不算；target=_self 算", () => {
    expect(isInternalPageLink({ href: "https://example.com/a", target: "_blank" }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: "https://example.com/a", download: true }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: "https://example.com/a", target: "_self" }, PAGE)).toBe(true)
    expect(isInternalPageLink({ href: "https://example.com/a", target: "" }, PAGE)).toBe(true)
  })
  it("網址壞掉時不丟錯", () => {
    expect(isInternalPageLink({ href: "" }, PAGE)).toBe(false)
    expect(isInternalPageLink({ href: "https://example.com/a" }, "not a url")).toBe(false)
  })
})

describe("popoverSourceValid", () => {
  const source = { point: "x", t: 1000 }
  it("時限內有效，過期或沒有來源就作廢", () => {
    expect(popoverSourceValid(source, 1000)).toBe(true)
    expect(popoverSourceValid(source, 1000 + POPOVER_SOURCE_TTL_MS)).toBe(true)
    expect(popoverSourceValid(source, 1001 + POPOVER_SOURCE_TTL_MS)).toBe(false)
    expect(popoverSourceValid(null, 1000)).toBe(false)
    expect(popoverSourceValid(undefined, 1000)).toBe(false)
  })
  it("時鐘倒退（來源比現在還新）也作廢", () => {
    expect(popoverSourceValid(source, 500)).toBe(false)
  })
})
