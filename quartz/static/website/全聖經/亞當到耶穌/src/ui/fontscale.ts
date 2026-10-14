// 字體大小：四段比例，存在瀏覽器裡，所有文字用 CSS 變數 --ag-fs 換算
export const FONT_SCALES = [1, 1.15, 1.3, 1.5] as const;
export const FONT_SCALE_EVENT = 'ag-fontscale';
const STORAGE_KEY = 'adam-jesus:fontscale';

const readSaved = (): number => {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY));
    return (FONT_SCALES as readonly number[]).includes(value) ? value : 1;
  } catch {
    return 1;
  }
};

const apply = (scale: number) => {
  const root = document.documentElement;
  root.dataset.fs = String(scale);
  root.style.setProperty('--ag-fs', String(scale));
};

export function getFontScale(): number {
  return Number(document.documentElement.dataset.fs) || 1;
}

export function setFontScale(scale: number): void {
  if (!(FONT_SCALES as readonly number[]).includes(scale) || scale === getFontScale()) return;
  apply(scale);
  try { localStorage.setItem(STORAGE_KEY, String(scale)); } catch { /* 瀏覽器不允許儲存時仍可操作 */ }
  window.dispatchEvent(new Event(FONT_SCALE_EVENT));
}

apply(readSaved());
