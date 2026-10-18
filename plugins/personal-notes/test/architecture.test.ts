// 架構規則（dev-notes/personal-notes/11-code-structure.md §2）。違反時測試失敗，避免程式結構慢慢變亂。

import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, it } from "vitest"
import { FEATURES, viewFactories } from "../src/client/features"

const ROOT = fileURLToPath(new URL("../src/client/", import.meta.url))

/** 每一層可以 import 哪些層（同層一律可以）。app.ts 是組裝根，不受限制。 */
const ALLOWED: Record<string, string[]> = {
  model: [],
  merge: ["model"],
  store: ["model"],
  repo: ["model", "merge", "store"],
  adapter: ["model"],
  sync: ["model", "merge", "store", "repo", "adapter"],
  auth: [],
  session: ["model", "store", "repo", "adapter", "sync", "auth"],
  ui: ["model", "merge", "repo", "sync", "session"],
  features: ["model", "merge", "repo", "session", "ui"],
}

/** 這些層不可使用瀏覽器全域物件：才能在 Node 測試，也避免把畫面邏輯混進資料層。 */
const DOM_FREE = new Set(["model", "merge", "store", "repo", "adapter", "sync", "session"])
const DOM_EXCEPTIONS = new Set(["sync/scheduler.ts"]) // 排程器本來就是瀏覽器端的計時與分頁協調
const DOM_GLOBALS = /\b(document|window|localStorage|sessionStorage|location|navigator)\s*[.?[]/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : /\.tsx?$/.test(name) ? [full] : []
  })
}

const rel = (full: string) => path.relative(ROOT, full).split(path.sep).join("/")
const layerOf = (relPath: string) => (relPath.includes("/") ? relPath.split("/")[0] : "app")
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

const files = walk(ROOT).map((full) => {
  const src = readFileSync(full, "utf8")
  const imports = [...src.matchAll(/(?:from|import)\s*\(?\s*["'](\.{1,2}\/[^"']+)["']/g)].map((m) =>
    rel(path.resolve(path.dirname(full), m[1])).replace(/\.tsx?$/, ""),
  )
  return { path: rel(full), layer: layerOf(rel(full)), src, imports }
})

describe("架構規則", () => {
  it("每個檔案都屬於已知的層", () => {
    const unknown = files.filter((f) => f.layer !== "app" && !(f.layer in ALLOWED)).map((f) => f.path)
    expect(unknown).toEqual([])
  })

  it("只依賴允許的下層（資料 → 同步 → 帳號 → 畫面，不可反向）", () => {
    const violations: string[] = []
    for (const f of files) {
      if (f.layer === "app") continue
      for (const target of f.imports) {
        const t = layerOf(target)
        if (t === "app") violations.push(`${f.path} → ${target}（不可 import 組裝根）`)
        else if (t !== f.layer && !ALLOWED[f.layer].includes(t)) violations.push(`${f.path} → ${target}`)
      }
    }
    expect(violations).toEqual([])
  })

  it("功能模組彼此獨立：只能用自己資料夾和 features/types", () => {
    const violations: string[] = []
    for (const f of files) {
      const m = /^features\/([^/]+)\//.exec(f.path)
      if (!m) continue
      for (const target of f.imports) {
        if (!target.startsWith("features/")) continue
        if (target === "features/types" || target.startsWith(`features/${m[1]}/`)) continue
        violations.push(`${f.path} → ${target}`)
      }
    }
    expect(violations).toEqual([])
  })

  it("資料、同步、帳號層不碰瀏覽器全域物件", () => {
    const violations = files
      .filter((f) => DOM_FREE.has(f.layer) && !DOM_EXCEPTIONS.has(f.path) && DOM_GLOBALS.test(stripComments(f.src)))
      .map((f) => f.path)
    expect(violations).toEqual([])
  })

  it("功能模組登記正確：id 不重複，頁面上的掛載點都有畫面", () => {
    const ids = FEATURES.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    // src/components/PersonalNotes.tsx 輸出的掛載點種類
    for (const kind of ["chapter", "mynotes"]) expect(viewFactories(kind).length).toBeGreaterThan(0)
  })
})
