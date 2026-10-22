import { describe, expect, it } from "vitest"
import {
  VIEW_ATTR,
  VIEW_STORAGE_KEY,
  applyStoredView,
  applyView,
  currentView,
  normalizeView,
  readView,
  writeView,
  type ViewStorageLike,
} from "../src/lib/readingView"
import type { RootLike } from "../src/lib/settings"

function fakeRoot(): RootLike & { attrs: Map<string, string> } {
  const attrs = new Map<string, string>()
  return {
    attrs,
    setAttribute: (n, v) => void attrs.set(n, v),
    removeAttribute: (n) => void attrs.delete(n),
    getAttribute: (n) => attrs.get(n) ?? null,
  }
}

function fakeStorage(initial?: string): ViewStorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  if (initial !== undefined) data.set(VIEW_STORAGE_KEY, initial)
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) }
}

const blocked: ViewStorageLike = {
  getItem() {
    throw new Error("blocked")
  },
  setItem() {
    throw new Error("blocked")
  },
}

describe("normalizeView", () => {
  it("只有 pure 才是純經文，其他一律研讀", () => {
    expect(normalizeView("pure")).toBe("pure")
    expect(normalizeView("study")).toBe("study")
    expect(normalizeView("anything")).toBe("study")
    expect(normalizeView(null)).toBe("study")
    expect(normalizeView(undefined)).toBe("study")
  })
})

describe("讀寫（sessionStorage）", () => {
  it("寫入後讀回", () => {
    const s = fakeStorage()
    expect(readView(s)).toBe("study")
    expect(writeView("pure", s)).toBe(true)
    expect(readView(s)).toBe("pure")
    expect(writeView("study", s)).toBe(true)
    expect(readView(s)).toBe("study")
  })
  it("儲存被封鎖時不丟錯：回到研讀，寫入回傳 false", () => {
    expect(readView(blocked)).toBe("study")
    expect(writeView("pure", blocked)).toBe(false)
    expect(readView(null)).toBe("study")
    expect(writeView("pure", null)).toBe(false)
  })
  it("壞資料當作研讀", () => {
    expect(readView(fakeStorage("???"))).toBe("study")
  })
})

describe("套用到 <html>", () => {
  it("純經文留屬性，研讀（預設）不留屬性", () => {
    const root = fakeRoot()
    applyView("pure", root)
    expect(root.attrs.get(VIEW_ATTR)).toBe("pure")
    expect(currentView(root)).toBe("pure")
    applyView("study", root)
    expect(root.attrs.has(VIEW_ATTR)).toBe(false)
    expect(currentView(root)).toBe("study")
  })
  it("applyStoredView 讀取後套用", () => {
    const root = fakeRoot()
    expect(applyStoredView(fakeStorage("pure"), root)).toBe("pure")
    expect(root.attrs.get(VIEW_ATTR)).toBe("pure")
    const root2 = fakeRoot()
    expect(applyStoredView(blocked, root2)).toBe("study")
    expect(root2.attrs.size).toBe(0)
  })
})
