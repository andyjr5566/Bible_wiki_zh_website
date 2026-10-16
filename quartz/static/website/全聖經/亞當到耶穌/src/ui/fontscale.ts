// 大小：一條滑桿，80%–200%，存在瀏覽器裡。
// 分頁內容（目錄、職位圖、名單、對照表……）整塊照比例放大（CSS 變數 --ag-zoom，版面跟著改欄數）；
// 標題列、讀經欄、人物卡、家譜樹畫布只放大文字（--ag-fs），最多 150%，以免擠壞固定高度的版面。
export const PAGE_SCALE_MIN = 0.8;
export const PAGE_SCALE_MAX = 2;
export const PAGE_SCALE_STEP = 0.05;
export const FONT_SCALE_MAX = 1.5;
/** 標題列（按鈕、分頁）一排要擠得下，字最多放大到 115% */
export const HEADER_SCALE_MAX = 1.15;
export const FONT_SCALE_EVENT = 'ag-fontscale';
const STORAGE_KEY = 'adam-jesus:fontscale';

/** 夾在範圍內、對齊 5% 一格 */
export function normalizeScale(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1;
  const clamped = Math.min(PAGE_SCALE_MAX, Math.max(PAGE_SCALE_MIN, value));
  return Math.round(clamped * 20) / 20;
}

/** 只放大文字的地方用的比例 */
export function fontScaleFor(page: number): number {
  return Math.min(FONT_SCALE_MAX, normalizeScale(page));
}

const readSaved = (): number => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw === null ? 1 : normalizeScale(Number(raw));
  } catch {
    return 1;
  }
};

const apply = (scale: number) => {
  const root = document.documentElement;
  const fs = fontScaleFor(scale);
  root.dataset.zoom = String(scale);
  root.dataset.fs = String(fs);
  root.style.setProperty('--ag-zoom', String(scale));
  root.style.setProperty('--ag-fs', String(fs));
  root.style.setProperty('--ag-fs-ui', String(Math.min(HEADER_SCALE_MAX, fs)));
};

/** 文字比例（標題列、讀經欄、家譜樹畫布） */
export function getFontScale(): number {
  return Number(document.documentElement.dataset.fs) || 1;
}

/** 滑桿的比例（分頁內容整塊放大） */
export function getPageScale(): number {
  return Number(document.documentElement.dataset.zoom) || 1;
}

export function setPageScale(value: number): void {
  const scale = normalizeScale(value);
  if (Math.abs(scale - getPageScale()) < 1e-6) return;
  apply(scale);
  try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch { /* 瀏覽器不允許儲存時仍可操作 */ }
  window.dispatchEvent(new Event(FONT_SCALE_EVENT));
}

apply(readSaved());
