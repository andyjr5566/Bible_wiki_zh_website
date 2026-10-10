/**
 * 七七節的數算：說明框裡的 7×7 格子加最下面獨立一格「50」。
 * 格子隨 story.count（0–50）一格格以刻線填滿；每列末端標「安息日」，第 50 格標「新素祭」。
 * 純 DOM、aria-hidden；另給螢幕報讀器一句「第 n 日」。沒有場景也能用（只讀 story.count）。
 */
import { story } from '../story/state';
import { clamp, h } from './dom';
import { makeFold } from './fold';

export interface CountUI {
  controls(prompt: string): HTMLElement;
  /** 每幀呼叫：只更新有變的格子 */
  update(): void;
}

export function createCountUI(): CountUI {
  const cells: HTMLElement[] = [];
  const fills: number[] = [];
  const sabbaths: HTMLElement[] = [];
  const sabDone: boolean[] = [];
  let sr: HTMLElement | null = null;
  let lastDay = -1;

  function controls(prompt: string): HTMLElement {
    cells.length = 0;
    fills.length = 0;
    sabbaths.length = 0;
    const grid = h('div', { class: 'jf-count-grid', 'aria-hidden': 'true' });
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        const fill = h('i', { class: 'jf-cell-fill' });
        const cell = h('span', { class: 'jf-cell' }, fill);
        cells.push(fill);
        fills.push(NaN);
        grid.append(cell);
      }
      const sab = h('span', { class: 'jf-cell-label jf-cell-sab' }, '安息日');
      sabbaths.push(sab);
      sabDone[row] = false;
      grid.append(sab);
    }
    const fifty = h('span', { class: 'jf-cell jf-cell-50' }, h('i', { class: 'jf-cell-fill' }), h('b', null, '50'));
    cells.push(fifty.querySelector('i') as HTMLElement);
    fills.push(NaN);
    grid.append(fifty, h('span', { class: 'jf-cell-label jf-cell-new' }, '新素祭'));

    sr = h('p', { class: 'jf-sr' });
    lastDay = -1;
    update();
    return h('div', { class: 'jf-interact jf-count' },
      h('p', { class: 'jf-prompt' }, prompt),
      grid,
      sr,
      h('div', { class: 'jf-status-row' }, makeFold()));
  }

  function update() {
    if (!cells.length) return;
    const n = clamp(story.count, 0, 50);
    for (let i = 0; i < cells.length; i++) {
      const f = Math.round(clamp(n - i) * 50) / 50;
      if (f === fills[i]) continue;
      fills[i] = f;
      cells[i].style.setProperty('--f', String(f));
    }
    for (let r = 0; r < 7; r++) {
      const on = n >= (r + 1) * 7;
      if (on !== sabDone[r]) {
        sabDone[r] = on;
        sabbaths[r].classList.toggle('is-on', on);
      }
    }
    const day = Math.max(1, Math.ceil(n));
    if (sr && day !== lastDay) {
      lastDay = day;
      sr.textContent = `第 ${day} 日`;
    }
  }

  return { controls, update };
}
