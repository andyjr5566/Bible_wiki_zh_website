import { describe, expect, it } from "vitest";
import { pageResults } from "../src/components/searchFlow";

interface TestResult {
  slug: string;
  category: string;
}

const results: TestResult[] = [
  { slug: "a", category: "人物" },
  { slug: "b", category: "地點" },
  { slug: "c", category: "人物" },
  { slug: "d", category: "章節" },
  { slug: "e", category: "人物" },
];

describe("pageResults", () => {
  it("returns the first page and counts all results", () => {
    expect(pageResults(results, null, (result) => result.category, 0, 2)).toEqual({
      items: results.slice(0, 2),
      total: 5,
      remaining: 3,
    });
  });

  it("filters before applying the offset and limit", () => {
    expect(pageResults(results, "人物", (result) => result.category, 1, 1)).toEqual({
      items: [results[2]],
      total: 3,
      remaining: 1,
    });
  });

  it("returns an empty page when the offset is past the filtered results", () => {
    expect(pageResults(results, "地點", (result) => result.category, 4, 2)).toEqual({
      items: [],
      total: 1,
      remaining: 0,
    });
  });

  it("handles an empty result set", () => {
    expect(pageResults([], null, () => "", 0, 60)).toEqual({
      items: [],
      total: 0,
      remaining: 0,
    });
  });
});
