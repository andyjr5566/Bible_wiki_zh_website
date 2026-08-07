import { describe, it, expect } from "vitest";
import Search from "../src/components/Search";
import { shouldRunExactSearch } from "../src/components/searchLogic";

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
});
