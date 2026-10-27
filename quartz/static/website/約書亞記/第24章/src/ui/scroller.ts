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

/**
 * 固定在畫面上的圖層（經文與泡泡、事奉線、教學列、小卡底幕……）不能留在捲動區裡：
 * iPhone Safari 捲動時會一格一格來回修正它們的位置，泡泡和「更多」每格上下跳 2px
 * （2026-10-28 使用者錄影；同一段錄影裡放在捲動區外的頂列標籤完全不動）。
 * 網站掛好後呼叫：把捲動區裡 position: fixed 的元件搬到捲動區後面，之後才加進來的也一樣。
 */
export function liftFixedLayers(): void {
  const box = container;
  if (!box) return;
  const lift = (el: Element) => {
    if (getComputedStyle(el).position !== 'fixed') return false;
    let anchor: Node = box;
    while (anchor.nextSibling && (anchor.nextSibling as HTMLElement).dataset?.josLifted) anchor = anchor.nextSibling;
    (el as HTMLElement).dataset.josLifted = '1';
    box.parentElement!.insertBefore(el, anchor.nextSibling);
    return true;
  };
  // 固定圖層都在前幾層（#app › 故事外框 › main › 圖層）；不往下查逐字的字，免得每個字都算一次樣式
  const MAX_DEPTH = 5;
  const depthOf = (el: Element) => {
    let d = 0;
    for (let p = el.parentElement; p && p !== box; p = p.parentElement) d++;
    return d;
  };
  const walk = (root: Element, depth: number) => {
    if (depth > MAX_DEPTH) return;
    for (const child of [...root.children]) if (!lift(child)) walk(child, depth + 1);
  };
  walk(box, 0);
  new MutationObserver(records => {
    for (const r of records) for (const n of r.addedNodes) {
      if (!(n instanceof Element) || !box.contains(n)) continue;
      const depth = depthOf(n);
      if (depth <= MAX_DEPTH && !lift(n)) walk(n, depth + 1);
    }
  }).observe(box, { childList: true, subtree: true });
}

/** 給檢查工具（headless 截圖、量測）用：不論哪種捲動方式都能讀寫位置 */
export function exposeScrollForTools(): void {
  (window as unknown as { __josScroll: unknown }).__josScroll = {
    get y() { return scrollY(); },
    to(top: number) { scrollToY(top); },
    get container() { return Boolean(container); },
  };
}
