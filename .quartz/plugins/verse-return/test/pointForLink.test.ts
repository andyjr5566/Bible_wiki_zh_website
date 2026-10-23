// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { pointForLink } from "../src/lib/pointForLink"
import { chapterDocument } from "./fixtures"

describe("pointForLink", () => {
  it("經文某一節的連結 → 那一節（ol 的 start 算進去）", () => {
    const doc = chapterDocument()
    expect(pointForLink(doc.querySelector("#a a")!, 5, doc)).toEqual({
      v: 1,
      slug: "02-出埃及記/第12章",
      kind: "verse",
      verse: 3,
      t: 5,
    })
  })

  it("本章整理裡的連結 → 最近的小標題", () => {
    const doc = chapterDocument()
    expect(pointForLink(doc.querySelector("#p2 a")!, 7, doc)).toEqual({
      v: 1,
      slug: "02-出埃及記/第12章",
      kind: "study",
      headingId: "s2",
      t: 7,
    })
  })

  it("其他地方（相關地圖、知識節點）的連結不記", () => {
    const doc = chapterDocument()
    expect(pointForLink(doc.querySelector("#map + ul a")!, 1, doc)).toBeNull()
    expect(pointForLink(doc.querySelector("#n1 + ul a")!, 1, doc)).toBeNull()
  })

  it("條目頁（認不出經文清單）一律不記", () => {
    const doc = chapterDocument("知識節點/安息")
    expect(pointForLink(doc.querySelector("#a a")!, 1, doc)).toBeNull()
  })
})
