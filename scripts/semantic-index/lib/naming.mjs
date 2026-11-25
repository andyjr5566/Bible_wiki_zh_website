import { createHash } from "node:crypto"

export function sha256Hex(data) {
  return createHash("sha256").update(data).digest("hex")
}

/** 檔名用的內容雜湊（前 8 個十六進位字元）。 */
export function hash8(data) {
  return sha256Hex(data).slice(0, 8)
}

export function hashedName(prefix, ext, data) {
  return `${prefix}.${hash8(data)}.${ext}`
}

/** 檔名是否為本工具產生的帶雜湊檔（用來清掉上一版的舊檔）。 */
export function isHashedOutputName(name) {
  return /^(bits|rows)\.[0-9a-f]{8}\.bin$/.test(name) || /^ids\.[0-9a-f]{8}\.json$/.test(name)
}
