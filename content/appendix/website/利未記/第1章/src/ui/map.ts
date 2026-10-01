import type { Actor, Item, Move, PlaceId } from '../data/types';
import { animOff, s, wait } from './dom';
import { ACTOR, ITEM_LABEL, PLACE_LABEL } from './meta';

/**
 * 會幕院子的示意俯視圖（未按比例）。
 * 橫式：西在左、東在右、北在上；直式（手機）整張轉 90°：西在上、東在下、北在右。
 * 所有座標先用橫式 1000×600 定義，再經 P() 轉換。
 */
const W = 1000;
const H = 600;

type Pt = [number, number];

export const PLACES: Record<PlaceId, Pt> = {
  gate: [846, 305],
  front: [770, 430],
  north: [590, 178],
  altar: [590, 300],
  around: [590, 300],
  horns: [590, 300],
  base: [566, 384],
  side: [668, 360],
  east: [712, 300],
  laver: [412, 300],
  door: [318, 300],
  veil: [152, 300],
  incense: [190, 300],
  court: [430, 128],
  camp: [926, 150],
  outside: [926, 462],
};

const ALTAR = { x: 525, y: 235, w: 130, h: 130 };

const ITEM_STYLE: Record<string, { fill: string; ink: string }> = {
  fat: { fill: '#f3dc8a', ink: '#5c4510' },
  meat: { fill: '#d98b6a', ink: '#4a1f10' },
  breast: { fill: '#e7a77a', ink: '#4a2410' },
  thigh: { fill: '#c9784e', ink: '#fff' },
  skin: { fill: '#9b6b43', ink: '#fff' },
  ash: { fill: '#9a948d', ink: '#fff' },
  flour: { fill: '#f1e5c4', ink: '#5a4a20' },
  cake: { fill: '#e8c98a', ink: '#5a4210' },
  bread: { fill: '#e8c98a', ink: '#5a4210' },
  grain: { fill: '#dcc46a', ink: '#4a3a08' },
  silver: { fill: '#c9d2dc', ink: '#243240' },
  oil: { fill: '#d6c24a', ink: '#3a3208' },
};

const ANIMAL_PATH: Record<string, string> = {
  bull: 'M-9-4c-3-1-5-4-5-7 3 1 6 3 7 5M9-4c3-1 5-4 5-7-3 1-6 3-7 5M-7-5h14l-2 11c-1 3-3 4-5 4s-4-1-5-4z M-3 5h.01M3 5h.01',
  ram: 'M-7-6h14l-2 11c-1 3-3 4-5 4s-4-1-5-4z M-7-5c-5-1-6 6-2 7M7-5c5-1 6 6 2 7 M-3 3h.01M3 3h.01',
  goat: 'M-5-6h10l-1 10c-1 3-2 4-4 4s-3-1-4-4z M-4-6l-4-7M4-6l4-7 M-1 8l1 6 1-6 M-2 2h.01M2 2h.01',
  lamb: 'M-8-2a4 4 0 0 1 4-6 4 4 0 0 1 8 0 4 4 0 0 1 4 6 4 4 0 0 1-2 7h-12a4 4 0 0 1-2-7z M-3 1h.01M3 1h.01',
  bird: 'M-11 2c4 0 6-2 8-6 2-3 6-4 9-2l4 1-4 2c0 5-4 9-11 9-3 0-5-1-6-4z M2-4h.01',
};
const ANIMALS = new Set(['bull', 'ram', 'goat', 'lamb', 'bird']);

const DROP = 'M0-7c2.6 3.7 5 6.2 5 9a5 5 0 0 1-10 0c0-2.8 2.4-5.3 5-9z';
const HAND = 'M-6 8v-9a1.6 1.6 0 0 1 3.2 0v-4a1.6 1.6 0 0 1 3.2 0v-1a1.6 1.6 0 0 1 3.2 0v2a1.6 1.6 0 0 1 3.2 0v8c0 5-3 8-7 8s-5-1-6-4l-3-5a1.5 1.5 0 0 1 2.4-1.8z';
const FLAME = 'M0-26c4 9 15 14 15 28A15 15 0 0 1-15 2c0-8 6-11 6-17 3 3 4.5 6 6 9 3-6 3-14 3-20z';

export interface MapApi {
  root: SVGSVGElement;
  reset(): void;
  highlight(place: PlaceId | null, color: string): void;
  actor(actor: Actor | null, place: PlaceId): void;
  play(move: Move, animate: boolean): Promise<void>;
  setOrientation(portrait: boolean): void;
}

export function createMap(): MapApi {
  let portrait = false;
  const P = ([x, y]: Pt): Pt => (portrait ? [H - y, x] : [x, y]);
  const root = s('svg', { class: 'map', role: 'img', 'aria-label': '會幕院子示意圖' });
  const base = s('g');
  const marks = s('g');
  const tokens = s('g', { class: 'tokens' });
  const overlay = s('g');
  // guide：人物與「這一步在哪裡」的虛線圈，換步驟時滑過去，不重建
  const guide = s('g');
  root.append(base, marks, tokens, overlay, guide);
  const hlG = s('g', { class: 'hl-g', style: 'opacity:0' });
  const hlCircle = s('circle', { cx: 0, cy: 0, r: 38, class: 'place-hl' });
  hlG.append(hlCircle);
  const actorG = s('g', { class: 'actor actor-g', style: 'opacity:0' });
  guide.append(hlG, actorG);
  let actorKey = '';

  function rect(x: number, y: number, w: number, hgt: number, attrs: Record<string, string | number> = {}) {
    const [x1, y1] = P([x, y]);
    const [x2, y2] = P([x + w, y + hgt]);
    return s('rect', { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1), ...attrs });
  }
  function line(a: Pt, b: Pt, attrs: Record<string, string | number> = {}) {
    const [x1, y1] = P(a);
    const [x2, y2] = P(b);
    return s('line', { x1, y1, x2, y2, ...attrs });
  }
  function text(pt: Pt, t: string, cls = 'small', anchor = 'middle', dy = 0) {
    const [x, y] = P(pt);
    return s('text', { x, y: y + dy, 'text-anchor': anchor, class: cls }, t);
  }

  function drawBase() {
    base.replaceChildren();
    const vw = portrait ? H : W;
    const vh = portrait ? W : H;
    root.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    const defs = s('defs');
    defs.innerHTML = `
      <pattern id="sand" width="18" height="18" patternUnits="userSpaceOnUse"><rect width="18" height="18" fill="var(--bg-2)"/><circle cx="4" cy="5" r="1" fill="var(--line)"/><circle cx="13" cy="12" r="1" fill="var(--line)"/></pattern>
      <pattern id="grate" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" stroke="#6e4526" stroke-width="1.2" opacity=".45"/></pattern>
      <linearGradient id="bronze" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c98a52"/><stop offset="1" stop-color="#8a5328"/></linearGradient>
      <linearGradient id="goldg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ecc55b"/><stop offset="1" stop-color="#b98a1f"/></linearGradient>
      <linearGradient id="weave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3553a0"/><stop offset=".33" stop-color="#3553a0"/><stop offset=".33" stop-color="#6d3f8f"/><stop offset=".66" stop-color="#6d3f8f"/><stop offset=".66" stop-color="#b3263a"/><stop offset="1" stop-color="#b3263a"/></linearGradient>
      <radialGradient id="glow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ff7a1a" stop-opacity="0"/></radialGradient>`;
    base.append(defs);
    base.append(s('rect', { x: 0, y: 0, width: vw, height: vh, fill: 'url(#sand)' }));

    // 營中、營外
    base.append(rect(862, 40, 128, 250, { rx: 14, fill: 'var(--surface)', stroke: 'var(--line-2)', 'stroke-dasharray': '6 5' }));
    base.append(text([926, 72], '營中', 'zone-label'));
    base.append(text([926, 72], '獻祭者的家', 'small', 'middle', 27));
    for (const [tx, ty] of [[892, 150], [950, 130], [910, 215], [960, 230]] as Pt[]) {
      const [x, y] = P([tx, ty]);
      base.append(s('path', { d: `M${x - 16} ${y + 10}L${x} ${y - 12}L${x + 16} ${y + 10}Z`, fill: 'var(--bg-2)', stroke: 'var(--line-2)' }));
    }
    base.append(rect(862, 330, 128, 250, { rx: 14, fill: 'color-mix(in srgb, var(--ink-3) 14%, var(--surface))', stroke: 'var(--line-2)', 'stroke-dasharray': '6 5' }));
    base.append(text([926, 362], '營外', 'zone-label'));
    base.append(text([926, 362], '潔淨之地', 'small', 'middle', 27));
    base.append(text([926, 362], '倒灰之所', 'small', 'middle', 52));
    const [ox, oy] = P([926, 500]);
    base.append(s('ellipse', { cx: ox, cy: oy, rx: 34, ry: 12, fill: '#9a948d', opacity: 0.6 }));

    // 院子
    base.append(rect(20, 40, 826, 520, { rx: 6, fill: 'color-mix(in srgb, var(--linen) 55%, var(--bg))', stroke: 'var(--line-2)', 'stroke-width': 6, 'stroke-dasharray': '2 9', 'stroke-linecap': 'round' }));
    base.append(text([40, 30], '院子的帷子（細麻）', 'small', 'start'));
    // 院門
    base.append(line([846, 232], [846, 378], { stroke: 'url(#weave)', 'stroke-width': 10, 'stroke-linecap': 'round' }));
    base.append(text([846, 222], '院門（東）', 'small'));

    // 會幕
    base.append(rect(45, 205, 285, 190, { rx: 4, fill: 'url(#goldg)', opacity: 0.22, stroke: '#b98a1f', 'stroke-width': 3 }));
    base.append(line([135, 205], [135, 395], { stroke: 'url(#weave)', 'stroke-width': 7 }));
    base.append(line([330, 215], [330, 385], { stroke: 'url(#weave)', 'stroke-width': 7 }));
    base.append(text([90, 232], '至聖所', 'small'));
    base.append(text([230, 232], '聖所', 'small'));
    base.append(text([135, 418], '幔子', 'small'));
    base.append(text([330, 418], '會幕門', 'small'));
    // 約櫃、桌子、燈臺（定位用）
    base.append(rect(75, 285, 32, 22, { fill: 'url(#goldg)', rx: 3 }));
    base.append(rect(232, 244, 34, 16, { fill: 'url(#goldg)', rx: 2, opacity: 0.8 }));
    const [lx, ly] = P([249, 356]);
    base.append(s('circle', { cx: lx, cy: ly, r: 9, fill: 'none', stroke: '#b98a1f', 'stroke-width': 3 }));
    // 香壇
    base.append(rect(176, 286, 28, 28, { fill: 'url(#goldg)', rx: 2, stroke: '#8f6a14' }));
    for (const [dx, dy] of [[0, 0], [28, 0], [0, 28], [28, 28]]) {
      const [hx, hy] = P([176 + dx, 286 + dy]);
      base.append(s('circle', { cx: hx, cy: hy, r: 3.5, fill: '#8f6a14' }));
    }
    base.append(text([190, 334], '香壇', 'small'));

    // 洗濯盆
    const [cx, cy] = P(PLACES.laver);
    base.append(s('circle', { cx, cy, r: 24, fill: 'url(#bronze)' }));
    base.append(s('circle', { cx, cy, r: 16, fill: '#6fa7b8', opacity: 0.85 }));
    base.append(text([412, 344], '洗濯盆', 'small'));

    // 院子（聖處）吃祭物的區域
    base.append(rect(372, 86, 120, 78, { rx: 12, fill: 'none', stroke: 'var(--line-2)', 'stroke-dasharray': '5 4' }));
    base.append(text([372, 112], '會幕的院子', 'small'));
    base.append(text([372, 112], '（聖處・祭司吃）', 'small', 'middle', 24));

    // 壇北邊
    base.append(rect(530, 150, 120, 58, { rx: 10, fill: 'none', stroke: 'var(--line-2)', 'stroke-dasharray': '5 4' }));
    base.append(text([590, 145], '壇的北邊（宰牲處）', 'small'));

    // 燔祭壇
    base.append(rect(ALTAR.x - 10, ALTAR.y - 10, ALTAR.w + 20, ALTAR.h + 20, { rx: 16, fill: 'none', stroke: 'var(--line-2)', 'stroke-dasharray': '3 6' }));
    base.append(rect(ALTAR.x, ALTAR.y, ALTAR.w, ALTAR.h, { rx: 4, fill: 'url(#bronze)', stroke: '#6e4526', 'stroke-width': 3 }));
    base.append(rect(ALTAR.x + 14, ALTAR.y + 14, ALTAR.w - 28, ALTAR.h - 28, { rx: 3, fill: 'url(#grate)', stroke: '#6e4526', opacity: 0.9 }));
    for (const [dx, dy] of [[0, 0], [ALTAR.w, 0], [0, ALTAR.h], [ALTAR.w, ALTAR.h]]) {
      const [hx, hy] = P([ALTAR.x + dx, ALTAR.y + dy]);
      base.append(s('path', { d: `M${hx - 11} ${hy + 8}L${hx} ${hy - 12}L${hx + 11} ${hy + 8}Z`, fill: '#b0703a', stroke: '#6e4526', 'stroke-width': 2 }));
    }
    base.append(text([590, 396 + 20], '燔祭壇', 'zone-label'));
    // 東邊倒灰處
    const [ax, ay] = P(PLACES.east);
    base.append(s('ellipse', { cx: ax, cy: ay, rx: 18, ry: 12, fill: '#9a948d', opacity: 0.7 }));
    base.append(text([724, 330], '倒灰處', 'small'));
    // 會幕門口（壇前）
    base.append(text([770, 508], '會幕門口', 'small'));
    base.append(text([770, 508], '（壇前）', 'small', 'middle', 24));

    // 方位
    const [nx, ny] = P([60, 520]);
    const [tx, ty] = P([60, 492]);
    const comp = s('g', { 'aria-hidden': 'true' });
    comp.append(s('line', { x1: nx, y1: ny, x2: tx, y2: ty, stroke: 'var(--ink-2)', 'stroke-width': 2, 'marker-end': '' }));
    comp.append(s('circle', { cx: tx, cy: ty, r: 3, fill: 'var(--ink-2)' }));
    const [lnx, lny] = P([60, 478]);
    comp.append(s('text', { x: lnx, y: lny + 4, 'text-anchor': 'middle', class: 'small', style: 'font-weight:700' }, '北'));
    base.append(comp);

    // 常駐的火
    fire = s('g', { class: 'fire' });
    const [fx, fy] = P(PLACES.altar);
    fire.append(s('circle', { cx: fx, cy: fy, r: 46, fill: 'url(#glow)', opacity: 0.5 }));
    const flame = s('path', { d: FLAME, transform: `translate(${fx} ${fy + 8}) scale(1.1)`, fill: 'var(--fire)', opacity: 0.9 });
    const inner = s('path', { d: FLAME, transform: `translate(${fx} ${fy + 12}) scale(.6)`, fill: '#ffd27a' });
    fire.append(flame, inner);
    if (!animOff()) {
      flame.animate([{ opacity: 0.75 }, { opacity: 1 }, { opacity: 0.8 }], { duration: 900, iterations: Infinity });
    }
    fire.style.opacity = '0.35';
    base.append(fire);
  }

  let fire: SVGGElement;
  const placed = new Map<string, SVGGElement>();
  let sprinkleCount = 0;

  function token(item: Item): SVGGElement {
    const g = s('g', { class: 'token' });
    if (ANIMALS.has(item)) {
      g.append(s('circle', { r: 19, fill: 'var(--surface)', stroke: 'var(--ink-2)', 'stroke-width': 2 }));
      g.append(s('path', { d: ANIMAL_PATH[item], fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
      g.append(s('text', { y: 33, 'text-anchor': 'middle', class: 'small', style: 'font-weight:700;fill:var(--ink)' }, ITEM_LABEL[item]));
    } else if (item === 'blood') {
      g.append(s('path', { d: DROP, fill: 'var(--blood)', transform: 'scale(1.3)' }));
    } else if (item === 'hand') {
      g.append(s('path', { d: HAND, fill: 'var(--surface)', stroke: 'var(--ink)', 'stroke-width': 1.6, transform: 'scale(1.3)' }));
    } else if (item === 'fire') {
      g.append(s('path', { d: FLAME, fill: 'var(--fire)', transform: 'scale(.7)' }));
    } else if (item === 'smoke') {
      g.append(s('path', { d: 'M0 0c-8-10 8-16 0-26s8-16 0-26', fill: 'none', stroke: 'var(--ink-3)', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0.6 }));
      g.append(s('text', { x: 14, y: -40, class: 'small', style: 'font-weight:700' }, '馨香'));
    } else {
      const st = ITEM_STYLE[item] ?? { fill: 'var(--surface)', ink: 'var(--ink)' };
      const label = ITEM_LABEL[item] ?? item;
      const w = 16 + label.length * 14;
      g.append(s('rect', { x: -w / 2, y: -12, width: w, height: 24, rx: 12, fill: st.fill, stroke: 'rgb(0 0 0 / 25%)' }));
      g.append(s('text', { y: 5, 'text-anchor': 'middle', style: `font-size:16px;font-weight:700;fill:${st.ink}` }, label));
    }
    return g;
  }

  const at = (g: SVGGElement, pt: Pt) => {
    g.style.transform = `translate(${pt[0]}px, ${pt[1]}px)`;
  };

  function jitter(key: string): Pt {
    // 同一個地方的多個物件錯開擺放
    let n = 0;
    placed.forEach((_, k) => k.startsWith(key + '|') && n++);
    const offsets: Pt[] = [[0, 0], [-34, 16], [34, 16], [0, 32], [-34, -16], [34, -16]];
    return offsets[n % offsets.length];
  }

  function bloodMarks(how: Move['how'], to: PlaceId, count = 7, animate: boolean) {
    const pts: Pt[] = [];
    if (to === 'around') {
      for (let i = 0; i < 16; i++) {
        const t = i / 16;
        const per = 2 * (ALTAR.w + ALTAR.h) + 80;
        let d = t * per;
        const x0 = ALTAR.x - 12;
        const y0 = ALTAR.y - 12;
        const w = ALTAR.w + 24;
        const hh = ALTAR.h + 24;
        let p: Pt;
        if (d < w) p = [x0 + d, y0];
        else if ((d -= w) < hh) p = [x0 + w, y0 + d];
        else if ((d -= hh) < w) p = [x0 + w - d, y0 + hh];
        else p = [x0, y0 + hh - Math.min(d - w, hh)];
        pts.push(p);
      }
    } else if (to === 'horns') {
      pts.push([ALTAR.x, ALTAR.y], [ALTAR.x + ALTAR.w, ALTAR.y], [ALTAR.x, ALTAR.y + ALTAR.h], [ALTAR.x + ALTAR.w, ALTAR.y + ALTAR.h]);
    } else if (to === 'incense') {
      pts.push([176, 286], [204, 286], [176, 314], [204, 314]);
    } else if (to === 'veil') {
      for (let i = 0; i < count; i++) pts.push([150, 250 + i * 16]);
    } else {
      pts.push(PLACES[to]);
    }
    const g = s('g');
    pts.forEach((p, i) => {
      const [x, y] = P(p);
      let el: SVGElement;
      if (how === 'pour' || how === 'drain') {
        el = s('ellipse', { cx: x, cy: y, rx: how === 'pour' ? 26 : 12, ry: how === 'pour' ? 10 : 6, fill: 'var(--blood)', opacity: 0.75 });
      } else {
        el = s('path', { d: DROP, transform: `translate(${x} ${y}) scale(${to === 'veil' || to === 'incense' ? 0.8 : 0.9})`, fill: 'var(--blood)' });
      }
      if (animate && !animOff()) {
        el.style.opacity = '0';
        el.animate([{ opacity: 0, transform: el.getAttribute('transform') + ' scale(0.2)' }, { opacity: 1 }], {
          duration: 260, delay: (to === 'veil' ? 380 : 55) * i, fill: 'forwards',
        });
      }
      g.append(el);
    });
    marks.append(g);
    if (to === 'veil') {
      sprinkleCount = count;
      const [cx, cy] = P([112, 250]);
      const counter = s('text', { x: cx, y: cy, 'text-anchor': 'middle', class: 'zone-label', style: 'fill:var(--blood)' }, animate ? '1' : `${count} 次`);
      marks.append(counter);
      if (animate) {
        for (let i = 1; i <= count; i++) setTimeout(() => (counter.textContent = i === count ? `${count} 次` : String(i)), animOff() ? 0 : 380 * (i - 1));
      }
    }
  }

  const api: MapApi = {
    root,
    reset() {
      marks.replaceChildren();
      tokens.replaceChildren();
      overlay.replaceChildren();
      placed.clear();
      sprinkleCount = 0;
      fire.style.opacity = '0.35';
    },
    highlight(place, color) {
      if (!place) {
        hlG.style.opacity = '0';
        return;
      }
      const [x, y] = P(PLACES[place]);
      const r = place === 'around' || place === 'altar' || place === 'horns' ? 92 : 38;
      hlCircle.setAttribute('r', String(r));
      hlCircle.style.setProperty('--c', color);
      hlG.style.transform = `translate(${x}px, ${y}px)`;
      hlG.style.opacity = '1';
    },
    actor(actor, place) {
      if (!actor) {
        actorG.style.opacity = '0';
        actorKey = '';
        return;
      }
      const a = ACTOR[actor];
      const [x, y] = P(PLACES[place]);
      const dx = place === 'veil' || place === 'incense' || place === 'door' ? 0 : -58;
      const dy = place === 'veil' || place === 'incense' || place === 'door' ? -70 : place === 'court' || place === 'north' ? 0 : -54;
      const fresh = actorG.style.opacity === '0';
      if (actorKey !== actor) {
        // 換了一個人：內容換掉，輕輕跳一下
        actorG.replaceChildren(
          s('circle', { r: 22, fill: a.color, stroke: 'var(--surface)', 'stroke-width': 3 }),
          s('text', { y: 7, 'text-anchor': 'middle', style: 'font-size:20px' }, a.glyph),
          s('text', { y: 46, 'text-anchor': 'middle', style: 'fill:var(--ink);font-size:21px;font-weight:700;paint-order:stroke;stroke:var(--surface);stroke-width:5px' }, a.label));
        if (!animOff() && !fresh) actorG.firstElementChild?.animate([{ transform: 'scale(.6)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], { duration: 420 });
        actorKey = actor;
      }
      if (fresh) {
        // 第一次出現：直接放到位置再淡入，不從上一個變體的位置滑過來
        actorG.style.transition = 'none';
        actorG.style.transform = `translate(${x + dx}px, ${y + dy}px)`;
        void actorG.getBoundingClientRect();
        actorG.style.transition = '';
      } else actorG.style.transform = `translate(${x + dx}px, ${y + dy}px)`;
      actorG.style.opacity = '1';
    },
    async play(move, animate) {
      const to = P(PLACES[move.to]);
      const key = `${move.to}|${move.item}`;
      if (move.item === 'blood' && move.how !== 'carry') {
        bloodMarks(move.how, move.to, move.count, animate);
        if (animate) await wait(move.to === 'veil' ? 380 * (move.count ?? 7) : 700);
        return;
      }
      if (move.item === 'fire') {
        fire.style.transition = animate ? 'opacity .6s' : '';
        fire.style.opacity = '1';
        if (animate) await wait(600);
        return;
      }
      if (move.item === 'smoke') {
        fire.style.opacity = '1';
        const g = token('smoke');
        at(g, [to[0] + 6, to[1] - 26]);
        tokens.append(g);
        if (animate && !animOff()) {
          g.animate([{ opacity: 0, transform: `translate(${to[0] + 6}px, ${to[1] - 10}px)` }, { opacity: 1, transform: `translate(${to[0] + 6}px, ${to[1] - 30}px)` }], { duration: 900, fill: 'forwards' });
          await wait(900);
        }
        return;
      }
      if (move.how === 'burn') {
        // 燒掉：把該物件移到目的地後淡出
        const existing = [...placed.entries()].find(([k]) => k.endsWith('|' + move.item));
        const g = existing?.[1] ?? token(move.item);
        if (!existing) {
          const from = P(PLACES[move.from ?? move.to]);
          at(g, from);
          tokens.append(g);
        } else placed.delete(existing[0]);
        if (move.to === 'outside' || move.to === 'altar') {
          if (move.to === 'altar') fire.style.opacity = '1';
          else {
            const [fx, fy] = to;
            const f = s('path', { d: FLAME, transform: `translate(${fx} ${fy + 26}) scale(.9)`, fill: 'var(--fire)' });
            marks.append(f);
          }
        }
        if (animate && !animOff()) {
          await g.animate([{ transform: g.style.transform, opacity: 1 }, { transform: `translate(${to[0]}px, ${to[1]}px) scale(.6)`, opacity: 0 }], { duration: 800, easing: 'ease-in', fill: 'forwards' }).finished;
        }
        g.remove();
        return;
      }
      if (move.how === 'wave') {
        const existing = [...placed.entries()].find(([k]) => k.endsWith('|' + move.item));
        let g = existing?.[1];
        if (!g) {
          g = token(move.item);
          const off = jitter(`${move.to}`);
          at(g, [to[0] + off[0], to[1] + off[1]]);
          tokens.append(g);
          placed.set(`${move.to}|${move.item}`, g);
        }
        if (animate && !animOff()) {
          const base = g.style.transform;
          await g.animate([{ transform: base }, { transform: base + ' translateX(-14px)' }, { transform: base + ' translateX(14px)' }, { transform: base }], { duration: 900, iterations: 2 }).finished;
        }
        return;
      }
      if (move.how === 'eat') {
        const existing = [...placed.entries()].find(([k]) => k.endsWith('|' + move.item));
        const g = existing?.[1] ?? token(move.item);
        if (!existing) {
          at(g, P(PLACES[move.from ?? move.to]));
          tokens.append(g);
        } else placed.delete(existing[0]);
        if (animate && !animOff()) {
          await g.animate([{ transform: g.style.transform }, { transform: `translate(${to[0]}px, ${to[1]}px)` }], { duration: 700, easing: 'ease-in-out', fill: 'forwards' }).finished;
          await g.animate([{ opacity: 1 }, { opacity: 0.25 }], { duration: 500, fill: 'forwards' }).finished;
        }
        at(g, to);
        g.style.opacity = '0.3';
        return;
      }
      if (move.item === 'hand') {
        const target = [...placed.entries()].reverse().find(([k]) => ANIMALS.has(k.split('|')[1]));
        const g = token('hand');
        const pos = target ? target[1].style.transform : `translate(${to[0]}px, ${to[1]}px)`;
        g.style.transform = pos + ' translate(12px, -22px)';
        overlay.append(g);
        if (animate && !animOff()) {
          await g.animate([{ transform: pos + ' translate(12px, -46px)', opacity: 0 }, { transform: pos + ' translate(12px, -22px)', opacity: 1 }], { duration: 500 }).finished;
          await wait(500);
        }
        g.remove();
        return;
      }
      // carry / place：從 from 移到 to，留在那裡
      const existing = [...placed.entries()].find(([k]) => k.endsWith('|' + move.item));
      let g: SVGGElement;
      let from: Pt;
      if (existing) {
        g = existing[1];
        placed.delete(existing[0]);
        from = [0, 0];
      } else {
        g = token(move.item);
        from = P(PLACES[move.from ?? move.to]);
        at(g, from);
        tokens.append(g);
      }
      const off = jitter(move.to);
      const dest: Pt = [to[0] + off[0], to[1] + off[1]];
      placed.set(key, g);
      if (animate && !animOff()) {
        await g.animate([{ transform: g.style.transform }, { transform: `translate(${dest[0]}px, ${dest[1]}px)` }], { duration: 750, easing: 'cubic-bezier(.4,.1,.2,1)', fill: 'forwards' }).finished;
      }
      at(g, dest);
      void from;
    },
    setOrientation(p) {
      portrait = p;
      drawBase();
      api.reset();
      hlG.style.opacity = '0';
      actorG.style.opacity = '0';
    },
  };
  drawBase();
  void sprinkleCount;
  void PLACE_LABEL;
  return api;
}
