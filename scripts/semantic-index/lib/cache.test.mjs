import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { cacheKey, readEntry, writeEntry, pruneCache } from "./cache.mjs"
import { packEntry } from "./quant.mjs"

test("快取鍵含模型與文字", () => {
  assert.equal(cacheKey("m", "t"), cacheKey("m", "t"))
  assert.notEqual(cacheKey("m", "t"), cacheKey("m2", "t"))
  assert.notEqual(cacheKey("m", "t"), cacheKey("m", "t2"))
  assert.match(cacheKey("m", "t"), /^[0-9a-f]{64}$/)
})

test("寫入、讀回、清掉沒用到的項目", () => {
  const dir = mkdtempSync(join(tmpdir(), "sem-cache-"))
  try {
    const a = cacheKey("m", "a")
    const b = cacheKey("m", "b")
    assert.equal(readEntry(dir, a), null)
    const entry = packEntry(new Float32Array(512).fill(0.02))
    writeEntry(dir, a, entry)
    writeEntry(dir, b, entry)
    assert.deepEqual(Array.from(readEntry(dir, a)), Array.from(entry))
    assert.equal(pruneCache(dir, [a]), 1)
    assert.notEqual(readEntry(dir, a), null)
    assert.equal(readEntry(dir, b), null)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
