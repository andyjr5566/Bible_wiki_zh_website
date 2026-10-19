// CI：讀建置時寫下的經文清單檢查報告（src/verseCheck.ts），轉成 GitHub Actions 警告、步驟摘要與一則固定標題的 Issue。
// 純 Node、沒有相依套件。永遠以 0 結束（這一步失敗也不能擋部署）。見 dev-notes/personal-notes/13-round3-spec.md §3.2。
//
//   node plugins/personal-notes/scripts/verse-check-report.mjs [報告路徑]
//
// 環境變數：GH_TOKEN（gh CLI 用，需要 issues: write）、GITHUB_STEP_SUMMARY（有的話附加 Markdown 摘要）。

import { spawnSync } from "node:child_process"
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

export const ISSUE_TITLE = "經文清單檢查：有章節認不出經文清單"
export const CLOSE_COMMENT = "最新建置已全部通過"
export const DEFAULT_REPORT = ".quartz-cache/personal-notes-verse-check.json"

/** 報告 → 每個有問題的章節一行 GitHub Actions 警告。 */
export function warningLines(report) {
  // 工作流程指令的資料要跳脫 % 與換行
  const esc = (s) => String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A")
  return report.problems.map((p) => `::warning title=經文清單檢查::${esc(`${p.slug}：${p.messages.join("；")}`)}`)
}

/** 報告 → 步驟摘要（Markdown）。 */
export function summaryMarkdown(report) {
  const bad = report.problems.length
  const lines = [`### 經文清單檢查`, "", `${report.total - bad} 章通過、${bad} 章有問題（共檢查 ${report.total} 章）。`]
  if (bad > 0) {
    lines.push("", "| 章節 | 問題 |", "| --- | --- |")
    for (const p of report.problems) lines.push(`| ${p.slug} | ${p.messages.join("；")} |`)
  }
  return lines.join("\n") + "\n"
}

/** 報告 → Issue 內文。不放時間，內容沒變就不必更新。 */
export function issueBody(report) {
  const lines = [
    `最近一次建置有 ${report.problems.length} 章認不出經文清單（共檢查 ${report.total} 章）。網站已照常更新，但這幾章的筆記、畫重點功能找不到對應的經節。`,
    "",
  ]
  for (const p of report.problems) lines.push(`- **${p.book} 第${p.chapter}章**（\`${p.slug}\`）：${p.messages.join("；")}`)
  lines.push("", "規則：章節頁第一條分隔線之前的第一個有序清單就是經文清單，節數 1 到 176、從第 1 節開始、中間不能被分成兩段。", "", "這則 Issue 由建置自動維護：問題修好後會自動關閉。")
  return lines.join("\n") + "\n"
}

const normalize = (s) => String(s ?? "").replace(/\r\n/g, "\n").trim()

/**
 * 決定要對 Issue 做什麼（純函式）。
 * @param report 報告 JSON：{ total, problems: [...] }
 * @param openIssue 已開著的同名 Issue：{ number, body }，沒有就是 null
 * @returns { action: "create"|"update"|"close"|"none", ... }
 */
export function decideAction(report, openIssue) {
  const problems = report?.problems ?? []
  if (problems.length > 0) {
    const body = issueBody(report)
    if (!openIssue) return { action: "create", title: ISSUE_TITLE, body }
    // 內容一樣就不要再改（避免每次建置都產生一筆編輯紀錄）
    if (normalize(openIssue.body) === normalize(body)) return { action: "none", reason: "Issue 內容沒有變" }
    return { action: "update", number: openIssue.number, body }
  }
  if (openIssue) {
    // 一章都沒檢查到不算「全部通過」（可能是內容還沒同步或檢查壞了），不要關掉 Issue
    if (!report?.total) return { action: "none", reason: "報告裡沒有任何章節，不關閉 Issue" }
    return { action: "close", number: openIssue.number, comment: CLOSE_COMMENT }
  }
  return { action: "none", reason: "沒有問題，也沒有開著的 Issue" }
}

/** 照決定呼叫 gh。gh(args, input?) 回傳 stdout 字串；失敗時丟出錯誤。 */
export function applyAction(decision, gh) {
  switch (decision.action) {
    case "create":
      gh(["issue", "create", "--title", decision.title, "--body-file", "-"], decision.body)
      break
    case "update":
      gh(["issue", "edit", String(decision.number), "--body-file", "-"], decision.body)
      break
    case "close":
      gh(["issue", "comment", String(decision.number), "--body", decision.comment])
      gh(["issue", "close", String(decision.number)])
      break
    default:
      break
  }
}

/** 在已開啟的 Issue 裡找標題完全相同的那一則。 */
export function findOpenIssue(issues) {
  return (Array.isArray(issues) ? issues : []).find((i) => i && i.title === ISSUE_TITLE) ?? null
}

function realGh(args, input) {
  const r = spawnSync("gh", args, { input, encoding: "utf8" })
  if (r.error) throw r.error
  if (r.status !== 0) throw new Error(`gh ${args.slice(0, 2).join(" ")} 失敗：${(r.stderr || r.stdout || "").trim()}`)
  return r.stdout
}

function main() {
  const file = process.argv[2] || DEFAULT_REPORT
  if (!existsSync(file)) {
    console.log(`::notice title=經文清單檢查::找不到報告 ${file}，略過`)
    return
  }
  const report = JSON.parse(readFileSync(file, "utf8").replace(/^﻿/, ""))
  if (!report || !Array.isArray(report.problems)) throw new Error("報告格式不對")

  for (const line of warningLines(report)) console.log(line)
  console.log(`經文清單檢查：${report.total - report.problems.length} 章通過、${report.problems.length} 章有問題`)
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryMarkdown(report))
    } catch (err) {
      console.log(`::notice title=經文清單檢查::無法寫入步驟摘要：${err.message}`)
    }
  }

  if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
    console.log("::notice title=經文清單檢查::沒有 GH_TOKEN，略過 Issue")
    return
  }
  const listed = JSON.parse(
    realGh(["issue", "list", "--state", "open", "--search", `"${ISSUE_TITLE}" in:title`, "--json", "number,title,body", "--limit", "30"]) || "[]",
  )
  const decision = decideAction(report, findOpenIssue(listed))
  console.log(`Issue：${decision.action}${decision.reason ? `（${decision.reason}）` : ""}`)
  applyAction(decision, realGh)
}

// 只有直接用 node 執行時才跑（單元測試 import 時不跑）
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main()
  } catch (err) {
    console.log(`::warning title=經文清單檢查::報告腳本出錯（不影響部署）：${err instanceof Error ? err.message : String(err)}`)
  }
  process.exit(0)
}
