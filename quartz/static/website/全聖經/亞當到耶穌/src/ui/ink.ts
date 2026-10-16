import { svgEl } from './dom';

/**
 * 讀經模式的水墨效果：墨線（筆刷邊緣、由父畫到子）、朱印（職稱）、墨暈（正在讀的名字）。
 * 這裡只做圖形；位置由畫布算好傳進來。
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
let defsReady = false;

/** 筆刷邊緣與印泥質感的濾鏡，整張畫布只建一次。 */
export function ensureInkDefs(svg: SVGSVGElement): void {
  if (defsReady && svg.querySelector('#ag-rd-brush')) return;
  defsReady = true;
  const defs = svgEl('defs', {});
  // 墨線：細小的亂紋讓邊緣不規則，像毛筆在紙上拖過
  const brush = svgEl('filter', { id: 'ag-rd-brush', x: '-20%', y: '-20%', width: '140%', height: '140%' });
  brush.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.9', numOctaves: '2', seed: '7', result: 'grain' }),
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'grain', scale: '2.6', xChannelSelector: 'R', yChannelSelector: 'G', result: 'rough' }),
    svgEl('feGaussianBlur', { in: 'rough', stdDeviation: '0.25' }),
  );
  // 墨暈：往外化開的淡墨
  const bleed = svgEl('filter', { id: 'ag-rd-bleed', x: '-60%', y: '-60%', width: '220%', height: '220%' });
  bleed.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '0.035', numOctaves: '3', seed: '3', result: 'cloud' }),
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'cloud', scale: '14', xChannelSelector: 'R', yChannelSelector: 'G', result: 'spread' }),
    svgEl('feGaussianBlur', { in: 'spread', stdDeviation: '5' }),
  );
  // 朱印：印泥不均勻，邊角有缺
  const seal = svgEl('filter', { id: 'ag-rd-seal', x: '-10%', y: '-10%', width: '120%', height: '120%' });
  seal.append(
    svgEl('feTurbulence', { type: 'fractalNoise', baseFrequency: '1.4', numOctaves: '1', seed: '11', result: 'speck' }),
    svgEl('feColorMatrix', { in: 'speck', type: 'matrix', values: '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 1.5', result: 'holes' }),
    svgEl('feComposite', { in: 'SourceGraphic', in2: 'holes', operator: 'in', result: 'inked' }),
    svgEl('feDisplacementMap', { in: 'inked', in2: 'speck', scale: '0.7', xChannelSelector: 'R', yChannelSelector: 'G' }),
  );
  defs.append(brush, bleed, seal);
  svg.prepend(defs);
}

/** 一條墨線：底下一道淡墨暈，上面一道主筆；animate 時由起點畫到終點。 */
export function inkStroke(d: string, animate: boolean, delay = 0): SVGGElement {
  const group = svgEl('g', { class: 'ag-rd-ink' });
  const wash = svgEl('path', { d, class: 'ag-rd-ink-wash' });
  const line = svgEl('path', { d, class: 'ag-rd-ink-line', filter: 'url(#ag-rd-brush)' });
  group.append(wash, line);
  if (animate) {
    requestAnimationFrame(() => {
      for (const path of [wash, line]) {
        const length = Math.max(1, path.getTotalLength());
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        path.getBoundingClientRect();
        path.style.transition = `stroke-dashoffset 760ms cubic-bezier(.45,.05,.25,1) ${delay}ms`;
        path.style.strokeDashoffset = '0';
      }
    });
  }
  return group;
}

/** 朱印：兩個字以內一行直寫，三、四個字兩行直寫，更長就橫寫。印放在 (x, y) 的左上角。 */
export function sealMark(label: string, x: number, y: number, animate: boolean): SVGGElement {
  const chars = Array.from(label);
  const size = 19;
  let columns: string[][];
  if (chars.length <= 2) columns = [chars];
  else if (chars.length <= 4) columns = [chars.slice(0, Math.ceil(chars.length / 2)), chars.slice(Math.ceil(chars.length / 2))];
  else columns = [];
  const group = svgEl('g', { class: 'ag-rd-seal', transform: `translate(${x} ${y}) rotate(-4)` });
  // 蓋印的動畫放在內層：外層的 transform 管位置，CSS 動畫的 transform 會蓋掉它
  const body = svgEl('g', { filter: 'url(#ag-rd-seal)', class: animate ? 'ag-rd-seal-stamp' : '' });
  if (columns.length) {
    const rows = Math.max(...columns.map((column) => column.length));
    const width = columns.length * size + 8;
    const height = rows * size + 8;
    body.append(svgEl('rect', { x: 0, y: 0, width, height, rx: 2.5, class: 'ag-rd-seal-ink' }));
    // 直寫由右往左排
    columns.forEach((column, index) => {
      column.forEach((char, row) => {
        const text = svgEl('text', {
          class: 'ag-rd-seal-text', x: width - 4 - size / 2 - index * size, y: 4 + size / 2 + row * size + (rows - column.length) * size / 2,
          'text-anchor': 'middle', 'dominant-baseline': 'central',
        });
        text.textContent = char;
        body.append(text);
      });
    });
  } else {
    const width = chars.length * 15 + 12;
    body.append(svgEl('rect', { x: 0, y: 0, width, height: 25, rx: 2.5, class: 'ag-rd-seal-ink' }));
    const text = svgEl('text', { class: 'ag-rd-seal-text ag-rd-seal-text-wide', x: width / 2, y: 12.5, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    text.textContent = label;
    body.append(text);
  }
  group.append(body);
  return group;
}

/** 正在讀的名字後面化開的一團墨暈。 */
export function inkHalo(x: number, y: number, rx: number, ry: number): SVGEllipseElement {
  const halo = document.createElementNS(SVG_NS, 'ellipse') as SVGEllipseElement;
  halo.setAttribute('class', 'ag-rd-halo');
  halo.setAttribute('cx', String(x));
  halo.setAttribute('cy', String(y));
  halo.setAttribute('rx', String(rx));
  halo.setAttribute('ry', String(ry));
  halo.setAttribute('filter', 'url(#ag-rd-bleed)');
  return halo;
}

// ── 家譜樹上的職位印（人物卡旁的小朱印）要用的幾何小工具 ─────────────

export interface SealRect { l: number; t: number; r: number; b: number }
export type SealSeg = [number, number, number, number];
export const ROLE_SEAL_H = 17;
export const ROLE_SEAL_GAP = 3;

/** 一枚職位印的寬度：每個字約 12 單位，加上左右邊 */
export const roleSealWidth = (label: string): number => Array.from(label).length * 12 + 10;

/** 好幾枚並排：一行放不下就換行（每行寬度不超過 maxWidth）。回傳每枚的相對位置和整組大小 */
export function roleSealRows(labels: string[], maxWidth: number): { items: Array<{ label: string; x: number; y: number; w: number }>; width: number; height: number } {
  const items: Array<{ label: string; x: number; y: number; w: number }> = [];
  let x = 0;
  let row = 0;
  let width = 0;
  for (const label of labels) {
    const w = roleSealWidth(label);
    if (x > 0 && x + w > maxWidth) { x = 0; row += 1; }
    items.push({ label, x, y: row * (ROLE_SEAL_H + 2), w });
    x += w + ROLE_SEAL_GAP;
    width = Math.max(width, x - ROLE_SEAL_GAP);
  }
  return { items, width, height: items.length ? (row + 1) * ROLE_SEAL_H + row * 2 : 0 };
}

/** 家譜連線的路徑（只有 M、H、V、L）拆成一段一段的線，用來判斷印會不會壓到線 */
export function pathSegments(d: string): SealSeg[] {
  const segments: SealSeg[] = [];
  const pattern = /([MHVL])\s*(-?[\d.]+)(?:[\s,]+(-?[\d.]+))?/g;
  let x = 0;
  let y = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(d))) {
    const command = match[1];
    const a = Number(match[2]);
    const b = match[3] === undefined ? Number.NaN : Number(match[3]);
    if (command === 'M') { x = a; y = b; continue; }
    const nx = command === 'V' ? x : a;
    const ny = command === 'H' ? y : command === 'V' ? a : b;
    if (Number.isFinite(nx) && Number.isFinite(ny)) segments.push([x, y, nx, ny]);
    x = nx;
    y = ny;
  }
  return segments;
}

/** 兩個矩形有沒有重疊（pad 是各邊多留的空隙） */
export function sealRectsOverlap(a: SealRect, b: SealRect, pad = 0): boolean {
  return a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
}

/** 一段線有沒有穿過矩形（Liang–Barsky） */
export function segmentHitsRect(segment: SealSeg, rect: SealRect, pad = 0): boolean {
  const [x0, y0, x1, y1] = segment;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const p = [-dx, dx, -dy, dy];
  const q = [x0 - (rect.l - pad), rect.r + pad - x0, y0 - (rect.t - pad), rect.b + pad - y0];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i += 1) {
    if (p[i] === 0) { if (q[i]! < 0) return false; continue; }
    const t = q[i]! / p[i]!;
    if (p[i]! < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; }
  }
  return true;
}
