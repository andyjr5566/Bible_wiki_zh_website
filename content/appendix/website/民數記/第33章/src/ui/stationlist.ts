import { TIMED_EXACT, stationMonths, timeLabel } from '../data/dates';
import { EVENTS } from '../data/events';
import { SEGMENTS, STATIONS } from '../data/stations';
import type { SegMode } from '../data/stations';
import { SITES } from '../data/sites';
import VERSES from '../data/verses.json';
import * as store from '../store';
import type { Mode } from '../store';
import { animOff, fill, h } from './dom';
import { kindIcon, levelChip } from './stationcard';

const verses = VERSES as Record<string, string>;

const kindsAt = (n: number) => [...new Set(EVENTS.filter((e) => e.st === n).map((e) => e.kind))];

const MODES: [Mode, string, string][] = [
  ['geo', '地理', '照站序，看每一站的位置可信度'],
  ['time', '時間', '照時間比例，看四十年怎麼分配'],
  ['text', '經文', '讀民數記33 全文，點站名'],
];

function stationRow(n: number, opts: { time?: boolean } = {}): HTMLElement {
  const st = STATIONS[n - 1];
  const kinds = kindsAt(n);
  return h('button', { class: 'st-row', type: 'button', 'data-n': n, onclick: () => store.selectStation(n) },
    h('span', { class: `stnum lv-${SITES[n - 1].level}` }, String(n)),
    h('span', { class: 'st-row-main' },
      h('b', null, st.name),
      opts.time
        ? h('small', null, timeLabel(stationMonths(n)), TIMED_EXACT.has(n) ? '' : '（示意）')
        : (st.entry ? h('small', null, '有條目') : null)),
    kinds.length ? h('span', { class: 'st-kinds', 'aria-hidden': 'true' }, ...kinds.slice(0, 4).map(kindIcon)) : null,
    opts.time ? null : levelChip(SITES[n - 1].level));
}

/** 只捲 container 自己，讓 target 進到可見範圍（上方留出黏在頂端的分組標題） */
function keepInView(container: HTMLElement, target: HTMLElement, smooth: boolean) {
  const c = container.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  const top = 48; // 分組標題（sticky）的高度
  const bottom = 10;
  let dy = 0;
  if (t.top < c.top + top) dy = t.top - c.top - top;
  else if (t.bottom > c.bottom - bottom) dy = t.bottom - c.bottom + bottom;
  if (Math.abs(dy) > 1) container.scrollBy({ top: dy, behavior: smooth ? 'smooth' : 'auto' });
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function geoBody(seg: SegMode): HTMLElement {
  return h('div', { class: 'st-groups' }, ...SEGMENTS[seg].map((g, gi) => h('section', { class: `st-group seg-${gi}` },
    h('header', null, h('b', null, g.name), h('span', null, `第 ${g.from}–${g.to} 站・${g.note}`), 'ref' in g && g.ref ? h('em', null, g.ref) : null),
    h('div', { class: 'st-list' }, ...range(g.from, g.to).map((n) => stationRow(n))))));
}

function timeBody(): HTMLElement {
  const group = (title: string, note: string, ns: number[]) => h('section', { class: 'st-group' },
    h('header', null, h('b', null, title), h('span', null, note)),
    h('div', { class: 'st-list' }, ...ns.map((n) => stationRow(n, { time: true }))));
  return h('div', { class: 'st-groups' },
    group('第一年：出埃及到西乃', '第 1–12 站・約 3 個月', range(1, 12)),
    h('p', { class: 'st-gap' }, '在西乃住到第二年二月二十日，雲彩收上去才起行（民10:11）。'),
    group('三十八年', '第 13–33 站・只知道頭尾的日期', range(13, 33)),
    group('第四十年', '第 34–42 站・約 7 個月', range(34, 42)),
  );
}

/** 民33 全文：站名是按鈕。每一節只把「這一節安營的那一站」變成按鈕 */
function textBody(): HTMLElement {
  const byVerse = new Map<number, number>();
  for (const st of STATIONS) if (!byVerse.has(st.verse)) byVerse.set(st.verse, st.n);
  const paras: HTMLElement[] = [];
  for (let v = 1; v <= 56; v++) {
    const text = verses[`民33:${v}`];
    const n = byVerse.get(v);
    const p = h('p', { class: 'verse', 'data-v': v }, h('sup', null, String(v)));
    if (n) {
      const name = STATIONS[n - 1].name;
      const i = text.indexOf(name);
      if (i >= 0) {
        p.append(text.slice(0, i), h('button', { class: 'name-btn', type: 'button', 'data-n': n, onclick: () => store.selectStation(n) }, name), text.slice(i + name.length));
      } else p.append(text);
    } else p.append(text);
    paras.push(p);
  }
  return h('div', { class: 'text-body' },
    h('p', { class: 'fine' }, '和合本，取自本庫 raw_scripture。灰色底線的站名可以點。第 34 站何珥山之後，第 38–40 節是插進來的敘事。'),
    ...paras);
}

export function createLeftPane(): HTMLElement {
  const tabs = h('div', { class: 'seg', role: 'tablist', 'aria-label': '檢視方式' }, ...MODES.map(([m, label, help]) => h('button', {
    class: 'seg-btn', type: 'button', role: 'tab', title: help, 'data-mode': m, onclick: () => store.set({ mode: m }),
  }, label)));
  const segBtns = (['ct', 'gt'] as SegMode[]).map((m) => h('button', {
    class: 'seg-btn', type: 'button', 'data-seg': m, onclick: () => store.set({ seg: m }),
  }, m === 'ct' ? 'CT 三段' : 'GT 六程七站'));
  const segBar = h('div', { class: 'seg small', role: 'group', 'aria-label': '分段方式' }, ...segBtns);
  const body = h('div', { class: 'left-body' });
  const pane = h('div', { class: 'left-pane card' },
    h('div', { class: 'left-top' }, tabs, segBar),
    body);

  let built = '';
  const render = (st: Readonly<store.State>, prev?: Readonly<store.State>) => {
    const key = `${st.mode}|${st.mode === 'geo' ? st.seg : ''}`;
    if (key !== built) {
      built = key;
      fill(body, st.mode === 'geo' ? geoBody(st.seg) : st.mode === 'time' ? timeBody() : textBody());
      body.scrollTop = 0;
    }
    tabs.querySelectorAll<HTMLElement>('.seg-btn').forEach((b) => {
      const on = b.dataset.mode === st.mode;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-selected', String(on));
    });
    segBar.style.display = st.mode === 'geo' ? '' : 'none';
    segBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.seg === st.seg)));
    body.querySelectorAll<HTMLElement>('[data-n]').forEach((el) => {
      const n = +el.dataset.n!;
      el.classList.toggle('sel', st.sel === n);
      el.classList.toggle('cur', st.at === n);
    });
    body.querySelectorAll<HTMLElement>('.verse').forEach((p) => {
      const v = +p.dataset.v!;
      const sel = st.sel !== null ? STATIONS[st.sel - 1].verse : -1;
      p.classList.toggle('sel', v === sel);
    });
    // 選取或走動改變時，讓那一列留在左欄可見的範圍內。
    // 只捲左欄自己（scrollTop），絕不動整個頁面：scrollIntoView 會連頁面一起捲，
    // 播放時每到一站就把使用者拉回去。使用者自己在左欄捲動之後 8 秒內也不再跟隨。
    if (!prev || prev.sel !== st.sel || prev.at !== st.at) {
      const n = st.sel ?? st.at;
      const target = st.mode === 'text'
        ? body.querySelector<HTMLElement>(`.verse[data-v="${STATIONS[n - 1].verse}"]`)
        : body.querySelector<HTMLElement>(`.st-row[data-n="${n}"]`);
      const scrolls = body.scrollHeight > body.clientHeight + 4 && getComputedStyle(body).overflowY !== 'visible';
      const userBusy = performance.now() - lastUserScroll < 8000;
      if (target && scrolls && !(st.playing && userBusy)) keepInView(body, target, st.playing && !animOff());
    }
  };
  let lastUserScroll = -1e9;
  for (const ev of ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const) {
    body.addEventListener(ev, () => { lastUserScroll = performance.now(); }, { passive: true });
  }
  store.subscribe(render);
  render(store.get());
  return pane;
}
