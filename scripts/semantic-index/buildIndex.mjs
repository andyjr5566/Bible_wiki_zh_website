#!/usr/bin/env node
// 知識庫語意搜尋索引建置。用法與格式見 scripts/semantic-index/README.md 與 dev-notes/semantic-search/README.md。
//   npx tsx scripts/semantic-index/buildIndex.mjs [--out public] [--cache .semantic-cache] [--cluster]
// 用 tsx 執行是為了能直接 import searchLogic.ts 的 getKnowledgeSearchCategory（收錄規則只在那裡一份）。
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  rmSync,
  copyFileSync,
  statSync,
} from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { getKnowledgeSearchCategory } from "../../plugins/semantic-search/src/components/searchLogic.ts"
import { MODEL_ID, buildManifest } from "./lib/manifest.mjs"
import { selectPages } from "./lib/pages.mjs"
import { readEntry, writeEntry, pruneCache } from "./lib/cache.mjs"
import { packEntry, DIM, ROW_BYTES } from "./lib/quant.mjs"
import { assemble } from "./lib/assemble.mjs"
import { clusterOrder } from "./lib/cluster.mjs"
import { isHashedOutputName } from "./lib/naming.mjs"
import { embedTexts, ensureModelFiles, MODEL_FILES } from "./embedder.mjs"

function parseArgs(argv) {
  const opts = { out: "public", cache: ".semantic-cache", cluster: false, prune: true }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === "--out") opts.out = argv[++i]
    else if (a === "--cache") opts.cache = argv[++i]
    else if (a === "--cluster") opts.cluster = true
    else if (a === "--no-prune") opts.prune = false
    else throw new Error(`不認得的參數：${a}`)
  }
  return opts
}

// 兩個套件的 package.json 都不開放 require.resolve，所以直接用 repo 根目錄的 node_modules 路徑
const here = dirname(fileURLToPath(import.meta.url))
function pkgDir(name) {
  return join(here, "..", "..", "node_modules", ...name.split("/"))
}

// 瀏覽器端實際會載入的執行環境檔（transformers.js 已內含 onnxruntime-web 的 JS，只缺 wasm 與其載入器）
function vendorFiles() {
  const hf = pkgDir("@huggingface/transformers")
  const ort = pkgDir("onnxruntime-web")
  return [
    { from: join(hf, "dist", "transformers.min.js"), to: "transformers.min.js" },
    { from: join(ort, "dist", "ort-wasm-simd-threaded.mjs"), to: "ort-wasm-simd-threaded.mjs" },
    { from: join(ort, "dist", "ort-wasm-simd-threaded.wasm"), to: "ort-wasm-simd-threaded.wasm" },
  ]
}

function copyInto(destRoot, relTo, from) {
  const to = join(destRoot, relTo)
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
  return statSync(to).size
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const staticDir = join(opts.out, "static")
  const outDir = join(staticDir, "semantic")
  const index = JSON.parse(readFileSync(join(staticDir, "contentIndex.json"), "utf8"))

  const pages = selectPages(index, (slug) => getKnowledgeSearchCategory(slug) !== null, MODEL_ID)
  if (pages.length === 0) throw new Error("沒有任何頁面符合收錄規則，不輸出索引")

  // 增量：快取有的直接用，其餘才嵌入
  const entries = new Map()
  const todo = []
  for (const p of pages) {
    const hit = readEntry(opts.cache, p.key)
    if (hit) entries.set(p.key, hit)
    else todo.push(p)
  }
  const reused = pages.length - todo.length
  if (todo.length > 0) {
    const t0 = Date.now()
    const vecs = await embedTexts(
      todo.map((p) => p.text),
      {
        onProgress: (done, total) => {
          if (done === total || done % 320 === 0) console.log(`  嵌入 ${done}/${total}`)
        },
      },
    )
    todo.forEach((p, i) => {
      const entry = packEntry(vecs[i])
      writeEntry(opts.cache, p.key, entry)
      entries.set(p.key, entry)
    })
    console.log(`嵌入耗時 ${((Date.now() - t0) / 1000).toFixed(1)} 秒`)
  }
  console.log(`頁面 ${pages.length}：新嵌入 ${todo.length}、沿用快取 ${reused}`)

  // 同文字的頁面共用同一個快取鍵，所以這裡用 slug 逐頁取項目
  let ordered = pages.map((p) => ({ slug: p.slug, entry: entries.get(p.key) }))
  if (opts.cluster) {
    const rows = new Int8Array(ordered.length * DIM)
    ordered.forEach((o, i) =>
      rows.set(new Int8Array(o.entry.buffer, o.entry.byteOffset + 64, ROW_BYTES), i * DIM),
    )
    const order = clusterOrder(rows, ordered.length, DIM)
    ordered = order.map((i) => ordered[i])
  }
  const { bits, rows, idsJson, names } = assemble(ordered)

  // 模型與執行環境
  const modelSrc = await ensureModelFiles()
  rmSync(join(outDir, "model"), { recursive: true, force: true })
  rmSync(join(outDir, "vendor"), { recursive: true, force: true })
  let assetBytes = 0
  for (const f of MODEL_FILES) {
    assetBytes += copyInto(outDir, `model/${MODEL_ID}/${f}`, join(modelSrc, f))
  }
  for (const v of vendorFiles()) assetBytes += copyInto(outDir, `vendor/${v.to}`, v.from)

  // 清掉上一版的帶雜湊檔，再寫新檔；manifest 最後寫，避免讀到一半的狀態
  mkdirSync(outDir, { recursive: true })
  for (const name of readdirSync(outDir)) if (isHashedOutputName(name)) rmSync(join(outDir, name))
  writeFileSync(join(outDir, names.bits), bits)
  writeFileSync(join(outDir, names.rows), rows)
  writeFileSync(join(outDir, names.ids), idsJson)
  const manifest = buildManifest({ count: ordered.length, ...names, assetBytes })
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")

  if (opts.prune) {
    const removed = pruneCache(
      opts.cache,
      pages.map((p) => p.key),
    )
    if (removed) console.log(`清掉沒用到的快取 ${removed} 筆`)
  }
  console.log(
    `輸出 ${outDir}：bits ${bits.length} B、rows ${rows.length} B、ids ${idsJson.length} B、第一次需下載 ${(assetBytes / 1048576).toFixed(1)} MB`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
