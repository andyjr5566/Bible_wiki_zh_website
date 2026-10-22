// @vitest-environment jsdom
import { describe, expect, it } from "vitest"
import { applyA11yPatches, isShortWords, shortColumnIndexes, splitProgressBar } from "../src/lib/a11yPatches"

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
