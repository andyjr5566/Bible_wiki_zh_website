// 筆記面板「?」小說明的內容資料：7 行、每行都有圖示與文字，並涵蓋主要功能名稱。

import { describe, expect, it } from "vitest"
import { HELP_LINES } from "../src/client/features/notes/helpGuide"

describe("筆記怎麼用（?小說明）內容", () => {
  it("有 7 行，每行都有圖示與文字", () => {
    expect(HELP_LINES).toHaveLength(7)
    for (const line of HELP_LINES) {
      expect(line.icon.trim(), "icon").not.toBe("")
      expect(line.text.trim(), "text").not.toBe("")
    }
  })

  it("涵蓋主要功能：新增筆記、工具列、便條、[[ 連結、引用到筆記、我的筆記、Google", () => {
    const all = HELP_LINES.map((l) => l.text).join("\n")
    for (const word of ["新增筆記", "工具列", "便條", "[[", "引用到筆記", "我的筆記", "Google"]) {
      expect(all, word).toContain(word)
    }
  })
})
