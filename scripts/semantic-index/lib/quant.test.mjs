import test from "node:test"
import assert from "node:assert/strict"
import { quantizeInt8, signBits, packEntry, unpackEntry, BITS_BYTES, ROW_BYTES } from "./quant.mjs"

test("int8：round(v*127) 並夾在 ±127", () => {
  const q = quantizeInt8(Float32Array.from([0, 1, -1, 0.5, -0.5, 2, -3, 0.003, 0.004]))
  assert.deepEqual(Array.from(q), [0, 127, -127, 64, -63, 127, -127, 0, 1])
})

test("位元：v>0 為 1，第 j 維在 byte j>>3 的 bit j&7（LSB first）", () => {
  const v = new Float32Array(16)
  v[0] = 0.1 // byte0 bit0
  v[3] = 0.2 // byte0 bit3
  v[8] = 0.3 // byte1 bit0
  v[15] = 1 // byte1 bit7
  v[1] = 0 // 0 不算正
  v[2] = -0.5
  assert.deepEqual(Array.from(signBits(v)), [0b00001001, 0b10000001])
})

test("位元由 float 算，很小的正值即使 int8 變 0 也是 1", () => {
  const v = new Float32Array(512)
  v[5] = 0.001
  const e = unpackEntry(packEntry(v))
  assert.equal(e.row[5], 0)
  assert.equal(e.bits[0], 1 << 5)
})

test("packEntry 長度與切分", () => {
  const e = packEntry(new Float32Array(512).fill(0.01))
  assert.equal(e.length, BITS_BYTES + ROW_BYTES)
  const u = unpackEntry(e)
  assert.equal(u.bits.length, 64)
  assert.equal(u.row.length, 512)
  assert.throws(() => unpackEntry(new Uint8Array(10)))
})
