import { describe, expect, it } from "vitest";
import {
  getVerseMatchRanges,
  getVerseSearchSuggestions,
  parseVerseSearchHints,
  prepareVerseIndex,
  searchVerses,
  searchVersesWithRewrite,
  selectPinnedVerses,
  type RelatedWordTable,
} from "../src/components/verseSearch";

const genesis = {
  slug: "01-創世記/第6章",
  book: "創世記",
  chapter: 6,
  start: 5,
  verses: ["耶和華見人在地上罪惡很大，終日所思想的盡都是惡，", "耶和華就後悔造人在地上。"],
};

const deuteronomy = {
  slug: "05-申命記/第31章",
  book: "申命記",
  chapter: 31,
  start: 20,
  verses: ["他們在那裡吃得飽足，轉向別神。", "他們所懷的意念我都知道了。"],
};

const corpus = prepareVerseIndex({ version: 1, chapters: [genesis, deuteronomy] });

// 與建置產物 static/verseSearchHints.json 的 related 同形，這裡只放測試要用的幾筆。
const related: RelatedWordTable = {
  意念: ["思想", "心思"],
  思想: ["意念"],
  哪裡: ["那裡"],
  那裏: ["哪裡"],
};

describe("Verse index", () => {
  it("keeps canonical chapter order, text, and real verse numbering", () => {
    expect(corpus.map(({ id }) => id)).toEqual([
      "01-創世記/第6章#v5",
      "01-創世記/第6章#v6",
      "05-申命記/第31章#v20",
      "05-申命記/第31章#v21",
    ]);
    expect(corpus[3]).toMatchObject({ book: "申命記", chapter: 31, verse: 21 });
    expect(prepareVerseIndex({ version: 1, chapters: [] })).toEqual([]);
  });

  it("rejects invalid and duplicate chapters without creating verse IDs", () => {
    expect(() => prepareVerseIndex({ version: 2, chapters: [] })).toThrow();
    expect(() => prepareVerseIndex({ version: 1, chapters: [genesis, genesis] })).toThrow();
    expect(() =>
      prepareVerseIndex({ version: 1, chapters: [{ ...genesis, verses: [""] }] }),
    ).toThrow();
    expect(() =>
      prepareVerseIndex({ version: 1, chapters: [{ ...genesis, slug: "01-創世記/第7章" }] }),
    ).toThrow();
  });
});

describe("Verse search", () => {
  it("finds literal verse text and keeps suggested wording as its own search", () => {
    expect(searchVerses(corpus, [" 意念 "]).map(({ id }) => id)).toEqual(["05-申命記/第31章#v21"]);
    expect(getVerseSearchSuggestions("意念", undefined, false, undefined, related)).toEqual([
      "思想",
      "心思",
    ]);
    expect(getVerseSearchSuggestions("意念")).toEqual([]);
    expect(searchVerses(corpus, ["思想"]).map(({ id }) => id)).toEqual(["01-創世記/第6章#v5"]);
    expect(searchVerses(corpus, ["懷意念"])).toEqual([]);
  });

  it("supports one-character terms and adds conditions on the full, same-verse result set", () => {
    expect(searchVerses(corpus, ["他"])).toHaveLength(2);
    expect(searchVerses(corpus, ["他", "意念", "知道", "他"]).map(({ verse }) => verse)).toEqual([
      21,
    ]);
    expect(searchVerses(corpus, ["他", "意念", "別神"])).toEqual([]);
    expect(searchVerses(corpus, ["他", "別神"]).map(({ verse }) => verse)).toEqual([20]);
    expect(searchVerses(corpus, [" "])).toEqual([]);
  });

  it("is compatible by default and literal only when strict", () => {
    expect(searchVerses(corpus, ["那裏"]).map(({ text }) => text)).toEqual([
      "他們在那裡吃得飽足，轉向別神。",
    ]);
    expect(searchVerses(corpus, ["那裏"], true)).toEqual([]);
    expect(searchVerses(corpus, ["哪裏"])).toEqual([]);
    expect(searchVerses(corpus, ["祂"])).toEqual([]);
    expect(searchVerses(corpus, ["「他們在那裡吃得飽足」"])).toHaveLength(1);
    expect(getVerseSearchSuggestions("妳")).toEqual(["你"]);
    expect(getVerseSearchSuggestions("哪裡", undefined, false, undefined, related)).toEqual([
      "那裡",
    ]);
    expect(getVerseSearchSuggestions("那裏", undefined, false, undefined, related)).toEqual([
      "哪裡",
    ]);
  });

  it("splits whitespace into same-verse conditions", () => {
    expect(searchVerses(corpus, ["意念 知道"]).map(({ verse }) => verse)).toEqual([21]);
    expect(searchVerses(corpus, ["意念 別神"])).toEqual([]);
  });

  it("matches edition variants and notes", () => {
    const rows = prepareVerseIndex({
      version: 1,
      chapters: [
        {
          slug: "01-創世記/第1章",
          book: "創世記",
          chapter: 1,
          start: 1,
          verses: ["他（原文是我）必按時降雨。", "流便的後裔。"],
        },
      ],
    });
    expect(searchVerses(rows, ["他必按時"])).toHaveLength(1);
    expect(searchVerses(rows, ["呂便 后裔"])).toHaveLength(1);
    expect(searchVerses(rows, ["呂便"], true)).toHaveLength(0);
    expect(getVerseMatchRanges(rows[0]!.text, ["他必按時"])).toEqual([
      { start: 0, end: 1 },
      { start: 7, end: 10 },
    ]);
  });

  it("returns merged highlight ranges against the original text", () => {
    expect(getVerseMatchRanges("神說神說，那裡。", ["神", "神說", "那裏"])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ]);
    expect(getVerseMatchRanges("🕊️Á那裡", ["á", "哪裏", "裡"])).toEqual([
      { start: 3, end: 5 },
      { start: 6, end: 7 },
    ]);
    expect(getVerseMatchRanges("哈哈哈", ["哈哈"])).toEqual([{ start: 0, end: 3 }]);
  });
});

describe("Zero-hit rewrite", () => {
  const rows = prepareVerseIndex({
    version: 1,
    chapters: [
      {
        slug: "01-創世記/第1章",
        book: "創世記",
        chapter: 1,
        start: 1,
        verses: ["起初神創造天地。", "他瑪的兒子。", "亞斯她錄是神。"],
      },
    ],
  });

  it("rewrites 上帝 and 祂 only when nothing matched", () => {
    const god = searchVersesWithRewrite(rows, ["上帝創造"]);
    expect(god.hits).toHaveLength(1);
    expect(god.autoRewrite?.message).toBe("本站為和合本神版，以下顯示「神創造」的對應經文");
    const he = searchVersesWithRewrite(rows, ["祂瑪"]);
    expect(he.hits).toHaveLength(1);
    expect(he.autoRewrite?.message).toBe("本站和合本寫作「他瑪」，以下顯示對應經文");
    expect(searchVersesWithRewrite(rows, ["神創造"]).autoRewrite).toBeNull();
    expect(searchVersesWithRewrite(rows, ["上帝創造"], true).autoRewrite).toBeNull();
  });

  it("protects proper names that contain 她", () => {
    expect(searchVersesWithRewrite(rows, ["亞斯她錄是祂"]).hits).toEqual([]);
    expect(searchVersesWithRewrite(rows, ["亞斯她錄"]).autoRewrite).toBeNull();
  });

  it("suggests short phrases that do hit for long zero-hit sentences", () => {
    const suggestions = getVerseSearchSuggestions("起初神創造天地並且完全不存在的句子", rows);
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});

describe("Related-word chips", () => {
  it("only offers related words that hit published verses", () => {
    // 「心思」在本站經文裡沒有出現，所以不會變成提示。
    expect(getVerseSearchSuggestions("意念", corpus, false, undefined, related)).toEqual(["思想"]);
    expect(getVerseSearchSuggestions("思想", corpus, false, undefined, related)).toEqual(["意念"]);
  });

  it("looks keys up with the same normalization as the query", () => {
    const table: RelatedWordTable = { ABC: ["思想"] };
    expect(getVerseSearchSuggestions(" abc ", corpus, false, undefined, table)).toEqual(["思想"]);
    expect(getVerseSearchSuggestions("「ABC」", corpus, false, undefined, table)).toEqual(["思想"]);
  });

  it("never suggests the query itself and passes related words through the search", () => {
    const table: RelatedWordTable = { 思想: ["思想", "意念"] };
    expect(getVerseSearchSuggestions("思想", corpus, false, undefined, table)).toEqual(["意念"]);
    expect(searchVersesWithRewrite(corpus, ["意念"], false, related).suggestions).toEqual(["思想"]);
    expect(searchVersesWithRewrite(corpus, ["意念"]).suggestions).toEqual([]);
  });

  it("keeps the pronoun rules in code", () => {
    expect(getVerseSearchSuggestions("妳", undefined, false, undefined, related)).toEqual(["你"]);
  });
});

describe("Pinned verses", () => {
  const pins = [
    { query: "意念", id: "01-創世記/第6章#v5", cuv: "思想" },
    { query: "意念", id: "05-申命記/第31章#v21", cuv: "意念" },
    { query: "意念", id: "09-撒母耳記上/第1章#v1", cuv: "未發布" },
    { query: "別的詞", id: "01-創世記/第6章#v6", cuv: "後悔" },
  ];

  it("returns pinned verses for the query with the highlight word", () => {
    const pinned = selectPinnedVerses(corpus, pins, " 意念 ", new Set());
    expect(pinned.map(({ verse, cuv }) => [verse.id, cuv])).toEqual([
      ["01-創世記/第6章#v5", "思想"],
      ["05-申命記/第31章#v21", "意念"],
    ]);
  });

  it("skips verses that are already direct hits and unknown verse ids", () => {
    const pinned = selectPinnedVerses(corpus, pins, "意念", new Set(["05-申命記/第31章#v21"]));
    expect(pinned.map(({ verse }) => verse.id)).toEqual(["01-創世記/第6章#v5"]);
  });

  it("is off for strict literal matching, extra conditions and unrelated queries", () => {
    expect(selectPinnedVerses(corpus, pins, "意念", new Set(), { strictLiteral: true })).toEqual(
      [],
    );
    expect(selectPinnedVerses(corpus, pins, "意念", new Set(), { hasRefinements: true })).toEqual(
      [],
    );
    expect(selectPinnedVerses(corpus, pins, "思想", new Set())).toEqual([]);
    expect(selectPinnedVerses(corpus, pins, "  ", new Set())).toEqual([]);
  });

  it("parses the shipped payload and ignores broken rows", () => {
    expect(parseVerseSearchHints(null)).toBeNull();
    expect(parseVerseSearchHints({ version: 2 })).toBeNull();
    expect(
      parseVerseSearchHints({
        version: 1,
        related: { 意念: ["意中", 5], 壞: "x" },
        pins: [{ query: "意念", id: "a#v1", cuv: "意中" }, { query: "x" }],
      }),
    ).toEqual({
      related: { 意念: ["意中"] },
      pins: [{ query: "意念", id: "a#v1", cuv: "意中" }],
    });
  });
});
