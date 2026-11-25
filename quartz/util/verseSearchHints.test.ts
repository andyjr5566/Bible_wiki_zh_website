import test, { describe } from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import {
  buildPinHints,
  buildRelatedHints,
  buildVerseSearchHints,
  parsePinRef,
  type HintsChapter,
} from "./verseSearchHints"

const deut11: HintsChapter = {
  slug: "05-申命記/第11章",
  start: 1,
  verses: ["你要愛耶和華─你的神。", "你們要將我這話存在心內，留在意中，繫在手上為記號。"],
}
const gen6: HintsChapter = {
  slug: "01-創世記/第6章",
  start: 5,
  verses: ["耶和華見人在地上罪惡很大，終日所思想的盡都是惡，"],
}

function collectWarnings() {
  const warnings: string[] = []
  return { warnings, warn: (message: string) => void warnings.push(message) }
}

describe("parsePinRef", () => {
  test("accepts full names, one-character abbreviations and full-width colons", () => {
    assert.equal(parsePinRef("申命記 11:18")?.book.name, "申命記")
    assert.deepEqual(
      [parsePinRef("申11:18")?.book.name, parsePinRef("申命記11：18")?.chapter],
      ["申命記", 11],
    )
  })

  test("rejects unknown books and malformed references", () => {
    assert.equal(parsePinRef("火星記 1:1"), null)
    assert.equal(parsePinRef("申命記 11"), null)
    assert.equal(parsePinRef("申命記 0:1"), null)
  })
})

describe("buildRelatedHints", () => {
  const texts = [...deut11.verses, ...gen6.verses]

  test("keeps only words that occur in published verses and drops empty keys", () => {
    const { warn } = collectWarnings()
    const related = buildRelatedHints(
      { 意念: ["意中", "心思", "不存在的詞"], 沒有: ["完全沒有"], 思想: ["意念", "意念"] },
      texts,
      warn,
    )
    assert.deepEqual(related, { 意念: ["意中"] })
  })

  test("ignores self references and malformed rows with a warning", () => {
    const { warnings, warn } = collectWarnings()
    const related = buildRelatedHints({ 意中: ["意中"], 壞掉: "意中" }, texts, warn)
    assert.deepEqual(related, {})
    assert.equal(warnings.length, 1)
    assert.match(warnings[0]!, /壞掉/)
  })
})

describe("buildPinHints", () => {
  test("resolves a reference to the client verse id", () => {
    const resolved = buildPinHints(
      [{ query: "意念", ref: "申 11:2", cuv: "意中" }],
      [deut11],
      () => {},
    )
    assert.deepEqual(resolved, [{ query: "意念", id: "05-申命記/第11章#v2", cuv: "意中" }])
  })

  test("respects a chapter whose first verse is not 1", () => {
    const pins = buildPinHints([{ query: "x", ref: "創世記 6:5", cuv: "思想" }], [gen6], () => {})
    assert.equal(pins[0]?.id, "01-創世記/第6章#v5")
  })

  test("skips silently when the chapter is not published yet", () => {
    const { warnings, warn } = collectWarnings()
    const pins = buildPinHints([{ query: "意念", ref: "申命記 11:18", cuv: "意中" }], [gen6], warn)
    assert.deepEqual(pins, [])
    assert.deepEqual(warnings, [])
  })

  test("warns and drops a missing verse or a missing cuv word", () => {
    const { warnings, warn } = collectWarnings()
    const pins = buildPinHints(
      [
        { query: "意念", ref: "申命記 11:18", cuv: "意中" },
        { query: "意念", ref: "申命記 11:2", cuv: "不在這節" },
        { query: "意念", ref: "亂寫", cuv: "意中" },
      ],
      [deut11],
      warn,
    )
    assert.deepEqual(pins, [])
    assert.equal(warnings.length, 3)
    assert.match(warnings[0]!, /經節不存在.*意念 \| 申命記 11:18 \| 意中/)
    assert.match(warnings[1]!, /找不到「不在這節」/)
    assert.match(warnings[2]!, /無法解析/)
  })
})

describe("buildVerseSearchHints", () => {
  test("combines both tables and keeps the payload version", () => {
    const hints = buildVerseSearchHints(
      [deut11],
      { 意念: ["意中"] },
      [{ query: "意念", ref: "申命記 11:2", cuv: "意中" }],
      () => {},
    )
    assert.equal(hints.version, 1)
    assert.deepEqual(hints.related, { 意念: ["意中"] })
    assert.equal(hints.pins.length, 1)
  })
})

describe("shipped data files", () => {
  const read = (name: string) =>
    JSON.parse(fs.readFileSync(new URL(`../data/${name}`, import.meta.url), "utf8")) as unknown

  test("related table is a map of non-empty word lists", () => {
    const related = read("verse-search-related.json") as Record<string, unknown>
    for (const [key, targets] of Object.entries(related)) {
      assert.ok(key.trim(), "empty key")
      assert.ok(Array.isArray(targets) && targets.length > 0, `${key}: empty list`)
      for (const target of targets as unknown[]) {
        assert.ok(typeof target === "string" && target.length >= 2 && target !== key, key)
      }
    }
  })

  test("seed pin resolves once its chapter is published", () => {
    const pins = read("verse-search-pins.json")
    const full: HintsChapter = {
      slug: "05-申命記/第11章",
      start: 1,
      verses: Array.from({ length: 17 }, () => "占位").concat("你們要將我這話存在心內，留在意中，"),
    }
    const resolved = buildPinHints(pins, [full], (message) => assert.fail(message))
    assert.deepEqual(resolved, [{ query: "意念", id: "05-申命記/第11章#v18", cuv: "意中" }])
  })
})
