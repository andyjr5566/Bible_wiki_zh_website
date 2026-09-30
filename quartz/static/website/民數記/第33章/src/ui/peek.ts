import { TIMED_EXACT, stationMonths, timeLabel } from '../data/dates';
import { EVENTS } from '../data/events';
import { SITES } from '../data/sites';
import { station, stationRef } from '../data/stations';
import * as store from '../store';
import { fill, h, svg } from './dom';
import { badge, factLine, refChip } from './evidence';
import { ICONS } from './icons';
import { goToMap } from './reveal';
import { kindIcon, levelChip } from './stationcard';

/**
 * 在原地看一站的簡要資料。
 *
 * 從內容區（時間軸、分段格子、「清單沒說的事」）或手機的清單點一個地名時，資訊卡通常在畫面外。
 * 以前是把整個頁面捲到卡片那裡，讀者看完還得再捲回來。現在頁面不動，在畫面下方開一張小卡：
 * 站名、經文、時間、位置、發生的事；要看地圖與完整資料再按「到地圖看」（去了之後有路標可以回來）。
 *
 * 規則：選了一站、不是播放帶動的、而且資訊卡現在看不到 → 開小卡；看得到就什麼都不做。
 */
let el: HTMLElement | null = null;

const narrow = () => matchMedia('(max-width: 980px)').matches;

/** 資訊卡現在有沒有大半在畫面上（手機上要扣掉釘在上面的地圖） */
function cardVisible(): boolean {
  const card = document.querySelector<HTMLElement>('.station-card');
  if (!card) return false;
  const r = card.getBoundingClientRect();
  const map = document.querySelector<HTMLElement>('.jmap-block');
  const top = narrow() && map ? Math.max(56, map.getBoundingClientRect().bottom) : 56;
  const visible = Math.min(r.bottom, innerHeight) - Math.max(r.top, top);
  return visible >= Math.min(220, r.height * 0.7);
}

export function closePeek() {
  el?.remove();
  el = null;
}

function build(n: number): HTMLElement {
  const st = station(n);
  const site = SITES[n - 1];
  const months = stationMonths(n);
  const events = EVENTS.filter((e) => e.st === n);
  const shown = events.slice(0, 2);
  const step = (d: number) => () => store.selectStation(Math.max(1, Math.min(42, n + d)));

  return h('div', { class: 'peek-body' },
    h('div', { class: 'peek-head' },
      h('span', { class: `stnum lv-${site.level}` }, String(n)),
      h('div', { class: 'peek-title' }, h('b', null, st.name), h('small', null, `第 ${n} 站`)),
      levelChip(site.level),
      h('button', { class: 'peek-x', type: 'button', 'aria-label': '關閉', onclick: closePeek }, svg(ICONS.x))),
    h('p', { class: 'peek-q' }, h('span', { class: 'q' }, st.q), ' ', refChip(stationRef(st), st.q), ' ', badge('explicit')),
    h('dl', { class: 'kv peek-kv' },
      h('div', { class: 'kv-row' }, h('dt', null, '時間'), h('dd', null, timeLabel(months), TIMED_EXACT.has(n) ? '（經文有日期）' : '（平均分配，示意）')),
      h('div', { class: 'kv-row' }, h('dt', null, '位置'), h('dd', null,
        site.mode === 'route' ? '沒有座標，圖上依前後兩站畫在路線上'
          : site.mode === 'zone' ? `${site.label}；可能在這一帶（範圍約 ${Math.round(site.zone!.rKm)} 公里）` : site.label))),
    shown.length
      ? h('ul', { class: 'facts ev-list peek-ev' }, ...shown.map((e) => h('li', null, kindIcon(e.kind), h('span', null, factLine({ text: e.text, status: e.status, refs: e.refs, q: e.q })))))
      : h('p', { class: 'small-p muted' }, '本站整理的經文裡，沒有記這一站發生的事。'),
    events.length > shown.length ? h('p', { class: 'fine' }, `還有 ${events.length - shown.length} 件，在完整資料裡。`) : null,
    h('div', { class: 'peek-actions' },
      h('button', { class: 'btn', type: 'button', disabled: n <= 1, onclick: step(-1) }, svg(ICONS.prev), '上一站'),
      h('button', { class: 'btn', type: 'button', disabled: n >= 42, onclick: step(1) }, '下一站', svg(ICONS.next)),
      h('button', { class: 'btn primary', type: 'button', onclick: () => { closePeek(); goToMap(); } }, svg(ICONS.map), '到地圖看')));
}

function open(n: number) {
  const first = !el;
  if (!el) {
    el = h('aside', { class: 'peek', role: 'dialog', 'aria-label': '這一站的簡要資料' });
    document.body.append(el);
  }
  fill(el, build(n));
  if (first) el.classList.add('peek-in');
}

export function initPeek() {
  store.subscribe((st, prev) => {
    if (st.sel === null || st.playing) { if (el) closePeek(); return; }
    if (st.sel === prev.sel) return;
    if (cardVisible()) { if (el) closePeek(); return; }
    open(st.sel);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && el) closePeek(); });
}
