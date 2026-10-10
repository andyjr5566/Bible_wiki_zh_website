/**
 * 大標題與章標題的淡出：它們（開場大標題、章標題＋日期牌）是跟著頁面捲動的，
 * 往上捲到固定的標題列、月份導覽下面時會和站名、按鈕疊在一起。
 * 這裡每幀量一次它們的上緣：快碰到固定介面的下緣時，opacity 線性降到 0，並略往上移。
 * 減少動態（story.motionOff）時一樣淡出，但不位移。
 */
import { story } from '../story/state';
import { clamp } from './dom';

/** 離固定介面下緣還有這麼多 px 時還是全不透明；再往上 FADE px 內降到 0 */
const GAP = 28;
const FADE = 60;
const LIFT = 16;

export interface HeadFade {
  update(): void;
}

export function createHeadFade(mobileQ: MediaQueryList): HeadFade {
  const heads = [...document.querySelectorAll<HTMLElement>('.jf-hero, .jf-chaphead')];
  const brand = document.querySelector<HTMLElement>('.jf-brand');
  const bar = document.querySelector<HTMLElement>('.jf-bar');
  const months = document.querySelector<HTMLElement>('.jf-months');
  const day = document.querySelector<HTMLElement>('.jf-day');
  const last = new Map<HTMLElement, number>();
  /** 目前已經套上的上移量（px，正數）：量上緣時要加回去，才不會自己影響自己 */
  const lifted = new Map<HTMLElement, number>();

  /** 固定介面目前最低的下緣：桌機是標題列；手機再加上月份橫線，開場章還有日數牌 */
  function chromeBottom(): number {
    let b = 0;
    if (brand) b = Math.max(b, brand.getBoundingClientRect().bottom);
    if (bar) b = Math.max(b, bar.getBoundingClientRect().bottom);
    if (mobileQ.matches) {
      if (months) b = Math.max(b, months.getBoundingClientRect().bottom);
      if (day && day.classList.contains('is-on')) b = Math.max(b, day.getBoundingClientRect().bottom);
    }
    return b;
  }

  function update() {
    if (!heads.length) return;
    const c = chromeBottom();
    for (const el of heads) {
      const top = el.getBoundingClientRect().top + (lifted.get(el) ?? 0);
      const prev = last.get(el) ?? 1;
      // 離得遠又已經是全不透明：不用動
      if (top > c + GAP + 120 && prev === 1) continue;
      const o = clamp((top - (c - FADE + GAP)) / FADE);
      if (o === prev) continue;
      last.set(el, o);
      const lift = o >= 0.999 || story.motionOff ? 0 : (1 - o) * LIFT;
      lifted.set(el, lift);
      el.style.opacity = o >= 0.999 ? '' : o.toFixed(3);
      el.style.transform = lift ? `translateY(${(-lift).toFixed(1)}px)` : '';
    }
  }

  return { update };
}
