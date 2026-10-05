import BASEMAP from '../data/basemap.json';
import { EVENTS } from '../data/events';
import { LANDMARK_KEYS, LEVEL_LABEL, OB_DATA, SITES, WANDER, candLabel, isWander } from '../data/sites';
import { SEGMENTS, STATIONS } from '../data/stations';
import { BBOX, H, POSITIONS, W, boundsOf, pointAt, project, trailD } from '../geo';
import * as store from '../store';
import type { State } from '../store';
import { animOff, fill, h, motionOff, s, svg } from './dom';
import { ICONS } from './icons';
import * as playhead from './playhead';

/**
 * 旅程地圖（SVG）。底圖是 Natural Earth（公有領域）；站的位置是現代候選地點，不是經文給的。
 *
 * 動畫：
 *  - 走動的人沿路線連續移動（播放頭 playhead.ts 驅動），走路時手腳擺動，頭上是雲柱（夜間是火柱）；
 *  - 走過的路留下一條軌跡，到站有漣漪；
 *  - 鏡頭有緩動：按鈕、選站、跟隨都是滑過去，不是瞬間跳；拖曳時才即時跟手。
 * 減少動態時，以上都改成直接到位。
 */

interface View { x: number; y: number; w: number }
/** scripts/blender/build_relief.py 的渲染範圍：地圖範圍四邊各多一度 */
export const RELIEF = { x: -142.894, y: -165, w: 1286.048, h: 1154.588 };
const MIN_W = W * 0.05;
/** 最大縮小：容器很扁時，要放得下整條路線得縮得更小 */
const MAX_W = W * 1.7;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 標記、站名等不隨縮放變大的東西，依縮放程度換算的比例 */
const sizeFor = (k: number) => clamp(k * 1.25, 0.16, 1.15);

const ringPath = (ring: number[][]) => `M${ring.map(([lon, lat]) => project(lon, lat).map((v) => v.toFixed(1)).join(' ')).join('L')}Z`;

/** 只有這幾站在全圖時就顯示站名，其餘要放大或打開「站名」 */
const KEY_STATIONS = new Set([1, 5, 12, 33, 34, 42]);

/** 地區與水域名稱（示意位置；今名用灰色斜體） */
const GEO_LABELS: { text: string; lon: number; lat: number; kind: 'sea' | 'region' | 'river'; size?: number }[] = [
  { text: '地中海', lon: 33.4, lat: 32.15, kind: 'sea', size: 26 },
  { text: '蘇伊士灣', lon: 32.75, lat: 28.15, kind: 'sea', size: 17 },
  { text: '亞喀巴灣', lon: 35.05, lat: 28.05, kind: 'sea', size: 17 },
  { text: '死海', lon: 35.52, lat: 31.32, kind: 'sea', size: 14 },
  { text: '尼羅河', lon: 30.55, lat: 31.05, kind: 'river', size: 15 },
  { text: '約旦河', lon: 35.66, lat: 32.15, kind: 'river', size: 14 },
  { text: '埃及', lon: 30.35, lat: 30.1, kind: 'region', size: 30 },
  { text: '西乃半島', lon: 33.25, lat: 29.85, kind: 'region', size: 26 },
  { text: '巴蘭曠野', lon: 33.9, lat: 30.3, kind: 'region', size: 16 },
  { text: '尋的曠野', lon: 34.85, lat: 31.1, kind: 'region', size: 16 },
  { text: '以東', lon: 35.9, lat: 30.1, kind: 'region', size: 22 },
  { text: '摩押', lon: 36.0, lat: 31.15, kind: 'region', size: 22 },
];

const eventStations = new Set(EVENTS.map((e) => e.st));

export interface JourneyMapApi {
  el: HTMLElement;
  /** 把鏡頭帶到這一站 */
  focus(n: number): void;
  fitAll(): void;
  fitSegment(n: number): void;
}

export function createJourneyMap(): JourneyMapApi {
  const root = s('svg', {
    class: 'jmap', viewBox: `0 0 ${W} ${H}`, role: 'group', preserveAspectRatio: 'xMidYMid meet',
    'aria-label': '曠野四十二站路線示意圖：底圖是現代地形，站的位置是現代候選地點',
  });

  /* ---------------------------------------------------------------- 底圖 */
  const gBase = s('g', { class: 'basemap', 'aria-hidden': 'true' });
  gBase.append(s('rect', { x: -W, y: -H, width: W * 3, height: H * 3, class: 'sea' }));
  gBase.append(
    s('image', {
      class: 'relief relief-light', href: `${import.meta.env.BASE_URL}relief/relief-light.webp`,
      x: RELIEF.x, y: RELIEF.y, width: RELIEF.w, height: RELIEF.h, preserveAspectRatio: 'none', decoding: 'async',
    }),
    s('image', {
      class: 'relief relief-dark', href: `${import.meta.env.BASE_URL}relief/relief-dark.webp`,
      x: RELIEF.x, y: RELIEF.y, width: RELIEF.w, height: RELIEF.h, preserveAspectRatio: 'none', decoding: 'async',
    }),
  );
  for (const poly of BASEMAP.land) {
    gBase.append(s('path', { d: poly.map(ringPath).join(''), class: 'land', 'fill-rule': 'evenodd' }));
  }
  for (const lake of BASEMAP.lakes) gBase.append(s('path', { d: lake.rings.map(ringPath).join(''), class: 'lake', 'fill-rule': 'evenodd' }));
  for (const r of BASEMAP.rivers) {
    gBase.append(s('path', { d: `M${r.pts.map(([lon, lat]) => project(lon, lat).map((v) => v.toFixed(1)).join(' ')).join('L')}`, class: 'river' }));
  }
  // 經緯線（每 1 度），幫助讀方位
  const gGrid = s('g', { class: 'grid', 'aria-hidden': 'true' });
  for (let lon = Math.ceil(BBOX.w); lon <= BBOX.e; lon++) {
    const [x] = project(lon, BBOX.s);
    gGrid.append(s('path', { d: `M${x.toFixed(1)} 0V${H}`, class: 'grid-line' }));
  }
  for (let lat = Math.ceil(BBOX.s); lat <= BBOX.n; lat++) {
    const [, y] = project(BBOX.w, lat);
    gGrid.append(s('path', { d: `M0 ${y.toFixed(1)}H${W}`, class: 'grid-line' }));
  }
  const gGeo = s('g', { class: 'geo-labels', 'aria-hidden': 'true' });
  for (const l of GEO_LABELS) {
    const [x, y] = project(l.lon, l.lat);
    gGeo.append(s('text', { x: x.toFixed(1), y: y.toFixed(1), class: `geo-label ${l.kind}`, style: `font-size:${l.size ?? 16}px` }, l.text));
  }
  // 三十八年那一段：每一站畫在可信候選的中間值，一個很淡的圈圈出候選散布的範圍。
  // 平常不畫（避免又擠成一團）；只有選到或走到的那一站，才浮現它自己的圈，圈裡再顯示各個候選點。
  const gZones = s('g', { class: 'zones', 'aria-hidden': 'true' });
  const zoneEls = new Map<number, SVGGElement>();
  for (const p of POSITIONS) {
    if (p.mode !== 'zone') continue;
    const z = SITES[p.n - 1].zone!;
    const g = s('g', { class: 'zone', 'data-n': p.n });
    g.append(s('circle', { cx: p.zx!.toFixed(1), cy: p.zy!.toFixed(1), r: p.zr!.toFixed(1), class: 'zone-c' }));
    for (const c of z.used) {
      const [x, y] = project(c.lon, c.lat);
      g.append(s('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 2.6, class: 'zone-dot' }));
    }
    zoneEls.set(p.n, g);
    gZones.append(g);
  }
  // 比例尺（約略）
  const gScale = s('g', { class: 'scale-fix', 'aria-hidden': 'true' });
  const km100 = 165 * (100 / 111);
  gScale.append(
    s('path', { d: `M0 0h${km100.toFixed(1)}M0 -4v8M${km100.toFixed(1)} -4v8`, class: 'scale-line' }),
    s('text', { x: (km100 / 2).toFixed(1), y: -8, class: 'scale-text' }, '約 100 公里'),
  );

  /* ---------------------------------------------------------------- 路線與走過的軌跡 */
  const gRoute = s('g', { class: 'route' });
  const legs: SVGPathElement[] = [];
  for (let i = 0; i < POSITIONS.length - 1; i++) {
    const a = POSITIONS[i];
    const b = POSITIONS[i + 1];
    const solid = (a.level === 'high' || a.level === 'mid') && (b.level === 'high' || b.level === 'mid') && a.mode !== 'zone' && b.mode !== 'zone';
    // 兩端都在三十八年那一段：順序和位置都不確定，連線畫得更淡，免得像一團毛線
    const faint = a.mode === 'zone' && b.mode === 'zone';
    const leg = s('path', { d: `M${a.x.toFixed(1)} ${a.y.toFixed(1)}L${b.x.toFixed(1)} ${b.y.toFixed(1)}`, class: `leg${solid ? '' : ' dashed'}${faint ? ' faint' : ''}`, 'data-leg': i + 1 });
    legs.push(leg);
    gRoute.append(leg);
  }
  // 摩押平原：民33:49 從伯耶施末到亞伯什亭，畫成一小段範圍
  const moab = SITES[41];
  if (moab.lon2 !== undefined && moab.lat2 !== undefined) {
    const a = project(moab.lon, moab.lat);
    const b = project(moab.lon2, moab.lat2);
    gRoute.append(s('path', { d: `M${a[0].toFixed(1)} ${a[1].toFixed(1)}L${b[0].toFixed(1)} ${b[1].toFixed(1)}`, class: 'span-line' }));
  }
  const gTrail = s('g', { class: 'trail-wrap', 'aria-hidden': 'true' });
  const trailGlow = s('path', { class: 'trail-glow' });
  const trail = s('path', { class: 'trail' });
  gTrail.append(trailGlow, trail);

  /* ---------------------------------------------------------------- 候選地點 */
  const gCand = s('g', { class: 'cands' });
  const candEls: { n: number; i: number; el: SVGGElement; x: number; y: number }[] = [];
  const candLine = s('path', { class: 'cand-link' });
  STATIONS.forEach((st) => {
    const site = SITES[st.n - 1];
    site.cands.forEach((c, i) => {
      if (st.key === 'moab') return;
      // 站的標記畫在候選地點上時，採用的那一個不重複畫；zone 的站畫在中間值，每個候選都要畫出來
      if (i === site.pick) return;
      const [x, y] = project(c.lon, c.lat);
      const g = s('g', { class: `cand${i === site.pick ? ' pick' : ''}`, 'data-n': st.n, 'data-i': i, transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
      g.append(s('path', { d: 'M0 -6L6 0L0 6L-6 0Z', class: 'cand-mark' }), s('text', { x: 9, y: 4, class: 'cand-text' }, `${st.n} ${candLabel(c.name)}`));
      candEls.push({ n: st.n, i, el: g, x, y });
      gCand.append(g);
    });
  });
  for (const k of LANDMARK_KEYS) {
    const c = OB_DATA[k].cands[0];
    const [x, y] = project(c.lon, c.lat);
    const name = k === 'pihahiroth' ? '比哈希錄' : '巴力洗分';
    const g = s('g', { class: 'cand landmark', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` });
    g.append(s('path', { d: 'M0 -6L6 0L0 6L-6 0Z', class: 'cand-mark' }), s('text', { x: 9, y: 4, class: 'cand-text' }, `${name}（地標）`));
    gCand.append(g);
    candEls.push({ n: 0, i: -1, el: g, x, y });
  }

  /* ---------------------------------------------------------------- 站 */
  const gStations = s('g', { class: 'stations' });
  const stEls: SVGGElement[] = [];
  let dragged = false;
  for (const st of STATIONS) {
    const p = POSITIONS[st.n - 1];
    const site = SITES[st.n - 1];
    const g = s('g', {
      class: `st lv-${p.level}${eventStations.has(st.n) ? ' has-ev' : ''}${p.mode === 'zone' ? ' zoned' : ''}`, 'data-n': st.n, tabindex: 0, role: 'button',
      'aria-label': `第${st.n}站 ${st.name}，位置可信度${LEVEL_LABEL[site.level]}${p.mode === 'zone' ? '，位置只是候選的中間值' : ''}`,
    });
    g.append(s('circle', { r: 12, class: 'st-hit' }));
    // 淡虛線環：這一站的位置是候選的中間值，只是「可能在這一帶」
    if (p.mode === 'zone') g.append(s('circle', { r: 11.5, class: 'st-halo' }));
    g.append(
      s('circle', { r: 7.5, class: 'st-dot' }),
      s('text', { class: 'st-num', y: 3 }, String(st.n)),
      s('text', { class: 'st-name', x: p.lx, y: p.ly, 'text-anchor': p.anchor }, st.name),
    );
    const pick = () => store.selectStation(st.n);
    g.addEventListener('click', (e) => { e.stopPropagation(); if (!dragged) pick(); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
    stEls.push(g);
    gStations.append(g);
  }
  const gFx = s('g', { class: 'fx', 'aria-hidden': 'true' });

  /* ---------------------------------------------------------------- 走動的人與雲柱 */
  const limb = (cls: string) => s('path', { class: `limb ${cls}` });
  const legL = limb('leg-l');
  const legR = limb('leg-r');
  const armL = limb('arm-l');
  const armR = limb('arm-r');
  const fig = s('g', { class: 'walker-fig' },
    s('g', { class: 'pillar' },
      s('ellipse', { cx: 0, cy: -20, rx: 12, ry: 6.5, class: 'pillar-cloud' }),
      s('ellipse', { cx: -6, cy: -24, rx: 7, ry: 5, class: 'pillar-cloud' }),
      s('ellipse', { cx: 6, cy: -25, rx: 8, ry: 5.5, class: 'pillar-cloud' }),
      s('path', { d: 'M0 -26c3 4 6 6 6 11a6 6 0 0 1-12 0c0-5 3-7 6-11z', class: 'pillar-fire' })),
    s('circle', { cx: 0, cy: -8, r: 3.2, class: 'walker-head' }),
    s('path', { d: 'M0 -5V3', class: 'limb torso' }), armL, armR, legL, legR);
  const gWalker = s('g', { class: 'walker', 'aria-hidden': 'true' }, fig);
  let phase = 0;
  let facing = 1;
  let limbsMoving = false;
  function animateLimbs(ph: number, moving: boolean) {
    const a = moving ? Math.sin(ph) * 0.8 : 0;
    const f = (x: number) => x.toFixed(2);
    legL.setAttribute('d', `M0 3L${f(Math.sin(a) * 5)} ${f(3 + Math.cos(a) * 6)}`);
    legR.setAttribute('d', `M0 3L${f(-Math.sin(a) * 5)} ${f(3 + Math.cos(a) * 6)}`);
    armL.setAttribute('d', `M0 -3L${f(-Math.sin(a) * 4)} ${f(-3 + Math.cos(a) * 4)}`);
    armR.setAttribute('d', `M0 -3L${f(Math.sin(a) * 4)} ${f(-3 + Math.cos(a) * 4)}`);
    const bob = moving ? -Math.abs(Math.cos(ph)) * 1.3 : 0;
    fig.setAttribute('transform', `translate(0 ${bob.toFixed(2)}) scale(${facing} 1)`);
  }
  animateLimbs(0, false);

  root.append(gBase, gGrid, gGeo, gZones, gRoute, gTrail, gCand, candLine, gStations, gFx, gWalker, gScale);

  /* ---------------------------------------------------------------- 鏡頭：目標與目前，每一格往目標靠近 */
  /** 視野的長寬比永遠等於容器，這樣不會露出視野以外的區域 */
  let aspect = H / W;
  let cam: View = { x: 0, y: 0, w: W };
  let camT: View = { ...cam };
  let lastK = -1;
  let progress = playhead.getP();

  const clampView = (v: View): View => {
    const w = clamp(v.w, MIN_W, MAX_W);
    const hh = w * aspect;
    return { x: clamp(v.x, -w * 0.15, W - w * 0.85), y: clamp(v.y, -hh * 0.15, H - hh * 0.85), w };
  };
  const centerOn = (x: number, y: number, w: number): View => ({ x: x - w / 2, y: y - (w * aspect) / 2, w });
  const viewFor = (b: { x: number; y: number; w: number; h: number }): View => {
    const w = Math.max(b.w, b.h / aspect, W * 0.12);
    return { x: b.x + b.w / 2 - w / 2, y: b.y + b.h / 2 - (w * aspect) / 2, w };
  };

  function placeWalker() {
    const pt = pointAt(progress);
    const sc = clamp((cam.w / W) * 1.4, 0.2, 1.3);
    gWalker.setAttribute('transform', `translate(${pt.x.toFixed(1)} ${pt.y.toFixed(1)}) scale(${sc.toFixed(3)})`);
  }

  function updateScaled(k: number) {
    const sc = sizeFor(k).toFixed(3);
    stEls.forEach((g, i) => {
      const p = POSITIONS[i];
      g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${sc})`);
    });
    for (const c of candEls) c.el.setAttribute('transform', `translate(${c.x.toFixed(1)} ${c.y.toFixed(1)}) scale(${sc})`);
    placeWalker();
  }

  function applyView() {
    const v = clampView(cam);
    cam = v;
    const hh = v.w * aspect;
    root.setAttribute('viewBox', `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${hh.toFixed(2)}`);
    const k = v.w / W;
    root.classList.toggle('zoomed', k < 0.5);
    root.classList.toggle('zoomed-far', k < 0.4);
    if (Math.abs(k - lastK) > 0.0008) { lastK = k; updateScaled(k); }
    gScale.setAttribute('transform', `translate(${(v.x + v.w * 0.03).toFixed(1)} ${(v.y + hh * 0.965).toFixed(1)}) scale(${Math.min(1, k * 1.25).toFixed(3)})`);
  }

  let loopRaf = 0;
  let lastNow = 0;
  let lastMoveAt = -1e9;
  function ensureLoop() {
    if (loopRaf) return;
    lastNow = performance.now();
    loopRaf = requestAnimationFrame(loop);
  }
  function loop(now: number) {
    loopRaf = 0;
    const dt = clamp((now - lastNow) / 1000, 0, 0.25);
    lastNow = now;
    let busy = false;

    // 鏡頭：指數趨近，跟隨播放時慢一點、平順一點
    const st = store.get();
    const rate = st.playing && st.follow ? 4 : 7;
    const kk = 1 - Math.exp(-dt * rate);
    const dx = camT.x - cam.x;
    const dy = camT.y - cam.y;
    const dw = camT.w - cam.w;
    if (Math.abs(dx) > 0.04 || Math.abs(dy) > 0.04 || Math.abs(dw) > 0.06) {
      cam = { x: cam.x + dx * kk, y: cam.y + dy * kk, w: cam.w + dw * kk };
      applyView();
      busy = true;
    } else if (dx || dy || dw) {
      cam = { ...camT };
      applyView();
    }

    // 走路：手腳擺動；停下來就回到站姿
    const moving = now - lastMoveAt < 150;
    if (moving) {
      phase += dt * 11;
      animateLimbs(phase, true);
      limbsMoving = true;
      busy = true;
    } else if (limbsMoving) {
      limbsMoving = false;
      animateLimbs(0, false);
    }
    if (busy) loopRaf = requestAnimationFrame(loop);
  }

  /** 鏡頭滑到 v；減少動態時直接到位 */
  function flyTo(v: View) {
    camT = clampView(v);
    if (animOff()) { cam = { ...camT }; applyView(); return; }
    ensureLoop();
  }
  /** 直接設定（拖曳、雙指縮放：要即時跟手） */
  function setNow(v: View) {
    cam = clampView(v);
    camT = { ...cam };
    applyView();
  }

  const ALL = Array.from({ length: 42 }, (_, i) => i + 1);
  const fitAll = () => flyTo(viewFor(boundsOf(ALL, 60)));
  const fitSegment = (n: number) => {
    const seg = SEGMENTS[store.get().seg].find((sg) => n >= sg.from && n <= sg.to)!;
    flyTo(viewFor(boundsOf(Array.from({ length: seg.to - seg.from + 1 }, (_, i) => seg.from + i), 60)));
  };

  /** 選到某一站：不在畫面裡、或在三十八年那一片而畫面還太遠時，鏡頭滑過去；其他時候不打擾 */
  function focusStation(n: number) {
    const p = POSITIONS[n - 1];
    const hh = camT.w * aspect;
    const mx = camT.w * 0.12;
    const my = hh * 0.12;
    const hidden = p.x < camT.x + mx || p.x > camT.x + camT.w - mx || p.y < camT.y + my || p.y > camT.y + hh - my;
    if (isWander(n) && camT.w > W * 0.42) flyTo(centerOn(p.x, p.y, W * 0.4)); // 三十八年那一段挨得近，要拉近才看得清楚
    else if (hidden) flyTo(centerOn(p.x, p.y, Math.min(camT.w, W * 0.5)));
  }
  const focus = (n: number) => flyTo(centerOn(POSITIONS[n - 1].x, POSITIONS[n - 1].y, Math.min(camT.w, W * 0.5)));

  /** 跟隨播放：鏡頭朝走動的人前面一點；三十八年那一片放得更近 */
  function followWalker(p: number, moving: boolean) {
    const st = store.get();
    const inWander = p > WANDER.from - 1 && p < WANDER.to + 1;
    const w = inWander ? W * 0.36 : st.pace === 'time' ? W * 0.75 : W * 0.5;
    const pt = pointAt(p);
    const ahead = moving ? Math.min(30, w * 0.05) : 0;
    const v = clampView(centerOn(pt.x + Math.cos(pt.angle) * ahead, pt.y + Math.sin(pt.angle) * ahead, w));
    camT = v;
    if (animOff()) { cam = { ...camT }; applyView(); } else ensureLoop();
  }

  /* ---------------------------------------------------------------- 播放頭 → 畫面 */
  playhead.onMove((p, moving) => {
    progress = p;
    placeWalker();
    const d = trailD(p);
    trail.setAttribute('d', d);
    trailGlow.setAttribute('d', d);
    if (moving) {
      const a = pointAt(p).angle;
      const cx = Math.cos(a);
      if (Math.abs(cx) > 0.2) facing = cx >= 0 ? 1 : -1;
      lastMoveAt = performance.now();
      ensureLoop();
    }
    const st = store.get();
    if (st.playing && st.follow) followWalker(p, moving);
  });

  /** 到站的漣漪 */
  function ripple(n: number) {
    if (motionOff()) return;
    const p = POSITIONS[n - 1];
    const g = s('g', { transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${sizeFor(cam.w / W).toFixed(3)})` });
    g.append(s('circle', { r: 9, class: 'ripple' }), s('circle', { r: 9, class: 'ripple r2' }));
    gFx.append(g);
    setTimeout(() => g.remove(), 1500);
  }
  playhead.onArrive((n) => {
    ripple(n);
    stEls[n - 1]?.classList.add('arrive');
    setTimeout(() => stEls[n - 1]?.classList.remove('arrive'), 700);
  });

  /* ---------------------------------------------------------------- 依 store 更新 */
  const GT_COLORS = 6;
  function render(st: Readonly<State>, prev?: Readonly<State>) {
    root.classList.toggle('night', st.night);
    root.classList.toggle('show-cands', st.layers.candidates);
    root.classList.toggle('show-labels', st.layers.labels);
    root.classList.toggle('has-sel', st.sel !== null);
    root.classList.toggle('playing', st.playing);
    const segs: readonly { from: number; to: number }[] = SEGMENTS[st.seg];
    const nColors = st.seg === 'ct' ? 3 : GT_COLORS;
    legs.forEach((leg, i) => {
      const seg = segs.findIndex((sg) => i + 1 >= sg.from && i + 1 < sg.to + 1);
      leg.setAttribute('data-seg', String(seg % nColors));
    });
    stEls.forEach((g, i) => {
      const n = i + 1;
      const seg = segs.findIndex((sg) => n >= sg.from && n <= sg.to);
      g.setAttribute('data-seg', String(seg % nColors));
      g.classList.toggle('sel', st.sel === n);
      g.classList.toggle('cur', st.at === n);
      g.classList.toggle('key', KEY_STATIONS.has(n) || st.sel === n || st.at === n);
      g.setAttribute('aria-pressed', String(st.sel === n));
    });

    // 三十八年那一段：選到或走到的站，淡圈與圈裡的候選點浮現
    zoneEls.forEach((g, n) => g.classList.toggle('on', st.sel === n || st.at === n));

    // 選到的站：顯示它的候選地點；從資訊卡按「在地圖上看」的候選再連一條線過去
    const target: { n: number; i: number } | null = st.cand;
    for (const c of candEls) {
      c.el.classList.toggle('shown', c.n > 0 && (st.layers.candidates || st.sel === c.n));
      c.el.classList.toggle('hot', !!target && target.n === c.n && target.i === c.i);
    }
    if (target) {
      const c = candEls.find((x) => x.n === target!.n && x.i === target!.i);
      const p = POSITIONS[target.n - 1];
      if (c) {
        candLine.setAttribute('d', `M${p.x.toFixed(1)} ${p.y.toFixed(1)}L${c.x.toFixed(1)} ${c.y.toFixed(1)}`);
        candLine.classList.add('on');
      }
    } else candLine.classList.remove('on');

    if (!prev) return;
    // 開始播放／打開跟隨：鏡頭滑到走動的人身邊
    if (st.playing && st.follow && (!prev.playing || !prev.follow)) followWalker(playhead.getP(), false);
    // 播完：稍等一下再退回看全圖
    if (prev.playing && !st.playing && st.at === 42 && st.follow) setTimeout(() => { if (!store.get().playing) fitAll(); }, 1100);
    // 選了一站（不是播放帶動的）：必要時把鏡頭帶過去
    if (st.sel !== null && st.sel !== prev.sel && !st.playing) focusStation(st.sel);
    // 「在地圖上看」某個候選：讓標記與候選都在畫面裡
    if (st.cand && (!prev.cand || prev.cand.n !== st.cand.n || prev.cand.i !== st.cand.i)) {
      const c = candEls.find((x) => x.n === st.cand!.n && x.i === st.cand!.i);
      if (c) {
        const p = POSITIONS[st.cand.n - 1];
        const x0 = Math.min(p.x, c.x) - 70;
        const y0 = Math.min(p.y, c.y) - 70;
        flyTo(viewFor({ x: x0, y: y0, w: Math.max(p.x, c.x) + 70 - x0, h: Math.max(p.y, c.y) + 70 - y0 }));
      }
    }
  }
  store.subscribe(render);

  /* ---------------------------------------------------------------- 拖曳與縮放 */
  const pointers = new Map<number, { x: number; y: number }>();
  let pinch = 0;
  const unitsPerPx = () => {
    const r = root.getBoundingClientRect();
    return Math.max(cam.w / r.width, (cam.w * aspect) / r.height);
  };
  root.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  });
  root.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (pointers.size === 1) {
      if (!dragged && Math.hypot(dx, dy) < 4) return;
      if (!dragged) { dragged = true; root.setPointerCapture(e.pointerId); root.classList.add('grabbing'); store.set({ follow: false }); }
      const u = unitsPerPx();
      p.x = e.clientX;
      p.y = e.clientY;
      setNow({ x: cam.x - dx * u, y: cam.y - dy * u, w: cam.w });
    } else if (pointers.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch) zoomBy(pinch / d, (a.x + b.x) / 2, (a.y + b.y) / 2, true);
      pinch = d;
      dragged = true;
    }
  });
  const endPointer = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    pinch = 0;
    root.classList.remove('grabbing');
    setTimeout(() => { dragged = false; }, 0);
  };
  root.addEventListener('pointerup', endPointer);
  root.addEventListener('pointercancel', endPointer);
  root.addEventListener('click', () => { if (!dragged) store.selectStation(null); });

  /** 縮放：以游標（或中心）為不動點。按鈕與滾輪是滑過去；雙指是即時的 */
  function zoomBy(factor: number, cx?: number, cy?: number, direct = false) {
    const r = root.getBoundingClientRect();
    const fx = cx === undefined ? 0.5 : (cx - r.left) / r.width;
    const fy = cy === undefined ? 0.5 : (cy - r.top) / r.height;
    const base = direct ? cam : camT;
    const w1 = clamp(base.w * factor, MIN_W, MAX_W);
    const next = { x: base.x + (base.w - w1) * fx, y: base.y + (base.w - w1) * aspect * fy, w: w1 };
    store.set({ follow: false });
    if (direct) setNow(next); else flyTo(next);
  }
  root.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return; // 沒按 Ctrl 時讓頁面照常捲動
    e.preventDefault();
    zoomBy(e.deltaY > 0 ? 1.22 : 1 / 1.22, e.clientX, e.clientY);
  }, { passive: false });

  /* ---------------------------------------------------------------- 控制鈕與圖例 */
  const btn = (icon: string, label: string, onclick: () => void, pressed?: () => boolean) => {
    const b = h('button', { class: 'mapbtn', type: 'button', title: label, 'aria-label': label, onclick }, svg(ICONS[icon]));
    if (pressed) store.subscribe(() => b.setAttribute('aria-pressed', String(pressed())));
    return b;
  };
  const playBtn = h('button', { class: 'mapbtn', type: 'button', title: '開始／暫停', 'aria-label': '開始或暫停', onclick: () => {
    const cur = store.get();
    if (cur.playing) store.set({ playing: false });
    else store.set({ playing: true, follow: true, at: cur.at >= 42 ? 1 : cur.at, sel: cur.at >= 42 ? 1 : cur.at });
  } }, svg(ICONS.play));
  store.subscribe((st, prev) => { if (st.playing !== prev.playing) fill(playBtn, svg(st.playing ? ICONS.pause : ICONS.play)); });
  const controls = h('div', { class: 'map-controls' },
    playBtn,
    btn('zoomin', '放大', () => zoomBy(1 / 1.45)),
    btn('zoomout', '縮小', () => zoomBy(1.45)),
    btn('fit', '看全圖', () => { store.set({ follow: false }); fitAll(); }),
    btn('target', '看這一段', () => { store.set({ follow: false }); fitSegment(store.get().sel ?? store.get().at); }),
    btn('candidates', '顯示其他候選地點', () => store.setLayer('candidates', !store.get().layers.candidates), () => store.get().layers.candidates),
    btn('list', '顯示全部站名', () => store.setLayer('labels', !store.get().layers.labels), () => store.get().layers.labels),
  );
  const legend = h('div', { class: 'map-legend' },
    h('span', null, h('i', { class: 'lg-dot lv-high' }), '位置可信度高'),
    h('span', null, h('i', { class: 'lg-dot lv-mid' }), '中'),
    h('span', null, h('i', { class: 'lg-dot lv-low' }), '低'),
    h('span', null, h('i', { class: 'lg-dot lv-none' }), '不詳（依前後站畫在路線上）'),
    h('span', null, h('i', { class: 'lg-diamond' }), '其他候選地點'),
    h('span', null, h('i', { class: 'lg-zone' }), '淡圈：可能在這一帶'));
  const hint = h('p', { class: 'map-hint' }, '拖曳平移；按鈕或 Ctrl＋滾輪縮放；手機用兩指。點站看資料。底圖是現代地形，站的位置是現代候選地點，都是示意。');

  const el = h('div', { class: 'jmap-wrap' }, root, controls);
  const wrapAll = h('div', { class: 'jmap-block' }, el, legend, hint);

  /* ---------------------------------------------------------------- 初始畫面：等容器量得到大小之後，貼近整條路線 */
  let measured = false;
  const measure = () => {
    const r = el.getBoundingClientRect();
    if (r.width < 10 || r.height < 10) return;
    const next = r.height / r.width;
    if (!measured) {
      measured = true;
      aspect = next;
      cam = clampView(viewFor(boundsOf(ALL, 60)));
      camT = { ...cam };
    } else if (Math.abs(next - aspect) > 0.001) {
      // 容器大小改變：保持中心與寬度，只換高度
      const cx = cam.x + cam.w / 2;
      const cy = cam.y + (cam.w * aspect) / 2;
      const tcx = camT.x + camT.w / 2;
      const tcy = camT.y + (camT.w * aspect) / 2;
      aspect = next;
      cam = clampView({ x: cx - cam.w / 2, y: cy - (cam.w * aspect) / 2, w: cam.w });
      camT = clampView({ x: tcx - camT.w / 2, y: tcy - (camT.w * aspect) / 2, w: camT.w });
    }
    lastK = -1;
    applyView();
  };
  new ResizeObserver(measure).observe(el);
  applyView();
  render(store.get());
  const d0 = trailD(progress);
  trail.setAttribute('d', d0);
  trailGlow.setAttribute('d', d0);

  return { el: wrapAll, focus, fitAll, fitSegment };
}
