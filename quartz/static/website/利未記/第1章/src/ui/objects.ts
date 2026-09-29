import { OBJECTS, type SacredObject } from '../data/objects';
import { OFFERING_BY_ID } from '../data/offerings';
import type { OfferingId } from '../data/types';
import { emit, h, svg } from './dom';
import { openDrawer, closeDrawer } from './drawer';
import { factLine, interpHeading, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { OFFERING_STYLE } from './meta';
import { omark } from './simulator';

const KIND_LABEL = { furniture: '器具', place: '地點', material: '材料', vessel: '器皿' } as const;

export function openObject(o: SacredObject) {
  openDrawer(o.name,
    h('p', { style: 'color:var(--ink-2)' }, o.summary),
    h('h4', { style: 'margin:14px 0 6px;font-size:.95em' }, '經文怎麼說'),
    h('ul', null, ...o.facts.map((f) => h('li', null, factLine(f)))),
    o.reconstruction ? h('div', { class: 'recon' }, '3D 模型：', o.reconstruction) : null,
    o.voices?.length ? interpHeading() : null,
    ...(o.voices ?? []).map(voiceBlock),
    o.usedBy.length ? h('h4', { style: 'margin:16px 0 6px;font-size:.95em' }, '在哪些祭裡出現') : null,
    o.usedBy.length ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px' }, ...o.usedBy.map((id: OfferingId) =>
      h('button', { class: 'chipbtn', type: 'button', style: 'display:inline-flex;gap:6px;align-items:center',
        onclick: () => { closeDrawer(); emit('choose-offering', { offering: id }); } },
      omark(id), `走一次${OFFERING_BY_ID[id].name}`))) : null,
    o.node ? h('button', { class: 'btn', type: 'button', style: 'margin-top:14px',
      onclick: () => { closeDrawer(); emit('focus-3d', o.node); } }, svg(ICONS.cube), '在 3D 院子裡看') : null,
  );
}

export function mountObjects(host: HTMLElement) {
  let filter: OfferingId | 'all' = 'all';
  const grid = h('div', { class: 'obj-grid' });
  const filters = h('div', { class: 'filters', role: 'group', 'aria-label': '依祭篩選' });
  const opts: (OfferingId | 'all')[] = ['all', 'burnt', 'grain', 'peace', 'sin', 'guilt'];

  function render() {
    filters.replaceChildren(...opts.map((id) => h('button', {
      class: 'opt', type: 'button', 'aria-pressed': String(filter === id), onclick: () => { filter = id; render(); },
    }, id === 'all' ? '全部' : h('span', { style: 'display:inline-flex;gap:6px;align-items:center' }, omark(id), OFFERING_BY_ID[id].name))));
    grid.replaceChildren(...OBJECTS.filter((o) => filter === 'all' || o.usedBy.includes(filter)).map((o) =>
      h('button', { class: 'card obj fade-in', type: 'button', onclick: () => openObject(o) },
        h('div', { style: 'display:flex;justify-content:space-between;align-items:start' },
          h('span', { class: 'ico' }, svg(ICONS[o.icon] ?? ICONS.q)),
          h('span', { style: 'font-size:.72em;color:var(--ink-3)' }, KIND_LABEL[o.kind], o.node ? '・3D' : '')),
        h('h3', null, o.name),
        h('p', null, o.summary),
        h('div', { class: 'uses', 'aria-label': '出現在' }, ...o.usedBy.map((id) => h('span', { title: OFFERING_BY_ID[id].name }, omark(id)))),
      )));
  }
  render();
  host.append(filters, grid);
  void OFFERING_STYLE;
}
