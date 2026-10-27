import { h } from './dom';
import { onScroll as listenScroll, scrollY } from './scroller';

const STORAGE_KEY = 'jos24-rotate-hint-closed';
const SVG_NS = 'http://www.w3.org/2000/svg';

function wasClosed(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function rememberClosed(): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // 無痕或 file:// 下可能不可用，關掉的狀態只留在這次頁面
  }
}

function rotateIcon(): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'jos-rotate-hint-icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const phone = document.createElementNS(SVG_NS, 'rect');
  phone.setAttribute('x', '8');
  phone.setAttribute('y', '3');
  phone.setAttribute('width', '8');
  phone.setAttribute('height', '14');
  phone.setAttribute('rx', '1.6');
  const arrow = document.createElementNS(SVG_NS, 'path');
  arrow.setAttribute('d', 'M4 20.5c2.2 1.3 5 1.8 8 1.8s5.8-.5 8-1.8M17.5 19.6l2.6.9.9-2.6');
  svg.append(phone, arrow);
  return svg;
}

/** 直拿手機時的提示；橫拿與桌機由 CSS 隱藏，關掉後同一次瀏覽不再出現 */
export function createRotateHint(): HTMLElement {
  const closeBtn = h(
    'button',
    { type: 'button', className: 'jos-rotate-hint-close', 'aria-label': '關閉提示' },
    '×',
  );
  const el = h(
    'div',
    { className: 'jos-rotate-hint', role: 'note' },
    rotateIcon(),
    h('span', { className: 'jos-rotate-hint-text' }, '把手機橫過來看'),
    closeBtn,
  );
  if (wasClosed()) el.classList.add('jos-rotate-hint-hidden');
  // 開始往下讀就收起來，不一直壓在畫面上
  const stop = listenScroll(() => {
    if (scrollY() < window.innerHeight * 0.8) return;
    el.classList.add('jos-rotate-hint-hidden');
    stop();
  });
  closeBtn.addEventListener('click', () => {
    el.classList.add('jos-rotate-hint-hidden');
    rememberClosed();
  });
  return el;
}
