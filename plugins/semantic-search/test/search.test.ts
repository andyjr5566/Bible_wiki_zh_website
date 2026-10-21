import { describe, it, expect, vi } from "vitest";
import Search from "../src/components/Search";
import {
  containsExactSearchText,
  findExactMatchSlugs,
  getBookNameFromSlug,
  isSearchExcludedSlug,
  shouldRunExactSearch,
  rankExactMatches,
  getSlugKind,
  getResultCategory,
  summarizeCategories,
} from "../src/components/searchLogic";
import { appendSemanticResults, fetchJsonWithTimeout } from "../src/components/searchFlow";

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

  it("extracts the book name from chapter slugs", () => {
    expect(getBookNameFromSlug("04-民數記/第16章")).toBe("民數記");
    expect(getBookNameFromSlug("民數記/第16章")).toBe("民數記");
    expect(getBookNameFromSlug("第16章")).toBe("");
  });

  it("excludes technical pages from search", () => {
    expect(isSearchExcludedSlug("index")).toBe(true);
    expect(isSearchExcludedSlug("README")).toBe(true);
    expect(isSearchExcludedSlug("INSTALL_COMPUTER")).toBe(true);
    expect(isSearchExcludedSlug("04-民數記/第16章")).toBe(false);
  });
});

describe("Exact match ranking", () => {
  it("orders title tiers before content-only matches and ranks title hits by count", () => {
    const items = {
      "link_folder/神學/精準": { title: "逾越節", content: "" },
      "link_folder/神學/較多命中": {
        title: "核心逾越節重點",
        content: "逾越節逾越節",
      },
      "link_folder/神學/較少命中": { title: "逾越節小冊", content: "" },
      "link_folder/神學/內文命中": { title: "原文 逾越 (Pesach)", content: "逾越節" },
    };

    expect(
      rankExactMatches(
        items,
        [
          "link_folder/神學/內文命中",
          "link_folder/神學/較少命中",
          "link_folder/神學/精準",
          "link_folder/神學/較多命中",
        ],
        "逾越節",
      ),
    ).toEqual([
      "link_folder/神學/精準",
      "link_folder/神學/較多命中",
      "link_folder/神學/較少命中",
      "link_folder/神學/內文命中",
    ]);
  });

  it("interleaves tier-two chapters and entries by count, preferring chapters on ties", () => {
    const items = {
      "02-出埃及記/第12章": { title: "第12章", content: "逾越節".repeat(5) },
      "02-出埃及記/第13章": { title: "第13章", content: "逾越節".repeat(3) },
      "link_folder/神學/四次提及": { title: "四次提及", content: "逾越節".repeat(4) },
      "link_folder/神學/三次提及": { title: "三次提及", content: "逾越節".repeat(3) },
      "link_folder/神學/一次提及": { title: "一次提及", content: "逾越節" },
    };
    const slugs = Object.keys(items);

    expect(rankExactMatches(items, slugs, "逾越節")).toEqual([
      "02-出埃及記/第12章",
      "link_folder/神學/四次提及",
      "02-出埃及記/第13章",
      "link_folder/神學/三次提及",
      "link_folder/神學/一次提及",
    ]);
  });

  it("keeps the exact entry first and ranks Exodus 12 above one-mention entries", () => {
    const items = {
      "link_folder/神學/逾越節": { title: "逾越節", content: "" },
      "link_folder/神學/原文逾越": { title: "原文 逾越 (Pesach)", content: "逾越節" },
      "02-出埃及記/第12章": {
        title: "第12章",
        content: "逾越節".repeat(8),
      },
      "link_folder/神學/單次提及": { title: "單次提及", content: "逾越節" },
    };
    const ranked = rankExactMatches(items, Object.keys(items), "逾越節");

    expect(ranked[0]).toBe("link_folder/神學/逾越節");
    expect(ranked.indexOf("02-出埃及記/第12章")).toBeLessThan(
      ranked.indexOf("link_folder/神學/單次提及"),
    );
    expect(ranked.indexOf("link_folder/神學/原文逾越")).toBeGreaterThan(0);
  });

  it("orders equal matches deterministically by Traditional Chinese slug order", () => {
    const items = {
      "link_folder/神學/乙": { title: "乙", content: "逾越節" },
      "link_folder/神學/甲": { title: "甲", content: "逾越節" },
      "link_folder/神學/丙": { title: "丙", content: "逾越節" },
    };
    const slugs = Object.keys(items);
    const expected = [...slugs].sort((a, b) => a.localeCompare(b, "zh-Hant"));

    expect(rankExactMatches(items, slugs, "逾越節")).toEqual(expected);
    expect(rankExactMatches(items, [...slugs].reverse(), "逾越節")).toEqual(expected);
  });
});

describe("Slug kind", () => {
  it("classifies chapters, entries, and other slugs", () => {
    expect(getSlugKind("04-民數記/第3章")).toBe("chapter");
    expect(getSlugKind("link_folder/人物/摩西")).toBe("entry");
    expect(getSlugKind("appendix/附錄")).toBe("other");
  });
});

describe("Result category", () => {
  it("uses the link_folder folder name for entries", () => {
    for (const name of [
      "人物",
      "地點",
      "事件",
      "歷史",
      "背景",
      "文化",
      "神學",
      "主題",
      "原文",
      "互文",
      "解經爭議",
    ]) {
      expect(getResultCategory("link_folder/" + name + "/某條目")).toBe(name);
    }
  });

  it("uses the folder name for a brand-new link_folder folder", () => {
    expect(getResultCategory("link_folder/考古/死海古卷")).toBe("考古");
  });

  it("classifies chapters, appendix, teaching, and others", () => {
    expect(getResultCategory("02-出埃及記/第12章")).toBe("章節");
    expect(getResultCategory("appendix/附錄一")).toBe("附錄");
    expect(getResultCategory("教學/讀經方法")).toBe("教學");
    expect(getResultCategory("tags/摩西")).toBe("其他");
    expect(getResultCategory("link_folder/index")).toBe("其他");
  });

  it("decodes URL-encoded slugs and tolerates malformed encoding", () => {
    expect(
      getResultCategory(encodeURIComponent("link_folder/人物/摩西").replace(/%2F/g, "/")),
    ).toBe("人物");
    expect(getResultCategory("02-%E5%87%BA/%E7%AC%AC1%E7%AB%A0")).toBe("章節");
    expect(getResultCategory("link_folder/%E4%BA%BA%E7%89%A9/%E6%91%A9%E8%A5%BF")).toBe("人物");
    expect(getResultCategory("02-%E0%A4%A/x")).toBe("章節");
  });

  it("summarizes categories in graph order with counts", () => {
    const summary = summarizeCategories([
      "章節",
      "教學",
      "其他",
      "人物",
      "考古",
      "章節",
      "附錄",
      "解經爭議",
      "人物",
      "地點",
      "人物",
    ]);
    expect(summary).toEqual([
      { name: "人物", count: 3 },
      { name: "地點", count: 1 },
      { name: "解經爭議", count: 1 },
      { name: "考古", count: 1 },
      { name: "其他", count: 1 },
      { name: "附錄", count: 1 },
      { name: "教學", count: 1 },
      { name: "章節", count: 2 },
    ]);
  });
});

describe("Semantic search flow", () => {
  it("returns parsed data on success", async () => {
    const data = { results: [{ slug: "link_folder/神學/逾越節" }] };
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        json: async () => data,
      }) as Response;

    await expect(
      fetchJsonWithTimeout("https://example.test/search", { timeoutMs: 4000, fetchImpl }),
    ).resolves.toEqual({ status: "ok", data });
  });

  it("returns error when fetch fails", async () => {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("network failed");
    };

    await expect(
      fetchJsonWithTimeout("https://example.test/search", { timeoutMs: 4000, fetchImpl }),
    ).resolves.toEqual({ status: "error" });
  });

  it("returns aborted when its caller cancels", async () => {
    const controller = new AbortController();
    const fetchImpl: typeof fetch = (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
    const request = fetchJsonWithTimeout("https://example.test/search", {
      timeoutMs: 4000,
      signal: controller.signal,
      fetchImpl,
    });

    controller.abort();

    await expect(request).resolves.toEqual({ status: "aborted" });
  });

  it("returns timeout when the request exceeds its deadline", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl: typeof fetch = (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        });
      const request = fetchJsonWithTimeout("https://example.test/search", {
        timeoutMs: 4000,
        fetchImpl,
      });

      await vi.advanceTimersByTimeAsync(4000);

      await expect(request).resolves.toEqual({ status: "timeout" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("deduplicates semantic results and excludes technical slugs", () => {
    const exactSlug = "link_folder/神學/逾越節";
    const results = appendSemanticResults(
      [exactSlug],
      [
        { slug: exactSlug },
        { slug: "link_folder/人物/摩西" },
        { slug: "link_folder/人物/摩西" },
        { slug: "appendix/index" },
      ],
      isSearchExcludedSlug,
    );

    expect(results).toEqual([{ slug: "link_folder/人物/摩西" }]);
  });
});
