import {
  HEBREW_14, HOUSE, MARK_CLEANSE, MARK_EXODUS, MARK_OIL, MARK_ORDAIN, NT_14, REEL_14, RICH_POOR, RICH_POOR_NOTE, ROUTE, VOICES_14,
} from '../data/ch14';
import { h, s } from './dom';
import { factLine, quoteLine, refChips, voiceBlock } from './evidence';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { decide, type Node } from './decide';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/** 三個地方、八天：一條往回走的路 */
function route(): HTMLElement {
  return h('ol', { class: 'route' }, ...ROUTE.map((r, i) => h('li', { class: 'route-stop card', style: `--i:${i}` },
    h('span', { class: 'route-n' }, String(i + 1)),
    h('div', { class: 'route-head' }, h('b', null, r.place), h('small', null, r.when)),
    h('ul', null, ...r.acts.map((f) => h('li', null, h('span', null, f.text), ' ', ...refChips(f.refs, f.q)))))));
}

/** 人形示意：右耳垂、右手大拇指、右腳大拇指三個點 */
function figureDots(label: string, oil: boolean): HTMLElement {
  const el = s('svg', { viewBox: '0 0 120 220', class: 'dots-fig', role: 'img', 'aria-label': `${label}：右耳垂、右手大拇指、右腳大拇指` });
  el.append(s('circle', { cx: 60, cy: 32, r: 20, fill: 'var(--surface-2)', stroke: 'var(--line-2)', 'stroke-width': 2 }));
  el.append(s('path', { d: 'M38 60 L82 60 L96 150 L24 150 Z', fill: 'var(--surface-2)', stroke: 'var(--line-2)', 'stroke-width': 2 }));
  el.append(s('path', { d: 'M38 64 L18 128 M82 64 L102 128', stroke: 'var(--line-2)', 'stroke-width': 8, 'stroke-linecap': 'round' }));
  el.append(s('path', { d: 'M46 150 L42 206 M74 150 L78 206', stroke: 'var(--line-2)', 'stroke-width': 9, 'stroke-linecap': 'round' }));
  // 從觀看者看，人的右邊在畫面左邊
  for (const [x, y] of [[40, 34], [18, 130], [40, 208]]) {
    el.append(s('circle', { cx: x, cy: y, r: 7, fill: '#a01d2c' }));
    if (oil) el.append(s('circle', { cx: x + 9, cy: y - 7, r: 5, fill: '#e2b23a' }));
  }
  if (oil) el.append(s('circle', { cx: 60, cy: 14, r: 7, fill: '#e2b23a' }));
  return h('figure', { class: 'dots-figure' }, el, h('figcaption', null, label));
}

function compareOrdination(): HTMLElement {
  return h('div', { class: 'ordain' },
    h('div', { class: 'ordain-side card' }, figureDots('祭司承接聖職', false), h('p', null, quoteLine(MARK_ORDAIN)), h('p', { class: 'ordain-ref' }, factLine(MARK_EXODUS))),
    h('div', { class: 'ordain-side card' }, figureDots('長大痲瘋的人得潔淨', true), h('p', null, quoteLine(MARK_CLEANSE)), h('p', { class: 'ordain-ref' }, factLine(MARK_OIL))),
    h('div', { class: 'two-voices ordain-voices' }, voiceBlock(VOICES_14.ordainDiff), voiceBlock(VOICES_14.grace)));
}

function richPoor(): HTMLElement {
  return h('div', { class: 'ladder card' },
    h('table', { class: 'ladder-t rp' },
      h('thead', null, h('tr', null, h('th', null, '項目'), h('th', null, '一般的（v10-20）'), h('th', null, '貧窮的（v21-32）'))),
      h('tbody', null, ...RICH_POOR.map((r) => h('tr', { class: r.same ? 'same' : null },
        h('td', { class: 'verb' }, r.item),
        h('td', null, factLine(r.rich)),
        h('td', null, factLine(r.poor), r.same ? h('span', { class: 'same-tag' }, '不能減') : null))))),
    h('p', { class: 'rp-note' }, factLine(RICH_POOR_NOTE)),
    h('div', { class: 'two-voices' }, voiceBlock(VOICES_14.poorDing), voiceBlock(VOICES_14.poorJD)),
    voiceBlock(VOICES_14.log));
}

/** 房屋：示意圖 */
function houseArt(state: string): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 240 200', class: 'skin-art', role: 'img', 'aria-label': '一間石頭房子（示意）' });
  if (state === 'demolish') {
    for (let i = 0; i < 14; i++) el.append(s('rect', { x: 30 + (i * 37) % 170, y: 150 + (i % 3) * 12, width: 26, height: 14, rx: 3, fill: '#b9a587', stroke: '#8a7a5a', transform: `rotate(${(i * 23) % 40 - 20} ${40 + (i * 37) % 170} 160)` }));
    el.append(s('text', { x: 120, y: 80, 'text-anchor': 'middle', class: 'art-big' }, '拆毀'));
    return el;
  }
  el.append(s('path', { d: 'M30 70 L120 24 L210 70 Z', fill: '#9a7650', stroke: '#6b4a2a', 'stroke-width': 2 }));
  el.append(s('rect', { x: 40, y: 70, width: 160, height: 112, fill: '#d9c9a6', stroke: '#8a7a5a', 'stroke-width': 2 }));
  for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) {
    const x = 42 + c * 26.5 + (r % 2 ? 13 : 0), y = 72 + r * 22;
    if (x > 190) continue;
    const sick = (state === 'start' || state === 'look' || state === 'h7') && r >= 1 && r <= 2 && c >= 3 && c <= 4;
    const fresh = (state === 'again' || state === 'birds' || state === 'clean') && r >= 1 && r <= 2 && c >= 3 && c <= 4;
    el.append(s('rect', { x, y, width: 24, height: 20, rx: 2, fill: sick ? '#7f9a5a' : fresh ? '#efe6d0' : '#cdb994', stroke: '#9a8a6a' }));
    if (sick) el.append(s('ellipse', { cx: x + 12, cy: y + 10, rx: 7, ry: 5, fill: '#a5463a', opacity: 0.7 }));
  }
  el.append(s('rect', { x: 104, y: 136, width: 32, height: 46, fill: '#6b4a2a' }));
  if (state === 'h7' || state === 'look') {
    el.append(s('rect', { x: 150, y: 24, width: 74, height: 30, rx: 10, fill: '#6b4ea2' }));
    el.append(s('text', { x: 187, y: 44, 'text-anchor': 'middle', class: 'art-tag' }, '封鎖七天'));
  }
  if (state === 'clean') {
    el.append(s('circle', { cx: 196, cy: 40, r: 22, fill: '#2f7a48' }));
    el.append(s('path', { d: 'M186 40l8 8 14-16', stroke: '#fff', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }));
  }
  return el;
}

const HOUSE_NODES: Node[] = [
  { id: 'start', when: '多年以後，在迦南', ask: '房主發現牆上有斑。', choices: [{ label: '去告訴祭司', facts: [HOUSE.canaan, HOUSE.report], next: 'look' }] },
  { id: 'look', when: '祭司來了', ask: '祭司進去以前，先做什麼？', choices: [{ label: '叫人把房子騰空，再進去看', facts: [HOUSE.empty, HOUSE.look], next: 'h7' }] },
  { id: 'h7', when: '第 7 天', ask: '祭司再去看：斑在牆上擴散了。', choices: [{ label: '挖出病石、刮掉灰泥、重新墁牆', facts: [HOUSE.spread], next: 'again' }] },
  { id: 'again', when: '墁過以後', ask: '祭司又進去看：', choices: [
    { label: '斑又出現，而且擴散', facts: [HOUSE.again], end: 'demolish' },
    { label: '沒有再擴散', facts: [HOUSE.clean], next: 'birds' },
  ] },
  { id: 'birds', when: '定為潔淨以後', ask: '還有一件事：', choices: [{ label: '用兩隻鳥潔淨房子', facts: [HOUSE.birds, HOUSE.atone], end: 'clean' }] },
];

export function buildC14(): HTMLElement {
  const reel = mountReel(REEL_14);
  const keys = h('div', { class: 'keys' },
    h('div', { class: 'key card' }, h('h3', null, '三個地方'),
      h('ul', { class: 'key-lines' },
        h('li', null, '營外：兩隻鳥，灑七次，定為潔淨 ', ...refChips(['利14:3-7'])),
        h('li', null, '自己的帳棚外：等七天，第七天再剃一次 ', ...refChips(['利14:8-9'])),
        h('li', null, '會幕門口：第八天獻四樣祭 ', ...refChips(['利14:10-20'])))),
    h('div', { class: 'key card' }, h('h3', null, '第八天的四樣祭'),
      h('ul', { class: 'key-lines' },
        h('li', null, '贖愆祭（搖祭，連油一起搖） ', ...refChips(['利14:12'])),
        h('li', null, '贖罪祭、燔祭、素祭 ', ...refChips(['利14:19-20'])),
        h('li', null, '血和油抹在右耳垂、右手大拇指、右腳大拇指 ', ...refChips(['利14:14-17'])))),
    h('div', { class: 'key card wide' }, h('h3', null, '禮在病好之後'),
      h('p', null, factLine({ text: '祭司出營，是去看病「痊癒了」沒有；這套禮是給已經好了的人', status: 'explicit', refs: ['利14:3'], q: '若見他的大痲瘋痊癒了' })),
      voiceBlock(VOICES_14.notMagic)));

  const bridge = answerBridge({ id: 'father', label: '父親回答女兒' },
    '「那是潔淨的禮。在營外，兩隻鳥，一隻宰在活水上，一隻放走，祭司向我灑了七次。我在帳棚外等了七天。第八天到會幕門口，獻了四樣祭，祭司把血和油抹在我的耳朵、手和腳上。一步一步，才回到家。」', reel.el, keys);

  return h('article', { class: 'scene', style: '--c:var(--c14)' },
    h('div', { class: 'wrap' }, h('header', { class: 'scene-head' },
      h('div', { class: 'kicker' }, kicker('c14')),
      h('h1', null, '回到營裡'),
      h('p', { class: 'lede' }, '上一章只寫到判定：確診的人要獨居營外。這一章寫回來的路，從營外、自己的帳棚外，一直到會幕門口。後半章另外講房屋上的災病。'))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      layer('重點', '父親說的，整理成三件事', keys),
      layer('回家的路', '三個地方、八天', route(), h('div', { class: 'two-voices' }, voiceBlock(VOICES_14.twoBirds), voiceBlock(VOICES_14.notRite))),
      layer('和承接聖職比一比', '同樣的三個地方：耳、手、腳', compareOrdination()),
      layer('窮人怎麼辦', '有的可以減，有的不能減', richPoor()),
      layer('房屋上的斑', '這是到了迦南、住進房子以後的條例', decide(HOUSE_NODES, houseArt, { title: '一間石頭房子', startLabel: '你的判斷紀錄' }),
        h('p', { class: 'house-note' }, factLine(HOUSE.inside)),
        h('div', { class: 'two-voices' }, voiceBlock(VOICES_14.houseNotJudge), voiceBlock(VOICES_14.houseNoOffer))),
      layer('今天怎麼讀', '新約裡的一句話', ntCard(h('p', null, factLine(NT_14, { quote: true })), voiceBlock(VOICES_14.bloodWater))),
      study('原文與背景', ...HEBREW_14.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_14.hurrian), voiceBlock(VOICES_14.practical)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 14, from: 1, to: 32, title: '利未記 14:1-32：長大痲瘋的人得潔淨' },
        { ch: 14, from: 33, to: 57, title: '利未記 14:33-57：房屋的災病' },
      ])),
      voicesLink('那兩隻鳥算不算祭？剃毛有沒有意思？', '有的註釋說這還不是祭，有的說是；剃毛有的說只是為了看清楚皮膚，有的讀出象徵', 'twoBirds'),
      sceneNav('c14')));
}
