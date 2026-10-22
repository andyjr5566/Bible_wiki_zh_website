import assert from "node:assert"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { describe } from "node:test"
import {
  BOOKS,
  analyzeBrokenLinks,
  checkHomeProgress,
  isStaticAssetLink,
  scanBrokenLinks,
} from "./contentChecks"

function progressRow(bookName: string, completed: number): string {
  const book = BOOKS.find((candidate) => candidate.name === bookName)
  assert.ok(book, `Unknown test book: ${bookName}`)

  const percent = Math.floor(Math.min(completed / book.chapters, 1) * 100 + 0.5)
  const filled = Math.floor(percent / 5 + 0.5)
  const bar = "█".repeat(filled) + "░".repeat(20 - filled)
  const mark = completed === book.chapters ? " ✓" : ""
  const folderNumber = String(BOOKS.indexOf(book) + 1).padStart(2, "0")

  return `| [[${folderNumber} ${book.name}/全書目錄及綱要\\|${book.name}]] | ${book.chapters} | **${completed}**${mark} | ${bar} ${percent}% |`
}

function makeIndex(
  actualCounts: Readonly<Record<string, number>>,
  rowSpecs?: ReadonlyArray<{ book: string; completed: number }>,
  totalOverride?: number,
): string {
  const rows =
    rowSpecs ??
    BOOKS.filter((book) => (actualCounts[book.name] ?? 0) > 0).map((book) => ({
      book: book.name,
      completed: actualCounts[book.name],
    }))
  const totalEntries = BOOKS.filter((book) => (actualCounts[book.name] ?? 0) > 0)
    .map((book) => `${book.name} ${actualCounts[book.name]}/${book.chapters} 章`)
    .join(" · ")
  const sum =
    totalOverride ?? BOOKS.reduce((value, book) => value + (actualCounts[book.name] ?? 0), 0)

  return [
    "# 首頁",
    "<!-- bwz:progress:start（自動產生） -->",
    "| 書卷 | 章數 | 完成 | 進度 |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => progressRow(row.book, row.completed)),
    "<!-- bwz:progress:end -->",
    "<!-- bwz:total:start -->",
    `*全庫已完成${totalEntries} · 共 ${sum} 章*`,
    "<!-- bwz:total:end -->",
  ].join("\n")
}

describe("checkHomeProgress", () => {
  test("reports no issues when all progress numbers match", () => {
    const counts = { 創世記: 50, 出埃及記: 40 }
    const report = checkHomeProgress(makeIndex(counts), counts)

    assert.deepStrictEqual(report.issues, [])
    assert.deepStrictEqual(report.notices, [])
    assert.strictEqual(report.actualTotal, 90)
    assert.deepStrictEqual(
      report.rows.map((row) => row.status),
      ["一致", "一致"],
    )
  })

  test("reports a wrong completion number with the book name and source line", () => {
    const counts = { 創世記: 50, 出埃及記: 40 }
    const report = checkHomeProgress(
      makeIndex(counts, [
        { book: "創世記", completed: 50 },
        { book: "出埃及記", completed: 39 },
      ]),
      counts,
    )

    const completionIssue = report.issues.find((issue) =>
      issue.message.includes("首頁寫完成 39 章"),
    )
    assert.ok(completionIssue)
    assert.match(completionIssue.message, /出埃及記/)
    assert.strictEqual(completionIssue.line, 6)
  })

  test("reports a book with chapter files that is missing from the progress table", () => {
    const counts = { 創世記: 50, 出埃及記: 40 }
    const report = checkHomeProgress(makeIndex(counts, [{ book: "創世記", completed: 50 }]), counts)

    assert.ok(report.issues.some((issue) => issue.message.includes("首頁沒有列出出埃及記")))
  })

  test("reports a listed book with no chapter files", () => {
    const counts = { 創世記: 50 }
    const report = checkHomeProgress(
      makeIndex(counts, [
        { book: "創世記", completed: 50 },
        { book: "出埃及記", completed: 0 },
      ]),
      counts,
    )

    assert.ok(
      report.issues.some((issue) => issue.message.includes("首頁列了出埃及記，但沒有章節檔")),
    )
  })

  test("reports a wrong total chapter count in the progress table", () => {
    const counts = { 創世記: 50 }
    const index = makeIndex(counts).replace("| 50 | **50**", "| 49 | **50**")
    const report = checkHomeProgress(index, counts)

    assert.ok(
      report.issues.some((issue) => issue.message.includes("章數欄寫 49，創世記 應是 50 章")),
    )
  })

  test("reports a wrong total sum", () => {
    const counts = { 創世記: 50, 出埃及記: 40 }
    const report = checkHomeProgress(makeIndex(counts, undefined, 89), counts)

    assert.ok(
      report.issues.some((issue) => issue.message.includes("total 行的總數 89 和實際 90 不一致")),
    )
  })

  test("reports a wrong percentage", () => {
    const counts = { 創世記: 50 }
    const report = checkHomeProgress(makeIndex(counts).replace("100%", "99%"), counts)

    assert.ok(
      report.issues.some((issue) => issue.message.includes("首頁進度寫 99%，依完成數應為 100%")),
    )
  })

  test("reports a missing completion checkmark", () => {
    const counts = { 創世記: 50 }
    const report = checkHomeProgress(makeIndex(counts).replace("**50** ✓", "**50**"), counts)

    assert.ok(report.issues.some((issue) => issue.message.includes("完成數 50/50 應有 ✓")))
  })

  test("reports only a skip notice when the progress markers are missing", () => {
    const report = checkHomeProgress("# 沒有首頁標記", { 創世記: 50 })

    assert.deepStrictEqual(report.issues, [])
    assert.deepStrictEqual(
      report.notices.map((notice) => notice.message),
      ["index.md 找不到 bwz:progress 標記，略過"],
    )
    assert.strictEqual(report.skipped, true)
  })

  test("parses BOM and CRLF index files", () => {
    const counts = { 創世記: 50, 出埃及記: 40 }
    const crlfIndex = `\uFEFF${makeIndex(counts).replace(/\n/g, "\r\n")}`
    const report = checkHomeProgress(crlfIndex, counts)

    assert.deepStrictEqual(report.issues, [])
    assert.strictEqual(report.actualTotal, 90)
  })
})

describe("broken internal link reporting", () => {
  test("counts only anchors with internal and broken classes despite attribute order", () => {
    const stats = analyzeBrokenLinks([
      {
        page: "01/index.html",
        html: [
          '<a href="../缺頁" class="internal internal-link alias broken" data-slug="缺頁">',
          '<a data-slug="另一個缺頁" aria-label="x" class="broken internal" href="../另一個缺頁">',
          '<a class="internal internal-link" href="../正常">',
          '<a class="external broken" href="https://example.com/">',
        ].join("\n"),
      },
      {
        page: "02/page.html",
        html: '<a href="../缺頁" class="internal broken" data-slug="缺頁">',
      },
    ])

    assert.strictEqual(stats.total, 3)
    assert.strictEqual(stats.pagesWithBrokenLinks, 2)
    assert.deepStrictEqual(stats.byTarget, [
      { target: "缺頁", count: 2 },
      { target: "另一個缺頁", count: 1 },
    ])
    assert.deepStrictEqual(stats.byPage, [
      { page: "01/index.html", count: 2 },
      { page: "02/page.html", count: 1 },
    ])
  })

  test("recursively scans HTML files in a temporary public directory", async () => {
    const publicDir = await mkdtemp(join(tmpdir(), "content-check-links-"))
    try {
      await mkdir(join(publicDir, "nested"))
      await writeFile(
        join(publicDir, "nested", "page.html"),
        '<a class="internal broken" data-slug="缺頁" href="../缺頁">',
        "utf8",
      )
      await writeFile(join(publicDir, "ignore.txt"), '<a class="internal broken">', "utf8")

      const stats = await scanBrokenLinks(publicDir)
      assert.strictEqual(stats.total, 1)
      assert.strictEqual(stats.pagesWithBrokenLinks, 1)
      assert.deepStrictEqual(stats.byTarget, [{ target: "缺頁", count: 1 }])
      assert.deepStrictEqual(stats.byPage, [{ page: "nested/page.html", count: 1 }])
    } finally {
      await rm(publicDir, { recursive: true, force: true })
    }
  })
})

describe("static/ links", () => {
  test("resolves the href against the page path", () => {
    assert.ok(isStaticAssetLink("appendix/website/index.html", "../.././static/website/a/dist/"))
    assert.ok(isStaticAssetLink("01-創世記/全書目錄及綱要.html", "../static/website/全聖經/dist/index.html"))
    assert.ok(!isStaticAssetLink("appendix/家譜.html", "../appendix/website/a/dist/#x"))
    assert.ok(!isStaticAssetLink("a.html", undefined))
  })

  test("are counted as ignored, not broken", () => {
    const stats = analyzeBrokenLinks([
      {
        page: "appendix/website/index.html",
        html:
          '<a href="../../static/website/a/dist/" class="internal broken" data-slug="static/website/a/dist/index">' +
          '<a href="../missing" class="internal broken" data-slug="missing">',
      },
    ])
    assert.strictEqual(stats.total, 1)
    assert.strictEqual(stats.ignoredStatic, 1)
    assert.deepStrictEqual(stats.byTarget, [{ target: "missing", count: 1 }])
  })
})
