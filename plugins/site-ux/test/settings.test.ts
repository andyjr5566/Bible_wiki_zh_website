import { describe, expect, it } from "vitest"
import {
  DEFAULTS,
  STORAGE_KEYS,
  applySettings,
  applyStoredSettings,
  normalize,
  readSettings,
  writeSetting,
  type RootLike,
  type StorageLike,
} from "../src/lib/settings"

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  }
}

function brokenStorage(): StorageLike {
  return {
    getItem() {
      throw new Error("blocked")
    },
    setItem() {
      throw new Error("blocked")
    },
  }
}

function fakeRoot(): RootLike & { attrs: Map<string, string> } {
  const attrs = new Map<string, string>()
  return {
    attrs,
    setAttribute: (n, v) => void attrs.set(n, v),
    removeAttribute: (n) => void attrs.delete(n),
    getAttribute: (n) => attrs.get(n) ?? null,
  }
}

describe("normalize", () => {
  it("合法值原樣回傳，其他一律回預設", () => {
    expect(normalize("bg", "pure")).toBe("pure")
    expect(normalize("fontSize", "l")).toBe("l")
    expect(normalize("links", "hidden")).toBe("hidden")
    expect(normalize("bg", "dark")).toBe("paper")
    expect(normalize("fontSize", null)).toBe("m")
    expect(normalize("links", 3)).toBe("normal")
  })
})

describe("readSettings", () => {
  it("沒有任何儲存時就是預設", () => {
    expect(readSettings(memoryStorage())).toEqual(DEFAULTS)
    expect(DEFAULTS).toEqual({ bg: "paper", fontSize: "m", links: "normal" })
  })

  it("舊的「素」按鈕存下的 theme-bg=pure 仍然有效（升級後不用重設）", () => {
    expect(STORAGE_KEYS.bg).toBe("theme-bg")
    expect(readSettings(memoryStorage({ "theme-bg": "pure" })).bg).toBe("pure")
    expect(readSettings(memoryStorage({ "theme-bg": "paper" })).bg).toBe("paper")
  })

  it("讀到不認得的值時退回預設", () => {
    const s = memoryStorage({
      "theme-bg": "magenta",
      "bwz-ux-fontsize": "xl",
      "bwz-ux-verselinks": "",
    })
    expect(readSettings(s)).toEqual(DEFAULTS)
  })

  it("localStorage 丟錯（隱私模式）或不存在時不丟錯", () => {
    expect(readSettings(brokenStorage())).toEqual(DEFAULTS)
    expect(readSettings(null)).toEqual(DEFAULTS)
  })
})

describe("writeSetting", () => {
  it("寫入後讀得回來", () => {
    const s = memoryStorage()
    expect(writeSetting("fontSize", "l", s)).toBe(true)
    expect(writeSetting("links", "quiet", s)).toBe(true)
    expect(writeSetting("bg", "pure", s)).toBe(true)
    expect(readSettings(s)).toEqual({ bg: "pure", fontSize: "l", links: "quiet" })
    expect(s.data.get("theme-bg")).toBe("pure")
  })

  it("寫入失敗只回傳 false", () => {
    expect(writeSetting("bg", "pure", brokenStorage())).toBe(false)
    expect(writeSetting("bg", "pure", null)).toBe(false)
  })

  it("不合法的值會被改成預設再寫入", () => {
    const s = memoryStorage()
    writeSetting("links", "weird" as never, s)
    expect(s.data.get("bwz-ux-verselinks")).toBe("normal")
  })
})

describe("applySettings", () => {
  it("預設值不在 <html> 留下任何屬性", () => {
    const root = fakeRoot()
    applySettings(DEFAULTS, root)
    expect(root.attrs.size).toBe(0)
  })

  it("非預設值寫成屬性，換回預設時移除", () => {
    const root = fakeRoot()
    applySettings({ bg: "pure", fontSize: "s", links: "hidden" }, root)
    expect(Object.fromEntries(root.attrs)).toEqual({
      "data-bg": "pure",
      "data-ux-fs": "s",
      "data-ux-links": "hidden",
    })
    applySettings(DEFAULTS, root)
    expect(root.attrs.size).toBe(0)
  })

  it("applyStoredSettings 讀取儲存並套用", () => {
    const root = fakeRoot()
    const result = applyStoredSettings(memoryStorage({ "theme-bg": "pure", "bwz-ux-fontsize": "l" }), root)
    expect(result).toEqual({ bg: "pure", fontSize: "l", links: "normal" })
    expect(root.getAttribute("data-bg")).toBe("pure")
    expect(root.getAttribute("data-ux-fs")).toBe("l")
    expect(root.getAttribute("data-ux-links")).toBeNull()
  })
})
