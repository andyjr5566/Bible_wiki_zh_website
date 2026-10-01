import { OFFERING_BY_ID, findVariant } from '../data/offerings';
import type { Axis, OfferingId, Step, Variant } from '../data/types';
import type { Rehearsal } from '../three/rehearsal';
import { animOff, fill, h, svg } from './dom';
import { quietBadge, refChips } from './evidence';
import { ICONS } from './icons';
import { ACTOR, OFFERING_STYLE, PLACE_LABEL } from './meta';
import { Player } from './player';
import { mountSimulator } from './simulator';

/** 演練的內容：五種祭之一，或承接聖職、第八天 */
export interface TheaterSource {
  name: string;
  color: string;
  axes: Axis[];
  variants: Variant[];
  find(pick: Record<string, string>): Variant;
  /** 不支援 3D 時的替代：五種祭用原本的平面圖模擬器 */
  offering?: OfferingId;
}

export function offeringSource(id: OfferingId): TheaterSource {
  const o = OFFERING_BY_ID[id];
  return { name: o.name, color: OFFERING_STYLE[id].color, axes: o.axes, variants: o.variants, find: (p) => findVariant(o, p), offering: id };
}

/** 幾個分支並列（例如承接聖職的三隻祭牲）：一個選項軸，選哪個就演哪個 */
export function listSource(name: string, color: string, label: string, variants: Variant[]): TheaterSource {
  const axis: Axis = { id: 'v', label, options: variants.map((v) => ({ id: v.id, label: v.label })) };
  const vs = variants.map((v) => ({ ...v, axis: { v: v.id } }));
  return { name, color, axes: variants.length > 1 ? [axis] : [], variants: vs, find: (p) => vs.find((v) => v.id === p.v) ?? vs[0] };
}

/**
 * 大 3D 演練：選一種祭物，一步一步在院子裡演出來。
 * 桌機：左邊 3D、右邊字幕欄，字幕不壓在畫面上；手機：字幕在 3D 下面。
 * 不支援 WebGL 的裝置改用平面圖播放器。
 */
export function mountTheater(src: TheaterSource): { el: HTMLElement; choose(pick: Record<string, string>): void } {
  const o = src;
  const color = src.color;
  let pick: Record<string, string> = { ...o.variants[0].axis };
  let variant: Variant = o.variants[0];

  const canvasHost = h('div', { class: 'th-canvas' });
  const labels = h('div', { class: 'labels3d' });
  const loading = h('div', { class: 'th-loading' }, '3D 院子載入中…');
  const stageEl = h('div', { class: 'th-stage' }, canvasHost, labels, loading);
  const axes = h('div', { class: 'th-axes' });
  const cap = h('div', { class: 'th-cap', 'aria-live': 'polite' });
  const icon = (n: string) => svg(ICONS[n]);
  const btnPrev = h('button', { class: 'btn', type: 'button', 'aria-label': '上一步', onclick: () => stepBy(-1) }, icon('prev'));
  const btnPlay = h('button', { class: 'btn primary', type: 'button', onclick: () => toggle() });
  const btnNext = h('button', { class: 'btn', type: 'button', 'aria-label': '下一步', onclick: () => stepBy(1) }, icon('next'));
  const btnReset = h('button', { class: 'btn', type: 'button', 'aria-label': '從頭開始', onclick: () => { stop(); go(-1); } }, icon('reset'));
  const dots = h('div', { class: 'th-dots', role: 'group', 'aria-label': '跳到第幾步' });
  const bar = h('div', { class: 'th-bar' }, btnPrev, btnPlay, btnNext, btnReset);
  const panel = h('div', { class: 'th-panel' }, axes, cap, bar, dots);
  const el = h('section', { class: 'theater', style: `--c:${color}`, 'aria-label': `${o.name}的 3D 演練` }, stageEl, panel);

  let stage: Rehearsal | null = null;
  let i = -1;
  let playing = false;
  let token = 0;
  const steps = (): Step[] => variant.steps;

  function renderAxes() {
    axes.replaceChildren(...o.axes.filter((a) => a.id in variant.axis).map((a) => h('div', { class: 'th-axis', role: 'group', 'aria-label': a.label },
      h('span', null, a.label),
      ...a.options.map((op) => h('button', {
        class: 'opt', type: 'button', 'aria-pressed': String(pick[a.id] === op.id),
        onclick: () => choose({ ...pick, [a.id]: op.id }),
      }, op.label)))));
  }

  function renderPlay() {
    btnPlay.replaceChildren(icon(playing ? 'pause' : 'play'), playing ? '暫停' : i < 0 ? '開始演練' : i >= steps().length - 1 ? '重播' : '繼續');
    btnPrev.disabled = i < 0;
    btnNext.disabled = i >= steps().length - 1;
  }

  function renderCaption() {
    const all = steps();
    dots.replaceChildren(...all.map((st, k) => h('button', {
      type: 'button', class: `th-dot${k <= i ? ' done' : ''}${st.later ? ' later' : ''}${st.status === 'not_stated' ? ' unsaid' : ''}`,
      title: `${k + 1}. ${st.text}`, 'aria-label': `第 ${k + 1} 步：${st.text}`, 'aria-current': k === i ? 'step' : null,
      onclick: () => { stop(); go(k); },
    }, String(k + 1))));
    const st = all[i];
    if (!st) {
      fill(cap,
        h('div', { class: 'th-who' }, `${o.name}・${variant.label}`, h('span', { class: 'th-n' }, `共 ${all.length} 步`)),
        h('div', { class: 'th-text' }, '按「開始演練」，看獻祭的人和祭司在院子裡各做什麼。隨時可以暫停，或點下面的數字跳到任何一步。'),
        variant.note ? h('div', { class: 'th-note' }, variant.note) : null,
        h('div', { class: 'th-refs' }, '經文範圍 ', ...refChips(variant.refs)));
      return;
    }
    const a = ACTOR[st.actor];
    fill(cap,
      h('div', { class: 'th-who' },
        h('span', { class: 'dot', style: `background:${a.color}` }, a.glyph), a.label,
        h('span', { class: 'th-place' }, `・${PLACE_LABEL[st.at]}`),
        h('span', { class: 'th-n' }, `${i + 1} / ${all.length}`)),
      h('div', { class: 'th-text' }, st.text),
      h('div', { class: 'th-refs' },
        st.q ? h('span', { class: 'q' }, st.q) : null, ' ', ...refChips(st.refs, st.q), ' ', quietBadge(st.status),
        st.later ? h('span', { class: 'th-later' }, '事後／隔天') : null),
      st.note ? h('div', { class: 'th-note' }, st.note) : null);
  }

  async function go(n: number, animate = true) {
    const my = playing ? token : ++token;
    i = n;
    renderCaption();
    renderPlay();
    if (!stage) return;
    await stage.stop();
    if (my !== token) return;
    const all = steps();
    stage.reset(all);
    for (let j = 0; j < n; j++) await stage.step(all[j], false, false);
    if (my !== token) return;
    if (n < 0) { stage.overview(animate); return; }
    await stage.step(all[n], animate && !animOff(), true);
  }

  function stepBy(d: number) {
    stop();
    go(Math.max(-1, Math.min(steps().length - 1, i + d)));
  }

  function stop() {
    playing = false;
    token++;
    renderPlay();
  }

  async function toggle() {
    if (playing) return stop();
    playing = true;
    const my = ++token;
    if (i >= steps().length - 1) i = -1;
    renderPlay();
    while (playing && my === token && i < steps().length - 1) {
      await go(i + 1);
      if (my !== token) return;
      // 演完直接接下一步，不另外停頓（字幕在這一步開始時就換好了）
    }
    if (my === token) stop();
  }

  function choose(p: Record<string, string>) {
    stop();
    pick = { ...pick, ...p };
    variant = src.find(pick);
    renderAxes();
    go(-1, false);
  }

  renderAxes();
  renderCaption();
  renderPlay();

  // 3D：等瀏覽器空閒再載入；不行就換成平面圖播放器
  const canWebGL = (() => {
    try {
      const c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch {
      return false;
    }
  })();
  const fallback = (why: string) => {
    const host = h('div', { class: 'wrap' });
    if (src.offering) mountSimulator(host, { only: src.offering });
    else {
      const pl = new Player({ compactList: true });
      pl.load(variant, color);
      host.append(pl.el);
    }
    el.classList.add('flat');
    el.replaceChildren(h('div', { class: 'wrap' }, h('p', { class: 'th-fallback' }, why)), host);
  };
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void) => void }).requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  if (!canWebGL) fallback('這台裝置不支援 3D，改用平面圖一步一步看。');
  else idle(async () => {
    try {
      const { createRehearsal } = await import('../three/rehearsal');
      const lowPower = (navigator.hardwareConcurrency ?? 8) <= 4 || matchMedia('(max-width: 560px)').matches;
      stage = await createRehearsal(canvasHost, labels, { reducedMotion: animOff(), lowPower });
      stage.setColor(color);
      loading.remove();
      go(i, false);
    } catch (err) {
      console.error(err);
      fallback('3D 載入失敗，改用平面圖一步一步看。');
    }
  });

  el.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input,textarea')) return;
    if (e.key === 'ArrowRight') { stepBy(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { stepBy(-1); e.preventDefault(); }
  });

  return { el, choose };
}
