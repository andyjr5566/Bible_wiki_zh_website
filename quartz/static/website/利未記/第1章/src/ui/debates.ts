import { DEBATES, TRIVIA } from '../data/debates';
import { OFFERING_BY_ID } from '../data/offerings';
import type { OfferingId } from '../data/types';
import { h, svg } from './dom';
import { badge, factLine, interpHeading, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { OFFERING_STYLE } from './meta';
import { omark } from './simulator';

type Key = OfferingId | 'priesthood';
const nameOf = (k: Key) => (k === 'priesthood' ? '祭司職分' : OFFERING_BY_ID[k].name);

export function mountDebates(host: HTMLElement) {
  let filter: Key | 'all' = 'all';
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': '依主題篩選' });
  const grid = h('div', { class: 'deb-grid' });
  const keys: (Key | 'all')[] = ['all', 'burnt', 'grain', 'peace', 'sin', 'priesthood'];

  function render() {
    filters.replaceChildren(...keys.map((k) => h('button', {
      class: 'opt', type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; render(); },
    }, k === 'all' ? '全部' : h('span', { style: 'display:inline-flex;gap:6px;align-items:center' }, omark(k), nameOf(k)))));
    grid.replaceChildren(...DEBATES.filter((d) => filter === 'all' || d.offering === filter).map((d) => {
      const k = d.offering ?? 'burnt';
      const said = h('div', { class: `said${d.text.status === 'not_stated' ? ' unsaid' : ''}` },
        h('div', { style: 'font-size:.78em;font-weight:700;color:var(--ink-3);margin-bottom:2px' }, '經文說的：'),
        factLine(d.text));
      return h('details', { class: 'card deb', style: `--c:${OFFERING_STYLE[k].color};border-top:3px solid var(--c)` },
        h('summary', null, h('div', null,
          h('div', { style: 'display:flex;gap:6px;align-items:center;font-size:.75em;color:var(--ink-3);margin-bottom:3px' },
            omark(k), nameOf(k), h('span', { class: 'count' }, `・${d.voices.length} 種讀法`)),
          h('h3', null, d.question)),
        h('span', { class: 'chev' }, svg(ICONS.chev))),
        h('div', { class: 'body' }, said, interpHeading(), ...d.voices.map(voiceBlock),
          h('p', { class: 'interp-hidden-note' }, '註釋解讀層已隱藏（右上角可以打開）。'),
          d.lexical ? h('div', { style: 'font-size:.85em;color:var(--ink-2);margin-top:8px;border-top:1px dashed var(--line);padding-top:6px' },
            h('b', null, '原文能確認的：'), d.lexical.says) : null));
    }));
  }
  render();

  const flips = h('div', { class: 'flips' }, ...TRIVIA.map((t) => {
    const k = t.offering ?? 'burnt';
    // 卡片背面有經節按鈕，所以外層用 role=button 的 div，不用巢狀 <button>
    const flip = (b: HTMLElement) => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    const card = h('div', { class: 'flip', role: 'button', tabindex: 0, 'aria-pressed': 'false', style: `--c:${OFFERING_STYLE[k].color}`,
      onclick: (e: Event) => { if (!(e.target as HTMLElement).closest('.ref')) flip(e.currentTarget as HTMLElement); },
      onkeydown: (e: KeyboardEvent) => {
        if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); flip(e.currentTarget as HTMLElement); }
      } },
    h('span', { class: 'in' },
      h('span', { class: 'face front' }, h('span', null, t.front), h('small', null, `${nameOf(k)}・點一下翻面`)),
      h('span', { class: 'face back' }, h('span', null, t.back.text), h('span', null, badge(t.back.status), ' ', ...refChips(t.back.refs, t.back.q))),
    ));
    return card;
  }));

  host.append(filters, grid, h('h3', { style: 'margin-top:30px' }, '你知道嗎？'),
    h('p', { style: 'color:var(--ink-2);font-size:.92em' }, '先猜，再翻面。每張的答案都附經節。'), flips);
}
