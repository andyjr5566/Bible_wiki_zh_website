import { describe, expect, it } from "vitest"
import { RETURN_POINT_KEY, makeVersePoint } from "../../../quartz/util/returnPoint"
import { clearReturnPoint, readReturnPoint, writeReturnPoint, type StorageLike } from "../src/lib/store"

function fakeStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}

const throwing: StorageLike = {
  getItem() {
    throw new Error("blocked")
  },
  setItem() {
    throw new Error("blocked")
  },
  removeItem() {
    throw new Error("blocked")
  },
}

const point = makeVersePoint("02-出埃及記/第12章", 6, 1000)!

describe("返回點的儲存", () => {
  it("寫入、讀回、清除", () => {
    const s = fakeStorage()
    expect(readReturnPoint(s)).toBeNull()
    expect(writeReturnPoint(point, s)).toBe(true)
    expect(s.data.has(RETURN_POINT_KEY)).toBe(true)
    expect(readReturnPoint(s)).toEqual(point)
    clearReturnPoint(s)
    expect(readReturnPoint(s)).toBeNull()
  })

  it("資料壞掉或格式不對時當作沒有", () => {
    const s = fakeStorage()
    s.setItem(RETURN_POINT_KEY, "{not json")
    expect(readReturnPoint(s)).toBeNull()
    s.setItem(RETURN_POINT_KEY, JSON.stringify({ v: 2 }))
    expect(readReturnPoint(s)).toBeNull()
  })

  it("儲存被封鎖時不丟錯：寫入回傳 false、讀取回傳 null", () => {
    expect(writeReturnPoint(point, throwing)).toBe(false)
    expect(readReturnPoint(throwing)).toBeNull()
    expect(() => clearReturnPoint(throwing)).not.toThrow()
  })

  it("沒有儲存空間（null）時同樣安全", () => {
    expect(writeReturnPoint(point, null)).toBe(false)
    expect(readReturnPoint(null)).toBeNull()
    expect(() => clearReturnPoint(null)).not.toThrow()
  })
})
