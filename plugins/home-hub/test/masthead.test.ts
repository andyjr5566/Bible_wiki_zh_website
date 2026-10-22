import { describe, expect, it } from "vitest"
import type { Element } from "hast"
import { PATTERN_FULL, PATTERN_HEADING_RULE, extractMasthead, mastheadPattern } from "../src/lib/masthead"
import { el, h1, intro, nl, root, text } from "./hastFixtures"

const tags = (nodes: Element[]) => nodes.map((n) => n.tagName)
const h2 = () => el("h2", { id: "x" }, text("書卷"))
const hr = () => el("hr", {})
const comment = { type: "comment" as const, value: "x" }

describe("extractMasthead：取出規則", () => {
  it("h1 單獨：只取出 h1（後面是別的元素）", () => {
    const result = extractMasthead(root(h1(), nl, h2(), nl, el("p", {}, text("x"))))!
    expect(tags(result.nodes)).toEqual(["h1"])
    expect(result.hasIntro).toBe(false)
    expect(result.hasRule).toBe(false)
    expect(extractMasthead(root(h1()))!.nodes).toHaveLength(1)
  })

  it("h1 加引言：取出兩個，沒有 hr 時 hasRule 是 false", () => {
    const result = extractMasthead(root(h1(), nl, intro(), nl, h2()))!
    expect(tags(result.nodes)).toEqual(["h1", "blockquote"])
    expect(result.hasIntro).toBe(true)
    expect(result.hasRule).toBe(false)
  })

  it("h1 加引言加 hr：hasRule 是 true（空白文字與註解不算隔開）", () => {
    expect(extractMasthead(root(h1(), nl, intro(), nl, hr(), nl, h2()))!.hasRule).toBe(true)
    expect(extractMasthead(root(h1(), nl, intro(), nl, comment, nl, hr()))!.hasRule).toBe(true)
  })

  it("h1 後面直接接 hr（沒有引言）：只取出 h1，hr 也記下來", () => {
    const result = extractMasthead(root(h1(), nl, hr(), nl, h2()))!
    expect(tags(result.nodes)).toEqual(["h1"])
    expect(result.hasIntro).toBe(false)
    expect(result.hasRule).toBe(true)
  })

  it("引言後面是別的元素，之後才有 hr：不算緊接，hasRule 是 false", () => {
    const tree = root(h1(), nl, intro(), nl, el("p", {}, text("說明")), nl, hr())
    expect(extractMasthead(tree)!.hasRule).toBe(false)
  })

  it("h1 後面隔了別的元素才有引言或 hr：只取出 h1", () => {
    for (const tree of [root(h1(), nl, el("p", {}, text("簡介")), nl, intro(), hr()), root(h1(), nl, el("p", {}, text("簡介")), hr())]) {
      const result = extractMasthead(tree)!
      expect(tags(result.nodes)).toEqual(["h1"])
      expect(result.hasIntro).toBe(false)
      expect(result.hasRule).toBe(false)
    }
  })

  it("h1 與引言之間只有空白或註解時照樣取出（前面有空白文字也沒關係）", () => {
    const tree = root(text("\n\n"), h1(), text("  "), comment, intro(), hr())
    const result = extractMasthead(tree)!
    expect(tags(result.nodes)).toEqual(["h1", "blockquote"])
    expect(result.hasRule).toBe(true)
  })

  it("h1 和引言中間有一般文字：引言不算緊接，只取出 h1", () => {
    const result = extractMasthead(root(h1(), text("意外的字"), intro()))!
    expect(tags(result.nodes)).toEqual(["h1"])
    expect(result.hasIntro).toBe(false)
  })

  it("引言是空的：不取出引言，h1 照常取出", () => {
    const result = extractMasthead(root(h1(), el("blockquote", {}, text("\n")), hr()))!
    expect(tags(result.nodes)).toEqual(["h1"])
    expect(result.hasRule).toBe(false)
  })

  it("第一個不是 h1：不取出", () => {
    expect(extractMasthead(root(intro(), nl, h2()))).toBeNull()
    expect(extractMasthead(root(el("p", {}, text("開頭是段落")), h1(), intro()))).toBeNull()
    expect(extractMasthead(root(el("h2", {}, text("二級標題")), intro()))).toBeNull()
    expect(extractMasthead(root(el("div", {}, text("前言")), h1(), intro()))).toBeNull()
    expect(extractMasthead(root(text("開頭是一般文字"), h1()))).toBeNull()
    expect(extractMasthead(root(hr(), h1()))).toBeNull()
    expect(extractMasthead(root(intro(), h1()))).toBeNull()
  })

  it("空的樹、不是 root、null：不取出，也不丟例外", () => {
    expect(extractMasthead(root())).toBeNull()
    expect(extractMasthead(null)).toBeNull()
    expect(extractMasthead(undefined)).toBeNull()
    expect(extractMasthead(h1())).toBeNull()
    expect(extractMasthead({ type: "root" })).toBeNull()
    expect(extractMasthead({ type: "root", children: "不是陣列" })).toBeNull()
    expect(extractMasthead("文字")).toBeNull()
  })

  it("h1 是空的：不取出（空標題會被螢幕閱讀器念成空白）", () => {
    const emptyH1 = el("h1", { id: "x" }, el("a", { role: "anchor", href: "#x" }, el("svg", {})))
    expect(extractMasthead(root(emptyH1, intro()))).toBeNull()
    expect(extractMasthead(root(emptyH1))).toBeNull()
  })

  it("標題只有一張圖也算有內容", () => {
    const imgH1 = el("h1", {}, el("img", { src: "logo.png", alt: "標誌" }))
    expect(extractMasthead(root(imgH1, intro()))).not.toBeNull()
  })
})

describe("extractMasthead：複本", () => {
  it("h1 保留 id（目錄與 #標題 要捲到刊頭）與錨點連結；引言裡的 id 全部拿掉，文字與其他屬性保留", () => {
    const link = el("a", { href: "./教學/快速入門", className: ["internal"], dataSlug: "教學/快速入門" }, text("快速入門"))
    const quote = el("blockquote", { id: "q" }, el("p", { id: "p1" }, text("先看"), link))
    const source = h1()
    const result = extractMasthead(root(source, quote))!
    const [heading, body] = result.nodes
    expect(heading.properties).toEqual({ id: "聖經研讀知識庫" })
    expect(heading.children).toEqual(source.children)
    expect(body.properties).toEqual({})
    const paragraph = body.children[0] as Element
    expect(paragraph.properties).toEqual({})
    expect(paragraph.children[1]).toEqual(link)
  })

  it("h1 沒有 id 時複本也沒有（不會憑空產生 id）", () => {
    const result = extractMasthead(root(el("h1", {}, text("標題")), intro()))!
    expect(result.nodes[0].properties).toEqual({})
  })

  it("不動到原本的內容樹（文章裡的原件還要照常渲染）", () => {
    const tree = root(h1(), nl, intro(), nl, hr())
    const before = structuredClone(tree)
    extractMasthead(tree)
    expect(tree).toEqual(before)
  })

  it("複本是新物件，改複本不會影響原樹", () => {
    const tree = root(h1(), intro())
    const result = extractMasthead(tree)!
    result.nodes[0].children.push(text("改過"))
    expect((tree.children[0] as Element).children).toHaveLength(2)
  })
})

describe("mastheadPattern", () => {
  const nodes: Element[] = []
  it("四種形狀對應 data-bwz-masthead 的值，SCSS 的隱藏規則依這些字串", () => {
    expect(mastheadPattern({ nodes, hasIntro: false, hasRule: false })).toBe("h1")
    expect(mastheadPattern({ nodes, hasIntro: false, hasRule: true })).toBe(PATTERN_HEADING_RULE)
    expect(mastheadPattern({ nodes, hasIntro: true, hasRule: false })).toBe("h1 blockquote")
    expect(mastheadPattern({ nodes, hasIntro: true, hasRule: true })).toBe(PATTERN_FULL)
    expect(PATTERN_HEADING_RULE).toBe("h1 hr")
    expect(PATTERN_FULL).toBe("h1 blockquote hr")
  })
})
