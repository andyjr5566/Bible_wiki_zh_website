import { describe, it, expect } from "vitest";
import Search from "../src/components/Search";
import {
  containsExactSearchText,
  findExactMatchSlugs,
  shouldRunExactSearch,
} from "../src/components/searchLogic";

describe("Search Component", () => {
  it("exports a component factory function", () => {
    expect(typeof Search).toBe("function");
  });

  it("creates a component with default options", () => {
    const SearchComponent = Search();
    expect(typeof SearchComponent).toBe("function");
  });

  it("creates a component with custom options", () => {
    const SearchComponent = Search({ enablePreview: false });
    expect(typeof SearchComponent).toBe("function");
  });

  it("attaches CSS and script to component", () => {
    const SearchComponent = Search();
    expect(SearchComponent.css).toBeDefined();
    expect(SearchComponent.afterDOMLoaded).toBeDefined();
  });

  it("skips exact matching for one-character queries", () => {
    expect(shouldRunExactSearch(" 神 ")).toBe(false);
    expect(shouldRunExactSearch("神蹟")).toBe(true);
  });

  it("requires the complete query to occur contiguously", () => {
    expect(containsExactSearchText("這段文字提到聖靈。", "聖靈哈哈")).toBe(false);
    expect(containsExactSearchText("這段文字提到聖靈哈哈。", "聖靈哈哈")).toBe(true);
  });

  it("returns only documents containing the complete query", () => {
    const results = findExactMatchSlugs(
      {
        first: { title: "聖靈", content: "相關內容" },
        second: { title: "其他", content: "聖靈哈哈出現在這裡" },
      },
      "聖靈哈哈",
    );

    expect(results).toEqual(["second"]);
  });
});
