import test from "node:test"
import assert from "node:assert/strict"
import { pageText, BODY_CHARS } from "./text.mjs"

test("標題 + 換行 + 內文，內文換行改空白", () => {
  assert.equal(pageText("標題", "第一行\n第二行\r\n第三行"), "標題\n第一行 第二行 第三行")
})

test("內文只取前 400 個字", () => {
  const out = pageText("t", "字".repeat(1000))
  assert.equal(out, "t\n" + "字".repeat(BODY_CHARS))
})

test("以 code point 計算，不切斷代理對", () => {
  const out = pageText("t", "𠀀".repeat(500))
  assert.equal(Array.from(out.split("\n")[1]).length, 400)
})

test("缺內文或標題時不丟錯", () => {
  assert.equal(pageText(undefined, undefined), "\n")
})
