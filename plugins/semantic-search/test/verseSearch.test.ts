import { describe, expect, it } from "vitest";
import {
  getVerseMatchRanges,
  getVerseSearchSuggestions,
  prepareVerseIndex,
  searchVerses,
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

  it("only folds enabled character forms and leaves pronouns and questions distinct", () => {
    expect(searchVerses(corpus, ["那裏"])).toEqual([]);
    expect(searchVerses(corpus, ["那裏"], true).map(({ text }) => text)).toEqual([
      "他們在那裡吃得飽足，轉向別神。",
    ]);
    expect(searchVerses(corpus, ["哪裏"], true)).toEqual([]);
    expect(searchVerses(corpus, ["祂"], true)).toEqual([]);
    expect(getVerseSearchSuggestions("妳")).toEqual(["你"]);
    expect(getVerseSearchSuggestions("哪裡")).toEqual([]);
  });

  it("returns merged highlight ranges against the original text", () => {
    expect(getVerseMatchRanges("神說神說，那裡。", ["神", "神說", "那裏"], true)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ]);
    expect(getVerseMatchRanges("🕊️A\u0301那裡", ["á", "哪裏", "裡"], true)).toEqual([
      { start: 3, end: 5 },
      { start: 6, end: 7 },
    ]);
    expect(getVerseMatchRanges("哈哈哈", ["哈哈"])).toEqual([{ start: 0, end: 3 }]);
  });
});
