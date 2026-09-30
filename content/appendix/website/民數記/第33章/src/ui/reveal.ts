import { h, svg } from './dom';
import { ICONS } from './icons';
import { smoothScrollTo } from './motion';

/**
 * 頁面捲動只在使用者明確要求時發生：
 *  - 「到地圖看」（peek 小卡上的按鈕）→ goToMap：捲到地圖，並在畫面下方留一顆「回到剛才讀的地方」，
 *    按一下就回到原來的位置，繼續往下讀。
 *  - 打開帶站號的網址（#s12、#play）→ revealMap：一進來就帶到地圖。
 * 選一站、點地名、播放，都不會移動頁面。
 */
export function revealMap() {
  const el = document.getElementById('journey');
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (r.top > innerHeight * 0.5 || r.bottom < 200) smoothScrollTo(r.top + scrollY - 64, 600);
}

let pill: HTMLElement | null = null;
let origin = 0;
let onScroll: (() => void) | null = null;

function hidePill() {
  pill?.remove();
  pill = null;
  if (onScroll) removeEventListener('scroll', onScroll);
  onScroll = null;
}

/** 捲到地圖區，並留一個路標可以回到現在的位置 */
export function goToMap() {
  const el = document.getElementById('journey');
  if (!el) return;
  hidePill();
  origin = scrollY;
  const r = el.getBoundingClientRect();
  const to = r.top + scrollY - 64;
  // 已經在地圖附近就不用移動，也不用路標
  if (Math.abs(to - scrollY) < 160) return;
  smoothScrollTo(to, 600);

  pill = h('button', { class: 'return-pill', type: 'button', 'aria-label': '回到剛才讀的地方', onclick: () => {
    const back = origin;
    hidePill();
    smoothScrollTo(back, 600);
  } }, svg(ICONS.chev), '回到剛才讀的地方');
  document.body.append(pill);
  // 使用者自己捲回原位附近，路標就完成任務了
  setTimeout(() => {
    onScroll = () => { if (Math.abs(scrollY - origin) < 120) hidePill(); };
    addEventListener('scroll', onScroll, { passive: true });
  }, 900);
}
