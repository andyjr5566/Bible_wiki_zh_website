/**
 * 手機瀏覽器捲動時網址列會伸縮，innerHeight 跟著每幀變動；畫布是固定的 100vh（最大視窗），
 * 所有跟畫面高度有關的計算都改用這個不隨網址列變動的高度，字框、泡泡與場景才不會一起抖。
 */
let probe: HTMLElement | null = null;
let height = 0;

function measure(): number {
  if (typeof document === 'undefined' || !document.body) return window.innerHeight;
  if (!probe) {
    probe = document.createElement('div');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;visibility:hidden;pointer-events:none;';
    document.body.appendChild(probe);
  }
  return probe.offsetHeight || window.innerHeight;
}

/** 視窗改變（旋轉、縮放）時重新量；網址列伸縮不會改變這個值。 */
export function refreshViewportHeight(): number {
  height = Math.max(1, measure());
  return height;
}

export function viewportHeight(): number {
  return height || refreshViewportHeight();
}
