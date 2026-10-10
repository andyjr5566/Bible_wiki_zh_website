/**
 * 搖禾捆的介面層（照塗血的模式）：
 * - 透明觸控層只攔 scene.interactiveRects() 的第一個矩形（禾捆把手），pointer 事件轉發給 canvas。
 * - 圓形徽章「按住搖動」貼在把手旁；搖過一下就收起來。
 * - 說明框裡：提示、「搖一搖」按鈕（呼叫 scene.waveAction()）、一行狀態。
 * - 沒有 WebGL 時按鈕照樣能用：直接改 story.wave，並自己送出 wave-swing／wave-done 給音效。
 */
import type { SceneEvent, SceneHandle } from '../scene/api';
import { story } from '../story/state';
import { SITE } from '../data/site';
import { h } from './dom';
import { makeFold } from './fold';
import { placeBadge } from './place';

const SWINGS = 3;

export interface WaveUI {
  controls(prompt: string): HTMLElement;
  setScene(scene: SceneHandle | null): void;
  /** 目前所在的拍改變時呼叫：沒有場景時，捲過去沒做就補完 */
  sync(index: number): void;
  update(active: boolean, avoid?: readonly DOMRect[]): DOMRect[] | null;
}

export function createWaveUI(canvas: HTMLCanvasElement, host: HTMLElement, emit: (e: SceneEvent) => void): WaveUI {
  const waveIndex = SITE.chapters.flatMap((c) => c.beats).findIndex((b) => b.interaction === 'wave');
  let scene: SceneHandle | null = null;
  let dragging = 0;
  let lastSig = '';
  const statuses: HTMLElement[] = [];

  const layer = h('div', { class: 'jf-touch-layer', 'aria-hidden': 'true' });
  const badge = h('div', { class: 'jf-badge', 'aria-hidden': 'true' }, h('span', null, '按住'), h('span', null, '搖動'));
  host.append(layer, badge);

  const drag = h('div', { class: 'jf-touch jf-touch-drag' });
  layer.append(drag);
  const forward = (e: PointerEvent) => {
    canvas.dispatchEvent(new PointerEvent(e.type, e));
  };
  drag.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    try {
      drag.setPointerCapture(e.pointerId);
    } catch {
      /* 沒有 capture 也照常轉發 */
    }
    dragging++;
    drag.classList.add('is-down');
    forward(e);
  });
  drag.addEventListener('pointermove', (e) => {
    if (drag.hasPointerCapture?.(e.pointerId)) forward(e);
  });
  const end = (e: PointerEvent) => {
    if (drag.classList.contains('is-down')) {
      drag.classList.remove('is-down');
      dragging = Math.max(0, dragging - 1);
      forward(e);
    }
  };
  drag.addEventListener('pointerup', end);
  drag.addEventListener('pointercancel', end);
  let lastBox = [NaN, NaN, NaN, NaN];

  function refreshStatus() {
    const w = story.wave;
    const sig = `${w.swings}|${w.done}`;
    if (sig === lastSig) return;
    lastSig = sig;
    const text = w.done ? '搖好了' : `搖了 ${w.swings} 下`;
    for (const s of statuses) s.textContent = text;
  }

  /** 沒有場景時的替代：與場景裡搖一下相同的狀態變化與事件 */
  function swingWithoutScene() {
    const w = story.wave;
    if (w.done) return;
    w.swings++;
    emit({ type: 'wave-swing' });
    if (w.swings >= SWINGS) {
      w.done = true;
      emit({ type: 'wave-done', auto: false });
    }
    refreshStatus();
  }

  function controls(prompt: string): HTMLElement {
    const status = h('p', { class: 'jf-wave-status', role: 'status', 'aria-live': 'polite' });
    statuses.push(status);
    const btn = h('button', { type: 'button', class: 'jf-key-btn jf-wave-btn' }, '搖一搖');
    btn.addEventListener('click', () => {
      if (scene) scene.waveAction();
      else swingWithoutScene();
    });
    lastSig = '';
    refreshStatus();
    return h('div', { class: 'jf-interact jf-wave' },
      h('p', { class: 'jf-prompt' }, prompt),
      h('div', { class: 'jf-keys jf-keys-one', role: 'group', 'aria-label': '不用拖曳，也可以用按鈕操作' }, btn),
      h('div', { class: 'jf-status-row' }, status, makeFold()));
  }

  function sync(index: number) {
    if (scene || waveIndex < 0 || index <= waveIndex) return;
    const w = story.wave;
    if (w.done) return;
    w.done = true;
    w.auto = true;
    w.swings = Math.max(w.swings, SWINGS);
    emit({ type: 'wave-done', auto: true });
    refreshStatus();
  }

  function update(active: boolean, avoid: readonly DOMRect[] = []): DOMRect[] | null {
    const on = active && !!scene;
    layer.classList.toggle('is-on', on);
    if (active) refreshStatus();
    if (!on) {
      badge.classList.remove('is-on');
      return null;
    }
    const rects = scene!.interactiveRects();
    const r = rects[0];
    if (!r || r.width <= 0 || r.height <= 0) {
      drag.style.display = 'none';
      lastBox[0] = NaN;
      badge.classList.remove('is-on');
      return rects;
    }
    // 觸控目標至少 48px
    const padX = Math.max(0, (48 - r.width) / 2);
    const padY = Math.max(0, (48 - r.height) / 2);
    const x = r.left - padX;
    const y = r.top - padY;
    const w = r.width + padX * 2;
    const hgt = r.height + padY * 2;
    if (lastBox[0] !== x || lastBox[1] !== y || lastBox[2] !== w || lastBox[3] !== hgt) {
      drag.style.display = 'block';
      drag.style.width = `${w}px`;
      drag.style.height = `${hgt}px`;
      drag.style.transform = `translate(${x}px, ${y}px)`;
      lastBox = [x, y, w, hgt];
    }
    const showBadge = dragging === 0 && story.wave.swings === 0 && !story.wave.done;
    badge.classList.toggle('is-on', showBadge);
    if (showBadge) placeBadge(badge, r, avoid);
    return rects;
  }

  return {
    controls,
    setScene(s) {
      scene = s;
    },
    sync,
    update,
  };
}
