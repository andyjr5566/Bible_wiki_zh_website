// 讀取 config/source-names.yaml 的薄外層：快取解析結果，避免建置每一頁重複讀檔；
// 檔案不存在或格式錯誤時直接拋出清楚訊息讓建置失敗，不默默忽略。
import * as fs from "node:fs"
import * as path from "node:path"
import { parseSourceNamesYaml, type SourceNamesRegistry } from "./sourceNames"

const registryCache = new Map<string, SourceNamesRegistry>()

export function clearSourceNamesCache(): void {
  registryCache.clear()
}

export function loadSourceNames(repoRoot = process.cwd()): SourceNamesRegistry {
  const filePath = path.resolve(repoRoot, "config", "source-names.yaml")
  const cached = registryCache.get(filePath)
  if (cached) return cached

  let raw: string
  try {
    raw = fs.readFileSync(filePath, "utf8")
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`無法讀取來源名稱設定檔 ${filePath}：${message}`)
  }

  const registry = parseSourceNamesYaml(raw)
  registryCache.set(filePath, registry)
  return registry
}
