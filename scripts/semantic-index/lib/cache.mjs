import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { sha256Hex } from "./naming.mjs"
import { BITS_BYTES, ROW_BYTES } from "./quant.mjs"

/** 快取鍵：sha256(model + "\n" + text)。換模型或改文字規則都會自然失效。 */
export function cacheKey(model, text) {
  return sha256Hex(`${model}\n${text}`)
}

function entryPath(dir, key) {
  return join(dir, key.slice(0, 2), `${key}.bin`)
}

export function readEntry(dir, key) {
  const file = entryPath(dir, key)
  if (!existsSync(file)) return null
  const buf = readFileSync(file)
  return buf.length === BITS_BYTES + ROW_BYTES ? new Uint8Array(buf) : null
}

export function writeEntry(dir, key, entry) {
  const file = entryPath(dir, key)
  mkdirSync(join(dir, key.slice(0, 2)), { recursive: true })
  writeFileSync(file, entry)
}

/** 刪掉這次沒用到的項目（頁面刪除或文字改過），免得快取無限長大。回傳刪除筆數。 */
export function pruneCache(dir, usedKeys) {
  if (!existsSync(dir)) return 0
  const used = new Set(usedKeys)
  let removed = 0
  for (const shard of readdirSync(dir, { withFileTypes: true })) {
    if (!shard.isDirectory()) continue
    for (const name of readdirSync(join(dir, shard.name))) {
      if (!name.endsWith(".bin")) continue
      if (!used.has(name.slice(0, -4))) {
        rmSync(join(dir, shard.name, name))
        removed++
      }
    }
  }
  return removed
}
