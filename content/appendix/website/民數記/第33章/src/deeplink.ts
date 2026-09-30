import type { SegMode } from './data/stations';
import type { Mode, State } from './store';

/**
 * 可分享的網址：
 *   #s12      選第 12 站（走動的人也到那一站）
 *   #time     左欄看時間；#text 看經文；#geo 看地理
 *   #ct、#gt  分段方式
 *   #play     從第 1 站開始走
 * 站號 1–42 以外的 #s 開頭寫法不處理。
 */
export function parseHash(hash: string): Partial<State> | null {
  const k = decodeURIComponent(hash.replace(/^#/, ''));
  if (!k) return null;
  const m = /^s(\d{1,2})$/.exec(k);
  if (m) {
    const n = +m[1];
    return n >= 1 && n <= 42 ? { sel: n, at: n, playing: false } : null;
  }
  if (k === 'time' || k === 'text' || k === 'geo') return { mode: k as Mode };
  if (k === 'ct' || k === 'gt') return { seg: k as SegMode, mode: 'geo' };
  if (k === 'play') return { playing: true, at: 1, sel: 1, follow: true };
  return null;
}
