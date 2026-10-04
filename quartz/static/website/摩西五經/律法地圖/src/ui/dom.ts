// 小型 DOM 建構器（與民數記 33 章網站同一套寫法）
export type Child = Node | string | number | null | undefined | false | Child[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: any) => void)>;

/** h('div', {class: 'x', onclick: fn}, child...) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

export function fill(el: Element, ...children: Child[]) {
  el.replaceChildren();
  append(el, children);
}

export function append(el: Element, children: Child[]) {
  for (const c of children.flat(Infinity as 1) as Child[]) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number | undefined | null> = {}, ...children: (Node | string | null | undefined)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  for (const c of children) if (c !== null && c !== undefined) el.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return el;
}

/** 外部連結：一律另開分頁 */
export const ext = (href: string, ...children: Child[]) => h('a', { href, target: '_blank', rel: 'noopener', class: 'lm-ext' }, ...children);
