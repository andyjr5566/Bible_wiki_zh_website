import assert from "node:assert/strict"
import test from "node:test"
import {
  RETURN_POINT_KEY,
  makeStudyPoint,
  makeVersePoint,
  parseReturnPoint,
  returnAriaLabel,
  returnHref,
  returnLabel,
  serializeReturnPoint,
  shouldClearOnPage,
} from "./returnPoint"

test("creates, serializes, and parses verse and study return points", () => {
  const verse = makeVersePoint("02-出埃及記/第12章", 6, 123)
  const study = makeStudyPoint("02-出埃及記/第12章", "本章整理", 124)
  assert.deepEqual(verse, { v: 1, slug: "02-出埃及記/第12章", kind: "verse", verse: 6, t: 123 })
  assert.deepEqual(study, { v: 1, slug: "02-出埃及記/第12章", kind: "study", headingId: "本章整理", t: 124 })
  assert.deepEqual(parseReturnPoint(serializeReturnPoint(verse!)), verse)
  assert.deepEqual(parseReturnPoint(serializeReturnPoint(study!)), study)
  assert.equal(RETURN_POINT_KEY, "bwz-return-point")
})

test("accepts chapter slugs, including paths understood after URL decoding", () => {
  assert.notEqual(makeVersePoint("01-創世記/第1章", 1, 0), null)
  assert.notEqual(makeVersePoint("06-%E7%B4%84%E6%9B%B8%E4%BA%9E%E8%A8%98/%E7%AC%AC24%E7%AB%A0", 1, 0), null)
  assert.equal(makeVersePoint("link_folder/人物/亞伯拉罕", 1, 0), null)
  assert.equal(makeVersePoint("02-出埃及記/全書目錄及綱要", 1, 0), null)
  assert.equal(makeVersePoint("02-出埃及記/書卷導論", 1, 0), null)
  assert.equal(makeVersePoint("not a book/chapter", 1, 0), null)
  assert.equal(makeVersePoint("02-%E5%87%BA%E5%9F%83%E5%8F%8A%E8%A8%98/%ZZ", 1, 0), null)
})

test("accepts only integer verse numbers in the supported range", () => {
  assert.notEqual(makeVersePoint("01-創世記/第1章", 1, 0), null)
  assert.notEqual(makeVersePoint("01-創世記/第1章", 200, 0), null)
  for (const verse of [0, -1, 1.5, 201, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(makeVersePoint("01-創世記/第1章", verse, 0), null)
  }
})

test("rejects blank study ids and non-finite timestamps", () => {
  assert.equal(makeStudyPoint("01-創世記/第1章", "", 0), null)
  assert.equal(makeStudyPoint("01-創世記/第1章", "   ", 0), null)
  assert.equal(makeStudyPoint("01-創世記/第1章", "heading", Number.NaN), null)
  assert.equal(makeVersePoint("01-創世記/第1章", 1, Number.POSITIVE_INFINITY), null)
})

test("returns null for invalid JSON, versions, slugs, and variant fields", () => {
  for (const raw of [
    "{",
    "null",
    JSON.stringify({ v: 2, slug: "01-創世記/第1章", kind: "verse", verse: 1, t: 0 }),
    JSON.stringify({ v: 1, slug: "link_folder/人物/亞伯拉罕", kind: "verse", verse: 1, t: 0 }),
    JSON.stringify({ v: 1, slug: "01-創世記/第1章", kind: "verse", verse: "1", t: 0 }),
    JSON.stringify({ v: 1, slug: "01-創世記/第1章", kind: "verse", verse: 0, t: 0 }),
    JSON.stringify({ v: 1, slug: "01-創世記/第1章", kind: "study", headingId: "", t: 0 }),
    JSON.stringify({ v: 1, slug: "01-創世記/第1章", kind: "other", t: 0 }),
    JSON.stringify({ v: 1, slug: "01-創世記/第1章", kind: "verse", verse: 1, t: "0" }),
  ]) {
    assert.equal(parseReturnPoint(raw), null)
  }
  assert.equal(parseReturnPoint(null), null)
  assert.equal(parseReturnPoint(undefined), null)
})

test("formats labels from the book catalog names and chapter numbers", () => {
  const genesis = makeVersePoint("01-創世記/第1章", 6, 1)!
  const joshua = makeStudyPoint("06-約書亞記/第24章", "heading-id", 2)!
  assert.equal(returnLabel(genesis), "↩ 返回 創世記 1:6")
  assert.equal(returnAriaLabel(genesis), "回到創世記第 1 章第 6 節")
  assert.equal(returnLabel(joshua), "↩ 返回 約書亞記 24 章整理")
  assert.equal(returnAriaLabel(joshua), "回到約書亞記第 24 章的本章整理")
})

test("clears a saved point on every chapter page, but keeps it on other page kinds", () => {
  const point = makeVersePoint("02-出埃及記/第12章", 6, 1)!
  assert.equal(shouldClearOnPage(point, "02-出埃及記/第12章"), true)
  assert.equal(shouldClearOnPage(point, "01-創世記/第1章"), true)
  assert.equal(shouldClearOnPage(point, "02-出埃及記/全書目錄及綱要"), false)
  assert.equal(shouldClearOnPage(point, "02-出埃及記/書卷導論"), false)
  assert.equal(shouldClearOnPage(point, "link_folder/人物/亞伯拉罕"), false)
  assert.equal(shouldClearOnPage(point, ""), false)
  assert.equal(shouldClearOnPage(null, "02-出埃及記/第12章"), true)
})

test("encodes Chinese slugs in the return URL without adding a hash", () => {
  const point = makeVersePoint("02-出埃及記/第12章", 6, 1)!
  assert.equal(
    returnHref(point, "/bwz"),
    "/bwz/02-%E5%87%BA%E5%9F%83%E5%8F%8A%E8%A8%98/%E7%AC%AC12%E7%AB%A0",
  )
})
