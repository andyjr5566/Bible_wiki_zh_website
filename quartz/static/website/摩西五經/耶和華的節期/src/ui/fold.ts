/**
 * 手機上有互動的那一拍，說明框貼底會蓋住畫面：預設收成小條，讀者要看說明與經文再展開。
 * 塗血、烤餅、搖禾捆、數算共用這一顆「看說明與經文」。
 */
import { h } from './dom';

export function makeFold(): HTMLButtonElement {
  const fold = h('button', { type: 'button', class: 'jf-fold', 'aria-expanded': 'false' }, '看說明與經文');
  fold.addEventListener('click', () => {
    const box = fold.closest<HTMLElement>('.jf-box');
    if (!box) return;
    const open = box.dataset.compact !== 'false';
    box.dataset.compact = open ? 'false' : 'true';
    fold.setAttribute('aria-expanded', open ? 'true' : 'false');
    fold.textContent = open ? '收起說明' : '看說明與經文';
  });
  return fold;
}
