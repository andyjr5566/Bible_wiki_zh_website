import type { SiteData } from '../data/types';
import type { StoryState } from '../story/state';
import { coachCustomFlags } from './coach';
import { scrollToY, scrollY } from './scroller';

/** Explicit reader navigation only. Opening a preview or changing a layer never calls this. */
export function reviewNavigate(target: HTMLElement | null, state: StoryState, sync?: () => void, bookmark = false): void {
  if (!target) return;
  if (bookmark) state.returnSpot = { scrollY: scrollY(), label: '剛才讀的地方' };
  const header = document.querySelector('.jos-header')?.getBoundingClientRect().height ?? 52;
  scrollToY(Math.max(0, scrollY() + target.getBoundingClientRect().top - header - 16));
  if (!state.motionOff) {
    document.body.classList.remove('jos-review-wipe');
    requestAnimationFrame(() => document.body.classList.add('jos-review-wipe'));
  }
  sync?.();
}

export function reviewJumpToCue(cue: string, state: StoryState, sync: () => void): void {
  coachCustomFlags.usedJumpToStory = true;
  reviewNavigate(document.querySelector<HTMLElement>(`[data-cue="${CSS.escape(cue)}"]`), state, sync, true);
}

export function cueForVerse(data: SiteData, verse: number): string | undefined {
  let selected: string | undefined;
  let span = Infinity;
  for (const segment of data.segments) {
    for (const beat of segment.beats) {
      const match = /^書24:(\d+)(?:-(\d+))?$/.exec(beat.verse ?? '');
      if (!match) continue;
      const width = +(match[2] ?? match[1]) - +match[1];
      if (verse >= +match[1] && verse <= +(match[2] ?? match[1]) && width < span) {
        selected = beat.cue;
        span = width;
      }
    }
  }
  return selected;
}

/** The review owns these routes; keep the shared story router read-only. */
export function applyReviewRoute(data: SiteData, state: StoryState, sync: () => void): boolean {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  let target: HTMLElement | null = null;
  const rawVerse = params.get('v');
  if (rawVerse) {
    const match = /^(?:書)?24:(\d+)$/.exec(rawVerse);
    if (match) target = document.getElementById(`jos-review-verse-${+match[1]}`);
  }
  const section = params.get('sec');
  if (section === 'scripture') target = document.getElementById('jos-sec-07');
  if (section === 'readings') target = document.getElementById('jos-sec-06');
  const card = params.get('card');
  if (card) {
    const question = data.readingCards.find(q => q.id === card || q.question.includes(card));
    if (question) target = document.getElementById(`jos-card-${question.id}`);
  }
  if (!target) return false;
  document.querySelectorAll('.jos-review-target').forEach(el => el.classList.remove('jos-review-target'));
  target.classList.add('jos-review-target');
  reviewNavigate(target, state, sync);
  return true;
}
