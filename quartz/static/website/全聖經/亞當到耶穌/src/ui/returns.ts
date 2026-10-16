import type { ReadingData, RosterData, WallData } from '../data/types';
import { h, svgEl } from './dom';
import { returnCards, type CatalogItem } from './entry-model';
import { miniLayout } from './roster-model';
import { STAGE_LABEL } from './reader-route';
import { stageIcon } from './catalog';
import { MINI_SHAPE, allocateRing, ringPath, ringPoint } from './wall-model';
import '../returns.css';

/**
 * 歸回的名單：拉 2、拉 8、拉 10、尼 3、尼 7、尼 10 六張卡，每張有名冊（或城牆）的縮影。
 * 縮影用到的資料等分頁第一次打開才載入。點卡片就從那一份開始帶你讀。
 */
export interface ReturnsOptions {
  reading: ReadingData;
  loadRoster(): Promise<RosterData>;
  loadWall(): Promise<WallData>;
  /** 從這一節開始讀 */
  onOpen(start: string): void;
}

export interface ReturnsView {
  el: HTMLElement;
  /** 分頁顯示時呼叫：這時才載入縮影的資料 */
  showPage(): void;
}

function rosterThumb(data: RosterData, segment: string): SVGElement | null {
  const roster = data.rosters.find((item) => item.segment === segment);
  if (!roster) return null;
  const svg = svgEl('svg', { class: 'ag-rt-thumb-svg is-roster', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
  svg.append(svgEl('rect', { class: 'ag-rt-sheet', x: 0.04, y: 0.02, width: 0.92, height: 0.96, rx: 0.02 }));
  for (const line of miniLayout(roster).lines) {
    svg.append(svgEl('path', { class: `ag-rt-line is-${line.kind}`, d: `M${line.x1.toFixed(3)} ${line.y.toFixed(3)}H${line.x2.toFixed(3)}` }));
  }
  return svg;
}

function wallThumb(data: WallData): SVGElement {
  const svg = svgEl('svg', { class: 'ag-rt-thumb-svg is-wall', viewBox: '0 0 1 1', 'aria-hidden': 'true' });
  svg.append(svgEl('path', { class: 'ag-rt-ring', d: ringPath(MINI_SHAPE, 90) }));
  const slots = allocateRing(data.ring, 0.032);
  data.ring.forEach((item, i) => {
    const slot = slots[i];
    if (!slot) return;
    if (item.kind === 'part') {
      const steps = 6;
      const pts = Array.from({ length: steps + 1 }, (_, k) => ringPoint(MINI_SHAPE, slot.t0 + ((slot.t1 - slot.t0) * k) / steps));
      svg.append(svgEl('path', { class: 'ag-rt-part', d: `M${pts.map((p) => `${p.x.toFixed(3)} ${p.y.toFixed(3)}`).join('L')}` }));
      return;
    }
    if (item.back && i === data.ring.length - 1) return;
    const p = ringPoint(MINI_SHAPE, slot.tc);
    svg.append(svgEl('circle', { class: `ag-rt-mark is-${item.kind}`, cx: p.x.toFixed(3), cy: p.y.toFixed(3), r: item.kind === 'gate' ? 0.026 : 0.018 }));
  });
  return svg;
}

export function createReturns(options: ReturnsOptions): ReturnsView {
  const root = h('section', { className: 'ag-page ag-rt-page', 'aria-label': '歸回的名單' },
    h('div', { className: 'ag-page-heading' },
      h('div', {}, h('p', { className: 'ag-eyebrow' }, '帶你讀經'), h('h1', {}, '歸回的名單')),
      h('p', {}, '被擄的人回到耶路撒冷以後留下的六份名單。挑一份，按一下就從那裡開始讀。')));
  const grid = h('div', { className: 'ag-rt-grid' });
  const thumbs = new Map<string, HTMLElement>();
  const cards = returnCards(options.reading);
  for (const item of cards) grid.append(card(item));
  root.append(grid);

  function card(item: CatalogItem): HTMLElement {
    const thumb = h('span', { className: `ag-rt-thumb is-${item.stage}`, 'aria-hidden': 'true' });
    thumbs.set(item.id, thumb);
    const el = h('button', { className: `ag-rt-card is-${item.stage}`, type: 'button', 'aria-label': `${item.title}，${item.range}，從這裡開始讀` },
      thumb,
      h('span', { className: 'ag-rt-body' },
        h('span', { className: 'ag-rt-top' },
          h('span', { className: 'ag-rt-stage' }, stageIcon(item.stage), STAGE_LABEL[item.stage].view),
          h('span', { className: 'ag-rt-range' }, item.range)),
        h('strong', { className: 'ag-rt-title' }, item.title),
        item.intro ? h('span', { className: 'ag-rt-intro' }, item.intro) : null,
        h('span', { className: 'ag-rt-go' }, '從這裡讀')));
    el.addEventListener('click', () => options.onOpen(item.start));
    return el;
  }

  let loading: Promise<void> | null = null;
  function fill() {
    loading ??= Promise.all([options.loadRoster(), options.loadWall()]).then(([rosters, wall]) => {
      for (const item of cards) {
        const target = thumbs.get(item.id);
        const svg = item.stage === 'wall' ? wallThumb(wall) : rosterThumb(rosters, item.id);
        if (target && svg) target.replaceChildren(svg);
      }
    }).catch(() => { loading = null; });
    return loading;
  }
  return { el: root, showPage() { void fill(); } };
}
