// 向量量化：int8 列與二元位元。格式見 dev-notes/semantic-search/README.md「檔案格式」。

export const DIM = 512
export const BITS_BYTES = DIM / 8 // 64
export const ROW_BYTES = DIM // 512

/** q = clamp(round(v * 127), -127, 127)；v 是已正規化的 float32。 */
export function quantizeInt8(vec) {
  const out = new Int8Array(vec.length)
  for (let i = 0; i < vec.length; i++) {
    const q = Math.round(vec[i] * 127)
    out[i] = q > 127 ? 127 : q < -127 ? -127 : q
  }
  return out
}

/** 第 j 維 v[j] > 0 為 1，放在 byte (j >> 3) 的 bit (j & 7)（LSB first）。 */
export function signBits(vec) {
  const out = new Uint8Array(Math.ceil(vec.length / 8))
  for (let j = 0; j < vec.length; j++) {
    if (vec[j] > 0) out[j >> 3] |= 1 << (j & 7)
  }
  return out
}

/** 快取項目 = 64 bytes 位元 + 512 bytes int8（位元要由 float 算，所以一起存）。 */
export function packEntry(vec) {
  const entry = new Uint8Array(BITS_BYTES + ROW_BYTES)
  entry.set(signBits(vec), 0)
  entry.set(new Uint8Array(quantizeInt8(vec).buffer), BITS_BYTES)
  return entry
}

export function unpackEntry(entry) {
  if (entry.length !== BITS_BYTES + ROW_BYTES) {
    throw new Error(`快取項目長度不對：${entry.length}`)
  }
  return { bits: entry.subarray(0, BITS_BYTES), row: entry.subarray(BITS_BYTES) }
}
