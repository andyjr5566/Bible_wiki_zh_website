// 手機版「換你試試」：真實選取範圍與虛線字的重疊判斷（features/tutorial/selection.ts 的純函式）。

import { describe, expect, it } from "vitest"
import { pickTarget, type Target } from "../src/client/features/tutorial/selection"

const targets: Target[] = [
  { name: "sel2", start: 0, end: 8 },
  { name: "sel", start: 40, end: 50 },
]

describe("pickTarget", () => {
  it("選取完全涵蓋虛線字", () => {
    expect(pickTarget({ start: 38, end: 52 }, targets)).toBe("sel")
  })

  it("只選到虛線字的一部分也算", () => {
    expect(pickTarget({ start: 44, end: 46 }, targets)).toBe("sel")
    expect(pickTarget({ start: 45, end: 70 }, targets)).toBe("sel")
    expect(pickTarget({ start: 30, end: 41 }, targets)).toBe("sel")
  })

  it("選取在虛線字裡面", () => {
    expect(pickTarget({ start: 1, end: 3 }, targets)).toBe("sel2")
  })

  it("只是相鄰（端點相碰）不算", () => {
    expect(pickTarget({ start: 8, end: 20 }, targets)).toBeNull()
    expect(pickTarget({ start: 20, end: 40 }, targets)).toBeNull()
    expect(pickTarget({ start: 50, end: 60 }, targets)).toBeNull()
  })

  it("沒碰到任何一段、或是空選取", () => {
    expect(pickTarget({ start: 10, end: 30 }, targets)).toBeNull()
    expect(pickTarget({ start: 45, end: 45 }, targets)).toBeNull()
    expect(pickTarget({ start: 5, end: 5 }, [])).toBeNull()
  })

  it("反向選取（拉動把手越過起點）先對調", () => {
    expect(pickTarget({ start: 52, end: 38 }, targets)).toBe("sel")
  })

  it("同時碰到兩段：取重疊較多的；一樣多取前面的", () => {
    expect(pickTarget({ start: 6, end: 48 }, targets)).toBe("sel")
    expect(pickTarget({ start: 4, end: 44 }, [{ name: "a", start: 0, end: 8 }, { name: "b", start: 40, end: 48 }])).toBe("a")
  })
})
