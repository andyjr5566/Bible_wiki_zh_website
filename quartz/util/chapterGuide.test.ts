import assert from "node:assert/strict"
import test from "node:test"
import {
  activeOutlineIndex,
  activeVerseOutlineIndex,
  buildGuideSources,
  buildLegendItems,
  computeScrollTargetTop,
  extractTextOutline,
  parseOutlineFromTableRows,
  parseVerseOutlineLine,
  resolveSourcesHrefFromSlug,
} from "./chapterGuide"

test("buildLegendItems：沒有的項目不列，完全無標記時回傳空陣列", () => {
  assert.deepEqual(
    buildLegendItems({ hasQuotes: false, hasSources: false, hasOrigChips: false, hasCards: false }),
    [],
  )

  const normalChapter = buildLegendItems({
    hasQuotes: true,
    hasSources: true,
    hasOrigChips: true,
    hasCards: false,
  })
  assert.deepEqual(
    normalChapter.map((i) => i.key),
    ["quote", "src", "orig"],
  )
  assert.equal(normalChapter[0].text, "褐色字＝聖經原句（後面的小標籤是節數）")
  assert.equal(normalChapter[1].text, "虛線名字＝點了看是哪本註釋")
  assert.equal(normalChapter[2].text, "「原文」小按鈕＝點了看希伯來字與編號")

  const withCards = buildLegendItems({
    hasQuotes: true,
    hasSources: true,
    hasOrigChips: true,
    hasCards: true,
  })
  assert.equal(withCards.length, 4)
  assert.equal(withCards[3].text, "原文／背景／應用卡片＝想深入再點開")
})

test("parseVerseOutlineLine 與 parseOutlineFromTableRows：解析清單與表格經節範圍", () => {
  assert.deepEqual(parseVerseOutlineLine("1. 約瑟帶二子見病中的父親（1-2節）"), {
    label: "約瑟帶二子見病中的父親（1-2節）",
    startVerse: 1,
    endVerse: 2,
  })
  assert.deepEqual(parseVerseOutlineLine("應許歸回，並使約瑟多得一分 (21–22節)"), {
    label: "應許歸回，並使約瑟多得一分（21–22節）",
    startVerse: 21,
    endVerse: 22,
  })
  assert.equal(parseVerseOutlineLine("全章總論（全章）"), null)
  assert.equal(parseVerseOutlineLine("沒有節數的小標題"), null)

  const tableOutline = parseOutlineFromTableRows([
    ["節數", "段落內容"],
    ["1-5節", "第一天的創造"],
    ["6-8節", "第二天分開上下諸水"],
  ])
  assert.deepEqual(
    tableOutline.map((o) => ({ label: o.label, startVerse: o.startVerse, endVerse: o.endVerse })),
    [
      { label: "第一天的創造（1-5節）", startVerse: 1, endVerse: 5 },
      { label: "第二天分開上下諸水（6-8節）", startVerse: 6, endVerse: 8 },
    ],
  )
})

test("extractTextOutline：經文大綱清單優先於表格與小節標題", () => {
  const preferList = extractTextOutline({
    outlineListItems: ["1. 約瑟探望雅各（1-2節）", "2. 重申伯特利之約（3-7節）"],
    tableRows: [["1-7節", "第一段"]],
    subHeadings: [{ id: "h1", text: "一、從伯特利的應許說起 (1-7節)" }],
  })
  assert.equal(preferList.length, 2)
  assert.equal(preferList[0].label, "約瑟探望雅各（1-2節）")

  const fallbackTable = extractTextOutline({
    outlineListItems: [],
    tableRows: [["1-2節", "起初的空虛混沌"], ["3-5節", "第一日：造光"]],
    subHeadings: [{ id: "h1", text: "一、第一日 (3-5節)" }],
  })
  assert.equal(fallbackTable.length, 2)
  assert.equal(fallbackTable[1].startVerse, 3)

  const fallbackSubheadings = extractTextOutline({
    outlineListItems: [],
    tableRows: [],
    subHeadings: [
      { id: "sec1", text: "一、起初與神創造天地 (1-2節)" },
      { id: "sec2", text: "神學重點" },
      { id: "sec3", text: "二、光與暗分開 (3-5節)" },
    ],
  })
  assert.deepEqual(
    fallbackSubheadings.map((x) => ({ id: x.id, start: x.startVerse, end: x.endVerse })),
    [
      { id: "sec1", start: 1, end: 2 },
      { id: "sec3", start: 3, end: 5 },
    ],
  )
})

test("buildGuideSources 與 resolveSourcesHrefFromSlug：清理來源並排除重複與不安全連結", () => {
  const payload = JSON.stringify({
    sourcesHref: "../資料來源",
    order: ["黃迦勒", "黃迦勒", "周安娜"],
    entries: {
      黃迦勒: {
        name: "黃迦勒",
        title: "基督徒文摘解經系列",
        note: "華人牧者逐章查經講義",
        kind: "work",
        code: "CT",
      },
      周安娜: {
        name: "周安娜",
        title: "基督徒文摘解經",
        note: "",
        kind: "work",
        url: "https://example.org/study",
      },
    },
  })
  const summary = buildGuideSources(payload, "01-創世記/第48章")
  assert.equal(summary.sourcesHref, "../資料來源")
  assert.equal(summary.entries.length, 2)
  assert.equal(summary.entries[0].name, "黃迦勒")
  assert.equal(summary.externalUrl, "https://example.org/study")

  assert.equal(resolveSourcesHrefFromSlug("01-創世記/第48章"), "../%E8%B3%87%E6%96%99%E4%BE%86%E6%BA%90")
  assert.equal(buildGuideSources(null, "01-創世記/第48章").entries.length, 0)
  assert.equal(
    buildGuideSources(
      JSON.stringify({
        order: ["x"],
        entries: { x: { name: "x", title: "t", note: "", kind: "work", url: "javascript:alert(1)" } },
      }),
      "01-創世記/第48章",
    ).externalUrl,
    undefined,
  )
})

test("activeOutlineIndex、activeVerseOutlineIndex 與 computeScrollTargetTop", () => {
  assert.equal(activeOutlineIndex([], 120), -1)
  assert.equal(activeOutlineIndex([200, 500, 900], 140), 0)
  assert.equal(activeOutlineIndex([50, 120, 480], 140), 1)
  assert.equal(activeOutlineIndex([-300, -100, 100], 140), 2)

  const items = [
    { id: "a", label: "A（1-2節）", startVerse: 1, endVerse: 2 },
    { id: "b", label: "B（3-7節）", startVerse: 3, endVerse: 7 },
    { id: "c", label: "C（8-12節）", startVerse: 8, endVerse: 12 },
  ]
  assert.equal(activeVerseOutlineIndex(items, null), 0)
  assert.equal(activeVerseOutlineIndex(items, 5), 1)
  assert.equal(activeVerseOutlineIndex(items, 12), 2)

  assert.equal(
    computeScrollTargetTop({ elementTop: 420, scrollY: 1000, obstructionBottom: 64, margin: 12 }),
    1344,
  )
  assert.equal(
    computeScrollTargetTop({ elementTop: 20, scrollY: 10, obstructionBottom: 80, margin: 12 }),
    0,
  )
})
