// ULID（筆記 ID）與裝置 ID。Crockford Base32，離線產生不重複。

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"

function randomBytes(n: number): Uint8Array {
  const bytes = new Uint8Array(n)
  globalThis.crypto.getRandomValues(bytes)
  return bytes
}

function encodeRandom(len: number): string {
  const bytes = randomBytes(len)
  let out = ""
  for (let i = 0; i < len; i++) out += CROCKFORD[bytes[i] % 32]
  return out
}

function encodeTime(ms: number): string {
  let out = ""
  let t = Math.floor(ms)
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[t % 32] + out
    t = Math.floor(t / 32)
  }
  return out
}

/** 26 字元 ULID：前 10 碼時間（可排序）＋ 16 碼隨機。 */
export function ulid(now: number = Date.now()): string {
  return encodeTime(now) + encodeRandom(16)
}

export function newNoteId(now?: number): string {
  return `n_${ulid(now)}`
}

/** 裝置 ID：`d_` + 8 碼。長度固定，HLC 字串比較才正確。 */
export function newDeviceId(): string {
  return `d_${encodeRandom(8)}`
}

export const DEVICE_ID_PATTERN = /^d_[0-9A-HJKMNP-TV-Z]{8}$/
export const NOTE_ID_PATTERN = /^[nhb]_[0-9A-HJKMNP-TV-Z]{26}$/
