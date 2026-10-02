import {
  CIRCUMCISION, DONE, GIRL_WHY, HEBREW_12, NT_12, NT_12B, OFFER_POOR, OFFER_RICH, ORDER, PHASES, REEL_12, TOTAL, VOICES_12, type Baby,
} from '../data/ch12';
import { LIKE_MENSES } from '../data/ch12';
import type { Fact } from '../data/types';
import { fill, h, svg } from './dom';
import { factLine, quoteLine, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/** 四十天／八十天：一天一格，點一格看那一天的規矩 */
function calendar(): HTMLElement {
  let baby: Baby = 'boy';
  let pick = 1;
  const grid = h('div', { class: 'cal-grid', role: 'grid', 'aria-label': '產婦的日子，一天一格' });
  const info = h('div', { class: 'cal-info', 'aria-live': 'polite' });
  const total = () => PHASES[baby][PHASES[baby].length - 1].to;
  const tabs = h('div', { class: 'cal-tabs', role: 'group', 'aria-label': '生男孩或生女孩' });
  const tab = (b: Baby, label: string) => h('button', { type: 'button', class: 'opt', 'aria-pressed': String(b === baby), onclick: () => { baby = b; pick = 1; render(); } }, label);

  function show(d: number) {
    pick = d;
    grid.querySelectorAll<HTMLElement>('.cal-day').forEach((c) => c.classList.toggle('on', +c.dataset.d! === d));
    if (d > total()) {
      fill(info, h('div', { class: 'cal-head done' }, h('b', null, '日子滿了'), h('small', null, '帶祭物到會幕門口')), h('p', null, quoteLine(DONE)));
      return;
    }
    const ph = PHASES[baby].find((p) => d >= p.from && d <= p.to)!;
    fill(info,
      h('div', { class: `cal-head ${ph.key}` }, h('b', null, `第 ${d} 天`), h('small', null, ph.label)),
      h('p', null, quoteLine(ph.fact)),
      ph.key === 'unclean' ? h('p', { class: 'cal-note' }, factLine(LIKE_MENSES)) : null,
      baby === 'boy' && d === 8 ? h('p', { class: 'cal-note circ' }, svg(ICONS.check), factLine(CIRCUMCISION)) : null,
      ph.key === 'purify' ? voiceBlock(VOICES_12.onlyHoly) : null);
  }

  function render() {
    tabs.replaceChildren(tab('boy', '生男孩：40 天'), tab('girl', '生女孩：80 天'));
    const n = total();
    const cells: HTMLElement[] = [];
    for (let d = 1; d <= n; d++) {
      const ph = PHASES[baby].find((p) => d >= p.from && d <= p.to)!;
      cells.push(h('button', {
        type: 'button', class: `cal-day ${ph.key}${baby === 'boy' && d === 8 ? ' circ' : ''}`, 'data-d': d, style: `--i:${d}`,
        'aria-label': `第 ${d} 天：${ph.label}`, onclick: () => show(d),
      }, String(d)));
    }
    cells.push(h('button', { type: 'button', class: 'cal-day done', 'data-d': n + 1, 'aria-label': '日子滿了：獻祭', onclick: () => show(n + 1) }, svg(ICONS.altar)));
    grid.replaceChildren(...cells);
    grid.classList.remove('grow');
    void grid.offsetWidth;
    grid.classList.add('grow');
    show(Math.min(pick, n));
  }
  render();
  return h('div', { class: 'cal card' },
    h('div', { class: 'cal-top' }, tabs,
      h('span', { class: 'cal-legend' }, h('i', { class: 'lg unclean' }), '不潔淨', h('i', { class: 'lg purify' }), '潔淨的日子', h('i', { class: 'lg circ' }), '割禮', h('i', { class: 'lg done' }), '獻祭')),
    h('div', { class: 'cal-body' }, grid, info),
    h('ul', { class: 'key-lines cal-foot' }, h('li', null, factLine(TOTAL)), h('li', null, factLine(GIRL_WHY))),
    voiceBlock(VOICES_12.add));
}

/** 帶什麼來：一般的、力量不夠的 */
function offerings(): HTMLElement {
  const card = (title: string, art: string[], fact: Fact, cls: string) => h('div', { class: `off card ${cls}` },
    h('div', { class: 'off-art' }, ...art.map((a) => h('span', { class: `token ${a}` }, a === 'lamb' ? '羊羔' : '鳥'))),
    h('b', null, title),
    h('p', null, quoteLine(fact)));
  return h('div', null,
    h('div', { class: 'offs' },
      card('一般的', ['lamb', 'bird'], OFFER_RICH, 'rich'),
      h('span', { class: 'off-or' }, '或'),
      card('力量不夠的', ['bird', 'bird'], OFFER_POOR, 'poor')),
    h('div', { class: 'two-voices' }, voiceBlock(VOICES_12.dove), voiceBlock(VOICES_12.poor)),
    h('p', { class: 'order-note' }, factLine(ORDER)));
}

export function buildC12(): HTMLElement {
  const reel = mountReel(REEL_12);
  const keys = h('div', { class: 'keys' },
    h('div', { class: 'key card' }, h('h3', null, '兩段日子'),
      h('ul', { class: 'key-lines' },
        h('li', null, '先是不潔淨的日子：生男孩七天，生女孩兩個七天 ', ...refChips(['利12:2', '利12:5'])),
        h('li', null, '再是「潔淨的日子」：男孩三十三天，女孩六十六天；這段時間不可摸聖物、不可進聖所 ', ...refChips(['利12:4-5'])))),
    h('div', { class: 'key card' }, h('h3', null, '日子滿了，帶祭物來'),
      h('ul', { class: 'key-lines' },
        h('li', null, '一歲的羊羔作燔祭，一隻鳥作贖罪祭 ', ...refChips(['利12:6'])),
        h('li', null, '買不起羊羔的，兩隻鳥就可以 ', ...refChips(['利12:8'])),
        h('li', null, '不論生男生女，獻的一樣 ', ...refChips(['利12:6'])))),
    h('div', { class: 'key card wide' }, h('h3', null, '中間的第八天'),
      h('p', null, factLine(CIRCUMCISION, { quote: true })),
      voiceBlock(VOICES_12.day8)));

  const bridge = answerBridge({ id: 'father', label: '父親回答女兒' },
    '「四十天分成兩段：前面七天，後面三十三天。如果生的是妹妹，兩段都加倍，一共八十天。為什麼要加倍，經文沒有說。不管是弟弟還是妹妹，日子滿了，帶來的祭物都一樣。」', reel.el, keys);

  return h('article', { class: 'scene', style: '--c:var(--c12)' },
    h('div', { class: 'wrap' }, h('header', { class: 'scene-head' },
      h('div', { class: 'kicker' }, kicker('c12')),
      h('h1', null, '生產之後'),
      h('p', { class: 'lede' }, '這一章只有八節：婦人生了孩子以後，要等多少天、等的時候不能做什麼、日子滿了帶什麼來。我們從這家人添了男孩的那一夜看起。'))),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      layer('重點', '父親的回答，整理成三件事', keys),
      layer('一天一格', '點任何一天，看那一天的規矩；可以切換生男孩、生女孩', calendar()),
      layer('帶什麼來', '同樣的禮，兩種預備法', offerings()),
      layer('今天怎麼讀', '新約裡的兩句話',
        ntCard(h('p', null, factLine(NT_12, { quote: true })), h('p', null, factLine(NT_12B, { quote: true })), voiceBlock(VOICES_12.mary))),
      study('原文裡看得見的事', ...HEBREW_12.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_12.forty), voiceBlock(VOICES_12.eight), voiceBlock(VOICES_12.ritual)),
      h('div', { class: 'mores' }, readingMore([{ ch: 12, from: 1, to: 8, title: '利未記 12:1-8' }])),
      voicesLink('生女孩為什麼要加倍？「不潔淨」是不是罪？', '經文沒有給理由；本章的來源給了六種說法，彼此不合。燔祭為什麼排在贖罪祭前面，也有四種讀法', 'girl'),
      sceneNav('c12')));
}
