import { appendFile, readdir, readFile } from "node:fs/promises"
import {
  checkHomeProgress,
  countChapterFiles,
  scanBrokenLinks,
  type BrokenLinkStats,
  type HomeProgressReport,
} from "./contentChecks"

function escapeCommandData(value: string): string {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
}

function formatProgressMarkdown(report: HomeProgressReport): string[] {
  const lines = ["## 首頁進度檢查", ""]

  if (report.skipped) {
    lines.push("首頁進度檢查略過。")
    for (const notice of report.notices) lines.push(`- ${notice.message}`)
    for (const issue of report.issues) lines.push(`- ${issue.message}`)
    lines.push("")
    return lines
  }

  lines.push("| 書卷 | 實際章節檔 | 首頁完成 | 首頁章數 | 狀態 |")
  lines.push("| --- | ---: | ---: | ---: | --- |")
  for (const row of report.rows) {
    lines.push(
      `| ${row.book} | ${row.actual} | ${row.displayedCompleted ?? "—"} | ${row.displayedTotal ?? "—"} | ${row.status} |`,
    )
  }
  lines.push(
    `| 全庫總數 | ${report.actualTotal} | — | — | ${report.issues.length === 0 ? "一致" : "不一致"} |`,
  )
  if (report.displayedTotal !== null) {
    lines.push(
      `| 首頁 total 行總數 | — | ${report.displayedTotal} | — | ${report.displayedTotal === report.actualTotal ? "一致" : "不一致"} |`,
    )
  }
  lines.push("")

  if (report.issues.length > 0) {
    lines.push("首頁進度不一致項目：")
    for (const issue of report.issues) lines.push(`- 第 ${issue.line} 行：${issue.message}`)
  } else {
    lines.push("首頁進度與章節檔數一致。")
  }
  lines.push("")
  return lines
}

function formatBrokenLinksMarkdown(stats: BrokenLinkStats, scanError?: string): string[] {
  const lines = [
    "## 壞掉的內部連結",
    "",
    `- 壞連結總數：${stats.total}`,
    `- 有壞連結的頁數：${stats.pagesWithBrokenLinks}`,
    `- 不計入：指到 static/ 的連結 ${stats.ignoredStatic} 個（互動網站在建置後才複製進去，正式站上是好的）`,
    "",
    "### 最常見的缺少目標（前 20 名）",
    "",
    "| 目標 | 次數 |",
    "| --- | ---: |",
  ]

  if (stats.byTarget.length === 0) lines.push("| （無） | 0 |")
  for (const item of stats.byTarget) lines.push(`| ${item.target} | ${item.count} |`)

  lines.push("", "### 壞連結最多的頁（前 20 名）", "", "| 頁面 | 次數 |", "| --- | ---: |")
  if (stats.byPage.length === 0) lines.push("| （無） | 0 |")
  for (const item of stats.byPage) lines.push(`| ${item.page} | ${item.count} |`)
  if (scanError) lines.push("", `掃描錯誤：${scanError}`)
  lines.push("")
  return lines
}

function printBrokenLinkReport(stats: BrokenLinkStats): void {
  console.log(`壞掉的內部連結：共 ${stats.total} 個，分布於 ${stats.pagesWithBrokenLinks} 頁。`)

  console.log("最常見的缺少目標（前 20 名）：")
  if (stats.byTarget.length === 0) console.log("- （無）")
  for (const item of stats.byTarget) console.log(`- ${item.target}：${item.count} 次`)

  console.log("壞連結最多的頁（前 20 名）：")
  if (stats.byPage.length === 0) console.log("- （無）")
  for (const item of stats.byPage) console.log(`- ${item.page}：${item.count} 個`)
}

async function main(contentDir: string, publicDir: string, strict: boolean): Promise<void> {
  try {
    await readdir(contentDir)
  } catch (error) {
    console.error(`讀不到 contentDir「${contentDir}」：${(error as Error).message}`)
    process.exitCode = 1
    return
  }

  let chapterCounts: Record<string, number>
  try {
    chapterCounts = await countChapterFiles(contentDir)
  } catch (error) {
    console.error(`讀取章節檔時發生問題：${(error as Error).message}`)
    chapterCounts = {}
  }

  let indexText = ""
  try {
    indexText = await readFile(`${contentDir}/index.md`, "utf8")
  } catch {
    // Treat a missing/unreadable index like a missing marker so it is reported as a skipped check.
  }

  const progress = checkHomeProgress(indexText, chapterCounts)
  console.log("建置後內容檢查（只是警告，不會擋部署）")
  console.log("首頁進度：")
  if (progress.skipped) {
    for (const notice of progress.notices) {
      console.log(`- ${notice.message}`)
      console.log(
        `::warning file=content/index.md,line=${notice.line},title=首頁進度::${escapeCommandData(notice.message)}`,
      )
    }
    for (const issue of progress.issues) {
      console.log(`- 第 ${issue.line} 行：${issue.message}`)
      console.log(
        `::warning file=content/index.md,line=${issue.line},title=首頁進度::${escapeCommandData(issue.message)}`,
      )
    }
  } else if (progress.issues.length === 0) {
    console.log(`一致：實際共有 ${progress.actualTotal} 個章節檔。`)
  } else {
    console.log(`發現 ${progress.issues.length} 個不一致：`)
    for (const issue of progress.issues) {
      console.log(`- 第 ${issue.line} 行：${issue.message}`)
      console.log(
        `::warning file=content/index.md,line=${issue.line},title=首頁進度::${escapeCommandData(issue.message)}`,
      )
    }
  }

  let brokenStats: BrokenLinkStats = {
    total: 0,
    pagesWithBrokenLinks: 0,
    ignoredStatic: 0,
    byTarget: [],
    byPage: [],
  }
  let scanError: string | undefined
  try {
    brokenStats = await scanBrokenLinks(publicDir)
  } catch (error) {
    scanError = (error as Error).message
    console.error(`無法掃描建置輸出「${publicDir}」：${scanError}`)
  }

  printBrokenLinkReport(brokenStats)
  const brokenSummary = `共 ${brokenStats.total} 個壞掉的內部連結，分布於 ${brokenStats.pagesWithBrokenLinks} 頁（詳見步驟摘要）${scanError ? `；掃描失敗：${scanError}` : ""}`
  console.log(`::warning title=壞掉的內部連結::${escapeCommandData(brokenSummary)}`)

  const markdown = [
    "# 建置後內容檢查",
    "",
    "只是警告，不會擋部署。",
    "",
    ...formatProgressMarkdown(progress),
    ...formatBrokenLinksMarkdown(brokenStats, scanError),
  ].join("\n")

  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (summaryPath) {
    try {
      await appendFile(summaryPath, `${markdown}\n`, "utf8")
    } catch (error) {
      console.error(`無法附加 GitHub Actions 步驟摘要：${(error as Error).message}`)
    }
  }

  if (strict && progress.issues.length > 0) process.exitCode = 1
}

const args = process.argv.slice(2)
const strict = args.includes("--strict")
const positional = args.filter((arg) => arg !== "--strict")

if (positional.length !== 2 || args.some((arg) => arg.startsWith("--") && arg !== "--strict")) {
  console.error("Usage: npx tsx quartz/util/checkContent.ts [--strict] <contentDir> <publicDir>")
  process.exitCode = 1
} else {
  await main(positional[0], positional[1], strict)
}
