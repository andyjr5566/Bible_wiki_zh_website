import test from "node:test"
import assert from "node:assert/strict"
import { selectPages } from "./pages.mjs"
import { assemble } from "./assemble.mjs"
import { buildManifest, MODEL_ID } from "./manifest.mjs"
import { packEntry } from "./quant.mjs"
import { coalesceRanges } from "./ranges.mjs"
import { clusterOrder, makeRng } from "./cluster.mjs"

test("selectPages 只收 isIncluded 的頁面，依 slug 排序並算文字與鍵", () => {
  const index = {
    b: { title: "B", content: "x\ny" },
    a: { title: "A", content: "z" },
    skip: { title: "S", content: "" },
  }
  const pages = selectPages(index, (s) => s !== "skip", MODEL_ID)
  assert.deepEqual(
    pages.map((p) => p.slug),
    ["a", "b"],
  )
  assert.equal(pages[1].text, "B\nx y")
  assert.match(pages[0].key, /^[0-9a-f]{64}$/)
})

test("assemble：bits 每頁 64 bytes、rows 每頁 512 bytes，順序與 ids 一致，檔名帶雜湊", () => {
  const v1 = new Float32Array(512).fill(0.05)
  const v2 = new Float32Array(512).fill(-0.05)
  const out = assemble([
    { slug: "x", entry: packEntry(v1) },
    { slug: "y", entry: packEntry(v2) },
  ])
  assert.equal(out.bits.length, 128)
  assert.equal(out.rows.length, 1024)
  assert.equal(out.bits[0], 0xff)
  assert.equal(out.bits[64], 0)
  assert.equal(out.rows[0], 6)
  assert.equal(new Int8Array(out.rows.buffer)[512], -6)
  assert.deepEqual(JSON.parse(out.idsJson), ["x", "y"])
  assert.match(out.names.bits, /^bits\.[0-9a-f]{8}\.bin$/)
  assert.match(out.names.rows, /^rows\.[0-9a-f]{8}\.bin$/)
  assert.match(out.names.ids, /^ids\.[0-9a-f]{8}\.json$/)
})

test("buildManifest 欄位", () => {
  const m = buildManifest({ count: 2, bits: "b", rows: "r", ids: "i", assetBytes: 9 })
  assert.deepEqual(m, {
    version: 1,
    model: "Xenova/bge-small-zh-v1.5",
    dim: 512,
    count: 2,
    bits: "b",
    rows: "r",
    ids: "i",
    assetBytes: 9,
    modelPath: "model/",
    vendorPath: "vendor/",
  })
})

test("coalesceRanges：間隔 ≤ gap 就合併", () => {
  assert.deepEqual(coalesceRanges([1, 2, 3, 12, 30], 8), [
    [1, 12],
    [30, 30],
  ])
  assert.deepEqual(coalesceRanges([1, 11], 8), [
    [1, 1],
    [11, 11],
  ])
  assert.deepEqual(coalesceRanges([], 8), [])
})

test("clusterOrder：固定種子、結果是排列且可重現", () => {
  const rng = makeRng(1)
  const n = 40
  const rows = new Int8Array(n * 8)
  for (let i = 0; i < n; i++) {
    const center = i % 2 === 0 ? 1 : -1 // 兩個明顯的群
    for (let d = 0; d < 8; d++) rows[i * 8 + d] = Math.round(center * 100 + (rng() - 0.5) * 10)
  }
  const a = clusterOrder(rows, n, 8, { k: 2 })
  const b = clusterOrder(rows, n, 8, { k: 2 })
  assert.deepEqual(a, b)
  assert.deepEqual(
    [...a].sort((x, y) => x - y),
    Array.from({ length: n }, (_, i) => i),
  )
  // 同一群的頁面連續排列：奇偶性只換一次
  let switches = 0
  for (let i = 1; i < n; i++) if (a[i] % 2 !== a[i - 1] % 2) switches++
  assert.equal(switches, 1)
})
