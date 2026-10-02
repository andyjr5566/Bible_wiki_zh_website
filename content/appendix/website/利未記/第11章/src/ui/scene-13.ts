import {
  CLOTH, FOUR_ACTS, HEBREW_13, INSPECT, MOURN_PRIEST, MOURN_SAME, MOURN_SICK, NT_13, REEL_13, SPECIAL, VOICES_13,
} from '../data/ch13';
import { h, s } from './dom';
import { factLine, quoteLine, refChips, voiceBlock } from './evidence';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { decide, type Node } from './decide';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

const C = (id: string) => CLOTH.find((c) => c.id === id)!.fact;

/** 皮膚上的斑：示意圖，不畫寫實的病況 */
function skinArt(state: string): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 240 200', class: 'skin-art', role: 'img', 'aria-label': '皮膚上的一塊斑（示意）' });
  el.append(s('rect', { x: 10, y: 10, width: 220, height: 180, rx: 26, fill: '#e2b48c' }));
  for (let i = 0; i < 26; i++) {
    const x = 26 + (i * 37) % 190, y = 24 + (i * 53) % 150;
    el.append(s('path', { d: `M${x} ${y} q3 -7 7 -9`, stroke: '#7a5236', 'stroke-width': 1.4, fill: 'none', 'stroke-linecap': 'round' }));
  }
  const spot = (r: number, fill: string, stroke = 'none') => el.append(s('path', {
    d: `M${120 - r} 100 C ${120 - r} ${100 - r * 0.9}, ${120 + r * 0.7} ${100 - r * 1.05}, ${120 + r} ${100 - r * 0.2} S ${120 + r * 0.4} ${100 + r}, ${120 - r * 0.3} ${100 + r * 0.85} S ${120 - r * 1.05} ${100 + r * 0.4}, ${120 - r} 100 Z`,
    fill, stroke, 'stroke-width': 3,
  }));
  if (state === 'clean') {
    el.append(s('circle', { cx: 120, cy: 100, r: 30, fill: '#2f7a48', opacity: 0.9 }));
    el.append(s('path', { d: 'M106 100l10 10 20-22', stroke: '#fff', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    return el;
  }
  if (state === 'unclean') spot(66, '#f3ece0', '#b3263a');
  else if (state === 'after') spot(30, '#cfb79c');
  else spot(36, '#f6efe4');
  // 斑上的毛
  for (let i = 0; i < 5; i++) el.append(s('path', { d: `M${104 + i * 8} ${92 + (i % 2) * 8} q3 -7 7 -9`, stroke: state === 'unclean' ? '#fff' : '#7a5236', 'stroke-width': 1.6, fill: 'none' }));
  if (state === 'd7' || state === 'd14') {
    el.append(s('rect', { x: 150, y: 22, width: 70, height: 34, rx: 10, fill: '#6b4ea2' }));
    el.append(s('text', { x: 185, y: 45, 'text-anchor': 'middle', class: 'art-tag' }, state === 'd7' ? '第 7 天' : '第 14 天'));
  }
  return el;
}

/** 衣服：示意圖 */
function clothArt(state: string): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 240 200', class: 'skin-art', role: 'img', 'aria-label': '一件衣服（示意）' });
  el.append(s('path', { d: 'M78 22 L40 46 L54 76 L70 68 L70 182 L170 182 L170 68 L186 76 L200 46 L162 22 C150 36 132 42 120 42 C108 42 90 36 78 22 Z', fill: '#d9c9a6', stroke: '#8a7a5a', 'stroke-width': 2.5 }));
  for (let y = 70; y < 180; y += 10) el.append(s('path', { d: `M72 ${y}H168`, stroke: '#c4b28a', 'stroke-width': 1 }));
  if (state === 'clean') {
    el.append(s('circle', { cx: 120, cy: 120, r: 26, fill: '#2f7a48' }));
    el.append(s('path', { d: 'M108 120l9 9 17-19', stroke: '#fff', 'stroke-width': 6, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  } else if (state === 'tear') {
    el.append(s('path', { d: 'M100 104 l14 -8 l12 10 l10 -6 l4 26 l-14 8 l-12 -10 l-12 6 z', fill: 'var(--bg)', stroke: '#8a7a5a', 'stroke-width': 2, 'stroke-dasharray': '4 3' }));
  } else if (state === 'burn') {
    el.append(s('path', { d: 'M120 70c10 22 40 34 40 66a40 40 0 0 1-80 0c0-20 14-28 16-42 8 8 10 16 12 22 8-14 10-30 12-46z', fill: '#e2711d', opacity: 0.9 }));
  } else {
    el.append(s('ellipse', { cx: 122, cy: 116, rx: state === 'c14' ? 16 : 22, ry: state === 'c14' ? 12 : 17, fill: state === 'c14' ? '#7a8f6a' : '#5f8f4a', opacity: 0.85 }));
    el.append(s('ellipse', { cx: 134, cy: 124, rx: 8, ry: 6, fill: '#b04a3a', opacity: 0.7 }));
  }
  return el;
}

const SKIN_NODES: Node[] = [
  { id: 'start', when: '第 1 天', ask: '祭司看那塊斑：毛變白了嗎？深於皮嗎？', choices: [
    { label: '毛變白，又深於皮', facts: [INSPECT.both], end: 'unclean' },
    { label: '看不準（只有一樣，或兩樣都沒有）', facts: [INSPECT.shut1], next: 'd7' },
  ] },
  { id: 'd7', when: '第 7 天', ask: '祭司再看：斑有沒有擴散？', choices: [
    { label: '擴散了', facts: [INSPECT.spread], end: 'unclean' },
    { label: '停住了，沒有擴散', facts: [INSPECT.shut2], next: 'd14' },
  ] },
  { id: 'd14', when: '第 14 天', ask: '祭司第三次看：', choices: [
    { label: '發暗了，也沒有擴散', facts: [INSPECT.clean], next: 'after' },
    { label: '擴散了', facts: [INSPECT.spread], end: 'unclean' },
  ] },
  { id: 'after', when: '定為潔淨以後', ask: '後來呢？', choices: [
    { label: '沒有再發', end: 'clean' },
    { label: '又在皮上擴散開了', facts: [INSPECT.later, INSPECT.spread], end: 'unclean' },
  ] },
];

const CLOTH_NODES: Node[] = [
  { id: 'start', when: '一開始', ask: '羊毛、麻布或皮子上，出現發綠或發紅的斑', choices: [{ label: '拿給祭司看', facts: [C('see')], next: 'c7' }] },
  { id: 'c7', when: '第 7 天', ask: '祭司再看：斑有沒有擴散？', choices: [
    { label: '擴散了', facts: [C('spread')], end: 'burn' },
    { label: '沒有擴散', facts: [C('wash')], next: 'c14' },
  ] },
  { id: 'c14', when: '洗過，又過了七天', ask: '那塊斑看起來怎樣？', choices: [
    { label: '沒有變色', facts: [C('same')], end: 'burn' },
    { label: '發暗了', facts: [C('dim')], next: 'tear' },
  ] },
  { id: 'tear', when: '撕去以後', ask: '後來呢？', choices: [
    { label: '又出現了', facts: [C('back')], end: 'burn' },
    { label: '災病離開了', facts: [C('gone')], end: 'clean' },
  ] },
];

function specials(): HTMLElement {
  return h('div', { class: 'specials' }, ...SPECIAL.map((x) => h('div', { class: `special card v-${x.verdict}` },
    h('span', { class: 'stamp' }, x.verdict === 'clean' ? '潔淨' : '不潔淨'),
    h('b', null, x.title),
    h('p', null, quoteLine(x.fact)),
    x.voice ? voiceBlock(x.voice) : null)));
}

function mourning(): HTMLElement {
  return h('div', { class: 'mourn' },
    h('div', { class: 'acts' }, ...FOUR_ACTS.map((a, i) => h('div', { class: 'act card', style: `--i:${i}` }, h('span', { class: 'act-n' }, String(i + 1)), h('b', null, a.label), ...refChips(a.fact.refs, a.fact.q)))),
    h('div', { class: 'mirror' },
      h('div', { class: 'mirror-side sick card' }, h('small', null, '長大痲瘋的人'), h('p', null, quoteLine(MOURN_SICK))),
      h('span', { class: 'mirror-mid' }, '同樣兩個字', h('br'), '一個被命令做', h('br'), '一個被禁止做'),
      h('div', { class: 'mirror-side priest card' }, h('small', null, '祭司（利10:6）'), h('p', null, quoteLine(MOURN_PRIEST)))),
    h('p', { class: 'mirror-note' }, factLine(MOURN_SAME)),
    h('div', { class: 'two-voices' }, voiceBlock(VOICES_13.mourn), voiceBlock(VOICES_13.breath)),
    voiceBlock(VOICES_13.women));
}

export function buildC13(): HTMLElement {
  const reel = mountReel(REEL_13);
  const keys = h('div', { class: 'keys' },
    h('div', { class: 'key card' }, h('h3', null, '祭司看三樣'),
      h('ul', { class: 'key-lines' },
        h('li', null, '斑上的毛有沒有變白 ', ...refChips(['利13:3'])),
        h('li', null, '是不是深於皮 ', ...refChips(['利13:3'])),
        h('li', null, '過了七天，有沒有在皮上擴散 ', ...refChips(['利13:5-8'])))),
    h('div', { class: 'key card' }, h('h3', null, '看不準，就等'),
      h('ul', { class: 'key-lines' },
        h('li', null, '先關鎖七天，第七天再看 ', ...refChips(['利13:4-5'])),
        h('li', null, '還不準，再關七天 ', ...refChips(['利13:5'])),
        h('li', null, '發暗、沒擴散，就定為潔淨，洗衣服 ', ...refChips(['利13:6'])))),
    h('div', { class: 'key card wide' }, h('h3', null, '確定是大痲瘋以後'),
      h('ul', { class: 'key-lines' },
        h('li', null, '撕裂衣服、蓬頭散髮、蒙著上唇、喊叫「不潔淨了」 ', ...refChips(['利13:45'])),
        h('li', null, '病在身上的日子，獨居營外 ', ...refChips(['利13:46'])),
        h('li', null, '衣服和皮子上的斑，也照同樣的方式察看 ', ...refChips(['利13:47-59'])))));

  const bridge = answerBridge({ id: 'mother', label: '母親回答女兒' },
    '「要等到他的病好了。那時候祭司會出營去看他，看準了，他才能一步一步回來。祭司怎麼判，經文寫得很清楚：毛有沒有變白、斑是不是深於皮、有沒有擴散；看不準，就等七天再看。」', reel.el, keys);

  return h('article', { class: 'scene', style: '--c:var(--c13)' },
    h('div', { class: 'wrap' }, h('header', { class: 'scene-head' },
      h('div', { class: 'kicker' }, kicker('c13')),
      h('h1', null, '祭司察看'),
      h('p', { class: 'lede' }, '這一章五十九節，反覆出現的是同一句話：「祭司要察看」。皮膚上起了斑，該不該定為不潔淨，由祭司照經文的記號來判斷。這一次，起斑的是父親。'))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      layer('重點', '母親說的，整理成三件事', keys),
      layer('換你來看', '照經文的順序一步一步判斷；每一步都附上那一節', decide(SKIN_NODES, skinArt, { title: '皮膚上的一塊斑', startLabel: '你的判斷紀錄' }),
        h('div', { class: 'two-voices' }, voiceBlock(VOICES_13.hairWhite), voiceBlock(VOICES_13.twoErrors))),
      layer('幾種特別的情況', '有的看起來很嚴重，卻是潔淨的', specials()),
      layer('確診以後', '四個動作，都是喪禮上的動作', mourning()),
      layer('衣服上的斑', '羊毛、麻布、皮子：一樣要給祭司看', decide(CLOTH_NODES, clothArt, { title: '一件衣服', startLabel: '你的判斷紀錄' }),
        h('div', { class: 'two-voices' }, voiceBlock(VOICES_13.cloth), voiceBlock(VOICES_13.noRite))),
      layer('今天怎麼讀', '新約裡的一句話', ntCard(h('p', null, factLine(NT_13, { quote: true })), voiceBlock(VOICES_13.outsideBH))),
      study('原文裡看得見的事', ...HEBREW_13.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_13.slow), voiceBlock(VOICES_13.heal)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 13, from: 1, to: 46, title: '利未記 13:1-46：人身上的災病' },
        { ch: 13, from: 47, to: 59, title: '利未記 13:47-59：衣服上的災病' },
      ])),
      voicesLink('這到底是什麼病？染上了，是不是因為犯罪？', '今天的痲瘋病（漢森氏病）和經文寫的不一樣；有的註釋說不等於罪，有的讀成罪的圖畫。各家並陳', 'leprosySin'),
      sceneNav('c13')));
}
