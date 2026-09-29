import { h, svg } from './dom';
import { ICONS } from './icons';

let back: HTMLElement | null = null;
let panel: HTMLElement | null = null;
let returnTo: HTMLElement | null = null;

export function closeDrawer() {
  back?.classList.remove('open');
  panel?.classList.remove('open');
  const b = back;
  const p = panel;
  back = panel = null;
  setTimeout(() => { b?.remove(); p?.remove(); }, 260);
  returnTo?.focus();
}

export function openDrawer(title: string, ...content: (Node | null)[]) {
  if (panel) closeDrawer();
  returnTo = document.activeElement as HTMLElement;
  back = h('div', { class: 'drawer-back', onclick: closeDrawer });
  const close = h('button', { class: 'iconbtn drawer-close', type: 'button', 'aria-label': '關閉', onclick: closeDrawer }, svg(ICONS.x));
  panel = h('div', { class: 'drawer', role: 'dialog', 'aria-modal': 'true', 'aria-label': title }, close, h('h3', null, title), ...content);
  document.body.append(back, panel);
  requestAnimationFrame(() => { back!.classList.add('open'); panel!.classList.add('open'); close.focus(); });
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && panel && !document.querySelector('.pop')) closeDrawer();
  if (e.key === 'Tab' && panel) {
    const f = panel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])');
    if (!f.length) return;
    const first = f[0];
    const last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
});
