import assert from "node:assert/strict"
import test from "node:test"
import {
  ENTRY_LANDING_TTL_MS,
  entryLandingLabels,
  makeEntryLanding,
  parseEntryLanding,
  serializeEntryLanding,
  shouldShowEntryLanding,
} from "./entryLanding"

const landing = makeEntryLanding("02-出埃及記/第12章", "link_folder/原文/在黃昏的時候", 1000)!

test("formats the button from the chapter book name and number", () => {
  assert.deepEqual(entryLandingLabels("02-出埃及記/第12章"), {
    buttonText: "↓ 出埃及記 12 的相關內容",
    ariaLabel: "跳到本條目中出埃及記第 12 章的相關內容",
  })
  assert.equal(entryLandingLabels("link_folder/原文/在黃昏的時候"), null)
})

test("creates and parses one-use entry landing records", () => {
  assert.deepEqual(landing, {
    v: 1,
    fromSlug: "02-出埃及記/第12章",
    toSlug: "link_folder/原文/在黃昏的時候",
    t: 1000,
  })
  assert.deepEqual(parseEntryLanding(serializeEntryLanding(landing), 1001), landing)
})

test("rejects malformed, invalid, future, and expired records", () => {
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ v: 2, fromSlug: landing.fromSlug, toSlug: landing.toSlug, t: 1000 }),
    JSON.stringify({ v: 1, fromSlug: "link_folder/人物/亞伯拉罕", toSlug: landing.toSlug, t: 1000 }),
    JSON.stringify({ v: 1, fromSlug: landing.fromSlug, toSlug: "02-出埃及記/第12章", t: 1000 }),
    JSON.stringify({ v: 1, fromSlug: landing.fromSlug, toSlug: landing.toSlug, t: "1000" }),
  ]) {
    assert.equal(parseEntryLanding(raw, 1001), null)
  }
  assert.equal(parseEntryLanding(null, 1001), null)
  assert.equal(parseEntryLanding(serializeEntryLanding(landing), 999), null)
  assert.equal(parseEntryLanding(serializeEntryLanding(landing), 1000 + ENTRY_LANDING_TTL_MS + 1), null)
})

test("matches the current entry slug after URL decoding and path normalization", () => {
  assert.equal(shouldShowEntryLanding(landing, "link_folder/原文/在黃昏的時候"), true)
  assert.equal(shouldShowEntryLanding(landing, "/link_folder/原文/在黃昏的時候/"), true)
  assert.equal(shouldShowEntryLanding(landing, "link_folder/原文/別的條目"), false)
  assert.equal(shouldShowEntryLanding(landing, "02-出埃及記/第12章"), false)
  assert.equal(shouldShowEntryLanding(null, landing.toSlug), false)
})

test("rejects invalid source and destination slugs", () => {
  assert.equal(makeEntryLanding("link_folder/人物/亞伯拉罕", landing.toSlug, 1000), null)
  assert.equal(makeEntryLanding(landing.fromSlug, "02-出埃及記/第12章", 1000), null)
  assert.equal(makeEntryLanding(landing.fromSlug, landing.toSlug, Number.NaN), null)
})
