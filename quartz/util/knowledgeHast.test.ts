import assert from "node:assert/strict"
import test from "node:test"
import type { Element, Root } from "hast"
import { applyKnowledgeHub, columnTier } from "./knowledgeHast"
import { HUB_SLUG, unknownCategories, buildKnowledgeIndex } from "./knowledgeNodes"
import type { KnowledgeFile } from "./knowledgeNodes"

function el(tagName: string, children: any[] = []): Element {
  return {
    type: "element",
    tagName,
    properties: {},
    children: children.map((c) => (typeof c === "string" ? { type: "text", value: c } : c)),
  }
}

function root(...children: Element[]): Root {
  return { type: "root", children }
}

const mockFiles: KnowledgeFile[] = [
  {
    slug: "link_folder/人物/亞伯拉罕",
    frontmatter: { title: "亞伯拉罕", aliases: ["亞伯蘭"] },
    htmlAst: root(
      el("h2", ["按書卷累積"]),
      el("h3", ["創世記"]),
      el("h4", ["第12章"]),
      el("h4", ["第15章"]),
    ),
  },
  {
    slug: "link_folder/人物/摩西",
    frontmatter: { title: "摩西" },
    htmlAst: root(
      el("h2", ["按書卷累積"]),
      el("h3", ["出埃及記"]),
      el("h4", ["第2章"]),
      el("h4", ["第3章"]),
      el("h4", ["第4章"]),
    ),
  },
  {
    slug: "link_folder/地點/耶路撒冷",
    frontmatter: { title: "耶路撒冷" },
    htmlAst: root(
      el("h2", ["按書卷累積"]),
      el("h3", ["撒母耳記下"]),
      el("h4", ["第5章"]),
    ),
  },
  {
    slug: "創世記/第1章",
  },
]

test("applyKnowledgeHub ignores unrelated slugs", () => {
  const r = root()
  assert.equal(applyKnowledgeHub(r, { slug: "創世記/第1章", files: mockFiles }), false)
  assert.equal(applyKnowledgeHub(r, { slug: "教學/index", files: mockFiles }), false)
  assert.equal(r.children.length, 0)
})

test("applyKnowledgeHub renders Hub page on link_folder/index", () => {
  const r = root()
  const applied = applyKnowledgeHub(r, { slug: HUB_SLUG, files: mockFiles })
  assert.equal(applied, true)
  // 標題 h1（讓 Quartz 的小字頁名藏起來、標題置中）加上入口本體
  assert.equal(r.children.length, 2)
  assert.equal((r.children[0] as Element).tagName, "h1")

  const hub = r.children[1] as Element
  assert.equal(hub.tagName, "div")
  assert.ok(Array.isArray(hub.properties.className))
  assert.ok((hub.properties.className as string[]).includes("bwz-kn-hub"))

  // Second invocation on same root should be a no-op (idempotent)
  assert.equal(applyKnowledgeHub(r, { slug: HUB_SLUG, files: mockFiles }), false)
  assert.equal(r.children.length, 2)

  // Verify search button and cards exist
  const searchBtn = hub.children.find(
    (c): c is Element => c.type === "element" && c.tagName === "button" && "dataKnSearch" in c.properties,
  )
  assert.ok(searchBtn)
})

test("applyKnowledgeHub renders category page on link_folder/<category>/index", () => {
  const r = root()
  const applied = applyKnowledgeHub(r, { slug: "link_folder/人物/index", files: mockFiles })
  assert.equal(applied, true)
  assert.equal(r.children.length, 2)
  assert.equal((r.children[0] as Element).tagName, "h1")

  const cat = r.children[1] as Element
  assert.equal(cat.tagName, "div")
  assert.ok((cat.properties.className as string[]).includes("bwz-kn-cat"))
  assert.equal(cat.properties.dataCat, "人物")

  // Check structure: header, sibling nav, toolbar, list
  const children = cat.children as Element[]
  const hasHead = children.some((c) => (c.properties.className as string[])?.includes("bwz-kn-head"))
  const hasSiblings = children.some((c) => (c.properties.className as string[])?.includes("bwz-kn-pills"))
  const hasTools = children.some((c) => (c.properties.className as string[])?.includes("bwz-kn-tools"))
  const hasList = children.some((c) => (c.properties.className as string[])?.includes("bwz-kn-list"))

  assert.ok(hasHead, "Should have category header")
  assert.ok(hasSiblings, "Should have sibling navigation")
  assert.ok(hasTools, "Should have filter tools")
  assert.ok(hasList, "Should have entry list")
})

test("applyKnowledgeHub handles unknown category gracefully", () => {
  const r = root()
  const applied = applyKnowledgeHub(r, { slug: "link_folder/不存在的分類/index", files: mockFiles })
  assert.equal(applied, false)
  assert.equal(r.children.length, 0)
})

test("applyKnowledgeHub adds dataWide property for long titled categories", () => {
  const longFiles: KnowledgeFile[] = [
    {
      slug: "link_folder/互文/舊約神的名在啟示錄中的三時態演變與基督神性",
      frontmatter: { title: "舊約神的名在啟示錄中的三時態演變與基督神性" },
      htmlAst: root(el("h2", ["按書卷累積"]), el("h3", ["啟示錄"]), el("h4", ["第1章"])),
    },
  ]
  const r = root()
  const applied = applyKnowledgeHub(r, { slug: "link_folder/互文/index", files: longFiles })
  assert.equal(applied, true)
  const cat = r.children[1] as Element
  assert.equal(cat.properties.dataWide, "1")
})

function walk(node: Element | Root, visit: (el: Element) => void) {
  for (const child of node.children) {
    if (child.type !== "element") continue
    visit(child)
    walk(child, visit)
  }
}

test("applyKnowledgeHub keeps the body's own h1 instead of adding a second one", () => {
  const own = el("h1", ["知識節點"])
  const r = root(own)
  assert.equal(applyKnowledgeHub(r, { slug: HUB_SLUG, files: mockFiles }), true)
  assert.equal(r.children.filter((c) => c.type === "element" && c.tagName === "h1").length, 1)
})

test("generated pages use div, not p (the Aa font panel enlarges article p only)", () => {
  for (const slug of [HUB_SLUG, "link_folder/人物/index"]) {
    const r = root()
    applyKnowledgeHub(r, { slug, files: mockFiles })
    const paragraphs: string[] = []
    walk(r, (node) => {
      if (node.tagName === "p") paragraphs.push(String(node.properties.className ?? ""))
    })
    assert.deepEqual(paragraphs, [], `${slug} has <p>`)
  }
})

test("category page: book panel starts collapsed and is controlled by the toggle", () => {
  const r = root()
  applyKnowledgeHub(r, { slug: "link_folder/人物/index", files: mockFiles })
  let panelId: unknown
  let controls: unknown
  let hidden: unknown
  walk(r, (node) => {
    if ("dataKnBooks" in node.properties) {
      panelId = node.properties.id
      hidden = node.properties.hidden
    }
    if ("dataKnBooksToggle" in node.properties) controls = node.properties.ariaControls
  })
  assert.ok(panelId)
  assert.equal(controls, panelId)
  assert.equal(hidden, true)
})

test("category card shows a seal with the first character of the category", () => {
  const r = root()
  applyKnowledgeHub(r, { slug: HUB_SLUG, files: mockFiles })
  const seals: string[] = []
  walk(r, (node) => {
    const classes = node.properties.className
    if (Array.isArray(classes) && classes.includes("bwz-kn-seal")) {
      seals.push(node.children.map((c) => (c.type === "text" ? c.value : "")).join(""))
    }
  })
  assert.deepEqual(seals.sort(), ["人", "地"])
})

test("unknownCategories lists category folders that CATEGORY_INFO does not know", () => {
  const files: KnowledgeFile[] = [
    ...mockFiles,
    { slug: "link_folder/新分類/某條目", frontmatter: { title: "某條目" } },
  ]
  assert.deepEqual(unknownCategories(buildKnowledgeIndex(files)), ["新分類"])
  assert.deepEqual(unknownCategories(buildKnowledgeIndex(mockFiles)), [])
})

test("columnTier: short names have no tier, longer names get a wider column", () => {
  const entry = (title: string) => ({ title }) as any
  const of = (...titles: string[]) => columnTier(titles.map(entry))
  assert.equal(of("摩西", "亞伯拉罕", "以撒"), null)
  assert.equal(of("約翰福音1章道與創造", "創世記9章洪水後准吃肉", "詩篇33篇神話語創造"), "2")
  assert.equal(of("舊約神的名在啟示錄中的三時態演變與基督神性", "以色列戰勝亞摩利王西宏互文"), "1")
  assert.equal(columnTier([]), null)
})
