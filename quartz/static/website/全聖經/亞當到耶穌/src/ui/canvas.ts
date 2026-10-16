import type { GenealogyData, Person, RoleSeal } from '../data/types';
import { branchRoots, buildGraph, firstReference, isBornOfNode, isPlacementNode } from '../data/model';
import { COLUMN_W, ROW_H, computeLayout, type CanvasLayout, type LayoutNode } from './layout';
import { svgEl } from './dom';
import { ROLE_SEAL_H, ensureInkDefs, inkHalo, inkStroke, pathSegments, roleSealRows, sealMark, sealRectsOverlap, segmentHitsRect, type SealRect, type SealSeg } from './ink';
import { FONT_SCALE_EVENT, getFontScale } from './fontscale';
import './roles.css';

export type CanvasLine = 'both' | '馬太' | '路加';

export interface CanvasApi {
  el: SVGSVGElement;
  focusPerson(id: string, animate?: boolean): void;
  focusIds(ids: string[], animate?: boolean, minZoom?: number, anchorId?: string): void;
  focusTourIds(ids: string[], avoid: HTMLElement | null, animate?: boolean): Promise<boolean>;
  fitSpine(animate?: boolean, collapse?: boolean): void;
  fitAll(animate?: boolean): void;
  zoom(factor: number): void;
  select(id: string | null): void;
  setTourHighlights(ids: string[], currentId: string | null, edges: Array<[string, string]>): void;
  clearTourHighlights(): void;
  setLine(line: CanvasLine): void;
  setTrace(ids: string[], edges: Array<{ from: string; to: string; kind: string }>): void;
  expandFor(id: string): void;
  expandPath(ids: string[]): void;
  expandFamily(id: string): void;
  expandAll(): void;
  layoutNow(): CanvasLayout;
  /** 讀經模式：淡墨底、名字依讀到的順序亮起 */
  setReading(on: boolean): void;
  /** 讀經的標記：這一節亮著的人、上一節漸退的人、正在讀的人、朱印、墨線。fresh 是這一次新加的（要有落筆、蓋印的動畫） */
  setReadingMarks(marks: ReadingMarks): void;
  /** 鏡頭移到這個人；已在畫面舒適範圍內就不動；距離很遠就先拉遠再推近 */
  flyTo(id: string, animate?: boolean): Promise<void>;
  /** 一次打開好幾個人所在的位置（只重畫一次） */
  expandMany(ids: string[]): void;
  getExpanded(): Set<string>;
  setExpanded(ids: Set<string>): void;
  /** 使用者自己拖動或縮放畫布時通知 */
  onUserCamera(listener: (() => void) | null): void;
  /** 點了人物卡旁的職位印：boxId 是職位圖的方塊，personId 是印的主人 */
  onRoleSeal(listener: ((boxId: string, personId: string) => void) | null): void;
}

export interface ReadingMarks {
  lit: Set<string>;
  trail: Set<string>;
  current: string | null;
  seals: Array<{ id: string; label: string; key: string }>;
  ink: Array<{ from: string; to: string; key: string }>;
  fresh: Set<string>;
}

interface ViewBox { x: number; y: number; width: number; height: number }
interface OverviewPerson {
  id: string; node: LayoutNode; line: string; priority: number; labelWidth: number;
  g: SVGGElement; bg: SVGRectElement; text: SVGTextElement;
}
interface OverviewBand {
  left: number; y0: number; y1: number; g: SVGGElement; title: SVGTextElement; sub: SVGTextElement; width: number;
}
// 縮小到這個比例以下就改畫「總覽」：只畫主線，名字一律用固定的螢幕字級
const OVERVIEW_ZOOM = 0.6;
const OVERVIEW_LABEL_PX = 13;
// 展開旁支後的最小縮放：要讀得到名字，也要高於總覽的門檻
const READABLE_ZOOM = 0.72;
interface Pointer { x: number; y: number }

const COLORS: Record<string, string> = { common: 'var(--ag-ink)', '馬太': 'var(--ag-matthew)', '路加': 'var(--ag-luke)' };
const EDGE_WIDTH: Record<string, number> = { mother: 1.1, descends: 1.4, list: 1.4, member: 1, kin: 1.1 };

export function createCanvas(data: GenealogyData, onSelect: (person: Person) => void, onNote: (noteId: string) => void): CanvasApi {
  const svg = svgEl('svg', {
    class: 'ag-canvas', role: 'application', 'aria-label': '可縮放的家譜畫布', tabindex: '0',
    preserveAspectRatio: 'xMidYMid meet',
  });
  const scene = svgEl('g', { class: 'ag-scene' });
  const segmentLayer = svgEl('g', { class: 'ag-segment-layer' });
  const frameLayer = svgEl('g', { class: 'ag-frame-layer' });
  const edgeLayer = svgEl('g', { class: 'ag-edge-layer' });
  const overviewLayer = svgEl('g', { class: 'ag-overview-layer' });
  const nodeLayer = svgEl('g', { class: 'ag-node-layer' });
  const inkLayer = svgEl('g', { class: 'ag-rd-ink-layer' });
  const labelLayer = svgEl('g', { class: 'ag-edge-label-layer' });
  let labelEls = new Map<string, SVGGElement>();
  const sealLayer = svgEl('g', { class: 'ag-rd-seal-layer' });
  const roleSealLayer = svgEl('g', { class: 'ag-ro-tseal-layer' });
  const hudLayer = svgEl('g', { class: 'ag-overview-hud' });
  scene.append(segmentLayer, frameLayer, edgeLayer, labelLayer, inkLayer, overviewLayer, nodeLayer, roleSealLayer, sealLayer, hudLayer);
  svg.append(scene);
  const graph = buildGraph(data);
  const expanded = new Set<string>();
  let layout = computeLayout(data, expanded);
  const allLayoutNodes = () => [...layout.nodes, ...layout.groups];
  let currentBox: ViewBox = { x: -500, y: -300, width: 1000, height: 600 };
  let currentLine: CanvasLine = 'both';
  let selected: string | null = null;
  let tourHighlightIds = new Set<string>();
  let tourCurrentId: string | null = null;
  let tourEdgeKeys = new Set<string>();
  let traceIds = new Set<string>();
  let traceEdges = new Set<string>();
  let nodeEls = new Map<string, SVGGElement>();
  let edgeEls = new Map<string, SVGPathElement>();
  let dragStart: Pointer | null = null;
  let dragBox: ViewBox | null = null;
  let didDrag = false;
  const pointers = new Map<number, Pointer>();
  let pinchStart: { distance: number; box: ViewBox; center: Pointer } | null = null;
  let cullTimer = 0;
  let lastCull = 0;
  let animationFrame = 0;
  let layoutAnimationFrame = 0;
  let animationDone: (() => void) | null = null;
  let overviewMode = false;
  let ovPersons: OverviewPerson[] = [];
  let ovBands: OverviewBand[] = [];
  let ovHeads: Array<{ line: string; x: number; text: SVGTextElement }> = [];
  let ovHint: SVGTextElement | null = null;
  let mainEdgeEls = new Map<string, SVGPathElement>();
  let roleSealListener: ((boxId: string, personId: string) => void) | null = null;
  let roleSealEls: Array<{ id: string; g: SVGGElement }> = [];

  const nodeFor = (id: string) => layout.nodes.find((node) => node.id === id);
  const lineFor = (person: Person) => person.lines?.includes('common') ? 'common' : person.lines?.includes('馬太') ? '馬太' : person.lines?.includes('路加') ? '路加' : 'common';
  const lineOpacity = (key: string) => currentLine === 'both' || key === 'common' || key === currentLine ? 1 : 0;
  const worldPoint = (clientX: number, clientY: number): Pointer => {
    const rect = svg.getBoundingClientRect();
    return {
      x: currentBox.x + ((clientX - rect.left) / Math.max(1, rect.width)) * currentBox.width,
      y: currentBox.y + ((clientY - rect.top) / Math.max(1, rect.height)) * currentBox.height,
    };
  };

  const zoomOf = (box: ViewBox) => Math.max(1, svg.clientHeight || window.innerHeight) / Math.max(1, box.height);
  // 縮小時，畫面上下緣不要超出整張家譜太多（左右不限制，導覽卡要用左右偏移留空間）
  const keepInside = (box: ViewBox): ViewBox => {
    const zoom = zoomOf(box);
    if (zoom >= OVERVIEW_ZOOM) return box;
    const bounds = layout.bounds;
    const top = bounds.y - 60 / zoom;
    const bottom = bounds.y + bounds.height + 60 / zoom;
    const y = box.height >= bottom - top ? (top + bottom) / 2 - box.height / 2 : Math.max(top, Math.min(bottom - box.height, box.y));
    return y === box.y ? box : { ...box, y };
  };
  const setViewBox = (requested: ViewBox) => {
    const box = keepInside(requested);
    currentBox = { ...box };
    svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
    window.clearTimeout(cullTimer);
    if ((zoomOf(currentBox) < OVERVIEW_ZOOM) !== overviewMode) {
      lastCull = performance.now();
      cullToViewport();
    } else {
      // 鏡頭移動中也要持續更新哪些節點該顯示（約每 50ms 一次），否則要等動畫停下來新節點才冒出來
      const now = performance.now();
      if (now - lastCull >= 50) {
        lastCull = now;
        cullToViewport();
      } else {
        cullTimer = window.setTimeout(() => { lastCull = performance.now(); cullToViewport(); }, 60);
        if (overviewMode) updateOverview();
      }
    }
  };
  // 縮放範圍：最小是整張家譜剛好放進畫面，最大約 4 倍
  const clampRatio = (ratio: number) => {
    const rect = svg.getBoundingClientRect();
    const bounds = layout.bounds;
    const minZoom = Math.max(0.02, Math.min(rect.height / Math.max(1, bounds.height), rect.width / Math.max(1, bounds.width)) * 0.85);
    const zoom = zoomOf(currentBox);
    return zoom / Math.max(minZoom, Math.min(4, zoom / ratio));
  };
  // 使用者自己縮小到會進入總覽時，先把展開的旁支全部收起來：
  // 展開的旁支會把主線的間距撐得很長，總覽裡只剩一條拉得老長的線。
  // 以畫面中央最近的主線人物為準，收起來之後鏡頭仍然停在他附近。
  const collapseForOverview = (box: ViewBox): ViewBox => {
    const main = layout.nodes.filter((node) => node.mainline);
    const centerY = box.y + box.height / 2;
    const anchor = main.reduce<LayoutNode | null>((best, node) => !best || Math.abs(node.y - centerY) < Math.abs(best.y - centerY) ? node : best, null);
    const offset = anchor ? centerY - anchor.y : 0;
    const anchorId = anchor?.id;
    expanded.clear();
    refresh(false);
    const moved = anchorId ? nodeFor(anchorId) : undefined;
    return moved ? { ...box, y: moved.y + offset - box.height / 2 } : box;
  };
  const setUserViewBox = (box: ViewBox): boolean => {
    if (expanded.size && !overviewMode && zoomOf(box) < OVERVIEW_ZOOM) {
      setViewBox(collapseForOverview(box));
      return true;
    }
    setViewBox(box);
    return false;
  };
  const zoomTo = (x: number, y: number, zoom: number, animate = true) => {
    const rect = svg.getBoundingClientRect();
    const width = Math.max(1, rect.width) / zoom;
    const height = Math.max(1, rect.height) / zoom;
    animateToBox({ x: x - width / 2, y: y - height / 2, width, height }, animate);
  };
  // 人物卡打開時，畫布還看得到的那一塊（以畫布寬高的比例表示）。
  // 窄螢幕的人物卡從底部升起、寬螢幕的在右側；用版面位置算卡片最後停住的地方，
  // 不看滑入動畫中的 transform，所以先開卡片、再移鏡頭也算得準。
  // 讀經模式的經文欄也一樣會蓋住畫布。
  const visibleArea = () => {
    const full = { x0: 0, y0: 0, x1: 1, y1: 1 };
    const rect = svg.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return full;
    const covers = [...document.querySelectorAll<HTMLElement>('.ag-info-card.ag-card-open, .ag-rd-panel:not([hidden])')];
    const gap = 12;
    const clamp = (value: number) => Math.max(0, Math.min(1, value));
    const area = { ...full };
    for (const cover of covers) {
      const parent = cover.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 };
      const left = parent.left + cover.offsetLeft;
      const top = parent.top + cover.offsetTop;
      const right = left + cover.offsetWidth;
      const bottom = top + cover.offsetHeight;
      if (right <= rect.left || left >= rect.right || bottom <= rect.top || top >= rect.bottom) continue;
      if (left <= rect.left + 1 && right >= rect.right - 1) area.y1 = Math.min(area.y1, clamp((top - gap - rect.top) / rect.height));
      else if (left <= rect.left + 1) area.x0 = Math.max(area.x0, clamp((right + gap - rect.left) / rect.width));
      else area.x1 = Math.min(area.x1, clamp((left - gap - rect.left) / rect.width));
    }
    // 剩下的空間太小時（例如橫放的手機），照整個畫布算，至少不會把人推出畫面
    return area.y1 - area.y0 < 0.18 || area.x1 - area.x0 < 0.3 ? full : area;
  };
  const fitRect = (x0: number, y0: number, x1: number, y1: number, animate = false, padding = 90, lockAspect = true, minZoom = 0, anchor?: { y: number; at: number }) => {
    const rect = svg.getBoundingClientRect();
    const aspect = Math.max(0.45, rect.width / Math.max(1, rect.height));
    // 要看的東西得放進人物卡沒蓋住的那一塊
    const area = visibleArea();
    const fx = area.x1 - area.x0;
    const fy = area.y1 - area.y0;
    const cx = area.x0 + fx / 2;
    const cy = area.y0 + fy / 2;
    let width = Math.max(160, x1 - x0 + padding * 2) / fx;
    let height = Math.max(160, y1 - y0 + padding * 2) / fy;
    if (lockAspect) {
      if (width / height > aspect) height = width / aspect;
      else width = height * aspect;
    }
    const target: ViewBox = { x: (x0 + x1) / 2 - width * cx, y: (y0 + y1) / 2 - height * cy, width, height };
    // 展開旁支時不能縮到會變成「總覽」的比例（總覽不畫旁支，使用者會看到空白）：
    // 太大放不下就維持可讀的比例，從這一組的頂端開始看，其餘用拖曳或捲動看
    if (minZoom > 0 && rect.height / target.height < minZoom) {
      const readableHeight = rect.height / minZoom;
      const readableWidth = readableHeight * (width / height);
      target.width = readableWidth;
      target.height = readableHeight;
      target.x = (x0 + x1) / 2 - readableWidth * cx;
      if ((y1 - y0) + 2 * (padding / 3) <= readableHeight * fy) target.y = (y0 + y1) / 2 - readableHeight * cy;
      // 一條很長的路徑放不下時，讓指定的節點落在看得到那一塊的 at（0~1）處，其餘往外延伸；沒指定就從頂端開始看
      else target.y = anchor ? anchor.y - readableHeight * (area.y0 + anchor.at * fy) : y0 - padding / 3 - readableHeight * area.y0;
    }
    animateToBox(target, animate);
  };
  const finishAnimation = () => {
    const done = animationDone;
    animationDone = null;
    done?.();
  };
  const animateToBox = (target: ViewBox, animate: boolean, duration = 720): Promise<void> => new Promise((resolve) => {
    if (!animate || document.documentElement.dataset.motion === 'off') {
      cancelAnimationFrame(animationFrame);
      finishAnimation();
      setViewBox(target);
      resolve();
      return;
    }
    cancelAnimationFrame(animationFrame);
    finishAnimation();
    animationDone = resolve;
    const from = { ...currentBox };
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setViewBox({
        x: from.x + (target.x - from.x) * eased,
        y: from.y + (target.y - from.y) * eased,
        width: from.width + (target.width - from.width) * eased,
        height: from.height + (target.height - from.height) * eased,
      });
      if (t < 1) animationFrame = requestAnimationFrame(tick);
      else finishAnimation();
    };
    animationFrame = requestAnimationFrame(tick);
  });

  function cullToViewport() {
    const marginX = currentBox.width * 0.12;
    const marginY = currentBox.height * 0.12;
    const zoomLevel = zoomOf(currentBox);
    const overview = zoomLevel < OVERVIEW_ZOOM;
    overviewMode = overview;
    scene.classList.toggle('ag-overview-on', overview);
    segmentLayer.style.display = overview ? '' : 'none';
    frameLayer.style.display = overview ? 'none' : '';
    inkLayer.style.display = overview ? 'none' : '';
    // 線上的關係字只在放大看得清名字時出現
    labelLayer.style.display = overview || zoomLevel < READABLE_ZOOM * 0.92 ? 'none' : '';
    sealLayer.style.display = overview ? 'none' : '';
    roleSealLayer.style.display = overview ? 'none' : '';
    overviewLayer.style.display = overview ? '' : 'none';
    hudLayer.style.display = overview ? '' : 'none';
    if (overview) {
      for (const element of nodeEls.values()) element.style.display = 'none';
      for (const [key, element] of edgeEls) element.style.display = mainEdgeEls.has(key) ? '' : 'none';
      updateOverview();
      return;
    }
    for (const element of mainEdgeEls.values()) {
      element.style.removeProperty('stroke-width');
      element.style.removeProperty('stroke-dasharray');
    }
    for (const [id, element] of nodeEls) {
      const label = element.querySelector<SVGTextElement>('.ag-node-label');
      const rect = element.querySelector<SVGRectElement>(':scope > rect');
      const dot = element.querySelector<SVGCircleElement>('.ag-node-dot');
      const node = nodeFor(id);
      if (!label || !rect || !node) continue;
      // 只有縮小到字會小於約 13px 時才放大標亮節點的字；已經夠大就維持原本字級，避免亮起後反而變小
      const fontScale = getFontScale();
      const emphasized = tourHighlightIds.has(id) && zoomLevel < 13 * fontScale / 15;
      label.style.display = emphasized ? 'block' : '';
      label.style.fontSize = emphasized ? `${13 * fontScale / zoomLevel}px` : '';
      if (dot) dot.style.display = emphasized ? 'none' : '';
      rect.style.display = emphasized ? 'block' : '';
      if (emphasized) {
        const labelWidth = label.getComputedTextLength();
        const width = Math.max(node.rectWidth, labelWidth + 24 * fontScale / zoomLevel);
        const height = Math.max(node.rectHeight, 22 * fontScale / zoomLevel);
        rect.setAttribute('x', String(node.rectX + (node.rectWidth - width) / 2));
        rect.setAttribute('y', String(-height / 2));
        rect.setAttribute('width', String(width));
        rect.setAttribute('height', String(height));
      } else {
        rect.setAttribute('x', String(node.rectX));
        rect.setAttribute('y', String(-node.height / 2));
        rect.setAttribute('width', String(node.rectWidth));
        rect.setAttribute('height', String(node.rectHeight));
      }
    }
    const visible = new Set<string>();
    for (const node of allLayoutNodes()) {
      const shown = node.x + node.width / 2 >= currentBox.x - marginX && node.x - node.width / 2 <= currentBox.x + currentBox.width + marginX &&
        node.y + node.height / 2 >= currentBox.y - marginY && node.y - node.height / 2 <= currentBox.y + currentBox.height + marginY;
      if (shown) visible.add(node.id);
      const el = nodeEls.get(node.id);
      if (el) el.style.display = shown ? '' : 'none';
    }
    for (const item of roleSealEls) item.g.style.display = visible.has(item.id) ? '' : 'none';
    // 連線只要「兩端節點圍成的範圍」碰到畫面就畫：父親在畫面外、孩子在畫面內（或一條長幹線穿過畫面）時，
    // 不能因為父親被隱藏就讓孩子看起來斷線
    const byId = new Map(allLayoutNodes().map((node) => [node.id, node]));
    const left = currentBox.x - marginX;
    const right = currentBox.x + currentBox.width + marginX;
    const top = currentBox.y - marginY;
    const bottom = currentBox.y + currentBox.height + marginY;
    for (const edge of layout.edges) {
      const from = byId.get(edge.from);
      const to = byId.get(edge.to);
      const shown = Boolean(from && to) &&
        Math.max(from!.x, to!.x) + Math.max(from!.width, to!.width) / 2 >= left && Math.min(from!.x, to!.x) - Math.max(from!.width, to!.width) / 2 <= right &&
        Math.max(from!.y, to!.y) >= top && Math.min(from!.y, to!.y) <= bottom;
      const el = edgeEls.get(edge.key);
      if (el) el.style.display = shown ? '' : 'none';
      const label = labelEls.get(edge.key);
      if (label) label.style.display = shown ? '' : 'none';
    }
  }

  const labelWidthOf = (text: string) => Array.from(text).reduce((sum, char) => sum + (char.codePointAt(0)! > 0x2e80 ? OVERVIEW_LABEL_PX : OVERVIEW_LABEL_PX * 0.58), 0) * getFontScale();
  // 低位元反轉序列：讓「每隔幾個人才標名字」在各處均勻分布，縮得越小留下的名字越少但仍分散
  const spread = (index: number) => {
    let result = 0;
    let fraction = 0.5;
    for (let n = index; n > 0; n >>= 1, fraction /= 2) if (n & 1) result += fraction;
    return result;
  };

  // 總覽（縮小時）：只畫主線；區段標題、人名、圓點都用固定的螢幕尺寸，名字太擠就依優先序稀疏
  function buildOverview() {
    segmentLayer.replaceChildren();
    overviewLayer.replaceChildren();
    hudLayer.replaceChildren();
    ovPersons = [];
    ovBands = [];
    ovHeads = [];
    ovHint = null;
    const main = layout.nodes.filter((node) => node.mainline);
    if (!main.length) return;
    const left = Math.min(...main.map((node) => node.x - node.width / 2)) - 140;
    const right = Math.max(...main.map((node) => node.x + node.width / 2)) + 140;

    const spans = new Map<string, { y0: number; y1: number }>();
    for (const segment of layout.segments) {
      const known = spans.get(segment.title);
      spans.set(segment.title, { y0: Math.min(known?.y0 ?? segment.y0, segment.y0), y1: Math.max(known?.y1 ?? segment.y1, segment.y1) });
    }
    const ordered = [...spans].sort((a, b) => a[1].y0 - b[1].y0);
    const nameOf = (id: string) => graph.byId.get(id)?.name ?? id;
    ordered.forEach(([title, span], index) => {
      const previous = ordered[index - 1]?.[1];
      const next = ordered[index + 1]?.[1];
      const top = previous ? (previous.y1 + span.y0) / 2 : span.y0 - ROW_H / 2;
      const bottom = next ? (span.y1 + next.y0) / 2 : span.y1 + ROW_H / 2;
      const rect = svgEl('rect', { class: `ag-ov-band${index % 2 ? ' ag-ov-band-alt' : ''}`, x: left, y: top, width: right - left, height: bottom - top });
      rect.addEventListener('click', (event) => {
        if (didDrag) return;
        const point = worldPoint(event.clientX, event.clientY);
        zoomTo(point.x, point.y, 0.9);
      });
      segmentLayer.append(rect);
      const routes = Object.entries((data.spine.segments ?? []).find((item) => item.title === title)?.lines ?? {}).filter(([, ids]) => ids.length);
      const subtitle = routes.length === 1
        ? `${nameOf(routes[0]![1][0]!)} → ${nameOf(routes[0]![1].at(-1)!)}`
        : routes.map(([line, ids]) => `${line === 'common' ? '共同' : line} ${ids.length} 人`).join('　');
      const g = svgEl('g', { class: 'ag-ov-heading' });
      const fs = getFontScale();
      const titleText = svgEl('text', { class: 'ag-ov-title', x: 0, y: 9 * fs, 'dominant-baseline': 'central' });
      titleText.textContent = title;
      const sub = svgEl('text', { class: 'ag-ov-sub', x: 0, y: 28 * fs, 'dominant-baseline': 'central' });
      sub.textContent = subtitle;
      g.append(titleText, sub);
      hudLayer.append(g);
      ovBands.push({ left, y0: top, y1: bottom, g, title: titleText, sub, width: Math.max(labelWidthOf(title) * 15 / OVERVIEW_LABEL_PX, labelWidthOf(subtitle) * 11 / OVERVIEW_LABEL_PX) });
    });

    for (const [line, x, label] of [['馬太', -COLUMN_W, '馬太線'], ['common', 0, '共同主線'], ['路加', COLUMN_W, '路加線']] as const) {
      const text = svgEl('text', { class: `ag-ov-head ag-ov-head-${line}`, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      text.textContent = label;
      hudLayer.append(text);
      ovHeads.push({ line, x, text });
    }
    ovHint = svgEl('text', { class: 'ag-ov-hint', x: 0, y: 0 });
    ovHint.textContent = '縮小檢視只顯示主線　點人名或區段可放大';
    hudLayer.append(ovHint);

    const boundary = new Set<string>();
    for (const segment of data.spine.segments ?? []) {
      for (const ids of Object.values(segment.lines ?? {})) if (ids.length) { boundary.add(ids[0]!); boundary.add(ids.at(-1)!); }
    }
    const routeIndex = new Map<string, number>();
    for (const ids of Object.values(data.spine.lines ?? {})) ids.forEach((id, index) => { if (!routeIndex.has(id)) routeIndex.set(id, index); });
    for (const node of main) {
      const person = graph.byId.get(node.id);
      if (!person) continue;
      const line = lineFor(person);
      const tier = boundary.has(node.id) ? 1 : person.notes?.length || person.marks?.length ? 2 : 3;
      const g = svgEl('g', { class: `ag-ov-person ag-ov-${line}`, 'data-id': node.id, role: 'button', tabindex: '0', 'aria-label': person.name });
      const bg = svgEl('rect', { class: 'ag-ov-bg', rx: 4, y: -11 * getFontScale(), height: 22 * getFontScale() });
      const dot = svgEl('circle', { class: 'ag-ov-dot', r: 4.5 });
      const text = svgEl('text', { class: 'ag-ov-label', 'dominant-baseline': 'central' });
      text.textContent = person.name;
      g.append(bg, dot, text);
      const zoomIn = () => zoomTo(node.x, node.y, 0.9);
      g.addEventListener('click', (event) => { event.stopPropagation(); if (!didDrag) zoomIn(); });
      g.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); zoomIn(); } });
      overviewLayer.append(g);
      ovPersons.push({ id: node.id, node, line, priority: tier + spread(routeIndex.get(node.id) ?? 0), labelWidth: labelWidthOf(person.name), g, bg, text });
    }
    ovPersons.sort((a, b) => a.priority - b.priority);
  }

  function updateOverview() {
    if (!ovPersons.length) return;
    const width = Math.max(1, svg.clientWidth);
    const height = Math.max(1, svg.clientHeight);
    const zoom = zoomOf(currentBox);
    const inv = 1 / zoom;
    const fs = getFontScale();
    const screenX = (x: number) => (x - currentBox.x) * zoom;
    const screenY = (y: number) => (y - currentBox.y) * zoom;
    const place = (element: SVGElement, px: number, py: number) => {
      element.setAttribute('transform', `translate(${currentBox.x + px * inv} ${currentBox.y + py * inv}) scale(${inv})`);
    };
    const occupied: Array<{ l: number; t: number; r: number; b: number }> = [];
    const hits = (box: { l: number; t: number; r: number; b: number }) => occupied.some((other) =>
      box.l < other.r + 4 && box.r > other.l - 4 && box.t < other.b + 3 && box.b > other.t - 3);

    for (const element of mainEdgeEls.values()) {
      const lit = element.classList.contains('ag-edge-tour-lit');
      const traced = element.classList.contains('ag-edge-traced');
      element.style.setProperty('stroke-width', `${(lit ? 5 : traced ? 4 : 2.6) * inv}px`, 'important');
      if (element.classList.contains('ag-edge-descends')) element.style.setProperty('stroke-dasharray', `${7 * inv} ${5 * inv}`);
    }

    const columnGap = COLUMN_W * zoom;
    for (const head of ovHeads) {
      const px = screenX(head.x);
      const outward = head.line === '馬太' ? 'end' : head.line === '路加' ? 'start' : 'middle';
      const shown = px > 36 && px < width - 36 && (head.line === 'common' ? columnGap > 70 : lineOpacity(head.line) > 0);
      head.text.style.display = shown ? '' : 'none';
      if (!shown) continue;
      head.text.setAttribute('text-anchor', outward);
      const anchorX = outward === 'end' ? px + 14 : outward === 'start' ? px - 14 : px;
      place(head.text, anchorX, 18 * fs);
      occupied.push(outward === 'end' ? { l: anchorX - 52 * fs, t: 5, r: anchorX + 4, b: 31 * fs }
        : outward === 'start' ? { l: anchorX - 4, t: 5, r: anchorX + 52 * fs, b: 31 * fs }
          : { l: anchorX - 36 * fs, t: 5, r: anchorX + 36 * fs, b: 31 * fs });
    }
    for (const band of ovBands) {
      const visibleTop = Math.max(screenY(band.y0), 40 * fs);
      const visibleBottom = Math.min(screenY(band.y1), height - 30);
      const shown = visibleBottom - visibleTop >= 28 * fs;
      band.g.style.display = shown ? '' : 'none';
      if (!shown) continue;
      const top = Math.max(visibleTop + 3, Math.min((visibleTop + visibleBottom) / 2 - 20 * fs, visibleBottom - 42 * fs));
      // 標題貼在區段左緣外側；區段左緣被推出畫面時就貼在畫面左邊
      const edge = screenX(band.left) - 12;
      const beside = edge - band.width >= 10;
      const anchor = beside ? 'end' : 'start';
      band.title.setAttribute('text-anchor', anchor);
      band.sub.setAttribute('text-anchor', anchor);
      const anchorX = beside ? edge : 12;
      place(band.g, anchorX, top);
      occupied.push(beside
        ? { l: anchorX - band.width - 4, t: top - 4, r: anchorX + 4, b: top + 42 * fs }
        : { l: 8, t: top - 4, r: 16 + band.width, b: top + 42 * fs });
    }
    if (ovHint) ovHint.style.display = width < 640 ? 'none' : '';
    if (ovHint && width >= 640) {
      place(ovHint, 12, height - 12);
      occupied.push({ l: 8, t: height - 24 * fs, r: 12 + labelWidthOf(ovHint.textContent ?? '') * 12 / OVERVIEW_LABEL_PX, b: height - 2 });
    }

    const labelBox = (person: OverviewPerson, px: number, py: number, right: boolean) => right
      ? { l: px + 10, t: py - 10 * fs, r: px + 14 + person.labelWidth, b: py + 10 * fs }
      : { l: px - 14 - person.labelWidth, t: py - 10 * fs, r: px - 10, b: py + 10 * fs };
    const emphasized = (person: OverviewPerson) => tourHighlightIds.has(person.id) || selected === person.id || traceIds.has(person.id);
    const onScreen = new Map<string, { px: number; py: number }>();
    for (const person of ovPersons) {
      const px = screenX(person.node.x);
      const py = screenY(person.node.y);
      const visible = px > -60 && px < width + 60 && py > -24 && py < height + 24 && lineOpacity(person.line) > 0;
      person.g.style.display = visible ? '' : 'none';
      if (!visible) continue;
      onScreen.set(person.id, { px, py });
      place(person.g, px, py);
      person.g.style.opacity = String(lineOpacity(person.line));
      person.g.classList.toggle('ag-ov-lit', tourHighlightIds.has(person.id) || traceIds.has(person.id));
      person.g.classList.toggle('ag-ov-current', tourCurrentId === person.id || selected === person.id);
      person.text.style.display = 'none';
    }
    const show = (person: OverviewPerson, px: number, py: number, force: boolean) => {
      const right = person.node.x > -COLUMN_W / 2;
      const box = labelBox(person, px, py, right);
      if (!force && hits(box)) return;
      occupied.push(box);
      person.text.style.display = 'block';
      person.text.setAttribute('x', String(right ? 12 : -12));
      person.text.setAttribute('text-anchor', right ? 'start' : 'end');
      person.bg.setAttribute('x', String(right ? 8 : -12 - person.labelWidth - 4));
      person.bg.setAttribute('width', String(person.labelWidth + 8));
    };
    for (const person of ovPersons) {
      const at = onScreen.get(person.id);
      if (at && emphasized(person)) show(person, at.px, at.py, true);
    }
    for (const person of ovPersons) {
      const at = onScreen.get(person.id);
      if (at && !emphasized(person)) show(person, at.px, at.py, false);
    }
  }

  // ── 讀經模式 ──────────────────────────────────────────────
  let reading = false;
  let marks: ReadingMarks = { lit: new Set(), trail: new Set(), current: null, seals: [], ink: [], fresh: new Set() };
  let userCameraListener: (() => void) | null = null;
  const nodeById = () => new Map(allLayoutNodes().map((node) => [node.id, node]));
  /** 把讀經的標記畫上去：節點的亮度、正在讀的墨暈、墨線、朱印。animate 只用在 fresh 裡的新標記。 */
  function drawReading(animate: boolean) {
    inkLayer.replaceChildren();
    sealLayer.replaceChildren();
    svg.classList.toggle('ag-rd-on', reading);
    for (const [id, element] of nodeEls) {
      element.classList.toggle('ag-rd-lit', reading && marks.lit.has(id));
      element.classList.toggle('ag-rd-trail', reading && !marks.lit.has(id) && marks.trail.has(id));
      element.classList.toggle('ag-rd-current', reading && marks.current === id);
    }
    for (const item of roleSealEls) {
      item.g.classList.toggle('ag-rd-lit', reading && marks.lit.has(item.id));
      item.g.classList.toggle('ag-rd-trail', reading && !marks.lit.has(item.id) && marks.trail.has(item.id));
    }
    if (!reading) return;
    const motion = animate && document.documentElement.dataset.motion !== 'off';
    const byId = nodeById();
    const current = marks.current ? byId.get(marks.current) : undefined;
    if (current) inkLayer.append(inkHalo(current.x, current.y, current.rectWidth * 0.78, current.rectHeight * 0.95));
    let order = 0;
    for (const line of marks.ink) {
      const a = byId.get(line.from);
      const b = byId.get(line.to);
      if (!a || !b) continue;
      const fresh = motion && marks.fresh.has(line.key);
      inkLayer.append(inkStroke(inkPath(a, b), fresh, fresh ? order++ * 140 : 0));
    }
    const perNode = new Map<string, number>();
    for (const seal of marks.seals) {
      const node = byId.get(seal.id);
      if (!node) continue;
      const index = perNode.get(seal.id) ?? 0;
      perNode.set(seal.id, index + 1);
      const x = node.x + node.rectX + node.rectWidth - 10 + index * 26;
      const y = node.y - node.height / 2 - 30;
      sealLayer.append(sealMark(seal.label, x, y, motion && marks.fresh.has(seal.key)));
    }
  }

  /** 墨線：一筆帶過的曲線，從父母那一側出筆，落在子女那一側（不照家譜樹的直角折線） */
  function inkPath(a: LayoutNode, b: LayoutNode): string {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < Math.max(a.width, b.width) / 2) {
      const direction = Math.sign(dy || 1);
      const startY = a.y + direction * a.height / 2;
      const endY = b.y - direction * b.height / 2;
      const bow = Math.min(60, Math.abs(endY - startY) * 0.18);
      return `M${a.x} ${startY} C${a.x + bow} ${startY + (endY - startY) * 0.35} ${b.x + bow} ${startY + (endY - startY) * 0.65} ${b.x} ${endY}`;
    }
    const direction = Math.sign(dx);
    const startX = a.x + direction * a.rectWidth / 2;
    const endX = b.x - direction * b.rectWidth / 2;
    const pull = (endX - startX) * 0.55;
    return `M${startX} ${a.y} C${startX + pull} ${a.y} ${endX - pull} ${b.y} ${endX} ${b.y}`;
  }

  // 讀經時的鏡頭：人已經在畫面舒適的範圍裡就不動；遠的先拉遠看到兩頭，再推近
  const READ_ZOOM_MIN = 0.86;
  const READ_ZOOM_MAX = 1.05;
  // 每次飛行一個編號：新的飛行開始、或使用者自己動了畫布，舊的就不要再走第二段
  let flight = 0;
  const stopCamera = () => {
    flight += 1;
    cancelAnimationFrame(animationFrame);
    finishAnimation();
  };
  const flyTo = async (id: string, animate = true): Promise<void> => {
    const mine = ++flight;
    const node = nodeById().get(id);
    if (!node) return;
    const rect = svg.getBoundingClientRect();
    const area = visibleArea();
    const fx = area.x1 - area.x0;
    const fy = area.y1 - area.y0;
    const zoomNow = zoomOf(currentBox);
    const zoom = Math.max(READ_ZOOM_MIN * getFontScale(), Math.min(READ_ZOOM_MAX, zoomNow));
    const sx = (node.x - currentBox.x) / currentBox.width;
    const sy = (node.y - currentBox.y) / currentBox.height;
    const comfortable = sx > area.x0 + fx * 0.16 && sx < area.x1 - fx * 0.16 && sy > area.y0 + fy * 0.2 && sy < area.y1 - fy * 0.2;
    if (comfortable && Math.abs(zoom - zoomNow) < 0.01) return;
    const width = Math.max(1, rect.width) / zoom;
    const height = Math.max(1, rect.height) / zoom;
    const target: ViewBox = { x: node.x - width * (area.x0 + fx / 2), y: node.y - height * (area.y0 + fy / 2), width, height };
    const motion = animate && document.documentElement.dataset.motion !== 'off';
    const distance = Math.hypot((target.x - currentBox.x) * zoomNow, (target.y - currentBox.y) * zoomNow);
    if (motion && distance > 2.2 * Math.max(rect.width, rect.height)) {
      // 拉遠到看得見起點和終點，再推近
      const x0 = Math.min(currentBox.x, target.x);
      const y0 = Math.min(currentBox.y, target.y);
      const x1 = Math.max(currentBox.x + currentBox.width, target.x + target.width);
      const y1 = Math.max(currentBox.y + currentBox.height, target.y + target.height);
      const aspect = rect.width / Math.max(1, rect.height);
      let midWidth = (x1 - x0) * 1.08;
      let midHeight = (y1 - y0) * 1.08;
      if (midWidth / midHeight > aspect) midHeight = midWidth / aspect;
      else midWidth = midHeight * aspect;
      const mid: ViewBox = { x: (x0 + x1) / 2 - midWidth / 2, y: (y0 + y1) / 2 - midHeight / 2, width: midWidth, height: midHeight };
      await animateToBox(mid, true, 820);
      if (mine !== flight) return;
      await animateToBox(target, true, 980);
      return;
    }
    await animateToBox(target, motion, 640);
  };

  // 沿著大圖上的掛法往上，把路上每一層（「N 位子女」、旁支的根、名單牌子、區域）都打開
  // includeSelf：連這個人自己的後代也打開（點人物卡時要看他的家）；讀經時只打開通往他的路
  const openAncestors = (id: string, includeSelf = true) => {
    let current = id;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const parent = graph.treeParent.get(current);
      if (!parent) break;
      if (includeSelf || current !== id) expanded.add(current);
      if (graph.spineIds.has(parent)) {
        for (const direction of [-1, 1]) {
          const key = `siblings:${parent}:${direction}`;
          const forest = layout.groups.find((node) => node.groupKey === key);
          if (!forest || forest.groupMembers?.includes(current)) expanded.add(key);
        }
        break;
      }
      if (isPlacementNode(graph.byId.get(parent))) expanded.add(parent);
      current = parent;
    }
  };
  // 「妻子：利百加」「利亞所生」：打開通往那個人的那一支，跳過去並打開人物卡
  const jumpTo = (id: string) => {
    const person = graph.byId.get(id);
    if (!person) return;
    openAncestors(id, false);
    refresh(true);
    onSelect(person);
  };
  const nodeSubtitle = (person: Person) => isPlacementNode(person)
    ? person.qualifier || '經文沒有寫和主線的關係'
    : person.qualifier || firstReference(person) ||
      Object.entries(person.gen ?? {}).map(([line, generation]) => `${line} ${generation}代`).join('／') || person.id;
  // 名單牌子、區域、各家牌子：點了就展開或收合，不開人物卡
  const togglePlacement = (id: string) => {
    if (expanded.has(id)) {
      expanded.delete(id);
      refresh(true);
      requestAnimationFrame(() => focusIds([id], true));
    } else {
      expanded.add(id);
      refresh(true);
      requestAnimationFrame(() => focusIds([id, ...(graph.children.get(id) ?? [])], true, READABLE_ZOOM));
    }
  };
  // 「母親未記載」膠囊、疊在妻子上面的祖先小卡：只寫名字。膠囊點了展開或收合兒女；祖先小卡點了開人物卡
  const renderCompact = (node: LayoutNode, person: Person, group: SVGGElement, capsule: boolean) => {
    const top = -node.rectHeight / 2;
    group.append(svgEl('rect', { x: node.rectX, y: top, width: node.rectWidth, height: node.rectHeight, rx: capsule ? node.rectHeight / 2 : 5 }));
    const label = svgEl('text', { class: capsule ? 'ag-child-group-label' : 'ag-node-label', x: node.rectX + node.rectWidth / 2, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    label.textContent = person.name;
    group.append(label);
    const toggle = (open: boolean) => {
      if (open) expanded.add(node.id); else expanded.delete(node.id);
      refresh(true);
      requestAnimationFrame(() => focusIds(open ? [node.id, ...(graph.children.get(node.id) ?? [])] : [node.id], true, READABLE_ZOOM));
    };
    if (capsule && (node.collapsed || node.expandedRoot)) {
      const badge = svgEl('g', { class: node.collapsed ? 'ag-descendant-badge' : 'ag-collapse-badge', transform: `translate(${node.rectX + node.rectWidth + 12} ${top + 12})` });
      badge.append(svgEl('circle', { r: node.collapsed ? 11 : 10 }), (() => {
        const text = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.textContent = node.collapsed ? `+${node.descendantCount ?? 0}` : '−';
        return text;
      })());
      group.append(badge);
    }
    if (traceIds.has(node.id)) group.classList.add('ag-trace-node');
    if (tourHighlightIds.has(node.id)) group.classList.add('ag-node-tour-lit');
    if (tourCurrentId === node.id) group.classList.add('ag-node-tour-current');
    if (selected === node.id) group.classList.add('ag-node-selected');
    const activate = () => {
      if (!capsule) onSelect(person);
      else if (node.collapsed) toggle(true);
      else if (node.expandedRoot) toggle(false);
    };
    group.addEventListener('click', (event) => { event.stopPropagation(); if (!didDrag) activate(); });
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } });
    return group;
  };
  const renderNode = (node: LayoutNode) => {
    if (node.groupLabel && node.groupKey) {
      const group = svgEl('g', {
        class: `ag-node ag-node-group ag-node-group-${node.groupLine ?? 'common'}${node.expandedRoot ? ' ag-node-group-expanded' : ''}`,
        transform: `translate(${node.x} ${node.y})`, 'data-group-key': node.groupKey,
        role: 'button', tabindex: '0', 'aria-label': node.groupLabel,
      });
      group.style.opacity = String(lineOpacity(node.groupLine ?? 'common'));
      group.append(svgEl('rect', { x: node.rectX, y: -node.rectHeight / 2, width: node.rectWidth, height: node.rectHeight, rx: 17 }));
      const label = svgEl('text', { class: 'ag-child-group-label', 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      label.textContent = node.groupLabel;
      group.append(label);
      const toggle = (event: Event) => {
        event.stopPropagation();
        const parentId = node.groupParentId ?? '';
        if (expanded.has(node.groupKey!)) {
          expanded.delete(node.groupKey!);
          for (const id of node.groupMembers ?? []) expanded.delete(id);
          refresh(true);
          requestAnimationFrame(() => focusIds([parentId], true));
        } else {
          // 只展開這一層：每個孩子先收著（顯示「+N」），要看他的後代再點他
          expanded.add(node.groupKey!);
          refresh(true);
          requestAnimationFrame(() => focusIds([parentId, ...(node.groupMembers ?? [])], true, READABLE_ZOOM));
        }
      };
      group.addEventListener('click', toggle);
      group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(event); } });
      return group;
    }
    const person = graph.byId.get(node.id);
    if (!person) return null;
    const plaque = isPlacementNode(person);
    // 母親的分身卡（利亞在以色列旁邊，本人的卡在娘家拉班那一支）：樣子和人物卡一樣，右上角「↗」，點了跳到本人那裡
    const bornOf = isBornOfNode(person) ? graph.bornOf.get(person.id) ?? graph.childRefs.get(person.id) : undefined;
    const onSpine = Boolean(bornOf && graph.childRefs.has(person.id));
    // 「母親未記載」：妻子欄裡的膠囊，點了展開或收合經文沒寫母親的兒女
    const capsule = person.kind === 'no-mother';
    // 妻子欄的卡：卡片上緣標「妻子」（經文沒記成夫妻的標「生母」）
    const wifeSlot = graph.wifeSlots.get(node.id);
    const group = svgEl('g', {
      class: `ag-node${node.mainline ? ' ag-node-main' : ' ag-node-side'}${bornOf ? ' ag-node-born-of' : ''}${capsule ? ' ag-node-no-mother' : ''}${node.chip ? ' ag-node-chip' : ''}${wifeSlot ? ' ag-node-wife' : ''} ag-node-route-${lineFor(person)}${node.collapsed ? ' ag-node-collapsed' : ''}${plaque ? ` ag-node-plaque ag-node-plaque-${person.kind}` : ''}`,
      transform: `translate(${node.x} ${node.y})`,
      'data-id': node.id,
      role: 'button', tabindex: '0',
      'aria-label': plaque
        ? `${person.name}，${node.expandedRoot ? '收合' : `展開 ${node.descendantCount ?? 0} 位`}`
        : `${person.name}${node.collapsed ? `，展開 ${node.descendantCount ?? 0} 位後代` : onSpine ? '，到主線上看他' : bornOf ? '，到他娘家那一支看他' : ''}`,
      ...(plaque ? { 'aria-expanded': String(Boolean(node.expandedRoot)) } : {}),
    });
    // 選了馬太或路加線時，不在那條線上的一起淡出（小卡、膠囊也一樣）
    group.style.opacity = String(lineOpacity(lineFor(person)));
    if (capsule || node.chip) return renderCompact(node, person, group, capsule);
    group.style.opacity = String(lineOpacity(lineFor(person)));
    const top = -node.height / 2;
    const rect = svgEl('rect', { x: node.rectX, y: top, width: node.rectWidth, height: node.rectHeight, rx: plaque ? (person.kind === 'region' ? 14 : 3) : node.mainline ? 8 : 6 });
    const textX = node.rectX + node.rectWidth / 2;
    const primary = svgEl('text', { class: 'ag-node-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle', x: textX, y: top + 16 });
    primary.textContent = person.name;
    const secondary = svgEl('text', { class: 'ag-node-subtitle', 'text-anchor': 'middle', 'dominant-baseline': 'middle', x: textX, y: top + node.rectHeight - 8 });
    secondary.textContent = nodeSubtitle(person);
    const dot = svgEl('circle', { class: 'ag-node-dot', cx: 0, cy: 0, r: 3.2 });
    group.append(rect, dot, primary, secondary);
    if (wifeSlot) {
      const text = wifeSlot.spouse ? '妻子' : '生母';
      const badge = svgEl('g', { class: 'ag-wife-badge', transform: `translate(${node.rectX - 6} ${top - 3})` });
      badge.append(svgEl('rect', { x: 0, y: -8, width: 34, height: 16, rx: 3 }), (() => {
        const label = svgEl('text', { x: 17, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' }); label.textContent = text; return label;
      })());
      group.append(badge);
    }
    if (bornOf) {
      const mark = svgEl('text', { class: 'ag-born-of-mark', x: node.rectX + node.rectWidth - 9, y: top + 10, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      mark.textContent = '↗';
      const hint = svgEl('title', {});
      hint.textContent = onSpine ? `${person.name}在主線上，點了過去` : `${person.name}的人物卡在他娘家那一支，點了過去`;
      group.append(mark, hint);
    }
    if (person.marks?.length) {
      const label = person.marks.map((item) => item.label).filter(Boolean).join('／');
      const capsuleWidth = Math.min(node.rectWidth, Math.max(42, Array.from(label).length * 10 + 16));
      const capsuleY = top + node.rectHeight + 2;
      const capsule = svgEl('g', { class: 'ag-node-mark' });
      capsule.append(svgEl('rect', { x: -capsuleWidth / 2, y: capsuleY, width: capsuleWidth, height: 16, rx: 8 }));
      const mark = svgEl('text', { x: 0, y: capsuleY + 8, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      mark.textContent = label;
      capsule.append(mark);
      group.append(capsule);
    }
    if (node.collapsed) {
      const badge = svgEl('g', { class: 'ag-descendant-badge', transform: `translate(${node.rectX + node.rectWidth + 12} ${top + 12})` });
      badge.append(svgEl('circle', { r: 11 }), (() => {
        const count = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        count.textContent = `+${node.descendantCount ?? 0}`;
        return count;
      })());
      group.append(badge);
    }
    if (person.notes?.length) {
      const note = svgEl('g', { class: 'ag-node-note', transform: `translate(${node.rectX + node.rectWidth - 3} ${top + node.rectHeight - 2})`, tabindex: '0', role: 'button', 'aria-label': '查看經文差異說明' });
      note.append(svgEl('circle', { r: 10 }), (() => {
        const text = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }); text.textContent = '※'; return text;
      })());
      note.addEventListener('click', (event) => { event.stopPropagation(); onNote(person.notes![0]!); });
      group.append(note);
    }
    if (node.expandedRoot) {
      const collapse = svgEl('g', { class: 'ag-collapse-badge', transform: `translate(${node.rectX + node.rectWidth + 12} ${top + 12})`, tabindex: '0', role: 'button', 'aria-label': '收合旁支' });
      collapse.append(svgEl('circle', { r: 10 }), (() => {
        const label = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }); label.textContent = '−'; return label;
      })());
      const collapseTree = (event: Event) => {
        event.stopPropagation();
        expanded.delete(node.id);
        refresh(true);
        requestAnimationFrame(() => focusIds([node.id], true));
      };
      collapse.addEventListener('click', collapseTree);
      collapse.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); collapseTree(event); } });
      group.append(collapse);
    }
    if (traceIds.has(node.id)) group.classList.add('ag-trace-node');
    if (tourHighlightIds.has(node.id)) group.classList.add('ag-node-tour-lit');
    if (tourCurrentId === node.id) group.classList.add('ag-node-tour-current');
    if (selected === node.id) group.classList.add('ag-node-selected');
    group.addEventListener('click', (event) => {
      event.stopPropagation();
      if (didDrag) return;
      if (plaque) togglePlacement(node.id);
      else if (node.collapsed) {
        expanded.add(node.id);
        refresh(true);
        requestAnimationFrame(() => focusIds([person.id, ...(graph.children.get(person.id) ?? [])], true, READABLE_ZOOM));
      } else if (bornOf) jumpTo(bornOf);
      else onSelect(person);
    });
    group.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (plaque) togglePlacement(node.id); else if (bornOf) jumpTo(bornOf); else onSelect(person); }
    });
    return group;
  };

  // 夫妻、兄弟姊妹、親屬線：在靠近對方那一側才轉折，不要在兩人正中間往下走（會貼著分岔處的主線）
  // 上下疊著的小卡（亞米忽 → 達買 → 瑪迦、拔示巴下面的烏利亞）：直直往下；並排的（以連、亞米利）先往下再橫到正中間
  const stackPath = (a: LayoutNode, b: LayoutNode) => {
    const [upper, lower] = a.y < b.y ? [a, b] : [b, a];
    const startY = upper.y + upper.height / 2;
    const endY = lower.y - lower.height / 2;
    if (Math.abs(upper.x - lower.x) < 1) return `M${upper.x} ${startY} V${endY}`;
    const midY = (startY + endY) / 2;
    return `M${upper.x} ${startY} V${midY} H${lower.x} V${endY}`;
  };
  const kinPath = (a: LayoutNode, b: LayoutNode) => {
    const direction = Math.sign(b.x - a.x) || 1;
    const startX = a.x + direction * a.width / 2;
    const endX = b.x - direction * b.width / 2;
    if (Math.abs(b.y - a.y) < 1) return `M${startX} ${a.y} H${endX}`;
    const turnX = endX - direction * 46;
    return `M${startX} ${a.y} H${turnX} V${b.y} H${endX}`;
  };
  // 關係字放在靠近對方那一頭的轉角：同一個人連到好幾位（大衛的三位妻子）時，字各在各的高度，不會疊在一起
  // 字靠在被描述的那個人旁邊：母親線靠母親，妻子、妹子、後代靠那個人；兩人中間太窄就放在那人的上方角落
  const labelPoint = (kind: string, a: LayoutNode, b: LayoutNode, width: number) => {
    const direction = Math.sign(b.x - a.x) || 1;
    const startX = a.x + direction * a.rectWidth / 2;
    const endX = b.x - direction * b.rectWidth / 2;
    const near = kind === 'mother' ? a : b;
    const facing = near === a ? direction : -direction;
    const edgeX = near.x + facing * near.rectWidth / 2;
    if (Math.abs(b.x - a.x) < 1) return { x: a.x + width / 2 + 6, y: (a.y + b.y) / 2 };
    if ((endX - startX) * direction < width + 16) return { x: edgeX - facing * (width / 2 + 4), y: near.y - near.height / 2 - 11, above: near.id };
    return { x: edgeX + facing * (width / 2 + 6), y: near.y };
  };
  const edgePath = (a: LayoutNode, b: LayoutNode) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    if (Math.abs(dx) < 1) {
      const direction = Math.sign(dy || 1);
      const startY = a.y + direction * a.height / 2;
      const endY = b.y - direction * b.height / 2;
      return `M${a.x} ${startY} V${endY}`;
    }
    const direction = Math.sign(dx);
    const startX = a.x + direction * a.width / 2;
    const endX = b.x - direction * b.width / 2;
    // 轉折點從父母那頭量固定距離：同一位父母底下的孩子框寬不同（收著的有「+N」），也共用同一條直線
    const midX = b.busX !== undefined && !b.mainline && (b.busX - startX) * direction > 0 && (endX - b.busX) * direction > 0
      ? b.busX : startX + direction * Math.min(Math.abs(endX - startX) / 2, 24);
    if (endX * direction < startX * direction) return `M${a.x + direction * a.width / 2} ${a.y} L${b.x - direction * b.width / 2} ${b.y}`;
    return `M${startX} ${a.y} H${midX} V${b.y} H${endX}`;
  };

  // 家譜樹上的職位印：人物卡下方的小朱印（元帥、勇士、第三班）。平常讀經與否都畫，縮成總覽時不畫。
  // 位置避開別的卡片、連線、線上的關係字、名字上方的小標、妻子小標、收合鈕和備註鈕；先試卡片下方，放不下再換位置。
  function placeRoleSeals(tagRects: SealRect[], edgeSegs: SealSeg[]) {
    roleSealLayer.replaceChildren();
    roleSealEls = [];
    const grouped = new Map<string, RoleSeal[]>();
    for (const seal of data.roleSeals ?? []) {
      const list = grouped.get(seal.id) ?? [];
      if (!list.some((item) => item.label === seal.label)) list.push(seal);
      grouped.set(seal.id, list);
    }
    if (!grouped.size) return;
    const cards = allLayoutNodes().map((node) => ({ id: node.id, l: node.x + node.rectX, r: node.x + node.rectX + node.width, t: node.y - node.height / 2, b: node.y + node.height / 2 }));
    for (const [id, list] of grouped) {
      const node = nodeFor(id);
      const person = graph.byId.get(id);
      if (!node || !person) continue;
      const left = node.x + node.rectX;
      const right = left + node.rectWidth;
      const top = node.y - node.height / 2;
      const cardBottom = top + node.rectHeight;
      const group = roleSealRows(list.map((seal) => seal.label), node.rectWidth + 44);
      const below = cardBottom + (person.marks?.length ? 21 : 4);
      const own: SealRect[] = [];
      if (node.collapsed || node.expandedRoot) own.push({ l: right + 1, r: right + 23, t: top + 1, b: top + 23 });
      if (person.notes?.length) own.push({ l: right - 13, r: right + 7, t: cardBottom - 12, b: cardBottom + 8 });
      if (graph.wifeSlots.has(id)) own.push({ l: left - 6, r: left + 28, t: top - 11, b: top + 5 });
      const candidates = [
        { x: left, y: below },
        { x: right - group.width, y: below },
        { x: left - group.width - 4, y: top + 2 },
        { x: left, y: below + group.height + 3 },
        { x: right - group.width, y: below + group.height + 3 },
        { x: right + 5, y: cardBottom - group.height + 2 },
      ];
      const hits = (x: number, y: number) => {
        const rect: SealRect = { l: x, r: x + group.width, t: y, b: y + group.height };
        let count = 0;
        for (const card of cards) if (card.id !== id && sealRectsOverlap(rect, card, 2)) count += 1;
        for (const other of [...tagRects, ...own]) if (sealRectsOverlap(rect, other, 1)) count += 1;
        for (const segment of edgeSegs) if (segmentHitsRect(segment, rect, 1)) count += 1;
        return count;
      };
      let best = candidates[0]!;
      let bestHits = Infinity;
      for (const candidate of candidates) {
        const count = hits(candidate.x, candidate.y);
        if (count < bestHits) { best = candidate; bestHits = count; }
        if (count === 0) break;
      }
      list.forEach((seal, index) => {
        const item = group.items[index]!;
        const g = svgEl('g', {
          class: 'ag-ro-tseal', 'data-id': id, 'data-box': seal.box, role: 'button', tabindex: '0',
          transform: `translate(${best.x + item.x} ${best.y + item.y})`,
          'aria-label': `${person.name}，${seal.label}，到職位圖上看`,
        });
        g.append(svgEl('rect', { width: item.w, height: ROLE_SEAL_H, rx: 2.5 }));
        const text = svgEl('text', { x: item.w / 2, y: ROLE_SEAL_H / 2 + 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.textContent = seal.label;
        const hint = svgEl('title', {});
        hint.textContent = `${seal.label}　${seal.ref}`;
        g.append(text, hint);
        const open = () => roleSealListener?.(seal.box, id);
        // 按在印上不當成拖曳畫布，也不選取底下的人物
        g.addEventListener('pointerdown', (event) => event.stopPropagation());
        g.addEventListener('click', (event) => { event.stopPropagation(); open(); });
        g.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); open(); } });
        roleSealLayer.append(g);
        roleSealEls.push({ id, g });
      });
    }
  }

  function refresh(animate = false) {
    const previousLayout = layout;
    const previousNodeEls = nodeEls;
    const previousEdgeEls = edgeEls;
    const previousNodes = new Map([...previousLayout.nodes, ...previousLayout.groups].map((node) => [node.id, node]));
    cancelAnimationFrame(layoutAnimationFrame);
    layout = computeLayout(data, expanded);
    nodeEls = new Map();
    edgeEls = new Map();
    mainEdgeEls = new Map();
    edgeLayer.replaceChildren();
    nodeLayer.replaceChildren();
    labelLayer.replaceChildren();
    labelEls = new Map();
    frameLayer.replaceChildren();
    for (const frame of layout.regions) {
      const box = svgEl('g', { class: 'ag-region-frame', 'data-region': frame.id });
      box.append(svgEl('rect', { x: frame.x0, y: frame.y0, width: frame.x1 - frame.x0, height: frame.y1 - frame.y0, rx: 18 }));
      frameLayer.append(box);
    }
    buildOverview();
    const nodesById = new Map(allLayoutNodes().map((node) => [node.id, node]));
    // 關係字放在人名上方角落的人，「妻子：某某」標籤往上讓一行，不疊在一起
    const labelAbove = new Set<string>();
    // 職位印要避開的東西：線上的關係字、名字上方的小標、妻子小標、連線
    const tagRects: SealRect[] = [];
    const edgeSegs: SealSeg[] = [];
    for (const edge of layout.edges) {
      const a = nodesById.get(edge.from);
      const b = nodesById.get(edge.to);
      if (!a || !b) continue;
      const path = svgEl('path', {
        class: `ag-edge ag-edge-${edge.kind}${a.mainline && b.mainline ? ' ag-edge-main' : ''}${traceEdges.has(`${edge.from}>${edge.to}>${edge.kind}`) ? ' ag-edge-traced' : ''}${tourEdgeKeys.has(edge.key) ? ' ag-edge-tour-lit' : ''}`,
        d: a.chip || b.chip ? stackPath(a, b) : edge.kind === 'kin' ? kinPath(a, b) : edgePath(a, b), 'data-from': edge.from, 'data-to': edge.to,
        stroke: COLORS[edge.line] ?? COLORS.common,
        'stroke-width': tourEdgeKeys.has(edge.key) ? 4 : EDGE_WIDTH[edge.kind] ?? 1.7,
      });
      path.style.opacity = String(lineOpacity(edge.line));
      edgeLayer.append(path);
      edgeEls.set(edge.key, path);
      edgeSegs.push(...pathSegments(path.getAttribute('d') ?? ''));
      if (a.mainline && b.mainline) mainEdgeEls.set(edge.key, path);
      if (edge.label) {
        const width = Array.from(edge.label).length * 11 + 10;
        const at = labelPoint(edge.kind, a, b, width);
        if (at.above) labelAbove.add(at.above);
        tagRects.push({ l: at.x - width / 2, r: at.x + width / 2, t: at.y - 8, b: at.y + 8 });
        const tag = svgEl('g', { class: `ag-edge-label ag-edge-label-${edge.kind}`, transform: `translate(${at.x} ${at.y})` });
        tag.style.opacity = String(lineOpacity(edge.line));
        tag.append(svgEl('rect', { x: -width / 2, y: -8, width, height: 16, rx: 8 }));
        const text = svgEl('text', { x: 0, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.textContent = edge.label;
        tag.append(text);
        labelLayer.append(tag);
        labelEls.set(edge.key, tag);
      }
    }
    // 夫妻、母子分在大圖兩處（利百加在娘家拿鶴那一支）：不拉長線，在名字上方標「妻子：利百加」「母親：利亞」，
    // 一種關係一行往上疊；點名字打開那一支、跳過去並打開人物卡
    const farByNode = new Map<string, Map<string, string[]>>();
    for (const item of layout.farLinks) {
      if (!graph.byId.has(item.other)) continue;
      const byLabel = farByNode.get(item.id) ?? new Map<string, string[]>();
      byLabel.set(item.label, [...(byLabel.get(item.label) ?? []), item.other]);
      farByNode.set(item.id, byLabel);
    }
    for (const [id, byLabel] of farByNode) {
      const node = nodesById.get(id);
      if (!node) continue;
      const rows = [...byLabel].sort(([a], [b]) => (a === '母親' ? -1 : 0) - (b === '母親' ? -1 : 0));
      const skip = labelAbove.has(id) ? 1 : 0;
      rows.forEach(([label, others], index) => {
        const row = index + skip;
        const names = others.map((other) => graph.byId.get(other)!.name);
        const prefix = `${label}：`;
        const width = (Array.from(prefix).length + names.reduce((sum, name) => sum + Array.from(name).length + 1, -1)) * 11 + 14;
        const tagY = node.y - node.height / 2 - (graph.wifeSlots.has(id) ? 20 : 11) - row * 19;
        tagRects.push({ l: node.x - width / 2, r: node.x + width / 2, t: tagY - 8, b: tagY + 8 });
        const tag = svgEl('g', { class: 'ag-edge-label ag-far-link', transform: `translate(${node.x} ${tagY})` });
        tag.append(svgEl('rect', { x: -width / 2, y: -8, width, height: 16, rx: 8 }));
        const text = svgEl('text', { x: 0, y: 0.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        text.append(document.createTextNode(prefix));
        others.forEach((other, index) => {
          if (index) text.append(document.createTextNode('、'));
          const name = svgEl('tspan', { class: 'ag-far-link-name', role: 'link', tabindex: '0', 'aria-label': `${label}${names[index]}，跳過去看` });
          name.textContent = names[index]!;
          // 拖動畫布時從名字上放開不算點（和人物卡一樣）
          name.addEventListener('click', (event) => { event.stopPropagation(); if (!didDrag) jumpTo(other); });
          name.addEventListener('keydown', (event) => { if ((event as KeyboardEvent).key === 'Enter') { event.stopPropagation(); jumpTo(other); } });
          text.append(name);
        });
        tag.append(text);
        labelLayer.append(tag);
      });
    }    for (const node of allLayoutNodes()) {
      const rendered = renderNode(node);
      if (rendered) {
        nodeLayer.append(rendered);
        nodeEls.set(node.id, rendered);
      }
    }
    placeRoleSeals(tagRects, edgeSegs);
    // 動畫只聽頁面上的「動畫」開關，不跟作業系統的「減少動態」設定（使用者的決定）
    const shouldAnimate = animate && document.documentElement.dataset.motion !== 'off';
    if (shouldAnimate) {
      const oldIds = new Set(previousNodeEls.keys());
      for (const [id, oldNode] of previousNodeEls) {
        if (nodeEls.has(id)) continue;
        oldIds.delete(id);
        oldNode.classList.add('ag-node-leaving');
        oldNode.style.transition = 'opacity 250ms ease';
        oldNode.style.pointerEvents = 'none';
        nodeLayer.append(oldNode);
        requestAnimationFrame(() => { oldNode.style.opacity = '0'; });
        window.setTimeout(() => oldNode.remove(), 270);
      }
      for (const oldPath of previousEdgeEls.values()) {
        oldPath.classList.add('ag-edge-leaving');
        oldPath.style.transition = 'opacity 250ms ease';
        edgeLayer.insertBefore(oldPath, edgeLayer.firstChild);
        requestAnimationFrame(() => { oldPath.style.opacity = '0'; });
        window.setTimeout(() => oldPath.remove(), 270);
      }
      const startPositions = new Map<string, { x: number; y: number }>();
      for (const node of allLayoutNodes()) {
        const old = previousNodes.get(node.id);
        if (old) startPositions.set(node.id, { x: old.x, y: old.y });
        else if (node.sideRoot) {
          const root = previousNodes.get(node.sideRoot);
          // 從大圖上的上一層長出來（父親、牌子或區域）
          let upward = graph.treeParent.get(node.id);
          while (upward && !previousNodes.has(upward)) upward = graph.treeParent.get(upward);
          const parent = upward ? previousNodes.get(upward) : undefined;
          const origin = parent ?? root;
          if (origin) startPositions.set(node.id, { x: origin.x, y: origin.y });
        }
      }
      for (const node of allLayoutNodes()) {
        const start = startPositions.get(node.id);
        const element = nodeEls.get(node.id);
        if (start && element) element.setAttribute('transform', `translate(${start.x} ${start.y})`);
      }
      const start = performance.now();
      const duration = 250;
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = t * t * (3 - 2 * t);
        const currentNodes = new Map<string, LayoutNode>();
        for (const node of allLayoutNodes()) {
          const origin = startPositions.get(node.id) ?? node;
          const current = { ...node, x: origin.x + (node.x - origin.x) * eased, y: origin.y + (node.y - origin.y) * eased };
          currentNodes.set(node.id, current);
          nodeEls.get(node.id)?.setAttribute('transform', `translate(${current.x} ${current.y})`);
        }
        for (const edge of layout.edges) {
          const a = currentNodes.get(edge.from);
          const b = currentNodes.get(edge.to);
          const element = edgeEls.get(edge.key);
          if (a && b && element) element.setAttribute('d', a.chip || b.chip ? stackPath(a, b) : edge.kind === 'kin' ? kinPath(a, b) : edgePath(a, b));
        }
        if (t < 1) layoutAnimationFrame = requestAnimationFrame(tick);
        else cullToViewport();
      };
      layoutAnimationFrame = requestAnimationFrame(tick);
    }
    drawReading(false);
    cullToViewport();
    // 版面變動後如果畫面上一個節點都沒有（例如收合了正在看的那一組），回到主線，不要留一片空白
    if (!overviewMode && ![...nodeEls.values()].some((element) => element.style.display !== 'none')) fitSpine(animate);
  }

  const fitSpine = (animate = false, collapse = false) => {
    if (collapse && expanded.size) { expanded.clear(); refresh(false); }
    const main = layout.nodes.filter((node) => node.mainline);
    if (!main.length) return;
    const x0 = Math.min(...main.map((node) => node.x - node.width / 2));
    const x1 = Math.max(...main.map((node) => node.x + node.width / 2));
    const rect = svg.getBoundingClientRect();
    const baseZoom = 11 / 15 * getFontScale();
    const height = Math.max(1, rect.height) / baseZoom;
    const width = Math.max(1, rect.width) / baseZoom;
    const centerX = (x0 + x1) / 2;
    const centerY = currentBox.y + currentBox.height / 2;
    animateToBox({ x: centerX - width / 2, y: centerY - height / 2, width, height }, animate);
  };
  const focusIds = (ids: string[], animate = true, minZoom = READABLE_ZOOM, anchorId?: string) => {
    const nodes = ids.map(nodeFor).filter((node): node is LayoutNode => Boolean(node));
    if (!nodes.length) return;
    fitRect(Math.min(...nodes.map((node) => node.x - node.width / 2)), Math.min(...nodes.map((node) => node.y - node.height / 2)),
      Math.max(...nodes.map((node) => node.x + node.width / 2)), Math.max(...nodes.map((node) => node.y + node.height / 2)), animate, 180, true, minZoom,
      anchorId && nodeFor(anchorId) ? { y: nodeFor(anchorId)!.y, at: 0.8 } : undefined);
  };
  const focusTourIds = (ids: string[], avoid: HTMLElement | null, animate = true): Promise<boolean> => {
    const nodes = ids.map(nodeFor).filter((node): node is LayoutNode => Boolean(node));
    if (!nodes.length) return Promise.resolve(false);
    const bounds = {
      left: Math.min(...nodes.map((node) => node.x - node.width / 2)),
      right: Math.max(...nodes.map((node) => node.x + node.width / 2)),
      top: Math.min(...nodes.map((node) => node.y - node.height / 2)),
      bottom: Math.max(...nodes.map((node) => node.y + node.height / 2)),
    };
    const canvasRect = svg.getBoundingClientRect();
    const gap = 22;
    let areas = [{ left: canvasRect.left + 8, top: canvasRect.top + 8, right: canvasRect.right - 8, bottom: canvasRect.bottom - 8 }];
    const cover = avoid?.getBoundingClientRect();
    if (cover && cover.left < canvasRect.right && cover.right > canvasRect.left && cover.top < canvasRect.bottom && cover.bottom > canvasRect.top) {
      const candidates = [
        { left: canvasRect.left + 8, top: canvasRect.top + 8, right: canvasRect.right - 8, bottom: Math.min(canvasRect.bottom - 8, cover.top - gap) },
        { left: Math.max(canvasRect.left + 8, cover.right + gap), top: canvasRect.top + 8, right: canvasRect.right - 8, bottom: canvasRect.bottom - 8 },
        { left: canvasRect.left + 8, top: canvasRect.top + 8, right: Math.min(canvasRect.right - 8, cover.left - gap), bottom: canvasRect.bottom - 8 },
        { left: canvasRect.left + 8, top: Math.max(canvasRect.top + 8, cover.bottom + gap), right: canvasRect.right - 8, bottom: canvasRect.bottom - 8 },
      ].filter((area) => area.right - area.left > 100 && area.bottom - area.top > 100);
      if (candidates.length) areas = candidates;
    }
    const padding = 20;
    const maxLabelWidth = Math.max(...nodes.map((node) => {
      const person = graph.byId.get(node.id);
      return person ? [...person.name].reduce((sum, char) => sum + (char.codePointAt(0)! > 0x2e80 ? 13 : 7.5), 0) + 24 : 0;
    }));
    const requiredUnits = (area: typeof areas[number]) => Math.max(
      (bounds.right - bounds.left + padding * 2) / Math.max(1, area.right - area.left - maxLabelWidth),
      (bounds.bottom - bounds.top + padding * 2) / Math.max(1, area.bottom - area.top - 22),
    );
    const area = areas.reduce((best, candidate) => requiredUnits(candidate) < requiredUnits(best) ? candidate : best);
    // Tour labels stay at 13 screen pixels; 0.2x is the smallest permitted camera scale.
    const unitsPerPixel = Math.max(0.2, Math.min(5, requiredUnits(area)));
    const viewWidth = Math.max(1, canvasRect.width) * unitsPerPixel;
    const viewHeight = Math.max(1, canvasRect.height) * unitsPerPixel;
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;
    const areaCenterX = (area.left + area.right) / 2;
    const areaCenterY = (area.top + area.bottom) / 2;
    const target = {
      x: centerX - ((areaCenterX - canvasRect.left) / Math.max(1, canvasRect.width)) * viewWidth,
      y: centerY - ((areaCenterY - canvasRect.top) / Math.max(1, canvasRect.height)) * viewHeight,
      width: viewWidth,
      height: viewHeight,
    };
    let screenBounds = {
      left: canvasRect.left + ((bounds.left - target.x) / viewWidth) * canvasRect.width,
      right: canvasRect.left + ((bounds.right - target.x) / viewWidth) * canvasRect.width,
      top: canvasRect.top + ((bounds.top - target.y) / viewHeight) * canvasRect.height,
      bottom: canvasRect.top + ((bounds.bottom - target.y) / viewHeight) * canvasRect.height,
    };
    if (cover && cover.bottom >= canvasRect.bottom - 1 && cover.top > canvasRect.top) {
      const blockedBottoms = nodes.map((node) => {
        const left = canvasRect.left + ((node.x - node.width / 2 - target.x) / viewWidth) * canvasRect.width;
        const right = canvasRect.left + ((node.x + node.width / 2 - target.x) / viewWidth) * canvasRect.width;
        const top = canvasRect.top + ((node.y - node.height / 2 - target.y) / viewHeight) * canvasRect.height;
        return { left, right, top, bottom: top + (node.height / viewHeight) * canvasRect.height };
      }).filter((rect) => rect.left < cover.right && rect.right > cover.left && rect.top < cover.bottom && rect.bottom > cover.top);
      const shiftUp = Math.max(0, ...blockedBottoms.map((rect) => rect.bottom - (cover.top - gap)));
      if (shiftUp > 0) {
        target.y += shiftUp * unitsPerPixel;
        screenBounds = { ...screenBounds, top: screenBounds.top - shiftUp, bottom: screenBounds.bottom - shiftUp };
      }
    }
    const fitsVisibleArea = screenBounds.left >= area.left - 1 && screenBounds.right <= area.right + 1 &&
      screenBounds.top >= area.top - 1 && screenBounds.bottom <= area.bottom + 1;
    return animateToBox(target, animate).then(() => fitsVisibleArea);
  };

  const api: CanvasApi = {
    el: svg,
    focusTourIds,
    focusPerson(id, animate = true) {
      const node = nodeFor(id);
      if (!node) return;
      if (window.matchMedia('(max-width: 520px)').matches) {
        const rect = svg.getBoundingClientRect();
        const area = visibleArea();
        const height = Math.max(220, rect.height * 15 / 14);
        const width = height * Math.max(0.45, rect.width / Math.max(1, rect.height));
        // 人物放在人物卡上方還看得到的那一塊中間
        animateToBox({ x: node.x - width * (area.x0 + area.x1) / 2, y: node.y - height * (area.y0 + area.y1) / 2, width, height }, animate);
      } else focusIds([id], animate);
    },
    focusIds,
    fitSpine,
    fitAll(animate = true) {
      const bounds = layout.bounds;
      fitRect(bounds.x, bounds.y, bounds.x + bounds.width, bounds.y + bounds.height, animate, 130);
    },
    zoom(factor) {
      const x = currentBox.x + currentBox.width / 2;
      const y = currentBox.y + currentBox.height / 2;
      const ratio = clampRatio(1 / factor);
      setUserViewBox({ x: x - currentBox.width * ratio / 2, y: y - currentBox.height * ratio / 2, width: currentBox.width * ratio, height: currentBox.height * ratio });
    },
    select(id) { selected = id; refresh(); },
    setTourHighlights(ids, currentId, edges) {
      tourHighlightIds = new Set(ids);
      tourCurrentId = currentId;
      const adjacency = new Map<string, Array<{ id: string; key: string }>>();
      for (const edge of layout.edges) {
        adjacency.set(edge.from, [...(adjacency.get(edge.from) ?? []), { id: edge.to, key: edge.key }]);
        adjacency.set(edge.to, [...(adjacency.get(edge.to) ?? []), { id: edge.from, key: edge.key }]);
      }
      tourEdgeKeys = new Set();
      for (const [from, to] of edges) {
        const parents = new Map<string, { id: string; key: string } | null>([[from, null]]);
        const queue = [from];
        while (queue.length && !parents.has(to)) {
          const current = queue.shift()!;
          for (const next of adjacency.get(current) ?? []) {
            if (parents.has(next.id)) continue;
            parents.set(next.id, { id: current, key: next.key });
            queue.push(next.id);
          }
        }
        let current = to;
        while (parents.has(current) && current !== from) {
          const step = parents.get(current);
          if (!step) break;
          tourEdgeKeys.add(step.key);
          current = step.id;
        }
      }
      refresh();
    },
    clearTourHighlights() {
      tourHighlightIds.clear();
      tourCurrentId = null;
      tourEdgeKeys.clear();
      refresh();
    },
    setLine(line) { currentLine = line; refresh(); },
    setTrace(ids, edges) {
      traceIds = new Set(ids);
      traceEdges = new Set(edges.map((edge) => `${edge.from}>${edge.to}>${edge.kind}`));
      refresh();
    },
    expandFor(id) {
      openAncestors(id);
      refresh(true);
    },
    expandPath(ids) {
      for (const id of ids) openAncestors(id);
      refresh(true);
    },
    expandFamily(id) {
      // 新約家族：大圖上有那一家的牌子就打開牌子；整家都接到主線的，就打開每個人所在的位置
      const plaque = (data.placements?.nodes ?? []).find((node) => node.kind === 'family' && node.family === id);
      if (plaque) {
        openAncestors(plaque.id);
        expanded.add(plaque.id);
        refresh(true);
        focusIds([plaque.id, ...(graph.children.get(plaque.id) ?? [])], true);
        return;
      }
      const ntFamily = (data.ntFamilies ?? []).find((item) => item.id === id);
      if (ntFamily) {
        const members = (ntFamily.members ?? []).filter((member) => graph.byId.has(member));
        for (const member of members) openAncestors(member);
        refresh(true);
        focusIds(members, true);
        return;
      }
      const family = (data.families ?? []).find((item) => item.id === id);
      const targets = family?.roots ?? family?.members ?? (graph.byId.has(id) ? [id] : []);
      const directRoots = new Set(branchRoots(data, graph).map(({ rootId }) => rootId));
      const focus = new Set<string>();
      for (const target of targets) {
        focus.add(target);
        if (directRoots.has(target)) expanded.add(target);
        else {
          const children = branchRoots(data, graph).filter((item) => item.parentId === target);
          for (const child of children) { expanded.add(child.rootId); focus.add(child.rootId); }
          if (!children.length && graph.byId.has(target)) {
            let current = target;
            const visited = new Set<string>();
            while (!visited.has(current)) {
              visited.add(current);
              if (layout.nodes.some((node) => node.id === current && node.collapsed)) expanded.add(current);
              const parent = graph.byId.get(current)?.parents?.[0];
              if (!parent) break;
              current = parent.id;
            }
          }
        }
      }
      refresh(true);
      focusIds([...focus], true);
    },
    expandAll() {
      for (const node of data.placements?.nodes ?? []) expanded.add(node.id);
      const roots = branchRoots(data, graph);
      const counts = new Map<string, number>();
      for (const { parentId, rootId } of roots) {
        expanded.add(rootId);
        counts.set(parentId, (counts.get(parentId) ?? 0) + 1);
      }
      for (const [parentId, count] of counts) {
        if (count <= 3) continue;
        for (const direction of [-1, 1] as const) expanded.add(`siblings:${parentId}:${direction}`);
      }
      refresh(true);
    },
    layoutNow() { return layout; },
    setReading(on) {
      reading = on;
      if (on) ensureInkDefs(svg);
      if (!on) { marks = { lit: new Set(), trail: new Set(), current: null, seals: [], ink: [], fresh: new Set() }; stopCamera(); }
      drawReading(false);
    },
    setReadingMarks(next) {
      marks = next;
      drawReading(true);
    },
    flyTo,
    expandMany(ids) {
      const before = expanded.size;
      for (const id of ids) openAncestors(id, false);
      if (expanded.size !== before) refresh(true);
    },
    getExpanded() { return new Set(expanded); },
    setExpanded(ids) {
      expanded.clear();
      for (const id of ids) expanded.add(id);
      refresh(false);
    },
    onUserCamera(listener) { userCameraListener = listener; },
    onRoleSeal(listener) { roleSealListener = listener; },
  };

  svg.addEventListener('wheel', (event) => {
    event.preventDefault();
    stopCamera();
    userCameraListener?.();
    const focus = worldPoint(event.clientX, event.clientY);
    const factor = Math.max(0.72, Math.min(1.4, Math.exp(-event.deltaY * 0.0015)));
    const ratio = clampRatio(1 / factor);
    setUserViewBox({
      x: focus.x - (focus.x - currentBox.x) * ratio,
      y: focus.y - (focus.y - currentBox.y) * ratio,
      width: currentBox.width * ratio,
      height: currentBox.height * ratio,
    });
  }, { passive: false });
  svg.addEventListener('pointerdown', (event) => {
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      dragStart = { x: event.clientX, y: event.clientY };
      dragBox = { ...currentBox };
      didDrag = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      if (a && b) pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), box: { ...currentBox }, center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
    }
  });
  svg.addEventListener('pointermove', (event) => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size >= 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      if (!a || !b) return;
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = pinchStart.distance / Math.max(10, distance);
      const rect = svg.getBoundingClientRect();
      const focusX = pinchStart.box.x + ((pinchStart.center.x - rect.left) / Math.max(1, rect.width)) * pinchStart.box.width;
      const focusY = pinchStart.box.y + ((pinchStart.center.y - rect.top) / Math.max(1, rect.height)) * pinchStart.box.height;
      const width = Math.max(150, Math.min(pinchStart.box.width * scale, layout.bounds.width * 2));
      const height = pinchStart.box.height * width / pinchStart.box.width;
      const r = width / pinchStart.box.width;
      if (setUserViewBox({ x: focusX - (focusX - pinchStart.box.x) * r, y: focusY - (focusY - pinchStart.box.y) * r, width, height })) pinchStart = null;
      if (!didDrag) { stopCamera(); userCameraListener?.(); }
      didDrag = true;
      return;
    }
    if (dragStart && dragBox && pointers.size === 1) {
      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) { if (!didDrag) { stopCamera(); userCameraListener?.(); } didDrag = true; }
      if (!didDrag) return;
      const rect = svg.getBoundingClientRect();
      setViewBox({ x: dragBox.x - dx / Math.max(1, rect.width) * dragBox.width, y: dragBox.y - dy / Math.max(1, rect.height) * dragBox.height, width: dragBox.width, height: dragBox.height });
    }
  });
  const endPointer = (event: PointerEvent) => {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    if (!pointers.size) { dragStart = null; dragBox = null; window.setTimeout(() => { didDrag = false; }, 0); }
  };
  svg.addEventListener('pointerup', endPointer);
  svg.addEventListener('pointercancel', endPointer);
  svg.addEventListener('dblclick', () => fitSpine(true, true));
  svg.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') api.zoom(1.2);
    if (event.key === '-') api.zoom(0.84);
  });

  let lastFontScale = getFontScale();
  window.addEventListener(FONT_SCALE_EVENT, () => {
    const ratio = getFontScale() / lastFontScale;
    lastFontScale = getFontScale();
    refresh();
    const cx = currentBox.x + currentBox.width / 2;
    const cy = currentBox.y + currentBox.height / 2;
    const next = clampRatio(1 / ratio);
    setViewBox({ x: cx - currentBox.width * next / 2, y: cy - currentBox.height * next / 2, width: currentBox.width * next, height: currentBox.height * next });
  });
  refresh();
  requestAnimationFrame(() => fitSpine(false));
  const resize = new ResizeObserver(() => { if (!currentBox.width) fitSpine(false); });
  resize.observe(svg);
  return api;
}
