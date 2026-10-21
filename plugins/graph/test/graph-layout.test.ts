import { describe, expect, it } from "vitest"
import {
  categorizeGraphSlug,
  distributeSectorAngles,
  getMoreCount,
  groupNeighbors,
} from "../src/components/graph-layout"

describe("graph category layout helpers", () => {
  it("categorizes folder slugs and chapter slugs", () => {
    expect(categorizeGraphSlug("link_folder/人物/摩西")).toBe("人物")
    expect(categorizeGraphSlug("link_folder/地點/埃及")).toBe("地點")
    expect(categorizeGraphSlug("link_folder/事件/出埃及")).toBe("歷史")
    expect(categorizeGraphSlug("link_folder/歷史/逾越節")).toBe("歷史")
    expect(categorizeGraphSlug("link_folder/神學/救贖")).toBe("神學")
    expect(categorizeGraphSlug("link_folder/原文/逾越")).toBe("原文")
    expect(categorizeGraphSlug("link_folder/互文/詩篇")).toBe("其他")
    expect(categorizeGraphSlug("02-出埃及記/第12章")).toBe("章節")
    expect(categorizeGraphSlug("appendix/maps/018")).toBe("其他")
    expect(categorizeGraphSlug("教學/註釋來源")).toBe("其他")
    expect(categorizeGraphSlug("tags/逾越節")).toBe("其他")
  })

  it("allocates a full circle proportionally to the category counts", () => {
    const sectors = distributeSectorAngles({ 人物: 2, 歷史: 6, 原文: 0 })
    expect(sectors.reduce((sum, sector) => sum + sector.angle, 0)).toBeCloseTo(Math.PI * 2)
    expect(sectors.find((sector) => sector.category === "人物")?.angle).toBeCloseTo(Math.PI / 2)
    expect(sectors.find((sector) => sector.category === "歷史")?.angle).toBeCloseTo((Math.PI * 3) / 2)
    expect(distributeSectorAngles({})).toEqual([])
  })

  it("groups neighbors in list order and omits empty categories", () => {
    const groups = groupNeighbors([
      { id: "02-出埃及記/第12章", title: "第12章" },
      { id: "link_folder/神學/救贖", title: "救贖" },
      { id: "link_folder/人物/摩西", title: "摩西" },
      { id: "link_folder/人物/亞倫", title: "亞倫" },
      { id: "appendix/maps/018", title: "地圖" },
    ])
    expect(groups.map((group) => group.category)).toEqual(["人物", "神學", "其他", "章節"])
    expect(groups[0].items.map((item) => item.title)).toEqual(["摩西", "亞倫"])
  })

  it("calculates the remaining count after the initial four list items", () => {
    expect(getMoreCount(9)).toBe(5)
    expect(getMoreCount(4)).toBe(0)
    expect(getMoreCount(2)).toBe(0)
  })
})
