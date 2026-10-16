import type { WallData, WallItem } from '../data/types';

/**
 * 城牆（尼 3）：不碰 DOM 的純函式。
 * 一圈示意的牆：位置分配（每一段等長、門樓夾在段與段之間）、名牌與門名的排開、讀到哪寫到哪、墨筆畫牆的路徑。
 * wall.ts 負責畫面，這裡的每個規則都有 wall.test.ts 保護。
 */

export interface Pt { x: number; y: number }
export interface Box { x: number; y: number; w: number; h: number }

const TAU = Math.PI * 2;

// ── 一圈的形狀 ───────────────────────────────────────

export interface RingShape { cx: number; cy: number; rx: number; ry: number }

/** 手繪的不規則：半徑隨角度略有起伏（首尾相接） */
export function wobble(t: number): number {
  const a = t * TAU;
  return 1 + 0.028 * Math.sin(3 * a + 0.7) + 0.017 * Math.sin(5 * a + 2.1) + 0.012 * Math.sin(2 * a + 4.0);
}

/**
 * 圈上 t（0–1）的位置：t=0 在正上方（羊門），逆時針繞一圈——北、西、南、東，回到北。
 * 螢幕座標 y 向下，所以 t 增加時先往左走。
 */
export function ringPoint(shape: RingShape, t: number): Pt {
  const a = t * TAU;
  const w = wobble(t);
  return { x: shape.cx - shape.rx * w * Math.sin(a), y: shape.cy - shape.ry * w * Math.cos(a) };
}

/** 圈上 t 的切線（朝 t 增加的方向）與朝外的法線，都是單位向量 */
export function ringFrame(shape: RingShape, t: number): { tan: Pt; normal: Pt } {
  const eps = 1e-4;
  const p0 = ringPoint(shape, t - eps);
  const p1 = ringPoint(shape, t + eps);
  const length = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
  const tan = { x: (p1.x - p0.x) / length, y: (p1.y - p0.y) / length };
  let normal = { x: tan.y, y: -tan.x };
  const p = ringPoint(shape, t);
  if (normal.x * (p.x - shape.cx) + normal.y * (p.y - shape.cy) < 0) normal = { x: -normal.x, y: -normal.y };
  return { tan, normal };
}

export function sampleRing(shape: RingShape, count: number): Pt[] {
  return Array.from({ length: count }, (_, i) => ringPoint(shape, i / count));
}

export function ringLength(shape: RingShape, count = 240): number {
  let sum = 0;
  let previous = ringPoint(shape, 0);
  for (let i = 1; i <= count; i += 1) {
    const p = ringPoint(shape, i / count);
    sum += Math.hypot(p.x - previous.x, p.y - previous.y);
    previous = p;
  }
  return sum;
}

// ── 位置分配 ─────────────────────────────────────────

export interface Slot {
  index: number;
  kind: WallItem['kind'];
  /** 這一項在圈上占的範圍（0–1）；門、樓、地方是一小格，tc 是它的中心 */
  t0: number;
  t1: number;
  tc: number;
}

/**
 * 照經文次序把每一項放到圈上。第一項（羊門）在 t=0，最後一項若是繞回起點（back）就在 t=1（同一個點）。
 * 每一段（part）等長；門、樓、地方各占 gap 寬的一小格，連續兩個點不會疊在一起。
 */
export function allocateRing(ring: ReadonlyArray<Pick<WallItem, 'kind' | 'back'>>, gap: number): Slot[] {
  const slots: Slot[] = [];
  const n = ring.length;
  if (!n) return slots;
  const startIsPoint = ring[0]!.kind !== 'part';
  const endIsBack = Boolean(ring[n - 1]!.back) && ring[n - 1]!.kind !== 'part' && n > 1;
  const first = startIsPoint ? 1 : 0;
  const last = endIsBack ? n - 2 : n - 1;
  let parts = 0;
  let points = 0;
  for (let i = first; i <= last; i += 1) {
    if (ring[i]!.kind === 'part') parts += 1; else points += 1;
  }
  const available = 1 - (startIsPoint ? gap / 2 : 0) - (endIsBack ? gap / 2 : 0);
  const arc = parts > 0 ? Math.max(0.0005, (available - points * gap) / parts) : 0;
  const put = (index: number, t0: number, width: number) => {
    slots[index] = { index, kind: ring[index]!.kind, t0, t1: t0 + width, tc: t0 + width / 2 };
  };
  if (startIsPoint) put(0, -gap / 2, gap);
  let cursor = startIsPoint ? gap / 2 : 0;
  for (let i = first; i <= last; i += 1) {
    const width = ring[i]!.kind === 'part' ? arc : gap;
    put(i, cursor, width);
    cursor += width;
  }
  if (endIsBack) put(n - 1, 1 - gap / 2, gap);
  return slots;
}

// ── 讀到哪寫到哪 ─────────────────────────────────────

/** 每一項所在那一節在 data.verses 裡的位置（找不到 -1） */
export function wallIndexes(data: Pick<WallData, 'ring' | 'verses'>): number[] {
  return data.ring.map((item) => data.verses.indexOf(item.at));
}

/** 這一項在那一節經文裡開始被讀到的字位置：段是第一個名字，門樓是它的名字 */
export function itemStart(item: WallItem): number {
  if (item.kind === 'part') return item.names?.[0]?.s ?? 0;
  return item.s ?? 0;
}

export function reachedAt(cur: number, idx: number, chars: number, at: number): boolean {
  if (cur < 0 || idx < 0) return false;
  return idx < cur || (idx === cur && chars >= at);
}

export interface WallState {
  reached: boolean[];
  /** 段：牆砌到幾成（0–1）；門、樓、地方：讀到了是 1 */
  progress: number[];
  /** 最新讀到的一項（照讀到的先後，不是圈上的次序）；還沒讀到任何東西 -1 */
  nowItem: number;
  /** 最新讀到的一段 */
  nowPart: number;
}

/**
 * cur＝目前這一節在 data.verses 的位置（不在 -1），chars＝這一節讀到第幾個字。
 * 段的進度＝這一節讀到的字，從這一段第一個名字的位置到節尾。
 */
export function wallState(
  data: Pick<WallData, 'ring'>,
  idx: number[],
  cur: number,
  chars: number,
  verseLength: (index: number) => number,
): WallState {
  const n = data.ring.length;
  const reached: boolean[] = new Array<boolean>(n).fill(false);
  const progress: number[] = new Array<number>(n).fill(0);
  let nowItem = -1;
  let nowPart = -1;
  let bestItem: [number, number] = [-1, -1];
  let bestPart = -1;
  data.ring.forEach((item, i) => {
    const at = idx[i] ?? -1;
    const start = itemStart(item);
    const done = reachedAt(cur, at, chars, start);
    reached[i] = done;
    if (!done) return;
    if (item.kind === 'part') {
      if (at < cur) progress[i] = 1;
      else {
        const length = Math.max(1, verseLength(at) - start);
        progress[i] = Math.max(0, Math.min(1, (chars - start) / length));
      }
      if (at >= bestPart) { bestPart = at; nowPart = i; }
    } else {
      progress[i] = 1;
    }
    if (at > bestItem[0] || (at === bestItem[0] && start >= bestItem[1])) { bestItem = [at, start]; nowItem = i; }
  });
  return { reached, progress, nowItem, nowPart };
}

/** 一段文字出現了幾個字：前面的節整段、後面的節一個都沒有、這一節看每個字的門檻 */
export function shownCount(thresholds: readonly number[], cur: number, idx: number, chars: number): number {
  if (cur < 0 || idx < 0 || !thresholds.length) return 0;
  if (idx < cur) return thresholds.length;
  if (idx > cur) return 0;
  let count = 0;
  for (const at of thresholds) {
    if (chars >= at) count += 1; else break;
  }
  return count;
}

// ── 名牌上的字 ───────────────────────────────────────

export interface TagChar {
  ch: string;
  /** 讀到這一節的第幾個字，這個字才出現 */
  at: number;
  /** 屬於第幾個名字（「、」算前一個名字的） */
  name: number;
}

/**
 * 名字之間用「、」，排成幾行（每行最多 maxChars 個字，名字不拆開）。
 * 「、」跟著下一個名字一起出現。
 */
export function tagLines(names: ReadonlyArray<{ t: string; s: number }>, maxChars: number): TagChar[][] {
  const lines: TagChar[][] = [];
  let line: TagChar[] = [];
  names.forEach((name, i) => {
    const chars = Array.from(name.t);
    const unit: TagChar[] = chars.map((ch, j) => ({ ch, at: name.s + j, name: i }));
    if (i < names.length - 1) unit.push({ ch: '、', at: names[i + 1]!.s, name: i });
    if (line.length && line.length + unit.length > maxChars) { lines.push(line); line = []; }
    line.push(...unit);
  });
  if (line.length) lines.push(line);
  return lines;
}

/** 名牌的字依讀到的先後攤平成一串門檻（單調不減） */
export function tagThresholds(lines: readonly TagChar[][]): number[] {
  const out: number[] = [];
  let top = -1;
  for (const line of lines) for (const c of line) { top = Math.max(top, c.at); out.push(top); }
  return out;
}

// ── 幾何小工具 ───────────────────────────────────────

export function boxesOverlap(a: Box, b: Box, gap = 0): boolean {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

export function pointInBox(p: Pt, b: Box, pad = 0): boolean {
  return p.x > b.x - pad && p.x < b.x + b.w + pad && p.y > b.y - pad && p.y < b.y + b.h + pad;
}

export function nearestOnBox(p: Pt, b: Box): Pt {
  return { x: Math.max(b.x, Math.min(b.x + b.w, p.x)), y: Math.max(b.y, Math.min(b.y + b.h, p.y)) };
}

/** 線段 p→q 穿過方框（框先向外加 pad） */
export function segmentHitsBox(p: Pt, q: Pt, b: Box, pad = 0): boolean {
  const x0 = b.x - pad;
  const y0 = b.y - pad;
  const x1 = b.x + b.w + pad;
  const y1 = b.y + b.h + pad;
  let t0 = 0;
  let t1 = 1;
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const clip = (d: number, dist: number): boolean => {
    if (d === 0) return dist >= 0;
    const r = dist / d;
    if (d < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    return true;
  };
  return clip(-dx, p.x - x0) && clip(dx, x1 - p.x) && clip(-dy, p.y - y0) && clip(dy, y1 - p.y);
}

export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// ── 名牌與門名的排開 ─────────────────────────────────

export interface LabelReq {
  id: string;
  w: number;
  h: number;
  /** 掛在圈上的位置（0–1） */
  t: number;
  /** 要不要拉一條細線到圈上 */
  leader: boolean;
  /** 離牆邊最近多遠開始找位置 */
  near: number;
  /** 離掛點最遠多遠（門名離自己的門不能太遠，否則讀者對不上） */
  reach?: number;
  /** 另外的候選：方框中心可以放的地方，依偏好排序（手機把名牌放圈中央） */
  centers?: Pt[];
}

export interface Placed {
  id: string;
  box: Box;
  /** 細線在牆上的那一端 */
  from: Pt;
  /** 細線在名牌上的那一端 */
  to: Pt | null;
  inside: boolean;
  /** 細線接名牌的位置（方框內的座標）：縮放以此為中心 */
  origin: Pt;
}

export interface PlaceOptions {
  board: { w: number; h: number };
  /** 離畫面邊緣至少多少 */
  pad: number;
  /** 兩個方框之間至少隔多少 */
  gap: number;
  /** 離牆（含門樓符號）至少多少 */
  clear: number;
  /** 牆的厚度 */
  thickness: number;
  obstacles: Box[];
  /** 放在圈裡面要多付的成本：桌機很高（圈裡只當最後手段） */
  insideCost?: number;
}

/**
 * 依序為每個方框找位置：把畫面切成格子，每個格子都是一個候選，離牆上掛點越近越好（圈外優先，圈裡次之）。
 * 方框彼此不重疊、不壓到牆、細線不穿過別的方框、不穿過牆、也不互相交叉；放不下的回 null（只讓那一個縮成小點）。
 */
export function placeLabels(shape: RingShape, reqs: readonly LabelReq[], opts: PlaceOptions): Map<string, Placed | null> {
  // 先照原次序放；放不下的、放進圈裡的，排到最前面再放一次（最多幾輪），取最好的一輪
  const preferOutside = (opts.insideCost ?? 0) >= 100;
  const bad = (p: Placed | null | undefined) => p === null || p === undefined || (preferOutside && p.inside);
  const score = (m: Map<string, Placed | null>) => [...m.values()].reduce((sum, p) => sum + (p === null ? 1000 : p.inside && preferOutside ? 1 : 0), 0);
  const cache = new Map<string, Cand[]>();
  let order = [...reqs];
  let best = placeOnce(shape, order, opts, cache);
  let bestScore = score(best);
  let current = best;
  for (let round = 0; round < 6 && bestScore > 0; round += 1) {
    const front = order.filter((r) => bad(current.get(r.id)));
    order = [...front, ...order.filter((r) => !front.includes(r))];
    current = placeOnce(shape, order, opts, cache);
    const value = score(current);
    if (value < bestScore) { best = current; bestScore = value; }
  }
  return best;
}

/** 圈上的點放進格子裡：查「方框附近有沒有牆」不用每次掃整圈 */
function pointGrid(points: Pt[], size: number) {
  const cells = new Map<number, Pt[]>();
  const key = (ix: number, iy: number) => ix * 4096 + iy;
  for (const p of points) {
    const k = key(Math.floor(p.x / size), Math.floor(p.y / size));
    const list = cells.get(k);
    if (list) list.push(p); else cells.set(k, [p]);
  }
  return {
    anyInBox(box: Box, pad: number): boolean {
      const x0 = Math.floor((box.x - pad) / size);
      const x1 = Math.floor((box.x + box.w + pad) / size);
      const y0 = Math.floor((box.y - pad) / size);
      const y1 = Math.floor((box.y + box.h + pad) / size);
      for (let ix = x0; ix <= x1; ix += 1) {
        for (let iy = y0; iy <= y1; iy += 1) {
          const list = cells.get(key(ix, iy));
          if (list?.some((p) => pointInBox(p, box, pad))) return true;
        }
      }
      return false;
    },
    anyNear(p: Pt, dist: number): boolean {
      const ix = Math.floor(p.x / size);
      const iy = Math.floor(p.y / size);
      const r = Math.ceil(dist / size);
      for (let dx = -r; dx <= r; dx += 1) {
        for (let dy = -r; dy <= r; dy += 1) {
          const list = cells.get(key(ix + dx, iy + dy));
          if (list?.some((q) => Math.hypot(q.x - p.x, q.y - p.y) < dist)) return true;
        }
      }
      return false;
    },
  };
}

type Cand = { box: Box; cost: number; inside: boolean; from: Pt };

/** 一個名牌所有可能的位置（由好到壞），只和圈的形狀、名牌大小有關，各輪重排共用 */
function genCandidates(shape: RingShape, req: LabelReq, opts: PlaceOptions): Cand[] {
  const half = opts.thickness / 2;
  const cell = 9;
    const point = ringPoint(shape, req.t);
    const { normal } = ringFrame(shape, req.t);
    const candidates: Cand[] = [];
    const fromOut = { x: point.x + normal.x * (half + 1), y: point.y + normal.y * (half + 1) };
    const fromIn = { x: point.x - normal.x * (half + 1), y: point.y - normal.y * (half + 1) };
    (req.centers ?? []).forEach((center, i) => {
      const inBoard = center.x - req.w / 2 >= opts.pad && center.x + req.w / 2 <= opts.board.w - opts.pad && center.y - req.h / 2 >= opts.pad && center.y + req.h / 2 <= opts.board.h - opts.pad;
      if (!inBoard) return;
      candidates.push({ box: { x: center.x - req.w / 2, y: center.y - req.h / 2, w: req.w, h: req.h }, cost: 2 + i * 0.6, inside: true, from: fromIn });
    });
    const maxReach = req.reach ?? 230;
    const x0 = Math.max(opts.pad, point.x - maxReach - req.w);
    const x1 = Math.min(opts.board.w - opts.pad - req.w, point.x + maxReach);
    const y0 = Math.max(opts.pad, point.y - maxReach - req.h);
    const y1 = Math.min(opts.board.h - opts.pad - req.h, point.y + maxReach);
    for (let y = y0; y <= y1; y += cell) {
      for (let x = x0; x <= x1; x += cell) {
        const box = { x, y, w: req.w, h: req.h };
        const centre = { x: x + req.w / 2, y: y + req.h / 2 };
        const out = (centre.x - point.x) * normal.x + (centre.y - point.y) * normal.y >= 0;
        const from = out ? fromOut : fromIn;
        const near = nearestOnBox(from, box);
        const length = Math.hypot(near.x - from.x, near.y - from.y);
        if (length < req.near - 6) continue;
        // 圈外偏好：圈裡要多付一點；偏離掛點的橫向距離也算成本
        candidates.push({ box, cost: length + (out ? 0 : opts.insideCost ?? 38) + Math.abs((centre.x - point.x) * -normal.y + (centre.y - point.y) * normal.x) * 0.18, inside: !out, from });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost);
    return candidates;
}

function placeOnce(shape: RingShape, reqs: readonly LabelReq[], opts: PlaceOptions, cache: Map<string, Cand[]>): Map<string, Placed | null> {
  const result = new Map<string, Placed | null>();
  const grid = pointGrid(sampleRing(shape, 360), 24);
  const placed: Placed[] = [];
  const half = opts.thickness / 2;
  const farEnough = (p: Pt) => !grid.anyNear(p, half + 2.5);
  for (const req of reqs) {
    let candidates = cache.get(req.id);
    if (!candidates) { candidates = genCandidates(shape, req, opts); cache.set(req.id, candidates); }
    let chosen: Placed | null = null;
    // 先守全部的規矩；放不下才放寬細線的限制（細線可以穿過淡淡的門名，但方框一律不重疊）
    // 圈外優先（桌機）：圈外三個層級都放不下，才輪到圈裡
    const passes = (opts.insideCost ?? 0) >= 100 ? [false, true] : [true];
    // 方框本身放得下的候選（和層級無關，只算一次）
    const viable: typeof candidates = [];
    for (const cand of candidates) {
      const { box } = cand;
      if (viable.length >= 700) break;
      if (opts.obstacles.some((o) => boxesOverlap(box, o, 2))) continue;
      if (placed.some((p) => boxesOverlap(box, p.box, opts.gap))) continue;
      if (grid.anyInBox(box, opts.clear)) continue;
      viable.push(cand);
    }
    for (let step = 0; step < passes.length * 3 && !chosen; step += 1) {
      const level = step % 3;
      const withInside = passes[Math.floor(step / 3)]!;
      for (const cand of viable) {
        if (cand.inside && !withInside) continue;
        const { box } = cand;
        let to: Pt | null = null;
        if (req.leader) {
          to = nearestOnBox(cand.from, box);
          if (placed.some((p) => segmentHitsBox(cand.from, to!, p.box, 2))) continue;
          if (level < 1 && opts.obstacles.some((o) => segmentHitsBox(cand.from, to!, o, 2))) continue;
          if (level < 2 && placed.some((p) => p.to && (segmentHitsBox(p.from, p.to, box, 2) || segmentsCross(cand.from, to!, p.from, p.to)))) continue;
          // 細線不穿過牆（起點附近除外）
          const length = Math.hypot(to.x - cand.from.x, to.y - cand.from.y);
          let crosses = false;
          for (let k = 1; k <= 10 && !crosses; k += 1) {
            const f = k / 10;
            if (f * length < half + 8) continue;
            if (!farEnough({ x: cand.from.x + (to.x - cand.from.x) * f, y: cand.from.y + (to.y - cand.from.y) * f })) crosses = true;
          }
          if (crosses && level < 2) continue;
        } else if (level < 2 && placed.some((p) => p.to && segmentHitsBox(p.from, p.to, box, 2))) continue;
        const anchorEdge = to ?? nearestOnBox(cand.from, box);
        chosen = { id: req.id, box, from: cand.from, to, inside: cand.inside, origin: { x: anchorEdge.x - box.x, y: anchorEdge.y - box.y } };
        break;
      }
    }
    result.set(req.id, chosen);
    if (chosen) placed.push(chosen);
  }
  return result;
}

// ── 整張圖的排版 ─────────────────────────────────────

export interface LayoutInput {
  data: Pick<WallData, 'ring'>;
  board: { w: number; h: number };
  /** 小畫面（手機）：名牌不全部攤開，只放要看的幾個 */
  compact: boolean;
  /** 門、樓、地方的名字大小（依 ring 次序） */
  landmarkSize: ReadonlyMap<number, { w: number; h: number }>;
  /** 每一段名牌的大小 */
  tagSize: ReadonlyMap<number, { w: number; h: number }>;
  /** 門樓符號的邊長 */
  unit: number;
  thickness: number;
  obstacles: Box[];
  /** compact：要放的名牌（依優先順序，第一個是目前這一段） */
  wantTags?: number[];
  /** 圈的縮放固定（手機換名牌時圈不能跟著跳） */
  fixedScale?: number;
  /** 最後手段：名牌可以壓在淡淡的門名上（名牌特別大、圈裡實在沒有空位時） */
  tagOverLandmarks?: boolean;
}

export interface WallLayout {
  shape: RingShape;
  slots: Slot[];
  /** 圈縮了幾成才排得下 */
  scale: number;
  length: number;
  landmarks: Map<number, Placed | null>;
  tags: Map<number, Placed | null>;
  unplaced: number;
  /** 放在圈裡面的名牌（含門名）有幾個 */
  inside?: number;
}

export function fitShape(board: { w: number; h: number }, compact: boolean, scale: number): RingShape {
  if (compact) {
    const mx = Math.max(64, board.w * 0.17);
    const my = Math.max(40, board.h * 0.12);
    return { cx: board.w / 2, cy: board.h / 2 + 4, rx: Math.max(40, (board.w / 2 - mx) * scale), ry: Math.max(40, (board.h / 2 - my) * scale) };
  }
  // 桌機：圈的直徑約是可用區域短邊的六成，放在正中，圈外四周留給名牌
  const short = Math.min(board.w, board.h);
  const ry = Math.max(60, short * 0.32 * scale);
  const rx = Math.max(60, Math.min(board.w * 0.3, ry * 1.2) * scale);
  return { cx: board.w / 2, cy: board.h / 2 + 4, rx, ry };
}

const SCALES = [1, 0.94, 0.88, 0.82];
const SCALES_COMPACT = [1, 0.94, 0.88, 0.82, 0.76, 0.7];

export function layoutWall(input: LayoutInput): WallLayout {
  const { data, board, compact, unit, thickness } = input;
  let best: WallLayout | null = null;
  for (const scale of input.fixedScale ? [input.fixedScale] : compact ? SCALES_COMPACT : SCALES) {
    const shape = fitShape(board, compact, scale);
    const length = ringLength(shape);
    const gap = Math.min(0.06, (unit + 7) / length);
    const slots = allocateRing(data.ring, gap);
    const opts: PlaceOptions = {
      board, pad: 10, insideCost: compact ? 38 : 600, gap: compact ? 6 : 10, clear: unit / 2 + 3, thickness, obstacles: input.obstacles,
    };
    const landmarkReqs: LabelReq[] = [];
    data.ring.forEach((item, i) => {
      if (item.kind === 'part') return;
      const size = input.landmarkSize.get(i);
      const slot = slots[i];
      if (!size || !slot || (item.back && i === data.ring.length - 1)) return;
      landmarkReqs.push({ id: `l${i}`, w: size.w, h: size.h, t: slot.tc, leader: false, near: unit / 2 - thickness / 2 + 1, reach: compact ? 60 : 64 });
    });
    const landmarks = new Map<number, Placed | null>();
    // 手機：圈中央留給目前這一段的名牌，門名不占那裡（換一段名牌，門名也不會跟著跳）
    const zone: Box[] = compact
      ? [{ x: shape.cx - Math.min(shape.rx - 14, 100), y: shape.cy - Math.min(shape.ry - 12, 58), w: Math.min(shape.rx - 14, 100) * 2, h: Math.min(shape.ry - 12, 58) * 2 }]
      : [];
    const placedL = placeLabels(shape, landmarkReqs, { ...opts, obstacles: [...input.obstacles, ...zone] });
    for (const req of landmarkReqs) landmarks.set(Number(req.id.slice(1)), placedL.get(req.id) ?? null);
    // 手機上的名牌排在門名之後：先把門名放好，名牌再找剩下的空位
    const tagOrder = compact ? input.wantTags ?? [] : data.ring.flatMap((item, i) => (item.kind === 'part' ? [i] : []));
    const tagReqs: LabelReq[] = [];
    tagOrder.forEach((i, order) => {
      const size = input.tagSize.get(i);
      const slot = slots[i];
      if (!size || !slot) return;
      const centers: Pt[] = [];
      if (compact) {
        const stepY = Math.max(10, size.h / 2 + 8);
        centers.push({ x: shape.cx, y: shape.cy });
        for (let k = 1; k <= 6; k += 1) {
          centers.push({ x: shape.cx, y: shape.cy + k * stepY }, { x: shape.cx, y: shape.cy - k * stepY });
        }
        void order;
      }
      tagReqs.push({ id: `t${i}`, w: size.w, h: size.h, t: slot.tc, leader: true, near: 14, centers });
    });
    const landmarkBoxes = input.tagOverLandmarks ? [] : [...landmarks.values()].flatMap((p) => (p ? [p.box] : []));
    const placedT = placeLabels(shape, tagReqs, { ...opts, obstacles: [...input.obstacles, ...landmarkBoxes] });
    const tags = new Map<number, Placed | null>();
    for (const req of tagReqs) tags.set(Number(req.id.slice(1)), placedT.get(req.id) ?? null);
    const unplacedLandmarks = [...landmarks.values()].filter((p) => p === null).length;
    const unplacedTags = [...tags.values()].filter((p) => p === null).length;
    const layout: WallLayout = { shape, slots, scale, length, landmarks, tags, unplaced: unplacedLandmarks + (compact ? (tagOrder.length && !tags.get(tagOrder[0]!) ? 10 : 0) : unplacedTags) };
    // 放不下的最少；一樣多就選放在圈裡面最少的
    const inside = [...landmarks.values(), ...tags.values()].filter((p) => p?.inside).length;
    layout.inside = inside;
    if (!best || layout.unplaced < best.unplaced || (layout.unplaced === best.unplaced && !compact && layout.inside! < best.inside!)) best = layout;
    if (layout.unplaced === 0 && (compact || inside === 0)) break;
  }
  return best!;
}

// ── 墨筆畫牆 ─────────────────────────────────────────

const f = (n: number) => n.toFixed(1);

/** 手畫的抖動（像素）：沿著牆慢慢起伏，內外兩邊各自不同 */
function jitter(t: number, phase: number, thickness: number): number {
  return (0.9 * Math.sin(t * TAU * 23 + phase) + 0.55 * Math.sin(t * TAU * 61 + phase * 2.3)) * (thickness / 12);
}

function stepsFor(t0: number, t1: number, step: number, length: number): number {
  return Math.max(2, Math.ceil(((t1 - t0) * length) / step));
}

/** 牆身：圈上 t0 到 t1 這一段的外緣、內緣圍起來的形狀 */
export function bandPath(shape: RingShape, t0: number, t1: number, thickness: number, length: number, step = 5): string {
  if (t1 <= t0) return '';
  const n = stepsFor(t0, t1, step, length);
  const outer: string[] = [];
  const inner: string[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = t0 + ((t1 - t0) * i) / n;
    const p = ringPoint(shape, t);
    const { normal } = ringFrame(shape, t);
    const o = thickness / 2 + jitter(t, 0.4, thickness);
    const k = thickness / 2 + jitter(t, 2.1, thickness);
    outer.push(`${f(p.x + normal.x * o)} ${f(p.y + normal.y * o)}`);
    inner.push(`${f(p.x - normal.x * k)} ${f(p.y - normal.y * k)}`);
  }
  return `M${outer.join('L')}L${inner.reverse().join('L')}Z`;
}

/** 磚縫：一道中線，加上內外兩層錯開的短橫線 */
export function brickPath(shape: RingShape, t0: number, t1: number, thickness: number, length: number, brick = 13): string {
  if (t1 <= t0) return '';
  const dt = brick / length;
  const parts: string[] = [];
  const center: string[] = [];
  const n = stepsFor(t0, t1, 6, length);
  for (let i = 0; i <= n; i += 1) {
    const p = ringPoint(shape, t0 + ((t1 - t0) * i) / n);
    center.push(`${f(p.x)} ${f(p.y)}`);
  }
  parts.push(`M${center.join('L')}`);
  const tick = (t: number, from: number, to: number) => {
    const p = ringPoint(shape, t);
    const { normal } = ringFrame(shape, t);
    parts.push(`M${f(p.x + normal.x * from)} ${f(p.y + normal.y * from)}L${f(p.x + normal.x * to)} ${f(p.y + normal.y * to)}`);
  };
  const half = thickness / 2;
  for (let t = t0 + dt * 0.6, k = 0; t < t1 - dt * 0.2; t += dt / 2, k += 1) {
    if (k % 2 === 0) tick(t, half, 0); else tick(t, 0, -half);
  }
  return parts.join('');
}

export function ringPath(shape: RingShape, steps = 120): string {
  const pts = sampleRing(shape, steps).map((p) => `${f(p.x)} ${f(p.y)}`);
  return `M${pts.join('L')}Z`;
}

// ── 縮圖與鏡頭 ───────────────────────────────────────

export const MINI_SHAPE: RingShape = { cx: 0.5, cy: 0.5, rx: 0.4, ry: 0.4 };

/** 縮圖上這一項的位置（0–1）；段取已砌好那一截的中央 */
export function itemPosition(shape: RingShape, slot: Slot, progress = 1): Pt {
  if (slot.kind === 'part') return ringPoint(shape, slot.t0 + ((slot.t1 - slot.t0) * Math.max(0.1, progress)) / 2);
  return ringPoint(shape, slot.tc);
}

// ── 大小的估算（測試與還沒量到版面時用） ────────────────

export function estimateTagSize(lines: readonly TagChar[][], fontSize: number, famRows = 0): { w: number; h: number } {
  const widest = Math.max(1, ...lines.map((line) => line.length));
  const w = Math.max(widest * (fontSize + 0.6), famRows ? 150 : 0) + 20;
  const h = Math.max(1, lines.length) * fontSize * 1.5 + 12 + famRows * 30;
  return { w: Math.ceil(w), h: Math.ceil(h) };
}

export function estimateLabelSize(text: string, fontSize: number): { w: number; h: number } {
  return { w: Math.ceil(Array.from(text).length * (fontSize + 0.4)) + 4, h: Math.ceil(fontSize * 1.4) + 2 };
}

/** 窗口寬度對應到右上角小地圖按鈕占掉的地方（和 reading.css 的尺寸一致），名牌不可壓到 */
export function miniReserve(board: { w: number; h: number }, viewportWidth: number): Box {
  if (viewportWidth > 900) return { x: board.w - 140, y: 6, w: 140, h: 132 };
  if (viewportWidth > 520) return { x: board.w - 126, y: 4, w: 126, h: 106 };
  return { x: board.w - 112, y: 2, w: 112, h: 46 };
}

/** 「回到朗讀處」按鈕占掉的地方（跟隨中是隱藏的，但它出現時名牌不應被蓋住） */
export function returnReserve(board: { w: number; h: number }, viewportWidth: number): Box {
  if (viewportWidth > 900) return { x: 14, y: board.h - 64, w: 150, h: 54 };
  return { x: board.w - 150, y: board.h - 56, w: 144, h: 50 };
}
