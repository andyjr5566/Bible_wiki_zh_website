import { COUNT_FACTS, SAME_ORDER_FACT } from '../data/center';
import { CLANS, LEVITE_TOTAL } from '../data/levites';
import { CAMPS, TOTAL_1, TOTAL_2, TOTAL_26, TRIBES, camp, fmt, tribesOf } from '../data/tribes';
import * as store from '../store';
import { h } from './dom';
import { factLine, refChips } from './evidence';
import { CAMP_STYLE } from './meta';
import { revealPanel } from './panel';
import './dumbbell.css';

const ORDERED = CAMPS.flatMap((c) => tribesOf(c.id));

function orderTable(): HTMLElement {
  const rows: HTMLElement[] = [];
  ORDERED.forEach((t, i) => {
    const c = camp(t.camp);
    rows.push(h('tr', { class: 'ord-row', style: `--c:${CAMP_STYLE[t.camp].color}`, 'data-tribe': t.id,
      onclick: (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('.ref')) return; // 點經節是看經文，不是選支派
        store.set({ sel: { kind: 'tribe', id: t.id } });
        revealPanel();
      } },
    h('th', { scope: 'row' }, h('span', { class: 'omark', 'data-shape': CAMP_STYLE[t.camp].shape, style: `--c:${CAMP_STYLE[t.camp].color}` }), ' ', t.name),
    h('td', null, t.rank === 1 ? `${c.orderName}的領頭` : t.rank === 2 ? '挨著他' : '又有', ' ', ...refChips([t.campRef], t.placeQ)),
    h('td', null, `第 ${t.day} 日・${t.leader}`, ' ', ...refChips([t.dayRef], t.leader)),
    h('td', null, t.leader, ' ', ...refChips([t.marchRef], `${t.father}的兒子${t.leader}`))));
    if (i === 5) {
      rows.push(h('tr', { class: 'ord-row extra' },
        h('th', { scope: 'row' }, '會幕與利未'),
        h('td', null, '會幕往前行，利未營在諸營中間 ', ...refChips(['民2:17'], '會幕要往前行，有利未營在諸營中間')),
        h('td', { class: 'na' }, '—'),
        h('td', null, '哥轄人抬聖物，在流便營之後 ', ...refChips(['民10:21'], '哥轄人抬著聖物先往前行'))));
    }
    if (i === 2) {
      rows.push(h('tr', { class: 'ord-row extra' },
        h('th', { scope: 'row' }, '革順與米拉利'),
        h('td', { class: 'na' }, '—'),
        h('td', { class: 'na' }, '—'),
        h('td', null, '抬著帳幕先往前行 ', ...refChips(['民10:17'], '革順的子孫和米拉利的子孫就抬著帳幕先往前行'))));
    }
  });
  return h('div', null, h('p', { class: 'swipe-hint' }, '← 表格可以左右滑動，看民7、民10 →'), h('div', { class: 'table-wrap' },
    h('table', { class: 'ord' },
      h('caption', null, '同一批首領，三個場合，同一個先後'),
      h('thead', null, h('tr', null, h('th', null, '支派'), h('th', null, '民2　安營'), h('th', null, '民7　獻壇禮'), h('th', null, '民10　起行'))),
      h('tbody', null, ...rows))));
}

function countBars(): HTMLElement {
  const peak = Math.max(...TRIBES.map((t) => Math.max(t.c2.n, t.c26.n)));
  const max = peak >= 80000 ? Math.ceil(peak / 10000) * 10000 : 80000;
  const ticks = Array.from({ length: Math.floor(max / 20000) + 1 }, (_, i) => i * 20000);
  const deltas = TRIBES.map((t) => ({ t, d: t.c26.n - t.c2.n }));
  const drop = deltas.reduce((a, b) => (b.d < a.d ? b : a));
  const gain = deltas.reduce((a, b) => (b.d > a.d ? b : a));
  const rows = ORDERED.map((t) => {
    const d = t.c26.n - t.c2.n;
    const a = (t.c2.n / max) * 100;
    const b = (t.c26.n / max) * 100;
    return h('div', { class: 'db-row', role: 'listitem', style: `--c:${CAMP_STYLE[t.camp].color}` },
      h('span', { class: 'db-name' }, t.name),
      h('span', { class: 'db-track' },
        ...ticks.map((tick) => h('span', { class: 'db-grid', style: `left:${(tick / max) * 100}%` })),
        h('span', { class: `db-link ${d >= 0 ? 'up' : 'down'}`, style: `left:${Math.min(a, b)}%;width:${Math.abs(b - a)}%` }),
        h('span', { class: 'db-a', style: `left:${a}%`, title: `民2 ${fmt(t.c2.n)}` }),
        h('span', { class: 'db-b', style: `left:${b}%`, title: `民26 ${fmt(t.c26.n)}` })),
      h('span', { class: 'db-n' }, fmt(t.c2.n), ' → ', fmt(t.c26.n)),
      h('span', { class: `db-d cb-d ${d >= 0 ? 'up' : 'down'}` }, `${d >= 0 ? '▲' : '▼'}${fmt(Math.abs(d))}`));
  });
  const columns = '4.5em minmax(0, 1fr) auto 5.5em';
  const axis = h('div', { class: 'db-axis', style: `--db-columns:${columns}` },
    h('span', null),
    h('span', { class: 'db-axis-track' }, ...ticks.map((tick) => h('span', { class: `db-tick${tick === max ? ' db-tick-end' : ''}`, style: `left:${(tick / max) * 100}%` }, fmt(tick)))),
    h('span', null), h('span', null));
  const totalD = TOTAL_26.n - TOTAL_2.n;
  return h('div', { class: 'db', style: `--db-columns:${columns}` },
    h('div', { class: 'db-legend' },
      h('span', null, h('i', { class: 'db-swatch-a' }), '民2（也是民1）'),
      h('span', null, h('i', { class: 'db-swatch-b' }), '民26 第二次數點')),
    axis,
    h('div', { class: 'db-rows', role: 'list', 'aria-label': '十二支派兩次數點的人數' }, ...rows),
    h('div', { class: 'cb-total' },
      h('b', null, '合計'), ' ', fmt(TOTAL_1.n), ' → ', fmt(TOTAL_26.n),
      h('span', { class: 'cb-d down' }, ` ▼${fmt(Math.abs(totalD))}`)),
    h('p', { class: 'muted' },
      `變動最大：${drop.t.name}減少 ${fmt(Math.abs(drop.d))}（${fmt(drop.t.c2.n)} → ${fmt(drop.t.c26.n)}），${gain.t.name}增加 ${fmt(gain.d)}（${fmt(gain.t.c2.n)} → ${fmt(gain.t.c26.n)}）。`,
      ' 這裡只列兩次的數字，不推測每個支派增減的原因。'),
    h('ul', { class: 'facts' }, ...COUNT_FACTS.map((f) => h('li', null, factLine(f)))));
}

function levites(): HTMLElement {
  const sum = CLANS.reduce((s, c) => s + (c.count?.n ?? 0), 0);
  return h('div', { class: 'levi-sum' },
    h('table', { class: 'ord small' },
      h('caption', null, '利未三族的人數'),
      h('tbody', null,
        ...CLANS.filter((c) => c.count).map((c) => h('tr', null, h('th', { scope: 'row' }, c.name), h('td', null, fmt(c.count!.n), ' ', ...refChips([c.count!.ref], c.count!.zh)))),
        h('tr', { class: 'sum' }, h('th', { scope: 'row' }, '三族相加'), h('td', null, fmt(sum))),
        h('tr', { class: 'sum' }, h('th', { scope: 'row' }, '經文的總數'), h('td', null, fmt(LEVITE_TOTAL.n), ' ', ...refChips([LEVITE_TOTAL.ref], LEVITE_TOTAL.zh)))),
      h('tfoot', null, h('tr', null, h('td', { colspan: 2 }, `差 ${fmt(sum - LEVITE_TOTAL.n)} 人，各家讀法見「經文沒說的事」。`)))));
}

export function mountCompare(host: HTMLElement) {
  host.append(
    h('div', { class: 'cmp-grid' },
      h('div', { class: 'card pad' },
        h('h3', null, '三個場合，同一個次序'),
        h('p', { class: 'muted' }, '點一列會回到上面的地圖，看那個支派的資料。'),
        orderTable(),
        h('p', { class: 'fine' }, factLine(SAME_ORDER_FACT))),
      h('div', { class: 'card pad' },
        h('h3', null, '兩次數點'),
        countBars(),
        levites())));
}
