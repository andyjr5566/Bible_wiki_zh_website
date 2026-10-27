import type { SiteData, StoryBeat } from '../data/types';
import { clamp01, type StoryState } from './state';

function getHeaderOffset(): number {
  const hdr = document.querySelector<HTMLElement>('.jos-header');
  return (hdr ? hdr.getBoundingClientRect().height : 52) + 8;
}

/** 全站唯一捲動入口（禁止呼叫 scrollIntoView，避免錨點跳動與橫向捲動偏移） */
export function scrollToElement(
  target: HTMLElement | null,
  state: StoryState,
  bookmark?: { label: string },
  onStateChange?: () => void,
): void {
  if (!target) return;
  if (bookmark) {
    state.returnSpot = {
      scrollY: window.scrollY,
      label: bookmark.label,
    };
    onStateChange?.();
  }
  const rect = target.getBoundingClientRect();
  const top = Math.max(0, window.scrollY + rect.top - getHeaderOffset());
  window.scrollTo({
    top,
    behavior: state.motionOff ? 'auto' : 'smooth',
  });
}

export function scrollBackToBookmark(state: StoryState, onStateChange?: () => void): void {
  if (!state.returnSpot) return;
  const targetY = state.returnSpot.scrollY;
  state.returnSpot = null;
  onStateChange?.();
  window.scrollTo({
    top: targetY,
    behavior: state.motionOff ? 'auto' : 'smooth',
  });
}

export function attachScrollTracker(
  data: SiteData,
  state: StoryState,
  onBeatChange: (inReviewZone: boolean) => void,
  onProgress?: () => void,
): () => void {
  const beatMeta = new Map<string, { segId: string; beat: StoryBeat }>();
  for (const seg of data.segments) {
    for (const b of seg.beats) {
      beatMeta.set(b.id, { segId: seg.id, beat: b });
    }
  }

  let ticking = false;
  let prevInReview = false;
  let visualY = window.scrollY;
  let targetY = visualY;
  let previousFrame = performance.now();

  function updateFromScroll(): void {
    const now = performance.now();
    const dt = Math.min(64, now - previousFrame);
    previousFrame = now;
    const gain = 1 - Math.pow(.90, dt / (1000 / 60));
    visualY += (targetY - visualY) * gain;
    if (Math.abs(targetY - visualY) < .05) visualY = targetY;
    ticking = false;
    const visualOffset = window.scrollY - visualY;
    const docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    state.pageProgress = clamp01(window.scrollY / docH);

    const reviewRoot = document.getElementById('jos-review-root');
    const inReview = reviewRoot
      ? reviewRoot.getBoundingClientRect().top <= window.innerHeight * 0.58
      : false;

    const anchorY = window.innerHeight * 0.36;
    const beatEls = document.querySelectorAll<HTMLElement>('[data-beat-id]');
    let chosenEl: HTMLElement | null = null;
    let bestDist = Infinity;

    beatEls.forEach((el) => {
      const r = el.getBoundingClientRect();
      const top = r.top + visualOffset;
      const bottom = r.bottom + visualOffset;
      if (top <= anchorY && bottom >= anchorY) {
        chosenEl = el;
        bestDist = 0;
      } else if (bestDist > 0) {
        const d = Math.min(Math.abs(top - anchorY), Math.abs(bottom - anchorY));
        if (d < bestDist) {
          bestDist = d;
          chosenEl = el;
        }
      }
    });

    if (!chosenEl) return;
    const el = chosenEl as HTMLElement;
    const beatId = el.dataset.beatId ?? '';
    const meta = beatMeta.get(beatId);
    if (!meta) return;

    const r = el.getBoundingClientRect();
    const scrollableBeatH = Math.max(1, r.height);
    state.beatProgress = clamp01((anchorY - r.top - visualOffset) / scrollableBeatH);

    const prevBeat = state.beat;
    const prevSeg = state.segment;
    const prevLater = state.later;

    if (prevBeat !== meta.beat.id) {
      state.prevCue = state.cue;
      state.beat = meta.beat.id;
      state.cue = meta.beat.cue;
      state.segment = meta.segId;
      state.space = meta.beat.space;
      state.mapElevation = meta.beat.space === 'map' ? 1 : 0;
      state.pastBlend = meta.beat.interaction === 'put-away-past' ? 1 : 0;
      state.later = meta.segId === 'epilogue';
    }

    if (
      prevBeat !== state.beat ||
      prevSeg !== state.segment ||
      prevLater !== state.later ||
      prevInReview !== inReview
    ) {
      prevInReview = inReview;
      onBeatChange(inReview);
    }
    onProgress?.();
    if (visualY !== targetY) {
      ticking = true;
      window.requestAnimationFrame(updateFromScroll);
    }
  }

  function onScroll(): void {
    targetY = window.scrollY;
    if (!ticking) {
      ticking = true;
      previousFrame = performance.now() - 1000 / 60;
      window.requestAnimationFrame(updateFromScroll);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  updateFromScroll();

  return () => {
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('resize', onScroll);
  };
}
