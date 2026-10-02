import { ARC, ARC_NOTE, NO_OFFER, OFFER_ROWS, TIMELINE, VOICES_OVERVIEW, type ChapterNo } from '../data/overview';
import type { Fact } from '../data/types';
import type { SceneId } from '../data/story';
import { fill, h } from './dom';
import { factLine, voiceBlock } from './evidence';
import { layer } from './common';
import { kicker, sceneHref, sceneNav } from './shell';

const CHAPTERS: { n: ChapterNo; name: string }[] = [
  { n: 11, name: '吃什麼' }, { n: 12, name: '生產之後' }, { n: 13, name: '祭司察看' }, { n: 14, name: '回到營裡' }, { n: 15, name: '身體的漏症' },
];
const goChapter = (n: ChapterNo) => sceneHref(`c${n}` as SceneId);

/** 同一條軸：由短到長，每個情況一顆按鈕，點了看經文怎麼說 */
function timeline(): HTMLElement {
  const info = h('div', { class: 'tl-info', 'aria-live': 'polite' }, h('p', { class: 'tl-hint' }, '點一個情況，看經文怎麼說。'));
  const chips: HTMLButtonElement[] = [];
  function pick(btn: HTMLButtonElement, it: { label: string; ch: ChapterNo; fact: Fact }) {
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === btn)));
    fill(info,
      h('div', { class: 'tl-info-head' }, h('span', { class: `tl-tag ch-${it.ch}` }, `${it.ch} 章`), h('b', null, it.label)),
      h('p', null, factLine(it.fact, { quote: true })),
      h('a', { class: 'tl-go', href: goChapter(it.ch) }, `回到第 ${it.ch} 章`));
  }
  const cols = TIMELINE.map((sp) => h('div', { class: 'tl-col', style: `--k:${sp.k}` },
    h('div', { class: 'tl-head' }, h('b', null, sp.label), h('i', { class: 'tl-bar', 'aria-hidden': 'true' })),
    sp.note ? h('small', { class: 'tl-note' }, sp.note) : null,
    h('ul', null, ...sp.items.map((it) => {
      const btn: HTMLButtonElement = h('button', { type: 'button', class: `tl-chip ch-${it.ch}`, 'aria-pressed': 'false', onclick: () => pick(btn, it) },
        h('span', { class: 'tl-ch' }, String(it.ch)), it.label);
      chips.push(btn);
      return h('li', null, btn);
    }))));
  return h('div', { class: 'axis card' },
    h('div', { class: 'tl-legend' }, '顏色是章：', ...CHAPTERS.map((c) => h('span', { class: `tl-tag ch-${c.n}` }, `${c.n} ${c.name}`))),
    info,
    h('div', { class: 'tl-cols' }, ...cols));
}

/** 好了以後，要等什麼、獻什麼 */
function offers(): HTMLElement {
  const cell = (f: Fact) => factLine(f);
  return h('div', null,
    h('div', { class: 'ladder card' },
      h('table', { class: 'ladder-t rp ov' },
        h('thead', null, h('tr', null, h('th', null, '情況'), h('th', null, '好了以後'), h('th', null, '一般的'), h('th', null, '力量不夠的'))),
        h('tbody', null, ...OFFER_ROWS.map((r) => h('tr', null,
          h('td', { class: 'sit' }, h('b', null, r.situation), h('small', null, `${r.ch} 章・${r.range}`)),
          h('td', { 'data-label': '好了以後' }, cell(r.recover)),
          h('td', { 'data-label': '一般的' }, cell(r.rich)),
          h('td', { 'data-label': '力量不夠的' }, r.poor ? cell(r.poor) : h('span', { class: 'dash' }, '經文沒有另外規定'))))))),
    h('h3', { class: 'sub' }, '這幾種情況，經文沒有提到要獻祭'),
    h('ul', { class: 'no-offer' }, ...NO_OFFER.map((n) => h('li', { class: 'card' },
      h('span', { class: `tl-tag ch-${n.ch}` }, `${n.ch} 章`), h('b', null, n.label), h('span', null, cell(n.fact))))));
}

/** 利10:10 → 11–15 → 16 */
function arc(): HTMLElement {
  return h('div', null,
    h('div', { class: 'arc' }, ...ARC.flatMap((a, i) => [
      h('section', { class: `arc-stop card arc-${a.key}` },
        h('small', null, a.range),
        h('b', { class: 'arc-title' }, a.title),
        a.key === 'mid' ? h('div', { class: 'arc-chs' }, ...CHAPTERS.map((c) => h('a', { class: `tl-tag ch-${c.n}`, href: goChapter(c.n) }, `${c.n} ${c.name}`))) : null,
        h('ul', { class: 'key-lines' }, ...a.facts.map((f) => h('li', null, factLine(f, { quote: true }))))),
      i < ARC.length - 1 ? h('span', { class: 'arc-arrow', 'aria-hidden': 'true' }, '→') : null,
    ])),
    h('p', { class: 'arc-note' }, factLine(ARC_NOTE)),
    h('div', { class: 'two-voices' }, voiceBlock(VOICES_OVERVIEW.twoBirds), voiceBlock(VOICES_OVERVIEW.bh)));
}

export function buildOverview(): HTMLElement {
  return h('article', { class: 'scene', style: '--c:var(--bronze)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('overview')),
        h('h1', null, '總覽'),
        h('p', { class: 'lede' }, '五章讀完了。這一幕把所有的情況放在同一張圖上：不潔淨有多久、好了以後要獻什麼，最後看這五章在利未記裡的位置。'))),
    h('div', { class: 'wrap' },
      layer('不潔淨有多久', '由短到長排成一條軸；點任何一個情況，看經文怎麼說', timeline()),
      layer('好了以後，要獻什麼', '第八天，或日子滿了，帶到會幕門口', offers()),
      layer('這五章在哪裡', '前面是利10:10，後面是利16 章的贖罪日', arc()),
      sceneNav('overview')));
}
