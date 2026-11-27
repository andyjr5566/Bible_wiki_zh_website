import { describe, expect, it } from "vitest";
import {
  bookRangeLabel,
  buildBarSegments,
  buildRenderingChips,
  defaultChipIndex,
  describeBar,
  findOriginalCardPlans,
  otherSensesOf,
  allRenderingsContainQuery,
  queryRenderingCount,
  senseLabel,
  parseOriginalIndex,
  pickAlternateVerse,
  pickFoundVerse,
  senseVerses,
  shardIndexFor,
  stableHash,
  versesForChip,
  type OriginalIndex,
} from "../src/components/originalStudy";
import { prepareVerseIndex } from "../src/components/verseSearch";

const index: OriginalIndex = {
  version: 2,
  shards: 4,
  lexicon: {
    H5375: ["נָשָׂא", "na.sa"],
    H5545: ["סָלַח", "sa.lach"],
    H3605: ["כֹּל", "kol"],
    H3820: ["לֵב", "lev"],
  },
  senses: {
    "H5375.6": {
      sid: "H5375",
      label: "赦免、饒恕",
      total: 11,
      none: 0,
      renderings: [
        ["赦免", 6],
        ["饒恕", 5],
      ],
    },
    "H5375.1": { sid: "H5375", label: "擔當", total: 36, none: 0, renderings: [["擔當", 36]] },
    "H5545.1": {
      sid: "H5545",
      label: "赦免、饒恕",
      total: 20,
      none: 0,
      renderings: [
        ["蒙赦免", 10],
        ["赦免", 9],
        ["饒恕", 1],
      ],
    },
    "H3605.1": { sid: "H3605", label: "一切", total: 300, none: 0, renderings: [["一切", 200]] },
    "H3820.1": {
      sid: "H3820",
      label: "心",
      total: 66,
      none: 8,
      renderings: [
        ["心", 48],
        ["胸", 3],
        ["心裡", 2],
        ["心意", 2],
        ["懷中", 1],
        ["內", 1],
        ["中", 1],
      ],
    },
  },
  entries: { H5375: { slug: "原文/nasa", title: "נָשָׂא", isHeadword: true } },
};

describe("shard hash", () => {
  it("is FNV-1a 32-bit over UTF-16 code units (test vectors shared with the emitter)", () => {
    expect(stableHash("")).toBe(2166136261);
    expect(stableHash("a")).toBe(3826002220);
    expect(stableHash("H5375")).toBe(3798184039);
    expect(stableHash("H5375.6")).toBe(2239234535);
    expect(shardIndexFor("H5375.6", 4)).toBe(2239234535 % 4);
    expect(shardIndexFor("H5375.6", 0)).toBe(0);
  });
});

describe("findOriginalCardPlans", () => {
  it("finds senses whose rendering matches, ordered by total desc", () => {
    expect(findOriginalCardPlans(index, "赦免").map((plan) => plan.senseKey)).toEqual([
      "H5545.1",
      "H5375.6",
    ]);
  });

  it("requires the rendering to appear at least twice", () => {
    expect(findOriginalCardPlans(index, "懷中")).toEqual([]);
    expect(findOriginalCardPlans(index, "蒙赦免").map((plan) => plan.senseKey)).toEqual([
      "H5545.1",
    ]);
  });

  it("skips single characters, long queries and excluded Strongs", () => {
    expect(findOriginalCardPlans(index, "心")).toEqual([]);
    expect(findOriginalCardPlans(index, "赦免赦免赦免赦免赦免")).toEqual([]);
    expect(findOriginalCardPlans(index, "一切")).toEqual([]);
  });

  it("forces bridged or aliased Strongs, preferring the sense that matches the query", () => {
    // 橋接詞「赦免」指定 na.sa：用譯法含「赦免」的那個意思，不是處數最多的「擔當」
    expect(findOriginalCardPlans(index, "赦免").map((plan) => plan.senseKey)).not.toContain(
      "H5375.1",
    );
    const aliased: OriginalIndex = { ...index, entryAliases: { nasa: ["H5375"] } };
    expect(findOriginalCardPlans(aliased, "nasa")).toEqual([
      { senseKey: "H5375.1", isForced: true },
    ]);
    const bySlug: OriginalIndex = { ...index, entryAliases: { nasa: ["原文/nasa"] } };
    expect(findOriginalCardPlans(bySlug, "nasa")[0]?.senseKey).toBe("H5375.1");
  });

  it("limits to three cards", () => {
    expect(findOriginalCardPlans(index, "赦免", 1)).toHaveLength(1);
  });
});

describe("chips and bar", () => {
  it("merges renderings beyond the limit into 其他", () => {
    const chips = buildRenderingChips(index.senses["H3820.1"]!, "心意");
    expect(chips.map((chip) => [chip.label, chip.count])).toEqual([
      ["心", 48],
      ["胸", 3],
      ["心裡", 2],
      ["心意", 2],
      ["其他", 3],
    ]);
    expect(chips[4]?.renderings).toEqual(["懷中", "內", "中"]);
    expect(chips.map((chip) => chip.containsQuery)).toEqual([false, false, false, true, false]);
  });

  it("defaults to the most frequent rendering without the query", () => {
    const chips = buildRenderingChips(index.senses["H5545.1"]!, "赦免");
    expect(chips[defaultChipIndex(chips)]?.label).toBe("饒恕");
    const all = buildRenderingChips(index.senses["H5375.6"]!, "赦免饒恕");
    expect(defaultChipIndex(all)).toBe(0);
  });

  it("describes the bar in text including the not-translated share", () => {
    const sense = index.senses["H3820.1"]!;
    const chips = buildRenderingChips(sense, "心意");
    const text = describeBar(buildBarSegments(sense, chips));
    expect(text).toContain("心 48 處");
    expect(text).toContain("未直接譯出 8 處");
    expect(text).not.toMatch(/H\d/);
  });
});

describe("comparison verses", () => {
  const verses = prepareVerseIndex({
    version: 1,
    chapters: [
      { slug: "01-創世記/第1章", book: "創世記", chapter: 1, start: 1, verses: ["甲", "乙", "丙"] },
      { slug: "06-約書亞記/第1章", book: "約書亞記", chapter: 1, start: 1, verses: ["丁"] },
    ],
  });
  const map = new Map(verses.map((verse) => [verse.id, verse]));
  const entries = [
    ["01-創世記/第1章", 1, "赦免"],
    ["01-創世記/第1章", 1, "赦免"],
    ["01-創世記/第1章", 2, "饒恕"],
    ["01-創世記/第1章", 3, "饒恕"],
    ["z", 9, "饒恕"],
  ] as const;

  it("drops duplicates and verses missing from the verse index", () => {
    expect(senseVerses(entries, map).map((verse) => verse.id)).toEqual([
      "01-創世記/第1章#v1",
      "01-創世記/第1章#v2",
      "01-創世記/第1章#v3",
    ]);
    expect(senseVerses(undefined, map)).toEqual([]);
  });

  it("picks the found verse from direct hits and alternates by chip", () => {
    const list = senseVerses(entries, map);
    const found = pickFoundVerse(list, new Set(["01-創世記/第1章#v1"]), "赦免");
    expect(found?.id).toBe("01-創世記/第1章#v1");
    expect(pickFoundVerse(list, new Set(["06-約書亞記/第1章#v1"]), "赦免")).toBeNull();
    const chips = buildRenderingChips(
      {
        sid: "H1",
        label: "x",
        total: 4,
        none: 0,
        renderings: [
          ["赦免", 2],
          ["饒恕", 2],
        ],
      },
      "赦免",
    );
    const candidates = versesForChip(list, chips[1]!);
    expect(candidates.map((verse) => verse.id)).toEqual([
      "01-創世記/第1章#v2",
      "01-創世記/第1章#v3",
    ]);
    expect(pickAlternateVerse(candidates, found, 0)?.id).toBe("01-創世記/第1章#v2");
    expect(pickAlternateVerse(candidates, found, 1)?.id).toBe("01-創世記/第1章#v3");
    expect(pickAlternateVerse(candidates, found, 2)?.id).toBe("01-創世記/第1章#v2");
    expect(pickAlternateVerse([], null, 0)).toBeNull();
  });

  it("derives the book range from the verse index", () => {
    expect(bookRangeLabel(verses)).toBe("創世記～約書亞記");
    expect(bookRangeLabel(verses.slice(0, 2))).toBe("創世記");
    expect(bookRangeLabel([])).toBe("");
  });
});

describe("other senses and parsing", () => {
  it("lists other senses of the same word by total desc", () => {
    expect(otherSensesOf(index, "H5375.6")).toEqual([
      { senseKey: "H5375.1", label: "擔當", total: 36 },
    ]);
    expect(otherSensesOf(index, "H3820.1")).toEqual([]);
  });

  it("rejects other versions and parses the compact sense format", () => {
    expect(parseOriginalIndex({ version: 1 })).toBeNull();
    expect(parseOriginalIndex(null)).toBeNull();
    const parsed = parseOriginalIndex({
      version: 2,
      shards: 2,
      lexicon: { H5375: ["נָשָׂא", "na.sa"] },
      senses: {
        "H5375.6": [
          11,
          1,
          [
            ["饒恕", 5],
            ["赦免", 6],
            ["", 0],
          ],
        ],
      },
      entries: { H5375: { slug: "x", title: "y", isHeadword: true } },
    });
    expect(parsed?.senses["H5375.6"]).toEqual({
      sid: "H5375",
      label: "赦免、饒恕",
      total: 11,
      none: 1,
      renderings: [
        ["赦免", 6],
        ["饒恕", 5],
        ["", 0],
      ],
    });
    expect(parsed?.entries?.H5375?.isHeadword).toBe(true);
  });
});

describe("ordering, labels and single-rendering senses", () => {
  const mk = (sid: string, total: number, renderings: Array<[string, number]>) => ({
    sid,
    label: "",
    total,
    none: 0,
    renderings,
  });
  const idx: OriginalIndex = {
    version: 2,
    shards: 1,
    lexicon: { H1: ["a", "a"], H2: ["b", "b"], H3: ["c", "c"] },
    senses: {
      "H1.1": mk("H1", 238, [
        ["日", 230],
        ["時候", 3],
        ["天", 5],
      ]),
      "H2.1": mk("H2", 100, [
        ["時候", 8],
        ["時", 50],
      ]),
      "H3.1": mk("H3", 20, [
        ["日子", 10],
        ["時候", 3],
      ]),
    },
  };

  it("orders cards by how often the query itself is the rendering, then by total", () => {
    expect(queryRenderingCount(idx.senses["H2.1"]!, "時候")).toBe(8);
    // 「時」只是包含查詢詞的另一寫法，不算在內；H1 與 H3 同為 3 處，H1 總處數大所以在前
    expect(findOriginalCardPlans(idx, "時候").map((plan) => plan.senseKey)).toEqual([
      "H2.1",
      "H1.1",
      "H3.1",
    ]);
  });

  it("skips renderings that contain a shorter one when building labels", () => {
    expect(
      senseLabel([
        ["蒙赦免", 10],
        ["赦免", 9],
        ["饒恕", 1],
      ]),
    ).toBe("赦免、饒恕");
    expect(
      senseLabel([
        ["心", 5],
        ["胸", 2],
      ]),
    ).toBe("心、胸");
    expect(
      senseLabel([
        ["", 3],
        ["赦免", 2],
      ]),
    ).toBe("赦免");
  });

  it("detects senses whose every rendering contains the query", () => {
    const only = buildRenderingChips(
      { sid: "H9", label: "", total: 2, none: 0, renderings: [["赦免", 2]] },
      "赦免",
    );
    expect(allRenderingsContainQuery(only)).toBe(true);
    expect(allRenderingsContainQuery(buildRenderingChips(idx.senses["H2.1"]!, "時候"))).toBe(false);
    expect(allRenderingsContainQuery([])).toBe(false);
  });

  it("never offers the found verse as the alternate", () => {
    const only = [{ id: "x#v1", slug: "x", verse: 1, rendering: "赦免" }];
    expect(pickAlternateVerse(only, only[0]!, 0)).toBeNull();
  });
});
