import crowdMurmurUrl from '../assets/audio/crowd-murmur.mp3';
import crowdSurgeUrl from '../assets/audio/crowd-surge.mp3';
import desertWindUrl from '../assets/audio/desert-wind.mp3';
import oakLeavesUrl from '../assets/audio/oak-leaves.mp3';
import riverUrl from '../assets/audio/river.mp3';
import seaCloseUrl from '../assets/audio/sea-close.mp3';
import seaWindUrl from '../assets/audio/sea-wind.mp3';
import stoneThudUrl from '../assets/audio/stone-thud.mp3';
import valleyWindUrl from '../assets/audio/valley-wind.mp3';
import type { SiteData } from '../data/types';
import type { StoryState } from './state';

type LoopKey = 'valleyWind' | 'oakLeaves' | 'river' | 'seaWind' | 'desertWind' | 'crowdMurmur';

const LOOP_URLS: Record<LoopKey, string> = {
  valleyWind: valleyWindUrl,
  oakLeaves: oakLeavesUrl,
  river: riverUrl,
  seaWind: seaWindUrl,
  desertWind: desertWindUrl,
  crowdMurmur: crowdMurmurUrl,
};

export interface StoryAudioController {
  sync(inReviewZone: boolean): void;
  playStoneThud(): void;
}

export function createStoryAudio(_data: SiteData, state: StoryState): StoryAudioController {
  const loops: Partial<Record<LoopKey, HTMLAudioElement>> = {};
  const targets: Record<LoopKey, number> = {
    valleyWind: 0,
    oakLeaves: 0,
    river: 0,
    seaWind: 0,
    desertWind: 0,
    crowdMurmur: 0,
  };

  let seaCloseShot: HTMLAudioElement | null = null;
  let crowdSurgeShot: HTMLAudioElement | null = null;
  let stoneThudShot: HTMLAudioElement | null = null;
  let lastBeatId = '';
  let fadeTimer: number | null = null;

  function ensureElements(): void {
    for (const k of Object.keys(LOOP_URLS) as LoopKey[]) {
      if (!loops[k]) {
        const el = new Audio(LOOP_URLS[k]);
        el.loop = true;
        el.preload = 'auto';
        el.volume = 0;
        loops[k] = el;
      }
    }
    if (!seaCloseShot) {
      seaCloseShot = new Audio(seaCloseUrl);
      seaCloseShot.preload = 'auto';
    }
    if (!crowdSurgeShot) {
      crowdSurgeShot = new Audio(crowdSurgeUrl);
      crowdSurgeShot.preload = 'auto';
    }
    if (!stoneThudShot) {
      stoneThudShot = new Audio(stoneThudUrl);
      stoneThudShot.preload = 'auto';
    }
  }

  function playOneShot(el: HTMLAudioElement | null, vol: number): void {
    if (!el || !state.soundOn || document.hidden) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = Math.max(0, Math.min(1, vol));
      void el.play().catch(() => {});
    } catch {
      // 瀏覽器自動播放限制下安全靜默
    }
  }

  function computeTargets(inReviewZone: boolean): void {
    for (const k of Object.keys(targets) as LoopKey[]) {
      targets[k] = 0;
    }
    if (!state.soundOn || inReviewZone || document.hidden) return;

    const id = state.cue;
    const seg = state.segment;

    // 第19節的安靜（cannot）：人群聲全停，只留橡樹葉微響
    if (id === 'cannot') {
      targets.oakLeaves = 0.24;
      return;
    }

    // 第六幕（29–33節）與終幕：只留山谷的風
    if (seg === 'act-6' || seg === 'epilogue') {
      targets.valleyWind = 0.34;
      return;
    }

    // 第二幕：記憶地圖隨地景切換大河、海風、曠野風
    if (seg === 'act-2') {
      if (id === 'beyond-river' || id === 'abraham') {
        targets.river = 0.36;
        targets.valleyWind = 0.14;
      } else if (id === 'egypt') {
        targets.seaWind = 0.38;
      } else if (id === 'east') {
        targets.desertWind = 0.36;
      } else if (id === 'jericho') {
        targets.river = 0.28;
        targets.valleyWind = 0.2;
      } else {
        targets.valleyWind = 0.32;
        targets.oakLeaves = 0.16;
      }
      return;
    }

    // 序幕：空曠山谷風與橡樹葉
    if (seg === 'prologue') {
      targets.valleyWind = 0.34;
      targets.oakLeaves = 0.26;
      return;
    }

    // 第一幕、第三幕、第四幕（非19節）、第五幕：山谷風＋橡樹葉＋遠處低頻會眾背景
    targets.valleyWind = 0.3;
    targets.oakLeaves = 0.24;
    if (id !== 'dismiss' && state.pastBlend < 0.3) {
      targets.crowdMurmur = 0.13;
    }
  }

  function stepVolumes(): void {
    let anyActive = false;
    for (const k of Object.keys(targets) as LoopKey[]) {
      const el = loops[k];
      if (!el) continue;
      const goal = targets[k];
      if (goal > 0.005 && el.paused && state.soundOn && !document.hidden) {
        void el.play().catch(() => {});
      }
      const diff = goal - el.volume;
      if (Math.abs(diff) > 0.012) {
        el.volume = Math.max(0, Math.min(1, el.volume + diff * 0.28));
        anyActive = true;
      } else {
        el.volume = goal;
        if (goal <= 0.002 && !el.paused) {
          el.pause();
        }
      }
      if (goal > 0.002) anyActive = true;
    }

    if (!anyActive && fadeTimer !== null) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function ensureFadeLoop(): void {
    if (fadeTimer === null) {
      fadeTimer = window.setInterval(stepVolumes, 90);
    }
  }

  document.addEventListener('visibilitychange', () => {
    computeTargets(false);
    ensureFadeLoop();
  });

  return {
    sync(inReviewZone: boolean) {
      if (state.soundOn) {
        ensureElements();
      }
      computeTargets(inReviewZone);
      ensureFadeLoop();

      const curId = state.cue;
      if (curId !== lastBeatId) {
        const prev = lastBeatId;
        lastBeatId = curId;
        if (state.soundOn && !inReviewZone && prev !== '') {
          if (curId === 'egypt') {
            playOneShot(seaCloseShot, 0.46);
          } else if (
            curId === 'answer-1' ||
            curId === 'answer-2' ||
            curId === 'answer-3'
          ) {
            playOneShot(crowdSurgeShot, 0.22);
          }
        }
      }
    },
    playStoneThud() {
      if (!state.soundOn) return;
      ensureElements();
      playOneShot(stoneThudShot, 0.68);
    },
  };
}
