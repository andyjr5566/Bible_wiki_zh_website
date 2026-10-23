import { appendFileSync } from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { checkRegistry } from "./interactiveSites"
import type { InteractiveRegistry } from "./interactiveSites"
import { loadInteractiveRegistry } from "./interactiveSitesLoader"

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function escapeCommandData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").trim()
}

export function formatInteractiveSummary(
  registry: InteractiveRegistry,
  messages: readonly string[],
): string[] {
  const lines = [
    "## 互動網站檢查",
    "",
    `- 網站總數：${registry.sites.length}`,
    "",
    "| 網站 | 類型 | 涵蓋章數 | 封面 | dist |",
    "| --- | --- | ---: | --- | --- |",
  ]

  if (registry.sites.length === 0) {
    lines.push("| （無） | — | 0 | — | — |")
  } else {
    for (const site of registry.sites) {
      lines.push(
        `| ${escapeMarkdownCell(site.key)} | ${escapeMarkdownCell(site.type ?? "—")} | ${site.chapters.length} | ${site.hasCover ? "有" : "缺少"} | ${site.hasDist ? "有" : "缺少"} |`,
      )
    }
  }

  lines.push("", "### 訊息")
  if (messages.length === 0) {
    lines.push("全部通過")
  } else {
    for (const message of messages) {
      lines.push(`- ${escapeMarkdownCell(message)}`)
    }
  }

  lines.push("")
  return lines
}

function printWarning(message: string): void {
  console.log(`::warning title=互動網站::${escapeCommandData(message)}`)
}

function runCli(): void {
  try {
    let registry: InteractiveRegistry = { sites: [], warnings: [] }

    try {
      registry = loadInteractiveRegistry(process.argv[2] ?? process.cwd())
    } catch (error) {
      registry.warnings.push(`讀取互動網站資料失敗：${errorMessage(error)}`)
    }

    let messages: string[]
    try {
      messages = checkRegistry(registry)
    } catch (error) {
      messages = [`檢查互動網站資料失敗：${errorMessage(error)}`]
    }

    for (const message of messages) printWarning(message)

    const summaryPath = process.env.GITHUB_STEP_SUMMARY
    if (summaryPath) {
      try {
        appendFileSync(summaryPath, `${formatInteractiveSummary(registry, messages).join("\n")}\n`, "utf8")
      } catch (error) {
        printWarning(`無法附加 GitHub Actions 步驟摘要：${errorMessage(error)}`)
      }
    }
  } catch (error) {
    printWarning(`互動網站檢查發生問題：${errorMessage(error)}`)
  } finally {
    process.exitCode = 0
  }
}

const invokedPath = process.argv[1]
if (invokedPath && path.resolve(invokedPath) === path.resolve(fileURLToPath(import.meta.url))) {
  runCli()
}
