import { describe, expect, it } from "vitest"
import { READING_STORAGE_KEY } from "../../../quartz/util/readingPosition"
import { hasReading, loadReading, saveReading, type ReadingStorage } from "../src/lib/readingStorage"
import { READING_ATTR, applyReadingOrder, readingOrder } from "../src/lib/readingOrder"

function memory(initial?: string): ReadingStorage & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(READING_STORAGE_KEY, initial)
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}
const blocked: ReadingStorage = {
  getItem() {
    throw new Error("blocked")
  },
  setItem() {
    throw new Error("blocked")
  },
}
const good = JSON.stringify({ v: 1, books: { "02-出埃及記": { slug: "02-出埃及記/第12章", ratio: 0.5, t: 1 } } })

describe("readingStorage", () => {
  it("存、讀來回；一卷只有一筆", () => {
    const s = memory()
    expect(saveReading({ slug: "02-出埃及記/第3章", ratio: 0.1, t: 1 }, s)).toBe(true)
    expect(saveReading({ slug: "02-出埃及記/第12章", ratio: 0.5, t: 2 }, s)).toBe(true)
    expect(Object.keys(loadReading(s).books)).toEqual(["02-出埃及記"])
    expect(loadReading(s).books["02-出埃及記"].slug).toBe("02-出埃及記/第12章")
  })
  it("章節以外的頁面不記", () => {
    const s = memory()
    expect(saveReading({ slug: "02-出埃及記/全書目錄及綱要", ratio: 0, t: 1 }, s)).toBe(false)
    expect(saveReading({ slug: "link_folder/人物/摩西", ratio: 0, t: 1 }, s)).toBe(false)
    expect(s.data.size).toBe(0)
  })
  it("被封鎖或壞資料時退回空紀錄、不丟錯", () => {
    expect(loadReading(blocked).books).toEqual({})
    expect(loadReading(null).books).toEqual({})
    expect(saveReading({ slug: "02-出埃及記/第12章", ratio: 0, t: 1 }, blocked)).toBe(false)
    expect(saveReading({ slug: "02-出埃及記/第12章", ratio: 0, t: 1 }, null)).toBe(false)
    expect(loadReading(memory("{壞掉")).books).toEqual({})
  })
  it("hasReading：要有至少一筆對得上書卷的有效紀錄", () => {
    expect(hasReading(memory(good))).toBe(true)
    expect(hasReading(memory())).toBe(false)
    expect(hasReading(blocked)).toBe(false)
    expect(hasReading(null)).toBe(false)
    const unknownBook = JSON.stringify({ v: 1, books: { "99-不存在": { slug: "99-不存在/第1章", ratio: 0, t: 1 } } })
    expect(hasReading(memory(unknownBook))).toBe(false)
    const incomplete = JSON.stringify({ v: 1, books: { "02-出埃及記": { slug: "02-出埃及記/第12章" } } })
    expect(hasReading(memory(incomplete))).toBe(false)
  })
})

describe("readingOrder", () => {
  it("有紀錄 has、沒有／讀不到 none，並寫到 <html> 屬性", () => {
    expect(readingOrder(memory(good))).toBe("has")
    expect(readingOrder(memory())).toBe("none")
    expect(readingOrder(blocked)).toBe("none")
    const attrs = new Map<string, string>()
    const root = { setAttribute: (n: string, v: string) => void attrs.set(n, v) }
    applyReadingOrder(root, memory(good))
    expect(attrs.get(READING_ATTR)).toBe("has")
    applyReadingOrder(root, blocked)
    expect(attrs.get(READING_ATTR)).toBe("none")
  })
})
