import { DATES, SPANS, TIMED_EXACT, TOTAL_MONTHS, stationMonths, timeLabel } from '../data/dates';
import { SEGMENTS, STATIONS } from '../data/stations';
import * as store from '../store';
import { h, s } from './dom';
import { factLine } from './evidence';

/**
 * 時間軸（比例）：一條四十年的全景，加上「放大第一年」「放大第四十年」，
 * 因為前十二站只花約三個月，在四十年的比例尺上只佔 3% 的寬度。
 * 每一站的時間只有幾站是經文給的，其餘平均分配（示意）。
 */
const PAD = 22;
const SW = 1000;
const SH = 74;

interface StripOpts {
  title: string;
  sub: string;
  from: number;
  to: number;
  /** 座標軸上的刻度（起算月數與標籤） */
  ticks: [number, string][];
  /** 這條軸上要畫的站 */
  stations: number[];
  shade?: { from: number; to: number; label: string };
}

function strip(o: StripOpts): { el: HTMLElement; update: (st: Readonly<store.State>) => void } {
  const x = (m: number) => PAD + ((m - o.from) / (o.to - o.from)) * (SW - PAD * 2);
  const root = s('svg', { class: 'tl-strip', viewBox: `0 0 ${SW} ${SH}`, role: 'group', 'aria-label': `${o.title}：${o.sub}` });
  const axisY = 44;
  root.append(s('path', { d: `M${PAD} ${axisY}H${SW - PAD}`, class: 'tl-axis' }));
  if (o.shade) {
    root.append(
      s('rect', { x: x(o.shade.from), y: axisY - 26, width: x(o.shade.to) - x(o.shade.from), height: 52, class: 'tl-shade' }),
      s('text', { x: (x(o.shade.from) + x(o.shade.to)) / 2, y: axisY - 32, class: 'tl-shade-text' }, o.shade.label),
    );
  }
  for (const [m, label] of o.ticks) {
    root.append(s('path', { d: `M${x(m)} ${axisY}v8`, class: 'tl-tick' }), s('text', { x: x(m), y: axisY + 22, class: 'tl-tick-text' }, label));
  }
  const dots: SVGGElement[] = [];
  const segOf = (n: number) => SEGMENTS.ct.findIndex((sg) => n >= sg.from && n <= sg.to);
  for (const n of o.stations) {
    const g = s('g', { class: `tl-dot seg-${segOf(n)}`, 'data-n': n, tabindex: 0, role: 'button', 'aria-label': `第${n}站 ${STATIONS[n - 1].name}，${timeLabel(stationMonths(n))}` });
    const cx = x(stationMonths(n));
    g.append(s('circle', { cx, cy: axisY, r: 9, class: 'tl-hit' }), s('circle', { cx, cy: axisY, r: TIMED_EXACT.has(n) ? 5.5 : 4, class: `tl-circle${TIMED_EXACT.has(n) ? ' exact' : ''}` }));
    const pick = () => store.selectStation(n);
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    g.append(s('title', {}, `第${n}站 ${STATIONS[n - 1].name}`));
    dots.push(g);
    root.append(g);
  }
  const marker = s('path', { d: 'M0 30l-5 -9h10z', class: 'tl-now' });
  root.append(marker);
  const el = h('figure', { class: 'tl-fig' }, h('figcaption', null, h('b', null, o.title), h('span', null, o.sub)), h('div', { class: 'tl-scroll' }, root));
  const update = (st: Readonly<store.State>) => {
    dots.forEach((g) => g.classList.toggle('sel', +g.dataset.n! === st.sel));
    const n = st.sel ?? st.at;
    const inRange = o.stations.includes(n);
    marker.style.opacity = inRange ? '1' : '0';
    // 用 CSS transform，標記才會滑過去（屬性 transform 沒辦法做過渡）
    if (inRange) marker.style.transform = `translateX(${x(stationMonths(n)).toFixed(1)}px)`;
  };
  return { el, update };
}

export function createTimeline(): HTMLElement {
  const all = strip({
    title: '四十年全景', sub: '比例尺：出埃及後 0–40 年', from: 0, to: TOTAL_MONTHS + 6,
    ticks: [[0, '出埃及'], [120, '10 年'], [240, '20 年'], [360, '30 年'], [468, '第 40 年']],
    stations: STATIONS.map((st) => st.n),
    shade: { from: stationMonths(13), to: stationMonths(33), label: '三十八年：第 13–33 站，只知道頭尾的日期' },
  });
  const first = strip({
    title: '放大：第一年', sub: '出埃及後 0–14 個月（第 1–13 站）', from: -0.5, to: 14,
    ticks: [[0, '正月十五'], [3, '滿 3 個月'], [6, '6 個月'], [9, '9 個月'], [12, '1 年'], [13.17, '離西乃']],
    stations: Array.from({ length: 13 }, (_, i) => i + 1),
  });
  const last = strip({
    title: '放大：第四十年', sub: '第四十年正月到十一月（第 33–42 站）', from: 467, to: 479,
    ticks: [[468, '正月間'], [471.53, '五月初一'], [477.53, '十一月初一']],
    stations: Array.from({ length: 10 }, (_, i) => i + 33),
  });
  const strips = [all, first, last];
  store.subscribe((st) => strips.forEach((sp) => sp.update(st)));
  strips.forEach((sp) => sp.update(store.get()));

  const rows = DATES.map((d) => h('tr', { class: 'date-row', onclick: (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.ref')) store.selectStation(d.st); } },
    h('th', { scope: 'row' }, `第 ${d.st} 站 ${STATIONS[d.st - 1].name}`),
    h('td', null, factLine({ text: d.label, status: d.status, refs: [d.ref], q: d.q, note: d.note })),
    h('td', { class: 'num' }, timeLabel(d.months))));
  const spans = SPANS.map((sp) => h('li', null, factLine({ text: sp.label, status: 'explicit', refs: [sp.ref], q: sp.q })));

  return h('div', { class: 'timeline' },
    h('p', { class: 'swipe-hint' }, '← 時間軸可以左右滑動 →'),
    ...strips.map((sp) => sp.el),
    h('p', { class: 'fine' }, '空心圓是經文沒有給日期、在兩個日期之間平均分配的站；粗一點的是經文給了日期的站。三十八年裡每一站停多久，經文沒有寫。'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'ord' },
      h('caption', null, '經文給的日期'),
      h('thead', null, h('tr', null, h('th', null, '站'), h('th', null, '日期'), h('th', null, '換算（示意）'))),
      h('tbody', null, ...rows))),
    h('h4', { class: 'sub' }, '期間的說法'),
    h('ul', { class: 'facts' }, ...spans));
}
