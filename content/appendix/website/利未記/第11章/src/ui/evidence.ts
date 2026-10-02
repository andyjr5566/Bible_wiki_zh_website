import VERSES from '../data/verses.json';
import type { Fact, Ref, Status, Voice } from '../data/types';
import { esc, h, svg } from './dom';
import { EV_ICON, ICONS } from './icons';
import { STATUS_HELP, STATUS_LABEL } from './meta';

const verses = VERSES as Record<string, string>;
export const BOOK_NAME: Record<string, string> = {
  利: '利未記', 出: '出埃及記', 民: '民數記', 申: '申命記', 太: '馬太福音', 可: '馬可福音', 路: '路加福音', 約: '約翰福音', 來: '希伯來書',
};
const REF_RE = /^(利|出|民|申|太|可|路|約|來)(\d+):(\d+)(?:-(\d+))?$/;

export function badge(status: Status): HTMLElement {
  const el = h('span', { class: `ev ${status}`, title: STATUS_HELP[status], tabindex: 0, role: 'note' });
  el.innerHTML = EV_ICON[status] + esc(STATUS_LABEL[status]);
  return el;
}

/** 把 `利11:3-9` 展開成逐節 key */
export function expandRef(ref: Ref): string[] {
  const m = REF_RE.exec(ref);
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
export function factLine(fact: Fact, opts: { quote?: boolean } = {}): HTMLElement {
  const b = quietBadge(fact.status);
  const el = h('span', { class: 'fact' }, fact.text, ' ', b, b ? ' ' : null, ...refChips(fact.refs, fact.q));
  if (opts.quote && fact.q) el.append(h('span', { class: 'q fact-q' }, fact.q));
  if (fact.note) el.append(h('span', { class: 'fact-note' }, fact.note));
  return el;
}

/** 經文摘句當主角：大字摘句＋出處 */
export function quoteLine(fact: Fact): HTMLElement {
  return h('span', { class: 'quote-line' },
    fact.q ? h('span', { class: 'q' }, fact.q) : fact.text, ' ', ...refChips(fact.refs, fact.q), ' ', quietBadge(fact.status));
}

export function voiceBlock(v: Voice): HTMLElement {
  return h('div', { class: 'voice' },
    h('div', { class: 'who' }, v.who),
    h('div', { class: 'says' }, v.says),
    v.quote ? h('span', { class: 'quote q' }, v.quote) : null);
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
  const books = new Set(keys.map((k) => k[0]));
  const chapters = new Set(keys.map((k) => k.split(':')[0]));
  const body = h('div');
  let found = false;
  for (const k of keys) {
    const text = verses[k];
    if (!text) continue;
    const [bc, vno] = k.split(':');
    const p = h('p', { class: 'v' });
    let html = esc(text);
    if (q && text.includes(q)) {
      html = html.split(esc(q)).join(`<mark>${esc(q)}</mark>`);
      found = true;
    }
    const label = chapters.size > 1 ? `${books.size > 1 ? bc : bc.slice(1)}:${vno}` : vno;
    p.innerHTML = `<sup>${esc(label)}</sup>${html}`;
    body.append(p);
  }
  if (q && !found && keys.length > 1) {
    const joined = keys.map((k) => verses[k] ?? '').join('');
    if (joined.includes(q)) body.append(h('p', { class: 'src' }, '（摘句跨越上面兩節）'));
  }
  const close = h('button', { class: 'close', type: 'button', 'aria-label': '關閉', onclick: closePop });
  close.append(svg(ICONS.x));
  (close.firstChild as SVGElement).setAttribute('width', '18');
  const title = books.size === 1
    ? `${BOOK_NAME[[...books][0]]} ${refs.map((r) => r.slice(1)).join('、')}`
    : refs.join('、');
  pop = h('div', { class: 'pop fade-in', role: 'dialog', 'aria-label': `經文 ${refs.join('、')}` },
    h('h4', null, title, close),
    body,
  );
  document.body.append(pop);
  const r = anchor.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const left = Math.min(Math.max(12, r.left + r.width / 2 - pw / 2), innerWidth - pw - 12);
  let top = r.bottom + 8;
  if (top + ph > innerHeight - 12) top = r.top - ph - 8;
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
