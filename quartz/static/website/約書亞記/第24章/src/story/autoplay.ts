import type { SiteData, StoryBeat } from '../data/types';
import type { StoryState } from './state';
import { sampleStation } from '../scene/stations';
import { FLIGHT_PX, stationReadPx } from '../data/storytelling';
import { beatRhythm, stationRhythm } from '../data/story-content.mjs';
import { paceRate, stepAutoplayFrame } from './playback-speed';

/** Seconds are apportioned to each verse, not to the entire map beat. */
export function readingSeconds(text: string, actionSeconds = 4): number {
  return Math.max(5, [...text.replace(/[\s，。；：「」！？]/gu, '')].length / 6 + actionSeconds);
}
/** Shared by playback and letter reveals, so a sentence takes 0.8s at autoplay speed. */
export function beatPlaybackSeconds(beat: StoryBeat, data: SiteData): number {
  return beatRhythm(beat, data).seconds;
}
export function attachAutoplay(data: SiteData, state: StoryState, button: HTMLButtonElement, onChange: () => void) {
  const beats = data.segments.flatMap(s => s.beats);
  let playing = false, raf = 0, last = 0, velocity = 0, position = window.scrollY;
  let pauseRemaining = 0, pausedHeadline = false;
  const setPlaying = (value: boolean) => {
    playing = value;
    state.autoplaying = value;
    button.textContent = playing ? '暫停播放' : '自動播放';
    button.setAttribute('aria-pressed', String(playing));
    if (!playing) { cancelAnimationFrame(raf); velocity = 0; }
  };
  const stop = () => setPlaying(false);
  const input = (event: Event) => {
    // Native select pointer, keyboard, and change interactions stay in playback.
    if (event.composedPath().some(target => target instanceof Element && target.matches('.jos-speed-select, .jos-speed-select *'))) return;
    if (event.composedPath().includes(button)) {
      if (['pointerdown', 'touchstart', 'click'].includes(event.type)) return;
      if (event instanceof KeyboardEvent && [' ', 'Enter'].includes(event.key)) return;
    }
    if (playing) stop();
  };
  for (const name of ['wheel', 'touchstart', 'pointerdown', 'keydown', 'click'])
    window.addEventListener(name, input, { capture: true, passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

  function frame(now: number) {
    if (!playing) return;
    const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
    last = now;
    const beat = beats.find(b => b.id === state.beat);
    const element = document.querySelector<HTMLElement>(`section[data-beat-id="${state.beat}"]`);
    if (!beat || !element) { stop(); return; }
    const lastElement = document.querySelector<HTMLElement>(`section[data-beat-id="${beats.at(-1)!.id}"]`)!;
    const end = window.scrollY + lastElement.getBoundingClientRect().bottom - innerHeight * .36 - 1;
    if (position >= end) { stop(); return; }
    if (beat.interaction === 'cannot-pause' && !pausedHeadline && state.beatProgress >= .06) {
      pausedHeadline = true;
      pauseRemaining = 4.5;
    }
    if (beat.cue !== 'cannot') pausedHeadline = false;
    let speed: number;
    const station = sampleStation(beat.id, state.beatProgress);
    if (station) {
      speed = station.flight ? FLIGHT_PX / 6 : stationReadPx(station.station) / stationRhythm(station.station, data).seconds;
    } else {
      speed = element.offsetHeight / beatPlaybackSeconds(beat, data);
    }
    const paused = pauseRemaining > 0;
    const pace = paceRate(state.playbackRate);
    pauseRemaining = Math.max(0, pauseRemaining - dt * pace);
    const next = stepAutoplayFrame(position, velocity, speed, dt, pace, paused);
    velocity = next.velocity;
    position = Math.min(end, next.position);
    window.scrollTo({ top: position, behavior: 'instant' });
    if (beat.interaction === 'raise-stone' && !state.raiseStone.done) {
      state.raiseStone.auto = true;
      state.raiseStone.progress = Math.min(1, state.raiseStone.progress + dt * pace / 3);
      state.raiseStone.done = state.raiseStone.progress >= 1;
      onChange();
    }
    raf = requestAnimationFrame(frame);
  }
  button.addEventListener('click', () => {
    if (playing) { stop(); return; }
    const finalSection = document.querySelector<HTMLElement>(`section[data-beat-id="${beats.at(-1)!.id}"]`)!;
    if (finalSection.getBoundingClientRect().bottom <= innerHeight * .36) return;
    setPlaying(true); position = window.scrollY; last = 0; velocity = 0; pauseRemaining = 0;
    raf = requestAnimationFrame(frame);
  });
  return { stop, isPlaying: () => playing };
}
