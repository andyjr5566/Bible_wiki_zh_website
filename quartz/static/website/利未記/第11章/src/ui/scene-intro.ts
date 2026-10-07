import { BLOCKED, CAST, CLOUD, EPIGRAPH, LENGTHS, NEAR_POINT, NEAR_VOICE, REASON, RETURN, ROADMAP, SCENE_BY_ID } from '../data/story';
import { animOff, h, motionOff, s, svg } from './dom';
import { badge, factLine, quoteLine, refChip, refChips, voiceBlock } from './evidence';
import { ICONS } from './icons';
import { layer } from './common';
import { flythrough } from './flythrough';
import { sceneHref, sceneNav } from './shell';

/**
 * 開場：先放一張 Blender 渲染的黃昏營地（會幕上方雲中有火，出40:38），不必等 3D 載入；
 * 按「轉動 3D 營地」才換成可以拖曳的 3D 場景（標出會幕、這一家的帳棚、營外）。
 */
function heroCamp(): HTMLElement {
  const canvas = h('div', { class: 'th-canvas' });
  const tags = h('div', { class: 'labels3d' });
  const img = h('img', {
    class: 'hero-render', alt: '黃昏的以色列營地示意圖：中間是會幕和院子，四周是帳棚，會幕上方的雲柱裡有火光。',
    src: 'images/camp-dusk-1920.jpg', srcset: 'images/camp-dusk-960.jpg 960w, images/camp-dusk-1920.jpg 1920w', sizes: '100vw',
    decoding: 'async', fetchpriority: 'high',
  });
  const pic = h('picture', null, h('source', { media: '(max-width: 720px)', srcset: 'images/camp-dusk-portrait.jpg' }), img);
  const poster = h('div', { class: 'hero-poster hero-poster-render' }, pic);
  const el = h('div', { class: 'hero-camp' }, canvas, tags, poster);
  const canWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();
  if (canWebGL) {
    const go = h('button', { class: 'hero-3d', type: 'button' }, svg(ICONS.tent), '轉動 3D 營地');
    go.addEventListener('click', async () => {
      go.disabled = true;
      go.textContent = '載入中…';
      try {
        const { createCamp } = await import('../three/camp');
        const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(max-width: 560px)').matches;
        await createCamp(canvas, tags, { reducedMotion: motionOff() || animOff(), lowPower, hero: true });
        el.classList.add('is-3d');
        poster.remove();
        go.remove();
      } catch (e) {
        console.error(e);
        go.disabled = false;
        go.textContent = '轉動 3D 營地';
      }
    });
    el.append(go);
  }
  return el;
}

/**
 * 能走多近：同心圈示意圖（不按比例）。
 * 紅色箭頭往外＝不潔淨的時候被擋在哪裡；綠色虛線往內＝得潔淨以後走回來的路（第 14 章），編號對應右邊的清單。
 */
function ringsSvg(poster = false): SVGSVGElement {
  const W = 560;
  const cx = W / 2, cy = W / 2;
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${W}`, class: `rings-svg${poster ? ' poster' : ''}`, role: 'img', 'aria-label': '同心圈：中間是聖所，往外是會幕門口、營中、營外。紅色箭頭往外，表示越不潔淨被隔得越遠；綠色路線往內，表示得潔淨以後一步一步走回會幕門口。' });
  svgEl.append(s('defs', {},
    s('marker', { id: 'ar-red', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--unclean)' })),
    s('marker', { id: 'ar-green', viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', fill: 'var(--clean)' }))));
  const band = [
    { r: 262, fill: 'var(--ring-out)', label: '營外', y: 34 },
    { r: 206, fill: 'var(--ring-camp)', label: '營中', y: 92 },
    { r: 124, fill: 'var(--ring-door)', label: '會幕門口', y: 174 },
    { r: 62, fill: 'var(--ring-holy)', label: '聖所', y: 238 },
  ];
  svgEl.append(s('circle', { cx, cy, r: 262, fill: 'none', stroke: 'var(--line-2)', 'stroke-dasharray': '6 6' }));
  for (const b of band) svgEl.append(s('circle', { cx, cy, r: b.r, fill: b.fill, stroke: 'var(--line-2)', 'stroke-width': 1.2 }));
  for (const b of band) svgEl.append(s('text', { x: cx, y: b.y, 'text-anchor': 'middle', class: 'ring-label' }, b.label));
  if (poster) return svgEl;

  const P = (deg: number, r: number) => [cx + Math.cos((deg * Math.PI) / 180) * r, cy + Math.sin((deg * Math.PI) / 180) * r];

  // 往外：越不潔淨，被擋得越遠。兩道紅線＝兩道界線
  const arc = (r: number, a0: number, a1: number) => {
    const [x0, y0] = P(a0, r);
    const [x1, y1] = P(a1, r);
    return `M${x0.toFixed(1)} ${y0.toFixed(1)} A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  };
  const [ax, ay] = P(208, 40);
  const [bx, by] = P(208, 252);
  svgEl.append(s('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: 'var(--unclean)', 'stroke-width': 3, 'stroke-opacity': 0.55, 'marker-end': 'url(#ar-red)' }));
  for (const [r, t] of [[124, '不能碰聖物'], [206, '要住到營外']] as [number, string][]) {
    svgEl.append(s('path', { d: arc(r, 194, 222), fill: 'none', stroke: 'var(--unclean)', 'stroke-width': 7, 'stroke-linecap': 'round' }));
    const [x, y] = P(208, r - 24);
    svgEl.append(s('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'ring-tick' }, t));
  }

  // 往內：得潔淨以後走回來（利14）
  const pts = [P(8, 236), P(20, 194), P(34, 163), P(58, 102), P(84, 100)];
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  svgEl.append(s('path', { d, fill: 'none', stroke: 'var(--clean)', 'stroke-width': 4, 'stroke-dasharray': '9 7', 'stroke-linejoin': 'round', class: 'back-path' }));
  // 這一家的帳棚（帳棚外住七天的地方），放在 3 號旁邊
  const [tx, ty] = P(44, 186);
  svgEl.append(s('path', { d: `M${tx - 14} ${ty + 12} L${tx} ${ty - 12} L${tx + 14} ${ty + 12} Z`, fill: '#c98a5a', stroke: '#6b4a2a', 'stroke-width': 1.5 }));
  pts.forEach(([x, y], i) => {
    svgEl.append(s('circle', { cx: x, cy: y, r: 13, fill: 'var(--clean)', stroke: 'var(--surface)', 'stroke-width': 2.5 }));
    svgEl.append(s('text', { x, y: y + 5, 'text-anchor': 'middle', class: 'ring-num' }, String(i + 1)));
  });
  return svgEl;
}

export function buildIntro(): HTMLElement {
  const hero = heroCamp();
  hero.append(h('div', { class: 'hero-title' },
    h('h1', { 'aria-label': '潔淨與不潔淨' }, ...[...'潔淨與不潔淨'].map((c, i) => h('span', { class: 'ch', style: `--i:${i}`, 'aria-hidden': 'true' }, c))),
    h('div', { class: 'epi' }, h('p', { class: 'epigraph' }, `「${EPIGRAPH.q}」`), refChip(EPIGRAPH.refs![0], EPIGRAPH.q))));
  hero.append(h('p', { class: 'hero-hint' }, '拖曳可以轉動；營地的大小與帳棚數目是示意。'));
  // 渲染圖的說明：畫的是哪一節，以及這是示意
  hero.append(h('p', { class: 'hero-cap' }, factLine(CLOUD), h('span', null, '營地的大小與帳棚數目是示意。')));

  const cast = h('div', { class: 'cast' }, ...CAST.map((c) => h('div', { class: `cast-card card who-${c.id}` },
    h('span', { class: 'cast-dot' }), h('b', null, c.name), h('small', null, c.note))));

  const rings = h('div', null,
    h('p', { class: 'near-point' }, factLine(NEAR_POINT)),
    h('div', { class: 'rings' },
      h('div', { class: 'rings-fig' }, ringsSvg()),
      h('div', { class: 'near-cols' },
        h('section', { class: 'near-col out' },
          h('h3', null, h('span', { class: 'near-key' }), '不潔淨的時候，被擋在哪裡'),
          h('small', null, '由輕到重'),
          h('ul', null, ...BLOCKED.map((b) => h('li', null, h('b', null, b.label), h('span', null, b.fact.text), h('span', { class: 'ring-q' }, quoteLine(b.fact)))))),
        h('section', { class: 'near-col back' },
          h('h3', null, h('span', { class: 'near-key' }), '得潔淨的時候，怎麼走回來'),
          h('small', null, '以第 14 章長大痲瘋的人為例；編號對應圖上的綠色路線'),
          h('ol', null, ...RETURN.map((b) => h('li', null, h('b', null, b.label), h('span', null, b.fact.text), h('span', { class: 'ring-q' }, quoteLine(b.fact)))))))),
    voiceBlock(NEAR_VOICE));

  const lengths = h('div', { class: 'lengths' }, ...LENGTHS.map((l, i) => h('div', { class: 'len card', style: `--k:${i}` },
    h('div', { class: 'len-bar' }, h('i')),
    h('b', null, l.label),
    h('span', null, factLine(l.fact)))));

  const road = h('ol', { class: 'roadmap' }, ...ROADMAP.map((r) => {
    const sc = SCENE_BY_ID[r.scene];
    return h('li', null, h('a', { class: `road card${sc.ready ? '' : ' soon'}`, href: sceneHref(r.scene), style: `--c:${sc.color}` },
      h('span', { class: 'road-range' }, sc.range),
      h('b', null, r.title),
      h('span', { class: 'road-q' }, `「${r.fact.q}」`),
      sc.ready ? null : h('small', { class: 'soon-tag' }, '還在做')));
  }));

  const howto = h('div', { class: 'card howto' },
    h('h3', null, svg(ICONS.book), '這個網站怎麼讀'),
    h('ul', null,
      h('li', null, '我們用一家人為例子。這家人是虛構的，但他們遇到的事都照經文的規矩處理，旁邊附上經節。'),
      h('li', null, '點任何一個經節（像 ', refChip('利11:31', '凡摸了的，必不潔淨到晚上'), '），就會跳出和合本經文，引號裡的摘句會標出來。'),
      h('li', null, '沒有標籤的句子，是經文直接這樣寫的。其他三種會掛上標籤：'),
      h('li', null, '想看原文、詞義和註釋家的細節，打開右上角的「研經模式」。')),
    h('div', { class: 'howto-tags' }, badge('synthesis'), badge('not_stated'), badge('interpretation')));

  return h('article', { class: 'scene scene-intro' },
    hero,
    h('div', { class: 'wrap' },
      h('header', { class: 'scene-head' },
        h('div', { class: 'kicker' }, '利未記 11–15 章・序幕'),
        h('h2', { class: 'intro-h' }, '我們用一家人為例子，走一遍利未記 11–15 章'),
        h('p', { class: 'lede' }, '第十章最後，神吩咐祭司要分辨潔淨的和不潔淨的。', ...refChips(['利10:10']), ' 第十一到十五章把這件事講得很細：吃什麼、生孩子以後、皮膚和衣服上的病、房屋、身體的漏症。這些都是一般人家裡會碰到的事，所以用營中的一家人為例子。')),
      layer('這一家人', '人物是虛構的，規矩照經文', cast),
      layer('能走多近', '這五章的規矩，決定一個人能離會幕多近', flythrough(), rings,
        h('p', { class: 'cloud-note' }, svg(ICONS.fire), factLine(CLOUD))),
      layer('不潔淨有多久', '短的到晚上，長的要等病好', lengths),
      layer('五章各講什麼', '點一章進去', road),
      h('section', { class: 'layer reason' },
        h('p', { class: 'reason-q' }, `「${REASON.q}」`),
        h('p', { class: 'reason-ref' }, ...refChips(REASON.refs, REASON.q), ' 第十五章快結束時，用這句話說明為什麼要守這些條例。')),
      h('section', { class: 'block-s' }, howto),
      sceneNav('intro')));
}
