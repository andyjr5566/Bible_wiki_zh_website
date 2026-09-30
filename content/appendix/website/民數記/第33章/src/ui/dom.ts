type Child = Node | string | number | null | undefined | false | Child[];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: any) => void)> & {
  style?: string;
};

/** 小型 DOM 建構器：h('div', {class: 'x', onclick: fn}, child...) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null = null, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v as EventListener);
      else if (k === 'html') el.innerHTML = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  append(el, children);
  return el;
}

/** 清空後再放入子節點（可含 null） */
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

/** 由 SVG 字串建立元素 */
export function svg(markup: string, cls = ''): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = markup.trim();
  const el = t.content.firstElementChild as SVGSVGElement;
  if (cls) el.setAttribute('class', cls);
  el.setAttribute('aria-hidden', 'true');
  el.setAttribute('focusable', 'false');
  return el;
}

export const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export const motionOff = () =>
  document.documentElement.dataset.motion === 'off' || matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 只看頁面自己的「減少動態」開關。播放是使用者按了才有的動作（走動的人、鏡頭跟著走），
 * 不因作業系統的偏好而停用；裝飾性的動畫才用上面的 motionOff（含作業系統偏好）。
 */
export const animOff = () => document.documentElement.dataset.motion === 'off';

export const wait = (ms: number) => new Promise((r) => setTimeout(r, motionOff() ? 0 : ms));

/** 簡單的事件匯流排：跨區塊溝通（例如首頁選了動機→模擬器切換） */
type Handler = (detail: any) => void;
const bus = new Map<string, Set<Handler>>();
export const on = (name: string, fn: Handler) => {
  if (!bus.has(name)) bus.set(name, new Set());
  bus.get(name)!.add(fn);
};
export const emit = (name: string, detail?: unknown) => bus.get(name)?.forEach((fn) => fn(detail));
