import { describe, expect, it } from "vitest"
import { HEADING_GAP_PX, centerScrollTop, headingScrollTop } from "../src/lib/scrollPlan"

const desktop = { scrollY: 0, viewportHeight: 800, topObstruction: 0 }
const phone = { scrollY: 0, viewportHeight: 700, topObstruction: 100 }

describe("centerScrollTop", () => {
  it("經節在可見範圍裡置中", () => {
    // 經節上緣在頁面 2000px、高 100：可見範圍 800，置中要讓上緣落在 350
    expect(centerScrollTop({ top: 2000, height: 100 }, desktop)).toBe(1650)
  })
  it("捲動位置要算進去（座標是相對視窗）", () => {
    expect(centerScrollTop({ top: 500, height: 100 }, { ...desktop, scrollY: 1500 })).toBe(1650)
  })
  it("手機：頂端被黏頂工具列佔掉的高度不算可見範圍", () => {
    // 可見 600；經節 100 高 → 上緣要落在 100 + 250 = 350
    expect(centerScrollTop({ top: 2000, height: 100 }, phone)).toBe(1650)
  })
  it("經節比可見範圍還高時對齊上緣（不是置中，才看得到開頭）", () => {
    expect(centerScrollTop({ top: 2000, height: 900 }, desktop)).toBe(2000)
  })
  it("不會捲到負數", () => {
    expect(centerScrollTop({ top: 10, height: 100 }, desktop)).toBe(0)
  })
})

describe("headingScrollTop", () => {
  it("標題對齊上緣並留空隙", () => {
    expect(headingScrollTop({ top: 2000, height: 0 }, desktop)).toBe(2000 - HEADING_GAP_PX)
  })
  it("扣掉黏頂工具列與快捷列", () => {
    expect(headingScrollTop({ top: 2000, height: 0 }, phone)).toBe(2000 - 100 - HEADING_GAP_PX)
  })
  it("不會捲到負數", () => {
    expect(headingScrollTop({ top: 5, height: 0 }, desktop)).toBe(0)
  })
})
