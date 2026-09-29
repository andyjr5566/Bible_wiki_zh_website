import VERSES from '../data/verses.json';
import type { Fact, Ref, Status, Voice } from '../data/types';
import { esc, h, svg } from './dom';
import { EV_ICON, ICONS } from './icons';
import { STATUS_HELP, STATUS_LABEL } from './meta';

const verses = VERSES as Record<string, string>;
const BOOK_NAME: Record<string, string> = { 創: '創世記', 民: '民數記', 書: '約書亞記' };

export function badge(status: Status): HTMLElement {
  const el = h('span', { class: `ev ${status}`, title: STATUS_HELP[status], tabindex: 0, role: 'note' });
  el.innerHTML = EV_ICON[status] + esc(STATUS_LABEL[status]);
  return el;
}

/** 把 `民10:5-6` 展開成逐節 key */
export function expandRef(ref: Ref): string[] {
  const m = /^(創|民|書)(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
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

/** 一行事實：文字＋證據標籤＋經節 */
export function factLine(fact: Fact, opts: { showQuote?: boolean } = {}): HTMLElement {
  const el = h('span', { class: 'fact' }, fact.text, ' ', badge(fact.status), ' ', ...refChips(fact.refs, fact.q));
  if (opts.showQuote && fact.q) el.append(h('span', { class: 'q', style: 'display:block;font-size:.92em;margin-top:2px' }, fact.q));
  if (fact.note) el.append(h('span', { style: 'display:block;font-size:.82em;color:var(--ink-3)' }, fact.note));
  return el;
}

export function voiceBlock(v: Voice): HTMLElement {
  return h('div', { class: 'voice interp-layer' },
    h('div', { class: 'who' }, v.who),
    h('div', { class: 'says' }, v.says),
    v.quote ? h('span', { class: 'quote q' }, v.quote) : null,
  );
}

export function interpHeading(): HTMLElement {
  return h('div', { class: 'interp-layer', style: 'display:flex;align-items:center;gap:6px;margin-top:10px;font-size:.85em;font-weight:700;color:var(--ev-interp)' },
    badge('interpretation'), '註釋家怎麼讀（本庫民數記主檔整理）');
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

/** `民10:5-6` → `民數記 10:5-6`；跨書時每個出處各自標書名 */
function refTitle(refs: Ref[]): string {
  return refs.map((r, i) => {
    const b = r[0];
    const prev = i > 0 ? refs[i - 1][0] : '';
    return b === prev ? r.slice(1) : `${BOOK_NAME[b] ?? b} ${r.slice(1)}`;
  }).join('、');
}

export function openVerses(anchor: HTMLElement, refs: Ref[], q?: string) {
  closePop();
  popFrom = anchor;
  const keys = refs.flatMap(expandRef);
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
    h('h4', null, refTitle(refs), close),
    body,
    h('div', { class: 'src' }, '和合本（取自本庫 raw_scripture）'),
  );
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12);
  let top = r.bottom + 8;
  if (top + ph > innerHeight - 12) top = Math.max(12, r.top - ph - 8);
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
