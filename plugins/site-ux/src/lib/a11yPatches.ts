// 無障礙修補（B5-4）：主題外掛產生的 HTML 有幾處不合規，外掛本身不能改（CI 會重新 clone），
// 所以每次換頁後在瀏覽器端補上。判斷規則寫成不碰 DOM 的純函式，方便單元測試；DOM 操作集中在 applyA11yPatches。
// 1. 目錄按鈕的 aria-controls 指向不存在的 id → 改指實際的清單。
// 2. 表格：整欄文字都很短的欄標 data-short（CSS 讓它不換行），其他欄可以換行；首頁進度條的方塊包成 span。
// 3. 可以左右捲動的表格容器要能用鍵盤聚焦。

/** 一欄所有儲存格（含表頭）都不超過這麼多字，就算「短資料欄」。 */
export const SHORT_COLUMN_MAX_CHARS = 6
/** 進度條：開頭至少這麼多個 █／░。 */
const BAR_PATTERN = /^\s*([█░]{5,})/

/** 回傳短資料欄的欄號。rows 是每一列的儲存格文字；列的長度可以不同（少的欄當作沒有那格）。 */
export function shortColumnIndexes(rows: string[][], maxChars = SHORT_COLUMN_MAX_CHARS): number[] {
  const columnCount = rows.reduce((max, cells) => Math.max(max, cells.length), 0)
  const result: number[] = []
  for (let column = 0; column < columnCount; column++) {
    const cells = rows.map((cells) => cells[column]).filter((text): text is string => text !== undefined)
    // Array.from 依字元計算（全形字、emoji 都算一個）
    if (cells.length > 0 && cells.every((text) => Array.from(text.trim()).length <= maxChars)) {
      result.push(column)
    }
  }
  return result
}

/** 文字開頭是進度條時，拆成方塊與其餘文字；不是就回傳 null。 */
export function splitProgressBar(text: string): { bar: string; rest: string } | null {
  const m = BAR_PATTERN.exec(text)
  return m ? { bar: m[1], rest: text.slice(m[0].length) } : null
}

let generatedId = 0

function patchTocControls(root: ParentNode): void {
  for (const header of Array.from(root.querySelectorAll<HTMLButtonElement>("button.toc-header"))) {
    const controlledId = header.getAttribute("aria-controls")
    if (controlledId && document.getElementById(controlledId)) continue

    const adjacent = header.nextElementSibling
    const content =
      adjacent instanceof HTMLElement && adjacent.matches(".toc-content")
        ? adjacent
        : (header.parentElement?.querySelector<HTMLElement>(".toc-content") ?? null)
    // 偵測不到預期結構就不動
    if (!content) continue

    const list = content.matches("ul") ? content : (content.querySelector<HTMLElement>("ul") ?? content)
    if (!list.id) {
      let id = ""
      do {
        id = `site-ux-toc-content-${++generatedId}`
      } while (document.getElementById(id))
      list.id = id
    }
    header.setAttribute("aria-controls", list.id)
  }
}

function patchTable(table: HTMLTableElement): void {
  const cellsByRow = Array.from(table.rows, (row) => Array.from(row.cells))
  const texts = cellsByRow.map((cells) => cells.map((cell) => cell.textContent ?? ""))
  for (const column of shortColumnIndexes(texts)) {
    for (const cells of cellsByRow) cells[column]?.setAttribute("data-short", "")
  }

  // 首頁的書卷進度條（████░░ 100%）：方塊包成 span（螢幕閱讀器不念 20 個方塊），手機上由 CSS 縮成細條
  for (const cell of Array.from(table.querySelectorAll<HTMLTableCellElement>("td"))) {
    if (cell.hasAttribute("data-bar")) continue
    const first = cell.firstChild
    if (!first || first.nodeType !== Node.TEXT_NODE) continue
    const parts = splitProgressBar(first.textContent ?? "")
    if (!parts) continue
    const bar = document.createElement("span")
    bar.className = "site-ux-bar"
    bar.setAttribute("aria-hidden", "true")
    bar.textContent = parts.bar
    first.textContent = parts.rest
    cell.insertBefore(bar, first)
    cell.setAttribute("data-bar", "")
  }
}

/** 可以左右捲動的表格容器才加（視窗大小改變時要重新判斷，見 applyScrollableRegions）。 */
export function applyScrollableRegions(root: ParentNode = document): void {
  for (const container of Array.from(root.querySelectorAll<HTMLElement>("article .table-container"))) {
    if (container.scrollWidth > container.clientWidth) {
      container.setAttribute("tabindex", "0")
      container.setAttribute("role", "region")
      container.setAttribute("aria-label", "表格（可左右捲動）")
    } else if (container.getAttribute("role") === "region") {
      container.removeAttribute("tabindex")
      container.removeAttribute("role")
      container.removeAttribute("aria-label")
    }
  }
}

/** 每次換頁後呼叫一次。 */
export function applyA11yPatches(root: ParentNode = document): void {
  patchTocControls(root)
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>("article table"))) patchTable(table)
  applyScrollableRegions(root)
}
