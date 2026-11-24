import { describe, expect, it } from "vitest";
import {
  cleanSearchQuery,
  expandCompatibleTerms,
  buildProjection,
  findTextMatchRanges,
  fastNorm,
  generalNorm,
} from "../src/components/textMatcher";

const slice = (text: string, terms: string[], strict = false) =>
  findTextMatchRanges(text, terms, strict).map(({ start, end }) => text.slice(start, end));

describe("cleanSearchQuery", () => {
  it("strips outer quotes and copied verse numbers", () => {
    expect(cleanSearchQuery("「你們要將我這些話」")).toBe("你們要將我這些話");
    expect(cleanSearchQuery("“『要有光』”")).toBe("要有光");
    expect(cleanSearchQuery("18 你們要將我這話")).toBe("你們要將我這話");
    expect(cleanSearchQuery("18、你們要")).toBe("你們要");
    expect(cleanSearchQuery("  3:16 ")).toBe("3:16");
    expect(cleanSearchQuery("18abc")).toBe("18abc");
  });
});

describe("projection", () => {
  it("keeps one range per UTF-16 unit, including Plane-2 characters", () => {
    const text = "趟過𧼮Á";
    const p = buildProjection(text, false, { ranges: true });
    expect(p.unitRanges).toHaveLength(p.norm.length);
    const strict = buildProjection("蹚𧼮", true, { ranges: true });
    expect(strict.unitRanges).toHaveLength(strict.norm.length);
  });

  it("folds 蹚 to 𧼮 and highlights the original slice", () => {
    expect(slice("他蹚過江河", ["𧼮過"])).toEqual(["蹚過"]);
    expect(slice("他𧼮過江河", ["蹚過"])).toEqual(["𧼮過"]);
    expect(slice("樹𣎴上", ["樹墩子"])).toEqual([]);
    expect(slice("樹𣎴子上", ["樹墩子"])).toEqual(["樹𣎴子"]);
  });
});

describe("lineBreaks projection", () => {
  it("keeps one sentinel per run of line breaks and drops other whitespace", () => {
    const norm = (text: string, ranges = false) =>
      buildProjection(text, false, { lineBreaks: true, ranges }).norm;
    expect(norm("神\n\n 愛 世，人\r\n")).toBe("神\n愛世人\n");
    expect(buildProjection("神\n愛", false).norm).toBe("神愛");
    expect(norm("神\n愛", true)).toBe("神\n愛");
  });
});

describe("expandCompatibleTerms", () => {
  it("returns only the strict form in strict mode", () => {
    expect(expandCompatibleTerms("西奈山", true)).toEqual(["西奈山"]);
  });
  it("expands proper-name and edition equivalents", () => {
    expect(expandCompatibleTerms("西奈山", false)).toEqual(["西奈山", "西乃山"]);
    expect(expandCompatibleTerms("幼發拉底河", false)).toEqual([
      "幼發拉底河",
      "伯拉大河",
      "伯拉河",
    ]);
    expect(expandCompatibleTerms("呂便", false)).toContain("流便");
    expect(expandCompatibleTerms("趟過江河", false)).toContain("𧼮過江河");
  });
  it("folds simplified forms and drops punctuation", () => {
    expect(expandCompatibleTerms("后裔", false)[0]).toBe("後裔");
    expect(expandCompatibleTerms("蔥", false)[0]).toBe("葱");
    expect(expandCompatibleTerms("「要有光」", false)).toEqual(["要有光"]);
  });
});

describe("findTextMatchRanges", () => {
  it("ignores punctuation and connectors in compatible mode only", () => {
    expect(slice("耶和華─你的神說", ["耶和華你的神"])).toEqual(["耶和華─你的神"]);
    expect(slice("要有光", ["「要有光」"])).toEqual(["要有光"]);
    expect(slice("耶和華─你的神", ["耶和華你的神"], true)).toEqual([]);
  });

  it("keeps variants distinct in strict mode", () => {
    expect(slice("在那裡", ["那裏"])).toEqual(["那裡"]);
    expect(slice("在那裡", ["那裏"], true)).toEqual([]);
    expect(slice("流便的子孫", ["呂便"])).toEqual(["流便"]);
    expect(slice("流便的子孫", ["呂便"], true)).toEqual([]);
  });

  it("splits ranges around inline translator notes", () => {
    const a = "他（原文是我）必按時";
    expect(findTextMatchRanges(a, ["他必按時"])).toEqual([
      { start: 0, end: 1 },
      { start: 7, end: 10 },
    ]);
    const b = "扶助[原文是引領]寡婦";
    expect(slice(b, ["扶助寡婦"])).toEqual(["扶助", "寡婦"]);
    const c = "得（或作：成）了基業";
    expect(slice(c, ["得了基業"])).toEqual(["得", "了基業"]);
  });

  it("still matches text that sits inside a note", () => {
    expect(slice("（原文作：產業）", ["產業"])).toEqual(["產業"]);
  });

  it("merges overlapping matches", () => {
    expect(findTextMatchRanges("神說神說，那裡。", ["神", "神說", "那裏"])).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 5, end: 7 },
    ]);
    expect(findTextMatchRanges("哈哈哈", ["哈哈"])).toEqual([{ start: 0, end: 3 }]);
  });
});

describe("fastNorm", () => {
  const samples = [
    "",
    "耶穌說：「你們要愛人。」\n\n第二行  ，\r\n第三行\n",
    "趟過𧼮𣎴蹚 Plane-2 與 Ext-B 𧼮\u{1d400}\u{10400}",
    "宝石和圣灵，简体词组：约翰福音 约书亚记 以色列 ISRAEL Σίσυφος İstanbul",
    "Café á é́ ë ZWJ 👨‍👩‍👧 combining",
    "（原文：ἀγάπη）【註】[原文abc] 全形　空白\ttab nbsp",
    "lone \ud800 high and \udc00 low, ok \ud800x",
    "\n\n\n開頭換行\n\n中間\n結尾\n\n",
    "ＡＢＣ ａｂｃ １２３ ﬁ ǅ ß",
  ];
  for (const lineBreaks of [false, true]) {
    it(`matches the general path (lineBreaks=${lineBreaks})`, () => {
      for (const sample of samples) {
        expect(fastNorm(sample, lineBreaks)).toBe(generalNorm(sample, lineBreaks));
      }
      const big = samples.join("\n").repeat(500);
      expect(fastNorm(big, lineBreaks)).toBe(generalNorm(big, lineBreaks));
    });
    it(`matches the ranges projection (lineBreaks=${lineBreaks})`, () => {
      for (const sample of samples) {
        if (/[̀-ͯ‍]|[\ud83c-\ud83f]/.test(sample)) continue;
        expect(buildProjection(sample, false, { lineBreaks }).norm).toBe(
          buildProjection(sample, false, { lineBreaks, ranges: true }).norm,
        );
      }
    });
  }
});
