import SIL from '../data/silhouettes.json';
import { h } from './dom';

interface SilData { name: string; svg: string; attribution: string; license: string; page: string }
export const SILHOUETTES = SIL as Record<string, SilData>;

/** 這幾張原圖面向左，翻過來讓全部朝右 */
const FLIP = new Set<string>([]);

/** PhyloPic 剪影：用 currentColor 上色 */
export function sil(id: string, cls = ''): HTMLElement {
  const d = SILHOUETTES[id];
  const el = h('span', { class: `sil ${cls}${FLIP.has(id) ? ' flip' : ''}`, 'aria-hidden': 'true' });
  if (!d) return el;
  el.innerHTML = d.svg.replace(/<!DOCTYPE[^>]*>/i, '').replace(/\s(width|height)="[^"]*"/g, '');
  return el;
}

export const LICENSE_NAME = (url: string) =>
  /zero/.test(url) ? 'CC0 1.0' : /mark/.test(url) ? '公眾領域標章' : /by\/4/.test(url) ? 'CC BY 4.0' : /by\/3/.test(url) ? 'CC BY 3.0' : url;
