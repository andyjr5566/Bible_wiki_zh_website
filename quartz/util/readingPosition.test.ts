import assert from "node:assert/strict"
import test from "node:test"
import { BIBLE_BOOKS, folderSlug } from "./bibleBooks"
import { buildCatalog } from "./bookCatalog"
import {
  EMPTY_READING,
  READING_SAVE_INTERVAL_MS,
  READING_SAVE_RATIO_THRESHOLD,
  parseReading,
  pickResume,
  ratioFromScroll,
  recentReadings,
  recordReading,
  scrollFromRatio,
  serializeReading,
  shouldSave,
} from "./readingPosition"

test("returns empty state for invalid JSON, versions, and top-level fields", () => {
  assert.deepEqual(parseReading("{"), EMPTY_READING)
  assert.deepEqual(parseReading(null), EMPTY_READING)
  assert.deepEqual(parseReading(undefined), EMPTY_READING)
  assert.deepEqual(parseReading(JSON.stringify({ v: 2, books: {} })), EMPTY_READING)
  assert.deepEqual(parseReading(JSON.stringify({ v: 1, books: [] })), EMPTY_READING)
  assert.deepEqual(parseReading(JSON.stringify({ v: "1", books: {} })), EMPTY_READING)
})

test("filters malformed reading rows without discarding valid rows", () => {
  const state = parseReading(
    JSON.stringify({
      v: 1,
      books: {
        good: { slug: "01-創世記/第1章", ratio: 0.4, t: 10 },
        badSlug: { slug: 4, ratio: 0.2, t: 9 },
        badRatio: { slug: "02-出埃及記/第1章", ratio: "0.2", t: 8 },
        badTime: { slug: "03-利未記/第1章", ratio: 0.2, t: "8" },
        nullRow: null,
      },
    }),
  )
  assert.deepEqual(state, {
    v: 1,
    books: { good: { slug: "01-創世記/第1章", ratio: 0.4, t: 10 } },
  })
  assert.deepEqual(parseReading(JSON.stringify({ v: 1, books: { good: { slug: "x", ratio: 2, t: 1 } } })).books.good, {
    slug: "x",
    ratio: 1,
    t: 1,
  })
  assert.deepEqual(parseReading(serializeReading(state)), state)
})

test("records one chapter per book, clamps ratios, and preserves immutable inputs", () => {
  const original = EMPTY_READING
  const first = recordReading(original, {
    slug: "01-創世記/第1章",
    ratio: -0.5,
    t: 1,
  })
  const second = recordReading(first, {
    slug: "01-創世記/第6章",
    ratio: 1.5,
    t: 2,
  })
  assert.deepEqual(original, { v: 1, books: {} })
  assert.notEqual(first, original)
  assert.notEqual(second, first)
  assert.equal(Object.keys(second.books).length, 1)
  assert.deepEqual(second.books[folderSlug(BIBLE_BOOKS[0])], {
    slug: "01-創世記/第6章",
    ratio: 1,
    t: 2,
  })
  assert.equal(first.books[folderSlug(BIBLE_BOOKS[0])].ratio, 0)
  assert.equal(recordReading(second, { slug: "01-創世記/全書目錄及綱要", ratio: 0.3, t: 3 }), second)
  assert.equal(recordReading(second, { slug: "link_folder/人物/亞伯拉罕", ratio: 0.3, t: 3 }), second)
})

test("returns recent chapter readings newest first", () => {
  let state = EMPTY_READING
  state = recordReading(state, { slug: "01-創世記/第1章", ratio: 0.1, t: 10 })
  state = recordReading(state, { slug: "02-出埃及記/第2章", ratio: 0.2, t: 30 })
  state = recordReading(state, { slug: "03-利未記/第3章", ratio: 0.3, t: 20 })
  assert.deepEqual(recentReadings(state, 2).map(({ book, chapter, t }) => [book.num, chapter, t]), [
    [2, 2, 30],
    [3, 3, 20],
  ])
})

test("resumes existing chapters, falls back to toc for a removed chapter, and drops missing books", () => {
  let state = EMPTY_READING
  state = recordReading(state, { slug: "01-創世記/第2章", ratio: 0.45, t: 30 })
  state = recordReading(state, { slug: "02-出埃及記/第2章", ratio: 0.8, t: 20 })
  state = recordReading(state, { slug: "03-利未記/第1章", ratio: 0.7, t: 10 })

  const catalog = buildCatalog([
    "01-創世記/第2章",
    "02-出埃及記/第1章",
    "02-出埃及記/全書目錄及綱要",
  ])
  const resumes = pickResume(state, catalog, 3)
  assert.deepEqual(
    resumes.map(({ book, slug, chapter, ratio, t, kind }) => ({
      num: book.num,
      slug,
      chapter,
      ratio,
      t,
      kind,
    })),
    [
      { num: 1, slug: "01-創世記/第2章", chapter: 2, ratio: 0.45, t: 30, kind: "chapter" },
      { num: 2, slug: "02-出埃及記/全書目錄及綱要", chapter: undefined, ratio: 0, t: 20, kind: "toc" },
    ],
  )
  assert.equal(pickResume(state, catalog, 1).length, 1)
})

test("converts scroll positions and ratios within the legal range", () => {
  assert.equal(ratioFromScroll(0, 500, 100), 0)
  assert.equal(ratioFromScroll(200, 500, 100), 0.5)
  assert.equal(ratioFromScroll(-1, 500, 100), 0)
  assert.equal(ratioFromScroll(500, 500, 100), 1)
  assert.equal(ratioFromScroll(10, 100, 100), 0)
  assert.equal(ratioFromScroll(10, 80, 100), 0)

  assert.equal(scrollFromRatio(0, 500, 100), 0)
  assert.equal(scrollFromRatio(0.5, 500, 100), 200)
  assert.equal(scrollFromRatio(1, 500, 100), 400)
  assert.equal(scrollFromRatio(-2, 500, 100), 0)
  assert.equal(scrollFromRatio(2, 500, 100), 400)
  assert.equal(scrollFromRatio(0.5, 100, 100), 0)
})

test("saves only after both time and movement thresholds, except the first position", () => {
  assert.equal(READING_SAVE_INTERVAL_MS, 1000)
  assert.equal(READING_SAVE_RATIO_THRESHOLD, 0.02)
  assert.equal(shouldSave({ prevRatio: undefined, ratio: 0, now: 0, lastSavedAt: 0 }), true)
  assert.equal(shouldSave({ prevRatio: 0.5, ratio: 0.52, now: 1000, lastSavedAt: 0 }), true)
  assert.equal(shouldSave({ prevRatio: 0.5, ratio: 0.52, now: 999, lastSavedAt: 0 }), false)
  assert.equal(shouldSave({ prevRatio: 0.5, ratio: 0.519, now: 1000, lastSavedAt: 0 }), false)
  assert.equal(shouldSave({ prevRatio: 0.5, ratio: 0.4, now: 1000, lastSavedAt: 0 }), true)
})
