import {
  CASES, CHIP_TEXT, HEAL, HEAL_BIRDS, HEBREW_15, ITEMS, ITEMS_WOMEN, NOT_CAMP, NT_15, NT_15B, NT_15C, REASON_15, REEL_15, SUMMARY_15, VOICES_15,
  type Item,
} from '../data/ch15';
import { fill, h, s } from './dom';
import { factLine, quietBadge, quoteLine, refChips, voiceBlock } from './evidence';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/** 家裡的東西：簡單的線條圖示 */
function itemIcon(id: Item['id']): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 48 48', class: 'item-ico', fill: 'none', stroke: 'currentColor', 'stroke-width': 2.4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' });
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

/** 點一樣東西，看碰到它的人會怎樣 */
function items(): HTMLElement {
  const out = h('div', { class: 'item-out', 'aria-live': 'polite' });
  const tiles: HTMLElement[] = [];
  function pick(it: Item) {
    tiles.forEach((t, i) => t.setAttribute('aria-pressed', String(ITEMS[i] === it)));
    fill(out,
      h('div', { class: 'item-head' }, h('small', null, '男人患漏症的時候'), h('b', null, it.label)),
      ...it.results.map((r) => h('div', { class: 'item-res' },
        h('span', { class: 'item-who' }, r.who),
        h('span', { class: 'chips' }, ...r.chips.map((c) => h('span', { class: `chip chip-${c}` }, CHIP_TEXT[c]))))),
      h('p', { class: 'item-fact' }, quoteLine(it.fact)),
      ...(it.voices ?? []).map(voiceBlock));
    out.classList.remove('swap');
    void out.offsetWidth;
    out.classList.add('swap');
  }
  for (const it of ITEMS) tiles.push(h('button', { type: 'button', class: 'item-tile', 'aria-pressed': 'false', onclick: () => pick(it) }, itemIcon(it.id), h('b', null, it.label)));
  pick(ITEMS[0]);
  return h('div', { class: 'items card' },
    h('div', { class: 'item-grid', role: 'group', 'aria-label': '家裡的東西' }, ...tiles),
    out,
    h('p', { class: 'item-note' }, factLine(ITEMS_WOMEN)));
}

/** 四種情況並排：不潔淨多久、碰到的人、好了以後、要不要獻祭 */
function cases(): HTMLElement {
  return h('div', { class: 'cases' }, ...CASES.map((c, i) => h('section', { class: `case card case-${c.id}`, style: `--i:${i}` },
    h('div', { class: 'case-head' }, h('b', null, c.title), h('small', null, c.range)),
    h('dl', { class: 'case-rows' }, ...c.rows.flatMap((r) => [h('dt', null, r.label), h('dd', null, factLine(r.fact))])),
    c.voices?.length
      ? h('details', { class: 'case-voices' }, h('summary', null, `註釋怎麼說（${c.voices.length}）`), ...c.voices.map(voiceBlock))
      : null)));
}

/** 好了以後：男人和女人走的路，一步一步對照 */
function heal(): HTMLElement {
  return h('div', { class: 'heal' },
    ...HEAL.map((lane) => h('div', { class: 'heal-lane card' },
      h('b', { class: 'heal-who' }, lane.who),
      h('ol', { class: 'heal-steps' }, ...lane.steps.map((st, i) => h('li', { class: `step${st.fact.status === 'not_stated' ? ' gap' : ''}`, style: `--i:${i}` },
        h('span', { class: 'step-n' }, String(i + 1)),
        h('span', { class: 'step-l' }, st.label),
        h('span', { class: 'step-r' }, ...refChips(st.fact.refs, st.fact.q), ' ', quietBadge(st.fact.status))))))),
    h('p', { class: 'heal-note' }, factLine(HEAL_BIRDS)),
    voiceBlock(VOICES_15.birds));
}

export function buildC15(): HTMLElement {
  const reel = mountReel(REEL_15);
  const keys = h('div', { class: 'keys' },
    h('div', { class: 'key card' }, h('h3', null, '碰到會怎樣'),
      h('ul', { class: 'key-lines' },
        h('li', null, '她躺的床、坐的東西，都不潔淨 ', ...refChips(['利15:4', '利15:26'])),
        h('li', null, '摸到的人，不潔淨到晚上，還要洗衣服、洗澡 ', ...refChips(['利15:5-7', '利15:21-22', '利15:27'])),
        h('li', null, '男人漏症時摸過的瓦器要打破，木器用水涮洗 ', ...refChips(['利15:12'])))),
    h('div', { class: 'key card' }, h('h3', null, '好了以後'),
      h('ul', { class: 'key-lines' },
        h('li', null, '計算七天；男人還要洗衣服、用活水洗身 ', ...refChips(['利15:13', '利15:28'])),
        h('li', null, '第八天，兩隻斑鳩或兩隻雛鴿，帶到會幕門口 ', ...refChips(['利15:14', '利15:29'])),
        h('li', null, '一隻作贖罪祭，一隻作燔祭 ', ...refChips(['利15:15', '利15:30'])))),
    h('div', { class: 'key card wide' }, h('h3', null, '為什麼要這樣'),
      h('p', null, factLine(REASON_15, { quote: true })),
      h('div', { class: 'two-voices' }, voiceBlock(VOICES_15.ritualBH), voiceBlock(VOICES_15.notEthic)),
      voiceBlock(VOICES_15.leprosy)));

  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「雖然說是我不潔淨，但不是在說我做錯了什麼，流血我自己也沒辦法。可是不潔淨和神的帳幕不能碰在一起，所以我坐過的、躺過的，碰到的人，都要洗一洗、等到晚上。我的血止住以後，數七天，第八天帶兩隻鳥到會幕門口，一隻作贖罪祭，一隻作燔祭。」', reel.el, keys);

  return h('article', { class: 'scene', style: '--c:var(--c15)' },
    h('div', { class: 'wrap' }, h('header', { class: 'scene-head' },
      h('div', { class: 'kicker' }, kicker('c15')),
      h('h1', null, '身體的漏症'),
      h('p', { class: 'lede' }, '這一章寫身體流出東西的幾種情況：男人的漏症、夢遺和夫妻同房、女人的月經，以及經期以外的血漏。不潔淨會從人傳到床、座位和器皿，再傳到碰到的人。這一次，是母親的月事過了，血卻沒有止住。'))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      layer('重點', '母親說的，整理成三件事', keys),
      layer('家裡的東西', '點一樣東西，看碰到它的人會怎樣', items()),
      layer('四種情況', '不潔淨多久、碰到的人、好了以後、要不要獻祭', cases(),
        h('p', { class: 'cases-note' }, factLine(SUMMARY_15, { quote: true })),
        h('p', { class: 'cases-note' }, factLine(NOT_CAMP))),
      layer('好了以後', '男人和女人，差在哪一步', heal()),
      layer('今天怎麼讀', '新約裡的一個女人',
        ntCard(h('p', null, factLine(NT_15, { quote: true })), h('p', null, factLine(NT_15B, { quote: true })), h('p', null, factLine(NT_15C)),
          h('div', { class: 'two-voices' }, voiceBlock(VOICES_15.ntDing), voiceBlock(VOICES_15.ntLove)))),
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
