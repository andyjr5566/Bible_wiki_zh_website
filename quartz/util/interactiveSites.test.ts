import assert from "node:assert/strict"
import test from "node:test"
import {
  axisGroups,
  bookByName,
  buildRegistry,
  checkRegistry,
  coverFileName,
  coverageByBook,
  deepLinkFor,
  deriveSite,
  extractDescription,
  extractTitle,
  formatRanges,
  parseAppendixChapters,
  parseChapterRefs,
  sitesForChapter,
  wideSites,
} from "./interactiveSites"
import type { ChapterRef, InteractiveSite, SiteFiles, SiteOverride } from "./interactiveSites"

function makeHtml(title: string, description: string): string {
  return `<title>${title}</title><meta name="description" content="${description}">`
}

function refs(book: string, chapters: number[]): string[] {
  return chapters.map((chapter) => `${book}/第${chapter}章`)
}

const lawAppendix = [
  ...refs("創世記", [1, 2, 9, 17, 32]),
  ...refs("出埃及記", [12, 13, 16, 19, 20, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 34, 35]),
  ...refs("利未記", [1, 2, 3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]),
  ...refs("民數記", [5, 6, 8, 9, 10, 15, 18, 19, 27, 28, 29, 30, 31, 33, 35, 36]),
  ...refs("申命記", [
    4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 31,
  ]),
]

const overrides: Record<string, SiteOverride> = {
  "摩西五經/律法地圖": {
    type: "查詢工具",
    deepLink: "#/ref/{short}{chapter}",
    deepLabel: "直接跳到「{book} {chapter} 章」的律法",
  },
  "摩西五經/耶和華的節期": { type: "年曆導覽" },
  "全聖經/亞當到耶穌": {
    type: "家譜",
    extraChapters: [
      "創世記/第4-5章",
      "創世記/第10-11章",
      "創世記/第22章",
      "創世記/第25章",
      "創世記/第29章",
      "創世記/第35-36章",
      "創世記/第46章",
      "出埃及記/第6章",
      "路得記/第4章",
      "撒母耳記上/第14章",
      "撒母耳記下/第3章",
      "撒母耳記下/第5章",
      "列王紀上/第4章",
      "歷代志上/第1-9章",
      "歷代志上/第11-27章",
      "歷代志下/第11章",
      "歷代志下/第21章",
      "歷代志下/第24章",
      "以斯拉記/第2章",
      "以斯拉記/第7-8章",
      "以斯拉記/第10章",
      "尼希米記/第3章",
      "尼希米記/第7章",
      "尼希米記/第10-12章",
      "馬太福音/第1章",
      "路加福音/第3章",
    ],
  },
  "創世記/第6章": { type: "場景導覽" },
  "出埃及記/第25章": { type: "場景導覽" },
  "利未記/第1章": { type: "場景導覽" },
  "利未記/第11章": { type: "場景導覽" },
  "民數記/第2章": { type: "互動地圖" },
  "民數記/第33章": { type: "互動地圖" },
}

const realFiles: SiteFiles[] = [
  {
    key: "全聖經/亞當到耶穌",
    indexHtml: makeHtml("從亞當到耶穌｜家譜畫布", "沿著聖經記載，從亞當看見通往耶穌的家譜與支系。"),
    appendixChapters: { toc_only: true, chapters: ["創世記/第5章", "創世記/第11章"] },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "出埃及記/第25章",
    indexHtml: makeHtml(
      "照山上的樣式",
      "出埃及記 25–27 章互動導覽：照經文的尺寸和材料，從東門一路走到約櫃。",
    ),
    appendixChapters: ["第26章", "第27章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "利未記/第11章",
    indexHtml: makeHtml("潔淨與不潔淨", "利未記 11–15 章互動導覽：跟著營中一戶人家看潔淨。"),
    appendixChapters: ["第12章", "第13章", "第14章", "第15章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "利未記/第1章",
    indexHtml: makeHtml("會幕前的一天", "利未記 1–9 章互動導覽：五種獻祭、燔祭壇與第一批祭司。"),
    appendixChapters: ["第2章", "第3章", "第4章", "第5章", "第6章", "第7章", "第8章", "第9章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "創世記/第6章",
    indexHtml: makeHtml("方舟", "創世記 6–9 章沉浸式導覽：挪亞、方舟、洪水與雲中的虹。"),
    appendixChapters: ["第7章", "第8章", "第9章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "摩西五經/律法地圖",
    indexHtml: makeHtml("摩西五經的律法", "摩西五經的律法，一條一條附上和合本經文。"),
    appendixChapters: { toc_only: true, chapters: lawAppendix },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "摩西五經/耶和華的節期",
    indexHtml: makeHtml("耶和華的節期", "順著一年，走過摩西五經裡神定下的節期。"),
    appendixChapters: {
      toc_only: true,
      chapters: [
        "出埃及記/第12章",
        "出埃及記/第13章",
        "出埃及記/第20章",
        "出埃及記/第23章",
        "出埃及記/第34章",
        "利未記/第16章",
        "利未記/第23章",
        "利未記/第25章",
        "民數記/第9章",
        "民數記/第28章",
        "民數記/第29章",
        "申命記/第15章",
        "申命記/第16章",
        "申命記/第31章",
      ],
    },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "民數記/第2章",
    indexHtml: makeHtml("環繞會幕", "民數記 2 章互動地圖：十二支派安營，以及民數記 10 章拔營次序。"),
    appendixChapters: ["第10章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "民數記/第33章",
    indexHtml: makeHtml("曠野四十二站", "民數記 33 章互動旅程地圖：從蘭塞到摩押平原的四十二站。"),
    appendixChapters: undefined,
    hasDist: true,
    hasCover: true,
  },
]

test("extractTitle takes the text before either vertical bar and normalizes whitespace", () => {
  assert.equal(extractTitle("<title>從亞當到耶穌｜家譜畫布</title>"), "從亞當到耶穌")
  assert.equal(extractTitle("<title> 方舟 | 互動導覽 </title>"), "方舟")
  assert.equal(extractTitle("<title>\n  多行\n  標題  | 第二部分\n</title>"), "多行 標題")
  assert.equal(extractTitle("<html><body>沒有標題</body></html>"), null)
})

test("extractDescription accepts attribute order, quote style, and HTML entities", () => {
  assert.equal(
    extractDescription('<meta content="A &amp; B &quot;quote&quot; &#39; &lt;x&gt;" name="description">'),
    "A & B \"quote\" ' <x>",
  )
  assert.equal(
    extractDescription("<meta name='description' content='雙引號 &quot; 和單引號 &#39;'>"),
    "雙引號 \" 和單引號 '",
  )
  assert.equal(extractDescription("<meta name='keywords' content='其他'><title>標題</title>"), null)
})

test("parseChapterRefs handles context books, full references, and bounded ranges", () => {
  const genesis = bookByName("創世記")
  assert.ok(genesis)
  assert.deepEqual(parseChapterRefs("第12章", genesis), [{ book: 1, chapter: 12 }])
  assert.deepEqual(parseChapterRefs("第12章"), [])
  assert.deepEqual(parseChapterRefs("出埃及記/第20章"), [{ book: 2, chapter: 20 }])
  assert.deepEqual(parseChapterRefs("歷代志上/第1-9章"), Array.from({ length: 9 }, (_, index) => ({
    book: 13,
    chapter: index + 1,
  })))
  assert.deepEqual(parseChapterRefs("第1–9章", genesis), Array.from({ length: 9 }, (_, index) => ({
    book: 1,
    chapter: index + 1,
  })))
  assert.deepEqual(parseChapterRefs("創世記/第51章"), [])
  assert.deepEqual(parseChapterRefs("亂寫", genesis), [])
})

test("parseAppendixChapters handles arrays, toc-only objects, and malformed data", () => {
  assert.deepEqual(parseAppendixChapters(["第1章", "第2章"]), {
    refs: ["第1章", "第2章"],
    tocOnly: false,
    warnings: [],
  })
  assert.deepEqual(parseAppendixChapters({ toc_only: true, chapters: ["創世記/第5章"] }), {
    refs: ["創世記/第5章"],
    tocOnly: true,
    warnings: [],
  })
  assert.deepEqual(parseAppendixChapters({ chapters: "第1章" }), {
    refs: [],
    tocOnly: false,
    warnings: ["附錄章節物件的 chapters 欄位不是陣列"],
  })
  assert.deepEqual(parseAppendixChapters(null).refs, [])
  assert.deepEqual(parseAppendixChapters(12).refs, [])
  assert.deepEqual(parseAppendixChapters(["第1章", 7, null]).warnings, [
    "附錄章節第 2 項不是有效的文字",
    "附錄章節第 3 項不是有效的文字",
  ])
})

test("deriveSite builds all nine real-site descriptions and chapter coverage", () => {
  const registry = buildRegistry(realFiles, overrides)
  const byKey = new Map(registry.sites.map((site) => [site.key, site]))

  assert.equal(registry.sites.length, 9)
  assert.equal(byKey.get("創世記/第6章")?.title, "方舟")
  assert.equal(byKey.get("創世記/第6章")?.description.startsWith("創世記 6–9 章"), true)
  assert.equal(byKey.get("創世記/第6章")?.scope, "narrow")
  assert.deepEqual(byKey.get("創世記/第6章")?.primary, { book: 1, chapter: 6 })
  assert.deepEqual(
    byKey.get("創世記/第6章")?.chapters,
    [6, 7, 8, 9].map((chapter) => ({ book: 1, chapter })),
  )
  assert.equal(byKey.get("民數記/第33章")?.chapters.length, 1)
  assert.deepEqual(byKey.get("民數記/第33章")?.chapters, [{ book: 4, chapter: 33 }])

  const lawMap = byKey.get("摩西五經/律法地圖")
  assert.ok(lawMap)
  assert.equal(lawMap.scope, "wide")
  assert.equal(lawMap.primary, undefined)
  assert.equal(lawMap.chapters.length, 88)
  assert.deepEqual(
    coverageByBook(lawMap).map(({ book, count }) => [book.name, count]),
    [["創世記", 5], ["出埃及記", 17], ["利未記", 25], ["民數記", 16], ["申命記", 25]],
  )

  const genealogy = byKey.get("全聖經/亞當到耶穌")
  assert.ok(genealogy)
  assert.equal(genealogy.scope, "wide")
  for (const ref of [
    { book: 8, chapter: 4 },
    { book: 13, chapter: 1 },
    { book: 13, chapter: 9 },
    { book: 13, chapter: 11 },
    { book: 13, chapter: 27 },
    { book: 40, chapter: 1 },
    { book: 42, chapter: 3 },
  ]) {
    assert.ok(genealogy.chapters.some((chapter) => chapter.book === ref.book && chapter.chapter === ref.chapter))
  }
  assert.equal(genealogy.chapters.filter((chapter) => chapter.book === 1 && chapter.chapter === 5).length, 1)
  assert.equal(genealogy.chapters.filter((chapter) => chapter.book === 1 && chapter.chapter === 11).length, 1)
  assert.deepEqual(
    coverageByBook(genealogy).map(({ book }) => book.name),
    ["創世記", "出埃及記", "路得記", "撒母耳記上", "撒母耳記下", "列王紀上", "歷代志上", "歷代志下", "以斯拉記", "尼希米記", "馬太福音", "路加福音"],
  )

  assert.equal(byKey.get("創世記/第6章")?.type, "場景導覽")
  assert.equal(byKey.get("摩西五經/律法地圖")?.type, "查詢工具")
  assert.equal(byKey.get("民數記/第33章")?.type, "互動地圖")
  assert.equal(byKey.get("創世記/第6章")?.coverPath, "static/interactive-covers/創世記-第6章.webp")
  assert.equal(byKey.get("創世記/第6章")?.entryPath, "static/website/創世記/第6章/dist/index.html")
  assert.equal(coverFileName("創世記/第6章"), "創世記-第6章.webp")

  const withoutOverride = deriveSite(
    {
      key: "創世記/第1章",
      indexHtml: makeHtml("創世記第一章", "描述"),
      appendixChapters: undefined,
      hasDist: true,
      hasCover: false,
    },
  )
  assert.equal(withoutOverride.site.type, undefined)
})

test("buildRegistry warns about missing override keys and sorts by key", () => {
  const files = ["z/網站", "a/網站", "m/網站"].map((key) => ({
    key,
    indexHtml: makeHtml(key, "描述"),
    appendixChapters: undefined,
    hasDist: true,
    hasCover: true,
  }))
  const registry = buildRegistry(files, { "不存在/網站": { type: "場景導覽" } })
  assert.deepEqual(registry.sites.map((site) => site.key), ["a/網站", "m/網站", "z/網站"])
  assert.ok(registry.warnings.some((warning) => warning.includes("不存在/網站")))
})

test("chapter selection uses scope, coverage size, and stable title and key tie-breaks", () => {
  const registry = buildRegistry(realFiles, overrides)
  const names = (ref: ChapterRef): string[] =>
    sitesForChapter(registry.sites, ref).map((site) => site.title)

  assert.deepEqual(names({ book: 2, chapter: 12 }), ["耶和華的節期", "摩西五經的律法"])
  assert.deepEqual(names({ book: 2, chapter: 25 }), ["照山上的樣式", "摩西五經的律法"])
  assert.deepEqual(names({ book: 1, chapter: 6 }), ["方舟"])
  assert.deepEqual(names({ book: 1, chapter: 5 }), ["從亞當到耶穌"])
  assert.deepEqual(names({ book: 1, chapter: 9 }), ["方舟", "摩西五經的律法"])
  assert.deepEqual(names({ book: 5, chapter: 1 }), [])

  const tieSites: InteractiveSite[] = Array.from({ length: 40 }, (_, index) => ({
    key: `site-${String(index).padStart(2, "0")}`,
    title: ["乙站", "甲站", "丙站", "甲站"][index % 4],
    description: "",
    hasTitle: true,
    scope: "narrow",
    chapters: [{ book: 1, chapter: 1 }],
    entryPath: "",
    coverPath: "",
    hasCover: false,
    hasDist: true,
  }))
  const expected = [...tieSites].sort(
    (a, b) => a.title.localeCompare(b.title, "zh-Hant") || a.key.localeCompare(b.key, "zh-Hant"),
  )
  assert.deepEqual(sitesForChapter(tieSites, { book: 1, chapter: 1 }), expected)
  assert.deepEqual(sitesForChapter(tieSites, { book: 1, chapter: 1 }), expected)
})

test("coverage formatting and site grouping follow Bible-book order", () => {
  assert.equal(formatRanges([]), "")
  assert.equal(formatRanges([3]), "3")
  assert.equal(formatRanges([1, 2, 3, 5, 7, 8]), "1–3、5、7–8")
  assert.equal(formatRanges([8, 3, 2, 3, 7, 1, 5]), "1–3、5、7–8")

  const registry = buildRegistry(realFiles, overrides)
  const wide = wideSites(registry.sites)
  assert.deepEqual(wide.map((site) => site.title), ["摩西五經的律法", "從亞當到耶穌", "耶和華的節期"])

  const groups = axisGroups(registry.sites)
  assert.deepEqual(groups.map((group) => group.book.name), ["創世記", "出埃及記", "利未記", "民數記"])
  assert.deepEqual(
    groups.find((group) => group.book.name === "利未記")?.items.map((item) => item.site.title),
    ["會幕前的一天", "潔淨與不潔淨"],
  )
  assert.deepEqual(
    groups.find((group) => group.book.name === "民數記")?.items.map((item) => item.site.title),
    ["環繞會幕", "曠野四十二站"],
  )
})

test("deepLinkFor substitutes book tokens and checkRegistry reports incomplete sites", () => {
  const registry = buildRegistry(realFiles, overrides)
  const lawMap = registry.sites.find((site) => site.key === "摩西五經/律法地圖")
  const ark = registry.sites.find((site) => site.key === "創世記/第6章")
  assert.ok(lawMap)
  assert.ok(ark)
  assert.deepEqual(deepLinkFor(lawMap, { book: 2, chapter: 25 }), {
    hash: "#/ref/出25",
    label: "直接跳到「出埃及記 25 章」的律法",
  })
  assert.equal(deepLinkFor(ark, { book: 1, chapter: 6 }), null)

  const incomplete = deriveSite({
    key: "民數記/第33章",
    indexHtml: null,
    appendixChapters: undefined,
    hasDist: false,
    hasCover: false,
  }).site
  const messages = checkRegistry({ sites: [incomplete], warnings: [] })
  assert.ok(messages.some((message) => message.includes("民數記/第33章") && message.includes("dist")))
  assert.ok(messages.some((message) => message.includes("民數記/第33章") && message.includes("封面")))
  assert.ok(messages.some((message) => message.includes("民數記/第33章") && message.includes("type")))
  assert.ok(messages.some((message) => message.includes("民數記/第33章") && message.includes("description")))
})

test("deriveSite drops out-of-range chapters and records a warning", () => {
  const { site, warnings } = deriveSite({
    key: "創世記/第6章",
    indexHtml: makeHtml("方舟", "描述"),
    appendixChapters: ["第51章", "亂寫"],
    hasDist: true,
    hasCover: true,
  })
  assert.deepEqual(site.chapters, [{ book: 1, chapter: 6 }])
  assert.ok(warnings.some((warning) => warning.includes("超出創世記的章數")))
  assert.ok(warnings.some((warning) => warning.includes("無法辨識章節")))
})
