import { h, fill, type Child } from './dom';

/**
 * 原地小卡：點經文片語、條目、術語時就在旁邊打開，不捲動頁面、不換頁。
 * 手機上改成貼底的卡片（固定高度、內部捲動），不會把正在讀的內容推走。
 */
let card: HTMLDivElement | null = null;
let anchorEl: HTMLElement | null = null;

function ensure(): HTMLDivElement {
  if (card) return card;
  card = h('div', { class: 'lm-peek', role: 'dialog', 'aria-modal': 'false', hidden: true });
  document.body.append(card);
  document.addEventListener('pointerdown', (e) => {
    if (!card || card.hidden) return;
    const t = e.target as Node;
    if (!card.contains(t) && !anchorEl?.contains(t)) closePeek();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePeek();
  });
  window.addEventListener('resize', () => closePeek());
  // 桌機的小卡固定在畫面上；讀者自己捲動頁面時就收起來，免得卡片和它指的字分開
  window.addEventListener('scroll', () => {
    if (card && !card.classList.contains('lm-peek-sheet')) closePeek();
  }, { passive: true });
  window.addEventListener('hashchange', () => closePeek());
  return card;
}

export function openPeek(anchor: HTMLElement, ...content: Child[]) {
  const el = ensure();
  if (anchorEl === anchor && !el.hidden) return closePeek();
  anchorEl = anchor;
  fill(el, h('button', { class: 'lm-peek-x', type: 'button', 'aria-label': '關閉', onclick: () => closePeek() }, '×'), ...content);
  el.hidden = false;
  if (innerWidth < 560) {
    el.classList.add('lm-peek-sheet');
    el.style.left = el.style.top = '';
  } else {
    el.classList.remove('lm-peek-sheet');
    const r = anchor.getBoundingClientRect();
    const w = el.offsetWidth;
    const hgt = el.offsetHeight;
    const left = Math.min(Math.max(16, r.left), innerWidth - w - 16);
    const below = r.bottom + 8;
    const top = below + hgt < innerHeight - 8 ? below : Math.max(8, r.top - hgt - 8);
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }
  el.querySelector<HTMLElement>('a, button:not(.lm-peek-x)')?.focus({ preventScroll: true });
}

export function closePeek() {
  if (card) card.hidden = true;
  anchorEl = null;
}
