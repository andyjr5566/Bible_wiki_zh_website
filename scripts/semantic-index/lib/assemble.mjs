import { BITS_BYTES, ROW_BYTES, unpackEntry } from "./quant.mjs"
import { hashedName } from "./naming.mjs"

/**
 * 把依「最終順序」排好的項目組成輸出檔內容。
 * @param ordered { slug, entry: Uint8Array(576) }[]
 */
export function assemble(ordered) {
  const n = ordered.length
  const bits = new Uint8Array(n * BITS_BYTES)
  const rows = new Uint8Array(n * ROW_BYTES)
  ordered.forEach(({ entry }, i) => {
    const u = unpackEntry(entry)
    bits.set(u.bits, i * BITS_BYTES)
    rows.set(u.row, i * ROW_BYTES)
  })
  const idsJson = JSON.stringify(ordered.map((o) => o.slug))
  return {
    bits,
    rows,
    idsJson,
    names: {
      bits: hashedName("bits", "bin", bits),
      rows: hashedName("rows", "bin", rows),
      ids: hashedName("ids", "json", idsJson),
    },
  }
}
