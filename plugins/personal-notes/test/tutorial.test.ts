// 筆記教學（features/tutorial）：段落資料完整；沙盒不碰真正的筆記資料（D-49：示範頁不會寫進筆記）。

import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { stageSize } from "../src/client/features/tutorial/engine"
import { forDevice, SCENES } from "../src/client/features/tutorial/scenes"
import type { Step } from "../src/client/features/tutorial/engine"

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

  it("示範（電腦版與手機版）用到的 data-t 目標都有在這一段的程式裡出現（避免打錯名字）", () => {
    const src = readFileSync(path.join(DIR, "scenes.ts"), "utf8") + readFileSync(path.join(DIR, "mock.ts"), "utf8")
    const targetOf = (step: Step): string | null =>
      "move" in step ? step.move : "hover" in step ? step.hover : "click" in step ? step.click : "type" in step ? step.type : "sweep" in step ? step.sweep : "longpress" in step ? step.longpress : null
    for (const s of SCENES) {
      for (const steps of [s.demo, s.demoTouch ?? []]) {
        for (const step of steps) {
          const target = targetOf(step)
          if (!target) continue
          // 動態名稱（如 tab-${id}、cand-…）只檢查固定的前綴
          const key = target.replace(/-.*/, "")
          expect(src.includes(`"${target}"`) || src.includes(`${key}-`) || src.includes(`\`${key}`), `${s.id}: ${target}`).toBe(true)
        }
      }
    }
  })

  it("手機版的選填欄位若有寫就不能是空的；沒寫就退回電腦版", () => {
    for (const s of SCENES) {
      if (s.captionTouch !== undefined) expect(s.captionTouch.trim(), `${s.id} captionTouch`).not.toBe("")
      if (s.tryTextTouch !== undefined) expect(s.tryTextTouch.trim(), `${s.id} tryTextTouch`).not.toBe("")
      if (s.stepsTouch) expect(s.stepsTouch.length, `${s.id} stepsTouch`).toBeGreaterThanOrEqual(2)
      if (s.demoTouch) expect(s.demoTouch.length, `${s.id} demoTouch`).toBeGreaterThan(3)
      const desktop = forDevice(s, "desktop")
      expect(desktop.caption).toBe(s.caption)
      expect(desktop.demo).toBe(s.demo)
      const touch = forDevice(s, "touch")
      expect(touch.caption).toBe(s.captionTouch ?? s.caption)
      expect(touch.steps).toBe(s.stepsTouch ?? s.steps)
      expect(touch.tryText).toBe(s.tryTextTouch ?? s.tryText)
      expect(touch.demo).toBe(s.demoTouch ?? s.demo)
    }
  })

  it("「選經文」有手機版劇本：用 longpress、沒有 hover", () => {
    const select = SCENES.find((s) => s.id === "select")!
    expect(select.demoTouch).toBeDefined()
    expect(select.demoTouch!.some((st) => "longpress" in st)).toBe(true)
    expect(select.demoTouch!.some((st) => "hover" in st)).toBe(false)
  })

  it("手機版劇本都不含 hover", () => {
    for (const s of SCENES) {
      const touch = forDevice(s, "touch")
      expect(touch.demo.some((st) => "hover" in st), s.id).toBe(false)
    }
  })

  it("手機版文字符合說法，步驟數與電腦版相同", () => {
    for (const s of SCENES) {
      if (s.stepsTouch) expect(s.stepsTouch.length, `${s.id} stepsTouch`).toBe(s.steps.length)
      for (const [key, value] of Object.entries(s)) {
        if (key.endsWith("Touch") && value !== undefined) {
          expect(JSON.stringify(value) ?? "", `${s.id} ${key}`).not.toContain("滑鼠")
        }
      }
      const touch = forDevice(s, "touch")
      for (const text of [touch.caption, ...touch.steps, touch.tryText]) {
        expect(text, `${s.id}: ${text}`).not.toContain("按「")
      }
    }
    for (const id of ["select", "sticky", "quote"]) {
      const scene = SCENES.find((s) => s.id === id)!
      expect(scene.captionTouch, `${id} captionTouch`).toContain("長按")
    }
  })

  it("手機版 say 有內容", () => {
    for (const s of SCENES) {
      for (const step of [...s.demo, ...(s.demoTouch ?? [])]) {
        if ("say" in step && step.touch !== undefined) {
          expect(step.touch.trim(), `${s.id} say.touch`).not.toBe("")
        }
      }
    }
  })
})

describe("示範區尺寸", () => {
  it("電腦版 440×420 橫式", () => {
    expect(stageSize("desktop")).toEqual({ w: 440, h: 420 })
  })

  it("手機版是直式（高大於寬）", () => {
    const { w, h } = stageSize("touch")
    expect(h).toBeGreaterThan(w)
    expect(w).toBe(360)
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

  it("只有記住看到第幾段（dialog.ts）與電腦／手機選擇（device.ts）會寫 localStorage", () => {
    const writers = files.filter((f) => /localStorage\.setItem|sessionStorage\.setItem/.test(stripComments(readFileSync(path.join(DIR, f), "utf8"))))
    expect(writers.sort()).toEqual(["device.ts", "dialog.ts"].sort())
  })
})
