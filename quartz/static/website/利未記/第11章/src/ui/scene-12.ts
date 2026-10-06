import {
  CIRCUMCISION, DONE, GIRL_WHY, HEBREW_12, NT_12, NT_12B, OFFER_POOR, OFFER_RICH, ORDER, PHASES, REEL_12, TOTAL, VOICES_12, type Baby, type Phase,
} from '../data/ch12';
import { LIKE_MENSES } from '../data/ch12';
import { fill, h, svg } from './dom';
import { factLine, quoteLine, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/*
 * 第 12 章的呈現（2026-10 重新編排，內容全部沿用 data/ch12.ts）：
 * 這一章的知識是「兩段日子」：生男孩 7＋33，生女孩 14＋66。
 *   1. 主角是兩條按真實天數畫的時間軸（同一把尺），一根「第幾天」游標同時看兩位母親在哪一段
 *   2. 3D 故事（生男孩的四十天）放在後面當例子
 *   3. 祭物畫成「燔祭／贖罪祭」兩欄，一般的和力量不夠的只差在燔祭那一格；次序和 14、15 章對照
 */

const MAX = PHASES.girl[PHASES.girl.length - 1].to; // 80
const ROWS: { baby: Baby; name: string }[] = [{ baby: 'boy', name: '生男孩' }, { baby: 'girl', name: '生女孩' }];
const pct = (d: number) => `${(d / MAX) * 100}%`;
const totalOf = (b: Baby) => PHASES[b][PHASES[b].length - 1].to;
const phaseAt = (b: Baby, d: number): Phase | null => PHASES[b].find((p) => d >= p.from && d <= p.to) ?? null;

/** 兩條時間軸：同一把尺（0–80 天），一格不差 */
function timeline(): HTMLElement {
  const cursor = h('span', { class: 'dur-cursor', 'aria-hidden': 'true' }, h('b'));
  const rows = ROWS.map(({ baby, name }) => {
    const n = totalOf(baby);
    const segs = PHASES[baby].map((p) => h('span', {
      class: `dur-seg ${p.key}`, style: `left:${pct(p.from - 1)};width:calc(${pct(p.to - p.from + 1)} - 2px)`, title: `${name}：${p.label}（第 ${p.from}–${p.to} 天）`,
    }, h('span', { class: 'dur-seg-label' }, p.label)));
    const circ = baby === 'boy'
      ? h('span', { class: 'dur-mark', style: `left:${pct(7.5)}`, title: '第 8 天：割禮' }, h('i'), h('small', null, '第 8 天割禮'))
      : null;
    const end = h('span', { class: 'dur-end', style: `left:${pct(n)}`, title: '日子滿了：帶祭物到會幕門口' }, svg(ICONS.altar), h('small', null, `第 ${n} 天滿`));
    return h('div', { class: 'dur-row', 'data-baby': baby },
      h('div', { class: 'dur-name' }, h('b', null, name), h('small', null, `${n} 天`)),
      h('div', { class: 'dur-track' }, ...segs, circ, end));
  });
  const ticks = [7, 14, 40, 80].map((d) => h('span', { class: 'dur-tick', style: `left:${pct(d)}` }, String(d)));
  const axis = h('div', { class: 'dur-axis' }, h('div', { class: 'dur-name' }), h('div', { class: 'dur-track' }, ...ticks, h('span', { class: 'dur-unit' }, '天')));

  // 游標：拖到第幾天，下面同時列出兩位母親在那一天的規矩
  const range = h('input', { type: 'range', min: '1', max: String(MAX + 1), value: '10', class: 'dur-range', 'aria-label': '第幾天' }) as HTMLInputElement;
  const dayOut = h('output', { class: 'dur-day' });
  const read = h('div', { class: 'dur-read', 'aria-live': 'polite' });
  // 游標放在只蓋住時間軸那一段的圖層裡，百分比才和時間軸同一把尺
  const plot = h('div', { class: 'dur-plot' }, ...rows, axis, h('div', { class: 'dur-overlay', 'aria-hidden': 'true' }, cursor));
  function show() {
    const d = +range.value;
    cursor.style.left = pct(Math.min(d, MAX) - 0.5);
    dayOut.textContent = d > MAX ? '八十天以後' : `第 ${d} 天`;
    fill(read, ...ROWS.map(({ baby, name }) => {
      const p = phaseAt(baby, d);
      const after = d > totalOf(baby);
      return h('div', { class: `dur-card ${after ? 'done' : p!.key}` },
        h('div', { class: 'dur-card-head' }, h('b', null, name), h('span', null, after ? '日子滿了' : p!.label)),
        h('p', null, quoteLine(after ? DONE : p!.fact)),
        baby === 'boy' && d === 8 ? h('p', { class: 'dur-circ' }, factLine(CIRCUMCISION)) : null);
    }));
  }
  range.addEventListener('input', show);
  show();
  return h('figure', { class: 'dur', 'aria-label': '生男孩與生女孩的日子，同一把尺：生男孩不潔淨七天、再三十三天，共四十天；生女孩不潔淨十四天、再六十六天，共八十天。' },
    h('div', { class: 'dur-legend' },
      h('span', null, h('i', { class: 'dur-sw unclean' }), '不潔淨的日子'),
      h('span', null, h('i', { class: 'dur-sw purify' }), '潔淨的日子：不可摸聖物、不可進聖所')),
    plot,
    h('div', { class: 'dur-ctl' }, dayOut, range),
    read,
    h('figcaption', null,
      h('ul', { class: 'key-lines' }, h('li', null, factLine(TOTAL)), h('li', null, factLine(GIRL_WHY)), h('li', null, factLine(LIKE_MENSES)))),
    // 給看不到圖的人：同一份資料的表
    h('table', { class: 'sr-only' },
      h('caption', null, '兩段日子'),
      h('tr', null, h('th', null, ''), h('th', null, '不潔淨'), h('th', null, '潔淨的日子'), h('th', null, '共')),
      ...ROWS.map(({ baby, name }) => h('tr', null, h('th', null, name), ...PHASES[baby].map((p) => h('td', null, `${p.to - p.from + 1} 天`)), h('td', null, `${totalOf(baby)} 天`)))));
}

/** 祭物：燔祭、贖罪祭兩欄；一般的和力量不夠的只差在燔祭那一格 */
function offerings(): HTMLElement {
  const cell = (what: string, changed = false) => h('td', { class: changed ? 'dur-chg' : null }, what);
  const table = h('table', { class: 'dur-off-t' },
    h('thead', null, h('tr', null, h('th', null, ''), h('th', { scope: 'col' }, '燔祭'), h('th', { scope: 'col' }, '贖罪祭'))),
    h('tbody', null,
      h('tr', null, h('th', { scope: 'row' }, '一般的'), cell('一歲的羊羔', true), cell('一隻雛鴿或斑鳩')),
      h('tr', { class: 'dur-q-row' }, h('td', { colspan: '3' }, quoteLine(OFFER_RICH))),
      h('tr', null, h('th', { scope: 'row' }, '力量不夠的'), cell('一隻斑鳩或雛鴿', true), cell('一隻斑鳩或雛鴿')),
      h('tr', { class: 'dur-q-row' }, h('td', { colspan: '3' }, quoteLine(OFFER_POOR)))));
  const seq = (label: string, items: string[]) => h('div', { class: 'dur-ord-row' }, h('b', null, label),
    ...items.flatMap((it, i) => [i ? h('span', { class: 'dur-ord-arrow', 'aria-hidden': 'true' }, '→') : null, h('span', { class: `dur-ord-step ${it === '燔祭' ? 'burnt' : 'sin'}` }, it)]));
  return h('div', { class: 'dur-offer' },
    h('p', { class: 'dur-offer-done' }, quoteLine(DONE)),
    h('div', { class: 'dur-off-wrap' }, table),
    h('div', { class: 'dur-two-voices' }, voiceBlock(VOICES_12.dove), voiceBlock(VOICES_12.poor)),
    h('figure', { class: 'dur-ord' },
      seq('第 12 章', ['燔祭', '贖罪祭']),
      seq('第 14、15 章', ['贖罪祭', '燔祭']),
      h('figcaption', null, factLine(ORDER))));
}

export function buildC12(): HTMLElement {
  const reel = mountReel(REEL_12);
  const bring = layer('帶什麼來', '同樣的禮，兩種預備法', offerings());
  // 女兒在故事最後問「為什麼要等四十天？如果是妹妹呢？」：父親的回答接在故事下面
  const bridge = answerBridge({ id: 'father', label: '父親回答女兒' },
    '「生男孩，媽媽不潔淨七天，再等三十三天，一共四十天。如果是妹妹，日子加倍：不潔淨兩個七天，再等六十六天。為什麼要這麼多天、為什麼生女孩要加倍，經文沒有說。日子滿了，就像今天，帶一歲的羊羔和一隻雛鴿到會幕門口。」', reel.el, bring);
  return h('article', { class: 'scene scene-12', style: '--c:var(--c12)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('c12')),
        h('h1', null, '生產之後'),
        h('p', { class: 'lede' }, '這一章只有八節：婦人生了孩子以後，要等多少天、等的時候不能做什麼、日子滿了帶什麼來。')),
      layer('兩段日子', '同一把尺：一格是一天；拖動游標，同時看兩位母親在哪一段', timeline(),
        h('div', { class: 'c12-voices' }, voiceBlock(VOICES_12.add), voiceBlock(VOICES_12.husband), voiceBlock(VOICES_12.onlyHoly))),
      layer('中間的第八天', '生男孩的第八天', h('div', { class: 'c12-day8' }, h('p', { class: 'c12-day8-q' }, factLine(CIRCUMCISION, { quote: true })), voiceBlock(VOICES_12.day8)))),
    h('div', { class: 'wrap' }, layer('一家人的例子', '生了男孩：四十天怎麼過', null)),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      bring,
      layer('今天怎麼讀', '新約裡的兩句話',
        ntCard(h('p', null, factLine(NT_12, { quote: true })), h('p', null, factLine(NT_12B, { quote: true })), voiceBlock(VOICES_12.mary))),
      study('原文裡看得見的事', ...HEBREW_12.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_12.forty), voiceBlock(VOICES_12.eight), voiceBlock(VOICES_12.ritual)),
      h('div', { class: 'mores' }, readingMore([{ ch: 12, from: 1, to: 8, title: '利未記 12:1-8' }])),
      voicesLink('生女孩為什麼要加倍？「不潔淨」是不是罪？', '經文沒有給理由；本章的來源給了六種說法，彼此不合。燔祭為什麼排在贖罪祭前面，也有四種讀法', 'girl'),
      sceneNav('c12')));
}
