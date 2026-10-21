export const SECTOR_ORDER = ["章節", "人物", "地點", "歷史", "神學", "原文", "其他"] as const
export const LIST_ORDER = ["人物", "地點", "歷史", "神學", "原文", "其他", "章節"] as const

export type GraphCategory = (typeof SECTOR_ORDER)[number]
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

const LINK_FOLDER_CATEGORY: Record<string, GraphCategory> = {
  人物: "人物",
  地點: "地點",
  歷史: "歷史",
  事件: "歷史",
  神學: "神學",
  原文: "原文",
}

export function categorizeGraphSlug(input: string): GraphCategory {
  let slug = input
  try {
    slug = decodeURIComponent(input)
  } catch {
    // Keep the original slug if it contains a malformed escape sequence.
  }

  const folder = slug.match(/^link_folder\/([^/]+)(?:\/|$)/)?.[1]
  if (folder) return LINK_FOLDER_CATEGORY[folder] ?? "其他"
  if (/^\d\d-/.test(slug)) return "章節"
  return "其他"
}

export function distributeSectorAngles(
  counts: Partial<Record<GraphCategory, number>>,
  startAngle = -Math.PI / 2,
): SectorAngle[] {
  const total = SECTOR_ORDER.reduce((sum, category) => sum + Math.max(0, counts[category] ?? 0), 0)
  if (total === 0) return []

  let cursor = startAngle
  return SECTOR_ORDER.flatMap((category) => {
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
  return LIST_ORDER.flatMap((category) => {
    const items = byCategory.get(category)
    return items?.length ? [{ category, items }] : []
  })
}

export function getMoreCount(count: number, visibleCount = 4): number {
  return Math.max(0, count - visibleCount)
}
