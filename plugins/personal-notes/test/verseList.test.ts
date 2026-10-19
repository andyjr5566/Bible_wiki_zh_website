import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import { checkVerseList, findVerseList, MAX_VERSE_ITEMS, type NodeAdapter } from "../src/client/model/verseList"
import { buildVerseReport, formatSummary, hastAdapter, REPORT_PATH, runVerseCheck, type HastNode } from "../src/verseCheck"
import { annotateVerses } from "../src/client/ui/verses"

// ── 兩種節點的替身：DOM 元素與 hast 節點，用同一份描述產生，驗證兩邊結果一致 ──
type Spec = { tag: string; start?: number; items?: number; text?: string }

const ol = (items: number, start?: number): Spec => ({ tag: "ol", items, start })
const hr: Spec = { tag: "hr" }
const p: Spec = { tag: "p" }
const table: Spec = { tag: "table" }

interface FakeEl {
  tagName: string
  children: FakeEl[]
  getAttribute(name: string): string | null
}
function fakeDom(specs: Spec[]): FakeEl {
  const el = (s: Spec): FakeEl => ({
    tagName: s.tag.toUpperCase(),
    children: Array.from({ length: s.items ?? 0 }, () => ({ tagName: "LI", children: [], getAttribute: () => null })),
    getAttribute: (name) => (name === "start" && s.start !== undefined ? String(s.start) : null),
  })
  return { tagName: "DIV", children: specs.map(el), getAttribute: () => null }
}
const domAdapter: NodeAdapter<FakeEl> = {
  tag: (n) => n.tagName.toLowerCase(),
  children: (n) => n.children,
  attr: (n, name) => n.getAttribute(name),
}

function fakeHast(specs: Spec[]): HastNode {
  const text = (): HastNode => ({ type: "text" })
  const el = (s: Spec): HastNode => ({
    type: "element",
    tagName: s.tag,
    properties: s.start !== undefined ? { start: s.start } : {}, // rehype 把 start 存成數字
    // 元素之間夾著換行文字節點，和真的 hast 一樣
    children: Array.from({ length: s.items ?? 0 }, () => [text(), { type: "element", tagName: "li", properties: {}, children: [] } as HastNode]).flat(),
  })
  return { type: "root", children: specs.flatMap((s) => [el(s), text()]) }
}

/** 同一份描述，兩種節點各跑一次，結果必須一樣。 */
function both(specs: Spec[]) {
  const d = findVerseList(fakeDom(specs), domAdapter)
  const h = findVerseList(fakeHast(specs), hastAdapter)
  expect(d === null).toBe(h === null)
  if (d && h) {
    expect(d.items.length).toBe(h.items.length)
    expect(d.start).toBe(h.start)
  }
  const cd = checkVerseList(fakeDom(specs), domAdapter)
  const ch = checkVerseList(fakeHast(specs), hastAdapter)
  expect(cd).toEqual(ch)
  return { found: h, problems: ch }
}

describe("經文清單規則 findVerseList", () => {
  it("找到：導覽表之後、分隔線之前的第一個有序清單", () => {
    const { found } = both([table, ol(31), hr, ol(5)])
    expect(found?.items.length).toBe(31)
    expect(found?.start).toBe(1)
  })

  it("沒有有序清單：找不到", () => {
    expect(both([table, p, hr]).found).toBeNull()
    expect(both([]).found).toBeNull()
  })

  it("有序清單只出現在分隔線之後：找不到", () => {
    expect(both([table, hr, ol(10)]).found).toBeNull()
  })

  it("start 屬性決定第一節的節數；沒有就是 1；0 當作沒有", () => {
    expect(both([ol(3, 12)]).found?.start).toBe(12)
    expect(both([ol(3)]).found?.start).toBe(1)
    expect(both([ol(3, 0)]).found?.start).toBe(1)
  })

  it("0 個項目、超過 200 個項目：找不到；剛好 200 個可以", () => {
    expect(both([ol(0)]).found).toBeNull()
    expect(both([ol(MAX_VERSE_ITEMS + 1)]).found).toBeNull()
    expect(both([ol(MAX_VERSE_ITEMS)]).found?.items.length).toBe(MAX_VERSE_ITEMS)
  })

  it("只看第一個有序清單（它不合格時不會改用後面的）", () => {
    expect(both([ol(0), ol(5)]).found).toBeNull()
  })

  it("annotateVerses 仍照原規則標節數（DOM 替身）", () => {
    const lis = Array.from({ length: 3 }, () => ({ tagName: "LI", children: [], dataset: {} as Record<string, string>, id: "", getAttribute: () => null }))
    const classes: string[] = []
    const list = {
      tagName: "OL",
      children: lis,
      getAttribute: (n: string) => (n === "start" ? "5" : null),
      classList: { add: (c: string) => classes.push(c) },
    }
    const content = { tagName: "DIV", children: [{ tagName: "TABLE", children: [] }, list, { tagName: "HR", children: [] }] }
    const article = { querySelector: () => content }
    const root = { querySelector: (sel: string) => (sel === "article" ? article : null) }
    expect(annotateVerses(root as never)).toBe(list)
    expect(lis.map((l) => l.dataset.v)).toEqual(["5", "6", "7"])
    expect(lis.map((l) => l.id)).toEqual(["v5", "v6", "v7"])
    expect(classes).toEqual(["bwz-verses"])
  })
})

describe("建置檢查 checkVerseList", () => {
  it("正常的一章：沒有問題", () => {
    expect(both([table, ol(31), hr]).problems).toEqual([])
    expect(both([ol(176)]).problems).toEqual([])
  })

  it("(a) 找不到清單", () => {
    expect(both([table, p, hr]).problems).toEqual(["找不到經文清單（第一條分隔線之前沒有有序清單）"])
    expect(both([table, hr, ol(10)]).problems).toEqual(["找不到經文清單（第一條分隔線之前沒有有序清單）"])
  })

  it("(b) 節數不在 1–176", () => {
    expect(both([ol(0)]).problems).toEqual(["經文清單有 0 節（應為 1 到 176 節）"])
    expect(both([ol(177)]).problems).toEqual(["經文清單有 177 節（應為 1 到 176 節）"])
    expect(both([ol(250)]).problems).toEqual(["經文清單有 250 節（應為 1 到 176 節）"])
  })

  it("(c) 清單被分成兩段：第二段接著前一段的編號", () => {
    expect(both([ol(10), p, ol(5, 11), hr]).problems).toEqual(["清單在第 10 節之後被分成兩段"])
    // 三段
    expect(both([ol(10), ol(5, 11), ol(2, 16)]).problems).toEqual(["清單在第 10 節之後被分成兩段", "清單在第 15 節之後被分成兩段"])
  })

  it("(c) 不接續的第二個清單、或分隔線之後的清單，不算被分開", () => {
    expect(both([ol(10), ol(5, 3)]).problems).toEqual([])
    expect(both([ol(10), hr, ol(5, 11)]).problems).toEqual([])
  })

  it("(d) 不是從第 1 節開始", () => {
    expect(both([ol(10, 7)]).problems).toEqual(["經文從第 7 節開始"])
  })

  it("可以同時有好幾種問題", () => {
    expect(both([ol(200, 3)]).problems).toEqual(["經文清單有 200 節（應為 1 到 176 節）", "經文從第 3 節開始"])
  })
})

describe("建置檢查的報告", () => {
  const page = (slug: string, specs: Spec[]): [HastNode, { data: { slug: string } }] => [fakeHast(specs), { data: { slug } }]
  const content = [
    page("01-創世記/第1章", [table, ol(31), hr]),
    page("01-創世記/第2章", [table, p, hr]),
    page("01-創世記/全書目錄及綱要", [p]), // 不是章節頁
    page("link_folder/亞伯拉罕", [p]),
    page("01-創世記/第99章", [p]), // 超過本卷章數，不是章節頁
    page("02-出埃及記/第3章", [ol(5), ol(4, 6)]),
  ]

  it("只檢查章節頁，列出有問題的章", () => {
    const r = buildVerseReport(content, new Date("2026-10-19T00:00:00Z"))
    expect(r.v).toBe(1)
    expect(r.checkedAt).toBe("2026-10-19T00:00:00.000Z")
    expect(r.total).toBe(3)
    expect(r.problems).toEqual([
      { slug: "01-創世記/第2章", book: "創世記", chapter: 2, messages: ["找不到經文清單（第一條分隔線之前沒有有序清單）"] },
      { slug: "02-出埃及記/第3章", book: "出埃及記", chapter: 3, messages: ["清單在第 5 節之後被分成兩段"] },
    ])
  })

  it("摘要：一行總數加每個問題章節一行", () => {
    const lines = formatSummary(buildVerseReport(content))
    expect(lines[0]).toBe("[personal-notes] 經文清單檢查：1 章通過、2 章有問題")
    expect(lines).toHaveLength(3)
    expect(lines[1]).toBe("  01-創世記/第2章：找不到經文清單（第一條分隔線之前沒有有序清單）")
  })

  describe("寫檔", () => {
    let dir = ""
    afterEach(() => {
      if (dir) rmSync(dir, { recursive: true, force: true })
      dir = ""
      vi.restoreAllMocks()
    })

    it("寫出報告 JSON（資料夾不存在會建立），印出摘要", async () => {
      dir = mkdtempSync(path.join(tmpdir(), "bwz-verse-"))
      const log = vi.spyOn(console, "log").mockImplementation(() => {})
      await runVerseCheck(content, dir)
      const report = JSON.parse(readFileSync(path.join(dir, REPORT_PATH), "utf8"))
      expect(report.total).toBe(3)
      expect(report.problems).toHaveLength(2)
      expect(log).toHaveBeenCalledWith("[personal-notes] 經文清單檢查：1 章通過、2 章有問題")
    })

    it("出錯時不丟例外、只警告", async () => {
      dir = mkdtempSync(path.join(tmpdir(), "bwz-verse-"))
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
      const broken = [[{ type: "root", get children(): never { throw new Error("壞掉的樹") } }, { data: { slug: "01-創世記/第1章" } }]]
      await expect(runVerseCheck(broken as never, dir)).resolves.toBeUndefined()
      expect(warn).toHaveBeenCalled()
    })
  })
})
