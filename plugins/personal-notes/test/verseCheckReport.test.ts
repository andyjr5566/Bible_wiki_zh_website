import { describe, expect, it } from "vitest"
import {
  applyAction,
  CLOSE_COMMENT,
  decideAction,
  findOpenIssue,
  ISSUE_TITLE,
  issueBody,
  summaryMarkdown,
  warningLines,
  type VerseReport,
} from "../scripts/verse-check-report.mjs"

const bad: VerseReport = {
  total: 3,
  problems: [
    { slug: "01-創世記/第2章", book: "創世記", chapter: 2, messages: ["找不到經文清單（第一條分隔線之前沒有有序清單）"] },
    { slug: "02-出埃及記/第3章", book: "出埃及記", chapter: 3, messages: ["經文從第 7 節開始", "清單在第 9 節之後被分成兩段"] },
  ],
}
const good: VerseReport = { total: 3, problems: [] }

describe("經文清單檢查報告：要對 Issue 做什麼", () => {
  it("有問題、沒有開著的 Issue → 開新的", () => {
    const d = decideAction(bad, null)
    expect(d.action).toBe("create")
    if (d.action === "create") {
      expect(d.title).toBe(ISSUE_TITLE)
      expect(d.body).toContain("創世記 第2章")
      expect(d.body).toContain("02-出埃及記/第3章")
    }
  })

  it("有問題、已有開著的 Issue → 更新內文（不重複開）", () => {
    const d = decideAction(bad, { number: 12, body: "舊的內文" })
    expect(d).toEqual({ action: "update", number: 12, body: issueBody(bad) })
  })

  it("有問題、Issue 內容一樣（含換行差異）→ 不動", () => {
    expect(decideAction(bad, { number: 12, body: issueBody(bad).replace(/\n/g, "\r\n") }).action).toBe("none")
  })

  it("沒問題、有開著的 Issue → 留言並關閉", () => {
    expect(decideAction(good, { number: 12, body: "x" })).toEqual({ action: "close", number: 12, comment: CLOSE_COMMENT })
    expect(CLOSE_COMMENT).toBe("最新建置已全部通過")
  })

  it("沒問題、沒有 Issue → 什麼都不做", () => {
    expect(decideAction(good, null).action).toBe("none")
  })

  it("一章都沒檢查到時不關閉 Issue", () => {
    expect(decideAction({ total: 0, problems: [] }, { number: 12, body: "x" }).action).toBe("none")
  })
})

describe("經文清單檢查報告：輸出", () => {
  it("每個有問題的章節一行警告，訊息用全形分號串起來", () => {
    expect(warningLines(bad)).toEqual([
      "::warning title=經文清單檢查::01-創世記/第2章：找不到經文清單（第一條分隔線之前沒有有序清單）",
      "::warning title=經文清單檢查::02-出埃及記/第3章：經文從第 7 節開始；清單在第 9 節之後被分成兩段",
    ])
    expect(warningLines(good)).toEqual([])
  })

  it("警告裡的 % 與換行會跳脫", () => {
    const r: VerseReport = { total: 1, problems: [{ slug: "a", book: "b", chapter: 1, messages: ["100%\n換行"] }] }
    expect(warningLines(r)[0]).toBe("::warning title=經文清單檢查::a：100%25%0A換行")
  })

  it("步驟摘要是 Markdown 表格", () => {
    const md = summaryMarkdown(bad)
    expect(md).toContain("1 章通過、2 章有問題")
    expect(md).toContain("| 01-創世記/第2章 |")
    expect(summaryMarkdown(good)).not.toContain("|")
  })

  it("只認標題完全相同的 Issue", () => {
    const issues = [{ number: 1, title: "別的" }, { number: 2, title: ISSUE_TITLE, body: "x" }]
    expect(findOpenIssue(issues)?.number).toBe(2)
    expect(findOpenIssue([{ number: 1, title: ISSUE_TITLE + "（舊）" }])).toBeNull()
    expect(findOpenIssue(null)).toBeNull()
  })
})

describe("照決定呼叫 gh", () => {
  const run = (d: Parameters<typeof applyAction>[0]) => {
    const calls: { args: string[]; input?: string }[] = []
    applyAction(d, (args, input) => {
      calls.push({ args, input })
      return ""
    })
    return calls
  }

  it("create / update / close / none", () => {
    expect(run(decideAction(bad, null))).toEqual([{ args: ["issue", "create", "--title", ISSUE_TITLE, "--body-file", "-"], input: issueBody(bad) }])
    expect(run(decideAction(bad, { number: 5, body: "舊" }))).toEqual([{ args: ["issue", "edit", "5", "--body-file", "-"], input: issueBody(bad) }])
    expect(run(decideAction(good, { number: 5, body: "舊" }))).toEqual([
      { args: ["issue", "comment", "5", "--body", CLOSE_COMMENT], input: undefined },
      { args: ["issue", "close", "5"], input: undefined },
    ])
    expect(run(decideAction(good, null))).toEqual([])
  })
})
