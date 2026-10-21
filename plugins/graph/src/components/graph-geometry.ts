import { distributeSectorAngles } from "./graph-layout"
import type { GraphCategory, SectorAngle } from "./graph-layout"

// Geometry helpers shared by the small fan graph and the expanded modal graph.

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function rectsIntersect(a: Rect, b: Rect, pad = 0): boolean {
  return (
    a.x < b.x + b.width + pad &&
    b.x < a.x + a.width + pad &&
    a.y < b.y + b.height + pad &&
    b.y < a.y + a.height + pad
  )
}

/** Rough text width without a DOM: CJK glyphs are ~1em wide, Latin and digits ~0.58em. */
export function estimateTextWidth(text: string, fontSize: number, bold = false): number {
  let width = 0
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0
    width += code >= 0x2e80 ? fontSize : fontSize * 0.58
  }
  return width * (bold ? 1.06 : 1)
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

// ---------------------------------------------------------------------------
// Sector labels (「類型 數量」) around a ring.
// ---------------------------------------------------------------------------

export interface SectorLabelInput {
  key: string
  /** Mid angle of the sector, in radians. */
  angle: number
  width: number
  height: number
  /** Larger weight is placed first and keeps its ideal position. */
  weight?: number
  /** Scales the ring radius for this label alone (default 1). */
  scale?: number
}

export interface PlacedSectorLabel {
  key: string
  rect: Rect
  /** Centre of the rect where the label would sit with no neighbours. */
  ideal: { x: number; y: number }
  moved: boolean
}

export interface PlaceSectorLabelsOptions {
  cx: number
  cy: number
  /** Ring the labels stand just outside of (ellipse radii; `radius` sets both). */
  radius?: number
  rx?: number
  ry?: number
  /** Clear space between the ring and the nearest label edge. */
  gap?: number
  bounds: { width: number; height: number; margin?: number }
  obstacles?: Rect[]
  /** Minimum clear space between two labels. */
  spacing?: number
}

export interface PlaceSectorLabelsResult {
  labels: PlacedSectorLabel[]
  /** False when some label could not be placed without a collision. */
  fits: boolean
}

/**
 * Places sector labels around a ring so that no two label boxes intersect, none
 * touches an obstacle, and all stay inside the bounds. Each label starts at its
 * sector's mid angle; a colliding label slides along the ring (then outward) to
 * the nearest free spot. When a label has no free spot, `fits` is false and the
 * caller should show a legend row instead.
 */
export function placeSectorLabels(
  labels: SectorLabelInput[],
  options: PlaceSectorLabelsOptions,
): PlaceSectorLabelsResult {
  const rx = options.rx ?? options.radius ?? 0
  const ry = options.ry ?? options.radius ?? 0
  const gap = options.gap ?? 6
  const margin = options.bounds.margin ?? 2
  const spacing = options.spacing ?? 2
  const obstacles = options.obstacles ?? []
  const minX = margin
  const minY = margin
  const maxX = options.bounds.width - margin
  const maxY = options.bounds.height - margin

  const order = labels
    .map((label, index) => ({ label, index }))
    .sort((a, b) => (b.label.weight ?? 0) - (a.label.weight ?? 0) || a.index - b.index)

  const placed: Rect[] = []
  const result: Array<PlacedSectorLabel | undefined> = []
  let fits = true
  const angleStep = Math.PI / 90

  function candidateCenter(label: SectorLabelInput, angle: number, extra: number) {
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const reach =
      gap + extra + Math.abs(cos) * (label.width / 2) + Math.abs(sin) * (label.height / 2)
    const scale = label.scale ?? 1
    return {
      x: options.cx + rx * scale * cos + cos * reach,
      y: options.cy + ry * scale * sin + sin * reach,
    }
  }

  function toRect(label: SectorLabelInput, center: { x: number; y: number }): Rect {
    const halfW = label.width / 2
    const halfH = label.height / 2
    const x = clamp(center.x, minX + halfW, maxX - halfW)
    const y = clamp(center.y, minY + halfH, maxY - halfH)
    return { x: x - halfW, y: y - halfH, width: label.width, height: label.height }
  }

  function free(rect: Rect): boolean {
    if (rect.x < minX - 0.01 || rect.y < minY - 0.01) return false
    if (rect.x + rect.width > maxX + 0.01 || rect.y + rect.height > maxY + 0.01) return false
    for (const other of placed) if (rectsIntersect(rect, other, spacing)) return false
    for (const other of obstacles) if (rectsIntersect(rect, other, 1)) return false
    return true
  }

  for (const { label, index } of order) {
    const idealCenter = candidateCenter(label, label.angle, 0)
    const idealRect = toRect(label, idealCenter)
    let best: Rect | undefined
    let bestCost = Infinity
    for (let ring = 0; ring < 4 && !best; ring++) {
      const extra = ring * (label.height + 2)
      for (let step = 0; step <= 90; step++) {
        const signs = step === 0 ? [0] : [1, -1]
        for (const sign of signs) {
          const rect = toRect(
            label,
            candidateCenter(label, label.angle + sign * step * angleStep, extra),
          )
          if (!free(rect)) continue
          const cost = Math.hypot(
            rect.x + rect.width / 2 - idealCenter.x,
            rect.y + rect.height / 2 - idealCenter.y,
          )
          if (cost < bestCost) {
            bestCost = cost
            best = rect
          }
        }
        // A larger step cannot beat a hit that is already closer than the arc travelled.
        if (best && bestCost <= step * angleStep * Math.min(rx, ry) * 0.5) break
      }
    }
    if (!best) {
      fits = false
      best = idealRect
    }
    placed.push(best)
    result[index] = {
      key: label.key,
      rect: best,
      ideal: { x: idealRect.x + idealRect.width / 2, y: idealRect.y + idealRect.height / 2 },
      moved: Math.hypot(best.x - idealRect.x, best.y - idealRect.y) > 0.5,
    }
  }

  return { labels: result.filter((item): item is PlacedSectorLabel => !!item), fits }
}

// ---------------------------------------------------------------------------
// Expanded (modal) graph: category fan layout with label-aware relaxation.
// ---------------------------------------------------------------------------

export interface FanLayoutNode {
  id: string
  category: GraphCategory
  /** Radius of the node's marker. */
  r: number
  /** Width of the node's name label. */
  labelWidth: number
}

export interface FanLayoutOptions {
  width: number
  height: number
  labelHeight: number
  /** Fixed boxes the nodes must stay out of (centre node, cluster labels, ...). */
  obstacles?: Rect[]
  margin?: number
  iterations?: number
}

export interface FanLayoutResult {
  positions: Map<string, { x: number; y: number }>
  sectors: SectorAngle[]
  /** Ellipse radii the outermost ring was aimed at. */
  radii: { rx: number; ry: number }
}

/**
 * Computes node positions for the expanded graph. Each category owns the same
 * angular sector as in the small fan; nodes start on staggered rings inside it,
 * and a fixed number of deterministic relaxation passes (no animation, nothing
 * left running) separates the node+label boxes while a soft pull keeps every
 * node near its own sector. The current page is expected at the centre
 * (pass it as an obstacle).
 */
export function layoutCategoryFan(nodes: FanLayoutNode[], options: FanLayoutOptions): FanLayoutResult {
  const margin = options.margin ?? 6
  const iterations = options.iterations ?? 260
  const cx = options.width / 2
  const cy = options.height / 2
  const obstacles = options.obstacles ?? []

  const counts: Partial<Record<GraphCategory, number>> = {}
  const byCategory = new Map<GraphCategory, FanLayoutNode[]>()
  for (const node of nodes) {
    counts[node.category] = (counts[node.category] ?? 0) + 1
    const list = byCategory.get(node.category) ?? []
    list.push(node)
    byCategory.set(node.category, list)
  }
  const sectors = distributeSectorAngles(counts)

  interface Body {
    node: FanLayoutNode
    x: number
    y: number
    tx: number
    ty: number
    halfW: number
    halfH: number
    /** Offset from the marker centre to the centre of the node+label box. */
    oy: number
  }
  const bodies: Body[] = []
  const rxT = Math.max(40, options.width / 2 - margin - 40)
  const ryT = Math.max(40, options.height / 2 - margin - 26)
  for (const sector of sectors) {
    const list = byCategory.get(sector.category) ?? []
    const rings = list.length < 3 ? 1 : list.length < 5 ? 2 : list.length < 12 ? 3 : 4
    list.forEach((node, index) => {
      const angle = sector.startAngle + sector.angle * ((index + 0.5) / list.length)
      const factor = rings === 1 ? 0.78 : 0.56 + (0.36 * (index % rings)) / (rings - 1)
      const tx = cx + rxT * factor * Math.cos(angle)
      const ty = cy + ryT * factor * Math.sin(angle)
      const boxW = Math.max(node.r * 2, node.labelWidth * 0.85)
      const boxH = node.r * 2 + 2 + options.labelHeight
      bodies.push({
        node,
        x: tx,
        y: ty,
        tx,
        ty,
        halfW: boxW / 2 + 1,
        halfH: boxH / 2 + 1,
        oy: boxH / 2 - node.r,
      })
    })
  }

  for (let iter = 0; iter < iterations; iter++) {
    const pull = 0.1 - 0.07 * (iter / iterations)
    for (const body of bodies) {
      body.x += (body.tx - body.x) * pull
      body.y += (body.ty - body.y) * pull
    }
    for (let i = 0; i < bodies.length; i++) {
      const a = bodies[i]!
      for (let j = i + 1; j < bodies.length; j++) {
        const b = bodies[j]!
        let dx = b.x - a.x
        let dy = b.y + b.oy - (a.y + a.oy)
        const ox = a.halfW + b.halfW - Math.abs(dx)
        const oy = a.halfH + b.halfH - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        if (dx === 0 && dy === 0) {
          dx = i % 2 ? 0.01 : -0.01
          dy = j % 2 ? 0.01 : -0.01
        }
        if (ox < oy) {
          const push = (ox / 2) * Math.sign(dx || 1)
          a.x -= push
          b.x += push
        } else {
          const push = (oy / 2) * Math.sign(dy || 1)
          a.y -= push
          b.y += push
        }
      }
      for (const wall of obstacles) {
        const dx = a.x - (wall.x + wall.width / 2)
        const dy = a.y + a.oy - (wall.y + wall.height / 2)
        const ox = a.halfW + wall.width / 2 - Math.abs(dx)
        const oy = a.halfH + wall.height / 2 - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        if (ox < oy) a.x += ox * Math.sign(dx || 1)
        else a.y += oy * Math.sign(dy || 1)
      }
    }
    for (const body of bodies) {
      body.x = clamp(body.x, margin + body.halfW, options.width - margin - body.halfW)
      body.y = clamp(
        body.y,
        margin + body.node.r + 1,
        options.height - margin - (body.halfH * 2 - body.node.r - 1),
      )
    }
  }

  const positions = new Map<string, { x: number; y: number }>()
  for (const body of bodies) positions.set(body.node.id, { x: body.x, y: body.y })
  return { positions, sectors, radii: { rx: rxT, ry: ryT } }
}

// ---------------------------------------------------------------------------
// Node name labels: greedy collision-free side assignment.
// ---------------------------------------------------------------------------

export type LabelSide = "below" | "above" | "right" | "left"

export interface NodeLabelItem {
  id: string
  /** Marker centre and radius, in the same coordinate space as the bounds. */
  x: number
  y: number
  r: number
  width: number
  height: number
  /** Sides to try, best first. */
  sides: LabelSide[]
  /** Always shown (current page, hovered node); falls back to a colliding spot. */
  force?: boolean
}

export interface NodeLabelPlacement {
  side: LabelSide
  rect: Rect
}

export function labelRectForSide(item: NodeLabelItem, side: LabelSide): Rect {
  const { x, y, r, width, height } = item
  if (side === "above") return { x: x - width / 2, y: y - r - 2 - height, width, height }
  if (side === "right") return { x: x + r + 3, y: y - height / 2, width, height }
  if (side === "left") return { x: x - r - 3 - width, y: y - height / 2, width, height }
  return { x: x - width / 2, y: y + r + 2, width, height }
}

/**
 * Greedy, collision-free assignment of node name labels. Items are handled in
 * the given order (earlier = higher priority). A label takes the first side that
 * stays inside the bounds and touches neither another label, a node marker nor
 * an obstacle; a label with no such side is omitted (it appears on hover).
 * Forced items slide into the bounds and fall back to their first side.
 */
export function placeNodeLabels(
  items: NodeLabelItem[],
  options: { width: number; height: number; margin?: number; obstacles?: Rect[] },
): Map<string, NodeLabelPlacement> {
  const margin = options.margin ?? 2
  const result = new Map<string, NodeLabelPlacement>()
  const labelRects: Rect[] = []
  const markers = new Map<string, Rect>()
  const visible = items.filter(
    (item) => item.x >= 0 && item.x <= options.width && item.y >= 0 && item.y <= options.height,
  )
  for (const item of visible) {
    markers.set(item.id, { x: item.x - item.r, y: item.y - item.r, width: item.r * 2, height: item.r * 2 })
  }
  const obstacles = options.obstacles ?? []

  function inside(rect: Rect): boolean {
    return (
      rect.x >= margin &&
      rect.y >= margin &&
      rect.x + rect.width <= options.width - margin &&
      rect.y + rect.height <= options.height - margin
    )
  }

  function slideInside(rect: Rect): Rect {
    return {
      ...rect,
      x: clamp(rect.x, margin, options.width - margin - rect.width),
      y: clamp(rect.y, margin, options.height - margin - rect.height),
    }
  }

  function clear(rect: Rect, id: string): boolean {
    for (const other of labelRects) if (rectsIntersect(rect, other, 2)) return false
    for (const [otherId, marker] of markers) {
      if (otherId !== id && rectsIntersect(rect, marker, 1)) return false
    }
    for (const other of obstacles) if (rectsIntersect(rect, other, 1)) return false
    return true
  }

  for (const item of visible) {
    let chosen: NodeLabelPlacement | undefined
    for (const side of item.sides) {
      let rect = labelRectForSide(item, side)
      if (item.force || side === "below" || side === "above") {
        // Horizontal sliding keeps centred labels near the edge; forced ones may also slide vertically.
        rect = item.force ? slideInside(rect) : { ...rect, x: clamp(rect.x, margin, options.width - margin - rect.width) }
      }
      if (!item.force && !inside(rect)) continue
      if (clear(rect, item.id)) {
        chosen = { side, rect }
        break
      }
    }
    if (!chosen && item.force) {
      const side = item.sides[0] ?? "below"
      chosen = { side, rect: slideInside(labelRectForSide(item, side)) }
    }
    if (chosen) {
      result.set(item.id, chosen)
      labelRects.push(chosen.rect)
    }
  }
  return result
}
