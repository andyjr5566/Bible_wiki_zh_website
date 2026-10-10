/**
 * 動態開關：story.motionOff 只由這個開關決定（開＝false、關＝true），不讀 prefers-reduced-motion。
 * 預設有動態；選擇存在 localStorage 的 jf-motion（on／off）。
 * CSS 看 html[data-motion="off"]。關閉只停裝飾性動態，讀者自己觸發的動作照常播放。
 */
import { story } from '../story/state';
import { lsGet, lsSet } from './dom';

export const MOTION_KEY = 'jf-motion';

export function readMotion(): boolean {
  return lsGet(MOTION_KEY) !== 'off';
}

function apply(on: boolean): void {
  story.motionOff = !on;
  document.documentElement.dataset.motion = on ? 'on' : 'off';
}

export function initMotion(): boolean {
  const on = readMotion();
  apply(on);
  return on;
}

export function setMotion(on: boolean): void {
  apply(on);
  lsSet(MOTION_KEY, on ? 'on' : 'off');
}
