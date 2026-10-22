// 建置後的內容檢查（B5-3，U-11：只警告、不擋部署），CLI 在 checkContent.ts。
// 1. 首頁進度：content/index.md 裡 bwz:progress／bwz:total 標記之間的數字，要和實際的章節檔數一致
//    （規則照 sync_content.ps1 的 Update-HomeProgress；BOOKS 照抄它的 $bookSpec）。
// 2. 壞掉的內部連結：建置輸出裡 class 同時有 internal 和 broken 的連結（Quartz 找不到目標時加的）。
import { readdir, readFile, stat } from "node:fs/promises"
import { join, relative } from "node:path"

export const BOOKS = [
  { name: "創世記", chapters: 50 },
  { name: "出埃及記", chapters: 40 },
  { name: "利未記", chapters: 27 },
  { name: "民數記", chapters: 36 },
  { name: "申命記", chapters: 34 },
  { name: "約書亞記", chapters: 24 },
  { name: "士師記", chapters: 21 },
  { name: "路得記", chapters: 4 },
  { name: "撒母耳記上", chapters: 31 },
  { name: "撒母耳記下", chapters: 24 },
  { name: "列王紀上", chapters: 22 },
  { name: "列王紀下", chapters: 25 },
  { name: "歷代志上", chapters: 29 },
  { name: "歷代志下", chapters: 36 },
  { name: "以斯拉記", chapters: 10 },
  { name: "尼希米記", chapters: 13 },
  { name: "以斯帖記", chapters: 10 },
  { name: "約伯記", chapters: 42 },
  { name: "詩篇", chapters: 150 },
  { name: "箴言", chapters: 31 },
  { name: "傳道書", chapters: 12 },
  { name: "雅歌", chapters: 8 },
  { name: "以賽亞書", chapters: 66 },
  { name: "耶利米書", chapters: 52 },
  { name: "耶利米哀歌", chapters: 5 },
  { name: "以西結書", chapters: 48 },
  { name: "但以理書", chapters: 12 },
  { name: "何西阿書", chapters: 14 },
  { name: "約珥書", chapters: 3 },
  { name: "阿摩司書", chapters: 9 },
  { name: "俄巴底亞書", chapters: 1 },
  { name: "約拿書", chapters: 4 },
  { name: "彌迦書", chapters: 7 },
  { name: "那鴻書", chapters: 3 },
  { name: "哈巴谷書", chapters: 3 },
  { name: "西番雅書", chapters: 3 },
  { name: "哈該書", chapters: 2 },
  { name: "撒迦利亞書", chapters: 14 },
  { name: "瑪拉基書", chapters: 4 },
  { name: "馬太福音", chapters: 28 },
  { name: "馬可福音", chapters: 16 },
  { name: "路加福音", chapters: 24 },
  { name: "約翰福音", chapters: 21 },
  { name: "使徒行傳", chapters: 28 },
  { name: "羅馬書", chapters: 16 },
  { name: "哥林多前書", chapters: 16 },
  { name: "哥林多後書", chapters: 13 },
  { name: "加拉太書", chapters: 6 },
  { name: "以弗所書", chapters: 6 },
  { name: "腓立比書", chapters: 4 },
  { name: "歌羅西書", chapters: 4 },
  { name: "帖撒羅尼迦前書", chapters: 5 },
  { name: "帖撒羅尼迦後書", chapters: 3 },
  { name: "提摩太前書", chapters: 6 },
  { name: "提摩太後書", chapters: 4 },
  { name: "提多書", chapters: 3 },
  { name: "腓利門書", chapters: 1 },
  { name: "希伯來書", chapters: 13 },
  { name: "雅各書", chapters: 5 },
  { name: "彼得前書", chapters: 5 },
  { name: "彼得後書", chapters: 3 },
  { name: "約翰一書", chapters: 5 },
  { name: "約翰二書", chapters: 1 },
  { name: "約翰三書", chapters: 1 },
  { name: "猶大書", chapters: 1 },
  { name: "啟示錄", chapters: 22 },
] as const

export interface ProgressIssue {
  line: number
  message: string
  book?: string
}

export interface ProgressBookRow {
  book: string
  actual: number
  displayedCompleted: number | null
  displayedTotal: number | null
  listed: boolean
  status: "一致" | "不一致"
}

export interface HomeProgressReport {
  issues: ProgressIssue[]
  notices: ProgressIssue[]
  rows: ProgressBookRow[]
  actualTotal: number
  displayedTotal: number | null
  skipped: boolean
}

interface MarkerBlock {
  start: number
  end: number
}

interface ParsedProgressRow {
  book: string
  total: number | null
  completed: number | null
  hasCheckmark: boolean
  percent: number | null
  bar: string | null
  line: number
}

function findMarkerBlock(lines: string[], key: string): MarkerBlock | null {
  const startPrefix = `<!-- bwz:${key}:start`
  const endPrefix = `<!-- bwz:${key}:end`
  const start = lines.findIndex((line) => line.trim().startsWith(startPrefix))
  if (start < 0) return null

  const end = lines.findIndex((line, index) => index > start && line.trim().startsWith(endPrefix))
  if (end < 0) return { start, end: -1 }
  return { start, end }
}

function parseProgressRows(lines: string[], start: number, end: number): ParsedProgressRow[] {
  const rows: ParsedProgressRow[] = []

  for (let index = start + 1; index < end; index++) {
    const line = lines[index]
    if (!line.includes("|")) continue

    // The sync script escapes the pipe in [[target\|display text]]. Protect it while
    // splitting table cells, then restore it for display-text extraction.
    const cells = line
      .trim()
      .replace(/\\\|/g, "\u0000")
      .split("|")
      .map((cell) => cell.trim())
    if (cells[0] === "") cells.shift()
    if (cells[cells.length - 1] === "") cells.pop()
    const restored = cells.map((cell) => cell.replace(/\u0000/g, "|"))
    if (restored.length < 4) continue
    if (restored.every((cell) => /^[-:\s]+$/.test(cell))) continue

    const firstCell = restored[0]
    const link = firstCell.match(/\[\[[\s\S]*?\|([^\]]+)\]\]/)
    const book = (link?.[1] ?? firstCell).trim()
    if (!book || book === "書卷" || book.includes("建置中") || book.includes("—")) continue

    const totalMatch = restored[1].match(/^\s*(\d+)\s*$/)
    const completedMatch = restored[2].match(/\*\*\s*(\d+)\s*\*\*/)
    const percentMatch = restored[3].match(/(\d+)\s*%/)
    const barMatch = restored[3].match(/[█░]+/)

    rows.push({
      book,
      total: totalMatch ? Number(totalMatch[1]) : null,
      completed: completedMatch ? Number(completedMatch[1]) : null,
      hasCheckmark: /✓/.test(restored[2]),
      percent: percentMatch ? Number(percentMatch[1]) : null,
      bar: barMatch?.[0] ?? null,
      line: index + 1,
    })
  }

  return rows
}

function progressFor(completed: number, total: number): { percent: number; bar: string } {
  const percent = Math.floor(Math.min(completed / total, 1) * 100 + 0.5)
  const filled = Math.floor(percent / 5 + 0.5)
  return {
    percent,
    bar: "█".repeat(filled) + "░".repeat(20 - filled),
  }
}

function lineAtOffset(text: string, offset: number, firstLine: number): number {
  return firstLine + text.slice(0, offset).split("\n").length - 1
}

export function checkHomeProgress(
  indexText: string,
  chapterCounts: Readonly<Record<string, number>>,
): HomeProgressReport {
  const lines = indexText.replace(/^\uFEFF/, "").split(/\r?\n/)
  const issues: ProgressIssue[] = []
  const notices: ProgressIssue[] = []
  const problemBooks = new Set<string>()
  const actualTotal = BOOKS.reduce((sum, book) => sum + (chapterCounts[book.name] ?? 0), 0)
  const progressBlock = findMarkerBlock(lines, "progress")

  if (!progressBlock) {
    notices.push({
      line: 1,
      message: "index.md 找不到 bwz:progress 標記，略過",
    })
    return { issues, notices, rows: [], actualTotal, displayedTotal: null, skipped: true }
  }

  if (progressBlock.end < 0) {
    issues.push({
      line: progressBlock.start + 1,
      message: "index.md 找不到 bwz:progress:end 標記",
    })
    return { issues, notices, rows: [], actualTotal, displayedTotal: null, skipped: true }
  }

  const addIssue = (line: number, message: string, book?: string) => {
    issues.push({ line, message, book })
    if (book) problemBooks.add(book)
  }

  const parsedRows = parseProgressRows(lines, progressBlock.start, progressBlock.end)
  const rowsByBook = new Map<string, ParsedProgressRow[]>()
  for (const row of parsedRows) {
    const rows = rowsByBook.get(row.book) ?? []
    rows.push(row)
    rowsByBook.set(row.book, rows)
  }

  const knownBooks = new Map<string, (typeof BOOKS)[number]>(BOOKS.map((book) => [book.name, book]))

  for (const book of BOOKS) {
    const actual = chapterCounts[book.name] ?? 0
    const listedRows = rowsByBook.get(book.name) ?? []

    if (actual > 0 && listedRows.length === 0) {
      addIssue(
        progressBlock.start + 1,
        `首頁沒有列出${book.name}，但有 ${actual} 個章節檔`,
        book.name,
      )
    }

    if (listedRows.length > 1) {
      for (const duplicate of listedRows.slice(1)) {
        addIssue(duplicate.line, `首頁重複列出${book.name}`, book.name)
      }
    }

    const row = listedRows[0]
    if (!row) continue

    if (actual === 0) {
      addIssue(row.line, `首頁列了${book.name}，但沒有章節檔`, book.name)
    }

    if (row.total !== book.chapters) {
      const shown = row.total === null ? "非數字" : String(row.total)
      addIssue(row.line, `章數欄寫 ${shown}，${book.name} 應是 ${book.chapters} 章`, book.name)
    }

    if (row.completed === null) {
      addIssue(row.line, `${book.name}的完成欄沒有 **N** 數字`, book.name)
    } else {
      if (row.completed !== actual) {
        addIssue(
          row.line,
          `${book.name}：首頁寫完成 ${row.completed} 章，實際有 ${actual} 個章節檔`,
          book.name,
        )
      }

      const shouldHaveCheckmark = row.completed === book.chapters
      if (row.hasCheckmark !== shouldHaveCheckmark) {
        const expected = shouldHaveCheckmark ? "應有 ✓" : "不應有 ✓"
        addIssue(
          row.line,
          `${book.name}：完成數 ${row.completed}/${book.chapters} ${expected}`,
          book.name,
        )
      }

      const expectedProgress = progressFor(row.completed, book.chapters)
      if (row.percent !== expectedProgress.percent) {
        const shown = row.percent === null ? "缺少百分比" : `${row.percent}%`
        addIssue(
          row.line,
          `${book.name}：首頁進度寫 ${shown}，依完成數應為 ${expectedProgress.percent}%`,
          book.name,
        )
      }
      if (row.bar !== null && row.bar !== expectedProgress.bar) {
        addIssue(row.line, `${book.name}：首頁進度條與完成數不符`, book.name)
      }
    }
  }

  for (const row of parsedRows) {
    if (knownBooks.has(row.book)) continue
    addIssue(row.line, `首頁列了${row.book}，但沒有章節檔`, row.book)
  }

  const totalBlock = findMarkerBlock(lines, "total")
  let displayedTotal: number | null = null
  if (!totalBlock) {
    addIssue(progressBlock.start + 1, "index.md 找不到 bwz:total 標記，略過 total 檢查")
  } else if (totalBlock.end < 0) {
    addIssue(totalBlock.start + 1, "index.md 找不到 bwz:total:end 標記")
  } else {
    const totalText = lines.slice(totalBlock.start + 1, totalBlock.end).join("\n")
    const firstTotalLine = totalBlock.start + 2

    for (const book of BOOKS) {
      const actual = chapterCounts[book.name] ?? 0
      const entryPattern = new RegExp(`${book.name}\\s+(\\d+)\\s*\\/\\s*(\\d+)\\s*章`)
      const match = entryPattern.exec(totalText)

      if (actual > 0 && !match) {
        addIssue(firstTotalLine, `total 行沒有列出${book.name}，但有 ${actual} 個章節檔`, book.name)
        continue
      }
      if (!match) continue

      const entryLine = lineAtOffset(totalText, match.index, firstTotalLine)
      const completed = Number(match[1])
      const total = Number(match[2])
      if (actual === 0) {
        addIssue(entryLine, `total 行列了${book.name}，但沒有章節檔`, book.name)
      }
      if (completed !== actual) {
        addIssue(
          entryLine,
          `total 行的${book.name}寫完成 ${completed} 章，實際有 ${actual} 個章節檔`,
          book.name,
        )
      }
      if (total !== book.chapters) {
        addIssue(
          entryLine,
          `total 行的${book.name}章數寫 ${total}，應是 ${book.chapters} 章`,
          book.name,
        )
      }
    }

    const sumMatch = /共\s*(\d+)\s*章/.exec(totalText)
    if (!sumMatch) {
      addIssue(firstTotalLine, "total 行找不到「共 N 章」總數")
    } else {
      displayedTotal = Number(sumMatch[1])
      if (displayedTotal !== actualTotal) {
        const sumLine = lineAtOffset(totalText, sumMatch.index, firstTotalLine)
        addIssue(sumLine, `total 行的總數 ${displayedTotal} 和實際 ${actualTotal} 不一致`)
      }
    }
  }

  const reportRows: ProgressBookRow[] = []
  for (const book of BOOKS) {
    const actual = chapterCounts[book.name] ?? 0
    const listedRows = rowsByBook.get(book.name) ?? []
    if (actual === 0 && listedRows.length === 0) continue
    reportRows.push({
      book: book.name,
      actual,
      displayedCompleted: listedRows[0]?.completed ?? null,
      displayedTotal: listedRows[0]?.total ?? null,
      listed: listedRows.length > 0,
      status: problemBooks.has(book.name) ? "不一致" : "一致",
    })
  }

  for (const row of parsedRows) {
    if (knownBooks.has(row.book)) continue
    reportRows.push({
      book: row.book,
      actual: 0,
      displayedCompleted: row.completed,
      displayedTotal: row.total,
      listed: true,
      status: problemBooks.has(row.book) ? "不一致" : "一致",
    })
  }

  return { issues, notices, rows: reportRows, actualTotal, displayedTotal, skipped: false }
}

export async function countChapterFiles(contentDir: string): Promise<Record<string, number>> {
  const counts = Object.fromEntries(BOOKS.map((book) => [book.name, 0])) as Record<string, number>
  const claimedNumbers = new Set<number>()
  const entries = await readdir(contentDir, { withFileTypes: true })

  for (const entry of entries) {
    // 書卷資料夾可能是連結（junction／symlink），要跟著連結判斷
    const isDir =
      entry.isDirectory() ||
      (entry.isSymbolicLink() &&
        (await stat(join(contentDir, entry.name)).then(
          (s) => s.isDirectory(),
          () => false,
        )))
    if (!isDir) continue
    const match = /^(\d{2}) .+/.exec(entry.name)
    if (!match) continue

    const number = Number(match[1])
    if (number < 1 || number > BOOKS.length || claimedNumbers.has(number)) continue
    claimedNumbers.add(number)

    const files = await readdir(join(contentDir, entry.name), { withFileTypes: true })
    const count = files.filter((file) => file.isFile() && /^第\d+章\.md$/.test(file.name)).length
    counts[BOOKS[number - 1].name] = count
  }

  return counts
}

export interface BrokenLinkCount {
  target: string
  count: number
}

export interface BrokenPageCount {
  page: string
  count: number
}

export interface BrokenLinkStats {
  total: number
  /** 指到 static/ 底下的連結（互動網站的 dist 在建置後才複製進去，Quartz 會誤標成 broken），不算壞連結 */
  ignoredStatic: number
  pagesWithBrokenLinks: number
  byTarget: BrokenLinkCount[]
  byPage: BrokenPageCount[]
}

interface BrokenLinkAccumulator {
  total: number
  ignoredStatic: number
  targets: Map<string, number>
  pages: Map<string, number>
}

function getAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(
    new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
  )
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

/** 連結從 page（建置輸出裡的相對路徑）解析後，是否落在網站的 static/ 底下。 */
export function isStaticAssetLink(page: string, href: string | undefined): boolean {
  if (!href) return false
  try {
    const path = decodeURIComponent(new URL(href, "https://site.invalid/" + page).pathname)
    return path.startsWith("/static/")
  } catch {
    return false
  }
}

function addBrokenLinks(accumulator: BrokenLinkAccumulator, page: string, html: string): void {
  const anchorPattern = /<a\b[^>]*>/gi
  let match: RegExpExecArray | null
  let pageCount = 0

  while ((match = anchorPattern.exec(html)) !== null) {
    const tag = match[0]
    const classes = getAttribute(tag, "class")?.split(/\s+/) ?? []
    if (!classes.includes("internal") || !classes.includes("broken")) continue
    if (isStaticAssetLink(page, getAttribute(tag, "href"))) {
      accumulator.ignoredStatic++
      continue
    }

    const target =
      getAttribute(tag, "data-slug") ?? getAttribute(tag, "href") ?? "（無 href/data-slug）"
    accumulator.total++
    pageCount++
    accumulator.targets.set(target, (accumulator.targets.get(target) ?? 0) + 1)
  }

  if (pageCount > 0) accumulator.pages.set(page, pageCount)
}

function finishBrokenLinks(accumulator: BrokenLinkAccumulator): BrokenLinkStats {
  const sortByCount = <T extends { count: number }>(a: T, b: T): number => b.count - a.count

  return {
    total: accumulator.total,
    ignoredStatic: accumulator.ignoredStatic,
    pagesWithBrokenLinks: accumulator.pages.size,
    byTarget: [...accumulator.targets.entries()]
      .map(([target, count]) => ({ target, count }))
      .sort((a, b) => sortByCount(a, b) || a.target.localeCompare(b.target))
      .slice(0, 20),
    byPage: [...accumulator.pages.entries()]
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => sortByCount(a, b) || a.page.localeCompare(b.page))
      .slice(0, 20),
  }
}

export function analyzeBrokenLinks(
  files: ReadonlyArray<{ page: string; html: string }>,
): BrokenLinkStats {
  const accumulator: BrokenLinkAccumulator = {
    total: 0,
    ignoredStatic: 0,
    targets: new Map(),
    pages: new Map(),
  }
  for (const file of files) addBrokenLinks(accumulator, file.page, file.html)
  return finishBrokenLinks(accumulator)
}

async function collectHtmlPaths(directory: string, root: string, paths: string[]): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectHtmlPaths(fullPath, root, paths)
    } else if (entry.isFile() && /\.html$/i.test(entry.name)) {
      paths.push(relative(root, fullPath).replace(/\\/g, "/"))
    }
  }
}

export async function scanBrokenLinks(publicDir: string): Promise<BrokenLinkStats> {
  const paths: string[] = []
  await collectHtmlPaths(publicDir, publicDir, paths)

  const accumulator: BrokenLinkAccumulator = {
    total: 0,
    ignoredStatic: 0,
    targets: new Map(),
    pages: new Map(),
  }
  for (const page of paths) {
    const html = await readFile(join(publicDir, page), "utf8")
    addBrokenLinks(accumulator, page, html)
  }
  return finishBrokenLinks(accumulator)
}
