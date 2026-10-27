/**
 * 全站捲動的唯一入口。
 *
 * 觸控裝置（iPhone Safari 等）整頁捲動時，固定在畫面上的頂列、經文、泡泡由系統另外合成，
 * 主程式同時重畫 3D 與逐字浮現時會跟著一抖一抖（2026-10-27 使用者在 iPhone 上回報頂列與字一起抖）。
 * 觸控裝置改在專用捲動區（#jos-scroll）裡捲，網頁本身不動：固定圖層完全不參與捲動，網址列也不再伸縮。
 * 桌機維持整頁捲動。
 */
let container: HTMLElement | null = null;

/** 在掛上網站前呼叫：觸控裝置把 #app 包進專用捲動區 */
export function setupScroller(app: HTMLElement): void {
  const touch = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  if (!touch || container) return;
  container = document.createElement('div');
  container.id = 'jos-scroll';
  container.className = 'jos-scroll';
  app.parentElement!.insertBefore(container, app);
  container.append(app);
  document.documentElement.classList.add('jos-scroll-mode');
}

export function scrollY(): number {
  return container ? container.scrollTop : window.scrollY;
}

export function scrollToY(top: number, smooth = false): void {
  const behavior = (smooth ? 'smooth' : 'instant') as ScrollBehavior;
  if (container) container.scrollTo({ top, behavior });
  else window.scrollTo({ top, behavior });
}

/** 可捲動的最大距離 */
export function maxScrollY(): number {
  return container
    ? Math.max(1, container.scrollHeight - container.clientHeight)
    : Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
}

export function onScroll(handler: () => void): () => void {
  const target: HTMLElement | Window = container ?? window;
  target.addEventListener('scroll', handler, { passive: true });
  return () => target.removeEventListener('scroll', handler);
}

/** 給檢查工具（headless 截圖、量測）用：不論哪種捲動方式都能讀寫位置 */
export function exposeScrollForTools(): void {
  (window as unknown as { __josScroll: unknown }).__josScroll = {
    get y() { return scrollY(); },
    to(top: number) { scrollToY(top); },
    get container() { return Boolean(container); },
  };
}
