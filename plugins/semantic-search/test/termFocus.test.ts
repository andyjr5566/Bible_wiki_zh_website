import { describe, expect, it } from "vitest";
import { findTextMatchRanges } from "../src/components/textMatcher";
import { firstHitRanges } from "../src/components/termFocus";

describe("firstHitRanges", () => {
  it("短譯註隔開的片段屬於同一處命中", () => {
    const text = "他（原文是我）必按時";
    const ranges = findTextMatchRanges(text, ["他必按時"]);
    expect(firstHitRanges(text, ranges)).toEqual(ranges);
    expect(ranges.length).toBeGreaterThan(1);
  });

  it("40 字長譯註也屬於同一處命中", () => {
    const text = "他（原文是" + "我".repeat(40) + "）必按時";
    const ranges = findTextMatchRanges(text, ["他必按時"]);
    expect(ranges.length).toBe(2);
    expect(firstHitRanges(text, ranges)).toEqual(ranges);
  });

  it("同段兩處獨立命中不合併", () => {
    const text = "耶和華是我的牧者，我必不至缺乏。耶和華是我的牧者。";
    const ranges = findTextMatchRanges(text, ["耶和華"]);
    expect(ranges.length).toBe(2);
    expect(firstHitRanges(text, ranges)).toEqual([ranges[0]]);
  });

  it("空陣列回傳空陣列", () => {
    expect(firstHitRanges("abc", [])).toEqual([]);
  });
});
