// @vitest-environment jsdom
// 取出規則（lib/masthead.ts）與隱藏規則（styles/masthead.scss）必須一致：
// 取出成功時，CSS 恰好藏掉被取出的元素（h1；有引言才藏引言；緊接的 hr 才藏 hr）；取出失敗時，CSS 什麼都不藏。
// 這裡用 jsdom 對各種內容形狀實際跑 SCSS 裡的選擇器，並確認 SCSS 原文真的寫著這些選擇器（改一邊沒改另一邊就會失敗）。
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import type { Nodes, Root } from "hast"
import { MASTHEAD_ATTR, PATTERN_FULL, PATTERN_HEADING_RULE, extractMasthead, mastheadPattern } from "../src/lib/masthead"
import { el, h1, intro, nl, root, text } from "./hastFixtures"

const IN_ARTICLE = "> article > .markdown-rendered"
const scope = (condition: string) => `.center:has(.bwz-masthead[${MASTHEAD_ATTR}${condition}]) ${IN_ARTICLE}`
const HIDE_HEADING = `${scope("")} > h1:first-child`
const HIDE_INTRO = `${scope('~="blockquote"')} > h1:first-child + blockquote`
const HIDE_RULE_AFTER_HEADING = `${scope(`="${PATTERN_HEADING_RULE}"`)} > h1:first-child + hr`
const HIDE_RULE_AFTER_INTRO = `${scope(`="${PATTERN_FULL}"`)} > h1:first-child + blockquote + hr`
const ALL = [HIDE_HEADING, HIDE_INTRO, HIDE_RULE_AFTER_HEADING, HIDE_RULE_AFTER_INTRO]

// 不用 new URL：jsdom 環境下的 URL 類別和 node 的不同，readFileSync 不認
const scss = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/components/styles/masthead.scss"), "utf8")

function toDom(node: Nodes): Node {
  switch (node.type) {
    case "root": {
      const fragment = document.createDocumentFragment()
      node.children.forEach((child) => fragment.appendChild(toDom(child)))
      return fragment
    }
    case "element": {
      const element = document.createElement(node.tagName)
      node.children.forEach((child) => element.appendChild(toDom(child)))
      return element
    }
    case "comment":
      return document.createComment(node.value)
    default:
      return document.createTextNode("value" in node ? String(node.value) : "")
  }
}

// 照 ContentBody 與 HomeHub 的實際結構組頁面：有取出就在 page-header 放刊頭，內容樹原封不動放進文章
function buildPage(tree: Root): { page: HTMLElement; articleKids: Element[] } {
  const masthead = extractMasthead(tree)
  const page = document.createElement("div")
  page.className = "center"
  page.innerHTML = `<div class="page-header"><div class="popover-hint">${
    masthead ? `<div class="bwz-masthead" ${MASTHEAD_ATTR}="${mastheadPattern(masthead)}"></div>` : ""
  }</div></div><article class="popover-hint"><div class="markdown-preview-view markdown-rendered"></div></article>`
  page.querySelector(".markdown-rendered")!.appendChild(toDom(tree))
  document.body.replaceChildren(page)
  return { page, articleKids: Array.from(page.querySelector(".markdown-rendered")!.children) }
}

const hiddenBy = (page: HTMLElement, ...selectors: string[]) => Array.from(page.querySelectorAll(selectors.join(", ")))
const quote = () => intro()
const rule = () => el("hr", {})
const h2 = () => el("h2", { id: "b" }, text("書卷"))
const comment = (value: string) => ({ type: "comment" as const, value })

describe("masthead.scss 的隱藏規則與取出規則一致", () => {
  it("SCSS 原文有這四條選擇器（測試與樣式表綁在一起）", () => {
    const flat = scss.replace(/\s+/g, " ")
    for (const selector of ALL) expect(flat).toContain(selector)
  })

  const extracted: [string, Root][] = [
    ["只有 h1", root(h1(), nl, h2(), nl, quote())],
    ["h1 加 hr", root(h1(), nl, rule(), nl, h2())],
    ["h1 加引言", root(h1(), nl, quote(), nl, h2())],
    ["h1 加引言加 hr", root(h1(), nl, quote(), nl, rule(), nl, h2())],
    ["元素之間有空白與註解", root(nl, h1(), text("  "), comment("x"), quote(), comment("y"), nl, rule(), h2())],
    ["h1 加註解加 hr", root(h1(), comment("x"), rule())],
    ["引言後面隔了別的元素才有 hr", root(h1(), nl, quote(), nl, el("p", {}, text("說明")), rule())],
    ["h1 後面隔了別的元素才有引言與 hr", root(h1(), nl, el("p", {}, text("簡介")), nl, quote(), rule())],
    ["h1 與引言中間夾了一般文字", root(h1(), text("意外的字"), quote(), rule())],
    ["引言是空的", root(h1(), el("blockquote", {}, text(" ")), rule())],
  ]
  for (const [name, tree] of extracted) {
    it(`取出成功（${name}）：CSS 恰好藏掉被取出的元素`, () => {
      const masthead = extractMasthead(tree)
      expect(masthead).not.toBeNull()
      const { page, articleKids } = buildPage(tree)
      // 被取出的元素：第一個元素（h1）、有引言時的下一個、有 hr 時再下一個
      const expected = [articleKids[0]]
      if (masthead!.hasIntro) expected.push(articleKids[expected.length])
      if (masthead!.hasRule) {
        expected.push(articleKids[expected.length])
        expect(expected[expected.length - 1].tagName).toBe("HR")
      }
      expect(hiddenBy(page, ...ALL)).toEqual(expected)
    })
  }

  const notExtracted: [string, Root][] = [
    // CSS 的鄰接選擇器會符合（它不看文字），但沒有刊頭的 data 屬性，所以不能藏任何東西
    ["第一個不是 h1（前面有別的元素）", root(el("div", {}, text("前言")), h1(), quote(), rule())],
    ["第一個是引言", root(quote(), nl, rule(), h2())],
    ["第一個是一般文字", root(text("開頭的字"), h1(), quote(), rule())],
    ["第一個是 h2", root(h2(), h1(), quote())],
    ["h1 是空的", root(el("h1", {}), quote(), rule())],
  ]
  for (const [name, tree] of notExtracted) {
    it(`取出失敗（${name}）：沒有刊頭，CSS 什麼都不藏`, () => {
      expect(extractMasthead(tree)).toBeNull()
      const { page } = buildPage(tree)
      expect(page.querySelector(".bwz-masthead")).toBeNull()
      expect(hiddenBy(page, ...ALL)).toEqual([])
    })
  }
})
