import { describe, expect, it } from "vitest"
import {
  PENDING_KEY,
  PENDING_TTL_MS,
  parsePending,
  pendingApplies,
  setPending,
  takePending,
  type StorageLike,
} from "../src/lib/pendingResume"

function memory(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  }
}
const blocked: StorageLike = {
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

describe("parsePending", () => {
  it("接受正確格式，壞格式回傳 null", () => {
    expect(parsePending('{"slug":"a/b","ratio":0.5,"t":1}')).toEqual({ slug: "a/b", ratio: 0.5, t: 1 })
    expect(parsePending(null)).toBeNull()
    expect(parsePending("x")).toBeNull()
    expect(parsePending('{"slug":1,"ratio":0.5,"t":1}')).toBeNull()
    expect(parsePending('{"slug":"a","ratio":null,"t":1}')).toBeNull()
  })
})

describe("pendingApplies", () => {
  const pending = { slug: "02-出埃及記/第12章", ratio: 0.5, t: 1000 }
  it("同一頁（網址編碼、空白不同也算）而且沒過期才成立", () => {
    expect(pendingApplies(pending, "02-出埃及記/第12章", 2000)).toBe(true)
    expect(pendingApplies(pending, encodeURI("02 出埃及記/第12章"), 2000)).toBe(true)
  })
  it("別頁、過期、時鐘倒退太多都不成立", () => {
    expect(pendingApplies(pending, "02-出埃及記/第11章", 2000)).toBe(false)
    expect(pendingApplies(pending, "02-出埃及記/第12章", 1000 + PENDING_TTL_MS + 1)).toBe(false)
    expect(pendingApplies(pending, "02-出埃及記/第12章", 1000 - PENDING_TTL_MS - 1)).toBe(false)
    expect(pendingApplies(null, "x", 0)).toBe(false)
  })
})

describe("setPending／takePending", () => {
  it("寫入後讀一次就失效", () => {
    const s = memory()
    setPending("02-出埃及記/第12章", 0.4, 5000, s)
    expect(s.data.has(PENDING_KEY)).toBe(true)
    expect(takePending("02-出埃及記/第12章", 6000, s)).toEqual({ slug: "02-出埃及記/第12章", ratio: 0.4, t: 5000 })
    expect(s.data.has(PENDING_KEY)).toBe(false)
    expect(takePending("02-出埃及記/第12章", 6000, s)).toBeNull()
  })
  it("不是這一頁的旗標也會被清掉，不留到之後", () => {
    const s = memory()
    setPending("02-出埃及記/第12章", 0.4, 5000, s)
    expect(takePending("01-創世記/第1章", 6000, s)).toBeNull()
    expect(s.data.has(PENDING_KEY)).toBe(false)
  })
  it("儲存空間被封鎖時不丟錯", () => {
    expect(() => setPending("a/b", 0.1, 0, blocked)).not.toThrow()
    expect(takePending("a/b", 0, blocked)).toBeNull()
    expect(takePending("a/b", 0, null)).toBeNull()
  })
})
