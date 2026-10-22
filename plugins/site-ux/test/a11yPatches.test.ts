// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import {
  applyA11yPatches,
  BREADCRUMB_LABEL,
  isShortWords,
  patchBreadcrumbLabel,
  patchLandmarks,
  planLandmarks,
  shortColumnIndexes,
  splitProgressBar,
  uniqueLabel,
  type PageFacts,
  type RegionFacts,
} from "../src/lib/a11yPatches"

describe("shortColumnIndexes", () => {
  it("整欄（含表頭）都不超過 6 個字才算短欄", () => {
    const rows = [
      ["書卷", "章數", "完成", "進度"],
      ["創世記", "50", "50 ✓", "████████████████████ 100%"],
      ["士師記 — 啟示錄", "—", "建置中", "—"],
    ]
    expect(shortColumnIndexes(rows)).toEqual([1, 2])
  })

  it("依字元計算，前後空白不算", () => {
    expect(shortColumnIndexes([["  一二三四五六  "], ["一二三四五六七"]])).toEqual([])
    expect(shortColumnIndexes([["  一二三四五六  "]])).toEqual([0])
  })

  it("列的長度不同時，少的欄當作沒有那格", () => {
    expect(shortColumnIndexes([["短", "很長很長很長的文字"], ["短"]])).toEqual([0])
  })

  it("空表格沒有短欄", () => {
    expect(shortColumnIndexes([])).toEqual([])
  })
})

describe("isShortWords", () => {
  it("每個以空白分開的片段都不超過 6 個字", () => {
    expect(isShortWords("申命記 — 啟示錄")).toBe(true)
    expect(isShortWords("出埃及記")).toBe(true)
    expect(isShortWords("逐節詳解、文意註解、屬靈應用")).toBe(false)
    expect(isShortWords("   ")).toBe(false)
  })
})

describe("splitProgressBar", () => {
  it("拆出開頭的方塊與其餘文字", () => {
    expect(splitProgressBar("██████░░░░ 60%")).toEqual({ bar: "██████░░░░", rest: " 60%" })
  })

  it("不是進度條（方塊太少、不在開頭）就回傳 null", () => {
    expect(splitProgressBar("███ 30%")).toBeNull()
    expect(splitProgressBar("進度 ██████")).toBeNull()
  })
})

describe("applyA11yPatches", () => {
  it("目錄按鈕改指實際的清單；表格標短欄、包進度條", () => {
    document.body.innerHTML = `
      <div class="toc"><button class="toc-header" aria-controls="toc-7">目錄</button>
        <div class="toc-content"><ul><li>一</li></ul></div></div>
      <article><div class="table-container"><table>
        <tr><th>書卷</th><th>進度</th></tr>
        <tr><td>創世記</td><td>████████████████████ 100%</td></tr>
      </table></div></article>`
    applyA11yPatches()
    const header = document.querySelector("button.toc-header")!
    const target = document.getElementById(header.getAttribute("aria-controls")!)
    expect(target?.tagName).toBe("UL")

    const cells = document.querySelectorAll("td")
    expect(cells[0].hasAttribute("data-short")).toBe(true)
    expect(cells[1].hasAttribute("data-short")).toBe(false)
    expect(cells[0].hasAttribute("data-short-cell")).toBe(true)
    expect(cells[1].hasAttribute("data-short-cell")).toBe(false)
    expect(cells[1].hasAttribute("data-bar")).toBe(true)
    expect(cells[1].querySelector(".site-ux-bar")?.getAttribute("aria-hidden")).toBe("true")
    expect(cells[1].textContent).toBe("████████████████████ 100%")

    // 再跑一次（SPA 換頁、resize）不會重複包
    applyA11yPatches()
    expect(cells[1].querySelectorAll(".site-ux-bar").length).toBe(1)
  })

  it("aria-controls 已經正確時不動；找不到清單時不動", () => {
    document.body.innerHTML = `
      <button class="toc-header" aria-controls="real">目錄</button><ul id="real"></ul>
      <div><button class="toc-header" aria-controls="missing">孤兒</button></div>`
    applyA11yPatches()
    const [ok, orphan] = Array.from(document.querySelectorAll("button.toc-header"))
    expect(ok.getAttribute("aria-controls")).toBe("real")
    expect(orphan.getAttribute("aria-controls")).toBe("missing")
  })
})

const region = (over: Partial<RegionFacts> = {}): RegionFacts => ({ present: true, hasContent: true, existingRole: "", ...over })
const facts = (over: Partial<PageFacts> = {}): PageFacts => ({
  center: region(),
  left: region(),
  right: region(),
  otherMain: false,
  takenLabels: {},
  ...over,
})

describe("uniqueLabel", () => {
  it("沒被用過就原樣，用過就加序號", () => {
    expect(uniqueLabel("網站導覽", [])).toBe("網站導覽")
    expect(uniqueLabel("網站導覽", ["breadcrumbs"])).toBe("網站導覽")
    expect(uniqueLabel("網站導覽", ["網站導覽"])).toBe("網站導覽 2")
    expect(uniqueLabel("網站導覽", ["網站導覽", "網站導覽 2"])).toBe("網站導覽 3")
  })
})

describe("planLandmarks", () => {
  it("中間欄 main、左側欄 navigation、右側欄 complementary；左右要有標籤，main 不用", () => {
    expect(planLandmarks(facts())).toEqual({
      center: { role: "main" },
      left: { role: "navigation", label: "網站導覽" },
      right: { role: "complementary", label: "本頁相關" },
    })
  })

  it("頁面已經有 main 就不重複加（其他地標照加）", () => {
    const plan = planLandmarks(facts({ otherMain: true }))
    expect(plan.center).toBeUndefined()
    expect(plan.left?.role).toBe("navigation")
  })

  it("沒有中間欄（版面不是預期的樣子）就整頁都不動", () => {
    expect(planLandmarks(facts({ center: region({ present: false, hasContent: false }) }))).toEqual({})
  })

  it("空的側欄不宣告成地標", () => {
    const plan = planLandmarks(facts({ right: region({ hasContent: false }) }))
    expect(plan.right).toBeUndefined()
    expect(plan.left).toBeDefined()
  })

  it("區塊本來就有 role 就不去動", () => {
    const plan = planLandmarks(facts({ left: region({ existingRole: "group" }), center: region({ existingRole: "main" }) }))
    expect(plan.left).toBeUndefined()
    expect(plan.center).toBeUndefined()
  })

  it("同種地標的標籤已被用掉時加序號，不同種不受影響", () => {
    const plan = planLandmarks(facts({ takenLabels: { navigation: ["網站導覽"], complementary: ["網站導覽"] } }))
    expect(plan.left?.label).toBe("網站導覽 2")
    expect(plan.right?.label).toBe("本頁相關")
  })
})

describe("patchLandmarks", () => {
  const page = (right = "<div class=\"graph\"><h3>關係圖</h3></div>") => `
    <div id="quartz-root" class="page"><div id="quartz-body">
      <div class="left sidebar"><h2 class="page-title">知識庫</h2><div class="explorer">章節</div></div>
      <div class="center"><div class="page-header"><nav aria-label="breadcrumbs">首頁</nav><h1>第1章</h1></div><article>經文</article></div>
      <div class="right sidebar">${right}</div>
      <footer>© 本站</footer>
    </div></div>
    <nav class="bwz-cqb" aria-label="章節快捷列">上一章</nav>`
  const roleOf = (selector: string) => document.querySelector(selector)?.getAttribute("role") ?? null

  it("標在三個欄位上，不新增元素，也不動頁尾和既有的 nav", () => {
    document.body.innerHTML = page()
    const before = document.body.querySelectorAll("*").length
    patchLandmarks()
    expect(document.body.querySelectorAll("*").length).toBe(before)
    expect(roleOf(".center")).toBe("main")
    expect(document.querySelector(".center")?.hasAttribute("aria-label")).toBe(false)
    expect(roleOf(".sidebar.left")).toBe("navigation")
    expect(document.querySelector(".sidebar.left")?.getAttribute("aria-label")).toBe("網站導覽")
    expect(roleOf(".sidebar.right")).toBe("complementary")
    expect(document.querySelector(".sidebar.right")?.getAttribute("aria-label")).toBe("本頁相關")
    expect(roleOf("footer")).toBeNull()
    expect(document.querySelector(".bwz-cqb")?.getAttribute("aria-label")).toBe("章節快捷列")
    // 整頁只有一個 main
    expect(document.querySelectorAll("[role=main], main").length).toBe(1)
  })

  it("重跑不重複、不改變結果", () => {
    document.body.innerHTML = page()
    patchLandmarks()
    const once = document.body.innerHTML
    patchLandmarks()
    applyA11yPatches()
    expect(document.body.innerHTML).toBe(once)
  })

  it("右側欄清空後重跑會收回原本標的地標", () => {
    document.body.innerHTML = page()
    patchLandmarks()
    document.querySelector(".sidebar.right")!.innerHTML = ""
    patchLandmarks()
    const right = document.querySelector(".sidebar.right")!
    expect(right.hasAttribute("role")).toBe(false)
    expect(right.hasAttribute("aria-label")).toBe(false)
    expect(right.hasAttribute("data-site-ux-landmark")).toBe(false)
  })

  it("已有 <main> 時不再加；沒有預期結構時什麼都不做", () => {
    document.body.innerHTML = page().replace("<article>", "<main><article>").replace("</article>", "</article></main>")
    patchLandmarks()
    expect(roleOf(".center")).toBeNull()
    expect(roleOf(".sidebar.left")).toBe("navigation")

    document.body.innerHTML = "<div class=\"left sidebar\">選單</div><p>別的版面</p>"
    const before = document.body.innerHTML
    patchLandmarks()
    expect(document.body.innerHTML).toBe(before)
  })

  it("不碰互動面板的 role（搜尋視窗等 dialog 在側欄裡面）", () => {
    document.body.innerHTML = page().replace("<h2", '<div class="search-container" role="dialog" aria-label="搜尋"></div><h2')
    patchLandmarks()
    const dialog = document.querySelector(".search-container")!
    expect(dialog.getAttribute("role")).toBe("dialog")
    expect(dialog.getAttribute("aria-label")).toBe("搜尋")
  })
})

describe("patchBreadcrumbLabel", () => {
  const crumbLabel = () => document.querySelector("nav.breadcrumb-container")?.getAttribute("aria-label")

  it("英文 breadcrumbs（不分大小寫）改成中文", () => {
    document.body.innerHTML = `<nav class="breadcrumb-container" aria-label="breadcrumbs">首頁</nav>`
    patchBreadcrumbLabel()
    expect(crumbLabel()).toBe(BREADCRUMB_LABEL)

    document.body.innerHTML = `<nav class="breadcrumb-container" aria-label="Breadcrumbs">首頁</nav>`
    patchBreadcrumbLabel()
    expect(crumbLabel()).toBe(BREADCRUMB_LABEL)
  })

  it("沒有 aria-label 就補上", () => {
    document.body.innerHTML = `<nav class="breadcrumb-container">首頁</nav>`
    patchBreadcrumbLabel()
    expect(crumbLabel()).toBe(BREADCRUMB_LABEL)
  })

  it("其他標籤不動；不是麵包屑的 nav 也不動", () => {
    document.body.innerHTML = `<nav class="breadcrumb-container" aria-label="麵包屑">首頁</nav><nav aria-label="breadcrumbs">別的導覽</nav>`
    patchBreadcrumbLabel()
    expect(crumbLabel()).toBe("麵包屑")
    expect(document.querySelector("nav:not(.breadcrumb-container)")?.getAttribute("aria-label")).toBe("breadcrumbs")
  })

  it("重跑結果不變（也不影響 applyA11yPatches 的其他步驟）", () => {
    document.body.innerHTML = `<div id="quartz-body"><div class="center"><nav class="breadcrumb-container" aria-label="breadcrumbs">首頁</nav><article>經文</article></div></div>`
    applyA11yPatches()
    const once = document.body.innerHTML
    expect(crumbLabel()).toBe(BREADCRUMB_LABEL)
    patchBreadcrumbLabel()
    applyA11yPatches()
    expect(document.body.innerHTML).toBe(once)
  })
})
