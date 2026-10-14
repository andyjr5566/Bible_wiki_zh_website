import type { GenealogyData, TourStop } from '../data/types';
import type { CanvasApi } from './canvas';
import { button, h, linkButton } from './dom';

export interface TourController {
  el: HTMLElement;
  start(): void;
  stop(fit?: boolean): void;
  showIntro(): void;
}

export function createTour(data: GenealogyData, canvas: CanvasApi, onVerse: (ref: string) => void): TourController {
  const layer = h('div', { className: 'ag-tour-layer' });
  const stops = data.tour ?? [];
  let at = 0;
  let active = false;
  let highlightRun = 0;
  const settings = {
    get() { try { return localStorage.getItem('adam-jesus:intro-seen'); } catch { return null; } },
    set() { try { localStorage.setItem('adam-jesus:intro-seen', '1'); } catch { /* 私密模式下不保存導覽狀態 */ } },
  };

  const hide = () => layer.replaceChildren();
  const refsOf = (stop: TourStop) => Array.isArray(stop.refs) ? stop.refs : stop.refs ? [stop.refs] : [];
  const pairsFor = (ids: string[]) => ids.slice(1).map((id, index): [string, string] => [ids[index]!, id]);
  const revealStop = async (run: number, station: TourStop, ids: string[], card: HTMLElement) => {
    const fits = await canvas.focusTourIds(ids, card, true);
    if (!active || run !== highlightRun) return;
    card.dataset.sequenceFits = String(fits);
    const sequence = station.sequence?.length ? station.sequence : null;
    if (!sequence || document.documentElement.dataset.motion === 'off') {
      canvas.setTourHighlights(ids, null, pairsFor(ids));
      return;
    }
    const lit: string[] = [];
    const edges: Array<[string, string]> = [];
    const delay = sequence.length > 10 ? 300 : 450;
    for (let index = 0; index < sequence.length; index += 1) {
      if (!active || run !== highlightRun) return;
      if (document.documentElement.dataset.motion === 'off') {
        canvas.setTourHighlights(sequence, null, pairsFor(sequence));
        return;
      }
      const id = sequence[index]!;
      lit.push(id);
      if (index) edges.push([sequence[index - 1]!, id]);
      canvas.setTourHighlights(lit, id, edges);
      if (index < sequence.length - 1) await new Promise((resolve) => window.setTimeout(resolve, delay));
    }
  };
  const showStop = () => {
    if (!active || !stops.length) { stop(true); return; }
    const run = ++highlightRun;
    canvas.clearTourHighlights();
    const station = stops[at]!;
    canvas.setTrace([], []);
    const focus = station.sequence?.length ? station.sequence : station.focus;
    const card = h('section', { className: 'ag-tour-card', 'aria-live': 'polite' },
      h('div', { className: 'ag-tour-progress' }, `${String(at + 1).padStart(2, '0')}／${String(stops.length).padStart(2, '0')}`),
      h('h2', {}, station.title),
      h('p', {}, station.text),
      h('div', { className: 'ag-chip-list ag-tour-refs' }, ...refsOf(station).map((ref) => linkButton(ref, () => onVerse(ref)))),
      h('div', { className: 'ag-tour-actions' },
        button('上一站', () => { at = Math.max(0, at - 1); showStop(); }, 'ag-quiet-button'),
        button(at === stops.length - 1 ? '完成' : '下一站', () => {
          if (at >= stops.length - 1) stop(true);
          else { at += 1; showStop(); }
        }, 'ag-primary-button'),
        button('跳過', () => stop(true), 'ag-text-button')));
    layer.replaceChildren(card);
    void revealStop(run, station, focus, card);
  };
  const start = () => {
    settings.set();
    if (!stops.length) { stop(true); return; }
    active = true;
    at = 0;
    showStop();
  };
  const stop = (fit = false) => {
    active = false;
    highlightRun += 1;
    canvas.clearTourHighlights();
    canvas.setTrace([], []);
    hide();
    if (fit) canvas.fitSpine(true);
  };
  const showIntro = () => {
    const dialog = h('section', { className: 'ag-intro-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ag-intro-title' },
      h('p', { className: 'ag-eyebrow' }, '先看懂這張圖'),
      h('h2', { id: 'ag-intro-title' }, '從一個名字，看見一條家譜'),
      h('p', {}, '這張畫布把不同經文中的家譜放在同一條可探索的路線上。'),
      h('p', {}, '墨色標出共同主線，琥珀與青綠分別標出馬太和路加的記載。'),
      h('p', {}, '搜尋名字（各種經文寫法都可以），也可以直接點人物，查看關係和經文全文。'),
      h('div', { className: 'ag-intro-actions' },
        button('開始導覽', start, 'ag-primary-button'),
        button('直接看樹', () => { settings.set(); stop(false); canvas.fitSpine(false); }, 'ag-quiet-button')));
    layer.replaceChildren(h('div', { className: 'ag-dialog-scrim' }, dialog));
  };
  const hasDeepLink = /^#(?:p|family)=/.test(location.hash);
  if (hasDeepLink) hide();
  else if (settings.get() === '1') window.setTimeout(start, 60);
  else showIntro();
  return { el: layer, start, stop, showIntro };
}
