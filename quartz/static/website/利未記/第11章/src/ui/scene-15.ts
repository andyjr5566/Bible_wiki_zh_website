import {
  CASES, CHIP_TEXT, HEAL, HEAL_BIRDS, HEBREW_15, ITEMS, ITEMS_WOMEN, NOT_CAMP, NT_15, NT_15B, NT_15C, REASON_15, REEL_15, SUMMARY_15, VOICES_15,
  type Case, type Chip, type Item,
} from '../data/ch15';
import type { Fact } from '../data/types';
import { fill, h, s, svg } from './dom';
import { factLine, quietBadge, quoteLine, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/*
 * 第 15 章的呈現（2026-10 重新編排，內容全部沿用 data/ch15.ts）：
 * 這一章的知識有三個形狀：
 *   1. 四段並排：33 節按真實節數切成四段＋結語；四段的「不潔淨」「獻祭」對齊成同一列，一眼看出哪兩段要獻祭
 *   2. 多久：同一把尺（一格一天）畫「到晚上」「七天」「流的日子＋數七天＋第八天」
 *   3. 傳到哪裡：家裡八樣東西 × 五種後果的點陣表；瓦器和木器另附 Blender 示意圖（利15:12）
 * 3D 故事（母親的血漏）放在後面當例子，故事的最後一問接「為什麼要這樣」。
 */

const CASE = (id: Case['id']) => CASES.find((c) => c.id === id)!;
const ROW = (id: Case['id'], label: string) => CASE(id).rows.find((r) => r.label === label)!.fact;
const REFS = (id: Case['id'], ...labels: string[]) => labels.flatMap((l) => ROW(id, l).refs ?? []);

/* ------------------------------------------------------------ 1. 四段並排 */

/** 33 節，按節數畫寬度 */
const SPANS: { id: Case['id'] | 'end'; from: number; to: number; label: string }[] = [
  { id: 'man', from: 1, to: 15, label: CASE('man').title },
  { id: 'semen', from: 16, to: 18, label: '夢遺、同房' },
  { id: 'mens', from: 19, to: 24, label: CASE('mens').title },
  { id: 'flow', from: 25, to: 30, label: '血漏' },
  { id: 'end', from: 31, to: 33, label: '結語' },
];

function verseMap(): HTMLElement {
  return h('figure', { class: 'c15v', 'aria-label': '利未記 15 章 33 節：1–15 節男人的漏症，16–18 節夢遺和同房，19–24 節月經，25–30 節經期以外的血漏，31–33 節結語。' },
    h('div', { class: 'c15v-bar' }, ...SPANS.map((sp) => h('span', {
      class: `c15v-seg k-${sp.id}`, style: `flex:${sp.to - sp.from + 1}`, title: `利15:${sp.from}-${sp.to}　${sp.label}`,
    }, h('b', null, sp.label), h('small', null, `${sp.from}–${sp.to}`)))),
    h('div', { class: 'c15v-scale', 'aria-hidden': 'true' }, h('span', null, '第 1 節'), h('span', null, '一格寬度＝節數'), h('span', null, '第 33 節')));
}

function cases(): HTMLElement {
  const block = (label: string, fact: Fact, cls = '') => h('div', { class: `c15c-cell ${cls}${fact.status === 'not_stated' ? ' gap' : ''}` },
    h('small', null, label), h('p', null, factLine(fact)));
  return h('div', { class: 'c15c' }, ...CASES.map((c) => {
    const first = c.rows[0];
    const last = c.rows[c.rows.length - 1];
    const mid = c.rows.slice(1, -1);
    return h('section', { class: `c15c-col k-${c.id}` },
      h('header', { class: 'c15c-head' }, h('b', null, c.title), h('small', null, c.range)),
      block(first.label, first.fact, 'first'),
      h('div', { class: 'c15c-mid' }, ...mid.map((r) => h('div', { class: 'c15c-row' }, h('small', null, r.label), h('p', null, factLine(r.fact))))),
      block(last.label, last.fact, `offer${last.fact.status === 'not_stated' ? '' : ' yes'}`),
      c.voices?.length
        ? h('details', { class: 'c15c-voices' }, h('summary', null, `註釋怎麼說（${c.voices.length}）`), ...c.voices.map(voiceBlock))
        : h('div', { class: 'c15c-voices empty' }));
  }));
}

/* ------------------------------------------------------------ 2. 多久 */

const UNITS = 11.5; // 一把尺的總長（天）
const W = (d: number) => `${(d / UNITS) * 100}%`;

interface DurRow { name: string; sub: string; refs: string[]; kind: 'evening' | 'seven' | 'flow' }
const SHORT: DurRow[] = [
  { name: '碰到的人', sub: '摸床、座位、身體，被吐到', kind: 'evening', refs: REFS('man', '碰到的人') },
  { name: '夢遺、夫妻同房', sub: '', kind: 'evening', refs: REFS('semen', '不潔淨') },
  { name: '月經', sub: '', kind: 'seven', refs: REFS('mens', '不潔淨') },
  { name: '與她同房的男人', sub: '', kind: 'seven', refs: REFS('mens', '同房') },
];
const LONG: DurRow[] = [
  { name: '男人的漏症', sub: '', kind: 'flow', refs: REFS('man', '不潔淨', '好了以後', '獻祭') },
  { name: '經期以外的血漏', sub: '', kind: 'flow', refs: REFS('flow', '不潔淨', '好了以後', '獻祭') },
];
const FLOW = 2.5;
const DAYS = [1, 2, 3, 4, 5, 6, 7]; // 「流的日子」畫多長只是示意，用斷開記號表示

function dayCells(n: number, start: number, cls: string): HTMLElement[] {
  return Array.from({ length: n }, (_, i) => h('span', { class: `c15d-day ${cls}`, style: `left:${W(start + i)};width:calc(${W(1)} - 2px)` }));
}

function durRow(r: DurRow): HTMLElement {
  const track = h('div', { class: 'c15d-track' });
  if (r.kind === 'evening') {
    track.append(h('span', { class: 'c15d-seg unclean', style: `left:0;width:${W(0.62)}` }),
      h('span', { class: 'c15d-moon', style: `left:${W(0.62)}` }, svg(ICONS.moon), h('small', null, '到晚上')));
  } else if (r.kind === 'seven') {
    track.append(...dayCells(7, 0, 'unclean'), h('span', { class: 'c15d-lab', style: `left:${W(7)}` }, '七天'));
  } else {
    track.append(
      h('span', { class: 'c15d-seg flow', style: `left:0;width:${W(FLOW)}` }, h('span', null, '還在流')),
      h('span', { class: 'c15d-break', style: `left:${W(FLOW)}`, title: '流的日子長短不定，這一段不按比例' }),
      ...dayCells(7, FLOW + 0.25, 'count'),
      h('span', { class: 'c15d-day eighth', style: `left:${W(FLOW + 7.25)};width:calc(${W(1)} - 2px)`, title: '第八天：兩隻鳥，一隻贖罪祭，一隻燔祭' }, svg(ICONS.altar)));
  }
  return h('div', { class: `c15d-row k-${r.kind}` },
    h('div', { class: 'c15d-name' }, h('b', null, r.name), r.sub ? h('small', null, r.sub) : null, h('span', { class: 'c15d-refs' }, ...refChips(r.refs))),
    track);
}

function durations(): HTMLElement {
  const axis = (labels: [number, string][]) => h('div', { class: 'c15d-row c15d-axis', 'aria-hidden': 'true' }, h('div', { class: 'c15d-name' }),
    h('div', { class: 'c15d-track' }, ...labels.map(([d, t]) => h('span', { class: `c15d-tick${t === '好了' ? ' heal' : ''}`, style: `left:${W(d)}` }, t))));
  return h('figure', { class: 'c15d', 'aria-label': '不潔淨多久，同一把尺：碰到的人和夢遺、同房到晚上；月經和與她同房的男人七天；男人的漏症和血漏，流的日子長短不定，好了以後數七天，第八天獻祭。' },
    h('div', { class: 'c15d-legend' },
      h('span', null, h('i', { class: 'c15d-sw unclean' }), '不潔淨'),
      h('span', null, h('i', { class: 'c15d-sw count' }), '好了以後數的七天'),
      h('span', null, h('i', { class: 'c15d-sw eighth' }), '第八天：到會幕門口獻祭'),
      h('span', { class: 'c15d-unit' }, '一格＝一天')),
    h('div', { class: 'c15d-group' }, axis(DAYS.map((d) => [d - 0.5, String(d)])), ...SHORT.map(durRow)),
    h('div', { class: 'c15d-group long' }, axis([[FLOW + 0.25, '好了'], ...DAYS.map((d): [number, string] => [FLOW + d - 0.25, String(d)]), [FLOW + 7.75, '第 8 天']]), ...LONG.map(durRow),
      h('p', { class: 'c15d-note' }, '斷開的那一段是「還在流的日子」，要等到好了，長短不按比例；後面的七天、第八天和上面同一把尺。')),
    h('table', { class: 'sr-only' },
      h('caption', null, '不潔淨多久'),
      ...[...SHORT, ...LONG].map((r) => h('tr', null, h('th', null, r.name),
        h('td', null, r.kind === 'evening' ? '到晚上' : r.kind === 'seven' ? '七天' : '直到好了；好了以後數七天，第八天獻祭')))));
}

/* ------------------------------------------------------------ 3. 傳到哪裡 */

/** 家裡的東西：簡單的線條圖示 */
function itemIcon(id: Item['id']): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 48 48', class: 'c15m-ico', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.6, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
  const p = (d: string) => el.append(s('path', { d }));
  switch (id) {
    case 'bed':
      p('M6 14V36 M6 31H42V36');
      el.append(s('rect', { x: 10, y: 23, width: 11, height: 6, rx: 3 }));
      p('M24 31V25H38a4 4 0 0 1 4 4v2');
      break;
    case 'seat':
      el.append(s('ellipse', { cx: 24, cy: 18, rx: 13, ry: 5 }));
      p('M12 19L9 38 M36 19L39 38 M24 23V40');
      break;
    case 'body':
      el.append(s('circle', { cx: 24, cy: 13, r: 6 }));
      p('M14 40V28a10 10 0 0 1 20 0V40');
      break;
    case 'spit':
      p('M24 7C24 7 12 21 12 29a12 12 0 0 0 24 0C36 21 24 7 24 7Z');
      break;
    case 'saddle':
      p('M8 26C14 16 34 16 40 26L40 30H8Z M16 30V40 M32 30V40');
      break;
    case 'hands':
      p('M24 12C24 12 16 22 16 28a8 8 0 0 0 16 0C32 22 24 12 24 12Z M10 38L38 10');
      break;
    case 'clay':
      p('M17 10H31 M18 10C12 18 10 24 10 30C10 38 17 42 24 42C31 42 38 38 38 30C38 24 36 18 30 10');
      break;
    case 'wood':
      p('M7 20H41C41 32 33 40 24 40C15 40 7 32 7 20Z M16 44H32');
      break;
  }
  return el;
}

const CHIPS: Chip[] = ['evening', 'wash', 'bathe', 'break', 'rinse'];

/** 八樣東西 × 五種後果；點一列看經文和註釋 */
function matrix(): HTMLElement {
  const detail = h('div', { class: 'c15m-detail', 'aria-live': 'polite' });
  const rows: HTMLTableRowElement[] = [];
  const btns: HTMLButtonElement[] = [];
  function pick(it: Item) {
    ITEMS.forEach((x, i) => {
      btns[i].setAttribute('aria-pressed', String(x === it));
      rows.filter((r) => r.dataset.item === x.id).forEach((r) => r.classList.toggle('on', x === it));
    });
    fill(detail,
      h('div', { class: 'c15m-detail-head' }, itemIcon(it.id), h('b', null, it.label)),
      h('p', null, quoteLine(it.fact)),
      ...(it.voices ?? []).map(voiceBlock));
  }
  const body = ITEMS.flatMap((it, i) => it.results.map((r, j) => {
    const first = j === 0;
    const btn = first
      ? h('button', { type: 'button', class: 'c15m-item', 'aria-pressed': 'false', onclick: () => pick(it) }, itemIcon(it.id), h('span', null, it.label))
      : null;
    if (btn) btns[i] = btn as HTMLButtonElement;
    const tr = h('tr', { 'data-item': it.id, class: `${first ? '' : 'sub'}${it.id === 'clay' || it.id === 'wood' ? ' vessel' : ''}` },
      first ? h('th', { scope: 'row', rowspan: String(it.results.length) }, btn) : null,
      h('td', { class: 'c15m-who' }, r.who),
      ...CHIPS.map((c) => h('td', { class: `c15m-dot${r.chips.includes(c) ? ` y c-${c}` : ''}` },
        r.chips.includes(c) ? h('i', { title: `${r.who}：${CHIP_TEXT[c]}` }) : null,
        h('span', { class: 'sr-only' }, r.chips.includes(c) ? CHIP_TEXT[c] : ''))));
    tr.addEventListener('click', (e) => { if (!(e.target as HTMLElement).closest('button')) pick(it); });
    rows.push(tr as HTMLTableRowElement);
    return tr;
  }));
  const table = h('table', { class: 'c15m-t' },
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, '他碰過的'), h('th', { scope: 'col' }, '誰／什麼'),
      ...CHIPS.map((c) => h('th', { scope: 'col', class: `c15m-ch c-${c}` }, h('span', null, CHIP_TEXT[c]))))),
    h('tbody', null, ...body));
  pick(ITEMS[0]);
  return h('div', { class: 'c15m' },
    h('div', { class: 'c15m-wrap' }, table),
    detail,
    h('p', { class: 'c15m-note' }, factLine(ITEMS_WOMEN)));
}

/** 利15:12：瓦器打破、木器涮洗（Blender 示意） */
function vessels(): HTMLElement {
  const clay = ITEMS.find((i) => i.id === 'clay')!;
  const wood = ITEMS.find((i) => i.id === 'wood')!;
  const pin = (t: string, x: number, y: number) => h('span', { class: 'c15k-pin', style: `left:${x}%;top:${y}%` }, t);
  return h('figure', { class: 'c15k' },
    h('div', { class: 'c15k-stage' },
      h('img', {
        src: 'images/c15-vessels-1600.webp', srcset: 'images/c15-vessels-900.webp 900w, images/c15-vessels-1600.webp 1600w', sizes: '(max-width: 760px) 100vw, 900px',
        width: '1600', height: '900', loading: 'lazy', decoding: 'async', alt: '示意圖：左邊是打破的瓦器碎片，右邊是盛著水的木器。',
      }),
      pin('瓦器：打破', 27, 18), pin('木器：用水涮洗', 78, 22),
      h('span', { class: 'c15k-badge' }, '示意圖（Blender）：只畫利15:12 寫到的瓦器和木器')),
    h('figcaption', null, h('p', null, quoteLine(clay.fact)), h('p', null, quoteLine(wood.fact))));
}

/* ------------------------------------------------------------ 4. 好了以後 */

function heal(): HTMLElement {
  const [man, woman] = HEAL;
  const cell = (st: { label: string; fact: Fact }) => h('td', { class: st.fact.status === 'not_stated' ? 'gap' : null },
    h('b', null, st.label), h('span', { class: 'c15h-refs' }, ...refChips(st.fact.refs, st.fact.q), ' ', quietBadge(st.fact.status)));
  return h('div', { class: 'c15h' },
    h('table', { class: 'c15h-t' },
      h('thead', null, h('tr', null, h('th', null, ''), h('th', { scope: 'col' }, man.who), h('th', { scope: 'col' }, woman.who))),
      h('tbody', null, ...man.steps.map((st, i) => h('tr', { class: woman.steps[i].fact.status === 'not_stated' ? 'diff' : null },
        h('th', { scope: 'row' }, String(i + 1)), cell(st), cell(woman.steps[i]))))),
    h('div', { class: 'c15h-birds' }, h('p', null, factLine(HEAL_BIRDS)), voiceBlock(VOICES_15.birds)));
}

/* ------------------------------------------------------------ 組起來 */

export function buildC15(): HTMLElement {
  const reel = mountReel(REEL_15);
  const why = h('div', { class: 'c15-why card' },
    h('h3', null, '為什麼要這樣'),
    h('p', { class: 'c15-why-q' }, factLine(REASON_15, { quote: true })),
    h('div', { class: 'c15-voices' }, voiceBlock(VOICES_15.ritualBH), voiceBlock(VOICES_15.notEthic), voiceBlock(VOICES_15.leprosy)));
  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「雖然說是我不潔淨，但不是在說我做錯了什麼，流血我自己也沒辦法。可是不潔淨和神的帳幕不能碰在一起，所以我坐過的、躺過的，碰到的人，都要洗一洗、等到晚上。我的血止住以後，數七天，第八天帶兩隻鳥到會幕門口，一隻作贖罪祭，一隻作燔祭。」', reel.el, why);

  return h('article', { class: 'scene scene-15', style: '--c:var(--c15)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('c15')),
        h('h1', null, '身體的漏症'),
        h('p', { class: 'lede' }, '這一章寫身體流出東西的幾種情況：男人的漏症、夢遺和夫妻同房、女人的月經，以及經期以外的血漏。不潔淨會從人傳到床、座位和器皿，再傳到碰到的人。這一次，是母親的月事過了，血卻沒有止住。')),
      layer('四段並排', '上面一條按節數畫；下面四欄，「不潔淨」和「獻祭」對齊在同一列', verseMap(), cases(),
        h('div', { class: 'c15-notes' }, h('p', null, factLine(SUMMARY_15, { quote: true })), h('p', null, factLine(NOT_CAMP)))),
      layer('不潔淨多久', '同一把尺，一格一天', durations()),
      layer('傳到哪裡', '男人患漏症的時候：他碰過的東西，和碰到這些東西的人；點一列看經文', matrix(), vessels())),
    h('div', { class: 'wrap' }, layer('好了以後', '男人和女人並排，差在第 3 步', heal())),
    h('div', { class: 'wrap' }, layer('母親的例子', '月事過了，血卻沒有止住', null)),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      why,
      layer('今天怎麼讀', '新約裡的一個女人',
        ntCard(h('p', null, factLine(NT_15, { quote: true })), h('p', null, factLine(NT_15B, { quote: true })), h('p', null, factLine(NT_15C)),
          h('div', { class: 'c15-voices two' }, voiceBlock(VOICES_15.ntDing), voiceBlock(VOICES_15.ntLove)))),
      study('原文與背景', ...HEBREW_15.map((f) => h('p', { class: 'study-p' }, factLine(f))),
        voiceBlock(VOICES_15.body), voiceBlock(VOICES_15.demon), voiceBlock(VOICES_15.exorcism), voiceBlock(VOICES_15.fall), voiceBlock(VOICES_15.blood), voiceBlock(VOICES_15.nazirite)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 15, from: 1, to: 15, title: '利未記 15:1-15：男人的漏症' },
        { ch: 15, from: 16, to: 18, title: '利未記 15:16-18：夢遺、同房' },
        { ch: 15, from: 19, to: 30, title: '利未記 15:19-30：女人的月經和血漏' },
        { ch: 15, from: 31, to: 33, title: '利未記 15:31-33：為什麼要有這些條例' },
        { book: '太', ch: 9, from: 20, to: 22, title: '馬太福音 9:20-22：血漏的女人' },
      ])),
      voicesLink('患漏症的人要不要出營？這些不潔淨是不是罪？', 'GT 丁良才說要出營，GT《串珠》說不必，本章經文沒有寫；各家對「不潔」的讀法也不完全一樣', 'camp'),
      sceneNav('c15')));
}
