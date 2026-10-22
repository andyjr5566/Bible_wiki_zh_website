import assert from "node:assert/strict"
import test from "node:test"
import { ChapterNodeDescription, selectChapterRegions } from "./chapterRegions"

const node = (tag: string, fields: Omit<ChapterNodeDescription, "tag"> = {}): ChapterNodeDescription => ({
  tag,
  ...fields,
})

test("hides named study sections and their dividers while preserving both navigation tables", () => {
  const result = selectChapterRegions([
    node("h1"),
    node("table", { className: "table-container", text: "前一章 下一章" }),
    node("ol"),
    node("hr"),
    node("h2", { headingText: "本章知識節點" }),
    node("p"),
    node("hr"),
    node("h2", { headingText: "本章整理" }),
    node("p"),
    node("table", { className: "table-container", text: "整理資料" }),
    node("hr"),
    node("h2", { headingText: "附錄" }),
    node("p"),
    node("table", { className: "table-container", text: "前一章 下一章" }),
  ])
  assert.deepEqual(result, { verseListIndex: 2, hide: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12] })
})

test("recognizes a targeted section wrapped in details and stops at an unknown heading", () => {
  const result = selectChapterRegions([
    node("ol"),
    node("hr"),
    node("details", { headingText: "🧠 本章知識節點", className: "collapsible-section" }),
    node("p"),
    node("hr"),
    node("h2", { headingText: "來源依據" }),
    node("p"),
  ])
  assert.deepEqual(result, { verseListIndex: 0, hide: [1, 2, 3, 4] })
})

test("hides only the configured sections when an appendix is absent", () => {
  const result = selectChapterRegions([
    node("ol"),
    node("hr"),
    node("h2", { headingText: "本章整理" }),
    node("p"),
  ])
  assert.deepEqual(result, { verseListIndex: 0, hide: [1, 2, 3] })
})

test("returns the safe fallback when there is no verse list before the first hr", () => {
  assert.deepEqual(selectChapterRegions([node("h1"), node("hr"), node("ol"), node("h2", { headingText: "附錄" })]), {
    verseListIndex: null,
    hide: [],
  })
  assert.deepEqual(selectChapterRegions([node("h1"), node("h2", { headingText: "本章整理" })]), {
    verseListIndex: null,
    hide: [],
  })
})

test("does not mistake an early hr for the start of a verse list", () => {
  const result = selectChapterRegions([node("h1"), node("hr"), node("ol"), node("h2", { headingText: "附錄" })])
  assert.deepEqual(result, { verseListIndex: null, hide: [] })
})

test("preserves unknown h2 sections and resumes hiding at a later configured title", () => {
  const result = selectChapterRegions([
    node("ol"),
    node("hr"),
    node("h2", { headingText: "來源依據" }),
    node("p"),
    node("hr"),
    node("h2", { headingText: "本章整理" }),
    node("p"),
  ])
  assert.deepEqual(result, { verseListIndex: 0, hide: [4, 5, 6] })
})

test("matches emoji-prefixed headings with full-width spaces", () => {
  const result = selectChapterRegions([
    node("ol"),
    node("hr"),
    node("h2", { headingText: "📚　【本章　整理】" }),
    node("p"),
  ])
  assert.deepEqual(result, { verseListIndex: 0, hide: [1, 2, 3] })
})

test("includes tables inside a hidden section and hides dividers between target sections", () => {
  const result = selectChapterRegions([
    node("ol"),
    node("hr"),
    node("h2", { headingText: "本章整理" }),
    node("table", { className: "table-container", text: "本章分析表" }),
    node("hr"),
    node("h2", { headingText: "附錄" }),
    node("p"),
  ])
  assert.deepEqual(result, { verseListIndex: 0, hide: [1, 2, 3, 4, 5, 6] })
})

test("returns no hidden regions when the last node is only a navigation table", () => {
  const result = selectChapterRegions([
    node("h1"),
    node("table", { className: "table-container", text: "前一章 下一章" }),
    node("ol"),
    node("table", { className: "table-container", text: "前一章 下一章" }),
  ])
  assert.deepEqual(result, { verseListIndex: 2, hide: [] })
})
