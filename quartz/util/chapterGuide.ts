// 本章導覽面板的純邏輯（零 DOM 依賴，便於單元測試與元件共用）：
//   1. 「怎麼看這一頁」圖例項目（依實際出現的元件動態產生，沒有的項目不列）
//   2. 「經文」分頁的段落大綱擷取（「經文大綱」清單／表格優先，其次小節標題經節範圍）
//   3. 「本章引用的資料」整理（讀 .bwz-rl-meta JSON，去除內部欄位、防不安全 URL）
//   4. 捲動高亮位置計算與單次捲動目標座標計算
import { parseHeadingVerseRange, type PageSourcesPayload, type SourceCardEntry } from "./readingLayersClient"

export interface LegendFlags {
  readonly hasQuotes: boolean
  readonly hasCommentaryQuotes?: boolean
  readonly hasSources: boolean
  readonly hasOrigChips: boolean
  readonly hasCards: boolean
  /** 若頁面上原文編號全為希臘文（G 開頭）可為 "greek"；預設或希伯來文為 "hebrew" */
  readonly origScript?: "hebrew" | "greek" | "mixed"
}

export interface LegendItem {
  readonly key: "quote" | "cquote" | "src" | "orig" | "card"
  readonly sample: string
  readonly sampleKind: "quote" | "cquote" | "src" | "orig" | "card"
  readonly text: string
}

export interface VerseOutlineItem {
  readonly id: string
  readonly label: string
  readonly startVerse: number
  readonly endVerse: number
}

export interface GuideSourcesSummary {
  readonly entries: SourceCardEntry[]
  readonly sourcesHref: string
  readonly externalUrl?: string
}

export interface ScrollTargetInput {
  readonly elementTop: number
  readonly scrollY: number
  readonly obstructionBottom: number
  readonly margin?: number
}

export interface GuideResourceCounts {
  readonly knowledgeCount: number
  readonly knowledgeId?: string
  readonly maps: readonly { title: string; href?: string; targetId?: string }[]
  readonly interactiveSites: readonly { title: string; href?: string; targetId?: string }[]
  readonly sourcesHref: string
}

const ORDERED_LIST_PREFIX_RE = /^\d+\s*[.、．]\s*/u
const TRAILING_PARENS_RE = /[（(]([^（）()]+)[）)]\s*$/u
const TABLE_RANGE_CELL_RE =
  /^(?:[vV]\s*|第\s*)?(\d+)(?:\s*[-–—~～]\s*(\d+))?\s*節?$/u
const SAFE_HTTP_URL_RE = /^https?:\/\//i

/** 依目前頁面實際出現的標記元件建立「怎麼看這一頁」圖例項目；沒有的不列。 */
export function buildLegendItems(flags: LegendFlags): LegendItem[] {
  const items: LegendItem[] = []
  if (flags.hasQuotes) {
    items.push({
      key: "quote",
      sample: "聖經原句",
      sampleKind: "quote",
      text: "褐色字＝聖經原句（後面的小標籤是節數）",
    })
  }
  if (flags.hasCommentaryQuotes) {
    items.push({
      key: "cquote",
      sample: "註釋原話",
      sampleKind: "cquote",
      text: "青色字＝註釋書的原話（後面括號是哪一本）",
    })
  }
  if (flags.hasSources) {
    items.push({
      key: "src",
      sample: "黃迦勒",
      sampleKind: "src",
      text: "虛線名字＝點了看是哪本註釋",
    })
  }
  if (flags.hasOrigChips) {
    const origText =
      flags.origScript === "greek"
        ? "「原文」小按鈕＝點了看希臘字與編號"
        : flags.origScript === "mixed"
          ? "「原文」小按鈕＝點了看原文與編號"
          : "「原文」小按鈕＝點了看希伯來字與編號"
    items.push({
      key: "orig",
      sample: "原文",
      sampleKind: "orig",
      text: origText,
    })
  }
  if (flags.hasCards) {
    items.push({
      key: "card",
      sample: "深入",
      sampleKind: "card",
      text: "原文／背景／應用卡片＝想深入再點開",
    })
  }
  return items
}

/** 嘗試從單行文字（如清單項目或表格儲存格）拆出標題與經節區間；無效回傳 null。 */
export function parseVerseOutlineLine(rawText: string): Omit<VerseOutlineItem, "id"> | null {
  const collapsed = rawText.replace(/\s+/g, " ").trim()
  if (!collapsed) return null
  const verses = parseHeadingVerseRange(collapsed)
  if (!verses || verses.length === 0) return null
  const startVerse = Math.min(...verses)
  const endVerse = Math.max(...verses)
  const withoutOrder = collapsed.replace(ORDERED_LIST_PREFIX_RE, "").trim()
  const parenMatch = TRAILING_PARENS_RE.exec(withoutOrder)
  const titlePart = parenMatch
    ? withoutOrder.slice(0, parenMatch.index).trim()
    : withoutOrder
  const rangePart = parenMatch ? parenMatch[1].trim() : `${startVerse}-${endVerse}節`
  const label = titlePart ? `${titlePart}（${rangePart}）` : `${rangePart}`
  return { label, startVerse, endVerse }
}

/** 從純經節範圍儲存格（如「1-5節」、「3」）拆出起迄節數。 */
function parseTableRangeCell(rawCell: string): { start: number; end: number; label: string } | null {
  const cleaned = rawCell.normalize("NFKC").replace(/\s+/g, "").trim()
  const m = TABLE_RANGE_CELL_RE.exec(cleaned)
  if (!m) return null
  const start = Number(m[1])
  const end = m[2] ? Number(m[2]) : start
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > 200) {
    return null
  }
  const label = end === start ? `${start}節` : `${start}-${end}節`
  return { start, end, label }
}

/** 從表格列（每個 row 為儲存格文字陣列）嘗試擷取經文大綱段落。 */
export function parseOutlineFromTableRows(rows: readonly (readonly string[])[]): VerseOutlineItem[] {
  const items: VerseOutlineItem[] = []
  for (let i = 0; i < rows.length; i += 1) {
    const cells = rows[i].map((c) => c.trim())
    if (cells.length === 0) continue

    let parsed: Omit<VerseOutlineItem, "id"> | null = null
    for (const cell of cells) {
      const candidate = parseVerseOutlineLine(cell)
      if (candidate) {
        parsed = candidate
        break
      }
    }

    if (!parsed && cells.length >= 2) {
      const range0 = parseTableRangeCell(cells[0])
      const desc1 = cells[1]?.replace(/\s+/g, " ").trim()
      if (range0 && desc1) {
        parsed = {
          label: `${desc1}（${range0.label}）`,
          startVerse: range0.start,
          endVerse: range0.end,
        }
      } else {
        const range1 = parseTableRangeCell(cells[1])
        const desc0 = cells[0]?.replace(/\s+/g, " ").trim()
        if (range1 && desc0) {
          parsed = {
            label: `${desc0}（${range1.label}）`,
            startVerse: range1.start,
            endVerse: range1.end,
          }
        }
      }
    }

    if (parsed) {
      items.push({ id: `text-outline-${items.length + 1}`, ...parsed })
    }
  }
  return items
}

export interface TextOutlineSourceInput {
  /** 「經文大綱」標題下的清單項目純文字 */
  readonly outlineListItems: readonly string[]
  /** 「經文大綱」標題下或第一個小節表格的列資料 */
  readonly tableRows: readonly (readonly string[])[]
  /** 本章整理底下的 ### 標題列表 */
  readonly subHeadings: readonly { id: string; text: string }[]
}

/**
 * 依規格產生「經文分頁」的大綱：
 *   ① 優先取「經文大綱」的清單或表格（若無則取第一個帶經節範圍的小節表格）；
 *   ② 沒有則改用 ### 小節標題裡的經節範圍。
 */
export function extractTextOutline(input: TextOutlineSourceInput): VerseOutlineItem[] {
  const fromList: VerseOutlineItem[] = []
  for (const line of input.outlineListItems) {
    const parsed = parseVerseOutlineLine(line)
    if (parsed) {
      fromList.push({ id: `text-outline-${fromList.length + 1}`, ...parsed })
    }
  }
  if (fromList.length > 0) return fromList

  const fromTable = parseOutlineFromTableRows(input.tableRows)
  if (fromTable.length > 0) return fromTable

  const fromHeadings: VerseOutlineItem[] = []
  for (const h of input.subHeadings) {
    const parsed = parseVerseOutlineLine(h.text)
    if (parsed) {
      fromHeadings.push({
        id: h.id || `text-outline-${fromHeadings.length + 1}`,
        ...parsed,
      })
    }
  }
  return fromHeadings
}

/** 計算預設「全部資料來源說明 →」的相對網址，維持網站子路徑部署相容。 */
export function resolveSourcesHrefFromSlug(slug: string, explicitHref?: string): string {
  if (explicitHref && explicitHref.trim()) return explicitHref.trim()
  const parts = slug.split("/").filter(Boolean)
  const ups = Math.max(0, parts.length - 1)
  return `${"../".repeat(ups)}${encodeURI("資料來源")}`
}

/** 從頁面嵌入的 .bwz-rl-meta JSON 整理「本章引用的資料」清單；不含內部欄位，過濾無效網址。 */
export function buildGuideSources(
  rawJson: string | null | undefined,
  slug: string,
): GuideSourcesSummary {
  const fallbackHref = resolveSourcesHrefFromSlug(slug)
  if (!rawJson || !rawJson.trim()) {
    return { entries: [], sourcesHref: fallbackHref }
  }
  let payload: Partial<PageSourcesPayload>
  try {
    payload = JSON.parse(rawJson) as Partial<PageSourcesPayload>
  } catch {
    return { entries: [], sourcesHref: fallbackHref }
  }
  const map = payload.entries ?? {}
  const order = Array.isArray(payload.order) ? payload.order : Object.keys(map)
  const seen = new Set<string>()
  const entries: SourceCardEntry[] = []

  for (const key of order) {
    const entry = map[key]
    if (!entry || !entry.name) continue
    const dedupeKey = `${entry.name}::${entry.title ?? ""}`
    if (seen.has(dedupeKey)) continue
    seen.add(dedupeKey)
    entries.push(entry)
  }

  let externalUrl: string | undefined
  for (const entry of entries) {
    if (entry.url && SAFE_HTTP_URL_RE.test(entry.url.trim())) {
      externalUrl = entry.url.trim()
      break
    }
  }

  return {
    entries,
    sourcesHref: resolveSourcesHrefFromSlug(slug, payload.sourcesHref),
    externalUrl,
  }
}

/**
 * 依各標題目前相對視口上緣的位置，找出正在閱讀的項目索引（最後一個 top <= probeY）。
 * 均在視口下方時回傳 0；無項目時回傳 -1。
 */
export function activeOutlineIndex(entriesTopY: readonly number[], probeY: number): number {
  if (entriesTopY.length === 0) return -1
  let active = 0
  for (let i = 0; i < entriesTopY.length; i += 1) {
    if (entriesTopY[i] <= probeY) active = i
  }
  return active
}

/** 經文分頁依目前捲動到的經節編號，找出對應的大綱項目索引；沒有段落時回傳 -1。 */
export function activeVerseOutlineIndex(
  items: readonly VerseOutlineItem[],
  currentVerse: number | null,
): number {
  if (items.length === 0) return -1
  if (currentVerse === null) return 0
  for (let i = 0; i < items.length; i += 1) {
    if (currentVerse >= items[i].startVerse && currentVerse <= items[i].endVerse) {
      return i
    }
  }
  // 若介於段落之間，取最後一個起始節不超過 currentVerse 的項目
  let fallback = 0
  for (let i = 0; i < items.length; i += 1) {
    if (items[i].startVerse <= currentVerse) fallback = i
  }
  return fallback
}

/** 計算單次 window.scrollTo 目標垂直座標（扣掉黏頂列高度與舒適間距），不使用 scrollIntoView。 */
export function computeScrollTargetTop(input: ScrollTargetInput): number {
  const margin = input.margin ?? 12
  return Math.max(0, Math.round(input.elementTop + input.scrollY - input.obstructionBottom - margin))
}
