import assert from "node:assert/strict"
import test from "node:test"
import type { Element, ElementContent, Root } from "hast"
import {
  applyInteractiveSites,
  describeChapterNodes,
  el,
  HUB_SLUG,
} from "./interactiveHast"
import {
  buildRegistry,
  sitesForChapter,
} from "./interactiveSites"
import type {
  SiteFiles,
  SiteOverride,
} from "./interactiveSites"

function html(title: string, description: string): string {
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
  ...refs("申命記", [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 31]),
]

const files: SiteFiles[] = [
  {
    key: "全聖經/亞當到耶穌",
    indexHtml: html("從亞當到耶穌", "從亞當看見通往耶穌的家譜與支系。"),
    appendixChapters: { toc_only: true, chapters: ["創世記/第5章", "創世記/第11章"] },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "出埃及記/第25章",
    indexHtml: html("照山上的樣式", "出埃及記 25–27 章互動導覽。"),
    appendixChapters: ["第26章", "第27章"],
    hasDist: true,
    hasCover: true,
  },
  {
    key: "利未記/第1章",
    indexHtml: html("會幕前的一天", "利未記 1–9 章互動導覽。"),
    appendixChapters: refs("利未記", [2, 3, 4, 5, 6, 7, 8, 9]),
    hasDist: true,
    hasCover: true,
  },
  {
    key: "利未記/第11章",
    indexHtml: html("潔淨與不潔淨", "利未記 11–15 章互動導覽。"),
    appendixChapters: refs("利未記", [12, 13, 14, 15]),
    hasDist: true,
    hasCover: true,
  },
  {
    key: "創世記/第6章",
    indexHtml: html("方舟", "挪亞、方舟、洪水與雲中的虹。"),
    appendixChapters: ["第7章", "第8章", "第9章"],
    hasDist: true,
    hasCover: false,
  },
  {
    key: "摩西五經/律法地圖",
    indexHtml: html("摩西五經的律法", "按經文查閱摩西五經的律法。"),
    appendixChapters: { toc_only: true, chapters: lawAppendix },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "摩西五經/耶和華的節期",
    indexHtml: html("耶和華的節期", "沿著經文看節期。"),
    appendixChapters: {
      toc_only: true,
      chapters: [
        ...refs("出埃及記", [12, 13, 20, 23, 34]),
        ...refs("利未記", [16, 23, 25]),
        ...refs("民數記", [9, 28, 29]),
        ...refs("申命記", [15, 16, 31]),
      ],
    },
    hasDist: true,
    hasCover: true,
  },
  {
    key: "民數記/第2章",
    indexHtml: html("環繞會幕", "看十二支派如何安營。"),
    appendixChapters: ["第10章"],
    hasDist: true,
    hasCover: false,
  },
  {
    key: "民數記/第33章",
    indexHtml: html("曠野四十二站", "沿著曠野路線探索。"),
    appendixChapters: undefined,
    hasDist: true,
    hasCover: false,
  },
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
    extraChapters: ["創世記/第4章", "出埃及記/第6章", "路得記/第4章", "路加福音/第3章"],
  },
  "創世記/第6章": { type: "場景導覽" },
  "出埃及記/第25章": { type: "場景導覽" },
  "利未記/第1章": { type: "場景導覽" },
  "利未記/第11章": { type: "場景導覽" },
  "民數記/第2章": { type: "互動地圖" },
  "民數記/第33章": { type: "互動地圖" },
}

const registry = buildRegistry(files, overrides)
const existingSlugs = new Set([
  "01-創世記/第6章",
  "02-出埃及記/第12章",
  "02-出埃及記/第25章",
  "03-利未記/第1章",
  "03-利未記/第11章",
  "04-民數記/第2章",
])

function text(value: string): ElementContent {
  return { type: "text", value }
}

function spaced(nodes: Element[]): Root {
  const children: Root["children"] = []
  nodes.forEach((node, index) => {
    if (index) children.push(text("\n"))
    children.push(node)
  })
  return { type: "root", children }
}

function heading(tag: "h1" | "h2" | "h3", title: string): Element {
  return el(tag, { id: title }, [
    title,
    el("a", {
      role: "anchor",
      "aria-hidden": "true",
      href: `#${title}`,
      className: ["internal", "internal-link"],
    }, [el("svg", {}, [])]),
  ])
}

function nav(): Element {
  return el("div", { className: ["table-container"] }, [
    el("table", {}, [el("tr", {}, [
      el("th", {}, ["前一章"]),
      el("th", {}, ["回目錄"]),
      el("th", {}, ["下一章"]),
    ])]),
  ])
}

function mapList(label: string): Element {
  return el("ul", {}, [el("li", {}, [label])])
}

function chapterPage(
  book: string,
  chapter: number,
  options: {
    appendix?: boolean
    oldInteractive?: string
    bottomNav?: boolean
    verseList?: boolean
  } = {},
): Root {
  const nodes: Element[] = [
    heading("h1", `${book} 第${chapter}章`),
    nav(),
  ]
  if (options.verseList !== false) {
    nodes.push(el("ol", {}, [
      el("li", {}, ["耶和華曉諭摩西說："]),
      el("li", {}, ["百姓聽見了。"]),
    ]))
  }
  nodes.push(
    el("hr"),
    heading("h2", "本章知識節點"),
    heading("h3", "神學"),
    mapList("原有知識節點"),
    el("hr"),
    heading("h2", "本章整理"),
    el("p", {}, ["原有整理內容"]),
  )
  if (options.appendix !== false) {
    nodes.push(
      heading("h2", "附錄"),
      heading("h3", "相關地圖"),
      mapList("原有地圖"),
    )
    if (options.oldInteractive !== undefined) {
      nodes.push(
        heading("h3", options.oldInteractive),
        mapList("舊清單：方舟"),
      )
    }
  }
  if (options.bottomNav !== false) nodes.push(nav())
  return spaced(nodes)
}

function descendants(root: Root | Element): Element[] {
  const result: Element[] = []
  for (const child of root.children) {
    if (child.type !== "element") continue
    result.push(child, ...descendants(child))
  }
  return result
}

function byClass(root: Root | Element, className: string): Element[] {
  return descendants(root).filter((node) => {
    const classes = node.properties.className
    return Array.isArray(classes) && classes.includes(className)
  })
}

function directByClass(root: Root, className: string): Element[] {
  return root.children.filter(
    (node): node is Element =>
      node.type === "element" &&
      Array.isArray(node.properties.className) &&
      node.properties.className.includes(className),
  )
}

function nodeText(node: Element | Root): string {
  return node.children.map((child) => {
    if (child.type === "text") return child.value
    if (child.type === "element") return nodeText(child)
    return ""
  }).join("")
}

function firstClass(node: Element): string | undefined {
  const value = node.properties.className
  return Array.isArray(value) ? String(value[0]) : undefined
}

function elements(root: Root): Element[] {
  return root.children.filter((node): node is Element => node.type === "element")
}

function frameTitles(root: Root | Element): string[] {
  return byClass(root, "bwz-ia-frame").map((frame) => {
    const headingNode = byClass(frame, "bwz-ia-title")[0]
    return headingNode ? nodeText(headingNode).replace("↗（在新分頁開啟）", "") : ""
  })
}

test("創世記 6：舊互動清單換成一張卡，其他附錄與頂端導覽保持原位", () => {
  const root = chapterPage("創世記", 6, { oldInteractive: "互動網站" })
  const oldMapHeading = elements(root).find((node) => node.properties.id === "相關地圖")
  const oldMapList = elements(root)[elements(root).indexOf(oldMapHeading!) + 1]
  const topNav = elements(root)[1]
  const verseList = elements(root)[2]

  assert.equal(applyInteractiveSites(root, {
    slug: "01-創世記/第6章",
    registry,
    existingSlugs,
  }), true)

  assert.equal(descendants(root).filter((node) => node.tagName === "h3" && node.properties.id === "互動網站").length, 1)
  assert.equal(directByClass(root, "bwz-ia-chapter").length, 1)
  assert.deepEqual(frameTitles(root), ["方舟"])
  assert.equal(byClass(root, "bwz-ia-title")[0].tagName, "h4")
  assert.equal(byClass(root, "bwz-ia-deep").length, 0)
  assert.ok(elements(root).includes(oldMapHeading!))
  assert.ok(elements(root).includes(oldMapList))
  assert.equal(nodeText(oldMapList), "原有地圖")
  assert.ok(!nodeText(root).includes("舊清單：方舟"))
  assert.ok(elements(root).indexOf(topNav) < elements(root).indexOf(verseList))
  assert.equal(firstClass(elements(root)[elements(root).indexOf(verseList) - 1]), "bwz-ia-line")
  assert.match(nodeText(byClass(root, "bwz-ia-line")[0]), /本章有 1 個互動網站/)
  assert.match(nodeText(byClass(root, "bwz-ia-line")[0]), /方舟/)
})

test("出埃及記 12：小卡接在相關地圖後，排序、deep link 與封面正確", () => {
  const root = chapterPage("出埃及記", 12)
  const original = elements(root)
  const mapListNode = original.find((node) => node.tagName === "ul" && nodeText(node) === "原有地圖")!
  const bottomNav = original.at(-1)!

  assert.equal(applyInteractiveSites(root, {
    slug: "02-出埃及記/第12章",
    registry,
    existingSlugs,
  }), true)

  const topLevel = elements(root)
  const card = directByClass(root, "bwz-ia-chapter")[0]
  assert.ok(topLevel.indexOf(mapListNode) < topLevel.indexOf(card))
  assert.ok(topLevel.indexOf(card) < topLevel.indexOf(bottomNav))
  assert.deepEqual(frameTitles(card), ["耶和華的節期", "摩西五經的律法"])
  const lawFrame = byClass(card, "bwz-ia-frame")[1]
  const lawLinks = descendants(lawFrame).filter((node) => node.tagName === "a" && node.properties.target === "_blank")
  assert.ok(lawLinks.every((node) => String(node.properties.href).endsWith("#/ref/出12")))
  assert.equal(nodeText(byClass(lawFrame, "bwz-ia-deep")[0]), "直接跳到「出埃及記 12 章」的律法")
  assert.equal(
    (() => {
      const cover = byClass(lawFrame, "bwz-ia-art")[0].children[0]
      return cover.type === "element" ? cover.properties.src : null
    })(),
    "../static/interactive-covers/摩西五經-律法地圖.webp",
  )
})

test("申命記 4：沒有附錄時，只在底部導覽前建立附錄", () => {
  const root = chapterPage("申命記", 4, { appendix: false })
  const topNav = elements(root)[1]
  const bottomNav = elements(root).at(-1)!

  assert.equal(applyInteractiveSites(root, {
    slug: "05-申命記/第4章",
    registry,
    existingSlugs,
  }), true)

  const topLevel = elements(root)
  const appendix = topLevel.find((node) => node.tagName === "h2" && node.properties.id === "附錄")!
  assert.ok(topLevel.indexOf(topNav) < topLevel.indexOf(appendix))
  assert.ok(topLevel.indexOf(appendix) < topLevel.indexOf(bottomNav))
  assert.deepEqual(frameTitles(root), ["摩西五經的律法"])
  assert.equal(topLevel.filter((node) => node.tagName === "h2" && node.properties.id === "附錄").length, 1)
})

test("申命記 1 沒有網站時，包含原有附錄的樹完全不變", () => {
  const root = chapterPage("申命記", 1, { oldInteractive: "互動網站" })
  const original = structuredClone(root)

  assert.deepEqual(sitesForChapter(registry.sites, { book: 5, chapter: 1 }), [])
  assert.equal(applyInteractiveSites(root, {
    slug: "05-申命記/第1章",
    registry,
    existingSlugs,
  }), false)
  assert.deepEqual(root, original)
})

test("沒有經文 ol 時不插上方一行，小卡照放", () => {
  const root = chapterPage("創世記", 6, { verseList: false })
  assert.equal(applyInteractiveSites(root, {
    slug: "01-創世記/第6章",
    registry,
    existingSlugs,
  }), true)
  assert.equal(byClass(root, "bwz-ia-line").length, 0)
  assert.deepEqual(frameTitles(root), ["方舟"])
})

test("非章節頁完全不變", () => {
  const root = spaced([heading("h1", "亞倫"), el("p", {}, ["人物內容"])])
  const original = structuredClone(root)
  assert.equal(applyInteractiveSites(root, {
    slug: "link_folder/人物/亞倫",
    registry,
    existingSlugs,
  }), false)
  assert.deepEqual(root, original)
})

test("總入口保留 h1，收起原清單，並建立 wide 牆與交錯長軸", () => {
  const originalList = el("ul", {}, [el("li", {}, ["原本依章節的清單"])])
  const root = spaced([heading("h1", "互動網站"), originalList])
  assert.equal(applyInteractiveSites(root, {
    slug: HUB_SLUG,
    registry,
    existingSlugs,
  }), true)

  const topLevel = elements(root)
  assert.equal(topLevel[0].tagName, "h1")
  assert.equal(firstClass(topLevel[1]), "bwz-ia-hub")
  assert.equal(firstClass(topLevel.at(-1)!), "bwz-ia-source")
  assert.ok(descendants(topLevel.at(-1)!).includes(originalList))
  assert.equal(nodeText(descendants(topLevel.at(-1)!).find((node) => node.tagName === "summary")!), "依章節的清單")

  const hub = topLevel[1]
  const wall = byClass(hub, "bwz-ia-wall")[0]
  assert.deepEqual(frameTitles(wall), ["摩西五經的律法", "從亞當到耶穌", "耶和華的節期"])
  assert.ok(byClass(wall, "bwz-ia-title").every((node) => node.tagName === "h3"))
  const lawFrame = byClass(wall, "bwz-ia-frame")[0]
  const lawCells = byClass(lawFrame, "bwz-ia-cell").map(nodeText)
  assert.deepEqual(lawCells, ["創5", "出17", "利25", "民16", "申25"])
  assert.ok(byClass(wall, "bwz-ia-frame")[1] && byClass(wall, "bwz-ia-cell-b").some((node) => nodeText(node) === "得"))
  assert.ok(byClass(wall, "bwz-ia-cell-b").some((node) => nodeText(node) === "路"))

  assert.deepEqual(byClass(hub, "bwz-ia-book-name").map(nodeText), [
    "創世記", "出埃及記", "利未記", "民數記",
  ])
  assert.deepEqual(byClass(hub, "bwz-ia-stop").map((node) =>
    (node.properties.className as string[]).find((name) => name === "bwz-ia-l" || name === "bwz-ia-r"),
  ), ["bwz-ia-l", "bwz-ia-r", "bwz-ia-l", "bwz-ia-r", "bwz-ia-l", "bwz-ia-r"])
  assert.ok(byClass(hub, "bwz-ia-ch").some((node) => node.tagName === "span"))
  assert.ok(byClass(hub, "bwz-ia-ch").some((node) => node.tagName === "a"))
  assert.ok(byClass(hub, "bwz-ia-tcover").length > 0)

  const external = descendants(hub).filter((node) => node.tagName === "a" && node.properties.target === "_blank")
  assert.ok(external.length > 0)
  assert.ok(external.every((node) => Array.isArray(node.properties.rel) && node.properties.rel.includes("noopener")))
  // 封面連結是 aria-hidden（標題連結才是給螢幕閱讀器的那一個），所以只要求看得到的連結說明「在新分頁開啟」
  const announced = external.filter((node) => node.properties["aria-hidden"] !== "true")
  assert.ok(announced.length > 0)
  assert.ok(announced.every((node) => byClass(node, "bwz-ia-sr").length > 0))
})

test("同一棵章節樹與總入口樹重複轉換皆冪等", () => {
  const chapter = chapterPage("創世記", 6, { oldInteractive: "互動網站" })
  const chapterContext = {
    slug: "01-創世記/第6章",
    registry,
    existingSlugs,
  }
  assert.equal(applyInteractiveSites(chapter, chapterContext), true)
  const onceChapter = structuredClone(chapter)
  assert.equal(applyInteractiveSites(chapter, chapterContext), false)
  assert.deepEqual(chapter, onceChapter)

  const hub = spaced([heading("h1", "互動網站"), el("ul", {}, ["舊清單"])])
  const hubContext = { slug: HUB_SLUG, registry, existingSlugs }
  assert.equal(applyInteractiveSites(hub, hubContext), true)
  const onceHub = structuredClone(hub)
  assert.equal(applyInteractiveSites(hub, hubContext), false)
  assert.deepEqual(hub, onceHub)
})

test("互動網站標題的空白經正規化後仍替換舊清單", () => {
  for (const oldTitle of ["互動 網站", " 互動網站 ", "互動　網站"]) {
    const root = chapterPage("創世記", 6, { oldInteractive: oldTitle })
    assert.equal(applyInteractiveSites(root, {
      slug: "01-創世記/第6章",
      registry,
      existingSlugs,
    }), true)
    assert.equal(descendants(root).filter(
      (node) => node.tagName === "h3" && node.properties.id === "互動網站",
    ).length, 1)
    assert.ok(!nodeText(root).includes("舊清單：方舟"))
  }
})

test("舊格式：附錄外的「相關資源 › 互動網站」也拿掉，小卡只出現在附錄", () => {
  const root = chapterPage("創世記", 6, { appendix: false })
  const verseIndex = root.children.findIndex((node) => node.type === "element" && node.tagName === "ol")
  root.children.splice(
    verseIndex + 1,
    0,
    text("\n"),
    heading("h2", "相關資源"),
    text("\n"),
    heading("h3", "互動網站"),
    text("\n"),
    mapList("舊清單：方舟"),
  )

  assert.equal(applyInteractiveSites(root, { slug: "01-創世記/第6章", registry, existingSlugs }), true)
  const interactiveHeadings = descendants(root).filter((node) => node.tagName === "h3" && node.properties.id === "互動網站")
  assert.equal(interactiveHeadings.length, 1)
  assert.ok(!nodeText(root).includes("舊清單：方舟"))
  const top = elements(root)
  const appendixIndex = top.findIndex((node) => node.tagName === "h2" && node.properties.id === "附錄")
  assert.ok(appendixIndex > 0)
  assert.ok(top.indexOf(interactiveHeadings[0]) > appendixIndex)
})

test("建置時的導覽表格是裸 table（還沒包 table-container）也認得，小卡在它之前", () => {
  const bare = (): Element => el("table", {}, [el("tr", {}, [el("th", {}, ["前一章"]), el("th", {}, ["下一章"])])])
  const root = chapterPage("出埃及記", 12, { bottomNav: false })
  root.children.splice(2, 1, bare())
  root.children.push(text("\n"), bare())

  assert.equal(applyInteractiveSites(root, { slug: "02-出埃及記/第12章", registry, existingSlugs }), true)
  const top = elements(root)
  const card = top.findIndex((node) => firstClass(node) === "bwz-ia-chapter")
  assert.ok(card > 0)
  assert.equal(top.at(-1)?.tagName, "table")
  assert.ok(card < top.length - 1)
})

test("描述陣列的 element 索引能對回含換行文字節點的 root", () => {
  const root = chapterPage("出埃及記", 12)
  const described = describeChapterNodes(root)
  assert.equal(described.descriptions[0].tag, "h1")
  assert.equal(described.rootIndices[2], 4)
  assert.equal(described.descriptions[2].tag, "ol")
  assert.equal(described.descriptions[1].className, "table-container")
  assert.match(described.descriptions[1].text ?? "", /前一章/)
})
