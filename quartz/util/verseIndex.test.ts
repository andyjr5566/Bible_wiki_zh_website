import assert from "node:assert/strict"
import test from "node:test"
import { fromHtml } from "hast-util-from-html"
import { defaultProcessedContent, type ProcessedContent } from "../plugins/vfile"
import type { FullSlug } from "./path"
import { addVerseAnchors, buildVerseIndex } from "./verseIndex"

function page(slug: string, html: string, flags: { unlisted?: boolean; encrypted?: boolean } = {}) {
  const [, file] = defaultProcessedContent({ slug: slug as FullSlug, ...flags })
  const entry: ProcessedContent = [fromHtml(html, { fragment: true }), file]
  return entry
}

test("indexes only the published verse list, with inline labels and verse numbering intact", () => {
  const chapter = page(
    "05-申命記/第31章",
    `<p>導覽</p><ol start="21">
      <li>他們所懷的<a href="/keyword" title="詞義註解">意念</a>我都知道了。<sup><a data-footnote-ref="">附註一</a></sup></li>
      <li>摩西就寫了一篇歌。<span hidden>非本文</span><ol><li>綱要</li></ol></li>
    </ol><hr><ol><li>章內註解</li></ol>`,
  )
  const { index, malformed } = buildVerseIndex([chapter])
  assert.deepEqual(malformed, [])
  assert.deepEqual(index, {
    version: 1,
    chapters: [
      {
        slug: "05-申命記/第31章",
        book: "申命記",
        chapter: 31,
        start: 21,
        verses: ["他們所懷的意念我都知道了。", "摩西就寫了一篇歌。"],
      },
    ],
  })
})

test("orders chapters canonically and excludes the original index entries when chapters are removed", () => {
  const items = [
    page("05-申命記/第31章", "<ol><li>神</li></ol>"),
    page("01-創世記/第10章", "<ol><li>神</li></ol>"),
    page("01-創世記/第2章", "<ol><li>神</li></ol>"),
    page("01-創世記/第1章", "<ol><li>隱藏經文</li></ol>", { unlisted: true }),
    page("01-創世記/第3章", "<ol><li>隱藏經文</li></ol>", { encrypted: true }),
    page("01-創世記/全書目錄及綱要", "<ol><li>目錄</li></ol>"),
    page("link_folder/原文/意念", "<ol><li>意念</li></ol>"),
  ]
  const getSlugs = (content: ProcessedContent[]) =>
    buildVerseIndex(content).index.chapters.map(({ slug }) => slug)
  assert.deepEqual(getSlugs(items), ["01-創世記/第2章", "01-創世記/第10章", "05-申命記/第31章"])
  assert.deepEqual(getSlugs(items.slice(1)), ["01-創世記/第2章", "01-創世記/第10章"])
})

test("reports a missing list or irregular verses without pulling in commentary or renumbering", () => {
  const { index, malformed } = buildVerseIndex([
    page("01-創世記/第1章", "<hr><ol><li>章內註解</li></ol>"),
    page("01-創世記/第2章", "<ol><li>經文</li><li value=4>經文</li></ol>"),
    page("01-創世記/第3章", "<ol><li><span hidden>隱藏內容</span></li></ol>"),
  ])
  assert.deepEqual(index.chapters, [])
  assert.deepEqual(malformed, ["01-創世記/第1章", "01-創世記/第2章", "01-創世記/第3章"])
})

test("adds idempotent verse anchors in the chapter without replacing existing fragment targets", () => {
  const [root] = page(
    "02-出埃及記/第12章",
    '<ol start="3"><li id="existing">經節</li><li>經節</li></ol><hr><ol><li>註解</li></ol>',
  )
  const before = structuredClone(root)
  addVerseAnchors(root, "link_folder/事件/逾越節")
  assert.deepEqual(root, before)

  addVerseAnchors(root, "02-出埃及記/第12章")
  const anchored = structuredClone(root)
  addVerseAnchors(root, "02-出埃及記/第12章")
  assert.deepEqual(root, anchored)
  const [list, , commentary] = root.children
  assert.ok(list?.type === "element" && commentary?.type === "element")
  const [first, second] = list.children
  assert.ok(first?.type === "element" && second?.type === "element")
  assert.equal(first.properties.id, "v3")
  assert.equal(second.properties.id, "v4")
  assert.deepEqual(first.children[0], {
    type: "element",
    tagName: "span",
    properties: { id: "existing" },
    children: [],
  })
  assert.deepEqual(commentary, before.children[2])
})
