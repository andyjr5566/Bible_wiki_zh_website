import * as fs from "node:fs"
import * as path from "node:path"
import { buildRegistry, coverFileName } from "./interactiveSites"
import type { InteractiveRegistry, SiteFiles, SiteOverride } from "./interactiveSites"

const registryCache = new Map<string, InteractiveRegistry>()

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function shouldSkipDirectory(name: string): boolean {
  return name.startsWith(".") || name === "__pycache__" || name.includes("_backup_")
}

export function clearInteractiveRegistryCache(): void {
  registryCache.clear()
}

export function loadInteractiveRegistry(repoRoot = process.cwd()): InteractiveRegistry {
  const resolvedRoot = path.resolve(repoRoot)
  const cached = registryCache.get(resolvedRoot)
  if (cached) return cached

  const warnings: string[] = []
  const overrides: Record<string, SiteOverride> = {}
  const files: SiteFiles[] = []
  const configPath = path.join(resolvedRoot, "config", "interactive-sites.json")
  const websiteRoot = path.join(resolvedRoot, "quartz", "static", "website")
  const coversRoot = path.join(resolvedRoot, "quartz", "static", "interactive-covers")

  try {
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as unknown
    if (!isRecord(config) || !isRecord(config.sites)) {
      warnings.push("互動網站補充檔的 sites 欄位不是物件。")
    } else {
      for (const [key, value] of Object.entries(config.sites)) {
        if (!isRecord(value)) {
          warnings.push(`網站「${key}」的補充設定不是物件，已略過。`)
          continue
        }
        overrides[key] = value as SiteOverride
      }
    }
  } catch (error) {
    warnings.push(`讀取互動網站補充檔失敗：${errorMessage(error)}`)
  }

  try {
    const folders = fs.readdirSync(websiteRoot, { withFileTypes: true })
    for (const folder of folders) {
      if (!folder.isDirectory() || shouldSkipDirectory(folder.name)) continue

      const folderPath = path.join(websiteRoot, folder.name)
      let websites: fs.Dirent[]
      try {
        websites = fs.readdirSync(folderPath, { withFileTypes: true })
      } catch (error) {
        warnings.push(`讀取網站資料夾「${folder.name}」失敗：${errorMessage(error)}`)
        continue
      }

      for (const website of websites) {
        if (!website.isDirectory() || shouldSkipDirectory(website.name)) continue

        const key = `${folder.name}/${website.name}`
        const sitePath = path.join(folderPath, website.name)
        const indexPath = path.join(sitePath, "index.html")
        if (!fs.existsSync(indexPath)) continue

        let indexHtml: string
        try {
          indexHtml = fs.readFileSync(indexPath, "utf8")
        } catch (error) {
          warnings.push(`讀取網站「${key}」的 index.html 失敗：${errorMessage(error)}`)
          continue
        }

        let appendixChapters: unknown | undefined
        const appendixPath = path.join(sitePath, "appendix-chapters.json")
        if (fs.existsSync(appendixPath)) {
          try {
            appendixChapters = JSON.parse(fs.readFileSync(appendixPath, "utf8")) as unknown
          } catch (error) {
            warnings.push(`讀取網站「${key}」的 appendix-chapters.json 失敗：${errorMessage(error)}`)
          }
        }

        const coverPath = path.join(coversRoot, coverFileName(key))
        const distPath = path.join(sitePath, "dist", "index.html")
        files.push({
          key,
          indexHtml,
          appendixChapters,
          hasDist: fs.existsSync(distPath),
          hasCover: fs.existsSync(coverPath),
        })
      }
    }
  } catch (error) {
    warnings.push(`讀取互動網站資料夾失敗：${errorMessage(error)}`)
  }

  let registry: InteractiveRegistry
  try {
    registry = buildRegistry(files, overrides)
    registry.warnings.unshift(...warnings)
  } catch (error) {
    registry = {
      sites: [],
      warnings: [...warnings, `建立互動網站清單失敗：${errorMessage(error)}`],
    }
  }

  registryCache.set(resolvedRoot, registry)
  return registry
}
