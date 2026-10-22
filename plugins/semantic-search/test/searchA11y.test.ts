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
  it("announces exact counts, semantic additions, and scripture targets", () => {
    expect(getSearchAnnouncement("exact", 4)).toBe("找到 4 筆結果");
    expect(getSearchAnnouncement("semantic", 2)).toBe("另外找到 2 筆語意相關結果");
    expect(getSearchAnnouncement("semantic", 0)).toBeNull();
    expect(getSearchAnnouncement("scripture", "出埃及記 12:3")).toBe("可以跳到 出埃及記 12:3");
  });

  it("does not say nothing was found while only the exact matches are empty", () => {
    // 精準 0 筆時語意結果可能還在路上，只能說「沒有完全相符」
    expect(getSearchAnnouncement("exact", 0)).toBe("沒有完全相符的結果");
    // 全部都結束、也沒有卡片，才說找不到
    expect(getSearchAnnouncement("none", 0)).toBe("找不到相符的結果");
  });

  it("reads out the card that says the scripture page is still being prepared", () => {
    expect(getSearchAnnouncement("scripture-missing", "士師記的研讀頁還在整理中")).toBe(
      "士師記的研讀頁還在整理中",
    );
  });

  it("does not announce the same message twice for one query", () => {
    const announced = new Set<string>();
    const message = getSearchAnnouncement("exact", 4);

    expect(shouldAnnounce(announced, message)).toBe(true);
    expect(shouldAnnounce(announced, message)).toBe(false);
    expect(shouldAnnounce(announced, null)).toBe(false);
  });
});
