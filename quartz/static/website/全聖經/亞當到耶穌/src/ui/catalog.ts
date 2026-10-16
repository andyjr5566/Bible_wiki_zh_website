import type { ReadingData, StageId } from '../data/types';
import { h, svgEl } from './dom';
import { catalogGroups, type CatalogItem } from './entry-model';
import { STAGE_LABEL } from './reader-route';
import '../catalog.css';

/**
 * 目錄：讀經路線的全部段落，照分組一段一張小卡（標題、經文範圍、畫面、一句介紹）。
 * 點一段就從那一段的第一節開始帶你讀。
 */
export interface CatalogOptions {
  reading: ReadingData;
  /** 從這一節開始讀（例如「創4:17」） */
  onOpen(start: string): void;
}

const ICONS: Record<StageId, (svg: SVGElement) => void> = {
  // 家譜樹：一個人往下分成兩支
  tree: (svg) => svg.append(
    svgEl('rect', { x: 9, y: 3, width: 6, height: 4, rx: 1 }), svgEl('rect', { x: 3, y: 16, width: 6, height: 4, rx: 1 }), svgEl('rect', { x: 15, y: 16, width: 6, height: 4, rx: 1 }),
    svgEl('path', { d: 'M12 7v4M6 16v-5h12v5' })),
  // 職位圖：幾個方塊
  roles: (svg) => svg.append(
    svgEl('rect', { x: 3, y: 3, width: 8, height: 8, rx: 1.5 }), svgEl('rect', { x: 13, y: 3, width: 8, height: 8, rx: 1.5 }),
    svgEl('rect', { x: 3, y: 13, width: 8, height: 8, rx: 1.5 }), svgEl('rect', { x: 13, y: 13, width: 8, height: 8, rx: 1.5 })),
  // 名冊：一頁一行一行的名字
  roster: (svg) => svg.append(
    svgEl('rect', { x: 5, y: 3, width: 14, height: 18, rx: 2 }), svgEl('path', { d: 'M8 8h8M8 12h8M8 16h5' })),
  // 城牆：一圈牆，上頭一座門
  wall: (svg) => svg.append(
    svgEl('circle', { cx: 12, cy: 13, r: 8, 'stroke-dasharray': '3.4 2.2' }), svgEl('path', { d: 'M9.5 4.8V1.8h5v3' })),
};

export function stageIcon(stage: StageId): SVGElement {
  const svg = svgEl('svg', { class: `ag-ct-icon is-${stage}`, viewBox: '0 0 24 24', 'aria-hidden': 'true' });
  ICONS[stage](svg);
  return svg;
}

export function catalogCard(item: CatalogItem, onOpen: (start: string) => void): HTMLElement {
  const card = h('button', { className: `ag-ct-card is-${item.stage}`, type: 'button', 'aria-label': `${item.title}，${item.range}，從這裡開始讀` },
    h('span', { className: 'ag-ct-card-top' },
      h('span', { className: 'ag-ct-stage' }, stageIcon(item.stage), STAGE_LABEL[item.stage].view),
      h('span', { className: 'ag-ct-range' }, item.range)),
    h('strong', { className: 'ag-ct-title' }, item.title),
    item.intro ? h('span', { className: 'ag-ct-intro' }, item.intro) : null);
  card.addEventListener('click', () => onOpen(item.start));
  return card;
}

export function createCatalog(options: CatalogOptions): HTMLElement {
  const root = h('section', { className: 'ag-page ag-ct-page', 'aria-label': '目錄' },
    h('div', { className: 'ag-page-heading' },
      h('div', {}, h('p', { className: 'ag-eyebrow' }, '帶你讀經'), h('h1', {}, '目錄')),
      h('p', {}, '這個網站目前可以帶你一節一節讀的經文。挑一段，按一下就從那裡開始讀。')));
  for (const group of catalogGroups(options.reading)) {
    root.append(h('section', { className: 'ag-ct-group' },
      h('h2', { className: 'ag-ct-group-title' }, group.group),
      h('div', { className: 'ag-ct-grid' }, ...group.items.map((item) => catalogCard(item, options.onOpen)))));
  }
  return root;
}
