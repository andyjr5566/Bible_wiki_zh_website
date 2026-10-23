import assert from "node:assert/strict"
import test from "node:test"
import { formatInteractiveSummary } from "./checkInteractiveSites"
import type { InteractiveRegistry } from "./interactiveSites"

test("摘要列出網站、涵蓋章數、封面、dist 和檢查訊息", () => {
  const registry: InteractiveRegistry = {
    sites: [
      {
        key: "創世記/第6章",
        title: "方舟",
        description: "方舟互動導覽",
        type: "場景導覽",
        scope: "narrow",
        primary: { book: 1, chapter: 6 },
        chapters: [
          { book: 1, chapter: 6 },
          { book: 1, chapter: 7 },
        ],
        entryPath: "static/website/創世記/第6章/dist/index.html",
        coverPath: "static/interactive-covers/創世記-第6章.webp",
        hasCover: true,
        hasDist: false,
        hasTitle: true,
      },
    ],
    warnings: [],
  }

  const lines = formatInteractiveSummary(registry, ["網站「創世記/第6章」缺少 dist/index.html。"])

  assert.ok(lines.includes("## 互動網站檢查"))
  assert.ok(lines.includes("- 網站總數：1"))
  assert.ok(lines.includes("| 網站 | 類型 | 涵蓋章數 | 封面 | dist |"))
  assert.ok(lines.includes("| 創世記/第6章 | 場景導覽 | 2 | 有 | 缺少 |"))
  assert.ok(lines.includes("- 網站「創世記/第6章」缺少 dist/index.html。"))
  assert.ok(lines.indexOf("### 訊息") < lines.indexOf("- 網站「創世記/第6章」缺少 dist/index.html。"))
})

test("沒有訊息時顯示全部通過，沒有網站時仍有表格列", () => {
  const registry: InteractiveRegistry = { sites: [], warnings: [] }
  const lines = formatInteractiveSummary(registry, [])

  assert.ok(lines.includes("- 網站總數：0"))
  assert.ok(lines.includes("| （無） | — | 0 | — | — |"))
  assert.ok(lines.includes("全部通過"))
})
