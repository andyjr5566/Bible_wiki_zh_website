// 章節頁「純經文」模式要藏哪些區塊（U-23）。只吃文章第一層子節點的簡化描述、不碰 DOM，
// 因為內容格式還會變：規則集中在這裡測試，畫面層（site-ux）只負責描述節點和加 class。
// 認不出經文清單（第一條 hr 之前的第一個 ol）就整個退回，不藏任何東西。
export interface ChapterNodeDescription {
  tag: string
  className?: string
  text?: string
  headingText?: string
}

export interface ChapterRegionSelection {
  verseListIndex: number | null
  hide: number[]
}

// 集中列出要隱藏的標題，因為內容改名時只需更新這份清單。
const HIDDEN_SECTION_TITLES = ["本章知識節點", "本章整理", "附錄"] as const

function tagOf(node: ChapterNodeDescription): string {
  return node.tag.toLowerCase()
}

function isSectionBoundary(node: ChapterNodeDescription): boolean {
  const tag = tagOf(node)
  return tag === "h2" || tag === "details"
}

// 先做相容正規化並忽略空白，因為標題可能帶全形空格或 emoji 前綴。
function normalizedHeading(node: ChapterNodeDescription): string {
  return (node.headingText ?? "").normalize("NFKC").replace(/\s+/gu, "")
}

function isHiddenSection(node: ChapterNodeDescription): boolean {
  if (!isSectionBoundary(node)) return false
  const heading = normalizedHeading(node)
  return HIDDEN_SECTION_TITLES.some((title) => heading.includes(title))
}

function isNavigationTable(node: ChapterNodeDescription): boolean {
  if (!node.className?.includes("table-container")) return false
  const text = node.text ?? ""
  return text.includes("前一章") || text.includes("下一章")
}

// 讀者按下返回、或點到指向被藏區塊的連結時，只需要暫時顯示「那一個」區塊，所以每個區塊分開回報。
export interface HiddenSection {
  /** 區塊標題節點（h2 或 details）的索引 */
  start: number
  /** 這個區塊要隱藏的所有節點索引（含緊貼在前面的 hr；不含經文清單與前後章表格） */
  indices: number[]
}

interface ScannedRange {
  start: number
  end: number
}

interface Scan {
  verseListIndex: number | null
  ranges: ScannedRange[]
}

function scan(nodes: readonly ChapterNodeDescription[]): Scan {
  const firstHrIndex = nodes.findIndex((node) => tagOf(node) === "hr")
  const verseListIndex = nodes.findIndex(
    (node, index) => tagOf(node) === "ol" && (firstHrIndex === -1 || index < firstHrIndex),
  )
  if (verseListIndex === -1) return { verseListIndex: null, ranges: [] }

  const ranges: ScannedRange[] = []
  let index = verseListIndex + 1
  while (index < nodes.length) {
    if (!isHiddenSection(nodes[index])) {
      index += 1
      continue
    }
    // 連續的目標區塊各自成一段：每遇到下一個 h2／details 就換段（不管它要不要隱藏）
    const start = index
    let end = start + 1
    while (end < nodes.length && !isSectionBoundary(nodes[end])) end += 1
    ranges.push({ start, end })
    index = end
  }
  return { verseListIndex, ranges }
}

export function selectHiddenSections(nodes: readonly ChapterNodeDescription[]): HiddenSection[] {
  const { verseListIndex, ranges } = scan(nodes)
  if (verseListIndex === null) return []

  return ranges.map(({ start, end }) => {
    const indices: number[] = []
    if (start - 1 > verseListIndex && tagOf(nodes[start - 1]) === "hr") indices.push(start - 1)
    for (let regionIndex = start; regionIndex < end; regionIndex += 1) {
      if (regionIndex !== verseListIndex && !isNavigationTable(nodes[regionIndex])) indices.push(regionIndex)
    }
    return { start, indices }
  })
}

export function selectChapterRegions(nodes: readonly ChapterNodeDescription[]): ChapterRegionSelection {
  const { verseListIndex } = scan(nodes)
  if (verseListIndex === null) return { verseListIndex: null, hide: [] }

  const hidden = new Set<number>()
  for (const section of selectHiddenSections(nodes)) {
    for (const index of section.indices) hidden.add(index)
  }
  return { verseListIndex, hide: [...hidden].sort((a, b) => a - b) }
}

// 「本章整理」的範圍，供「回到剛才的本章整理」記錄用：標題節點到下一個 h2／details 之前。
export const STUDY_SECTION_TITLE = "本章整理"

export interface StudyRegion {
  start: number
  end: number
}

export function selectStudyRegion(nodes: readonly ChapterNodeDescription[]): StudyRegion | null {
  const { ranges } = scan(nodes)
  for (const range of ranges) {
    if (normalizedHeading(nodes[range.start]).includes(STUDY_SECTION_TITLE)) return range
  }
  return null
}

/**
 * 本章整理裡某個節點「最近的上一個小標題」：往前找 h3，沒有就用整理的標題本身。
 * 節點不在本章整理裡回傳 null（連結在別的區塊就不記）。
 */
export function studyAnchorIndex(
  nodes: readonly ChapterNodeDescription[],
  region: StudyRegion,
  nodeIndex: number,
): number | null {
  if (nodeIndex < region.start || nodeIndex >= region.end) return null
  for (let index = nodeIndex; index > region.start; index -= 1) {
    if (tagOf(nodes[index]) === "h3") return index
  }
  return region.start
}

export interface ChapterTabRegions {
  verseListIndex: number | null
  /** 經文分頁要藏的節點索引（知識節點、本章整理、附錄與分隔線）；研讀分頁顯示完整一整頁，不隱藏經文 */
  studyIndices: number[]
  /** 「## 本章整理」標題節點索引（供研讀頁「跳到本章整理」按鈕定位；沒有整理時為 null） */
  studyHeadingIndex: number | null
  /** 同時具備經文與研讀內容時才顯示「經文｜研讀」分頁；沒有研讀內容的章節不隱藏任何內容 */
  hasStudyContent: boolean
}

export interface TabBarAnchor {
  index: number
  position: "before" | "after"
}

function hasClassToken(node: ChapterNodeDescription, token: string): boolean {
  if (!node.className) return false
  return node.className.split(/\s+/u).includes(token)
}

function isReadAloudBar(node: ChapterNodeDescription): boolean {
  return hasClassToken(node, "bwz-ra")
}

function isInteractiveLine(node: ChapterNodeDescription): boolean {
  return hasClassToken(node, "bwz-ia-line")
}

/** 計算「經文｜研讀」分頁各自要隱藏／定位的節點範圍（B2 修正：研讀頁為完整一整頁，不藏經文與朗讀列）。 */
export function selectChapterTabRegions(nodes: readonly ChapterNodeDescription[]): ChapterTabRegions {
  const { verseListIndex, hide: studyIndices } = selectChapterRegions(nodes)
  if (verseListIndex === null || studyIndices.length === 0) {
    return { verseListIndex, studyIndices: [], studyHeadingIndex: null, hasStudyContent: false }
  }

  const studyRegion = selectStudyRegion(nodes)
  return {
    verseListIndex,
    studyIndices,
    studyHeadingIndex: studyRegion?.start ?? null,
    hasStudyContent: true,
  }
}

/**
 * 決定頂端「經文｜研讀」分頁列要插在哪個節點旁邊：
 * 優先放在頁首「前一章／下一章」表格之後；沒有表格則放在章節標題 h1 之後；再退回放在經文區之前。
 */
export function tabBarAnchorIndex(nodes: readonly ChapterNodeDescription[]): TabBarAnchor | null {
  const { verseListIndex, hasStudyContent } = selectChapterTabRegions(nodes)
  if (verseListIndex === null || !hasStudyContent) return null

  for (let i = 0; i < verseListIndex; i += 1) {
    if (isNavigationTable(nodes[i])) return { index: i, position: "after" }
  }
  for (let i = 0; i < verseListIndex; i += 1) {
    if (tagOf(nodes[i]) === "h1") return { index: i, position: "after" }
  }
  let beforeIdx = verseListIndex
  while (beforeIdx > 0 && (isReadAloudBar(nodes[beforeIdx - 1]) || isInteractiveLine(nodes[beforeIdx - 1]))) {
    beforeIdx -= 1
  }
  return { index: beforeIdx, position: "before" }
}
