import assert from "node:assert/strict"
import test from "node:test"
import { MAX_RESCROLLS_PER_STEP, SHIFT_THRESHOLD_PX, shouldRescrollAfterShift } from "./tourShift"

const base = { scrolledDocTop: 28000, nowDocTop: 28000, rescrolls: 0, followsViewport: false }

test("does nothing while the target has not moved in the document", () => {
  assert.equal(shouldRescrollAfterShift(base), false)
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 28000 + SHIFT_THRESHOLD_PX }), false)
})

test("rescrolls when content above grew or shrank (font swap, late blocks)", () => {
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 28700 }), true)
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 27000 }), true)
})

test("gives up after the per-step limit so a page that keeps changing cannot trap the reader", () => {
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 28700, rescrolls: MAX_RESCROLLS_PER_STEP - 1 }), true)
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 28700, rescrolls: MAX_RESCROLLS_PER_STEP }), false)
})

test("ignores fixed or sticky targets whose document position follows the scroll", () => {
  assert.equal(shouldRescrollAfterShift({ ...base, nowDocTop: 28700, followsViewport: true }), false)
})
