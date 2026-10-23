import { describe, expect, it } from "vitest"
import { buildCatalog } from "../../../quartz/util/bookCatalog"
import { compactCatalog, expandCatalog } from "../src/lib/catalogData"

const catalog = buildCatalog([
  "01-創世記/第1章",
  "01-創世記/第2章",
  "01-創世記/全書目錄及綱要",
  "05-申命記/書卷導論",
])

describe("compactCatalog／expandCatalog", () => {
  it("只放有頁面的書卷，章號與目錄／導論旗標來回不變", () => {
    const compact = compactCatalog(catalog)
    expect(compact).toEqual([
      [1, [1, 2], 1, 0],
      [5, [], 0, 1],
    ])
    const expanded = expandCatalog(JSON.stringify(compact))
    expect(expanded.map((e) => [e.book.num, e.status, e.chapters, e.hasToc, e.hasIntro])).toEqual([
      [1, "ready", [1, 2], true, false],
      [5, "outline", [], false, true],
    ])
  })

  it("資料壞掉時回傳空清單，不丟錯", () => {
    expect(expandCatalog(null)).toEqual([])
    expect(expandCatalog("not json")).toEqual([])
    expect(expandCatalog("{}")).toEqual([])
  })

  it("跳過壞掉的列與不存在的書卷序號", () => {
    const raw = JSON.stringify([[1, [1, "x", 2.5, 3], 1, 0], [99, [1], 0, 0], "x", [2]])
    const expanded = expandCatalog(raw)
    expect(expanded).toHaveLength(1)
    expect(expanded[0].chapters).toEqual([1, 3])
  })
})
