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
