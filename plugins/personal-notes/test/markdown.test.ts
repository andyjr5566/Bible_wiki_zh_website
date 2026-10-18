import { describe, expect, it } from "vitest"
import { parseInline, parseMarkdown } from "../src/client/ui/markdown"
import { buildLinkIndex } from "../src/client/model/linkIndex"
import { createResolver } from "../src/client/features/notes/links"

describe("筆記 Markdown（D-37）", () => {
  it("段落、換行、粗體、斜體、行內程式碼", () => {
    expect(parseMarkdown("第一行\n**重點**與*強調*、`code`\n\n第二段")).toEqual([
      { t: "p", c: [{ t: "text", v: "第一行" }, { t: "br" }, { t: "b", c: [{ t: "text", v: "重點" }] }, { t: "text", v: "與" }, { t: "i", c: [{ t: "text", v: "強調" }] }, { t: "text", v: "、" }, { t: "code", v: "code" }] },
      { t: "p", c: [{ t: "text", v: "第二段" }] },
    ])
  })

  it("標題、清單、引用、分隔線、程式碼區塊", () => {
    const b = parseMarkdown("## 觀察\n- 一\n- 二\n1. 甲\n2. 乙\n> 引用\n---\n```\n<script>x</script>\n```")
    expect(b.map((x) => x.t)).toEqual(["h", "ul", "ol", "quote", "hr", "code"])
    expect(b[1]).toEqual({ t: "ul", items: [[{ t: "text", v: "一" }], [{ t: "text", v: "二" }]] })
    expect(b[5]).toEqual({ t: "code", v: "<script>x</script>" })
  })

  it("[[條目]]、[[條目|顯示名稱]]、[[條目#段落]]", () => {
    expect(parseInline("見[[寧錄]]和[[link_folder/人物/亞伯拉罕|亞伯拉罕]]、[[摩西#生平]]")).toEqual([
      { t: "text", v: "見" },
      { t: "wiki", target: "寧錄", label: "寧錄" },
      { t: "text", v: "和" },
      { t: "wiki", target: "link_folder/人物/亞伯拉罕", label: "亞伯拉罕" },
      { t: "text", v: "、" },
      { t: "wiki", target: "摩西#生平", label: "摩西" },
    ])
  })

  it("連結只接受 http(s)；javascript: 之類保持純文字", () => {
    expect(parseInline("[官網](https://example.com/a)")).toEqual([{ t: "link", href: "https://example.com/a", c: [{ t: "text", v: "官網" }] }])
    expect(parseInline("[x](javascript:alert(1))")).toEqual([{ t: "text", v: "[x](javascript:alert(1))" }])
    expect(parseInline("網址 https://biblehub.com/gen/1.htm。")).toEqual([
      { t: "text", v: "網址 " },
      { t: "link", href: "https://biblehub.com/gen/1.htm", c: [{ t: "text", v: "https://biblehub.com/gen/1.htm" }] },
      { t: "text", v: "。" },
    ])
  })

  it("HTML 標籤保持原樣文字（不會被當成 HTML）", () => {
    expect(parseMarkdown("<img src=x onerror=alert(1)>")).toEqual([{ t: "p", c: [{ t: "text", v: "<img src=x onerror=alert(1)>" }] }])
  })
})

describe("連結索引（C6）", () => {
  const index = buildLinkIndex([
    { slug: "index" },
    { slug: "tags/人物" },
    { slug: "link_folder/人物/寧錄", aliases: ["Nimrod", "英勇的獵戶"] },
    { slug: "link_folder/人物/亞伯拉罕", title: "亞伯拉罕", aliases: "亞伯蘭" },
    { slug: "link_folder/地點/示拿地" },
  ])

  it("略過首頁與標籤頁；檔名與別名都可以當連結名稱", () => {
    expect(index.pages.map((p) => p.s)).toEqual(["link_folder/人物/寧錄", "link_folder/人物/亞伯拉罕", "link_folder/地點/示拿地"])
    expect(index.pages[0]).toEqual({ s: "link_folder/人物/寧錄", t: "寧錄", a: ["Nimrod", "英勇的獵戶"] })
  })

  it("依標題、別名、完整路徑、大小寫不同都能對到", () => {
    const r = createResolver(index)
    expect(r.resolve("寧錄")).toBe("link_folder/人物/寧錄")
    expect(r.resolve("nimrod")).toBe("link_folder/人物/寧錄")
    expect(r.resolve("亞伯蘭")).toBe("link_folder/人物/亞伯拉罕")
    expect(r.resolve("link_folder/地點/示拿地")).toBe("link_folder/地點/示拿地")
    expect(r.resolve("亞伯拉罕#生平")).toBe("link_folder/人物/亞伯拉罕")
    expect(r.resolve("不存在的條目")).toBeNull()
  })

  it("自動完成：開頭相符的排前面", () => {
    const r = createResolver(index)
    expect(r.search("亞伯").map((p) => p.t)).toEqual(["亞伯拉罕"])
    expect(r.search("地").map((p) => p.t)).toEqual(["示拿地"])
  })
})
