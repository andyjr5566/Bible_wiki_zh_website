import test from "node:test"
import assert from "node:assert/strict"
import { hash8, hashedName, isHashedOutputName, sha256Hex } from "./naming.mjs"

test("hash8 是 sha256 前 8 碼，內容相同結果相同", () => {
  assert.equal(sha256Hex("abc").slice(0, 8), "ba7816bf")
  assert.equal(hash8("abc"), "ba7816bf")
  assert.notEqual(hash8("abc"), hash8("abd"))
})

test("檔名格式與辨識", () => {
  assert.equal(hashedName("bits", "bin", "abc"), "bits.ba7816bf.bin")
  for (const n of ["bits.ba7816bf.bin", "rows.ba7816bf.bin", "ids.ba7816bf.json"]) {
    assert.ok(isHashedOutputName(n), n)
  }
  for (const n of ["manifest.json", "bits.bin", "bits.zzzzzzzz.bin", "ids.ba7816bf.bin"]) {
    assert.ok(!isHashedOutputName(n), n)
  }
})
