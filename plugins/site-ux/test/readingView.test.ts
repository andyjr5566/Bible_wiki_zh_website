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
  it("只有 study 才是研讀，其他（含首次造訪與舊版 pure）一律經文", () => {
    expect(normalizeView("study")).toBe("study")
    expect(normalizeView("text")).toBe("text")
    expect(normalizeView("pure")).toBe("text")
    expect(normalizeView("anything")).toBe("text")
    expect(normalizeView(null)).toBe("text")
    expect(normalizeView(undefined)).toBe("text")
  })
})

describe("讀寫（localStorage）", () => {
  it("首次讀取為經文，寫入後可讀回", () => {
    const s = fakeStorage()
    expect(readView(s)).toBe("text")
    expect(writeView("study", s)).toBe(true)
    expect(readView(s)).toBe("study")
    expect(writeView("text", s)).toBe(true)
    expect(readView(s)).toBe("text")
  })

  it("儲存被封鎖時不丟錯：退回經文，寫入回傳 false", () => {
    expect(readView(blocked)).toBe("text")
    expect(writeView("study", blocked)).toBe(false)
    expect(readView(null)).toBe("text")
    expect(writeView("study", null)).toBe(false)
  })

  it("壞資料或舊版 pure 當作經文", () => {
    expect(readView(fakeStorage("???"))).toBe("text")
    expect(readView(fakeStorage("pure"))).toBe("text")
  })
})

describe("套用到 <html>", () => {
  it("經文與研讀都會寫上 data-ux-view，讓 CSS 在首次繪製前套用", () => {
    const root = fakeRoot()
    applyView("text", root)
    expect(root.attrs.get(VIEW_ATTR)).toBe("text")
    expect(currentView(root)).toBe("text")
    applyView("study", root)
    expect(root.attrs.get(VIEW_ATTR)).toBe("study")
    expect(currentView(root)).toBe("study")
  })

  it("applyStoredView 讀取後套用，預設為經文", () => {
    const root = fakeRoot()
    expect(applyStoredView(fakeStorage("study"), root)).toBe("study")
    expect(root.attrs.get(VIEW_ATTR)).toBe("study")
    const root2 = fakeRoot()
    expect(applyStoredView(blocked, root2)).toBe("text")
    expect(root2.attrs.get(VIEW_ATTR)).toBe("text")
  })
})
