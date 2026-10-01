import VERSES from '../data/verses.json';
import type { Fact, Ref, Status, Voice } from '../data/types';
import { esc, h, svg } from './dom';
import { EV_ICON, ICONS } from './icons';
import { STATUS_HELP, STATUS_LABEL } from './meta';

const verses = VERSES as Record<string, string>;
const BOOK_NAME: Record<string, string> = { 利: '利未記', 出: '出埃及記' };

export function badge(status: Status): HTMLElement {
  const el = h('span', { class: `ev ${status}`, title: STATUS_HELP[status], tabindex: 0, role: 'note' });
  el.innerHTML = EV_ICON[status] + esc(STATUS_LABEL[status]);
  return el;
}

/** 把 `利1:3-9` 展開成逐節 key */
export function expandRef(ref: Ref): string[] {
  const m = /^(利|出)(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) return [];
  const [, b, c, a, z] = m;
  const out: string[] = [];
  for (let v = +a; v <= +(z ?? a); v++) out.push(`${b}${c}:${v}`);
  return out;
}

export function refChip(ref: Ref, q?: string): HTMLElement {
  return h('button', {
    class: 'ref', type: 'button', 'aria-label': `看經文 ${ref}`,
    onclick: (e: Event) => openVerses(e.currentTarget as HTMLElement, [ref], q),
  }, ref);
}

export function refChips(refs: Ref[] = [], q?: string): HTMLElement[] {
  return refs.map((r) => refChip(r, q));
}

/** 只有不是「經文明說」的才掛標籤；沒有標籤＝經文直接這樣寫 */
export function quietBadge(status: Status): HTMLElement | null {
  return status === 'explicit' ? null : badge(status);
}

/** 一行事實：文字＋（必要時的）證據標籤＋經節 */
export function factLine(fact: Fact, opts: { showQuote?: boolean } = {}): HTMLElement {
  const b = quietBadge(fact.status);
  const el = h('span', { class: 'fact' }, fact.text, ' ', b, b ? ' ' : null, ...refChips(fact.refs, fact.q));
  if (opts.showQuote && fact.q) el.append(h('span', { class: 'q', style: 'display:block;font-size:.92em;margin-top:2px' }, fact.q));
  if (fact.note) el.append(h('span', { style: 'display:block;font-size:.82em;color:var(--ink-3)' }, fact.note));
  return el;
}

export function voiceBlock(v: Voice): HTMLElement {
  return h('div', { class: 'voice interp-layer' },
    h('div', { class: 'who' }, v.who),
    h('div', { class: 'says' }, v.says),
    v.quote && v.who !== '原文' ? h('span', { class: 'quote q' }, v.quote) : null,
  );
}

export function interpHeading(): HTMLElement {
  return h('div', { class: 'interp-layer', style: 'display:flex;align-items:center;gap:6px;margin-top:10px;font-size:.85em;font-weight:700;color:var(--ev-interp)' },
    badge('interpretation'), '註釋家怎麼讀（本庫利未記主檔整理）');
}

/* ------------------------------------------------------------ popover */

let pop: HTMLElement | null = null;
let popFrom: HTMLElement | null = null;

function closePop() {
  pop?.remove();
  pop = null;
  popFrom?.focus();
  popFrom = null;
}

export function openVerses(anchor: HTMLElement, refs: Ref[], q?: string) {
  closePop();
  popFrom = anchor;
  const keys = refs.flatMap(expandRef);
  const book = refs[0]?.startsWith('出') ? '出' : '利';
  const body = h('div');
  let found = false;
  for (const k of keys) {
    const text = verses[k];
    if (!text) continue;
    const vno = k.split(':')[1];
    const p = h('p', { class: 'v' });
    let html = esc(text);
    if (q && text.includes(q)) {
      html = html.split(esc(q)).join(`<mark>${esc(q)}</mark>`);
      found = true;
    }
    p.innerHTML = `<sup>${vno}</sup>${html}`;
    body.append(p);
  }
  if (q && !found && keys.length > 1) {
    // 摘句跨越兩節時，改在合併的文字裡標出
    const joined = keys.map((k) => verses[k] ?? '').join('');
    if (joined.includes(q)) body.append(h('p', { class: 'src' }, '（摘句跨越上面兩節）'));
  }
  const close = h('button', { class: 'close', type: 'button', 'aria-label': '關閉', onclick: closePop });
  close.append(svg(ICONS.x));
  (close.firstChild as SVGElement).setAttribute('width', '18');
  pop = h('div', { class: 'pop fade-in', role: 'dialog', 'aria-label': `經文 ${refs.join('、')}` },
    h('h4', null, `${BOOK_NAME[book]} ${refs.join('、').replace(/[利出]/g, '')}`, close),
    body,
  );
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  let left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12);
  let top = r.bottom + 8;
  if (top + ph > innerHeight - 12) top = r.top - ph - 8;
  // 上下都放不下：貼著畫面，不超出
  if (top < 12) top = Math.max(12, innerHeight - ph - 12);
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  close.focus();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && pop) closePop();
});
document.addEventListener('pointerdown', (e) => {
  if (pop && !pop.contains(e.target as Node) && !(e.target as HTMLElement).closest?.('.ref')) closePop();
});
addEventListener('scroll', () => pop && closePop(), { passive: true });
