import { describe, expect, it } from "vitest";
import {
  getNextVisibleIndex,
  getSearchAnnouncement,
  shouldAnnounce,
} from "../src/components/searchA11y";

describe("getNextVisibleIndex", () => {
  it("stops at the first and last visible options", () => {
    expect(getNextVisibleIndex(0, -1, [true, true, true])).toBe(0);
    expect(getNextVisibleIndex(2, 1, [true, true, true])).toBe(2);
  });

  it("skips hidden options", () => {
    expect(getNextVisibleIndex(0, 1, [true, false, true])).toBe(2);
    expect(getNextVisibleIndex(2, -1, [true, false, true])).toBe(0);
  });

  it("chooses the first or last visible option when nothing is selected", () => {
    expect(getNextVisibleIndex(-1, 1, [false, true, false, true])).toBe(1);
    expect(getNextVisibleIndex(-1, -1, [false, true, false, true])).toBe(3);
  });
});

describe("search announcements", () => {
  it("announces exact counts, no matches, semantic additions, and scripture targets", () => {
    expect(getSearchAnnouncement("exact", 4)).toBe("找到 4 筆結果");
    expect(getSearchAnnouncement("exact", 0)).toBe("找不到相符的結果");
    expect(getSearchAnnouncement("semantic", 2)).toBe("另外找到 2 筆語意相關結果");
    expect(getSearchAnnouncement("semantic", 0)).toBeNull();
    expect(getSearchAnnouncement("scripture", "出埃及記 12:3")).toBe("可以跳到 出埃及記 12:3");
  });

  it("does not announce the same message twice for one query", () => {
    const announced = new Set<string>();
    const message = getSearchAnnouncement("exact", 4);

    expect(shouldAnnounce(announced, message)).toBe(true);
    expect(shouldAnnounce(announced, message)).toBe(false);
    expect(shouldAnnounce(announced, null)).toBe(false);
  });
});
