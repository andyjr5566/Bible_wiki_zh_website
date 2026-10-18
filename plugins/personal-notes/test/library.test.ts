import { describe, expect, it } from "vitest"
import { byPlace, groupByBook, matchesQuery, recent, type LibraryItem } from "../src/client/ui/library"

const item = (id: string, book: string | null, chapter: number | null, verse: number | null, updated: string, text = "", tags: string[] = [], groupLabel?: string): LibraryItem => ({
  id,
  book,
  chapter,
  verse,
  updated,
  text,
  tags,
  groupLabel,
  render: () => {
    throw new Error("不該在 Node 裡畫")
  },
})

describe("我的筆記清單：分組、搜尋、最近（D-42）", () => {
  const items = [
    item("a", "EXO", 12, 3, "2026-10-01T00:00:00Z", "出埃及記 第12章 逾越節"),
    item("b", "GEN", 1, 3, "2026-10-05T00:00:00Z", "創世記 第1章 要有光", ["光"]),
    item("c", "GEN", 1, 1, "2026-10-03T00:00:00Z", "創世記 第1章 起初", ["創造"]),
    item("d", "GEN", 3, 15, "2026-10-04T00:00:00Z", "創世記 第3章 女人的後裔", ["應許"]),
    item("e", null, null, null, "2026-10-06T00:00:00Z", "📚 亞伯拉罕", [], "知識庫條目"),
  ]

  it("依經文順序排：書卷、章、節；沒有書卷的放最後", () => {
    expect([...items].sort(byPlace).map((i) => i.id)).toEqual(["c", "b", "d", "a", "e"])
  })

  it("最近編輯：依時間新到舊取前 n 則", () => {
    expect(recent(items, 3).map((i) => i.id)).toEqual(["e", "b", "d"])
  })

  it("依書卷→章分組並計數；沒有書卷的依 groupLabel 分組", () => {
    const g = groupByBook(items)
    expect(g.map((b) => [b.label, b.count])).toEqual([
      ["創世記", 3],
      ["出埃及記", 1],
      ["知識庫條目", 1],
    ])
    expect(g[0].chapters.map((c) => [c.chapter, c.items.map((i) => i.id)])).toEqual([
      [1, ["c", "b"]],
      [3, ["d"]],
    ])
    expect(g[2].chapters).toHaveLength(1)
    expect(g[2].chapters[0].chapter).toBeNull()
  })

  it("搜尋：多個詞都要符合、#標籤比對標籤開頭、不分大小寫", () => {
    expect(items.filter((i) => matchesQuery(i, "創世記 光")).map((i) => i.id)).toEqual(["b"])
    expect(items.filter((i) => matchesQuery(i, "#應")).map((i) => i.id)).toEqual(["d"])
    expect(items.filter((i) => matchesQuery(i, "")).length).toBe(5)
    expect(matchesQuery(item("x", null, null, null, "", "Hello"), "hello")).toBe(true)
  })

  it("大量資料：1200 則分組後數量正確（不遺漏、不重複）", () => {
    const many: LibraryItem[] = []
    const codes = ["GEN", "EXO", "LEV", "NUM", "DEU", "JOS"]
    for (let i = 0; i < 1200; i++) many.push(item(`n${i}`, codes[i % 6], (i % 30) + 1, (i % 20) + 1, `2026-01-01T00:00:${String(i % 60).padStart(2, "0")}Z`))
    const g = groupByBook(many)
    expect(g.reduce((s, b) => s + b.count, 0)).toBe(1200)
    expect(g.flatMap((b) => b.chapters.flatMap((c) => c.items)).length).toBe(1200)
    expect(new Set(g.flatMap((b) => b.chapters.map((c) => c.key))).size).toBe(g.reduce((s, b) => s + b.chapters.length, 0))
    expect(recent(many, 10)).toHaveLength(10)
  })
})
