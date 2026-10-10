import './styles/tokens.css';
import './styles/base.css';
import './styles/story.css';
import './styles/chrome.css';
import './styles/end.css';

import { SITE } from './data/site';
import { createAudio, type AudioController } from './audio/audio';
import { bindPreferences, initScroll, type BeatInfo } from './story/scroll';
import type { SceneEvent } from './scene/api';
import { story } from './story/state';
import { anyPanelOpen, buildBeats, closeOpenPanel, setPanelOn } from './ui/beats';
import { createBakeUI } from './ui/bake';
import { createBarsUI } from './ui/bars';
import { createBlowUI } from './ui/blow';
import { createChrome } from './ui/chrome';
import { createCountUI } from './ui/count';
import { createCoach } from './ui/coach';
import { createEchoUI } from './ui/echo';
import { h } from './ui/dom';
import { buildCredits, buildEndings, buildOthers } from './ui/ending';
import { createHeadFade } from './ui/headfade';
import { createHyssopUI } from './ui/hyssop';
import { initMotion } from './ui/motion';
import { createNav } from './ui/nav';
import { createWaveUI } from './ui/wave';
import { createStage, type Stage } from './ui/stage';

function boot() {
  const root = document.documentElement;
  const app = document.getElementById('jf-app')!;
  const canvas = document.getElementById('jf-canvas') as HTMLCanvasElement;
  const fallback = document.getElementById('jf-fallback')!;
  const loading = document.getElementById('jf-loading');

  bindPreferences();
  initMotion();
  // 回聲拍說明框的舊紙配色（亮色模式；見 story.css 的 .jf-box[data-later]）
  for (const k of ['paper', 'ink', 'accent', 'glow'] as const) root.style.setProperty(`--jf-later-${k}`, SITE.laterPalette[k]);

  // ---- 版面：每一拍一個 section ----
  const hyssop = createHyssopUI(canvas, app);
  const bake = createBakeUI();
  const count = createCountUI();
  // 吹角的聲音由 audio 合成；audio 在下面才建立，所以先用 ref 接
  let audioRef: AudioController | null = null;
  const blow = createBlowUI((holding, level) => audioRef?.blow(holding, level));
  const bars = createBarsUI();
  const echo = createEchoUI(app);
  // 沒有場景時搖禾捆的事件由介面層自己送給音效（audio 在下面才建立）
  let emitUi: (e: SceneEvent) => void = () => undefined;
  const wave = createWaveUI(canvas, app, (e) => emitUi(e));
  const main = h('main', { class: 'jf-story', id: 'jf-story' });
  const beats = buildBeats(main, { hyssop, bake, wave, count, blow, bars, echo });
  app.append(main);
  for (const end of buildEndings(echo)) {
    const cid = end.getAttribute('data-chapter');
    const lastOfChapter = [...beats].reverse().find((b) => b.chapter.id === cid);
    if (lastOfChapter) lastOfChapter.el.after(end);
    else main.append(end);
  }
  app.append(buildOthers(), buildCredits());

  // ---- 場景、聲音、導覽 ----
  let stage: Stage | null = null;
  const audio = createAudio(SITE.audio, beats.map((b) => b.beat.cue), () => !!stage?.scene);
  stage = createStage(
    canvas,
    fallback,
    (e) => {
      audio.onSceneEvent(e);
      hyssop.onEvent(e);
    },
    (scene) => {
      hyssop.setScene(scene);
      wave.setScene(scene);
    },
  );
  audioRef = audio;
  emitUi = (e) => audio.onSceneEvent(e);
  const nav = createNav(app, beats);
  echo.setNav(nav);
  const coach = createCoach(app);
  createChrome(app, audio, () => coach.open());
  const mobileQ = window.matchMedia('(max-width: 720px)');
  const headFade = createHeadFade(mobileQ);

  // ---- 捲動 ----
  const infos: BeatInfo[] = beats.map((b) => ({
    chapterId: b.chapter.id,
    chapterKind: b.chapter.kind,
    beatId: b.beat.id,
    cue: b.beat.cue,
    day: b.beat.day,
    dayTo: b.beat.dayTo,
    month: b.chapter.kind === 'opening' ? 1 : b.chapter.month,
    monthTo: b.chapter.monthTo,
    later: !!b.beat.echoes?.length,
    interaction: b.beat.interaction,
    el: b.el,
    box: b.box,
  }));
  const hyssopRef = beats.find((b) => b.beat.interaction === 'hyssop');
  const waveRef = beats.find((b) => b.beat.interaction === 'wave');
  let sideLocked = false;
  let settled = false;
  const mealRef = beats.find((b) => b.panel);
  const barBeats = new Set(beats.filter((b) => b.beat.bars?.length).map((b) => b.beat.id));
  // 驗收腳本（tools/check-*.mjs）從這裡讀 story；不影響網站本身
  (window as unknown as { __jfStory: typeof story }).__jfStory = story;

  const scroll = initScroll(infos, (index) => {
    audio.onBeat(index);
    // 版面量好之前的 index 不可靠（ScrollTrigger 還沒算出每一拍的位置），不能拿來判斷「捲過去了」
    if (settled) {
      bake.sync(index);
      wave.sync(index);
      blow.sync(index);
    }
    bars.setBeat(story.beat);
    stage?.setCue(story.cue);
    // 手機的面板蓋在說明框上方：離開那一拍就收起來
    if (mobileQ.matches && anyPanelOpen()) {
      const open = beats.find((b) => b.hasPanelOpen());
      if (open && open.index !== index) closeOpenPanel(false);
    }
    sideLocked = false;
    // 室內分格：進入那一拍才顯示
    for (const b of beats) if (b.panel) setPanelOn(b.panel, b.index === index);
  });
  stage.setCue(story.cue);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && anyPanelOpen() && !document.querySelector('dialog[open]')) closeOpenPanel(true);
  });
  window.addEventListener('resize', () => {
    sideLocked = false;
  });

  // 桌機：說明框放在畫面左或右，挑跟可互動區域重疊較少的那一邊（把手最重、盆次之、門框區最輕）
  const RECT_WEIGHT = [4, 2, 0.5];
  function pickSide(rects: DOMRect[]): 'left' | 'right' {
    const box = hyssopRef!.box;
    const bw = box.offsetWidth;
    const bh = box.offsetHeight;
    const vw = window.innerWidth;
    const top = parseFloat(getComputedStyle(box).top) || 120;
    const xs = {
      left: Math.min(96, Math.max(24, vw * 0.06)),
      right: vw - Math.min(150, Math.max(100, vw * 0.09)) - bw,
    };
    const cost = (x0: number) => {
      let c = 0;
      rects.forEach((r, i) => {
        const w = Math.max(0, Math.min(x0 + bw, r.right) - Math.max(x0, r.left));
        const hh = Math.max(0, Math.min(top + bh, r.bottom) - Math.max(top, r.top));
        c += w * hh * (RECT_WEIGHT[i] ?? 1);
      });
      return c;
    };
    return cost(xs.left) <= cost(xs.right) ? 'left' : 'right';
  }

  const firstEnd = document.querySelector('.jf-end');

  // 徽章要避開的固定介面：標題列、月份導覽、聲音鈕、日數牌（顯示時）、往下捲提示，再加上說明框
  const fixedUi = [...document.querySelectorAll<HTMLElement>('.jf-brand, .jf-bar .jf-btn, .jf-months, .jf-day, .jf-scrollcue')];
  const avoidRects: DOMRect[] = [];
  const NO_RECTS: DOMRect[] = [];
  function collectAvoid(box: HTMLElement): DOMRect[] {
    avoidRects.length = 0;
    for (const el of fixedUi) {
      if (el.classList.contains('jf-day') && !el.classList.contains('is-on')) continue;
      avoidRects.push(el.getBoundingClientRect());
    }
    avoidRects.push(box.getBoundingClientRect());
    return avoidRects;
  }

  /** 手機：分格的高度不能碰到下方貼底的說明框頂端，碰到就縮（最矮 120px） */
  function fitMealPanel() {
    if (!mealRef?.panel) return;
    if (!mobileQ.matches) {
      mealRef.panel.style.removeProperty('--jf-panel-h');
      return;
    }
    const H = window.innerHeight;
    const base = Math.min(290, Math.max(200, H * 0.34));
    const top = mealRef.panel.getBoundingClientRect().top;
    const boxTop = H - 8 - mealRef.box.offsetHeight;
    const h = Math.min(base, Math.max(120, boxTop - top - 12));
    mealRef.panel.style.setProperty('--jf-panel-h', `${Math.round(h)}px`);
  }

  // ---- 每幀：只做便宜的事（導覽標記、日數牌、觸控層與徽章的位置） ----
  const tick = () => {
    requestAnimationFrame(tick);
    if (document.hidden) return;
    nav.update();
    headFade.update();
    root.classList.toggle('jf-at-top', window.scrollY < 40);
    if (firstEnd) root.classList.toggle('jf-past-story', firstEnd.getBoundingClientRect().top < 110);
    count.update();
    echo.update();
    audio.onProgress(story.cue, story.beatProgress);
    if (barBeats.has(story.beat)) bars.update(story.beat, story.beatProgress);
    const onWave = story.cue === 'wave';
    wave.update(onWave, onWave && waveRef ? collectAvoid(waveRef.box) : NO_RECTS);
    const onHyssop = story.cue === 'hyssop';
    const rects = hyssop.update(onHyssop, onHyssop && hyssopRef ? collectAvoid(hyssopRef.box) : NO_RECTS);
    if (story.cue === 'meal') fitMealPanel();
    if (onHyssop && hyssopRef && !sideLocked && rects && rects.length && !mobileQ.matches) {
      hyssopRef.el.dataset.side = pickSide(rects);
      sideLocked = true;
    }
  };
  tick();

  // ---- 深連結：#ch=<章 id>、#beat=<拍 id>（律法地圖那邊的連結用）。抹除＋瞬間定位，不做平滑捲動；hash 無效就不動 ----
  function deepTarget(hash: string): HTMLElement | null {
    const m = /^#(ch|beat)=(.+)$/.exec(hash);
    if (!m) return null;
    let id = m[2];
    try {
      id = decodeURIComponent(id);
    } catch {
      return null;
    }
    const ref = m[1] === 'ch' ? beats.find((b) => b.chapter.id === id) : beats.find((b) => b.beat.id === id);
    return ref?.el ?? null;
  }
  function followHash() {
    const el = deepTarget(window.location.hash);
    if (el) nav.jumpTo(el);
  }
  window.addEventListener('hashchange', followHash);

  // ---- 載入畫面：資料就緒（字型與場景）後淡出，不做假進度條 ----
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
  const fontsReady = fonts ? fonts.ready.then(() => undefined) : Promise.resolve();
  const timeout = new Promise<void>((r) => window.setTimeout(r, 2500));
  Promise.race([Promise.all([fontsReady, stage.whenReady()]).then(() => undefined), timeout]).then(() => {
    root.classList.add('jf-ready');
    loading?.classList.add('is-gone');
    window.setTimeout(() => loading?.remove(), 700);
    scroll.refresh();
    settled = true;
    bake.sync(scroll.index());
    wave.sync(scroll.index());
    blow.sync(scroll.index());
    followHash();
    coach.openIfFirstVisit();
  });
  fontsReady.then(() => scroll.refresh());
}

boot();
