import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { playSignal, unlockAudio } from '../audio/trumpet';
import { MARCH_NUM10 } from '../data/march';
import { fmt } from '../data/tribes';
import * as store from '../store';
import type { RiseKey, ThreeCtl } from '../three/mount';
import { createCampMap } from '../ui/campmap';
import { h, motionOff, svg } from '../ui/dom';
import { ICONS } from '../ui/icons';
import { smoothScrollTo } from '../ui/motion';
import { buildBeats } from './beats';
import './story.css';
import type { V3 } from './beats';

gsap.registerPlugin(ScrollTrigger);

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const lerp3 = (a: V3, b: V3, t: number): [number, number, number] => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const RISE_KEYS: RiseKey[] = ['court', 'levi', 'judah', 'reuben', 'ephraim', 'dan'];

export interface Story {
  el: HTMLElement;
  /** 從自由探索回來時，把鏡頭、天色、帳棚、名牌放回目前這一幕 */
  refresh(): void;
}

/**
 * 開場的捲動故事：畫面固定（position: sticky）一個立體營地，卡片從上面捲過去。
 * 卡片的正中央對到畫面中央時就是那一幕；兩幕之間的鏡頭、天色、帳棚立起來的程度連續內插，
 * 卡片停在中間附近時畫面也停住，讀得清楚。
 */
export function createStory(opts: { poster: string; onExplore: () => void; load: (host: HTMLElement, onProgress: (n: number, total: number) => void) => Promise<ThreeCtl> }): Story {
  const skip = h('a', { class: 'sskip', href: '#map' }, '跳過故事，直接看營地地圖');
  const beats = buildBeats(skip);

  /* ---- 固定的舞台 ---- */
  const canvasHost = h('div', { class: 'three-wrap story-canvas' });
  const poster = h('img', { class: 'story-poster', src: opts.poster, alt: '', decoding: 'async', fetchpriority: 'high' });
  const loading = h('div', { class: 'story-loading', role: 'status' }, h('span', { class: 'story-loading-bar' }), h('span', { class: 'sr-only' }, '載入立體營地'));
  const soundBtn = h('button', { class: 'sbtn', type: 'button', 'aria-pressed': 'false', title: '銀號聲音（預設靜音）', 'aria-label': '開關銀號聲音' }, svg(ICONS.mute));
  const exploreBtn = h('button', { class: 'sbtn sbtn-text', type: 'button', disabled: true, onclick: () => opts.onExplore() }, svg(ICONS.cube), h('span', null, '自己逛逛'));
  const tools = h('div', { class: 'story-tools' }, soundBtn, exploreBtn);
  const rail = h('ol', { class: 'story-rail', 'aria-label': '故事的段落' });
  const fallback = h('div', { class: 'story-fallback', hidden: true });
  const stageEl = h('div', { class: 'story-stage' }, poster, canvasHost, fallback, h('div', { class: 'story-scrim', 'aria-hidden': 'true' }), loading, tools, rail);

  /* ---- 捲過去的卡片 ---- */
  const stepEls = beats.map((b, i) => h('div', {
    class: `story-step${b.kind ? ` is-${b.kind}` : ''}`, 'data-i': i, style: `--len:${b.len ?? 100}`,
  }, h('article', { class: 'scard', 'aria-label': b.nav ?? b.id }, b.card())));
  // 最後一幕：接著可以做什麼
  const endIdx = beats.findIndex((b) => b.id === 'end');
  stepEls[endIdx].querySelector('.scard')!.append(h('div', { class: 'send-actions' },
    h('button', { class: 'btn primary', type: 'button', onclick: () => opts.onExplore() }, svg(ICONS.cube), '自己逛逛立體營地'),
    h('a', { class: 'btn', href: '#map' }, svg(ICONS.map), '看營地地圖'),
    h('a', { class: 'btn', href: '#march-10' }, svg(ICONS.play), '一步一步看拔營')),
  h('p', { class: 'send-note' }, '畫面說明：地形、帳棚樣式、營與會幕的距離、行進方向、營外的高處都是示意，經文沒有記載。一頂帳棚約一千名被數點的男丁。哥轄人抬的聖物照民4 上色，車與牛的數目照民7:7-9。'));
  const steps = h('div', { class: 'story-steps' }, ...stepEls);
  const el = h('section', { class: 'story', id: 'top', 'aria-label': '環繞會幕：捲動故事' }, stageEl, steps);

  // 進度軌：每一個有短名的幕一個點，點了捲過去
  const railItems = beats.map((b, i) => (b.nav ? h('li', null, h('button', { type: 'button', 'data-i': i, onclick: () => goTo(i) }, h('span', { class: 'rail-dot' }), h('span', { class: 'rail-t' }, b.nav))) : null));
  rail.append(...railItems.filter((x): x is HTMLLIElement => !!x));

  soundBtn.addEventListener('click', () => {
    const on = !store.get().sound;
    if (on) unlockAudio();
    store.set({ sound: on });
  });
  store.subscribe((st) => {
    soundBtn.setAttribute('aria-pressed', String(st.sound));
    soundBtn.replaceChildren(svg(st.sound ? ICONS.sound : ICONS.mute));
  });

  /* ---- 捲動位置 → 幕 ---- */
  let centers: number[] = [];
  const measure = () => {
    centers = stepEls.map((s) => {
      const r = s.getBoundingClientRect();
      return r.top + scrollY + r.height / 2;
    });
  };
  const fAt = (y: number) => {
    const vc = y + innerHeight / 2;
    if (vc <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) {
      if (vc < centers[i + 1]) return i + (vc - centers[i]) / (centers[i + 1] - centers[i]);
    }
    return centers.length - 1;
  };
  function goTo(i: number) {
    measure();
    void smoothScrollTo(centers[i] - innerHeight / 2, 900);
  }

  let f = 0;
  let three: ThreeCtl | null = null;
  let lastPhase = -1;
  let lastActive = -1;
  let inside = false;

  /** 幕與幕之間：卡片在中央附近時畫面停住（0.2–0.8 之外才動） */
  const ease = (x: number) => smooth(0.18, 0.82, x);

  function apply() {
    const i = Math.min(beats.length - 1, Math.floor(f));
    const j = Math.min(beats.length - 1, i + 1);
    const t = ease(f - i);
    const a = beats[i];
    const b = beats[j];
    const active = Math.round(f);

    if (three) {
      const portrait = innerWidth / innerHeight < 0.8;
      const pa = portrait && a.m?.pos ? a.m.pos : a.pos;
      const pb = portrait && b.m?.pos ? b.m.pos : b.pos;
      const ta = portrait && a.m?.target ? a.m.target : a.target;
      const tb = portrait && b.m?.target ? b.m.target : b.target;
      three.pose(lerp3(pa, pb, t), lerp3(ta, tb, t));
      three.setTod(a.tod + (b.tod - a.tod) * t);
      for (const k of RISE_KEYS) {
        // 帳棚在進入那一幕之前的後半段立起來，卡片到中央時剛好站好
        const ra = a.rise[k];
        const rb = b.rise[k];
        three.setRise(k, ra + (rb - ra) * smooth(0.25, 0.95, f - i));
      }
      three.setLabels(beats[active].labels);
    }

    if (active !== lastActive) {
      lastActive = active;
      stepEls.forEach((s, k) => s.classList.toggle('is-active', k === active));
      let navOn = active;
      while (navOn > 0 && !beats[navOn].nav) navOn--;
      rail.querySelectorAll('button').forEach((btn) => {
        const k = Number(btn.dataset.i);
        btn.classList.toggle('on', k === navOn);
        btn.classList.toggle('past', k < navOn);
        if (k === navOn) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
      });
      countUp(stepEls[active]);
      stageEl.dataset.beat = beats[active].id;
    }

    // 行軍階段跟著目前的幕；往前捲到有號聲的那一批時吹一次。
    // 已經離開故事（往下讀地圖、拔營）就不再動行軍階段，免得蓋掉下面的播放器
    const phase = beats[active].phase;
    // 故事區的底邊高過畫面 35% 就算離開（跳到地圖時，底邊常常還藏在頂列後面）
    const storyOnScreen = el.getBoundingClientRect().bottom > innerHeight * 0.35;
    if (inside && storyOnScreen && phase !== lastPhase) {
      const forward = phase > lastPhase;
      lastPhase = phase;
      store.set({ mode: 'num10', phase, playing: false, sel: null });
      const s = MARCH_NUM10[phase - 2];
      if (forward && s?.signal) {
        playSignal(s.signal, store.get().sound);
        store.set({ pulse: { id: s.signal, t: Date.now() } });
      }
    }
  }

  /* ---- 數字從 0 數上去（只在第一次看到時；進場裝飾，跟著作業系統的減少動態） ---- */
  const counted = new WeakSet<Element>();
  function countUp(scope: HTMLElement) {
    scope.querySelectorAll<HTMLElement>('.count[data-n]').forEach((c) => {
      if (counted.has(c)) return;
      counted.add(c);
      const n = Number(c.dataset.n);
      if (motionOff()) { c.textContent = fmt(n); return; }
      const o = { v: 0 };
      gsap.to(o, { v: n, duration: 1.4, ease: 'power3.out', onUpdate: () => { c.textContent = fmt(Math.round(o.v)); } });
    });
  }

  /* ---- 進出故事 ---- */
  function enter() {
    if (inside) return;
    inside = true;
    three?.setStory(true);
    apply();
  }
  function leave() {
    if (!inside) return;
    inside = false;
    // 離開故事往下讀時，把營地放回住營，下面的地圖與拔營從頭開始
    lastPhase = -1;
    store.set({ phase: 0, playing: false });
  }

  requestAnimationFrame(() => {
    measure();
    ScrollTrigger.create({
      trigger: el,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: () => { f = fAt(scrollY); apply(); },
      onRefresh: () => { measure(); f = fAt(scrollY); apply(); },
    });
    // 最後一幕置中時，故事區的底邊剛好碰到畫面底邊；要等底邊捲到畫面上方 35% 才算離開
    ScrollTrigger.create({ trigger: el, start: 'top bottom', end: 'bottom 35%', onEnter: enter, onEnterBack: enter, onLeave: leave });
    // 頂列在故事上方時是透明的
    ScrollTrigger.create({ trigger: el, start: 'top top', end: 'bottom 64px', toggleClass: { targets: document.documentElement, className: 'on-story' } });
    f = fAt(scrollY);
    // 帶錨點直接開到下面（例如 #map）時故事不在畫面上，不要把行軍階段設成故事的進度
    if (el.getBoundingClientRect().bottom > innerHeight * 0.35) enter();
    apply();
  });
  addEventListener('resize', () => ScrollTrigger.refresh());

  /* ---- 立體營地：一進頁面就開始載入（開場就是它） ---- */
  const bar = loading.querySelector<HTMLElement>('.story-loading-bar')!;
  opts.load(canvasHost, (n, total) => { bar.style.transform = `scaleX(${n / total})`; })
    .then((ctl) => {
      three = ctl;
      ctl.setStory(true);
      // 第一格就放到目前的幕，不從預設鏡頭滑過來
      const b = beats[Math.round(f)];
      const portrait = innerWidth / innerHeight < 0.8;
      const bp = portrait && b.m?.pos ? b.m.pos : b.pos;
      const bt = portrait && b.m?.target ? b.m.target : b.target;
      ctl.pose(bp, bt);
      ctl.stage.camera.position.set(...bp);
      ctl.stage.controls.target.set(...bt);
      ctl.setTod(b.tod, true);
      apply();
      stageEl.classList.add('is-live');
      exploreBtn.disabled = false;
    })
    .catch((e) => {
      console.error(e);
      // 沒有 WebGL：改用平面的營地圖，故事照樣能讀
      stageEl.classList.add('is-fallback');
      fallback.hidden = false;
      fallback.append(createCampMap({ label: '十二支派環繞會幕安營示意圖（這台裝置無法顯示立體營地）' }).el);
    });

  return { el, refresh: () => { lastActive = -1; apply(); } };
}
