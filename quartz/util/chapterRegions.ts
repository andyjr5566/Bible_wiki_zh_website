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

function isHiddenSection(node: ChapterNodeDescription): boolean {
  if (!isSectionBoundary(node)) return false
  // 先做相容正規化並忽略空白，因為標題可能帶全形空格或 emoji 前綴。
  const heading = (node.headingText ?? "").normalize("NFKC").replace(/\s+/gu, "")
  return HIDDEN_SECTION_TITLES.some((title) => heading.includes(title))
}

function isNavigationTable(node: ChapterNodeDescription): boolean {
  if (!node.className?.includes("table-container")) return false
  const text = node.text ?? ""
  return text.includes("前一章") || text.includes("下一章")
}

export function selectChapterRegions(nodes: readonly ChapterNodeDescription[]): ChapterRegionSelection {
  const firstHrIndex = nodes.findIndex((node) => tagOf(node) === "hr")
  const verseListIndex = nodes.findIndex(
    (node, index) => tagOf(node) === "ol" && (firstHrIndex === -1 || index < firstHrIndex),
  )
  if (verseListIndex === -1) return { verseListIndex: null, hide: [] }

  const hidden = new Set<number>()
  let index = verseListIndex + 1

  while (index < nodes.length) {
    if (!isHiddenSection(nodes[index])) {
      index += 1
      continue
    }

    const start = index
    if (start - 1 > verseListIndex && tagOf(nodes[start - 1]) === "hr") {
      hidden.add(start - 1)
    }

    let end = start + 1
    while (end < nodes.length && (!isSectionBoundary(nodes[end]) || isHiddenSection(nodes[end]))) {
      end += 1
    }

    for (let regionIndex = start; regionIndex < end; regionIndex += 1) {
      if (regionIndex !== verseListIndex && !isNavigationTable(nodes[regionIndex])) {
        hidden.add(regionIndex)
      }
    }
    index = end
  }

  return { verseListIndex, hide: [...hidden].sort((a, b) => a - b) }
}
