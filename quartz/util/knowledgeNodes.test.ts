import assert from "node:assert/strict"
import test from "node:test"
import type { Element, Root } from "hast"
import {
  categoryOfSlug,
  readAccumulation,
  toEntry,
  compareEntries,
  buildKnowledgeIndex,
  knowledgeIndexFor,
  sectionsByFirstBook,
  bookCounts,
  mostRead,
  OTHER_SOURCE,
  HUB_SLUG,
  categoryInfo,
  GROUPS,
  type KnowledgeFile,
  type KnowledgeEntry,
} from "./knowledgeNodes"

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

test("categoryInfo returns correct metadata for defined and undefined categories", () => {
  const person = categoryInfo("人物")
  assert.equal(person.group, GROUPS[0])
  assert.equal(person.glyph, "●")
  assert.ok(person.blurb.includes("人物"))

  const unknown = categoryInfo("未知分類")
  assert.equal(unknown.group, "其他分類")
  assert.equal(unknown.glyph, "●")
  assert.equal(unknown.blurb, "")
})

test("categoryOfSlug identifies subcategory slugs correctly", () => {
  assert.equal(categoryOfSlug("link_folder/人物/亞伯拉罕"), "人物")
  assert.equal(categoryOfSlug("link_folder/地點/耶路撒冷"), "地點")
  assert.equal(categoryOfSlug("link_folder/神學/約"), "神學")

  // Hub & category folder index pages return null
  assert.equal(categoryOfSlug(HUB_SLUG), null)
  assert.equal(categoryOfSlug("link_folder/人物/index"), null)
  assert.equal(categoryOfSlug("link_folder/index"), null)

  // Non link_folder slugs return null
  assert.equal(categoryOfSlug("創世記/第1章"), null)
  assert.equal(categoryOfSlug("other/人物/亞伯拉罕"), null)
  assert.equal(categoryOfSlug("link_folder"), null)
})

test("readAccumulation extracts bible books and chapters from HAST", () => {
  assert.equal(readAccumulation(undefined).size, 0)
  assert.equal(readAccumulation(root()).size, 0)

  const ast = root(
    el("h2", ["簡介"]),
    el("p", ["人物簡介內容"]),
    el("h2", ["按書卷累積"]),
    el("h3", ["觸發來源"]),
    el("p", ["非書卷區塊應被略過"]),
    el("h3", ["創世記"]),
    el("h4", ["第12章"]),
    el("h4", ["第15章"]),
    el("h3", ["出埃及記"]),
    el("h4", ["第3章"]),
    el("h3", ["非聖經標題"]),
    el("h4", ["第1章"]),
    el("h2", ["相關連結"]),
    el("h3", ["利未記"]), // 不在按書卷累積內
    el("h4", ["第1章"]),
  )

  const accumulation = readAccumulation(ast)
  assert.equal(accumulation.size, 2)
  assert.deepEqual(accumulation.get("創世記"), [12, 15])
  assert.deepEqual(accumulation.get("出埃及記"), [3])
  assert.equal(accumulation.has("利未記"), false)
})

test("toEntry builds KnowledgeEntry from KnowledgeFile", () => {
  const file: KnowledgeFile = {
    slug: "link_folder/人物/摩西",
    frontmatter: {
      title: "摩西（Moses）",
      secondary_types: ["領袖", "先知"],
      aliases: ["神人摩西"],
    },
    htmlAst: root(
      el("h2", ["按書卷累積"]),
      el("h3", ["出埃及記"]),
      el("h4", ["第2章"]),
      el("h4", ["第3章"]),
      el("h3", ["民數記"]),
      el("h4", ["第12章"]),
    ),
  }

  const entry = toEntry(file)
  assert.ok(entry)
  assert.equal(entry.slug, "link_folder/人物/摩西")
  assert.equal(entry.title, "摩西（Moses）")
  assert.equal(entry.category, "人物")
  assert.deepEqual(entry.secondary, ["領袖", "先知"])
  assert.deepEqual(entry.aliases, ["神人摩西"])
  assert.deepEqual(entry.books, ["出埃及記", "民數記"])
  assert.equal(entry.firstBook, "出埃及記")
  assert.equal(entry.firstChapter, 2)
  assert.equal(entry.chapterCount, 3)

  // Invalid file
  assert.equal(toEntry({ slug: "other/not_link" }), null)
  assert.equal(toEntry({ slug: HUB_SLUG }), null)
})

test("compareEntries sorts by first chapter and then collator", () => {
  const e1: KnowledgeEntry = {
    slug: "link_folder/人物/亞倫",
    title: "亞倫",
    category: "人物",
    secondary: [],
    aliases: [],
    books: ["出埃及記"],
    firstBook: "出埃及記",
    firstChapter: 4,
    chapterCount: 5,
  }
  const e2: KnowledgeEntry = {
    slug: "link_folder/人物/摩西",
    title: "摩西",
    category: "人物",
    secondary: [],
    aliases: [],
    books: ["出埃及記"],
    firstBook: "出埃及記",
    firstChapter: 2,
    chapterCount: 20,
  }
  const e3: KnowledgeEntry = {
    slug: "link_folder/人物/米利暗",
    title: "米利暗",
    category: "人物",
    secondary: [],
    aliases: [],
    books: ["出埃及記"],
    firstBook: "出埃及記",
    firstChapter: 2,
    chapterCount: 3,
  }

  assert.ok(compareEntries(e2, e1) < 0) // chapter 2 < chapter 4
  const sameChapterSorted = [e3, e2].sort(compareEntries)
  assert.equal(sameChapterSorted[0].title, "米利暗") // collator order
})

test("buildKnowledgeIndex and knowledgeIndexFor build cached indexes", () => {
  const files: KnowledgeFile[] = [
    {
      slug: "link_folder/人物/亞伯拉罕",
      frontmatter: { title: "亞伯拉罕" },
      htmlAst: root(el("h2", ["按書卷累積"]), el("h3", ["創世記"]), el("h4", ["第12章"])),
    },
    {
      slug: "link_folder/地點/希伯崙",
      frontmatter: { title: "希伯崙" },
      htmlAst: root(el("h2", ["按書卷累積"]), el("h3", ["創世記"]), el("h4", ["第13章"])),
    },
    {
      slug: "link_folder/人物/以撒",
      frontmatter: { title: "以撒" },
      htmlAst: root(el("h2", ["按書卷累積"]), el("h3", ["創世記"]), el("h4", ["第21章"])),
    },
    {
      slug: "創世記/第1章", // non-link file
    },
  ]

  const index = buildKnowledgeIndex(files)
  assert.equal(index.total, 3)
  assert.equal(index.categories.length, 2)
  assert.equal(index.categories[0].name, "人物")
  assert.equal(index.categories[0].entries.length, 2)
  assert.equal(index.categories[1].name, "地點")
  assert.equal(index.categories[1].entries.length, 1)

  // Test caching
  const cached = knowledgeIndexFor(files)
  assert.equal(cached, knowledgeIndexFor(files))
  assert.equal(cached.total, 3)
})

test("sectionsByFirstBook groups entries by first appearing bible book", () => {
  const entries: KnowledgeEntry[] = [
    {
      slug: "link_folder/人物/彼得",
      title: "彼得",
      category: "人物",
      secondary: [],
      aliases: [],
      books: ["馬太福音"],
      firstBook: "馬太福音",
      firstChapter: 4,
      chapterCount: 10,
    },
    {
      slug: "link_folder/人物/亞當",
      title: "亞當",
      category: "人物",
      secondary: [],
      aliases: [],
      books: ["創世記"],
      firstBook: "創世記",
      firstChapter: 2,
      chapterCount: 5,
    },
    {
      slug: "link_folder/人物/無名氏",
      title: "無名氏",
      category: "人物",
      secondary: [],
      aliases: [],
      books: [],
      firstBook: null,
      firstChapter: 0,
      chapterCount: 0,
    },
  ]

  const sections = sectionsByFirstBook(entries)
  assert.equal(sections.length, 3)
  assert.equal(sections[0].name, "創世記")
  assert.equal(sections[1].name, "馬太福音")
  assert.equal(sections[2].name, OTHER_SOURCE)
})

test("bookCounts and mostRead aggregate statistics correctly", () => {
  const entries: KnowledgeEntry[] = [
    {
      slug: "1",
      title: "A",
      category: "人物",
      secondary: [],
      aliases: [],
      books: ["創世記", "出埃及記"],
      firstBook: "創世記",
      firstChapter: 1,
      chapterCount: 15,
    },
    {
      slug: "2",
      title: "B",
      category: "人物",
      secondary: [],
      aliases: [],
      books: ["出埃及記", "利未記"],
      firstBook: "出埃及記",
      firstChapter: 2,
      chapterCount: 5,
    },
    {
      slug: "3",
      title: "C",
      category: "人物",
      secondary: [],
      aliases: [],
      books: [],
      firstBook: null,
      firstChapter: 0,
      chapterCount: 0,
    },
  ]

  const counts = bookCounts(entries)
  assert.deepEqual(counts, [
    { name: "創世記", count: 1 },
    { name: "出埃及記", count: 2 },
    { name: "利未記", count: 1 },
  ])

  const top = mostRead(entries, 5)
  assert.equal(top.length, 2) // C is excluded because chapterCount is 0
  assert.equal(top[0].title, "A")
  assert.equal(top[1].title, "B")
})

