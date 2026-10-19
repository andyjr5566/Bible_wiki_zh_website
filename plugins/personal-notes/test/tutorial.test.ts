// 筆記教學（features/tutorial）：段落資料完整；沙盒不碰真正的筆記資料（D-49：示範頁不會寫進筆記）。

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { SCENES } from "../src/client/features/tutorial/scenes"

const DIR = fileURLToPath(new URL("../src/client/features/tutorial/", import.meta.url))
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("教學段落資料", () => {
  it("有 8 段，代號不重複", () => {
    expect(SCENES).toHaveLength(8)
    const ids = SCENES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id).toMatch(/^[a-z]+$/)
  })

  it("每段都有標題、說明、至少 2 條步驟（減少動態效果時顯示）", () => {
    for (const s of SCENES) {
      expect(s.title.trim(), `${s.id} title`).not.toBe("")
      expect(s.caption.trim(), `${s.id} caption`).not.toBe("")
      expect(s.steps.length, `${s.id} steps`).toBeGreaterThanOrEqual(2)
      for (const step of s.steps) expect(step.trim()).not.toBe("")
    }
  })

  it("每段都有「換你試試」的說明與提示目標、示範動作與 build", () => {
    for (const s of SCENES) {
      expect(s.tryText.trim(), `${s.id} tryText`).not.toBe("")
      expect(s.tryTarget.trim(), `${s.id} tryTarget`).not.toBe("")
      expect(typeof s.build).toBe("function")
      expect(s.demo.length, `${s.id} demo`).toBeGreaterThan(3)
    }
  })

  it("示範用到的 data-t 目標都有在這一段的程式裡出現（避免打錯名字）", () => {
    const src = readFileSync(path.join(DIR, "scenes.ts"), "utf8") + readFileSync(path.join(DIR, "mock.ts"), "utf8")
    for (const s of SCENES) {
      for (const step of s.demo) {
        const target = "move" in step ? step.move : "hover" in step ? step.hover : "click" in step ? step.click : "type" in step ? step.type : "sweep" in step ? step.sweep : null
        if (!target) continue
        // 動態名稱（如 tab-${id}、cand-…）只檢查固定的前綴
        const key = target.replace(/-.*/, "")
        expect(src.includes(`"${target}"`) || src.includes(`${key}-`) || src.includes(`\`${key}`), `${s.id}: ${target}`).toBe(true)
      }
    }
  })
})

describe("沙盒隔離", () => {
  const files = readdirSync(DIR).filter((f) => f.endsWith(".ts"))

  it("教學模組不 import 資料層、不讀寫筆記資料", () => {
    for (const f of files) {
      const src = stripComments(readFileSync(path.join(DIR, f), "utf8"))
      expect(src, f).not.toContain("repo.")
      expect(src, f).not.toContain("session.repo")
      expect(src, f).not.toMatch(/from\s+["']\.\.\/\.\.\/(repo|store|sync|adapter|auth|merge)\//)
      expect(src, f).not.toMatch(/indexedDB|fetch\(|XMLHttpRequest|sendBeacon/)
    }
  })

  it("只有「記住看到第幾段」會寫 localStorage（dialog.ts 一處）", () => {
    const writers = files.filter((f) => /localStorage\.setItem|sessionStorage\.setItem/.test(stripComments(readFileSync(path.join(DIR, f), "utf8"))))
    expect(writers).toEqual(["dialog.ts"])
  })
})
