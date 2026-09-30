import { TOTAL_MONTHS, stationMonths } from '../data/dates';
import { distAt, legLength } from '../geo';
import { animOff } from './dom';

/**
 * 播放頭：走動的人在路線上的位置 p（1–42 的小數，整數就是剛好在那一站）。
 * 地圖、時間顯示都訂閱它，所以移動是連續的，不用每一站都經過整個畫面重畫。
 *
 *   play：依 pace 一站一站往前走。
 *     steady 每站都有起步、加速、減速、停一下，時間依兩站的距離；
 *     time   照時間比例連續前進，四十年壓縮成約一分鐘，中間不停。
 *   glideTo：從目前位置沿路線滑到某一站（點選、上一站下一站）。
 */
export type Pace = 'steady' | 'time';

type MoveSub = (p: number, moving: boolean) => void;

const MS_PER_MONTH = 60000 / TOTAL_MONTHS;
const DWELL_MS = 700;

let p = 1;
let pace: Pace = 'steady';
let playing = false;
let raf = 0;
let lastT = 0;

type Mode =
  | { kind: 'idle' }
  | { kind: 'glide'; from: number; to: number; t: number; dur: number }
  | { kind: 'play'; i: number; u: number; dwell: number };
let mode: Mode = { kind: 'idle' };

const moveSubs = new Set<MoveSub>();
const arriveSubs = new Set<(n: number) => void>();
const endSubs = new Set<() => void>();

const smooth = (u: number) => u * u * (3 - 2 * u);
const easeInOut = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** smooth 的反函數（二分法），從中途繼續播放時用 */
function smoothInv(y: number): number {
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < 14; k++) {
    const mid = (lo + hi) / 2;
    if (smooth(mid) < y) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** 從第 i 站走到第 i+1 站要多久（毫秒） */
function legMs(i: number): number {
  if (animOff()) return 1;
  if (pace === 'steady') return clamp(520 + legLength(i) * 5.2, 650, 2300);
  return clamp((stationMonths(i + 1) - stationMonths(i)) * MS_PER_MONTH, 220, 6000);
}

export const getP = () => p;
export const isPlaying = () => playing;
export const onMove = (fn: MoveSub) => { moveSubs.add(fn); return () => moveSubs.delete(fn); };
export const onArrive = (fn: (n: number) => void) => { arriveSubs.add(fn); return () => arriveSubs.delete(fn); };
export const onEnd = (fn: () => void) => { endSubs.add(fn); return () => endSubs.delete(fn); };

const emit = (moving: boolean) => moveSubs.forEach((f) => f(p, moving));
const arrive = (n: number) => arriveSubs.forEach((f) => f(n));

/** 這一刻的「起算月數」：兩站之間依位置內插，時間顯示用 */
export function monthsAt(q: number): number {
  const c = clamp(q, 1, 42);
  const i = Math.min(41, Math.floor(c));
  const f = c - i;
  return stationMonths(i) + (stationMonths(i + 1) - stationMonths(i)) * f;
}

function ensure() {
  if (raf) return;
  lastT = performance.now();
  raf = requestAnimationFrame(loop);
}

function loop(now: number) {
  // rAF 的時間戳可能比 lastT 早一點，所以 dt 不可為負。上限 250ms：畫面慢的機器只是格數少、速度仍然對；
  // 分頁在背景回來時才不會一次跳很遠
  const dt = clamp(now - lastT, 0, 250);
  lastT = now;
  raf = 0;
  step(dt);
  if (mode.kind !== 'idle') raf = requestAnimationFrame(loop);
}

function step(dt: number) {
  const m = mode;
  if (m.kind === 'glide') {
    m.t += dt;
    const u = Math.min(1, m.t / m.dur);
    p = m.from + (m.to - m.from) * easeInOut(u);
    if (u >= 1) {
      p = m.to;
      mode = { kind: 'idle' };
      emit(false);
      arrive(Math.round(p));
      if (playing) startPlay();
    } else emit(true);
    return;
  }
  if (m.kind === 'play') {
    let left = dt;
    if (m.dwell > 0) {
      m.dwell -= left;
      emit(false);
      if (m.dwell > 0) return;
      left = -m.dwell;
      m.dwell = 0;
    }
    m.u += left / legMs(m.i);
    if (m.u >= 1) {
      p = m.i + 1;
      emit(false);
      arrive(m.i + 1);
      if (m.i + 1 >= 42) {
        playing = false;
        mode = { kind: 'idle' };
        endSubs.forEach((f) => f());
        return;
      }
      m.i += 1;
      m.u = 0;
      m.dwell = animOff() ? 1200 : pace === 'steady' ? DWELL_MS : 0;
      return;
    }
    const u = clamp(m.u, 0, 1);
    p = m.i + (pace === 'steady' ? smooth(u) : u);
    emit(true);
  }
}

function startPlay() {
  if (p >= 42) p = 1;
  const i = Math.min(41, Math.floor(p));
  const frac = p - i;
  mode = { kind: 'play', i, u: frac < 1e-3 ? 0 : pace === 'steady' ? smoothInv(frac) : frac, dwell: 0 };
  ensure();
}

/** 從第 from 站開始（或接著）播放；不在那一站就先滑過去 */
export function play(from?: number) {
  playing = true;
  if (from !== undefined && Math.abs(p - from) > 0.02) glideTo(from);
  else startPlay();
}

export function pause() {
  playing = false;
  mode = { kind: 'idle' };
  emit(false);
}

/** 沿路線滑到第 to 站（播放中的話，到了之後接著播放） */
export function glideTo(to: number, ms?: number) {
  if (Math.abs(p - to) < 1e-3 || animOff()) {
    // 已經在那裡，或使用者要求減少動態：直接到
    p = to;
    mode = { kind: 'idle' };
    emit(false);
    if (Math.abs(p - to) < 1e-3) arrive(Math.round(to));
    if (playing) startPlay();
    return;
  }
  const dur = ms ?? clamp(450 + Math.abs(distAt(to) - distAt(p)) * 3.4, 450, 1900);
  mode = { kind: 'glide', from: p, to, t: 0, dur };
  ensure();
}

/** 立刻到第 n 站，不做動畫（也不再自動接著播放） */
export function jump(n: number) {
  p = n;
  mode = { kind: 'idle' };
  emit(false);
}

export function setPace(next: Pace) {
  if (next === pace) return;
  const wasPlaying = mode.kind === 'play';
  pace = next;
  if (wasPlaying) startPlay(); // 依新的速度從目前位置接著走
}
