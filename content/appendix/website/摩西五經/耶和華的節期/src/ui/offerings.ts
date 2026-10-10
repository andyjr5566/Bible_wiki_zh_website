/**
 * 獻祭清單：說明框經文下面，依 role 分組，每個祭牲一個名稱、一排刻線（五劃一組）和數字，後面接經文出處。
 * 名稱、數字、出處都取自 SITE.offerings（建置腳本從經文解析），這裡不寫死任何數字。
 */
import { SITE } from '../data/site';
import type { OfferingGroup } from '../data/types';
import { h, s } from './dom';

/** 刻線：每五個一組，前四劃直線、第五劃斜線劃掉 */
function tally(count: number): SVGElement {
  const sets = Math.ceil(count / 5);
  const W = sets * 26 - (sets > 0 ? 4 : 0);
  const kids: SVGElement[] = [];
  let left = count;
  for (let g = 0; g < sets; g++) {
    const n = Math.min(5, left);
    left -= n;
    const x0 = g * 26 + 2;
    const strokes = Math.min(4, n);
    for (let i = 0; i < strokes; i++) {
      kids.push(s('line', { x1: x0 + i * 5, y1: 2, x2: x0 + i * 5 + (i % 2 ? 0.4 : -0.3), y2: 16, class: 'jf-tally-line' }));
    }
    if (n === 5) kids.push(s('line', { x1: x0 - 3, y1: 14, x2: x0 + 19, y2: 4, class: 'jf-tally-line' }));
  }
  return s('svg', { class: 'jf-tally', viewBox: `0 0 ${W} 18`, width: W, height: 18, 'aria-hidden': 'true', focusable: 'false' }, ...kids);
}

/** 依 role 分組，組的順序照第一次出現 */
function byRole(group: OfferingGroup): { role: string; items: OfferingGroup['items'] }[] {
  const out: { role: string; items: OfferingGroup['items'] }[] = [];
  for (const it of group.items) {
    let g = out.find((x) => x.role === it.role);
    if (!g) {
      g = { role: it.role, items: [] };
      out.push(g);
    }
    g.items.push(it);
  }
  return out;
}

export function offeringList(refs: string[] | undefined, label?: string): HTMLElement | null {
  const groups = (refs ?? []).map((r) => SITE.offerings[r]).filter(Boolean);
  if (!groups.length) return null;
  return h('div', { class: 'jf-offer', 'data-n': groups.length },
    label ? h('p', { class: 'jf-offer-label' }, label) : null,
    groups.map((g) =>
      h('figure', { class: 'jf-offer-set' },
        byRole(g).map((r) =>
          h('div', { class: 'jf-offer-row' },
            r.role ? h('span', { class: 'jf-offer-role' }, r.role) : null,
            h('ul', { class: 'jf-offer-items' },
              r.items.map((it) =>
                h('li', { class: 'jf-offer-item' },
                  h('span', { class: 'jf-offer-name' }, it.animal),
                  tally(it.count),
                  h('span', { class: 'jf-offer-n' }, String(it.count))))))),
        h('figcaption', { class: 'jf-offer-ref' }, g.ref))));
}
