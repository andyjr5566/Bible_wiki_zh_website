// 筆記面板「?」小說明的內容資料：7 行、每行都有圖示與文字，並涵蓋主要功能名稱。

import { describe, expect, it } from "vitest"
import { helpLines, HELP_LINES } from "../src/client/features/notes/helpGuide"

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

  it("觸控版的選取說明使用長按，桌面版使用滑鼠", () => {
    const touch = helpLines("touch")
    const desktop = helpLines("desktop")
    for (const icon of ["🖍", "❝"]) {
      expect(touch.find((line) => line.icon === icon)?.text).toContain("長按")
    }
    expect(desktop.find((line) => line.icon === "🖍")?.text).toContain("滑鼠")
    expect(desktop.find((line) => line.icon === "❝")?.text).toContain("滑鼠")
  })

  it("其餘四行（🗒️、🔗、📚、☁️）在兩種裝置版本中相同，兩種版本都各有七行", () => {
    const touch = helpLines("touch")
    const desktop = helpLines("desktop")
    expect(touch).toHaveLength(7)
    expect(desktop).toHaveLength(7)
    for (const icon of ["🗒️", "🔗", "📚", "☁️"]) {
      expect(touch.find((line) => line.icon === icon)).toEqual(desktop.find((line) => line.icon === icon))
    }
    expect(touch.find((line) => line.icon === "📝")?.text).toMatch(/^點「＋ 新增筆記」/)
  })
})
