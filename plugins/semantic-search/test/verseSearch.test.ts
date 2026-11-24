import { describe, expect, it } from "vitest";
import {
  findOriginalLanguageStudyGroups,
  getVerseMatchRanges,
  getVerseSearchSuggestions,
  prepareVerseIndex,
  searchVerses,
  searchVersesWithRewrite,
  type VerseOriginalIndex,
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
    expect(getVerseSearchSuggestions("意念")).toEqual(["思想"]);
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
    expect(getVerseSearchSuggestions("哪裡")).toEqual(["那裡"]);
    expect(getVerseSearchSuggestions("那裏")).toEqual(["哪裡"]);
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

describe("Original-language study groups", () => {
  const rows = prepareVerseIndex({
    version: 1,
    chapters: [
      {
        slug: "01-創世記/第6章",
        book: "創世記",
        chapter: 6,
        start: 5,
        verses: ["所思想的盡都是惡，"],
      },
      {
        slug: "05-申命記/第31章",
        book: "申命記",
        chapter: 31,
        start: 21,
        verses: ["他們所懷的意念我都知道了。"],
      },
    ],
  });
  const index: VerseOriginalIndex = {
    version: 1,
    attribution: "STEP Bible",
    lexicon: { H3336: ["יֵצֶר", "yetser", "意念、傾向", ["意念", "思想"]] },
    chapters: {
      "01-創世記/第6章": { "5": [["H3336", "思想"]] },
      "05-申命記/第31章": { "21": [["H3336", "意念"]] },
    },
    entries: { H3336: { slug: "link_folder/原文/yetser", title: "יֵצֶר", isOriginalEntry: true } },
  };

  it("shows other renderings when direct hits exist", () => {
    const direct = new Set(["05-申命記/第31章#v21"]);
    const [group] = findOriginalLanguageStudyGroups(rows, index, "意念", direct);
    expect(group?.hits.map(({ verse, rendering }) => [verse.id, rendering])).toEqual([
      ["01-創世記/第6章#v5", "思想"],
    ]);
    expect(group?.autoOpen).toBe(false);
    expect(group?.entryLink?.isOriginalEntry).toBe(true);
  });

  it("keeps everything and opens the group when there are no direct hits", () => {
    const [group] = findOriginalLanguageStudyGroups(rows, index, "意念", new Set());
    expect(group?.hits).toHaveLength(2);
    expect(group?.autoOpen).toBe(true);
  });

  it("returns nothing for missing index, long, or unknown queries", () => {
    expect(findOriginalLanguageStudyGroups(rows, null, "意念", new Set())).toEqual([]);
    expect(
      findOriginalLanguageStudyGroups(rows, index, "完全不相關的長句子查詢", new Set()),
    ).toEqual([]);
    expect(findOriginalLanguageStudyGroups(rows, index, "不存在", new Set())).toEqual([]);
  });
});
