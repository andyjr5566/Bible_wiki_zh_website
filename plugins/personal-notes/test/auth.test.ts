import { describe, expect, it } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import { tokenErrorMessage } from "../src/client/auth/gis"

describe("Google 授權錯誤訊息（12 A4：應用程式已是正式版）", () => {
  it("拒絕授權時說明怎麼重試，不再提試用名單", () => {
    const m = tokenErrorMessage("access_denied")
    expect(m).toContain("授權")
    expect(m).toContain("重試")
    expect(m).not.toContain("試用")
  })

  it("其他錯誤沿用 Google 的說明", () => {
    expect(tokenErrorMessage("invalid_request", "bad request")).toBe("bad request")
    expect(tokenErrorMessage("invalid_request")).toBe("invalid_request")
  })

  it("使用者看得到的程式碼裡沒有「試用」字樣", () => {
    const files: string[] = []
    const walk = (d: string) => {
      for (const f of readdirSync(d)) {
        const p = join(d, f)
        if (statSync(p).isDirectory()) walk(p)
        else if (/\.(ts|tsx|scss)$/.test(f)) files.push(p)
      }
    }
    walk(join(__dirname, "../src"))
    const hits = files.filter((f) =>
      readFileSync(f, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\/?\*)/.test(line)) // 註解不算
        .some((line) => /(?<!測)試用/.test(line)),
    )
    expect(hits).toEqual([])
  })
})
