// 無障礙修補（B5-4）：主題外掛產生的 HTML 有幾處不合規，外掛本身不能改（CI 會重新 clone），
// 所以每次換頁後在瀏覽器端補上。判斷規則寫成不碰 DOM 的純函式，方便單元測試；DOM 操作集中在 applyA11yPatches。
// 1. 目錄按鈕的 aria-controls 指向不存在的 id → 改指實際的清單。
// 2. 表格：整欄文字都很短的欄標 data-short（CSS 讓它不換行），其他欄可以換行；短儲存格標 data-short-cell
//    （不從字中間拆）；首頁進度條的方塊包成 span。
// 3. 可以左右捲動的表格容器要能用鍵盤聚焦。
// 4. 地標（landmark）：主題的版面全是沒有語意的 div，螢幕閱讀器的「地標」清單裡找不到主要內容，
//    每頁都得先聽完搜尋、工具列、上百個章節的選單。這裡只加 role／aria-label，不新增任何元素，畫面不變。

/** 一欄所有儲存格（含表頭）都不超過這麼多字，就算「短資料欄」。 */
export const SHORT_COLUMN_MAX_CHARS = 6
/** 進度條：開頭至少這麼多個 █／░。 */
const BAR_PATTERN = /^\s*([█░]{5,})/

/** 文字是否算「短」（依字元計算，前後空白不算）。 */
export function isShortText(text: string, maxChars = SHORT_COLUMN_MAX_CHARS): boolean {
  return Array.from(text.trim()).length <= maxChars
}

/** 以空白分開的每個片段都是短文字（例如「申命記 — 啟示錄」）。 */
export function isShortWords(text: string, maxChars = SHORT_COLUMN_MAX_CHARS): boolean {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.length > 0 && words.every((word) => isShortText(word, maxChars))
}

/** 回傳短資料欄的欄號。rows 是每一列的儲存格文字；列的長度可以不同（少的欄當作沒有那格）。 */
export function shortColumnIndexes(rows: string[][], maxChars = SHORT_COLUMN_MAX_CHARS): number[] {
  const columnCount = rows.reduce((max, cells) => Math.max(max, cells.length), 0)
  const result: number[] = []
  for (let column = 0; column < columnCount; column++) {
    const cells = rows.map((cells) => cells[column]).filter((text): text is string => text !== undefined)
    // Array.from 依字元計算（全形字、emoji 都算一個）
    if (cells.length > 0 && cells.every((text) => isShortText(text, maxChars))) {
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
  // 長欄裡由短詞組成的儲存格（例如和「士師記 — 啟示錄」同一欄的「出埃及記」）：不從字中間拆，只在空白換行
  cellsByRow.forEach((cells, row) =>
    cells.forEach((cell, column) => {
      if (isShortWords(texts[row][column])) cell.setAttribute("data-short-cell", "")
    }),
  )

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

// ---- 地標 ----

/** 一個版面區塊的現況（由 DOM 蒐集，判斷本身不碰 DOM）。 */
export interface RegionFacts {
  /** 頁面上有這個區塊嗎 */
  present: boolean
  /** 區塊裡有可讀的文字嗎（空的側欄不要宣告成地標，螢幕閱讀器會念出一個空的「本頁相關」） */
  hasContent: boolean
  /** 區塊本來就有的 role（不含我們自己加的）；有就不去動它 */
  existingRole: string
}

export interface PageFacts {
  center: RegionFacts
  left: RegionFacts
  right: RegionFacts
  /** 頁面上（不含我們標的）是否已經有 main 地標；同一頁只能有一個 */
  otherMain: boolean
  /** 頁面上既有的同種地標 aria-label，依 role 分組；同種地標標籤不能重複 */
  takenLabels: Partial<Record<LandmarkRole, string[]>>
}

export type LandmarkRole = "main" | "navigation" | "complementary"
export interface LandmarkAssignment {
  role: LandmarkRole
  label?: string
}
export type RegionName = "center" | "left" | "right"

/** 左側欄、右側欄的標籤。 */
export const LEFT_LABEL = "網站導覽"
export const RIGHT_LABEL = "本頁相關"

/** 標籤若已被同種地標用掉，就加序號（「網站導覽 2」），避免 axe 的 landmark-unique。 */
export function uniqueLabel(label: string, taken: readonly string[]): string {
  if (!taken.includes(label)) return label
  let n = 2
  while (taken.includes(`${label} ${n}`)) n++
  return `${label} ${n}`
}

function claimable(region: RegionFacts): boolean {
  return region.present && region.hasContent && region.existingRole === ""
}

/**
 * 決定哪個區塊要補什麼地標。
 * - 中間欄（頁面標題＋經文）當 main：跳到「主要內容」後先聽到標題，再聽到經文；筆記區、麵包屑都在裡面。
 *   不選 article，因為標題在 article 外面，會變成地標外的內容。
 * - 沒有中間欄就整頁都不動：版面不是預期的樣子時，寧可不補也不要補錯。
 * - 頁首不補 banner：左側欄同時裝著網站名稱、工具列和選單，已經是 navigation，地標不能巢狀；頁尾本來就是 footer。
 */
export function planLandmarks(facts: PageFacts): Partial<Record<RegionName, LandmarkAssignment>> {
  const plan: Partial<Record<RegionName, LandmarkAssignment>> = {}
  if (!facts.center.present) return plan

  if (!facts.otherMain && claimable(facts.center)) plan.center = { role: "main" }
  if (claimable(facts.left)) {
    plan.left = { role: "navigation", label: uniqueLabel(LEFT_LABEL, facts.takenLabels.navigation ?? []) }
  }
  if (claimable(facts.right)) {
    plan.right = { role: "complementary", label: uniqueLabel(RIGHT_LABEL, facts.takenLabels.complementary ?? []) }
  }
  return plan
}

/** 我們自己標的地標會帶這個屬性：換頁重跑時才認得出哪些是自己加的，不會當成「本來就有」，也能在條件改變時收回。 */
const LANDMARK_MARK = "data-site-ux-landmark"
const REGION_SELECTORS: Record<RegionName, string> = {
  center: "#quartz-body > .center",
  left: "#quartz-body > .sidebar.left",
  right: "#quartz-body > .sidebar.right",
}
const LANDMARK_SELECTORS: Record<LandmarkRole, string> = {
  main: "main, [role=main]",
  navigation: "nav, [role=navigation]",
  complementary: "aside, [role=complementary]",
}

function regionFacts(el: HTMLElement | null): RegionFacts {
  if (!el) return { present: false, hasContent: false, existingRole: "" }
  const ours = el.hasAttribute(LANDMARK_MARK)
  return {
    present: true,
    hasContent: (el.textContent ?? "").trim() !== "",
    existingRole: ours ? "" : (el.getAttribute("role") ?? ""),
  }
}

function collectFacts(root: ParentNode, regions: Record<RegionName, HTMLElement | null>): PageFacts {
  const others = (role: LandmarkRole) =>
    Array.from(root.querySelectorAll<HTMLElement>(LANDMARK_SELECTORS[role])).filter((el) => !el.hasAttribute(LANDMARK_MARK))
  const labelsOf = (role: LandmarkRole) =>
    others(role)
      .map((el) => el.getAttribute("aria-label") ?? "")
      .filter(Boolean)
  return {
    center: regionFacts(regions.center),
    left: regionFacts(regions.left),
    right: regionFacts(regions.right),
    otherMain: others("main").length > 0,
    takenLabels: { navigation: labelsOf("navigation"), complementary: labelsOf("complementary") },
  }
}

/** 只加語意、不新增元素；每次換頁都可以安全重跑（冪等）。 */
export function patchLandmarks(root: ParentNode = document): void {
  const regions = Object.fromEntries(
    (Object.keys(REGION_SELECTORS) as RegionName[]).map((name) => [name, root.querySelector<HTMLElement>(REGION_SELECTORS[name])]),
  ) as Record<RegionName, HTMLElement | null>
  const plan = planLandmarks(collectFacts(root, regions))

  for (const name of Object.keys(regions) as RegionName[]) {
    const el = regions[name]
    if (!el) continue
    const assignment = plan[name]
    if (assignment) {
      el.setAttribute("role", assignment.role)
      if (assignment.label) el.setAttribute("aria-label", assignment.label)
      else el.removeAttribute("aria-label")
      el.setAttribute(LANDMARK_MARK, "")
    } else if (el.hasAttribute(LANDMARK_MARK)) {
      // 之前標過、現在條件不成立了（例如右側欄清空）：收回
      el.removeAttribute("role")
      el.removeAttribute("aria-label")
      el.removeAttribute(LANDMARK_MARK)
    }
  }
}

/** 每次換頁後呼叫一次。 */
export function applyA11yPatches(root: ParentNode = document): void {
  patchLandmarks(root)
  patchTocControls(root)
  for (const table of Array.from(root.querySelectorAll<HTMLTableElement>("article table"))) patchTable(table)
  applyScrollableRegions(root)
}
