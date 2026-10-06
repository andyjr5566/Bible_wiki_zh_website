import {
  HEBREW_14, HOUSE, MARK_CLEANSE, MARK_EXODUS, MARK_OIL, MARK_ORDAIN, NT_14, REEL_14, RICH_POOR, RICH_POOR_NOTE, ROUTE, VOICES_14,
} from '../data/ch14';
import type { Fact } from '../data/types';
import { h, s } from './dom';
import { factLine, quoteLine, refChips, voiceBlock } from './evidence';
import { answerBridge, layer, ntCard, readingMore, study, voicesLink } from './common';
import { mountReel } from './reel';
import { kicker, sceneNav } from './shell';

/*
 * 第 14 章的呈現（2026-10 重新編排，內容全部沿用 data/ch14.ts）：
 * 這一章的知識是「一條往內走的路」：同時有距離（營外 → 自己的帳棚外 → 會幕門口）和時間（第 1、7、8 天）。
 *   1. 回家的路畫成「天數 × 離會幕多遠」的階梯圖，天數按比例
 *   2. 營外用的東西：Blender 渲染的示意圖（兩隻鳥、香柏木、朱紅色線、牛膝草、瓦器盛活水，利14:4-5）
 *   3. 第八天抹血、抹油：同一個人形，標出和承接聖職一樣的三處、多出來的油
 *   4. 貧窮的人：能減的、不能減的分開；素祭的細麵按 3/10、1/10 畫
 *   5. 房屋：一條直的流程，最後分兩條路
 */

/** 原本「禮在病好之後」那張卡上的句子，照原樣保留 */
const HEALED_FIRST: Fact = { text: '祭司出營，是去看病「痊癒了」沒有；這套禮是給已經好了的人', status: 'explicit', refs: ['利14:3'], q: '若見他的大痲瘋痊癒了' };

/* ------------------------------------------------------------ 1. 回家的路 */

function routeChart(): HTMLElement {
  const W = 760, H = 250, L = 150, R = 30, T = 30, B = 46;
  const x = (day: number) => L + ((day - 1) / 7) * (W - L - R);
  const lv = [T + 10, T + 90, T + 170]; // 營外、自己的帳棚外、會幕門口
  const names = ROUTE.map((r) => r.place);
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'c14r-svg', role: 'img', 'aria-label': '第 1 天在營外；洗衣、剃毛、洗澡後進營，在自己的帳棚外住到第 7 天；第 8 天到會幕門口。' });
  svgEl.append(s('defs', {}, s('marker', { id: 'c14r-ar', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--c14)' }))));
  // 三條橫線：離會幕的遠近
  names.forEach((n, i) => {
    svgEl.append(s('line', { x1: L - 8, x2: W - R, y1: lv[i], y2: lv[i], class: 'c14r-grid' }));
    svgEl.append(s('text', { x: L - 16, y: lv[i] + 5, 'text-anchor': 'end', class: 'c14r-lv' }, n));
  });
  svgEl.append(s('text', { x: 10, y: T - 12, class: 'c14r-axis' }, '離會幕'));
  svgEl.append(s('text', { x: 10, y: T + 4, class: 'c14r-axis small' }, '遠'));
  svgEl.append(s('text', { x: 10, y: lv[2] + 5, class: 'c14r-axis small' }, '近'));
  // 天數
  for (let d = 1; d <= 8; d++) {
    svgEl.append(s('line', { x1: x(d), x2: x(d), y1: H - B + 4, y2: H - B + 10, class: 'c14r-grid' }));
    svgEl.append(s('text', { x: x(d), y: H - B + 26, 'text-anchor': 'middle', class: `c14r-day${[1, 7, 8].includes(d) ? ' key' : ''}` }, `第 ${d} 天`));
  }
  // 走的路
  const path = `M${x(1)} ${lv[0]} L${x(1) + 14} ${lv[0]} L${x(1) + 14} ${lv[1]} L${x(8) - 14} ${lv[1]} L${x(8) - 14} ${lv[2]} L${x(8) - 2} ${lv[2]}`;
  svgEl.append(s('path', { d: path, class: 'c14r-path' }));
  const dot = (cx: number, cy: number, n: number) => {
    svgEl.append(s('circle', { cx, cy, r: 12, class: 'c14r-dot' }));
    svgEl.append(s('text', { x: cx, y: cy + 5, 'text-anchor': 'middle', class: 'c14r-n' }, String(n)));
  };
  dot(x(1), lv[0], 1);
  dot((x(1) + x(7)) / 2, lv[1], 2);
  dot(x(8), lv[2], 3);
  // 第 7 天再剃一次
  svgEl.append(s('circle', { cx: x(7), cy: lv[1], r: 5, class: 'c14r-mini' }));
  svgEl.append(s('text', { x: x(7), y: lv[1] - 12, 'text-anchor': 'middle', class: 'c14r-note' }, '再剃一次'));
  return h('figure', { class: 'c14r' }, h('div', { class: 'c14r-scroll' }, svgEl),
    h('ol', { class: 'c14r-stops' }, ...ROUTE.map((r) => h('li', null,
      h('div', { class: 'c14r-head' }, h('b', null, r.place), h('small', null, r.when)),
      h('ul', null, ...r.acts.map((f) => h('li', null, f.text, ' ', ...refChips(f.refs, f.q))))))));
}

/* ------------------------------------------------------------ 2. 營外用的東西（Blender） */

function kit(): HTMLElement {
  const rule = REEL_14.beats[2].rule; // 利14:4-5
  // 圖上的位置是照 Blender 渲染的畫面量的（百分比）
  const pins: [string, number, number][] = [['活鳥', 19, 30], ['活鳥', 80, 26], ['瓦器盛活水', 50, 44], ['香柏木', 93, 64], ['朱紅色線', 79, 51], ['牛膝草', 28, 78]];
  const img = h('img', { src: 'images/c14-kit-1600.webp', srcset: 'images/c14-kit-900.webp 900w, images/c14-kit-1600.webp 1600w', sizes: '(max-width: 900px) 100vw, 1100px', alt: '示意圖：兩隻鳥、一個盛水的陶碗、纏著紅線的一段木頭、一束綠色的草。', loading: 'lazy', decoding: 'async' });
  return h('figure', { class: 'c14k' },
    h('div', { class: 'c14k-stage' }, img,
      ...pins.map(([label, px, py]) => h('span', { class: 'c14k-pin', style: `left:${px}%;top:${py}%` }, label)),
      h('span', { class: 'c14k-badge' }, '示意 · Blender 渲染')),
    h('figcaption', null, h('p', null, quoteLine(rule)), rule.note ? h('p', { class: 'c14k-note' }, rule.note) : null));
}

/* ------------------------------------------------------------ 3. 耳、手、腳 */

function body(): SVGSVGElement {
  const el = s('svg', { viewBox: '0 0 160 250', class: 'c14o-body', role: 'img', 'aria-label': '人形：右耳垂、右手大拇指、右腳大拇指三處抹血；求潔淨的人在血上再抹油，頭上也抹油。' });
  el.append(s('circle', { cx: 80, cy: 34, r: 22, class: 'c14o-skin' }));
  el.append(s('path', { d: 'M54 64 L106 64 L122 168 L38 168 Z', class: 'c14o-skin' }));
  el.append(s('path', { d: 'M54 68 L28 140 M106 68 L132 140', class: 'c14o-limb' }));
  el.append(s('path', { d: 'M62 168 L56 232 M98 168 L104 232', class: 'c14o-limb' }));
  // 人面向讀者：他的右邊在畫面左邊
  for (const [cx, cy] of [[57, 38], [27, 143], [55, 234]]) {
    el.append(s('circle', { cx, cy, r: 8, class: 'c14o-blood' }));
    el.append(s('circle', { cx: cx + 10, cy: cy - 8, r: 5.5, class: 'c14o-oil' }));
  }
  el.append(s('circle', { cx: 80, cy: 13, r: 7, class: 'c14o-oil' }));
  return el;
}

function ordination(): HTMLElement {
  return h('div', { class: 'c14o' },
    h('div', { class: 'c14o-fig' }, body(),
      h('ul', { class: 'c14o-key' },
        h('li', null, h('i', { class: 'c14o-sw blood' }), '血：右耳垂、右手大拇指、右腳大拇指', h('small', null, '承接聖職的祭司和求潔淨的人都有')),
        h('li', null, h('i', { class: 'c14o-sw oil' }), '油：抹在血上，剩下的抹在頭上', h('small', null, '只有求潔淨的人')))),
    h('div', { class: 'c14o-cols' },
      h('div', { class: 'c14o-side' }, h('small', null, '亞倫和他的兒子承接聖職'), h('p', null, quoteLine(MARK_ORDAIN)), h('p', { class: 'c14o-ref' }, factLine(MARK_EXODUS))),
      h('div', { class: 'c14o-side' }, h('small', null, '長大痲瘋的人得潔淨'), h('p', null, quoteLine(MARK_CLEANSE)), h('p', { class: 'c14o-ref' }, factLine(MARK_OIL)))),
    h('div', { class: 'c14-voices' }, voiceBlock(VOICES_14.ordainDiff), voiceBlock(VOICES_14.grace), voiceBlock(VOICES_14.ear)));
}

/* ------------------------------------------------------------ 4. 貧窮的人 */

function richPoor(): HTMLElement {
  const flour = RICH_POOR.find((r) => r.item === '素祭')!;
  const bar = (n: number, label: string) => h('span', { class: 'c14p-bar' }, h('i', { style: `width:${(n / 10) * 100}%` }), h('small', null, label));
  return h('div', { class: 'c14p' },
    h('div', { class: 'c14p-head' }, h('span'), h('b', null, '一般的（v10-20）'), h('b', null, '貧窮的（v21-32）')),
    ...RICH_POOR.map((r) => r.same
      ? h('div', { class: 'c14p-row same' }, h('span', { class: 'c14p-item' }, r.item),
        h('div', { class: 'c14p-merged' }, h('span', { class: 'c14p-tag' }, '不能減'), factLine(r.rich), ' ', h('span', { class: 'c14p-poorref' }, ...refChips(r.poor.refs, r.poor.q))))
      : h('div', { class: 'c14p-row' }, h('span', { class: 'c14p-item' }, r.item),
        h('div', { class: 'c14p-cell' }, factLine(r.rich), r === flour ? bar(3, '十分之三') : null),
        h('div', { class: 'c14p-cell poor' }, factLine(r.poor), r === flour ? bar(1, '十分之一') : null))),
    h('p', { class: 'c14p-note' }, factLine(RICH_POOR_NOTE)),
    h('div', { class: 'c14-voices' }, voiceBlock(VOICES_14.poorDing), voiceBlock(VOICES_14.poorJD), voiceBlock(VOICES_14.log)));
}

/* ------------------------------------------------------------ 5. 房屋 */

function house(): HTMLElement {
  const step = (f: Fact, cls = '') => h('li', { class: `c14h-step ${cls}` }, h('span', null, f.text), ' ', ...refChips(f.refs, f.q));
  return h('div', { class: 'c14h' },
    h('ol', { class: 'c14h-line' }, step(HOUSE.canaan, 'canaan'), step(HOUSE.report), step(HOUSE.empty), step(HOUSE.look, 'wait'), step(HOUSE.spread)),
    h('div', { class: 'c14h-fork' },
      h('div', { class: 'c14h-branch bad' }, h('b', null, '墁過以後又發散'), h('p', null, quoteLine(HOUSE.again))),
      h('div', { class: 'c14h-branch good' }, h('b', null, '墁過以後沒有發散'), h('p', null, quoteLine(HOUSE.clean)), h('p', null, quoteLine(HOUSE.birds)), h('p', { class: 'c14h-small' }, factLine(HOUSE.atone)))),
    h('p', { class: 'c14h-small' }, factLine(HOUSE.inside)),
    h('div', { class: 'c14-voices two' }, voiceBlock(VOICES_14.houseNotJudge), voiceBlock(VOICES_14.houseNoOffer)));
}

export function buildC14(): HTMLElement {
  const reel = mountReel(REEL_14);
  const ordain = layer('第八天：耳、手、腳', '和承接聖職的祭司抹在同樣的三處；求潔淨的人多一道油', ordination());
  // 女兒在故事最後問「那些鳥和羊，到底是做什麼的？」：父親的回答接在故事下面
  const bridge = answerBridge({ id: 'father', label: '父親回答女兒' },
    '「在營外，一隻鳥宰在活水上面；另一隻活鳥和香柏木、朱紅色線、牛膝草一起蘸了血，向我灑了七次，祭司就定我為潔淨，那隻活鳥放到田野裡飛走了。今天在會幕門口，一隻公羊羔作贖愆祭，牠的血抹在我的右耳垂、右手大拇指、右腳大拇指上；另外的羊羔作贖罪祭和燔祭，祭司用這些為我贖罪，我就潔淨了。為什麼要這樣做，經文沒有一樣一樣說明。」', reel.el, ordain);
  return h('article', { class: 'scene scene-14', style: '--c:var(--c14)' },
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, kicker('c14')),
        h('h1', null, '回到營裡'),
        h('p', { class: 'lede' }, '上一章只寫到判定：確診的人要獨居營外。這一章寫回來的路，從營外、自己的帳棚外，一直到會幕門口。後半章另外講房屋上的災病。')),
      layer('回家的路', '三個地方、八天：橫軸是天數，越往下離會幕越近', routeChart(),
        h('div', { class: 'c14-healed' }, h('p', null, factLine(HEALED_FIRST, { quote: true })), voiceBlock(VOICES_14.notMagic))),
      layer('營外用的東西', '利14:4-5：只畫經文列出來的', kit(),
        h('div', { class: 'c14-voices' }, voiceBlock(VOICES_14.birdKind), voiceBlock(VOICES_14.living), voiceBlock(VOICES_14.twoBirds)),
        h('div', { class: 'c14-voices two' }, voiceBlock(VOICES_14.notRite), voiceBlock(VOICES_14.shaveNo)))),
    h('div', { class: 'wrap' }, layer('父親的例子', '從營外回到家', null)),
    reel.el,
    h('div', { class: 'wrap' },
      bridge,
      ordain,
      layer('窮人怎麼辦', '有的可以減，有的不能減', richPoor()),
      layer('房屋上的斑', '這是到了迦南、住進房子以後的條例', house()),
      layer('今天怎麼讀', '新約裡的一句話', ntCard(h('p', null, factLine(NT_14, { quote: true })), voiceBlock(VOICES_14.bloodWater))),
      study('原文與背景', ...HEBREW_14.map((f) => h('p', { class: 'study-p' }, factLine(f))), voiceBlock(VOICES_14.shaveYes), voiceBlock(VOICES_14.waveWhole), voiceBlock(VOICES_14.hurrian), voiceBlock(VOICES_14.practical)),
      h('div', { class: 'mores' }, readingMore([
        { ch: 14, from: 1, to: 32, title: '利未記 14:1-32：長大痲瘋的人得潔淨' },
        { ch: 14, from: 33, to: 57, title: '利未記 14:33-57：房屋的災病' },
      ])),
      voicesLink('那兩隻鳥算不算祭？剃毛有沒有意思？', '有的註釋說這還不是祭，有的說是；剃毛有的說只是為了看清楚皮膚，有的讀出象徵', 'twoBirds'),
      sceneNav('c14')));
}
