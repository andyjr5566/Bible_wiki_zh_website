import './styles/tokens.css';
import './styles/layout.css';
import './styles/story.css';
import './styles/review.css';
import './styles/compact.css';
import './styles/onevoice.css';
import './styles/stations.css';
import './styles/storyteller.css';
import { attachAutoplay } from './story/autoplay';

import shechemDemUrl from './assets/dem/shechem-dem.json?url';
import wideReliefUrl from './assets/dem/wide-relief.jpg';
import propsGlbUrl from './assets/models/props.glb?url';
import { loadSiteData } from './data/site';
import type { SiteData } from './data/types';
import { createScene, type ExtendedSceneHandle } from './scene';
import { createStationPlayer } from './scene/station-player';
import { createStoryAudio } from './story/audio';
import { applyHashRoute } from './story/router';
import { attachScrollTracker } from './story/scroll';
import { createInitialState, type StoryState } from './story/state';
import { createCoachPanel } from './ui/coach';
import { h } from './ui/dom';
import { refreshViewportHeight } from './ui/viewport';
import { createHeader } from './ui/header';
import { createPeekDrawer } from './ui/peek';
import { createReviewView } from './ui/review-view';
import { applyReviewRoute } from './ui/review-navigation';
import { createRotateHint } from './ui/rotate-hint';
import { createServeThread } from './ui/serve-thread';
import { createStoryView } from './ui/story-view';
import { createWebglFallback } from './ui/webgl-fallback';

declare global {
  interface Window {
    __josScene?: ExtendedSceneHandle | null;
    __josState?: StoryState;
  }
}

function mountApp(siteData: SiteData): void {
  const app = document.getElementById('app');
  const canvas = document.getElementById('jos-canvas') as HTMLCanvasElement | null;
  if (!app || !canvas) return;

  const state = createInitialState();
  const stationPlayer = createStationPlayer(state);
  document.body.insertBefore(stationPlayer.element, app);
  window.__josState = state;

  let sceneHandle: ExtendedSceneHandle | null = null;
  let inReviewZone = false;
  let webglLost = false;
  let mapPrepared = false;

  function prepareSceneAssets(): void {
    if (!sceneHandle) return;
    if (!mapPrepared && (state.cue === 'family-1' || state.segment === 'act-2')) {
      mapPrepared = true;
      sceneHandle.applyMapReliefUrl(wideReliefUrl);
    }
  }

  const fallback = createWebglFallback(state);
  document.body.insertBefore(fallback.element, app);

  const stageTagsEl = h('div', {
    id: 'jos-stage-tags',
    className: 'jos-stage-tags',
    'aria-hidden': 'true',
  });
  document.body.insertBefore(stageTagsEl, app);
  const tagNodes = new Map<string, HTMLDivElement>();
  const seenTagIds = new Set<string>();

  function syncBodyClasses(): void {
    document.body.classList.toggle('jos-dark', state.dark);
    document.body.classList.toggle('jos-motion-off', state.motionOff);
    document.body.classList.toggle('jos-later', state.later);
    if (state.motionOff) {
      state.pointerParallax.x = 0;
      state.pointerParallax.y = 0;
    }
    sceneHandle?.wake();
    fallback.sync();
  }

  let syncAll = () => {};

  const coach = createCoachPanel(state);
  const storyAudio = createStoryAudio(siteData, state, () => syncAll());
  const peek = createPeekDrawer(siteData, state, () => syncAll());
  const header = createHeader(
    siteData,
    state,
    () => {
      syncBodyClasses();
      storyAudio.sync(inReviewZone);
    },
    () => coach.toggle(),
    () => syncAll(),
  );
  const serveThread = createServeThread(siteData, state, () => syncAll());
  const storyView = createStoryView(
    siteData,
    state,
    peek,
    () => syncAll(),
    () => Boolean(sceneHandle) && !webglLost,
  );
  const reviewView = createReviewView(siteData, state, peek, () => syncAll());

  syncAll = () => {
    prepareSceneAssets();
    syncBodyClasses();
    header.sync();
    serveThread.sync();
    serveThread.setHidden(inReviewZone);
    stageTagsEl.classList.toggle('jos-stage-tags-hidden', inReviewZone);
    storyView.syncRaiseUi();
    storyView.setHidden(inReviewZone);
    storyView.tick();
    stationPlayer.tick(inReviewZone);
    coach.notifyAction();
    fallback.sync();
    storyAudio.sync(inReviewZone);
  };

  const storyShell = h(
    'div',
    { className: 'jos-story-shell' },
    serveThread.element,
    storyView.element,
  );

  app.replaceChildren(
    header.headerEl,
    storyShell,
    reviewView,
    coach.element,
    header.returnBarEl,
    peek.element,
    createRotateHint(),
  );

  // 初始化常駐 3D WebGL 舞台
  sceneHandle = createScene({
    canvas,
    state,
    data: siteData,
    onEvent: (ev) => {
      if (ev.type === 'stone-landed') {
        storyView.syncRaiseUi();
        coach.notifyAction();
        storyAudio.playStoneThud();
      } else if (ev.type === 'webgl-lost') {
        webglLost = true;
        canvas.style.display = 'none';
        fallback.setActive(true);
      }
    },
  });
  window.__josScene = sceneHandle;

  if (!sceneHandle) {
    canvas.style.display = 'none';
    fallback.setActive(true);
  } else {
    void sceneHandle.applyBlenderModels(undefined, propsGlbUrl);
    // 掛載真實示劍山谷高程網格、近東暈渲底圖與 Blender 5.2 正式模型
    void fetch(shechemDemUrl).then(response => {
      if (!response.ok) throw new Error(`DEM ${response.status}`);
      return response.json() as Promise<{relDecimeters: number[]; baseElevM: number; cols: number; rows: number; widthM: number; depthM: number}>;
    }).then(shechemDemJson => {
    const rel = shechemDemJson.relDecimeters;
    const heights = new Float32Array(rel.length);
    const baseElev = shechemDemJson.baseElevM;
    for (let i = 0; i < rel.length; i++) {
      heights[i] = baseElev + rel[i] * 0.1;
    }
    sceneHandle?.applyDemGrid({
      cols: shechemDemJson.cols,
      rows: shechemDemJson.rows,
      widthM: shechemDemJson.widthM,
      depthM: shechemDemJson.depthM,
      centerOffsetX: 0,
      centerOffsetZ: 0,
      baseElevM: baseElev,
      heights,
    });
    }).catch(error => console.error('DEM could not be loaded', error));
    storyView.attachScene(sceneHandle);
    sceneHandle.setFrameListener(() => {
      prepareSceneAssets();
      if (state.raiseStone.holding) {
        storyView.syncRaiseUi();
      }
      storyView.tick();
      stationPlayer.tick(inReviewZone);
      if (inReviewZone) return;
      const labels = sceneHandle!.getCurrentLabels();
      seenTagIds.clear();
      for (let i = 0; i < labels.length; i++) {
        const item = labels[i];
        seenTagIds.add(item.id);
        let node = tagNodes.get(item.id);
        if (!node) {
          node = document.createElement('div');
          node.className = 'jos-stage-tag';
          tagNodes.set(item.id, node);
          stageTagsEl.appendChild(node);
        }
        node.dataset.tagId = item.id;
        if (!item.visible) {
          node.style.display = 'none';
        } else {
          node.style.display = 'block';
          if (node.textContent !== item.label) node.textContent = item.label;
          node.style.left = `${Math.round(item.x)}px`;
          node.style.top = `${Math.round(item.y)}px`;
        }
      }
      for (const [id, node] of tagNodes.entries()) {
        if (!seenTagIds.has(id)) {
          node.style.display = 'none';
        }
      }
    });

    window.addEventListener(
      'resize',
      () => {
        sceneHandle?.resize(window.innerWidth, refreshViewportHeight(), window.devicePixelRatio || 1);
      },
      { passive: true },
    );

    // 首屏滑鼠微視差與 pointer 喚醒閒置計時
    window.addEventListener(
      'pointermove',
      (e) => {
        sceneHandle?.wake();
        if (state.motionOff || window.innerWidth <= 768 || window.innerHeight <= 520) {
          state.pointerParallax.x = 0;
          state.pointerParallax.y = 0;
          return;
        }
        state.pointerParallax.x = (e.clientX / Math.max(1, window.innerWidth)) * 2 - 1;
        state.pointerParallax.y = (e.clientY / Math.max(1, window.innerHeight)) * 2 - 1;
      },
      { passive: true },
    );

    window.addEventListener(
      'pointerdown',
      () => {
        sceneHandle?.wake();
      },
      { passive: true },
    );
  }

  syncBodyClasses();
  attachAutoplay(siteData, state, header.headerEl.querySelector<HTMLButtonElement>('.jos-autoplay')!, () => syncAll());
  attachScrollTracker(
    siteData,
    state,
    (inRev) => {
      inReviewZone = inRev;
      syncAll();
    },
    () => { storyView.tick(); stationPlayer.tick(inReviewZone); storyAudio.sync(inReviewZone); },
  );

  if (window.location.hash) {
    window.requestAnimationFrame(() => {
      if (!applyReviewRoute(siteData, state, syncAll)) applyHashRoute(siteData, state, (pid) => peek.openPlace(pid), syncAll);
    });
  }
  window.addEventListener('hashchange', () => {
    if (!applyReviewRoute(siteData, state, syncAll)) applyHashRoute(siteData, state, (pid) => peek.openPlace(pid), syncAll);
  });
}

// 優先載入本地經文字體；短逾時後仍可閱讀，避免慢速連線無限等待。
void Promise.all([
  loadSiteData(),
  Promise.race([
    document.fonts.load('18px "JOS Story"').catch(() => []),
    new Promise(resolve => window.setTimeout(resolve, 1200)),
  ]),
]).then(([data]) => mountApp(data)).catch(error => {
  console.error('Site could not be opened', error);
  const app = document.getElementById('app');
  if (app) app.textContent = '暫時無法開啟，請重新整理。';
});
