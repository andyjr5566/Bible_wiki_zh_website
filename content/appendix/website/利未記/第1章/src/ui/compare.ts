import { COMPARE, DEST_LABEL, PORTIONS, type Dest } from '../data/compare';
import { OFFERINGS } from '../data/offerings';
import type { OfferingId } from '../data/types';
import { emit, h, svg } from './dom';
import { badge, openVerses } from './evidence';
import { ICONS } from './icons';
import { OFFERING_STYLE } from './meta';
import { omark } from './simulator';

const DEST_ICON: Record<Dest, string> = { god: 'god', priest: 'priest', offerer: 'home', outside: 'outside' };

export function mountCompare(host: HTMLElement) {
  let focus: OfferingId | null = null;
  const table = h('table', { class: 'matrix' });
  const caption = h('caption', { class: 'sr-only' }, '五祭對照表：每一格都可以點開看經文');
  const head = h('thead', null, h('tr', null, h('th', { scope: 'col' }, '比較'),
    ...OFFERINGS.map((o) => h('th', { scope: 'col', style: `--c:${OFFERING_STYLE[o.id].color}` },
      h('button', {
        type: 'button', class: 'chipbtn', style: 'font:inherit;font-family:var(--serif);display:inline-flex;gap:6px;align-items:center',
        'aria-pressed': 'false', onclick: (e: Event) => toggleFocus(o.id, e.currentTarget as HTMLElement),
      }, omark(o.id), o.name)))));
  const body = h('tbody');
  for (const row of COMPARE) {
    body.append(h('tr', null, h('th', { scope: 'row' }, row.label), ...OFFERINGS.map((o) => {
      const fact = row.cells[o.id];
      const td = h('td', {
        'data-o': o.id, style: `--c:${OFFERING_STYLE[o.id].color}`, tabindex: 0,
        'aria-label': `${o.name}・${row.label}：${fact.text}（按 Enter 看經文）`,
        onclick: (e: Event) => fact.refs?.length && openVerses(e.currentTarget as HTMLElement, fact.refs, fact.q),
        onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter' && fact.refs?.length) openVerses(e.currentTarget as HTMLElement, fact.refs, fact.q); },
      },
      fact.status === 'not_stated' ? h('span', { class: 'cell-unsaid' }, fact.text) : h('span', null, fact.text),
      fact.status !== 'explicit' ? h('div', { style: 'margin-top:3px' }, badge(fact.status)) : null);
      return td;
    })));
  }
  table.append(caption, head, body);

  function toggleFocus(id: OfferingId, btn: HTMLElement) {
    focus = focus === id ? null : id;
    head.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === btn && focus !== null)));
    table.querySelectorAll('td').forEach((td) => td.classList.toggle('hl', td.getAttribute('data-o') === focus));
  }

  const portions = h('div', { class: 'portions' }, ...OFFERINGS.map((o) => {
    const p = PORTIONS[o.id];
    return h('div', { class: 'card portion', style: `--c:${OFFERING_STYLE[o.id].color};border-top:4px solid var(--c)` },
      h('h4', null, omark(o.id), o.name,
        h('button', { class: 'chipbtn', type: 'button', style: 'margin-left:auto;font-size:.75em', onclick: () => emit('choose-offering', { offering: o.id }) }, '走一次')),
      ...(Object.keys(DEST_LABEL) as Dest[]).map((d) => {
        const items = p[d];
        const ic = svg(ICONS[DEST_ICON[d]]);
        return h('div', { class: `dest${items.length ? '' : ' none'}` }, h('span', { class: 'ic', title: DEST_LABEL[d] }, ic),
          h('div', null, h('div', { style: 'font-size:.8em;color:var(--ink-3)' }, DEST_LABEL[d]), items.length ? items.join('、') : '—'));
      }));
  }));

  host.append(
    h('div', { class: 'card matrix-wrap' }, table),
    h('p', { style: 'font-size:.85em;color:var(--ink-3);margin-top:8px' },
      '點任何一格看經文。沒有標籤的格子都是經文明說；虛線框是經文沒交代的地方。點上面的祭名可以把那一欄標亮。'),
    h('h3', { style: 'margin-top:26px' }, '東西最後到了哪裡？'),
    h('p', { style: 'color:var(--ink-2);font-size:.92em' }, '每一種祭，祭物分給四個去處：燒在壇上、歸祭司、獻祭者自己吃、拿到營外燒掉。燔祭幾乎全上壇，平安祭是唯一四個去處都有的。'),
    portions,
  );
}
