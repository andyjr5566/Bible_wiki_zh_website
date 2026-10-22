import type { Element, ElementContent, Root, RootContent, Text } from "hast"

// 小工具：組 hast 節點，寫起來像 HTML
export const text = (value: string): Text => ({ type: "text", value })
export const el = (tagName: string, properties: Element["properties"], ...children: ElementContent[]): Element => ({
  type: "element",
  tagName,
  properties,
  children,
})
export const root = (...children: RootContent[]): Root => ({ type: "root", children })

// Quartz 實際產生的 h1：帶 id、尾巴有「#」錨點連結（裡面是 svg）
export const h1 = (title = "聖經研讀知識庫") =>
  el(
    "h1",
    { id: title },
    text(title),
    el("a", { role: "anchor", ariaHidden: "true", href: `#${title}`, className: ["internal"] }, el("svg", {}, el("path", {}))),
  )
// 兩行介紹：blockquote > p（含 <br>）
export const intro = () =>
  el(
    "blockquote",
    {},
    text("\n"),
    el("p", {}, text("整合聖經經文、多重註解。"), el("br", {}), text("\n每章一個研讀頁。")),
    text("\n"),
  )
export const nl = text("\n")
