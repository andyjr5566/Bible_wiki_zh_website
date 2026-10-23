import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import test from "node:test"
import { clearInteractiveRegistryCache, loadInteractiveRegistry } from "./interactiveSitesLoader"

function makeRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "interactive-sites-"))
}

function writeFile(root: string, relativePath: string, content: string): void {
  const filePath = path.join(root, relativePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, "utf8")
}

function writeSite(
  root: string,
  key: string,
  options: { appendix?: string; dist?: boolean } = {},
): void {
  const sitePath = path.join(root, "quartz", "static", "website", ...key.split("/"))
  fs.mkdirSync(sitePath, { recursive: true })
  fs.writeFileSync(
    path.join(sitePath, "index.html"),
    `<title>${key.split("/").at(-1)}</title><meta name="description" content="描述">`,
    "utf8",
  )
  if (options.appendix !== undefined) {
    fs.writeFileSync(path.join(sitePath, "appendix-chapters.json"), options.appendix, "utf8")
  }
  if (options.dist) {
    const distPath = path.join(sitePath, "dist")
    fs.mkdirSync(distPath, { recursive: true })
    fs.writeFileSync(path.join(distPath, "index.html"), "<html></html>", "utf8")
  }
}

function writeConfig(root: string, value: unknown): void {
  writeFile(root, "config/interactive-sites.json", JSON.stringify(value))
}

test("loads book and wide sites, overrides, cover files, warnings, and skipped folders", (t) => {
  clearInteractiveRegistryCache()
  const root = makeRepo()
  t.after(() => {
    clearInteractiveRegistryCache()
    fs.rmSync(root, { recursive: true, force: true })
  })

  writeSite(root, "創世記/第6章", {
    appendix: JSON.stringify(["第7章", "第8章"]),
    dist: true,
  })
  writeSite(root, "摩西五經/律法地圖", {
    appendix: JSON.stringify({ toc_only: true, chapters: ["創世記/第1章"] }),
  })
  writeSite(root, "出埃及記/第20章", { appendix: "{ 壞掉的 JSON" })
  writeSite(root, ".hidden/網站")
  writeSite(root, "__pycache__/網站")
  writeSite(root, "創世記_backup_old/網站")
  writeSite(root, "摩西五經/_backup_舊網站")

  const coverPath = path.join(
    root,
    "quartz",
    "static",
    "interactive-covers",
    "創世記-第6章.webp",
  )
  fs.mkdirSync(path.dirname(coverPath), { recursive: true })
  fs.writeFileSync(coverPath, "cover", "utf8")
  writeConfig(root, {
    sites: {
      "創世記/第6章": {
        type: "場景導覽",
        extraChapters: ["創世記/第9章"],
      },
      "不存在/網站": { type: "查詢工具" },
    },
  })

  const registry = loadInteractiveRegistry(root)
  const ark = registry.sites.find((site) => site.key === "創世記/第6章")
  const map = registry.sites.find((site) => site.key === "摩西五經/律法地圖")
  const malformed = registry.sites.find((site) => site.key === "出埃及記/第20章")

  assert.equal(registry.sites.length, 3)
  assert.equal(ark?.type, "場景導覽")
  assert.deepEqual(ark?.chapters.map((ref) => ref.chapter), [6, 7, 8, 9])
  assert.equal(ark?.hasCover, true)
  assert.equal(ark?.hasDist, true)
  assert.equal(map?.scope, "wide")
  assert.equal(map?.hasCover, false)
  assert.equal(map?.hasDist, false)
  assert.deepEqual(map?.chapters, [{ book: 1, chapter: 1 }])
  assert.deepEqual(malformed?.chapters, [{ book: 2, chapter: 20 }])
  assert.ok(registry.warnings.some((warning) => warning.includes("appendix-chapters.json")))
  assert.ok(registry.warnings.some((warning) => warning.includes("不存在/網站")))
  assert.ok(registry.sites.every((site) => !site.key.startsWith(".") && !site.key.includes("_backup_")))
  assert.ok(registry.sites.every((site) => !site.key.startsWith("__pycache__")))
})

test("missing website folders and invalid JSON return warnings without throwing", (t) => {
  clearInteractiveRegistryCache()
  const root = makeRepo()
  t.after(() => {
    clearInteractiveRegistryCache()
    fs.rmSync(root, { recursive: true, force: true })
  })

  writeConfig(root, { sites: {} })
  const registry = loadInteractiveRegistry(root)
  assert.deepEqual(registry.sites, [])
  assert.ok(registry.warnings.some((warning) => warning.includes("website")))

  const brokenRoot = makeRepo()
  t.after(() => {
    clearInteractiveRegistryCache()
    fs.rmSync(brokenRoot, { recursive: true, force: true })
  })
  fs.mkdirSync(path.join(brokenRoot, "quartz", "static", "website"), { recursive: true })
  writeFile(brokenRoot, "config/interactive-sites.json", "{ broken")
  const broken = loadInteractiveRegistry(brokenRoot)
  assert.deepEqual(broken.sites, [])
  assert.ok(broken.warnings.some((warning) => warning.includes("補充檔")))
})

test("caches each repository root until the cache is cleared", (t) => {
  clearInteractiveRegistryCache()
  const root = makeRepo()
  t.after(() => {
    clearInteractiveRegistryCache()
    fs.rmSync(root, { recursive: true, force: true })
  })

  fs.mkdirSync(path.join(root, "quartz", "static", "website"), { recursive: true })
  writeConfig(root, { sites: {} })
  const first = loadInteractiveRegistry(root)
  writeSite(root, "創世記/第1章", { dist: true })

  const cached = loadInteractiveRegistry(root)
  assert.equal(cached, first)
  assert.equal(cached.sites.length, 0)

  clearInteractiveRegistryCache()
  const refreshed = loadInteractiveRegistry(root)
  assert.equal(refreshed.sites.length, 1)
  assert.equal(refreshed.sites[0].key, "創世記/第1章")
})
