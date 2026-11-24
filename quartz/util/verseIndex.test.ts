import test, { describe } from "node:test"
import assert from "node:assert/strict"
import type { Element, Properties, Root } from "hast"
import type { ProcessedContent } from "../plugins/vfile"
import { buildVerseIndex, buildVerseOriginalIndex } from "./verseIndex"

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
    version: 1 as const,
    attribution: "STEP Bible (CC BY 4.0)",
    lexicon: {
      H3336: ["יֵ֫צֶר", "ye.tser", "心思、意念、形態", ["意念", "思想", "惡念"]] as [
        string,
        string,
        string,
        string[],
      ],
      H8577: ["תַּנִּין", "tan.nin", "大魚、大蛇、海怪", ["大魚", "蛇", "大蛇"]] as [
        string,
        string,
        string,
        string[],
      ],
      H5175: ["נָחָשׁ", "na.chash", "蛇", ["蛇"]] as [string, string, string, string[]],
      H3605: ["כֹּל", "kol", "一切", ["一切"]] as [string, string, string, string[]],
      G3056: ["λόγος", "logos", "道、話語", ["道", "話"]] as [string, string, string, string[]],
    },
    chapters: {
      "01-創世記/第6章": {
        "5": [["H3336", "思想"]] as Array<[string, string]>,
      },
      "02-出埃及記/第7章": {
        "9": [
          ["H8577", "蛇"],
          ["H5175", "蛇"],
          ["H3605", "一切"],
        ] as Array<[string, string]>,
      },
      "43-約翰福音/第1章": {
        "1": [["G3056", "道"]] as Array<[string, string]>,
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
    const orig = buildVerseOriginalIndex(content, slugs, sampleSource)

    assert.deepEqual(Object.keys(orig.chapters), ["01-創世記/第6章", "02-出埃及記/第7章"])
    assert.equal("G3056" in orig.lexicon, false)
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
    const orig = buildVerseOriginalIndex(content, slugs, sampleSource)

    // H8577 -> tannin巨蛇 (Tier 2: first in 定義)
    assert.deepEqual(orig.entries["H8577"], {
      slug: "link_folder/原文/tannin巨蛇",
      title: "tannin巨蛇",
      isOriginalEntry: true,
    })
    // H5175 -> dedicated single-Strong 蛇的原文字義 (Tier 1 beats Tier 3 contrast mention in tannin巨蛇!)
    assert.deepEqual(orig.entries["H5175"], {
      slug: "link_folder/原文/蛇的原文字義",
      title: "蛇的原文字義",
      isOriginalEntry: true,
    })
    // H3336 -> fallback to 神學/人的全面敗壞 with isOriginalEntry: false
    assert.deepEqual(orig.entries["H3336"], {
      slug: "link_folder/神學/人的全面敗壞",
      title: "人的全面敗壞",
      isOriginalEntry: false,
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
    const orig = buildVerseOriginalIndex(content, slugs, sampleSource)

    assert.deepEqual(orig.entryAliases["龍"], ["H8577"])
    assert.deepEqual(orig.entryAliases["tannin"], ["H8577"])
    assert.equal(orig.entries["H8577"]?.slug, "link_folder/原文/tannin巨蛇")
    assert.equal(orig.entries["H5175"]?.slug, "link_folder/原文/蛇的原文字義")

    // Without a dedicated entry, a body-only mention must not become the link target.
    const onlyMention = buildVerseOriginalIndex(content.slice(1, 2), slugs, sampleSource)
    assert.equal(onlyMention.entries["H5175"], undefined)
  })
})
