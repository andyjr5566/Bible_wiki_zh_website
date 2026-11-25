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
    "link_folder/人物/b": { title: "B", content: "一二三四五\n六七八九十" },
    "appendix/a": { title: "A", content: "甲乙丙丁戊己庚辛壬癸" },
    "link_folder/人物/skip": { title: "S", content: "甲乙丙丁戊己庚辛壬癸" },
  }
  const pages = selectPages(index, (s) => !s.endsWith("skip"), MODEL_ID)
  assert.deepEqual(
    pages.map((p) => p.slug),
    ["appendix/a", "link_folder/人物/b"],
  )
  assert.equal(pages[1].text, "B\n一二三四五 六七八九十")
  assert.match(pages[0].key, /^[0-9a-f]{64}$/)
})

test("selectPages 只收知識庫（link_folder、appendix）：標籤頁、我的筆記、教學、說明頁不收", () => {
  const body = "一二三四五 六七八九十"
  const index = {
    "tags/搜尋": { title: "搜尋", content: body },
    "my-notes": { title: "我的筆記", content: body },
    "教學/快速入門": { title: "快速入門", content: body },
    資料來源: { title: "資料來源", content: body },
    "link_folder/新資料夾/條目": { title: "條目", content: body },
    "link_folder/%E4%BA%BA%E7%89%A9/x": { title: "編碼過的", content: body },
    "appendix/fhl_maps/maps/203": { title: "民表一c", content: body },
  }
  const pages = selectPages(index, () => true, MODEL_ID)
  assert.deepEqual(
    pages.map((p) => p.slug),
    ["appendix/fhl_maps/maps/203", "link_folder/%E4%BA%BA%E7%89%A9/x", "link_folder/新資料夾/條目"],
  )
})

test("selectPages 略過內文是空的或太短的知識條目", () => {
  const index = {
    "link_folder/人物/空": { title: "空", content: "  \n " },
    "link_folder/人物/短": { title: "短", content: "一二三四五六七八九" },
    "link_folder/人物/夠長": { title: "夠長", content: "一二三四五 六七八九十" },
  }
  const pages = selectPages(index, () => true, MODEL_ID)
  assert.deepEqual(
    pages.map((p) => p.slug),
    ["link_folder/人物/夠長"],
  )
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
