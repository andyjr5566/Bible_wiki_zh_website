import { DEBATES, UNWRITTEN } from '../data/debates';
import { MATERIALS, ZONES } from '../data/materials';
import { ORDER_VOICES, STOPS } from '../data/stops';
import { h, svg } from './dom';
import { badge, factLine, interpHeading, refChip, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { reveal, smoothScrollTo } from './motion';

const stopTitle = (id?: string) => STOPS.find((s) => s.id === id)?.title;
const jump = (id: string) => {
  const el = document.getElementById(`stop-${id}`);
  if (el) smoothScrollTo(el.getBoundingClientRect().top + scrollY - innerHeight * 0.3);
};

/** 百姓送來的禮物，與「越往裡面越貴重」 */
export function mountMaterials(host: HTMLElement) {
  const strip = h('div', { class: 'zones', role: 'list' }, ...ZONES.map((z) => h('div', { class: 'zone', role: 'listitem', style: `--z:${z.swatch}` },
    h('span', { class: 'zone-bar' }),
    h('b', null, z.place), h('span', { class: 'zone-metal' }, z.metal),
    h('span', { class: 'zone-fact' }, factLine(z.fact)))));
  const grid = h('div', { class: 'mat-grid' }, ...MATERIALS.map((m) => h('div', { class: 'card mat' },
    h('div', { class: 'mat-head' }, h('span', { class: 'swatch big', style: `background:${m.swatch}` }), h('h3', null, m.name), refChip(m.listed.refs![0], m.listed.q)),
    h('ul', null, ...m.uses.map((u, i) => h('li', { style: `--i:${i}` }, u.text, ' ', refChip(u.ref, u.q),
      u.stop ? h('button', { class: 'go', type: 'button', onclick: () => jump(u.stop!) }, stopTitle(u.stop), svg(ICONS.next)) : null))),
    m.voice ? voiceBlock(m.voice) : null)));
  host.append(
    h('h3', { class: 'sub' }, '從東門走到至聖所，金屬越來越貴重'),
    h('p', { class: 'sub-lede' }, '把出25–27 章每件東西用的金屬照位置排開，就是下面這條。這是把經文放在一起看出來的，經文沒有一句話直接這樣說。', ' ', badge('synthesis')),
    strip,
    interpHeading(), ...ORDER_VOICES.slice(1).map(voiceBlock),
    h('h3', { class: 'sub' }, '十二樣禮物，各自用在哪裡'),
    h('p', { class: 'sub-lede' }, '出25:3-7 列出百姓可以送來的東西。點經節看原文，點站名跳回導覽。'),
    grid,
  );
  reveal([strip], '0px 0px -20% 0px');
  reveal(grid.children);
}

/** 經文沒說的事 */
export function mountUnsaid(host: HTMLElement) {
  const eleven = h('div', { class: 'card eleven' },
    h('h3', null, '聖經沒有寫明的十一件事'),
    h('p', { class: 'sub-lede' }, 'GT 引丁良才整理：會幕的記載裡，有這些尺寸和做法沒有寫。'),
    h('ol', null, ...UNWRITTEN.items.map((t) => h('li', null, t))),
    interpHeading(), voiceBlock(UNWRITTEN.source));
  const grid = h('div', { class: 'deb-grid' }, ...DEBATES.map((d) => h('details', { class: 'card deb', id: `deb-${d.id}` },
    h('summary', null, h('div', null,
      h('div', { class: 'deb-meta' }, stopTitle(d.stop) ?? '', h('span', { class: 'count' }, `・${d.voices.length} 種讀法`)),
      h('h3', null, d.question)), h('span', { class: 'chev' }, svg(ICONS.chev))),
    h('div', { class: 'body' },
      h('div', { class: `said${d.text.status === 'not_stated' ? ' unsaid' : ''}` },
        h('div', { class: 'said-k' }, '經文說的：'), factLine(d.text)),
      interpHeading(), ...d.voices.map(voiceBlock),
      h('p', { class: 'interp-hidden-note' }, '註釋解讀層已隱藏（右上角可以打開）。'),
      h('button', { class: 'go', type: 'button', onclick: () => jump(d.stop) }, `回到「${stopTitle(d.stop)}」`, svg(ICONS.next))))));
  host.append(eleven, grid);
  reveal([eleven, ...grid.children]);
}
