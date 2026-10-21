// 條目的分類直接用 content/link_folder/ 底下的資料夾名稱（使用者 2026-10-21 要求，不再合併）。
// 這裡只決定已知資料夾的排列順序；新出現的資料夾會自動成為一類，排在已知資料夾之後。
export const LINK_FOLDER_ORDER = [
  "人物",
  "地點",
  "事件",
  "歷史",
  "背景",
  "文化",
  "神學",
  "主題",
  "原文",
  "互文",
  "解經爭議",
] as const
export const CHAPTER_CATEGORY = "章節"
export const OTHER_CATEGORY = "其他"
export const SECTOR_ORDER = [CHAPTER_CATEGORY, ...LINK_FOLDER_ORDER, OTHER_CATEGORY]
export const LIST_ORDER = [...LINK_FOLDER_ORDER, OTHER_CATEGORY, CHAPTER_CATEGORY]

export type GraphCategory = string

const isSpecial = (category: string) => category === CHAPTER_CATEGORY || category === OTHER_CATEGORY
const knownIndex = (category: string) => (LINK_FOLDER_ORDER as readonly string[]).indexOf(category)

function folderCategories(categories: Iterable<string>): string[] {
  const known = [...LINK_FOLDER_ORDER].filter((c) => [...categories].includes(c))
  const extra = [...new Set(categories)]
    .filter((c) => !isSpecial(c) && knownIndex(c) < 0)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"))
  return [...known, ...extra]
}

/** 扇形圖的順序：章節、各資料夾、其他（只列出有出現的分類） */
export function sectorOrderFor(categories: Iterable<string>): string[] {
  const list = [...categories]
  return [
    ...(list.includes(CHAPTER_CATEGORY) ? [CHAPTER_CATEGORY] : []),
    ...folderCategories(list),
    ...(list.includes(OTHER_CATEGORY) ? [OTHER_CATEGORY] : []),
  ]
}

/** 清單的順序：各資料夾、其他、章節（只列出有出現的分類） */
export function listOrderFor(categories: Iterable<string>): string[] {
  const list = [...categories]
  return [
    ...folderCategories(list),
    ...(list.includes(OTHER_CATEGORY) ? [OTHER_CATEGORY] : []),
    ...(list.includes(CHAPTER_CATEGORY) ? [CHAPTER_CATEGORY] : []),
  ]
}
export interface SectorAngle {
  category: GraphCategory
  startAngle: number
  endAngle: number
  angle: number
}
export interface CategoryGroup<T> {
  category: GraphCategory
  items: T[]
}

export function categorizeGraphSlug(input: string): GraphCategory {
  let slug = input
  try {
    slug = decodeURIComponent(input)
  } catch {
    // Keep the original slug if it contains a malformed escape sequence.
  }

  // link_folder/<資料夾>/<條目>：分類就是資料夾名稱（link_folder/index 本身不算）
  const folder = slug.match(/^link_folder\/([^/]+)\//)?.[1]
  if (folder) return folder
  if (/^\d\d-/.test(slug)) return CHAPTER_CATEGORY
  return OTHER_CATEGORY
}

export function distributeSectorAngles(
  counts: Partial<Record<GraphCategory, number>>,
  startAngle = -Math.PI / 2,
): SectorAngle[] {
  const order = sectorOrderFor(Object.keys(counts))
  const total = order.reduce((sum, category) => sum + Math.max(0, counts[category] ?? 0), 0)
  if (total === 0) return []

  let cursor = startAngle
  return order.flatMap((category) => {
    const count = Math.max(0, counts[category] ?? 0)
    if (count === 0) return []
    const angle = (count / total) * Math.PI * 2
    const sector = { category, startAngle: cursor, endAngle: cursor + angle, angle }
    cursor += angle
    return [sector]
  })
}

export function groupNeighbors<T extends { id: string }>(neighbors: T[]): CategoryGroup<T>[] {
  const byCategory = new Map<GraphCategory, T[]>()
  for (const neighbor of neighbors) {
    const category = categorizeGraphSlug(neighbor.id)
    const items = byCategory.get(category) ?? []
    items.push(neighbor)
    byCategory.set(category, items)
  }
  return listOrderFor(byCategory.keys()).flatMap((category) => {
    const items = byCategory.get(category)
    return items?.length ? [{ category, items }] : []
  })
}

export function getMoreCount(count: number, visibleCount = 4): number {
  return Math.max(0, count - visibleCount)
}
