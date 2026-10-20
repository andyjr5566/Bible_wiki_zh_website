// 裝置判斷（ui/env primaryInput）與教學的電腦／手機選擇（features/tutorial/device，D-51）。

import { afterEach, describe, expect, it, vi } from "vitest"
import { primaryInput } from "../src/client/ui/env"
import { DEVICE_KEY, initialDevice, parseDevice, rememberDevice, resolveDevice, storedDevice } from "../src/client/features/tutorial/device"

afterEach(() => vi.unstubAllGlobals())

describe("主要輸入方式", () => {
  it("粗略指標為觸控", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    expect(primaryInput()).toBe("touch")
  })

  it("非粗略指標為桌面", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }))
    expect(primaryInput()).toBe("desktop")
  })

  it("沒有 matchMedia 時為桌面", () => {
    expect(primaryInput()).toBe("desktop")
  })

  it("matchMedia 丟例外時為桌面", () => {
    vi.stubGlobal("matchMedia", () => {
      throw new Error("blocked")
    })
    expect(primaryInput()).toBe("desktop")
  })
})

describe("教學裝置選擇", () => {
  it("只接受 touch 和 desktop", () => {
    expect(parseDevice("touch")).toBe("touch")
    expect(parseDevice("desktop")).toBe("desktop")
    for (const value of [null, undefined, "", "phone", "Touch", 1, {}]) {
      expect(parseDevice(value)).toBeNull()
    }
  })

  it("依網址參數、記住的選擇、自動判斷排序", () => {
    expect(resolveDevice({ param: "touch", stored: "desktop", auto: "desktop" })).toBe("touch")
    expect(resolveDevice({ param: null, stored: "touch", auto: "desktop" })).toBe("touch")
    expect(resolveDevice({ param: null, stored: null, auto: "touch" })).toBe("touch")
  })

  it("網址參數無效時採用記住的選擇，再退回自動判斷", () => {
    expect(resolveDevice({ param: "bad", stored: "desktop", auto: "touch" })).toBe("desktop")
    expect(resolveDevice({ param: "bad", stored: "bad", auto: "touch" })).toBe("touch")
  })

  it("localStorage 讀寫丟例外時不會丟錯", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked")
      },
      setItem: () => {
        throw new Error("blocked")
      },
    })
    expect(storedDevice()).toBeNull()
    expect(() => rememberDevice("touch")).not.toThrow()
  })

  it("initialDevice 組合網址、已記住與自動判斷", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: true }))
    const data = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    })
    expect(initialDevice("desktop")).toBe("desktop")
    data.set(DEVICE_KEY, "desktop")
    expect(initialDevice()).toBe("desktop")
    data.set(DEVICE_KEY, "invalid")
    expect(initialDevice()).toBe("touch")
  })
})
