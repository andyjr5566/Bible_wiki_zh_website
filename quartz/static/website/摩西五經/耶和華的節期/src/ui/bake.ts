/**
 * 烤無酵餅的介面層：圓形大按鈕「按住烤餅」。
 * - 滑鼠、觸控按住，或鍵盤按住空白鍵／Enter 都算；放開就停。
 * - story.bake.progress 每秒 +0.5（dt 夾在 0–0.1），滿了設 done。
 * - 讀者捲過這一拍還沒做：auto = true、progress = 1、done = true（sync）。
 * - 迴圈只在按住時跑；pointerdown／keydown 會叫醒它。
 * 沒有 WebGL 時也能用（只改 story 狀態）。
 */
import { SITE } from '../data/site';
import { story } from '../story/state';
import { clamp, h } from './dom';
import { makeFold } from './fold';

const RATE = 0.5; // 每秒

export interface BakeUI {
  controls(prompt: string): HTMLElement;
  /** 目前所在的拍（整份故事裡的序號）改變時呼叫：捲過去沒做就補完 */
  sync(index: number): void;
}

export function createBakeUI(): BakeUI {
  const bakeIndex = SITE.chapters.flatMap((c) => c.beats).findIndex((b) => b.interaction === 'bake');
  const held = new Set<string>();
  let raf = 0;
  let last = 0;
  let btn: HTMLButtonElement | null = null;
  let status: HTMLElement | null = null;
  let lastSig = '';

  function render() {
    const b = story.bake;
    const sig = `${Math.round(b.progress * 200)}|${b.done}|${b.auto}|${held.size > 0}`;
    if (sig === lastSig) return;
    lastSig = sig;
    if (btn) {
      btn.style.setProperty('--p', b.progress.toFixed(3));
      btn.classList.toggle('is-held', held.size > 0 && !b.done);
      btn.classList.toggle('is-done', b.done);
      btn.setAttribute('aria-disabled', b.done ? 'true' : 'false');
    }
    if (status) status.textContent = b.done ? (b.auto ? '已替你烤好' : '烤好了') : '麵團還是生的';
  }

  function step(now: number) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const b = story.bake;
    if (held.size && !b.done) {
      b.progress = clamp(b.progress + RATE * dt);
      if (b.progress >= 1) {
        b.progress = 1;
        b.done = true;
        held.clear();
      }
      render();
      if (!b.done) raf = requestAnimationFrame(step);
    } else render();
  }

  function press(src: string) {
    if (story.bake.done) return;
    held.add(src);
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
    render();
  }
  function release(src: string) {
    if (!held.delete(src)) return;
    render();
  }

  function controls(prompt: string): HTMLElement {
    const button = h('button', { type: 'button', class: 'jf-bake-btn', 'aria-describedby': 'jf-bake-prompt' },
      h('span', { class: 'jf-bake-label' }, '按住烤餅'));
    btn = button;
    button.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try {
        button.setPointerCapture(e.pointerId);
      } catch {
        /* 沒有 capture 也照常 */
      }
      press(`p${e.pointerId}`);
    });
    const up = (e: PointerEvent) => release(`p${e.pointerId}`);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    button.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) press('key');
    });
    button.addEventListener('keyup', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      release('key');
    });
    button.addEventListener('blur', () => release('key'));

    status = h('p', { class: 'jf-bake-status', role: 'status', 'aria-live': 'polite' });
    lastSig = '';
    render();
    return h('div', { class: 'jf-interact jf-bake' },
      h('div', { class: 'jf-bake-row' },
        button,
        h('div', { class: 'jf-bake-side' },
          h('p', { class: 'jf-prompt', id: 'jf-bake-prompt' }, prompt),
          h('div', { class: 'jf-status-row' }, status, makeFold()))));
  }

  function sync(index: number) {
    if (bakeIndex < 0 || index <= bakeIndex) return;
    const b = story.bake;
    if (b.done) return;
    held.clear();
    b.progress = 1;
    b.done = true;
    b.auto = true;
    render();
  }

  return { controls, sync };
}
