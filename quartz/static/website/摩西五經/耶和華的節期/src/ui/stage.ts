/**
 * 舞台：固定在背景的 <canvas>（aria-hidden）與場景介面的整合。
 * - createScene 回傳 null（或丟出例外、WebGL 掉了）時，改用預先輸出的靜態插圖
 *   public/fallback/<cue>.webp；檔案不存在時只顯示紙色背景，內容照常可讀。
 * - 視窗尺寸或 devicePixelRatio 改變時呼叫 scene.resize。
 */
import { SITE } from '../data/site';
import type { Palette } from '../data/types';
import { createScene } from '../scene';
import type { SceneEvent, SceneHandle } from '../scene/api';
import { story } from '../story/state';

export interface Stage {
  readonly scene: SceneHandle | null;
  readonly canvas: HTMLCanvasElement;
  /** 場景不可用時依 cue 換靜態插圖 */
  setCue(cue: string): void;
  /** 資料就緒後：場景回報 ready（或沒有場景、或逾時）就 resolve */
  whenReady(): Promise<void>;
}

const MOBILE_Q = '(max-width: 720px), (pointer: coarse)';

/** DPR 上限：桌機 1.75，手機 1.5 */
function dprCap(): number {
  return window.matchMedia(MOBILE_Q).matches ? 1.5 : 1.75;
}

export function createStage(
  canvas: HTMLCanvasElement,
  fallbackHost: HTMLElement,
  onEvent: (e: SceneEvent) => void,
  onSceneChange: (scene: SceneHandle | null) => void,
): Stage {
  const palettes: Record<string, Palette> = {};
  for (const c of SITE.chapters) palettes[c.id] = c.palette;

  let scene: SceneHandle | null = null;
  let resolveReady: () => void = () => undefined;
  const ready = new Promise<void>((r) => {
    resolveReady = r;
  });

  const layers = [document.createElement('div'), document.createElement('div')];
  for (const l of layers) {
    l.className = 'jf-fallback-layer';
    fallbackHost.append(l);
  }
  let front = 0;
  let curUrl = '';

  function useFallback() {
    document.documentElement.classList.add('jf-no-scene');
    canvas.hidden = true;
    fallbackHost.hidden = false;
    setCue(story.cue);
  }

  function setCue(cue: string) {
    if (scene) return;
    const url = `./fallback/${cue}.webp`;
    if (url === curUrl) return;
    curUrl = url;
    const img = new Image();
    img.onload = () => {
      if (curUrl !== url) return;
      const next = layers[1 - front];
      next.style.backgroundImage = `url("${url}")`;
      next.classList.add('is-on');
      layers[front].classList.remove('is-on');
      front = 1 - front;
    };
    img.onerror = () => {
      // 沒有這張插圖：只留紙色背景
      if (curUrl === url) layers[front].classList.remove('is-on');
    };
    img.src = url;
  }

  const handle = (e: SceneEvent) => {
    if (e.type === 'ready') resolveReady();
    if (e.type === 'webgl-lost') {
      try {
        scene?.dispose();
      } catch {
        /* 略過 */
      }
      scene = null;
      onSceneChange(null);
      useFallback();
    }
    onEvent(e);
  };

  try {
    scene = createScene({ canvas, story, palettes, laterPalette: SITE.laterPalette, onEvent: handle });
  } catch (err) {
    console.warn('場景建立失敗，改用靜態插圖', err);
    scene = null;
  }

  if (!scene) {
    useFallback();
    resolveReady();
  } else {
    // 場景一直沒回報 ready 時不卡住載入畫面
    window.setTimeout(resolveReady, 3500);
    let raf = 0;
    const doResize = () => {
      raf = 0;
      scene?.resize(window.innerWidth, window.innerHeight, Math.min(window.devicePixelRatio || 1, dprCap()));
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(doResize);
    };
    doResize();
    window.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    // devicePixelRatio 改變（縮放、換螢幕）時 resize 事件不一定會來：用 resolution 查詢監聽
    const watchDpr = () => {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      const fn = () => {
        schedule();
        watchDpr();
      };
      if (mq.addEventListener) mq.addEventListener('change', fn, { once: true });
    };
    watchDpr();
  }
  onSceneChange(scene);

  return {
    get scene() {
      return scene;
    },
    canvas,
    setCue,
    whenReady: () => ready,
  };
}
