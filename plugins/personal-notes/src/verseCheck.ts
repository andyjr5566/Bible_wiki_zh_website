// 建置時的經文清單檢查（13 §3.2、D-46）：直接看每個章節頁的 hast 樹，用與瀏覽器端相同的規則
// （client/model/verseList.ts）找經文清單。不會讓建置失敗；結果印成摘要並寫成報告 JSON（不會發佈），
// 由 CI 的 scripts/verse-check-report.mjs 轉成警告與 Issue。
//
// 為什麼可以直接把整棵樹當內文：內容頁元件是 `<div class="markdown-preview-view">{htmlToJsx(tree)}</div>`
// （content-page 的 ContentBody.tsx），所以 emitter 拿到的 hast 根節點的子節點，就是瀏覽器端
// `.markdown-preview-view` 的子元素。

import { promises as fs } from "fs"
import path from "path"
import { checkVerseList, type NodeAdapter } from "./client/model/verseList"
import { parseChapterSlug } from "./client/model/books"

/** hast 節點的最小形狀（不引入 hast 型別）。 */
export interface HastNode {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
}

export const hastAdapter: NodeAdapter<HastNode> = {
  tag: (n) => (n.type === "element" && typeof n.tagName === "string" ? n.tagName.toLowerCase() : null),
  children: (n) => n.children ?? [],
  attr: (n, name) => {
    const v = n.properties?.[name]
    return v === undefined || v === null || v === false ? null : String(v)
  },
}

export interface VerseCheckProblem {
  slug: string
  book: string
  chapter: number
  messages: string[]
}

export interface VerseCheckReport {
  v: 1
  checkedAt: string
  /** 檢查了幾章（章節頁總數）。 */
  total: number
  problems: VerseCheckProblem[]
}

export const REPORT_PATH = path.join(".quartz-cache", "personal-notes-verse-check.json")

type PageLike = readonly [unknown, { data?: unknown }]

/** 檢查所有章節頁。純計算，不寫檔。 */
export function buildVerseReport(content: readonly PageLike[], now: Date = new Date()): VerseCheckReport {
  const problems: VerseCheckProblem[] = []
  let total = 0
  for (const [tree, file] of content) {
    const slug = String((file.data as { slug?: unknown } | undefined)?.slug ?? "")
    const ref = parseChapterSlug(slug)
    if (!ref) continue
    total++
    const messages = checkVerseList(tree as HastNode, hastAdapter)
    if (messages.length > 0) problems.push({ slug, book: ref.book.name, chapter: ref.chapter, messages })
  }
  problems.sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
  return { v: 1, checkedAt: now.toISOString(), total, problems }
}

/** 摘要：第一行總數，之後每個有問題的章節一行。 */
export function formatSummary(report: VerseCheckReport): string[] {
  const bad = report.problems.length
  const lines = [`[personal-notes] 經文清單檢查：${report.total - bad} 章通過、${bad} 章有問題`]
  for (const p of report.problems) lines.push(`  ${p.slug}：${p.messages.join("；")}`)
  return lines
}

/** 檢查並寫報告；任何錯誤都只印警告，絕不讓建置失敗。 */
export async function runVerseCheck(content: readonly PageLike[], cwd: string = process.cwd()): Promise<void> {
  const reportFile = path.join(cwd, REPORT_PATH)
  try {
    // 先刪掉舊報告（CI 會還原 .quartz-cache），這次檢查失敗時才不會讓 CI 讀到過期的結果
    await fs.rm(reportFile, { force: true })
    const report = buildVerseReport(content)
    await fs.mkdir(path.dirname(reportFile), { recursive: true })
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2))
    for (const line of formatSummary(report)) console.log(line)
  } catch (err) {
    console.warn(`[personal-notes] 經文清單檢查失敗（不影響建置）：${err instanceof Error ? err.message : String(err)}`)
  }
}
