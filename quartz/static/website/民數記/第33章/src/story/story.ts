import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SEGMENTS, STATIONS } from '../data/stations';
import { TIMED_EXACT, TOTAL_MONTHS, stationMonths, timeLabel } from '../data/dates';
import { H, POSITIONS, W, pointAt, pos, trailD } from '../geo';
import { animOff, h, s } from '../ui/dom';
import { monthsAt } from '../ui/playhead';
import { smoothScrollTo } from '../ui/motion';
import { buildBeats } from './beats';
import type { Frame } from './beats';
import './story.css';

gsap.registerPlugin(ScrollTrigger);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const segIndex = (n: number) => SEGMENTS.ct.findIndex((sg) => n >= sg.from && n <= sg.to);

/** 和 scripts/blender/build_relief.py 的渲染範圍一樣：地圖範圍四邊各多一度 */
const RELIEF = { x: -142.894, y: -165, w: 1286.048, h: 1154.588 };
/** 故事裡會寫出名字的站 */
const NAMED = new Set([1, 5, 12, 33, 34, 42]);

export interface Story { el: HTMLElement }

/**
 * 開場：畫面固定（sticky）一張地圖，卡片從上面捲過去。捲動位置換成「第幾幕＋進度」，
 * 路線畫到第幾站、地圖框到哪裡、時間過了多久都跟著內插。沒有捲動劫持，捲軸照常動。
 */
export function createStory(opts: { heroSrc: string; reliefSrc: { light: string; dark: string }; onPlay: () => void }): Story {
  const skip = h('a', { class: 'sskip', href: '#journey' }, '跳過故事，直接看旅程地圖');
  const beats = buildBeats(skip);

  /* ---- 地圖 ---- */
  const svgEl = s('svg', { class: 'smap', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' });
  const reliefAttrs = { x: RELIEF.x, y: RELIEF.y, width: RELIEF.w, height: RELIEF.h, preserveAspectRatio: 'none' };
  svgEl.append(
    s('rect', { x: -W, y: -H, width: W * 3, height: H * 3, class: 'smap-sea' }),
    s('image', { ...reliefAttrs, href: opts.reliefSrc.light, class: 'relief relief-light' }),
    s('image', { ...reliefAttrs, href: opts.reliefSrc.dark, class: 'relief relief-dark' }),
  );
  // 整條路線的淡線（只在結尾出現）與「十一天的路程」那一段
  const ghost = s('path', { d: trailD(42), class: 'smap-ghost' });
  const a12 = pos(12);
  const a33 = pos(33);
  const elevenD = `M${a12.x} ${a12.y}Q${(a12.x + a33.x) / 2 + 60} ${(a12.y + a33.y) / 2} ${a33.x} ${a33.y}`;
  const eleven = s('path', { d: elevenD, class: 'smap-eleven' });
  // 十一天的路程的終點：加低斯巴尼亞（還沒走到，先畫一個淡圈）
  const elevenEnd = s('circle', { cx: a33.x, cy: a33.y, class: 'smap-eleven-end' });
  const elevenLabel = s('text', { x: (a12.x + a33.x) / 2 + 44, y: (a12.y + a33.y) / 2, class: 'smap-eleven-label' }, '十一天的路程');
  // 三十八年那一段：可能在這一帶的淡圈
  const zones = s('g', { class: 'smap-zones' });
  for (const p of POSITIONS) if (p.mode === 'zone') zones.append(s('circle', { cx: p.zx!, cy: p.zy!, r: p.zr!, class: 'smap-zone', 'data-n': p.n }));
  // 走過的路：一段一段畫。兩端都在三十八年那一段的連線，順序和位置都不確定，畫成細的淡虛線（和旅程地圖一樣）
  const legs = POSITIONS.slice(0, -1).map((a, i) => {
    const b = POSITIONS[i + 1];
    const faint = a.mode === 'zone' && b.mode === 'zone';
    const d = `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    const g = s('g', { class: `smap-leg${faint ? ' faint' : ''}` }, s('path', { d, class: 'smap-trail-glow' }), s('path', { d, class: 'smap-trail' }));
    return { g, a, b, full: d, t: -1 };
  });
  // 站點：走到才出現；顏色依 CT 三段；經文有日期的站是實心
  const dots = POSITIONS.map((p) => {
    const g = s('g', { class: `smap-st seg-${segIndex(p.n)}${TIMED_EXACT.has(p.n) ? ' exact' : ''}${p.mode === 'zone' ? ' zone' : ''}`, transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})` });
    g.append(s('circle', { r: 5.5, class: 'smap-dot' }));
    if (NAMED.has(p.n)) g.append(s('text', { x: 10, y: 4, class: 'smap-label' }, STATIONS[p.n - 1].name));
    return g;
  });
  const walker = s('g', { class: 'smap-walker' }, s('circle', { r: 16, class: 'smap-halo' }), s('circle', { r: 6.5, class: 'smap-head' }));
  svgEl.append(ghost, eleven, elevenEnd, elevenLabel, zones, ...legs.map((l) => l.g), ...dots, walker);

  /* ---- 時間：出埃及後過了多久 ---- */
  const tNum = h('b', { class: 'shud-time' });
  const tSub = h('span', { class: 'shud-sub' });
  const barFill = h('span', { class: 'shud-fill' });
  const bar = h('span', { class: 'shud-bar', 'aria-hidden': 'true' },
    ...SEGMENTS.ct.map((sg, i) => {
      // 三段在四十年裡各佔多少時間：第一段只有三個月，幾乎看不見——這正是要讓人看到的
      const a = stationMonths(sg.from === 1 ? 1 : sg.from - 1);
      const b = stationMonths(sg.to);
      return h('span', { class: `shud-seg seg-${i}`, style: `left:${(a / TOTAL_MONTHS) * 100}%;width:${((b - a) / TOTAL_MONTHS) * 100}%` });
    }), barFill);
  const hud = h('div', { class: 'shud', 'aria-live': 'off' }, h('span', { class: 'shud-k' }, '出埃及到現在'), tNum, bar, tSub);

  /* ---- 舞台 ---- */
  const hero = h('img', { class: 'shero', src: opts.heroSrc, alt: '', decoding: 'async', fetchpriority: 'high' });
  const rail = h('ol', { class: 'story-rail', 'aria-label': '故事的段落' });
  const stage = h('div', { class: 'story-stage' }, h('div', { class: 'smap-wrap' }, svgEl), hero, h('div', { class: 'story-scrim', 'aria-hidden': 'true' }), hud, rail);

  const stepEls = beats.map((b, i) => h('div', { class: `story-step${b.kind ? ` is-${b.kind}` : ''}`, 'data-i': i, style: `--len:${b.len ?? 100}` },
    h('article', { class: 'scard', 'aria-label': b.nav ?? b.id }, b.card())));
  const endIdx = beats.findIndex((b) => b.id === 'end');
  stepEls[endIdx].querySelector('.scard')!.append(h('div', { class: 'send-actions' },
    h('a', { class: 'btn primary', href: '#journey' }, '看旅程地圖'),
    h('button', { class: 'btn', type: 'button', onclick: () => opts.onPlay() }, '開始走')),
  h('p', { class: 'send-note' }, '底圖是現代地形，站的位置是現代候選地點，都是示意。'));
  const el = h('section', { class: 'story', id: 'top', 'aria-label': '曠野四十二站：捲動故事' }, stage, h('div', { class: 'story-steps' }, ...stepEls));

  beats.forEach((b, i) => {
    if (!b.nav) return;
    rail.append(h('li', null, h('button', { type: 'button', 'data-i': i, onclick: () => goTo(i) }, h('span', { class: 'rail-dot' }), h('span', { class: 'rail-t' }, b.nav))));
  });

  /* ---- 捲動位置 → 幕 ---- */
  let centers: number[] = [];
  const measure = () => { centers = stepEls.map((st) => { const r = st.getBoundingClientRect(); return r.top + scrollY + r.height / 2; }); };
  const fAt = (y: number) => {
    const vc = y + innerHeight / 2;
    if (vc <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) if (vc < centers[i + 1]) return i + (vc - centers[i]) / (centers[i + 1] - centers[i]);
    return centers.length - 1;
  };
  function goTo(i: number) { measure(); void smoothScrollTo(centers[i] - innerHeight / 2, 900); }

  /**
   * 地圖框：卡片在左邊時，把框放進右邊 60% 的空間；直式螢幕卡片在下面，框放進上面 52%。
   * 回傳 viewBox（地圖單位）
   */
  function fitFrame(fr: Frame): Frame {
    const sw = stage.clientWidth || innerWidth;
    const sh = stage.clientHeight || innerHeight;
    const portrait = sw / sh < 0.8;
    // 扣掉卡片、頂列與右上角的時間面板占的地方
    const area = portrait ? { x: 0, y: 150, w: sw, h: sh * 0.52 - 150 } : { x: sw * 0.4, y: 200, w: sw * 0.6 - 70, h: sh - 240 };
    // 每地圖單位幾像素：框得進可用區，但至少要讓暈渲圖鋪滿整個畫面（寧可左右裁掉一點，也不露出圖的邊）
    const k = Math.max(Math.min(area.w / fr.w, area.h / fr.h), sw / RELIEF.w, sh / RELIEF.h);
    const cx = fr.x + fr.w / 2;
    const cy = fr.y + fr.h / 2;
    const vw = sw / k;
    const vh = sh / k;
    // 框的中心對到可用區的中心；視窗盡量不超出暈渲圖的範圍（超出就會看到圖的邊）
    let x = cx - (area.x + area.w / 2) / k;
    let y = cy - (area.y + area.h / 2) / k;
    x = Math.min(Math.max(x, RELIEF.x), RELIEF.x + RELIEF.w - vw);
    y = Math.min(Math.max(y, RELIEF.y), RELIEF.y + RELIEF.h - vh);
    return { x, y, w: vw, h: vh };
  }

  let f = 0;
  let lastActive = -1;
  const cur = { x: 0, y: 0, w: W, h: H, p: 1 };
  let target = { ...cur };
  let raf = 0;

  function apply() {
    const i = Math.min(beats.length - 1, Math.floor(f));
    const j = Math.min(beats.length - 1, i + 1);
    const t = smooth(0.18, 0.82, f - i);
    const a = beats[i];
    const b = beats[j];
    const fa = fitFrame(a.frame);
    const fb = fitFrame(b.frame);
    target = { x: lerp(fa.x, fb.x, t), y: lerp(fa.y, fb.y, t), w: lerp(fa.w, fb.w, t), h: lerp(fa.h, fb.h, t), p: lerp(a.p, b.p, t) };
    const heroV = lerp(a.hero, b.hero, smooth(0.05, 0.6, f - i));
    hero.style.opacity = String(heroV);
    // 斜視圖跟著捲動慢慢放大一點（捲動帶動的，不是自己會動的動畫）
    hero.style.transform = `scale(${(1.06 + (1 - heroV) * 0.08).toFixed(3)})`;
    ghost.classList.toggle('on', (a.ghost && t < 0.5) || (b.ghost && t >= 0.5) || false);
    const el11 = (a.eleven && t < 0.5) || (b.eleven && t >= 0.5) || false;
    for (const x of [eleven, elevenEnd, elevenLabel]) x.classList.toggle('on', el11);
    stage.classList.toggle('is-hero', heroV > 0.5);

    const active = Math.round(f);
    if (active !== lastActive) {
      lastActive = active;
      stepEls.forEach((st, k) => st.classList.toggle('is-active', k === active));
      let navOn = active;
      while (navOn > 0 && !beats[navOn].nav) navOn--;
      rail.querySelectorAll('button').forEach((btn) => {
        const k = Number(btn.dataset.i);
        btn.classList.toggle('on', k === navOn);
        btn.classList.toggle('past', k < navOn);
        if (k === navOn) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      });
    }
    if (!raf) raf = requestAnimationFrame(frame);
  }

  /** 鏡頭與路線用阻尼跟上目標：捲得快時不會跳 */
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
    last = now;
    const k = animOff() ? 1 : 1 - Math.exp(-dt * 5);
    cur.x = lerp(cur.x, target.x, k);
    cur.y = lerp(cur.y, target.y, k);
    cur.w = lerp(cur.w, target.w, k);
    cur.h = lerp(cur.h, target.h, k);
    cur.p = lerp(cur.p, target.p, k);
    draw();
    const settled = Math.abs(cur.x - target.x) + Math.abs(cur.y - target.y) + Math.abs(cur.w - target.w) + Math.abs(cur.p - target.p) * 50 < 0.05;
    raf = settled ? 0 : requestAnimationFrame(frame);
  }

  function draw() {
    svgEl.setAttribute('viewBox', `${cur.x.toFixed(2)} ${cur.y.toFixed(2)} ${cur.w.toFixed(2)} ${cur.h.toFixed(2)}`);
    // 地圖放大時線條、站點、字不跟著變粗變大
    svgEl.style.setProperty('--z', (cur.w / (stage.clientWidth || innerWidth)).toFixed(4));
    const p = cur.p;
    legs.forEach((leg, i) => {
      // 第 i+1 站到第 i+2 站：走完的整段顯示，正在走的那段只畫到走動的人那裡
      const t = Math.min(1, Math.max(0, p - (i + 1)));
      if (t === leg.t) return;
      leg.t = t;
      leg.g.classList.toggle('on', t > 0);
      const d = t >= 1 ? leg.full : `M${leg.a.x.toFixed(1)} ${leg.a.y.toFixed(1)}L${(leg.a.x + (leg.b.x - leg.a.x) * t).toFixed(1)} ${(leg.a.y + (leg.b.y - leg.a.y) * t).toFixed(1)}`;
      leg.g.querySelectorAll('path').forEach((pa) => pa.setAttribute('d', d));
    });
    const pt = pointAt(p);
    walker.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)})`);
    const reached = Math.floor(p + 0.02);
    dots.forEach((g, i) => g.classList.toggle('on', i + 1 <= reached));
    // 淡圈只顯示目前這一站的：全部一起出現就擠成一團
    zones.querySelectorAll<SVGCircleElement>('.smap-zone').forEach((c) => c.classList.toggle('on', Number(c.dataset.n) === Math.round(p)));
    const months = monthsAt(p);
    tNum.textContent = timeLabel(months).replace('出埃及後', '');
    const n = Math.min(42, Math.max(1, Math.round(p)));
    tSub.textContent = `第 ${n} 站 ${STATIONS[n - 1].name}${TIMED_EXACT.has(n) ? '（經文有日期）' : '（平均分配，示意）'}`;
    barFill.style.transform = `scaleX(${(months / TOTAL_MONTHS).toFixed(4)})`;
  }

  requestAnimationFrame(() => {
    measure();
    ScrollTrigger.create({
      trigger: el, start: 'top top', end: 'bottom bottom',
      onUpdate: () => { f = fAt(scrollY); apply(); },
      onRefresh: () => { measure(); f = fAt(scrollY); apply(); },
    });
    f = fAt(scrollY);
    apply();
    // 第一格直接到位，不從預設框滑過來
    Object.assign(cur, target);
    draw();
  });
  addEventListener('resize', () => ScrollTrigger.refresh());
  return { el };
}
