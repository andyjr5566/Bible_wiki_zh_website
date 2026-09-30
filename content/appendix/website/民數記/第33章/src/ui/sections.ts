import { COMPARE_A, COMPARE_B } from '../data/compare';
import type { CmpItem } from '../data/compare';
import { DEBATES } from '../data/debates';
import { OB_DATA, candLabel } from '../data/sites';
import { SEGMENTS, STATIONS } from '../data/stations';
import { CROSSING_FACTS, CROSSING_VOICES, GT_PATTERNS, SEGMENT_VOICES } from '../data/voices';
import * as store from '../store';
import { fill, h, svg } from './dom';
import { badge, factLine, interpHeading, refChip, voiceBlock } from './evidence';
import { ICONS } from './icons';

/* ------------------------------------------------------------------ 03 同一段路，三份記錄 */

type Compare = typeof COMPARE_A | typeof COMPARE_B;

function lane(label: string, items: CmpItem[]): HTMLElement {
  return h('div', { class: 'cmp-lane' },
    h('h4', null, label),
    h('ol', null, ...items.map((i) => h('li', { class: `cmp-item${i.same ? ' shared' : ''}`, 'data-same': i.same ?? '' },
      h('b', null, i.name), ' ', refChip(i.ref, i.q),
      i.same ? h('small', { class: 'via' }, i.via === 'CT' ? '（CT 讀作同一處）' : '（兩處都有）') : null))));
}

function compareBlock(c: Compare): HTMLElement {
  const grid = h('div', { class: 'cmp-lanes' }, lane(c.left.label, c.left.items), lane(c.right.label, c.right.items));
  // 滑過（或聚焦）一個共同的地名，兩邊同時亮起
  grid.querySelectorAll<HTMLElement>('.cmp-item.shared').forEach((li) => {
    const on = (v: boolean) => grid.querySelectorAll<HTMLElement>(`.cmp-item[data-same="${li.dataset.same}"]`).forEach((x) => x.classList.toggle('lit', v));
    li.addEventListener('mouseenter', () => on(true));
    li.addEventListener('mouseleave', () => on(false));
    li.addEventListener('focusin', () => on(true));
    li.addEventListener('focusout', () => on(false));
  });
  return h('div', { class: 'card pad cmp-block' },
    h('h3', null, c.title),
    grid,
    h('p', { class: 'fine' }, '有底色的是兩邊都有的地名（把滑鼠移上去，兩邊會一起亮）。其他地名只出現在其中一處。'),
    interpHeading(), ...c.voices.map(voiceBlock));
}

export function mountCompare(host: HTMLElement) {
  host.append(h('div', { class: 'cmp-stack' }, compareBlock(COMPARE_A), compareBlock(COMPARE_B)));
}

/* ------------------------------------------------------------------ 04 六程七站 */

export function mountPatterns(host: HTMLElement) {
  let active = GT_PATTERNS[0].id;
  const cells = new Map<number, HTMLElement>();
  const grid = h('div', { class: 'gt-grid', role: 'group', 'aria-label': '四十二站排成六程，每程七站' },
    ...SEGMENTS.gt.map((g) => h('div', { class: 'gt-row' },
      h('div', { class: 'gt-label' }, g.name),
      ...Array.from({ length: 7 }, (_, i) => {
        const n = g.from + i;
        const b = h('button', { class: 'gt-cell', type: 'button', 'data-n': n, title: `第 ${n} 站`, onclick: () => store.selectStation(n) },
          h('em', null, String(n)), h('span', null, STATIONS[n - 1].name));
        cells.set(n, b);
        return b;
      }))));
  const ctBar = h('div', { class: 'ct-bar', role: 'group', 'aria-label': 'CT 的三段' }, ...SEGMENTS.ct.map((sg, i) => h('div', { class: `ct-seg seg-${i}`, style: `flex:${sg.to - sg.from + 1}` },
    h('b', null, sg.name), h('span', null, `第 ${sg.from}–${sg.to} 站・${sg.note}`))));

  const detail = h('div', { class: 'pattern-detail', 'aria-live': 'polite' });
  const chips = GT_PATTERNS.map((p) => h('button', {
    class: 'chipbtn', type: 'button', 'data-id': p.id, onclick: () => { active = p.id; paint(); },
  }, p.label));
  const paint = () => {
    const p = GT_PATTERNS.find((x) => x.id === active)!;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.id === active)));
    cells.forEach((el, n) => el.classList.toggle('hl', p.stations.includes(n)));
    fill(detail,
      h('p', null, h('b', null, p.text), ' ', badge('interpretation')),
      h('p', { class: 'small-p muted' }, '點格子看那一站的簡要資料；頁面不會移動。'));
  };
  paint();

  host.append(h('div', { class: 'pattern-layout' },
    h('div', { class: 'card pad' },
      h('h3', null, 'GT 串珠：六程，每程七站'),
      h('p', { class: 'muted' }, '把四十二站每七站切成一程，會出現幾組整齊的對應。點下面的說法，格子會亮起來。'),
      h('div', { class: 'chips' }, ...chips),
      grid, detail,
      interpHeading(), ...SEGMENT_VOICES.gt.map(voiceBlock)),
    h('div', { class: 'card pad' },
      h('h3', null, 'CT：三段'),
      h('p', { class: 'muted' }, '同一份清單，CT 切成十二、二十一、九站。'),
      ctBar,
      interpHeading(), ...SEGMENT_VOICES.ct.map(voiceBlock),
      h('p', { class: 'fine' }, '兩種分法都只是讀者替清單分的段；經文自己沒有標。'))));
}

/* ------------------------------------------------------------------ 05 清單沒說的事 */

const KIND_OF_POINT: Record<string, string> = { point: '遺址', center: '一帶', 'representative point': '代表點' };

export function mountUnsaid(host: HTMLElement) {
  host.append(h('div', { class: 'deb-grid' }, ...DEBATES.map((d) => {
    const cands = d.cands ? OB_DATA[d.cands]?.cands : undefined;
    return h('article', { class: 'card pad deb', id: `deb-${d.id}` },
      h('h3', null, d.title),
      h('p', { class: 'ask' }, d.ask),
      h('ul', { class: 'facts' }, ...d.facts.map((f) => h('li', null, factLine(f)))),
      cands ? h('div', { class: 'table-wrap' }, h('table', { class: 'cand-table' },
        h('caption', null, 'OpenBible 的候選地點與分數'),
        h('thead', null, h('tr', null, h('th', null, '候選'), h('th', null, '種類'), h('th', null, '分數'))),
        h('tbody', null, ...cands.slice(0, 8).map((c) => h('tr', null, h('th', { scope: 'row' }, candLabel(c.name)), h('td', null, KIND_OF_POINT[c.kind] ?? c.kind), h('td', { class: 'num' }, String(c.score))))))) : null,
      d.voices.length ? h('div', null, interpHeading(), ...d.voices.map(voiceBlock)) : null,
      d.go ? h('div', { class: 'panel-actions' }, h('button', { class: 'btn', type: 'button', onclick: () => store.selectStation(d.go!) }, svg(ICONS.map), `看第 ${d.go} 站的資料`)) : null);
  })));
}

/* ------------------------------------------------------------------ 06 過河之前 */

export function mountCrossing(host: HTMLElement) {
  host.append(h('div', { class: 'card pad crossing' },
    h('p', { class: 'muted' }, '清單寫完，接著是同一個地方的一段話：耶和華在摩押平原，對摩西交代過河進迦南以後的事。'),
    h('ul', { class: 'facts' }, ...CROSSING_FACTS.map((f) => h('li', null, factLine(f)))),
    interpHeading(), ...CROSSING_VOICES.map(voiceBlock)));
}

