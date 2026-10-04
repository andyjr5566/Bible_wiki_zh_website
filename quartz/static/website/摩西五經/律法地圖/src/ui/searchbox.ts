import { lawWhy, refText } from '../data/db';
import type { Law } from '../data/types';
import { search } from '../lib/search';
import { go, href } from '../router';
import { fill, h } from './dom';

/** 搜尋框：首頁一個大的、其他頁面頂列一個小的，行為相同。Ctrl+K 跳到頁面上看得到的那一個。 */
export function searchBox(big = false): HTMLElement {
  const results = h('div', { class: 'lm-search-results', hidden: true, role: 'listbox' });
  const input = h('input', {
    class: 'lm-search-input', type: 'search', 'aria-label': '搜尋主題、經文或人物',
    placeholder: big ? '搜尋主題、經文或人物，例如：安息日、申15:12、寄居的' : '搜尋（Ctrl+K）',
  });
  const close = () => { results.hidden = true; };
  const render = () => {
    const r = search(input.value);
    const rows: HTMLElement[] = [];
    const row = (label: string, sub: string, target: string, laws = '', reason = '') =>
      rows.push(h('a', { class: 'lm-sr', href: target, role: 'option', onclick: close, 'data-laws': laws || null },
        h('span', null, label), h('small', null, sub), reason ? h('span', { class: 'lm-sr-why' }, reason) : null));
    const why = (l: Law) => lawWhy(l).map((w) => w.text).join('　');
    if (r.ref) {
      if (r.ref.laws.length) r.ref.laws.forEach((l) => row(l.title, refText(l), href('law', l.id), l.id, why(l)));
      else rows.push(h('div', { class: 'lm-sr lm-sr-none' }, `${r.ref.label}：這裡還沒有收錄律法`));
    }
    r.laws.forEach((l) => row(l.title, `律法 · ${refText(l)}`, href('law', l.id), l.id, why(l)));
    r.topics.forEach((t) => row(t.plain === t.name ? t.name : `${t.plain}（${t.name}）`, '主題', href('topic', t.id)));
    r.entries.forEach((e) => row(e, '人物、地方與觀念', href('entry', e)));
    fill(results, ...(rows.length ? rows : [h('div', { class: 'lm-sr lm-sr-none' }, '找不到。可以試試經文出處，例如「出21」。')]));
    results.hidden = !input.value.trim();
  };
  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector<HTMLAnchorElement>('a.lm-sr');
      if (first) { go(first.getAttribute('href')!); close(); input.blur(); }
    }
    if (e.key === 'Escape') { close(); input.blur(); }
  });
  input.addEventListener('blur', () => setTimeout(close, 150));
  return h('div', { class: `lm-search${big ? ' lm-search-big' : ''}`, role: 'search' }, input, results);
}

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    const visible = [...document.querySelectorAll<HTMLInputElement>('.lm-search-input')].find((i) => i.offsetParent !== null);
    if (visible) { e.preventDefault(); visible.focus(); }
  }
});
