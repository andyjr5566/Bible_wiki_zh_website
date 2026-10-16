import type { ReadingData, RosterFamily, WallData, WallItem } from '../data/types';
import { h, svgEl } from './dom';
import { familyLead, familyTags, linkMark } from './roster-model';
import { emptyMarks, type ReadingStage, type StageMarks } from './stage';
import {
  MINI_SHAPE, allocateRing, bandPath, brickPath, itemPosition, layoutWall, miniReserve, nearestOnBox, returnReserve, ringPath, ringPoint,
  shownCount, tagLines, tagThresholds, wallIndexes, wallState, type Box, type Placed, type Slot, type WallLayout, type WallState,
} from './wall-model';
import '../wall.css';

/**
 * 城牆（尼 3）：讀經的第四個舞台，疊在畫布上。
 * 一圈示意的牆（不照比例），門、樓照經文次序排開；讀到哪一段，那一段的牆一磚一磚砌上去，
 * 修造的人名一個字一個字寫在圈外的名牌上。讀過的段留下淡墨，一圈讀完整圈都有人名。
 */
export interface WallOptions {
  /** 第一次 ready() 才呼叫（動態 import wall.json） */
  load(): Promise<WallData>;
  reading: ReadingData;
  /** 點家族軌跡的小籤：讀經程式跳到那一節讀 */
  onJump?(key: string): void;
  /** 冊上有名的人：讀經程式換到家譜樹看他 */
  onTreePerson?(id: string): void;
}

const OFF = 'ag-wl-off';
const MAX_LINE_CHARS = 8;
const motionOn = () => document.documentElement.dataset.motion !== 'off';

interface Written {
  chars: HTMLElement[];
  thresholds: number[];
  shown: number;
}

interface FamView {
  el: HTMLElement;
  name: number;
  shown: boolean;
}

interface TagView {
  el: HTMLElement;
  text: Written;
  names: HTMLElement[];
  seal: HTMLElement;
  fams: FamView[];
  size: { w: number; h: number };
  appeared: boolean;
  named: boolean;
}

interface PartView {
  index: number;
  item: WallItem;
  idx: number;
  g: SVGGElement;
  outline: SVGPathElement;
  fill: SVGPathElement;
  bricks: SVGPathElement;
  leader: SVGPathElement;
  dot: SVGCircleElement;
  tag: TagView;
  full: string;
  fullBricks: string;
  built: number;
  state: 'off' | 'read' | 'now';
  placed: Placed | null;
}

interface PointView {
  index: number;
  item: WallItem;
  idx: number;
  sym: SVGGElement;
  label: HTMLElement | null;
  /** 門名離自己的門比較遠時，拉一條很細的線連回去 */
  link: SVGPathElement | null;
  text: Written | null;
  size: { w: number; h: number };
  state: 'off' | 'read' | 'now';
}

function written(thresholds: number[], chars: HTMLElement[]): Written {
  return { chars, thresholds, shown: 0 };
}

/** 讀到的字亮起來（淡入），沒讀到的藏起來 */
function writeChars(text: Written, count: number, animate: boolean) {
  if (count === text.shown) return;
  const lo = Math.min(count, text.shown);
  const hi = Math.max(count, text.shown);
  for (let i = lo; i < hi; i += 1) {
    const node = text.chars[i]!;
    const on = i < count;
    node.classList.toggle('is-on', on);
    node.classList.toggle('is-new', on && animate);
  }
  text.shown = count;
}

function makeSymbol(kind: WallItem['kind']): SVGGElement {
  const g = svgEl('g', { class: `ag-wl-sym is-${kind}` });
  g.append(svgEl('circle', { class: 'ag-wl-pulse', r: 13, cx: 0, cy: 0 }));
  if (kind === 'gate') {
    // 門：兩根柱子一道橫楣
    g.append(
      svgEl('rect', { class: 'ag-wl-post', x: -8, y: -7, width: 3.4, height: 16, rx: 0.8 }),
      svgEl('rect', { class: 'ag-wl-post', x: 4.6, y: -7, width: 3.4, height: 16, rx: 0.8 }),
      svgEl('rect', { class: 'ag-wl-lintel', x: -10.5, y: -11, width: 21, height: 4, rx: 1 }),
    );
  } else if (kind === 'tower') {
    // 樓：方塔，頂上三個垛口
    g.append(
      svgEl('rect', { class: 'ag-wl-tower', x: -6.5, y: -6, width: 13, height: 14, rx: 1 }),
      svgEl('path', { class: 'ag-wl-crown', d: 'M-6.5 -6V-10H-3V-6M-1.7 -6V-10H1.7V-6M3 -6V-10H6.5V-6' }),
      svgEl('path', { class: 'ag-wl-slit', d: 'M0 -1V4' }),
    );
  } else {
    g.append(svgEl('circle', { class: 'ag-wl-spot', r: 5, cx: 0, cy: 0 }), svgEl('circle', { class: 'ag-wl-spot-core', r: 1.8, cx: 0, cy: 0 }));
  }
  return g;
}

export function createWall(options: WallOptions): ReadingStage {
  let data: WallData | null = null;
  let loading: Promise<void> | null = null;
  let reading = false;
  let marks: StageMarks = emptyMarks();
  let cur = -1;
  let chars = 0;
  let jumped = false;
  let idx: number[] = [];
  let verseLens: number[] = [];
  let state: WallState | null = null;
  const parts: PartView[] = [];
  const points: PointView[] = [];
  const partAt = new Map<number, PartView>();
  const pointAt = new Map<number, PointView>();

  // ── 骨架 ──
  const svg = svgEl('svg', { class: 'ag-wl-svg', 'aria-hidden': 'true' });
  const wallLayer = svgEl('g', { class: 'ag-wl-walls' });
  const leaderLayer = svgEl('g', { class: 'ag-wl-leaders' });
  const symLayer = svgEl('g', { class: 'ag-wl-syms' });
  const glow = svgEl('path', { class: 'ag-wl-glow' });
  const front = svgEl('circle', { class: 'ag-wl-front', r: 4 });
  const frontHalo = svgEl('circle', { class: 'ag-wl-front-halo', r: 132 });
  const defs = svgEl('defs');
  const lamp = svgEl('radialGradient', { id: 'ag-wl-lamp' });
  lamp.append(
    svgEl('stop', { offset: '0%', class: 'ag-wl-lamp-in' }),
    svgEl('stop', { offset: '55%', class: 'ag-wl-lamp-mid' }),
    svgEl('stop', { offset: '100%', class: 'ag-wl-lamp-out' }),
  );
  defs.append(lamp);
  svg.append(defs, frontHalo, wallLayer, leaderLayer, glow, symLayer, front);
  const labels = h('div', { className: 'ag-wl-labels' });
  const note = h('p', { className: 'ag-wl-note' }, '示意，不照比例');
  const board = h('div', { className: 'ag-wl-board' }, h('div', { className: 'ag-wl-wash' }), svg, labels, note);
  const el = h('section', { className: 'ag-wall', 'aria-label': '修造城牆的人' }, board);
  const empty = h('p', { className: 'ag-wl-empty' }, '載入中…');
  board.append(empty);

  // ── 載入 ──
  const ready = (): Promise<void> => {
    loading ??= options.load().then((value) => {
      data = value;
      applyVerse();
      build();
      relayout();
      paint(false);
    }).catch((error: unknown) => {
      loading = null;
      empty.textContent = '城牆暫時打不開，請稍後再試。';
      throw error;
    });
    return loading;
  };

  const verseTexts = new Map<string, string>();
  function verseLength(at: string): number {
    if (!verseTexts.size) {
      for (const segment of options.reading.segments) {
        for (const chapter of segment.chapters) {
          for (const verse of chapter.verses) verseTexts.set(`${chapter.book}${chapter.n}:${verse.v}`, verse.text);
        }
      }
    }
    return Array.from(verseTexts.get(at) ?? '').length;
  }

  function famLine(tags: ReturnType<typeof familyTags>, lead: string): HTMLElement {
    const line = h('div', { className: `ag-wl-fam-line ${OFF}` }, h('span', { className: 'ag-wl-fam-lead' }, lead));
    for (const tag of tags) {
      const button = h('button', {
        className: 'ag-wl-fam-tag', type: 'button', title: tag.family,
        'aria-label': `${tag.family}也在${tag.text}，跳到那一節讀`,
      }, h('span', { className: 'ag-wl-fam-ref' }, tag.ref), tag.count ? h('span', { className: 'ag-wl-fam-cnt' }, tag.count) : null);
      button.addEventListener('click', (event) => { event.stopPropagation(); options.onJump?.(tag.at); });
      line.append(button);
    }
    return line;
  }

  function buildTag(item: WallItem, families: RosterFamily[] | undefined, segment: string): TagView {
    const names = item.names ?? [];
    const lines = tagLines(names, MAX_LINE_CHARS);
    const nameEls: HTMLElement[] = [];
    const charEls: HTMLElement[] = [];
    const body = h('div', { className: 'ag-wl-names' });
    for (const line of lines) {
      const lineEl = h('div', { className: 'ag-wl-line' });
      let group = -1;
      let holder: HTMLElement | null = null;
      for (const c of line) {
        if (c.name !== group || !holder) {
          group = c.name;
          holder = h('span', { className: 'ag-wl-nm' });
          nameEls[c.name] = holder;
          lineEl.append(holder);
        }
        const ch = h('span', { className: 'ag-wl-ch' }, c.ch);
        charEls.push(ch);
        holder.append(ch);
      }
      body.append(lineEl);
    }
    const seal = h('span', { className: `ag-wl-seal ${OFF}`, 'aria-label': '冊上有名' }, '冊上有名');
    const tagEl = h('div', { className: `ag-wl-tag ${OFF}` }, body, seal);
    const fams: FamView[] = [];
    const famBox = h('div', { className: 'ag-wl-fam' });
    names.forEach((name, ni) => {
      const tags = familyTags(families, name.fam, segment);
      if (!tags.length) return;
      const line = famLine(tags, familyLead(tags, [name.t]));
      fams.push({ el: line, name: ni, shown: false });
      famBox.append(line);
    });
    if (fams.length) tagEl.append(famBox);
    return {
      el: tagEl, text: written(tagThresholds(lines), charEls), names: nameEls, seal, fams, size: { w: 120, h: 30 }, appeared: false, named: false,
    };
  }

  function build() {
    if (!data) return;
    const wall = data;
    empty.remove();
    idx = wallIndexes(wall);
    verseLens = wall.verses.map((key) => verseLength(key));
    parts.length = 0;
    points.length = 0;
    partAt.clear();
    pointAt.clear();
    wallLayer.replaceChildren();
    leaderLayer.replaceChildren();
    symLayer.replaceChildren();
    labels.replaceChildren();
    wall.ring.forEach((item, index) => {
      if (item.kind === 'part') {
        const outline = svgEl('path', { class: 'ag-wl-outline' });
        const fill = svgEl('path', { class: 'ag-wl-fill' });
        const bricks = svgEl('path', { class: 'ag-wl-bricks' });
        const g = svgEl('g', { class: 'ag-wl-part' });
        g.append(outline, fill, bricks);
        const leader = svgEl('path', { class: 'ag-wl-leader' });
        const dot = svgEl('circle', { class: 'ag-wl-leader-dot', r: 2.2 });
        const tag = buildTag(item, wall.families, wall.segment);
        const view: PartView = {
          index, item, idx: idx[index] ?? -1, g, outline, fill, bricks, leader, dot, tag, full: '', fullBricks: '', built: -1, state: 'off', placed: null,
        };
        parts.push(view);
        partAt.set(index, view);
        wallLayer.append(g);
        leaderLayer.append(leader, dot);
        labels.append(tag.el);
        return;
      }
      // 繞回起點的那個門就是第一個門，不另外畫
      const isBack = Boolean(item.back) && index === wall.ring.length - 1;
      const sym = makeSymbol(item.kind);
      let label: HTMLElement | null = null;
      let text: Written | null = null;
      if (!isBack) {
        const name = item.t ?? '';
        const charEls = Array.from(name).map((ch) => h('span', { className: 'ag-wl-ch' }, ch));
        label = h('span', { className: `ag-wl-lm is-${item.kind}` }, ...charEls);
        text = written(charEls.map((_, i) => (item.s ?? 0) + i), charEls);
        labels.append(label);
        symLayer.append(sym);
      }
      let link: SVGPathElement | null = null;
      if (label) { link = svgEl('path', { class: 'ag-wl-lm-link' }); leaderLayer.append(link); }
      const view: PointView = { index, item, idx: idx[index] ?? -1, sym, label, link, text, size: { w: 40, h: 18 }, state: 'off' };
      points.push(view);
      pointAt.set(index, view);
    });
    // 點擊圈上的某一段：手機上展開那一段的名牌
    svg.addEventListener('pointerdown', onSvgPointer);
  }

  // ── 版面 ──
  let layout: WallLayout | null = null;
  let dirty = false;
  let compact = false;
  let boardSize = { w: 0, h: 0 };
  let expanded = -1;
  let fixedScale = 0;
  let thickness = 12;
  let unit = 20;

  const sizeOf = (node: HTMLElement) => ({ w: node.offsetWidth, h: node.offsetHeight });

  function measure(): { landmarks: Map<number, { w: number; h: number }>; tags: Map<number, { w: number; h: number }> } {
    board.classList.add('is-measure');
    const landmarks = new Map<number, { w: number; h: number }>();
    const tags = new Map<number, { w: number; h: number }>();
    for (const p of points) {
      if (!p.label) continue;
      p.size = sizeOf(p.label);
      landmarks.set(p.index, p.size);
    }
    for (const p of parts) {
      p.tag.size = sizeOf(p.tag.el);
      tags.set(p.index, p.tag.size);
    }
    board.classList.remove('is-measure');
    return { landmarks, tags };
  }

  function obstacles(): Box[] {
    const view = { w: boardSize.w, h: boardSize.h };
    // 左上角那行「示意，不照比例」也不能被蓋住
    const noteBox: Box = { x: 0, y: 0, w: (note.offsetWidth || 120) + (window.innerWidth > 900 ? 28 : 20), h: (note.offsetHeight || 18) + (window.innerWidth > 900 ? 24 : 16) };
    return [miniReserve(view, window.innerWidth), returnReserve(view, window.innerWidth), noteBox];
  }

  function relayout() {
    if (!data) return;
    const w = board.clientWidth;
    const hh = board.clientHeight;
    if (w < 80 || hh < 80) { dirty = true; return; }
    dirty = false;
    measuredScale = fontScale();
    boardSize = { w, h: hh };
    svg.setAttribute('viewBox', `0 0 ${w} ${hh}`);
    compact = w < 560;
    board.classList.toggle('is-compact', compact);
    unit = compact ? 15 : 20;
    thickness = compact ? 8 : 12;
    const sizes = measure();
    const build = (isCompact: boolean, wantTags: number[], scale?: number) => layoutWall({
      data: data!, board: boardSize, compact: isCompact, landmarkSize: sizes.landmarks, tagSize: sizes.tags, unit, thickness,
      obstacles: obstacles(), wantTags, fixedScale: scale,
    });
    let result = build(compact, []);
    // 平板：圈縮到最小名牌還是排不下，就改成手機的做法（一次看幾個）
    if (!compact && result.unplaced > 0) {
      compact = true;
      board.classList.add('is-compact');
      unit = 15;
      thickness = 8;
      result = build(true, []);
    }
    fixedScale = result.scale;
    layout = result;
    if (!compact) {
      layout = build(false, [], fixedScale);
      applyGeometry(layout);
      applyTags(layout);
    } else {
      applyGeometry(result);
      placeCompact();
    }
    paint(false);
  }

  function applyGeometry(l: WallLayout) {
    for (const p of parts) {
      const slot = l.slots[p.index];
      if (!slot) continue;
      p.full = bandPath(l.shape, slot.t0, slot.t1, thickness, l.length);
      p.fullBricks = brickPath(l.shape, slot.t0, slot.t1, thickness, l.length);
      p.outline.setAttribute('d', p.full);
      p.built = -1;
    }
    const s = unit / 20;
    for (const p of points) {
      const slot = l.slots[p.index];
      if (!slot || !p.label) continue;
      const pt = ringPoint(l.shape, slot.tc);
      p.sym.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${s})`);
      const placed = l.landmarks.get(p.index) ?? null;
      p.label.classList.toggle(OFF, !placed);
      if (placed) {
        p.label.style.left = `${placed.box.x.toFixed(1)}px`;
        p.label.style.top = `${placed.box.y.toFixed(1)}px`;
      }
      if (p.link) {
        const near = placed ? nearestOnBox(pt, placed.box) : null;
        const far = near ? Math.hypot(near.x - pt.x, near.y - pt.y) > unit * 0.9 + 6 : false;
        if (near && far) p.link.setAttribute('d', `M${pt.x.toFixed(1)} ${pt.y.toFixed(1)}L${near.x.toFixed(1)} ${near.y.toFixed(1)}`);
        else p.link.removeAttribute('d');
      }
    }
  }

  function setPlacement(p: PartView, placed: Placed | null) {
    p.placed = placed;
    if (!placed) {
      p.leader.removeAttribute('d');
      p.dot.removeAttribute('cx');
      return;
    }
    const { box, from, to } = placed;
    p.tag.el.style.left = `${box.x.toFixed(1)}px`;
    p.tag.el.style.top = `${box.y.toFixed(1)}px`;
    p.tag.el.style.transformOrigin = `${placed.origin.x.toFixed(1)}px ${placed.origin.y.toFixed(1)}px`;
    if (to) {
      p.leader.setAttribute('d', `M${from.x.toFixed(1)} ${from.y.toFixed(1)}L${to.x.toFixed(1)} ${to.y.toFixed(1)}`);
      p.dot.setAttribute('cx', from.x.toFixed(1));
      p.dot.setAttribute('cy', from.y.toFixed(1));
    }
  }

  function applyTags(l: WallLayout) {
    for (const p of parts) setPlacement(p, l.tags.get(p.index) ?? null);
  }

  /** 手機：只放目前這一段，加上使用者點開的那一段 */
  function placeCompact() {
    if (!data || !layout) return;
    const want = [state?.nowPart ?? -1, expanded].filter((i, n, all) => i >= 0 && all.indexOf(i) === n);
    const sizes = new Map<number, { w: number; h: number }>();
    for (const p of parts) sizes.set(p.index, p.tag.size);
    const landmarkSize = new Map<number, { w: number; h: number }>();
    for (const p of points) if (p.label) landmarkSize.set(p.index, p.size);
    const run = (over: boolean) => layoutWall({
      data: data!, board: boardSize, compact: true, landmarkSize, tagSize: sizes, unit, thickness, obstacles: obstacles(), wantTags: want, fixedScale, tagOverLandmarks: over,
    });
    let next = run(false);
    // 名牌特別大、圈裡沒有空位時，名牌壓在淡淡的門名上，也不能不顯示
    if (want[0] !== undefined && !next.tags.get(want[0])) next = run(true);
    layout = next;
    for (const p of parts) setPlacement(p, want.includes(p.index) ? next.tags.get(p.index) ?? null : null);
  }

  // 字型載入完、或使用者調了字體大小：名牌的大小變了，重新排一次
  let measuredScale = '';
  const fontScale = () => getComputedStyle(document.documentElement).getPropertyValue('--ag-fs').trim();
  const checkFontScale = () => {
    if (!data || dirty) return;
    const now = fontScale();
    if (now !== measuredScale) relayout();
  };
  void document.fonts?.ready.then(() => { if (data) relayout(); });

  // 播放中（游標一直在走）目前這一段的名牌像呼吸一樣：暫停、動畫關閉時不呼吸
  let liveTimer = 0;
  function markLive() {
    if (!motionOn()) return;
    board.classList.add('is-live');
    window.clearTimeout(liveTimer);
    liveTimer = window.setTimeout(() => board.classList.remove('is-live'), 1300);
  }

  let resizeTimer = 0;
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      if (resizeTimer) cancelAnimationFrame(resizeTimer);
      resizeTimer = requestAnimationFrame(() => { resizeTimer = 0; relayout(); });
    }).observe(board);
  }

  function onSvgPointer(event: PointerEvent) {
    if (!compact || !layout || !state) return;
    const rect = svg.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = -1;
    let bestDistance = 40;
    for (const p of parts) {
      if (!state.reached[p.index]) continue;
      const slot = layout.slots[p.index];
      if (!slot) continue;
      const pt = ringPoint(layout.shape, slot.tc);
      const d = Math.hypot(pt.x - x, pt.y - y);
      if (d < bestDistance) { bestDistance = d; best = p.index; }
    }
    if (best < 0) return;
    expanded = best === state.nowPart ? -1 : expanded === best ? -1 : best;
    placeCompact();
    paint(false);
  }

  // ── 畫出目前的狀態 ──
  function setBand(p: PartView, progress: number) {
    const slot = layout?.slots[p.index];
    if (!layout || !slot) return;
    if (Math.abs(progress - p.built) < 0.004 && !(progress >= 1 && p.built < 1)) return;
    p.built = progress;
    if (progress >= 1) {
      p.fill.setAttribute('d', p.full);
      p.bricks.setAttribute('d', p.fullBricks);
      return;
    }
    const t1 = slot.t0 + (slot.t1 - slot.t0) * progress;
    p.fill.setAttribute('d', bandPath(layout.shape, slot.t0, t1, thickness, layout.length));
    p.bricks.setAttribute('d', brickPath(layout.shape, slot.t0, t1, thickness, layout.length));
  }

  function setState(node: Element, name: 'off' | 'read' | 'now') {
    node.classList.toggle('is-read', name === 'read');
    node.classList.toggle('is-now', name === 'now');
  }

  function paint(animate: boolean) {
    if (!data || !layout) return;
    const wall = data;
    const read = marks.links;
    const next = wallState(wall, idx, cur, chars, (i) => verseLens[i] ?? 0);
    const previousPart = state?.nowPart ?? -1;
    state = next;
    // 手機：換了一段，之前點開的名牌收起來，名牌換到圈中央這一段
    if (compact && next.nowPart !== previousPart) {
      expanded = -1;
      placeCompact();
    }
    for (const p of parts) {
      const reached = next.reached[p.index] ?? false;
      const now = p.index === next.nowPart;
      const st: PartView['state'] = !reached ? 'off' : now ? 'now' : 'read';
      if (st !== p.state) {
        p.state = st;
        setState(p.g, st);
        p.g.classList.toggle(OFF, false);
        p.fill.classList.toggle(OFF, st === 'off');
        p.bricks.classList.toggle(OFF, st === 'off');
        p.outline.classList.toggle(OFF, st !== 'off');
        p.tag.el.classList.toggle('is-now', st === 'now');
        p.tag.el.classList.toggle('is-past', st === 'read');
        p.leader.classList.toggle('is-now', st === 'now');
        p.dot.classList.toggle('is-now', st === 'now');
        if (st === 'off') p.built = -1;
      }
      if (st !== 'off') setBand(p, next.progress[p.index] ?? 0);
      // 名牌上的字
      const count = shownCount(p.tag.text.thresholds, cur, p.idx, chars);
      const appeared = count > 0;
      writeChars(p.tag.text, count, animate);
      const wanted = !compact || p.index === next.nowPart || p.index === expanded;
      const visible = appeared && Boolean(p.placed) && wanted;
      const wasVisible = !p.tag.el.classList.contains(OFF);
      if (visible !== wasVisible) {
        p.tag.el.classList.toggle(OFF, !visible);
        p.tag.el.classList.remove('is-fresh');
        if (visible && animate) p.tag.el.classList.add('is-fresh');
      }
      p.leader.classList.toggle(OFF, !visible);
      p.dot.classList.toggle(OFF, !visible);
      p.tag.appeared = appeared;
      // 冊上有名：金色加朱印（尼 3 目前沒有，但名冊的規則一樣）
      const names = p.item.names ?? [];
      let named = false;
      names.forEach((name, ni) => {
        const mark = name.link === undefined ? null : linkMark(options.reading.links, [name.link], read);
        const isNamed = mark?.kind === 'named' && (shownCount([name.s], cur, p.idx, chars) > 0);
        p.tag.names[ni]?.classList.toggle('is-named', isNamed);
        if (isNamed) named = true;
      });
      if (named !== p.tag.named) {
        p.tag.named = named;
        p.tag.seal.classList.toggle(OFF, !named);
        if (named && animate) p.tag.seal.classList.add('is-fresh');
      }
      // 家族軌跡小籤：那個名字出現了才一起出現
      for (const fam of p.tag.fams) {
        const show = shownCount([names[fam.name]?.s ?? 0], cur, p.idx, chars) > 0;
        if (show !== fam.shown) {
          fam.shown = show;
          fam.el.classList.toggle(OFF, !show);
          fam.el.classList.remove('is-fresh');
          if (show && animate) fam.el.classList.add('is-fresh');
        }
      }
    }
    const nowItem = next.nowItem;
    const backIndex = wall.ring.length - 1;
    for (const q of points) {
      const reached = next.reached[q.index] ?? false;
      let now = q.index === nowItem;
      let isRead = reached;
      // 羊門：回到起點那一項讀到時，也點亮第一個門
      if (q.index === 0 && wall.ring[backIndex]?.back) {
        if (nowItem === backIndex) now = true;
        if (next.reached[backIndex]) isRead = true;
      }
      const st: PointView['state'] = !isRead ? 'off' : now ? 'now' : 'read';
      if (st !== q.state) {
        q.state = st;
        setState(q.sym, st);
        q.label && setState(q.label, st);
      }
      if (q.text) writeChars(q.text, shownCount(q.text.thresholds, cur, q.idx, chars), animate);
    }
    // 目前砌牆的前沿：朱色微光跟著牆的盡頭
    const nowPartView = next.nowPart >= 0 ? partAt.get(next.nowPart) : undefined;
    const slot = nowPartView ? layout.slots[nowPartView.index] : undefined;
    // 這一段砌完之後、下一段還沒讀到之前，光暈停在牆的盡頭等著
    const building = Boolean(nowPartView && slot);
    glow.classList.toggle(OFF, !building);
    front.classList.toggle(OFF, !building);
    frontHalo.classList.toggle(OFF, !building);
    if (building && nowPartView && slot) {
      const progress = next.progress[nowPartView.index] ?? 0;
      const t1 = slot.t0 + (slot.t1 - slot.t0) * Math.max(0.02, progress);
      glow.setAttribute('d', bandPath(layout.shape, slot.t0, t1, thickness, layout.length));
      const tip = ringPoint(layout.shape, t1);
      for (const node of [front, frontHalo]) { node.setAttribute('cx', tip.x.toFixed(1)); node.setAttribute('cy', tip.y.toFixed(1)); }
    }
  }

  function repaint() {
    if (!data) return;
    paint(!jumped && motionOn());
  }

  /** 最近一次通知的那一節（資料還沒載入時先記著） */
  let verseKey = '';
  function applyVerse() {
    if (!data) return;
    const found = data.verses.indexOf(verseKey);
    if (found >= 0) cur = found;
  }

  function clearAnimations() {
    board.querySelectorAll('.is-fresh, .is-new').forEach((node) => node.classList.remove('is-fresh', 'is-new'));
  }

  function miniature(): SVGElement {
    const mini = svgEl('svg', { class: 'ag-wl-mini', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    mini.append(svgEl('path', { class: 'ag-wl-mini-ring', d: ringPath(MINI_SHAPE, 72) }));
    const ring = data?.ring ?? [];
    const slots = allocateRing(ring, 0.03);
    ring.forEach((item, i) => {
      const slot = slots[i];
      if (!slot || item.kind === 'part' || (item.back && i === ring.length - 1)) return;
      const p = ringPoint(MINI_SHAPE, slot.tc);
      mini.append(svgEl('circle', { class: `ag-wl-mini-dot is-${item.kind}`, cx: p.x.toFixed(3), cy: p.y.toFixed(3), r: item.kind === 'gate' ? 0.03 : 0.02 }));
    });
    return mini;
  }

  function locate(): { x: number; y: number } | null {
    if (!data || !state || state.nowItem < 0) return null;
    const slots = layout?.slots ?? allocateRing(data.ring, 0.03);
    const slot: Slot | undefined = slots[state.nowItem];
    if (!slot) return null;
    const p = itemPosition(MINI_SHAPE, slot, state.progress[state.nowItem] ?? 1);
    return { x: p.x, y: p.y };
  }

  return {
    id: 'wall',
    el,
    ready,
    setReading(on) {
      reading = on;
      if (!on) {
        window.clearTimeout(liveTimer);
        board.classList.remove('is-live');
        marks = emptyMarks();
        cur = -1;
        verseKey = '';
        chars = 0;
        expanded = -1;
        state = null;
      }
      el.classList.toggle('is-reading', on);
    },
    setVerse(key) {
      verseKey = key;
      chars = 0;
      jumped = false;
      applyVerse();
      checkFontScale();
    },
    setCursor(next, wasJumped) {
      chars = next;
      jumped = wasJumped;
      if (!wasJumped) markLive();
      if (!data || !reading) return;
      if (dirty || !layout) relayout();
      if (!wasJumped) { paint(motionOn()); return; }
      // 跳讀、打開：整個直接畫好，連字的淡入、牆的砌起都不播
      board.classList.add('is-still');
      paint(false);
      clearAnimations();
      void board.offsetWidth;
      board.classList.remove('is-still');
    },
    reveal() { /* 城牆沒有收合的地方 */ },
    setMarks(next) {
      marks = next;
      repaint();
    },
    flyTo() {
      // 整圈一定放得進畫面：不需要移鏡頭；手機展開的名牌回到目前這一段
      if (compact && expanded >= 0) { expanded = -1; placeCompact(); paint(false); }
      return Promise.resolve();
    },
    has(target) {
      return data !== null && target.startsWith('wall:');
    },
    onUserCamera() { /* 這個畫面不能拖動 */ },
    locate,
    miniature,
    saveView() { return null; },
    restoreView() { /* 沒有要還原的 */ },
  };
}
