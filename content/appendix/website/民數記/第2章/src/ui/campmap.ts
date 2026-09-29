import { CLANS, clan } from '../data/levites';
import { CAMPS, MATRIARCH, SIDE_LABEL, TRIBES, camp, fmt, tribe, tribesOf } from '../data/tribes';
import type { SignalId } from '../data/trumpets';
import type { CampId, ClanId, TribeId } from '../data/types';
import { BANNER_POS, BW, CAMP_RECT, CLAN_RECT, COURT, CX, CY, H, TENT_COLS, TRIBE_RECT, W, tentsFor } from '../layout';
import { viewAt } from '../phases';
import * as store from '../store';
import type { State } from '../store';
import { s } from './dom';
import { BANNER_TRADITION, CAMP_STYLE, SIDE_NAME } from './meta';

/**
 * 營地示意圖（未按比例）。橫式：東在右、西在左、北在上。
 * 每一面三個支派的先後是示意（經文沒寫），依順時鐘排。
 */
export interface CampMapApi {
  el: SVGSVGElement;
  destroy(): void;
}

const CAMP_OF: Record<TribeId, CampId> = Object.fromEntries(TRIBES.map((t) => [t.id, t.camp])) as Record<TribeId, CampId>;

function tentPath(n: number, x0: number, y0: number): string {
  const cw = (BW - 16) / TENT_COLS;
  const rows = Math.ceil(n / TENT_COLS);
  let d = '';
  let k = 0;
  for (let r = 0; r < rows; r++) {
    const inRow = Math.min(TENT_COLS, n - r * TENT_COLS);
    // 最後一列置中對齊左邊，和其他列同一格線
    for (let c = 0; c < inRow; c++, k++) {
      const x = x0 + 8 + c * cw + (cw - 7) / 2;
      const y = y0 + r * 7.4;
      d += `M${x.toFixed(1)} ${(y + 6).toFixed(1)}l3.5 -6l3.5 6z`;
    }
  }
  return d;
}

function shapeMark(shape: 'circle' | 'tri' | 'square' | 'diamond', cx: number, cy: number, r: number): SVGElement {
  switch (shape) {
    case 'circle': return s('circle', { cx, cy, r });
    case 'square': return s('rect', { x: cx - r, y: cy - r, width: 2 * r, height: 2 * r, rx: 2 });
    case 'tri': return s('path', { d: `M${cx} ${cy - r}L${cx + r} ${cy + r * 0.85}L${cx - r} ${cy + r * 0.85}z` });
    case 'diamond': return s('path', { d: `M${cx} ${cy - r}L${cx + r} ${cy}L${cx} ${cy + r}L${cx - r} ${cy}z` });
  }
}

/**
 * 手機上地圖比畫面寬，外層可以左右捲。把地圖座標 x 捲到正中間。
 * 地圖沒有超出外層時什麼都不做。
 */
export function centerMapOn(scroller: HTMLElement, x: number, smooth = true) {
  const svgEl = scroller.querySelector('svg.campmap');
  if (!svgEl || scroller.scrollWidth <= scroller.clientWidth + 2) return;
  const pad = 8;
  const px = ((x + pad) / (W + pad * 2)) * svgEl.getBoundingClientRect().width;
  const left = Math.max(0, Math.min(px - scroller.clientWidth / 2, scroller.scrollWidth - scroller.clientWidth));
  scroller.scrollTo({ left, behavior: smooth && document.documentElement.dataset.motion !== 'off' ? 'smooth' : 'auto' });
}

export function createCampMap(opts: { label?: string; onPick?: (sel: store.Selection) => void } = {}): CampMapApi {
  const pad = 8;
  const root = s('svg', {
    class: 'campmap', viewBox: `${-pad} ${-pad} ${W + pad * 2} ${H + pad * 2}`, role: 'group',
    'aria-label': opts.label ?? '十二支派環繞會幕安營示意圖（未按比例）',
  });

  const gCompass = s('g', { class: 'compass', 'aria-hidden': 'true' });
  const gClans = s('g', { class: 'clans' });
  const gCourt = s('g', { class: 'court', tabindex: 0, role: 'button', 'aria-label': '會幕（帳幕與院子）' });
  const gCamps = s('g', { class: 'camps' });
  const gBanners = s('g', { class: 'banners' });
  const gCloud = s('g', { class: 'cloud', 'aria-hidden': 'true' });
  const gFx = s('g', { class: 'fx', 'aria-hidden': 'true' });
  root.append(gCompass, gClans, gCourt, gCamps, gBanners, gCloud, gFx);

  /* ---- 羅盤 ---- */
  {
    const x = 214, y = 404;
    gCompass.append(
      s('circle', { cx: x, cy: y, r: 22, class: 'cp-ring' }),
      s('path', { d: `M${x} ${y - 16}L${x + 4} ${y}L${x} ${y + 16}L${x - 4} ${y}z`, class: 'cp-needle' }),
      s('text', { x, y: y - 26, class: 'cp-n' }, '北'),
      s('text', { x: x + 34, y: y + 5, class: 'cp-l' }, '東'),
      s('text', { x, y: y + 42, class: 'cp-l' }, '南'),
      s('text', { x: x - 34, y: y + 5, class: 'cp-l' }, '西'),
    );
  }

  /* ---- 會幕 ---- */
  gCourt.append(
    s('rect', { x: COURT.x, y: COURT.y, width: COURT.w, height: COURT.h, rx: 3, class: 'court-wall' }),
    // 門在東邊：牆上留一段缺口
    s('rect', { x: COURT.x + COURT.w - 2, y: CY - 12, width: 4, height: 24, class: 'court-gate' }),
    s('rect', { x: COURT.x + 10, y: CY - 9, width: 46, height: 18, rx: 1.5, class: 'court-tab' }),
    s('rect', { x: COURT.x + 62, y: CY - 5, width: 10, height: 10, class: 'court-laver' }),
    s('rect', { x: COURT.x + 88, y: CY - 8, width: 16, height: 16, class: 'court-altar' }),
    // 標籤放在院子裡面上緣：院子外面緊貼著米拉利的方塊
    s('text', { x: COURT.x + COURT.w / 2, y: COURT.y + 16, class: 'court-label' }, '會幕'),
  );
  const activate = (el: SVGElement, sel: store.Selection, label: string) => {
    el.setAttribute('tabindex', '0');
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', label);
    const pick = () => { store.set({ sel }); opts.onPick?.(sel); };
    el.addEventListener('click', (e) => { e.stopPropagation(); pick(); });
    el.addEventListener('keydown', (e) => {
      const ev = e as KeyboardEvent;
      if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); pick(); }
    });
  };
  activate(gCourt, { kind: 'tabernacle' }, '會幕，在營的正中間');

  /* ---- 利未人 ---- */
  const clanEls = {} as Record<ClanId, SVGGElement>;
  for (const c of CLANS) {
    const r = CLAN_RECT[c.id];
    const g = s('g', { class: 'clan', 'data-clan': c.id });
    g.append(s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 6, class: 'clan-box' }));
    const title = c.id === 'priests' ? '祭司' : c.name;
    g.append(s('text', { x: r.x + r.w / 2, y: r.y + (c.id === 'priests' ? 24 : r.h / 2 - 2), class: 'clan-name' }, title));
    g.append(s('text', { x: r.x + r.w / 2, y: r.y + (c.id === 'priests' ? 42 : r.h / 2 + 15), class: 'clan-sub' },
      c.count ? fmt(c.count.n) : '摩西・亞倫'));
    activate(g, { kind: 'clan', id: c.id }, `${c.name}，安營在帳幕的${SIDE_LABEL[c.side]}邊`);
    gClans.append(g);
    clanEls[c.id] = g;
  }

  /* ---- 支派 ---- */
  const tribeEls = {} as Record<TribeId, SVGGElement>;
  const countEls = {} as Record<TribeId, SVGTextElement>;
  const deltaEls = {} as Record<TribeId, SVGTextElement>;
  const motherEls = {} as Record<TribeId, SVGGElement>;
  const campEls = {} as Record<CampId, SVGGElement>;
  for (const c of CAMPS) {
    const cg = s('g', { class: 'camp', 'data-camp': c.id });
    const st = CAMP_STYLE[c.id];
    campEls[c.id] = cg;
    // 整營外框，選到營裡任何支派時亮起
    const cr = CAMP_RECT[c.id];
    cg.append(s('rect', { x: cr.x - 4, y: cr.y - 4, width: cr.w + 8, height: cr.h + 8, rx: 10, class: 'camp-frame' }));
    for (const t of tribesOf(c.id)) {
      const r = TRIBE_RECT[t.id];
      const g = s('g', { class: 'blk', 'data-tribe': t.id, 'data-camp': c.id });
      g.append(
        s('rect', { x: r.x, y: r.y, width: r.w, height: r.h, rx: 8, class: 'blk-box' }),
        s('rect', { x: r.x, y: r.y, width: r.w, height: 6, rx: 3, class: 'blk-bar' }),
      );
      const mark = shapeMark(st.shape, r.x + r.w - 16, r.y + 22, 8);
      mark.setAttribute('class', 'blk-mark');
      g.append(mark);
      g.append(s('text', { x: r.x + 10, y: r.y + 32, class: 'blk-name' }, t.name));
      g.append(s('text', { x: r.x + r.w - 26, y: r.y + 26, class: 'blk-rank' }, String(t.rank)));
      const cnt = s('text', { x: r.x + 10, y: r.y + 52, class: 'blk-count' }, fmt(t.c2.n));
      const delta = s('text', { x: r.x + 86, y: r.y + 52, class: 'blk-delta' }, '');
      countEls[t.id] = cnt;
      deltaEls[t.id] = delta;
      g.append(cnt, delta);
      g.append(s('path', { d: tentPath(tentsFor(t.c2.n), r.x, r.y + 60), class: 'blk-tents' }));
      // 母系圖層
      const m = MATRIARCH[t.mother];
      const mg = s('g', { class: 'blk-mother' });
      mg.append(
        s('rect', { x: r.x, y: r.y + 6, width: 6, height: r.h - 6, class: 'mother-bar', style: `fill:${m.color}` }),
        s('text', { x: r.x + r.w - 10, y: r.y + 84, class: 'mother-name', style: `fill:${m.color}` }, m.name),
      );
      g.append(mg);
      motherEls[t.id] = mg;
      g.append(s('text', { x: r.x + r.w / 2, y: r.y + r.h - 22, class: 'blk-gone' }, '已出發'));
      activate(g, { kind: 'tribe', id: t.id }, `${t.name}支派，${SIDE_NAME[c.side]}${tribe(c.head).name}營，第 ${t.rank} 個，${fmt(t.c2.n)} 名`);
      tribeEls[t.id] = g;
      cg.append(g);
    }
    gCamps.append(cg);
  }

  /* ---- 纛 ---- */
  const bannerEls = {} as Record<CampId, SVGGElement>;
  for (const c of CAMPS) {
    const p = BANNER_POS[c.id];
    const st = CAMP_STYLE[c.id];
    const g = s('g', { class: 'banner', 'data-camp': c.id });
    g.append(
      s('line', { x1: p.x, y1: p.y, x2: p.x, y2: p.y + 50, class: 'pole' }),
      s('path', { d: `M${p.x} ${p.y}h30l-7 10 7 10h-30z`, class: 'flag' }),
      s('text', { x: p.x + 13, y: p.y + 15, class: 'flag-glyph' }, st.glyph),
    );
    activate(g, { kind: 'camp', id: c.id }, `${camp(c.id).bannerName}，${SIDE_NAME[c.side]}`);
    gBanners.append(g);
    bannerEls[c.id] = g;
  }

  /* ---- 雲彩：住營時遮蓋帳幕，起行時收上去 ---- */
  gCloud.append(
    s('ellipse', { cx: CX, cy: CY + 1, rx: 76, ry: 30, class: 'cloud-body' }),
    s('ellipse', { cx: CX - 28, cy: CY - 6, rx: 30, ry: 18, class: 'cloud-puff' }),
    s('ellipse', { cx: CX + 26, cy: CY - 8, rx: 34, ry: 20, class: 'cloud-puff' }),
  );

  /* ---- 選取與操作 ---- */
  root.addEventListener('click', () => store.set({ sel: null }));

  /* ---- 依狀態更新 ---- */
  const campOfSel = (sel: store.Selection): CampId | null => {
    if (!sel) return null;
    if (sel.kind === 'tribe') return CAMP_OF[sel.id];
    if (sel.kind === 'camp') return sel.id;
    return null;
  };

  let lastPulse = 0;
  function render(st: Readonly<State>) {
    const sel = st.sel;
    const selCamp = campOfSel(sel);
    const view = viewAt(st.mode, st.phase);
    root.classList.toggle('night', st.night);
    root.classList.toggle('has-sel', !!sel);
    root.classList.toggle('lay-levites', st.layers.levites);
    root.classList.toggle('lay-mother', st.layers.mother);
    root.classList.toggle('lay-banner', st.layers.banner);
    root.classList.toggle('lay-c26', st.layers.c26);
    root.classList.toggle('cloud-up', view.cloudLifted);

    for (const t of TRIBES) {
      const g = tribeEls[t.id];
      const c = t.camp;
      const gone = view.goneCamps.has(c);
      const going = view.goingCamps.has(c);
      const isSel = sel?.kind === 'tribe' && sel.id === t.id;
      g.classList.toggle('sel', isSel);
      g.classList.toggle('lit', !!selCamp && selCamp === c);
      g.classList.toggle('dim', (!!sel && (selCamp ? selCamp !== c : true)) && !going);
      g.classList.toggle('gone', gone);
      g.classList.toggle('going', going);
      g.setAttribute('aria-pressed', String(isSel));
      const cnt = st.layers.c26 ? t.c26.n : t.c2.n;
      countEls[t.id].textContent = fmt(cnt);
      const d = t.c26.n - t.c2.n;
      deltaEls[t.id].textContent = st.layers.c26 ? `${d >= 0 ? '▲' : '▼'}${fmt(Math.abs(d))}` : '';
      deltaEls[t.id].setAttribute('class', `blk-delta ${d >= 0 ? 'up' : 'down'}`);
      motherEls[t.id].setAttribute('style', st.layers.mother ? '' : 'display:none');
    }
    for (const c of CAMPS) {
      campEls[c.id].classList.toggle('lit', selCamp === c.id);
      campEls[c.id].classList.toggle('going', view.goingCamps.has(c.id));
      bannerEls[c.id].classList.toggle('gone', view.goneCamps.has(c.id));
      const glyph = bannerEls[c.id].querySelector('.flag-glyph');
      if (glyph) glyph.textContent = st.layers.banner ? BANNER_TRADITION[c.id].glyph : CAMP_STYLE[c.id].glyph;
    }
    for (const c of CLANS) {
      const g = clanEls[c.id];
      const isSel = sel?.kind === 'clan' && sel.id === c.id;
      g.classList.toggle('sel', isSel);
      g.classList.toggle('gone', view.goneClans.has(c.id));
      g.classList.toggle('going', view.goingClans.has(c.id));
      g.classList.toggle('dim', !!sel && !isSel && sel.kind !== 'tabernacle' && !view.goingClans.has(c.id));
      g.setAttribute('aria-pressed', String(isSel));
    }
    gClans.classList.toggle('hidden', !st.layers.levites && st.phase === 0 && sel?.kind !== 'clan');
    gCourt.classList.toggle('sel', sel?.kind === 'tabernacle');
    gCourt.classList.toggle('gone', view.tabernacleGone);
    gCourt.classList.toggle('going', view.goingTabernacle);
    gCourt.classList.toggle('dim', !!sel && sel.kind !== 'tabernacle');

    if (st.pulse && st.pulse.t !== lastPulse) {
      lastPulse = st.pulse.t;
      fx(st.pulse.id);
    }
  }

  /* 號聲效果：短暫畫在地圖上 */
  function fx(id: SignalId) {
    gFx.replaceChildren();
    const add = (el: SVGElement, ms = 2200) => {
      gFx.append(el);
      setTimeout(() => el.remove(), ms);
    };
    const tabC: [number, number] = [CX, CY];
    if (id === 'both') {
      for (const c of CAMPS) {
        const r = CAMP_RECT[c.id];
        const x = r.x + r.w / 2;
        const y = r.y + r.h / 2;
        add(s('path', { d: `M${x} ${y}L${tabC[0]} ${tabC[1]}`, class: 'fx-arrow', style: `stroke:${CAMP_STYLE[c.id].color}` }));
      }
    } else if (id === 'one') {
      for (const c of CAMPS) {
        const r = TRIBE_RECT[camp(c.id).head];
        add(s('circle', { cx: r.x + 18, cy: r.y + 18, r: 11, class: 'fx-dot', style: `stroke:${CAMP_STYLE[c.id].color}` }));
      }
    } else {
      const target: CampId = id === 'alarm1' ? 'judah' : 'reuben';
      const r = CAMP_RECT[target];
      for (let i = 0; i < 3; i++) {
        add(s('rect', { x: r.x - 4, y: r.y - 4, width: r.w + 8, height: r.h + 8, rx: 10, class: 'fx-wave', style: `animation-delay:${i * 0.35}s;stroke:${CAMP_STYLE[target].color}` }));
      }
      const from = id === 'alarm1' ? [COURT.x + COURT.w, CY] : [CX, COURT.y + COURT.h];
      const to = [r.x + r.w / 2, r.y + r.h / 2];
      add(s('path', { d: `M${from[0]} ${from[1]}L${to[0]} ${to[1]}`, class: 'fx-arrow', style: `stroke:${CAMP_STYLE[target].color}` }));
    }
  }

  const un = store.subscribe(render);
  render(store.get());

  return { el: root, destroy: un };
}

/** 給 3D 與其他區塊用：某個選取的白話名稱 */
export function selLabel(sel: store.Selection): string {
  if (!sel) return '';
  switch (sel.kind) {
    case 'tribe': return `${tribe(sel.id).name}支派`;
    case 'camp': return camp(sel.id).bannerName;
    case 'clan': return clan(sel.id).name;
    case 'tabernacle': return '會幕';
  }
}
