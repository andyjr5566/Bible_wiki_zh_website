import test, { describe } from "node:test"
import assert from "node:assert/strict"
import type { Element, Properties, Root } from "hast"
import type { ProcessedContent } from "../plugins/vfile"
import {
  buildVerseIndex,
  buildVerseOriginalIndex,
  chooseShardCount,
  fnv1a32,
  shardOf,
} from "./verseIndex"

function h(tagName: string, textOrChildren: string | Element[], props: Properties = {}): Element {
  return {
    type: "element",
    tagName,
    properties: props,
    children:
      typeof textOrChildren === "string"
        ? [{ type: "text", value: textOrChildren }]
        : textOrChildren,
  }
}

function makePage(
  slug: string,
  children: Element[],
  frontmatter?: Record<string, unknown>,
): ProcessedContent {
  const tree: Root = { type: "root", children }
  const file = {
    data: {
      slug,
      frontmatter,
    },
  } as unknown as ProcessedContent[1]
  return [tree, file]
}

describe("buildVerseOriginalIndex", () => {
  const sampleSource = {
    version: 2 as const,
    attribution: "STEP Bible (CC BY 4.0)",
    lexicon: {
      H3336: ["יֵ֫צֶר", "ye.tser"] as [string, string],
      H8577: ["תַּנִּין", "tan.nin"] as [string, string],
      H5175: ["נָחָשׁ", "na.chash"] as [string, string],
      H3605: ["כֹּל", "kol"] as [string, string],
      G3056: ["λόγος", "logos"] as [string, string],
    },
    chapters: {
      "01-創世記/第6章": {
        "5": [["H3336", "思想", "H3336.1"]] as Array<[string, string, string]>,
      },
      "02-出埃及記/第7章": {
        "9": [
          ["H8577", "蛇", "H8577.1"],
          ["H5175", "蛇", "H5175.1"],
          ["H3605", "一切", "H3605"],
        ] as Array<[string, string, string]>,
      },
      "43-約翰福音/第1章": {
        "1": [["G3056", "道", "G3056.1"]] as Array<[string, string, string]>,
      },
    },
  }

  test("crops chapters and lexicon strictly to published chapters", () => {
    const content: ProcessedContent[] = [
      makePage("01-創世記/第6章", [h("ol", [h("li", "終日所思想的盡都是惡")], { start: 5 })]),
      makePage("02-出埃及記/第7章", [h("ol", [h("li", "使杖變作蛇")], { start: 9 })]),
    ]
    const { index } = buildVerseIndex(content)
    const slugs = new Set(index.chapters.map((c) => c.slug))
    const { index: orig, shards } = buildVerseOriginalIndex(content, slugs, sampleSource)

    assert.deepEqual(Object.keys(orig.senses).sort(), ["H3336.1", "H3605", "H5175.1", "H8577.1"])
    assert.equal("G3056" in orig.lexicon, false)
    assert.equal(orig.version, 2)
    assert.equal(shards.length, orig.shards)
    assert.equal("H3336" in orig.lexicon, true)
    assert.equal("H8577" in orig.lexicon, true)
  })

  test("prioritizes 原文 entries over contrast mentions, suppresses H3605 helper, and falls back to 神學", () => {
    const content: ProcessedContent[] = [
      makePage(
        "link_folder/原文/tannin巨蛇",
        [
          h("h2", "定義"),
          h("p", "出7:9–12的 תַּנִּין（H8577）與出4:3的 נָחָשׁ（H5175）及 H3605 不同。"),
        ],
        { aliases: ["tannin", "水怪", "巨蛇"] },
      ),
      makePage("link_folder/原文/蛇的原文字義", [
        h("h2", "定義"),
        h("p", "נָחָשׁ（H5175）指一般的蛇。"),
      ]),
      makePage("link_folder/神學/人的全面敗壞", [
        h("h2", "定義"),
        h("p", "創6:5的『意念』（יֵצֶר，H3336）指人心所塑之念。"),
      ]),
    ]

    const slugs = new Set(["01-創世記/第6章", "02-出埃及記/第7章"])
    const { index: orig } = buildVerseOriginalIndex(content, slugs, sampleSource)

    // H8577 -> tannin巨蛇 (Tier 2: first in 定義)
    assert.deepEqual(orig.entries["H8577"], {
      slug: "link_folder/原文/tannin巨蛇",
      title: "tannin巨蛇",
      isHeadword: true,
    })
    // H5175 -> dedicated single-Strong 蛇的原文字義 (Tier 1 beats Tier 3 contrast mention in tannin巨蛇!)
    assert.deepEqual(orig.entries["H5175"], {
      slug: "link_folder/原文/蛇的原文字義",
      title: "蛇的原文字義",
      isHeadword: true,
    })
    // H3336 -> fallback to 神學/人的全面敗壞 with isOriginalEntry: false
    assert.deepEqual(orig.entries["H3336"], {
      slug: "link_folder/神學/人的全面敗壞",
      title: "人的全面敗壞",
      isHeadword: false,
    })
    // H3605 helper suppressed
    assert.equal(orig.entries["H3605"], undefined)
    // Aliases from tannin巨蛇 mapped to primary Strong's
    assert.deepEqual(orig.entryAliases["水怪"], ["H8577"])
  })
  test("aliases bind only to the head Strong; comparison mentions do not link; single-Strong entry wins tier 1", () => {
    const content: ProcessedContent[] = [
      makePage(
        "link_folder/原文/tannin巨蛇",
        [
          h("h2", "定義"),
          h("p", "出7:9–12的 תַּנִּין（H8577）與出4:3的 נָחָשׁ（H5175）不是同一個詞。"),
        ],
        { aliases: ["tannin", "龍"] },
      ),
      makePage("link_folder/原文/只提到蛇", [
        h("h2", "定義"),
        h("p", "此詞指大魚。"),
        h("h2", "備註"),
        h("p", "可與 H5175 對照。"),
      ]),
      makePage("link_folder/原文/蛇的原文字義", [
        h("h2", "定義"),
        h("p", "נָחָשׁ（H5175）指一般的蛇。"),
      ]),
    ]
    const slugs = new Set(["02-出埃及記/第7章"])
    const { index: orig } = buildVerseOriginalIndex(content, slugs, sampleSource)

    assert.deepEqual(orig.entryAliases["龍"], ["H8577"])
    assert.deepEqual(orig.entryAliases["tannin"], ["H8577"])
    assert.equal(orig.entries["H8577"]?.slug, "link_folder/原文/tannin巨蛇")
    assert.equal(orig.entries["H5175"]?.slug, "link_folder/原文/蛇的原文字義")

    // Without a dedicated entry, a body-only mention must not become the link target.
    const onlyMention = buildVerseOriginalIndex(content.slice(1, 2), slugs, sampleSource).index
    assert.equal(onlyMention.entries["H5175"], undefined)
  })
})

describe("verse original shards", () => {
  test("fnv1a32 test vectors (the front end must match)", () => {
    assert.equal(fnv1a32(""), 2166136261)
    assert.equal(fnv1a32("a"), 3826002220)
    assert.equal(fnv1a32("H5375.6"), 2239234535)
    assert.equal(shardOf("H5375.6", 2), 1)
    assert.equal(shardOf("H5375.6", 1), 0)
    // UTF-16 code units, not bytes or code points
    assert.equal(fnv1a32("心"), fnv1a32("\u5fc3"))
  })

  test("chooseShardCount stays within the target and grows with size", () => {
    const small = new Map([["H1.1", 1000]])
    assert.equal(chooseShardCount(small), 1)
    const big = new Map<string, number>()
    for (let i = 0; i < 3000; i++) big.set(`H${i}.1`, 500)
    const shards = chooseShardCount(big, 150 * 1024)
    assert.ok(shards >= Math.ceil((3000 * 500) / (150 * 1024)))
    const sizes = new Array(shards).fill(2)
    for (const [k, n] of big) sizes[shardOf(k, shards)] += n + 1
    assert.ok(Math.max(...sizes) <= 150 * 1024)
  })

  test("senses: counts, none, shard placement, chapter order", () => {
    const source = {
      version: 2 as const,
      attribution: "x",
      lexicon: { H5375: ["נשא", "na.sa"] as [string, string] },
      chapters: {
        "01-創世記/第10章": { "1": [["H5375", "赦免", "H5375.6"]] as Array<[string, string, string]> },
        "01-創世記/第2章": {
          "3": [["H5375", "饒恕", "H5375.6"]] as Array<[string, string, string]>,
          "10": [["H5375", "赦免", "H5375.6"], ["H5375", "", "H5375.6"]] as Array<
            [string, string, string]
          >,
        },
      },
    }
    const slugs = new Set(Object.keys(source.chapters))
    const { index, shards } = buildVerseOriginalIndex([], slugs, source)
    assert.deepEqual(index.senses["H5375.6"], [
      4,
      1,
      [
        ["赦免", 2],
        ["饒恕", 1],
      ],
    ])
    const occ = shards[shardOf("H5375.6", index.shards)]!["H5375.6"]!
    // 第2章 before 第10章, verses numeric; empty renderings are not listed
    assert.deepEqual(occ, [
      ["01-創世記/第2章", 3, "饒恕"],
      ["01-創世記/第2章", 10, "赦免"],
      ["01-創世記/第10章", 1, "赦免"],
    ])
  })
})

describe("verse original sense tuples", () => {
  test("ties keep first-occurrence order and all renderings are kept", () => {
    const source = {
      version: 2 as const,
      attribution: "x",
      lexicon: { H1: ["a", "b"] as [string, string] },
      chapters: {
        "01-創世記/第1章": {
          "1": [["H1", "乙", "H1.1"], ["H1", "甲", "H1.1"], ["H1", "甲", "H1.1"], ["H1", "丙", "H1.1"]] as Array<
            [string, string, string]
          >,
        },
      },
    }
    const { index } = buildVerseOriginalIndex([], new Set(["01-創世記/第1章"]), source)
    assert.deepEqual(index.senses["H1.1"], [
      4,
      0,
      [
        ["甲", 2],
        ["乙", 1],
        ["丙", 1],
      ],
    ])
  })
})
