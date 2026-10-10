/**
 * 標題列（站名＋「怎麼讀」＋聲音開關）、往下捲提示。
 * 聲音開關：桌機在右下角，手機移到標題列（右下角會壓到貼底的說明框）。
 */
import { SITE } from '../data/site';
import type { AudioController } from '../audio/audio';
import { h, s } from './dom';
import { readMotion, setMotion } from './motion';

function eqIcon(): SVGElement {
  const bar = (x: number, i: number) => s('rect', { x, y: 2, width: 3, height: 16, rx: 1.5, class: `jf-eq-bar jf-eq-${i}` });
  return s('svg', { class: 'jf-eq', viewBox: '0 0 22 20', width: 22, height: 20, 'aria-hidden': 'true', focusable: 'false' },
    bar(2, 1), bar(7.5, 2), bar(13, 3), bar(18.5, 4));
}

/** 開：一條小波浪；關：一條直線 */
function motionIcon(): SVGElement {
  return s('svg', { class: 'jf-wv', viewBox: '0 0 26 14', width: 26, height: 14, 'aria-hidden': 'true', focusable: 'false' },
    s('path', { class: 'jf-wv-on', d: 'M1.5 7 C5 -0.5 8.5 -0.5 13 7 S21 14.5 24.5 7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' }),
    s('path', { class: 'jf-wv-off', d: 'M1.5 7 H24.5', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round' }));
}

export function createChrome(host: HTMLElement, audio: AudioController, openCoach: () => void): void {
  // 聲音預設開（使用者決定）；讀者關掉過就記住（localStorage jf-sound）。
  // 瀏覽器不准網頁自己出聲，所以「開」的狀態先掛著，等讀者第一次點擊、觸控或按鍵才真正開始播。
  const pref = readSound();
  let pending = pref;
  const sound = h('button', { type: 'button', class: 'jf-btn jf-sound', 'aria-pressed': pref ? 'true' : 'false' }, eqIcon(), h('span', null, '聲音'));
  sound.addEventListener('click', () => {
    // 還沒開始播時按聲音鈕：讀者多半是「怎麼沒聲音」，直接開始播
    if (pending) {
      pending = false;
      audio.setEnabled(true);
      return;
    }
    audio.setEnabled(!audio.enabled);
  });
  audio.onChange((on) => {
    sound.setAttribute('aria-pressed', on ? 'true' : 'false');
    writeSound(on);
  });
  if (pending) {
    const events = ['pointerup', 'mousedown', 'touchend', 'keydown'] as const;
    const start = (e: Event) => {
      if (!pending) return;
      // 聲音鈕自己的點擊交給上面的 click 處理
      if (e.target instanceof Node && sound.contains(e.target)) return;
      const act = (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation;
      if (act && !act.isActive) return;
      pending = false;
      for (const t of events) window.removeEventListener(t, start, true);
      audio.setEnabled(true);
    };
    for (const t of events) window.addEventListener(t, start, true);
  }

  const motion = h('button', { type: 'button', class: 'jf-btn jf-motion', 'aria-pressed': readMotion() ? 'true' : 'false', title: '動態' }, motionIcon(), h('span', { class: 'jf-motion-label' }, '動態'));
  motion.addEventListener('click', () => {
    const on = motion.getAttribute('aria-pressed') !== 'true';
    motion.setAttribute('aria-pressed', on ? 'true' : 'false');
    setMotion(on);
  });

  const help = h('button', { type: 'button', class: 'jf-btn jf-help', onclick: openCoach }, '怎麼讀');

  host.append(
    // 手機：捲到章末、頁尾（紙色底的文字）時，頂部的標題列與月份導覽墊一層紙色，才不會壓在文字上
    h('div', { class: 'jf-topbg', 'aria-hidden': 'true' }),
    h('header', { class: 'jf-top' },
      h('p', { class: 'jf-brand' }, SITE.title),
      h('div', { class: 'jf-bar' }, sound, motion, help)),
    h('p', { class: 'jf-scrollcue', 'aria-hidden': 'true' },
      h('span', null, '往下捲'),
      s('svg', { viewBox: '0 0 16 22', width: 16, height: 22, 'aria-hidden': 'true' },
        s('path', { d: 'M8 2 v16 M2 12 l6 7 l6 -7', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }))),
  );
}

function readSound(): boolean {
  try {
    return localStorage.getItem('jf-sound') !== 'off';
  } catch {
    return true;
  }
}

function writeSound(on: boolean): void {
  try {
    localStorage.setItem('jf-sound', on ? 'on' : 'off');
  } catch {
    /* 私密視窗等：不記也沒關係 */
  }
}
