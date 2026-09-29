import { SPOTS, type Spot } from '../data/inside';
import type { Engine } from '../three/engine';
import { factLine, voiceBlock } from './evidence';
import { fill, h, svg } from './dom';
import { ICONS } from './icons';

/**
 * 「走進方舟」的標示：在 3D 畫面上浮一個小標籤，點開看說明。
 * 走進船艙時只標目前這一層、夠近的東西；在船外看時標船身上的構造。
 */
export function mountSpots(layer: HTMLElement, engine: Engine) {
  const store = {
    get() { try { return localStorage.getItem('gen6:spots') !== 'off'; } catch { return true; } },
    set(v: boolean) { try { localStorage.setItem('gen6:spots', v ? 'on' : 'off'); } catch { /* 不保存也能用 */ } },
  };
  let on = store.get();
  const listeners: ((v: boolean) => void)[] = [];

  const markers = SPOTS.map((sp, i) => {
    const el = h('button', { class: 'spot', type: 'button', 'aria-label': `說明：${sp.title}`, tabindex: -1 },
      h('span', { class: 'spot-dot' }, String(i + 1)), h('span', { class: 'spot-name' }, sp.title));
    el.addEventListener('click', () => openCard(sp));
    layer.append(el);
    return { sp, el };
  });

  // ---------------------------------------------------------------- 說明卡
  const card = h('aside', { class: 'spotcard', role: 'dialog', 'aria-modal': 'false', hidden: true });
  document.body.append(card);
  let current: Spot | null = null;
  function openCard(sp: Spot) {
    current = sp;
    const close = h('button', { class: 'spotclose', type: 'button', 'aria-label': '關閉說明' }, svg(ICONS.x));
    close.addEventListener('click', closeCard);
    fill(card, [
      h('div', { class: 'spothead' }, h('h3', null, sp.title), close),
      h('p', { class: 'spottext' }, sp.text),
      h('ul', { class: 'facts' }, ...sp.facts.map((f) => h('li', { class: f.status === 'not_stated' ? 'unsaid' : '' }, factLine(f)))),
      sp.voices?.length ? h('div', { class: 'interp-layer' }, ...sp.voices.map(voiceBlock)) : null,
      sp.shown ? h('p', { class: 'shown' }, sp.shown) : null,
    ]);
    card.setAttribute('aria-label', sp.title);
    card.hidden = false;
    requestAnimationFrame(() => card.classList.add('open'));
    markers.forEach((m) => m.el.classList.toggle('active', m.sp === sp));
    close.focus({ preventScroll: true });
  }
  function closeCard() {
    current = null;
    card.classList.remove('open');
    markers.forEach((m) => m.el.classList.remove('active'));
    setTimeout(() => { if (!current) card.hidden = true; }, 250);
  }
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && current) closeCard();
    const t = e.target as HTMLElement;
    if ((e.key === 'l' || e.key === 'L') && document.body.classList.contains('exploring') && !t.closest('input, textarea')) api.set(!on);
  });

  // ---------------------------------------------------------------- 每格：投影、決定顯示哪些
  function tick() {
    requestAnimationFrame(tick);
    const exploring = document.body.classList.contains('exploring');
    layer.classList.toggle('spots-on', exploring && on);
    if (!exploring || !on) {
      if (current && !exploring) closeCard();
      return;
    }
    const walking = engine.walking;
    const deck = engine.deck;
    layer.classList.toggle('spots-out', !walking);
    const W = layer.clientWidth;
    for (const m of markers) {
      const want = walking ? m.sp.deck === deck : m.sp.deck === 'out';
      const p = want ? engine.project(m.sp.at) : null;
      const maxD = walking ? 38 : 260;
      const vis = !!p && p.front && p.dist < maxD && p.x > -70 && p.x < W + 70;
      m.el.classList.toggle('vis', vis);
      m.el.tabIndex = vis ? 0 : -1;
      if (!vis || !p) continue;
      const near = walking ? Math.max(0.82, 1 - p.dist / (maxD * 1.6)) : 1;
      // 標籤快出畫面時貼齊邊緣，手機上才不會被切掉
      const hw = m.el.offsetWidth / 2 * near;
      const x = Math.min(Math.max(p.x, hw + 6), W - hw - 6);
      m.el.style.transform = `translate(${x}px, ${p.y}px) translate(-50%, -100%) scale(${near.toFixed(3)})`;
      m.el.style.zIndex = String(1000 - Math.round(p.dist));
      m.el.classList.toggle('far', walking && p.dist > 22);
    }
  }
  requestAnimationFrame(tick);

  const api = {
    get on() { return on; },
    set(v: boolean) {
      on = v;
      store.set(v);
      if (!v) closeCard();
      listeners.forEach((f) => f(v));
    },
    onChange(f: (v: boolean) => void) { listeners.push(f); },
  };
  return api;
}
