import { COUNT_FACTS, SAME_ORDER_FACT } from '../data/center';
import { CLANS, LEVITE_TOTAL } from '../data/levites';
import { CAMPS, TOTAL_1, TOTAL_2, TOTAL_26, TRIBES, camp, fmt, tribesOf } from '../data/tribes';
import * as store from '../store';
import { h } from './dom';
import { factLine, refChips } from './evidence';
import { CAMP_STYLE } from './meta';
import { revealPanel } from './panel';

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
  const max = Math.max(...TRIBES.map((t) => Math.max(t.c2.n, t.c26.n)));
  const deltas = TRIBES.map((t) => ({ t, d: t.c26.n - t.c2.n }));
  const drop = deltas.reduce((a, b) => (b.d < a.d ? b : a));
  const gain = deltas.reduce((a, b) => (b.d > a.d ? b : a));
  const rows = ORDERED.map((t) => {
    const d = t.c26.n - t.c2.n;
    return h('div', { class: 'cb-row', style: `--c:${CAMP_STYLE[t.camp].color}` },
      h('span', { class: 'cb-name' }, t.name),
      h('span', { class: 'cb-bars' },
        h('span', { class: 'cb-bar a', style: `width:${(t.c2.n / max) * 100}%`, title: `民2 ${fmt(t.c2.n)}` }),
        h('span', { class: 'cb-bar b', style: `width:${(t.c26.n / max) * 100}%`, title: `民26 ${fmt(t.c26.n)}` })),
      h('span', { class: 'cb-n' }, fmt(t.c2.n), ' → ', fmt(t.c26.n)),
      h('span', { class: `cb-d ${d >= 0 ? 'up' : 'down'}` }, `${d >= 0 ? '▲' : '▼'}${fmt(Math.abs(d))}`));
  });
  const totalD = TOTAL_26.n - TOTAL_2.n;
  return h('div', { class: 'count-bars' },
    h('div', { class: 'cb-legend' },
      h('span', null, h('i', { class: 'lg a' }), '民2（也是民1）'),
      h('span', null, h('i', { class: 'lg b' }), '民26 第二次數點')),
    ...rows,
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
