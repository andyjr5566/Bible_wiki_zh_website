import assert from "node:assert/strict"
import test from "node:test"
import type { Element, ElementContent, Root, RootContent } from "hast"
import { el } from "./interactiveHast"
import {
  applyReadingLayers,
  extractCardSummary,
  isLegacyOriginalContent,
  parseVerseReference,
} from "./readingLayers"
import {
  computePopoverPlacement,
  formatSourceCardHeading,
  parseOriginalContent,
} from "./readingLayersClient"
import { loadSourceNames } from "./sourceNamesLoader"

const registry = loadSourceNames()

function collectElements(node: Root | RootContent, predicate: (el: Element) => boolean): Element[] {
  const out: Element[] = []
  function visit(current: Root | RootContent): void {
    if (current.type === "root") {
      current.children.forEach(visit)
      return
    }
    if (current.type !== "element") return
    if (predicate(current)) out.push(current)
    current.children.forEach(visit)
  }
  visit(node)
  return out
}

function hasClass(node: Element, name: string): boolean {
  const cls = node.properties?.className
  return Array.isArray(cls) && cls.map(String).includes(name)
}

function textOf(node: RootContent | ElementContent): string {
  if (node.type === "text") return node.value
  if (node.type !== "element") return ""
  return node.children.map(textOf).join("")
}

function makeChapterRoot(studyChildren: Element[]): Root {
  return {
    type: "root",
    children: [
      el("h1", { id: "創世記-第1章" }, ["創世記 第1章"]),
      el("ol", {}, [
        el("li", { id: "v1" }, ["起初，神創造天地。"]),
        el("li", { id: "v2" }, ["地是空虛混沌，淵面黑暗。"]),
      ]),
      el("hr"),
      el("h2", { id: "本章整理" }, ["本章整理"]),
      ...studyChildren,
      el("h2", { id: "附錄" }, ["附錄"]),
      el("p", {}, ["附錄提到黃迦勒但不應被處理。"]),
    ],
  }
}

function makeCallout(kind: string, title: string, body: Element[], collapsed = true): Element {
  return el(
    "blockquote",
    {
      className: ["callout", kind, ...(collapsed ? ["is-collapsible", "is-collapsed"] : [])],
      dataCallout: kind,
      ...(collapsed ? { dataCalloutFold: "" } : {}),
    },
    [
      el("div", { className: ["callout-title"] }, [
        el("div", { className: ["callout-icon"] }),
        el("div", { className: ["callout-title-inner"] }, [el("p", {}, [`${title} `])]),
        ...(collapsed ? [el("div", { className: ["fold-callout-icon", "callout-fold"] })] : []),
      ]),
      el("div", { className: ["callout-content"] }, body),
    ],
  )
}

/* ---------------- parseVerseReference ---------------- */

test("parseVerseReference handles same-chapter and cross-book formats", () => {
  assert.deepEqual(parseVerseReference("1節"), {
    kind: "same-chapter",
    label: "1節",
    verse: 1,
    rest: undefined,
  })
  assert.deepEqual(parseVerseReference("11-12節"), {
    kind: "same-chapter",
    label: "11-12節",
    verse: 11,
    rest: undefined,
  })
  assert.deepEqual(parseVerseReference("第27節"), {
    kind: "same-chapter",
    label: "27節",
    verse: 27,
    rest: undefined,
  })

  const psalm = parseVerseReference("詩33:9；另見詩33:6")
  assert.ok(psalm)
  assert.equal(psalm.kind, "cross-book")
  assert.equal(psalm.book?.name, "詩篇")
  assert.equal(psalm.chapter, 33)
  assert.equal(psalm.verse, 9)
  assert.equal(psalm.label, "詩33:9")
  assert.equal(psalm.rest, "另見詩33:6")

  const john1 = parseVerseReference("約一4:8")
  assert.equal(john1?.book?.name, "約翰一書")
  assert.equal(john1?.chapter, 4)
  assert.equal(john1?.verse, 8)

  assert.equal(parseVerseReference("bara"), null)
  assert.equal(parseVerseReference("ex nihilo"), null)
  assert.equal(parseVerseReference("詩999:1"), null)
})

/* ---------------- isLegacyOriginalContent ---------------- */

test("isLegacyOriginalContent detects Hebrew, Greek, and Strong numbers only", () => {
  assert.equal(isLegacyOriginalContent("בָּרָא，H1254A", true), true)
  assert.equal(isLegacyOriginalContent("na.gaph，H5062", true), true)
  assert.equal(isLegacyOriginalContent("λόγος", false), true)
  assert.equal(isLegacyOriginalContent("H3513", false), true)
  assert.equal(isLegacyOriginalContent("Heqet", false), false)
  assert.equal(isLegacyOriginalContent("ex nihilo", false), false)
  assert.equal(isLegacyOriginalContent("1-15節", false), false)
})

/* ---------------- applyReadingLayers：新格式（創1） ---------------- */

test("transforms scripture quotes (including nested links and 另見), sources, and layer cards", () => {
  const root = makeChapterRoot([
    el("h4", { id: "q1" }, ["「起初」是什麼時候？"]),
    el("p", {}, [
      "整章以「起初，神創造天地」（1節）開始。KingComments 說，「",
      el("a", { href: "../神的靈的角色", className: ["internal"] }, ["神的靈"]),
      "運行在水面上」（2節）；「他說有，就有，命立，就立」（",
      el("a", { href: "../詩篇33篇神話語創造", className: ["internal"] }, ["詩33:9"]),
      "；另見詩33:6）。「非經文引句」不應變色，「創造」（",
      el("em", {}, ["bara"]),
      "）也不是經文。",
    ]),
    makeCallout("original", "「創造」與「神」", [
      el("p", {}, [
        "第1節的「創造」使用動詞 בָּרָא（",
        el("span", { className: ["strong-no"] }, ["H1254A"]),
        "），意思就是「創造」。STEP 顯示另一個字。",
      ]),
    ]),
    makeCallout("background", "美索不達米亞的創世記述", [
      el("p", {}, ["《舊約背景註釋》說，美索不達米亞的創世記述是諸神爭戰的結果，與創世記完全不同。"]),
    ]),
    makeCallout("application", "從六日的復造看信徒重生的經歷", [
      el("p", {}, ["下面照黃迦勒的分法："]),
      el("ul", {}, [el("li", {}, ["第一天：聖靈運行與蒙光照"])]),
    ]),
    el("table", {}, [
      el("thead", {}, [el("tr", {}, [el("th", {}, ["黃迦勒（標頭不標）"])])]),
      el("tbody", {}, [el("tr", {}, [el("td", {}, ["拾穗收錄的《丁道爾》"])])]),
    ]),
    el("pre", {}, [el("code", { className: ["mermaid"] }, ["flowchart TD\nA[黃迦勒]"])]),
    el("p", {}, [
      el("strong", {}, ["參考資料"]),
      el("br"),
      "代號：CT＝黃迦勒",
      el("br"),
      el("a", { href: "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01CT01.htm" }, [
        "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01CT01.htm",
      ]),
      el("br"),
      el("a", { href: "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01GT01.htm" }, [
        "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01GT01.htm",
      ]),
      el("br"),
      el("a", { href: "https://www.kingcomments.com/en/bible-studies/Gen/1" }, [
        "https://www.kingcomments.com/en/bible-studies/Gen/1",
      ]),
    ]),
  ])

  const applied = applyReadingLayers(root, {
    slug: "01-創世記/第1章",
    registry,
    existingSlugs: new Set(["01-創世記/第1章", "02-出埃及記/第12章"]),
  })
  assert.equal(applied, true)

  // 問題式 h4 加上 bwz-rl-q
  const h4s = collectElements(root, (n) => n.tagName === "h4")
  assert.equal(hasClass(h4s[0], "bwz-rl-q"), true)

  // 經文原句：三處命中，不含「非經文引句」與「創造」（bara）
  const quotes = collectElements(root, (n) => hasClass(n, "bwz-rl-quote"))
  assert.deepEqual(quotes.map(textOf), [
    "「起初，神創造天地」",
    "「神的靈運行在水面上」",
    "「他說有，就有，命立，就立」",
  ])

  // 經節小標籤：1節、2節、詩33:9（保留原連結）
  const vrefs = collectElements(root, (n) => hasClass(n, "bwz-rl-vref"))
  assert.deepEqual(
    vrefs.map((v) => ({ text: textOf(v), href: v.properties.href, verse: v.properties.dataRlVerse })),
    [
      { text: "1節", href: "#v1", verse: "1" },
      { text: "2節", href: "#v2", verse: "2" },
      { text: "詩33:9", href: "../詩篇33篇神話語創造", verse: undefined },
    ],
  )
  // 「；另見詩33:6」保留在原句後
  const firstP = collectElements(root, (n) => n.tagName === "p")[0]
  assert.ok(textOf(firstP).includes("（另見詩33:6）"))

  // 新格式卡片內的原文不收成「原文」標籤
  const origChips = collectElements(root, (n) => hasClass(n, "bwz-rl-orig-chip"))
  assert.equal(origChips.length, 0)

  // 三張分層卡片：類別、摘要、原文頁尾、無障礙屬性
  const cards = collectElements(root, (n) => hasClass(n, "bwz-rl-card"))
  assert.equal(cards.length, 3)
  assert.equal(hasClass(cards[0], "bwz-rl-card-original"), true)
  assert.equal(hasClass(cards[1], "bwz-rl-card-background"), true)
  assert.equal(hasClass(cards[2], "bwz-rl-card-application"), true)

  const attribs = collectElements(root, (n) => hasClass(n, "bwz-rl-card-attrib"))
  assert.equal(attribs.length, 1)
  assert.equal(textOf(attribs[0]), "出處：STEP Bible（CC BY 4.0）")

  const summaries = collectElements(root, (n) => hasClass(n, "bwz-rl-card-summary"))
  assert.equal(summaries.length, 3)
  assert.ok(textOf(summaries[2]).includes("第一天"))

  // 來源名稱：不含 th、mermaid、參考資料、附錄
  const srcs = collectElements(root, (n) => hasClass(n, "bwz-rl-src"))
  assert.deepEqual(srcs.map(textOf), [
    "KingComments",
    "STEP",
    "《舊約背景註釋》",
    "黃迦勒",
    "拾穗",
    "《丁道爾》",
  ])

  // 隱藏資料節點：帶參考網址且拾穗各家共用拾穗網址
  const meta = collectElements(root, (n) => hasClass(n, "bwz-rl-meta"))[0]
  assert.ok(meta)
  const payload = JSON.parse(String(meta.properties.dataRlSources))
  assert.equal(payload.sourcesHref, "../資料來源")
  assert.equal(payload.entries["黃迦勒"].url, "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01CT01.htm")
  assert.equal(payload.entries["《丁道爾》"].url, "https://www.ccbiblestudy.org/Old%20Testament/01Gen/01GT01.htm")
  assert.equal(payload.entries["KingComments"].url, "https://www.kingcomments.com/en/bible-studies/Gen/1")
})

/* ---------------- applyReadingLayers：舊格式（出8） ---------------- */

test("handles legacy format: original chips, legacy codes, cross-book pills, and keeps [!note] untouched", () => {
  const root = makeChapterRoot([
    makeCallout(
      "note",
      "為什麼是青蛙？",
      [el("p", {}, ["CT與《啟導本》都提到青蛙。KC 指出這是審判。"])],
      false,
    ),
    el("p", {}, [
      "第1節耶和華吩咐摩西（שַׁלַּח אֶת־עַמִּי，",
      el("span", { className: ["strong-no"] }, ["H7971"]),
      " 搭配 ",
      el("span", { className: ["strong-no"] }, ["H5647"]),
      "）。原文 נָגַף（",
      el("em", {}, ["na.gaph"]),
      "，",
      el("span", { className: ["strong-no"] }, ["H5062"]),
      "）可繙成「擊打」（賽19:22）或「擊殺」（出12:13,23）。",
    ]),
    el("p", {}, [
      el("strong", {}, ["②「我觀看你指頭所造的天」"]),
      "（詩8:3）",
    ]),
  ])

  const applied = applyReadingLayers(root, {
    slug: "02-出埃及記/第8章",
    registry,
    existingSlugs: new Set(["02-出埃及記/第8章", "02-出埃及記/第12章"]),
  })
  assert.equal(applied, true)

  // 一般 [!note] callout 不轉成分層卡片，但裡面文字的來源名稱仍要標記
  assert.equal(collectElements(root, (n) => hasClass(n, "bwz-rl-card")).length, 0)
  const srcs = collectElements(root, (n) => hasClass(n, "bwz-rl-src"))
  assert.deepEqual(
    srcs.map((s) => ({ text: textOf(s), code: s.properties.dataRlCode, id: s.properties.dataRlSrc })),
    [
      { text: "CT", code: "CT", id: "黃迦勒" },
      { text: "《啟導本》", code: undefined, id: "《啟導本》" },
      { text: "KC", code: "KC", id: "KingComments" },
    ],
  )

  // 兩個舊格式原文括號收成「原文」按鈕
  const chips = collectElements(root, (n) => hasClass(n, "bwz-rl-orig-chip"))
  assert.equal(chips.length, 2)
  assert.equal(chips[0].properties.dataRlOrig, "שַׁלַּח אֶת־עַמִּי，H7971 搭配 H5647")
  assert.equal(chips[1].properties.dataRlOrig, "na.gaph，H5062")

  // 他卷經文：出12:13,23 有頁面成連結，賽19:22、詩8:3 無頁面成靜態標籤不生死連結
  const vrefs = collectElements(root, (n) => hasClass(n, "bwz-rl-vref"))
  assert.deepEqual(
    vrefs.map((v) => ({ tag: v.tagName, text: textOf(v), href: v.properties.href })),
    [
      { tag: "span", text: "賽19:22", href: undefined },
      { tag: "a", text: "出12:13,23", href: "../02-出埃及記/第12章#v13" },
      { tag: "span", text: "詩8:3", href: undefined },
    ],
  )
})

/* ---------------- 範圍隔離：非章節頁與無整理章節頁 ---------------- */

test("does not touch non-chapter pages or chapters without 本章整理", () => {
  const entryPage: Root = {
    type: "root",
    children: [
      el("h1", {}, ["創造"]),
      el("h2", {}, ["本章整理"]),
      el("p", {}, ["黃迦勒說「起初」（1節）。"]),
    ],
  }
  assert.equal(
    applyReadingLayers(entryPage, {
      slug: "link_folder/神學/創造",
      registry,
      existingSlugs: new Set(),
    }),
    false,
  )
  assert.equal(collectElements(entryPage, (n) => hasClass(n, "bwz-rl-src")).length, 0)

  const chapterNoStudy: Root = {
    type: "root",
    children: [
      el("h1", {}, ["創世記 第2章"]),
      el("ol", {}, [el("li", {}, ["天地萬物都造齊了。"])]),
      el("p", {}, ["黃迦勒不該在這裡被改動。"]),
    ],
  }
  assert.equal(
    applyReadingLayers(chapterNoStudy, {
      slug: "01-創世記/第2章",
      registry,
      existingSlugs: new Set(),
    }),
    false,
  )
})

/* ---------------- Client pure helpers ---------------- */

test("parseOriginalContent splits leading Hebrew/Greek cleanly without mangling inline Hebrew", () => {
  const a = parseOriginalContent("נֹגֵף אֶת־כָּל־גְּבוּלְךָ，H5062 搭配 H6854")
  assert.deepEqual(a.script, { text: "נֹגֵף אֶת־כָּל־גְּבוּלְךָ", dir: "rtl", lang: "he" })
  assert.deepEqual(a.detailTokens, [
    { kind: "strong", value: "H5062" },
    { kind: "text", value: " 搭配 " },
    { kind: "strong", value: "H6854" },
  ])

  const b = parseOriginalContent("וְשַׂמְתִּי פְדֻת，原文名詞 פְּדוּת，H6304，有『贖價』之意")
  assert.equal(b.script?.text, "וְשַׂמְתִּי פְדֻת")
  assert.equal(
    b.detailTokens.map((t) => t.value).join(""),
    "原文名詞 פְּדוּת，H6304，有『贖價』之意",
  )

  const c = parseOriginalContent("na.gaph，H5062")
  assert.equal(c.script, undefined)
  assert.deepEqual(c.detailTokens, [
    { kind: "text", value: "na.gaph，" },
    { kind: "strong", value: "H5062" },
  ])
})

test("formatSourceCardHeading and computePopoverPlacement cover code titles and viewport clamping", () => {
  assert.deepEqual(formatSourceCardHeading({ name: "黃迦勒", title: "黃迦勒《解經系列》" }, "CT"), {
    heading: "CT＝黃迦勒",
    subtitle: "黃迦勒《解經系列》",
  })
  assert.deepEqual(formatSourceCardHeading({ name: "康來昌", title: "康來昌" }), {
    heading: "康來昌",
    subtitle: undefined,
  })

  const below = computePopoverPlacement({
    anchorLeft: 320,
    anchorTop: 120,
    anchorBottom: 145,
    popoverWidth: 336,
    popoverHeight: 160,
    viewportWidth: 390,
    viewportHeight: 844,
    scrollX: 0,
    scrollY: 500,
  })
  assert.equal(below.placedAbove, false)
  assert.equal(below.left, 42) // 390 - 336 - 12
  assert.equal(below.top, 653) // 145 + 8 + 500

  const above = computePopoverPlacement({
    anchorLeft: 40,
    anchorTop: 720,
    anchorBottom: 745,
    popoverWidth: 300,
    popoverHeight: 180,
    viewportWidth: 1440,
    viewportHeight: 820,
    scrollX: 0,
    scrollY: 100,
  })
  assert.equal(above.placedAbove, true)
  assert.equal(above.top, 632) // 720 - 8 - 180 + 100
})

test("extractCardSummary keeps short first sentence intact and truncates long paragraphs cleanly", () => {
  const shortContent = el("div", {}, [el("p", {}, ["「運行」的原文是 מְרַחֶפֶת，意思是盤旋。"])])
  assert.equal(extractCardSummary(shortContent), "「運行」的原文是 מְרַחֶפֶת，意思是盤旋。")

  const longContent = el("div", {}, [
    el("p", {}, [
      "這是一段非常長非常長而且遠超過摘要上限字數的歷史文化背景說明，後面還有許多細節與古代近東文獻比較。",
    ]),
  ])
  const summary = extractCardSummary(longContent, 20)
  assert.ok(summary.endsWith("…"))
  assert.ok([...summary].length <= 21)
})
