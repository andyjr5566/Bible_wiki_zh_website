/**
 * 開啟網頁時的載入畫面（index.html 內嵌的 #jos-loading）。
 * 進度照實際下載算：字體、經文、山谷地形、景物與人物圖、模型，最後是 3D 畫面畫出第一格。
 * 進度條只往前、平順地動；全部好了才淡出，最多等 12 秒就直接進入，不會擋住網頁。
 */
type Part = 'font' | 'data' | 'assets' | 'terrain' | 'frame';

const WEIGHTS: Record<Part, number> = { font: 0.1, data: 0.25, assets: 0.45, terrain: 0.12, frame: 0.08 };
const MAX_WAIT_MS = 12_000;

export interface LoadingProgress {
  set(part: Part, value: number): void;
  finish(): void;
}

export function createLoadingProgress(): LoadingProgress {
  const el = document.getElementById('jos-loading');
  if (!el) return { set() {}, finish() {} };
  const bar = el.querySelector<HTMLElement>('.jos-loading-bar i');
  const pct = el.querySelector<HTMLElement>('.jos-loading-pct');
  const label = el.querySelector<HTMLElement>('.jos-loading-label');
  const stone = el.querySelector<SVGGElement>('.jos-loading-stone');
  const values: Record<Part, number> = { font: 0, data: 0, assets: 0, terrain: 0, frame: 0 };
  let shown = 0;
  let finished = false;
  let removed = false;
  el.classList.remove('jos-loading-indeterminate');

  const target = () => (Object.keys(WEIGHTS) as Part[]).reduce((sum, k) => sum + WEIGHTS[k] * values[k], 0);
  // 說明文字跟著畫面上顯示的百分比走，避免數字還小卻寫「即將開始」
  const stage = (shownValue: number) =>
    shownValue < 0.3 ? '正在讀取經文' : shownValue < 0.9 ? '正在準備示劍山谷' : '即將開始';
  // 壓縮傳輸時量不到經文下載的百分比：還沒收到真實進度的階段慢慢往前估（最多到 85%），真實數字一到就以它為準
  let lastFrame = performance.now();
  function creep(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - lastFrame) / 1000);
    lastFrame = now;
    const current: Part[] = values.data < 1 || values.font < 1 ? ['data', 'font'] : ['assets', 'terrain'];
    for (const part of current) if (values[part] < 0.85) values[part] = Math.min(0.85, values[part] + dt * 0.18);
  }

  function render(): void {
    if (removed) return;
    if (!finished) creep();
    const goal = finished ? 1 : Math.min(0.99, target());
    shown = Math.max(shown, shown + (goal - shown) * 0.12);
    if (goal - shown < 0.002) shown = goal;
    const percent = Math.round(shown * 100);
    if (bar) bar.style.transform = `scaleX(${shown})`;
    if (pct) pct.textContent = `${percent}%`;
    if (label) label.textContent = stage(shown);
    // 一塊大石頭隨進度從平躺立起來，呼應第26節立石
    if (stone) stone.setAttribute('transform', `rotate(${-90 + 90 * shown} 50 86)`);
    el!.setAttribute('aria-valuenow', String(percent));
    if (finished && shown >= 0.999) {
      el!.classList.add('jos-loading-done');
      removed = true;
      window.setTimeout(() => el!.remove(), 700);
      return;
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);

  const api: LoadingProgress = {
    set(part, value) {
      values[part] = Math.max(values[part], Math.min(1, value));
      if ((Object.keys(values) as Part[]).every(k => values[k] >= 1)) api.finish();
    },
    finish() {
      finished = true;
    },
  };
  window.setTimeout(() => api.finish(), MAX_WAIT_MS);
  return api;
}
