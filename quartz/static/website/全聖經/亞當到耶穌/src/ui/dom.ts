export type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'className') el.className = String(value);
    else if (key === 'dataset' && typeof value === 'object') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    else if (key in el && !key.startsWith('aria-') && !key.startsWith('data-')) {
      try { (el as unknown as Record<string, unknown>)[key] = value; } catch { el.setAttribute(key, String(value)); }
    } else el.setAttribute(key, String(value));
  }
  el.append(...children.map(asNode).filter((item): item is Node => item !== null));
  return el;
}

function asNode(child: Child): Node | null {
  if (child === null || child === undefined || child === false) return null;
  if (child instanceof Node) return child;
  return document.createTextNode(String(child));
}

export function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | null | undefined> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) el.setAttribute(key, String(value));
  return el;
}

export function clear(el: Element): void {
  el.replaceChildren();
}

export function button(label: string, action: () => void, className = 'ag-button'): HTMLButtonElement {
  const el = h('button', { type: 'button', className }, label);
  el.addEventListener('click', action);
  return el;
}

export function linkButton(label: string, action: () => void): HTMLButtonElement {
  return button(label, action, 'ag-text-button');
}
