import assert from "node:assert/strict"
import test from "node:test"
import { BIBLE_BOOKS } from "./bibleBooks"
import {
  buildCatalog,
  chapterSlug,
  introSlug,
  neighbors,
  parseBookSlug,
  tocSlug,
} from "./bookCatalog"

test("parses chapter, toc, and intro slugs with supported path spellings", () => {
  const exodus = BIBLE_BOOKS[1]
  assert.deepEqual(parseBookSlug("02-出埃及記/第12章"), {
    book: exodus,
    kind: "chapter",
    chapter: 12,
  })
  assert.deepEqual(parseBookSlug("02 出埃及記/第12章/"), {
    book: exodus,
    kind: "chapter",
    chapter: 12,
  })
  assert.deepEqual(parseBookSlug("02-出埃及記/第12章.html"), {
    book: exodus,
    kind: "chapter",
    chapter: 12,
  })
  assert.deepEqual(parseBookSlug(encodeURIComponent("02-出埃及記/第12章")), {
    book: exodus,
    kind: "chapter",
    chapter: 12,
  })
  assert.deepEqual(parseBookSlug("02%20出埃及記/%E7%AC%AC12%E7%AB%A0.html"), {
    book: exodus,
    kind: "chapter",
    chapter: 12,
  })
  assert.deepEqual(parseBookSlug("02-出埃及記/全書目錄及綱要"), {
    book: exodus,
    kind: "toc",
  })
  assert.deepEqual(parseBookSlug("02-出埃及記/書卷導論/"), {
    book: exodus,
    kind: "intro",
  })
  assert.equal(parseBookSlug("02-出埃及記/第41章"), null)
  assert.equal(parseBookSlug("link_folder/人物/亞伯拉罕"), null)
  assert.equal(parseBookSlug("index"), null)
  assert.equal(parseBookSlug("02-出埃及記/附錄"), null)
})

test("builds all 66 catalog rows while retaining chapter gaps and ignoring unrelated pages", () => {
  const catalog = buildCatalog([
    "01-創世記/第6章",
    "01-創世記/第1章",
    "01-創世記/第2章",
    "01-創世記/第2章.html",
    "02-出埃及記/全書目錄及綱要",
    "03-利未記/書卷導論",
    "appendix/人物/亞伯拉罕",
    "link_folder/人物/亞伯拉罕",
    "index",
  ])
  assert.equal(catalog.length, 66)

  const genesis = catalog[0]
  assert.equal(genesis.status, "ready")
  assert.deepEqual(genesis.chapters, [1, 2, 6])
  assert.equal(genesis.hasToc, false)
  assert.equal(genesis.hasIntro, false)

  assert.deepEqual(catalog[1], {
    book: BIBLE_BOOKS[1],
    status: "outline",
    chapters: [],
    hasToc: true,
    hasIntro: false,
  })
  assert.deepEqual(catalog[2], {
    book: BIBLE_BOOKS[2],
    status: "outline",
    chapters: [],
    hasToc: false,
    hasIntro: true,
  })
  assert.equal(catalog[3].status, "empty")
  assert.deepEqual(catalog[3].chapters, [])
})

test("builds canonical page slugs", () => {
  const book = BIBLE_BOOKS[1]
  assert.equal(chapterSlug(book, 12), "02-出埃及記/第12章")
  assert.equal(tocSlug(book), "02-出埃及記/全書目錄及綱要")
  assert.equal(introSlug(book), "02-出埃及記/書卷導論")
})

test("neighbors skip missing chapter numbers and stop at the ends", () => {
  const entry = buildCatalog([
    "01-創世記/第1章",
    "01-創世記/第2章",
    "01-創世記/第6章",
  ])[0]
  assert.deepEqual(neighbors(entry, 2), { previous: 1, next: 6 })
  assert.deepEqual(neighbors(entry, 3), { previous: 2, next: 6 })
  assert.deepEqual(neighbors(entry, 1), { next: 2 })
  assert.deepEqual(neighbors(entry, 6), { previous: 2 })
})
