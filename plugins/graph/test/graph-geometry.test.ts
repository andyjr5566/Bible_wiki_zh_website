import { describe, expect, it } from "vitest"
import {
  estimateTextWidth,
  layoutCategoryFan,
  placeNodeLabels,
  placeSectorLabels,
  rectsIntersect,
} from "../src/components/graph-geometry"
import type { Rect, SectorLabelInput } from "../src/components/graph-geometry"
import { SECTOR_ORDER, distributeSectorAngles } from "../src/components/graph-layout"
import type { GraphCategory } from "../src/components/graph-layout"

function labelsFor(counts: Partial<Record<GraphCategory, number>>): SectorLabelInput[] {
  return distributeSectorAngles(counts).map((sector) => {
    const text = `${sector.category} ${counts[sector.category]}`
    return {
      key: sector.category,
      angle: sector.startAngle + sector.angle / 2,
      width: estimateTextWidth(text, 12, true),
      height: 15,
      weight: counts[sector.category],
    }
  })
}

function expectNoOverlap(rects: Rect[]) {
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      expect(rectsIntersect(rects[i]!, rects[j]!)).toBe(false)
    }
  }
}

function expectInside(rects: Rect[], width: number, height: number) {
  for (const rect of rects) {
    expect(rect.x).toBeGreaterThanOrEqual(0)
    expect(rect.y).toBeGreaterThanOrEqual(0)
    expect(rect.x + rect.width).toBeLessThanOrEqual(width)
    expect(rect.y + rect.height).toBeLessThanOrEqual(height)
  }
}

describe("placeSectorLabels", () => {
  const box = { width: 300, height: 250 }
  const ring = { cx: 150, cy: 125, radius: Math.min(box.width, box.height) / 2 - 27 }

  it("keeps tight neighbouring sectors apart (user screenshot case)", () => {
    const counts = { 原文: 1, 神學: 2, 地點: 1, 歷史: 1, 章節: 40 }
    const result = placeSectorLabels(labelsFor(counts), { ...ring, bounds: box })
    expect(result.fits).toBe(true)
    expect(result.labels).toHaveLength(5)
    const rects = result.labels.map((label) => label.rect)
    expectNoOverlap(rects)
    expectInside(rects, box.width, box.height)
  })

  it("never overlaps for any mix of counts, in narrow and wide boxes", () => {
    const sizes = [
      { width: 300, height: 250 },
      { width: 350, height: 250 },
      { width: 250, height: 250 },
    ]
    let seed = 7
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (const size of sizes) {
      const r = Math.min(size.width, size.height) / 2 - 27
      for (let trial = 0; trial < 60; trial++) {
        const counts: Partial<Record<GraphCategory, number>> = {}
        for (const category of SECTOR_ORDER) {
          if (rand() < 0.75) counts[category] = 1 + Math.floor(rand() * rand() * 30)
        }
        const labels = labelsFor(counts)
        if (labels.length === 0) continue
        const result = placeSectorLabels(labels, { cx: size.width / 2, cy: size.height / 2, radius: r, bounds: size })
        expect(result.fits).toBe(true)
        const rects = result.labels.map((label) => label.rect)
        expectNoOverlap(rects)
        expectInside(rects, size.width, size.height)
      }
    }
  })

  it("respects obstacles such as the expand button", () => {
    const icon = { x: 270, y: 0, width: 30, height: 30 }
    const result = placeSectorLabels(labelsFor({ 人物: 3, 地點: 3 }), {
      ...ring,
      bounds: box,
      obstacles: [icon],
    })
    for (const label of result.labels) expect(rectsIntersect(label.rect, icon)).toBe(false)
  })

  it("reports fits=false when the labels cannot fit at all", () => {
    const tiny = { width: 60, height: 40 }
    const result = placeSectorLabels(labelsFor({ 人物: 1, 地點: 1, 歷史: 1, 神學: 1 }), {
      cx: 30,
      cy: 20,
      radius: 10,
      bounds: tiny,
    })
    expect(result.fits).toBe(false)
  })
})

describe("layoutCategoryFan", () => {
  const categories: GraphCategory[] = ["章節", "人物", "地點", "歷史", "神學", "原文", "其他"]
  const nodes = Array.from({ length: 36 }, (_, index) => ({
    id: `n${index}`,
    category: categories[index % 7 < 3 ? index % 7 : (index % 4) + 3]!,
    r: 7,
    labelWidth: 70 + (index % 5) * 14,
  }))
  const size = { width: 1100, height: 540 }
  const center: Rect = { x: size.width / 2 - 60, y: size.height / 2 - 24, width: 120, height: 48 }

  it("keeps nodes inside the area and out of the centre box", () => {
    const { positions } = layoutCategoryFan(nodes, { ...size, labelHeight: 14, obstacles: [center] })
    expect(positions.size).toBe(nodes.length)
    for (const { x, y } of positions.values()) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(size.width)
      expect(y).toBeGreaterThan(0)
      expect(y).toBeLessThan(size.height)
      expect(rectsIntersect({ x: x - 7, y: y - 7, width: 14, height: 14 }, center)).toBe(false)
    }
  })

  it("is deterministic and keeps each category's centroid inside its sector", () => {
    const first = layoutCategoryFan(nodes, { ...size, labelHeight: 14, obstacles: [center] })
    const second = layoutCategoryFan(nodes, { ...size, labelHeight: 14, obstacles: [center] })
    expect([...second.positions.entries()]).toEqual([...first.positions.entries()])
    for (const sector of first.sectors) {
      const members = nodes.filter((node) => node.category === sector.category)
      let sx = 0
      let sy = 0
      for (const node of members) {
        const p = first.positions.get(node.id)!
        sx += p.x - size.width / 2
        sy += (p.y - size.height / 2) * (size.width / size.height)
      }
      let angle = Math.atan2(sy, sx)
      const mid = sector.startAngle + sector.angle / 2
      while (angle - mid > Math.PI) angle -= Math.PI * 2
      while (angle - mid < -Math.PI) angle += Math.PI * 2
      expect(Math.abs(angle - mid)).toBeLessThan(sector.angle / 2 + 0.35)
    }
  })
})

describe("placeNodeLabels", () => {
  it("never produces overlapping visible labels, hiding the ones that cannot fit", () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      id: `n${index}`,
      x: 40 + (index % 8) * 30,
      y: 40 + Math.floor(index / 8) * 24,
      r: 5,
      width: 80,
      height: 14,
      sides: ["below", "right", "left", "above"] as const,
    }))
    const placed = placeNodeLabels(
      items.map((item) => ({ ...item, sides: [...item.sides] })),
      { width: 320, height: 200 },
    )
    expect(placed.size).toBeLessThan(items.length)
    expectNoOverlap([...placed.values()].map((entry) => entry.rect))
  })

  it("always shows forced labels", () => {
    const placed = placeNodeLabels(
      [
        { id: "a", x: 100, y: 100, r: 6, width: 60, height: 14, sides: ["below"] },
        { id: "b", x: 100, y: 110, r: 6, width: 60, height: 14, sides: ["below"], force: true },
      ],
      { width: 300, height: 200 },
    )
    expect(placed.has("b")).toBe(true)
  })
})
