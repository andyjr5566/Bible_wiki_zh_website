import assert from "node:assert/strict"
import test from "node:test"
import { normalizeSearchSlug } from "./slug.js"

test("normalizeSearchSlug follows Quartz URL normalization", () => {
  assert.equal(normalizeSearchSlug("01 創世記/第1章.md"), "01-創世記/第1章")
  assert.equal(normalizeSearchSlug("人物\\比撒列（Bezalel）"), "人物/比撒列（bezalel）")
  assert.equal(normalizeSearchSlug("foo/foo.md"), "foo/index")
})

test("normalizeSearchSlug rejects missing paths", () => {
  assert.equal(normalizeSearchSlug(undefined), null)
  assert.equal(normalizeSearchSlug("  /  "), null)
})
