import { books, groupOfLaw, laws, lawsOfChapter } from '../data/db';
import type { Book } from '../data/types';
import { href } from '../router';
import { h } from './dom';

/**
 * 五經律法帶：五卷 187 章，一格一章；有律法的章長出一根柱子，一段一條律法，顏色是律法的大類。
 * - big：首頁用，一卷一列，五列用同一個格寬，看得出各卷長短。
 * - slim：其他頁面頂端的細帶，標出「現在在哪裡」，主題頁會亮出這個主題的律法。
 * 頁面上任何帶 data-laws="id id" 的元素，滑過或聚焦時，帶子上就亮出那幾條律法。
 */
const MAX_COLS = 50;

function cell(b: Book, c: number, slim: boolean): HTMLElement {
  const ls = lawsOfChapter(b.name, c);
  const key = `${b.abbr}${c}`;
  if (!ls.length) return h('span', { class: 'lm-rib-cell lm-rib-empty', 'data-k': key, title: `${b.abbr}${c}` });
  const bar = h('span', { class: 'lm-rib-bar', style: slim ? null : `--n: ${ls.length}` },
    ...ls.map((l) => h('span', { class: 'lm-rib-seg', 'data-law': l.id, style: `--c: var(--g${groupOfLaw(l)?.color ?? 0})` })));
  const label = `${b.name}第${c}章：${ls.map((l) => l.title).join('、')}`;
  return h('a', { class: 'lm-rib-cell', href: href('ref', key), 'data-k': key, 'data-laws': ls.map((l) => l.id).join(' '), title: label, 'aria-label': label }, bar);
}

export function ribbon(size: 'big' | 'slim'): HTMLElement {
  const slim = size === 'slim';
  const el = h('div', { class: `lm-rib lm-rib-${size}`, role: 'navigation', 'aria-label': '五經律法帶：一格一章' },
    ...books.map((b) => {
      const cells = Array.from({ length: b.chapters }, (_, i) => cell(b, i + 1, slim));
      if (slim) {
        return h('div', { class: 'lm-rib-book', style: `--ch: ${b.chapters}`, 'data-k': b.abbr },
          h('a', { class: 'lm-rib-name', href: href('book', b.abbr) }, b.abbr),
          h('div', { class: 'lm-rib-cells' }, ...cells));
      }
      const ticks = Array.from({ length: Math.floor(b.chapters / 10) }, (_, i) => h('span', { class: 'lm-rib-tick', style: `grid-column: ${(i + 1) * 10}` }, String((i + 1) * 10)));
      return h('div', { class: 'lm-rib-row', 'data-k': b.abbr },
        h('a', { class: 'lm-rib-name', href: href('book', b.abbr) }, b.name),
        h('div', { class: 'lm-rib-cells', style: `--cols: ${MAX_COLS}` }, ...cells, ...ticks));
    }));
  apply(base, [el]);
  return el;
}

// ---- 亮起與標記 ----
let base: Set<string> | null = null;
let mark: string | null = null;
/** 點了問題卡之後留著亮：離開滑鼠也不熄，直到換頁或再點一次 */
let pinned: Set<string> | null = null;

/** 這一頁的預設狀態：亮哪幾條律法（null＝全部照常）、標記哪一章或哪一卷 */
export function setRibbonBase(ids: string[] | null, markKey: string | null = null) {
  base = ids ? new Set(ids) : null;
  mark = markKey;
  pinned = null;
  apply(base);
}

/** 讓帶子一直亮出這幾條律法（null＝取消） */
export function pinRibbon(ids: string[] | null) {
  pinned = ids?.length ? new Set(ids) : null;
  hovering = null;
  apply(pinned ?? base);
}

function apply(on: Set<string> | null, ribs: Iterable<HTMLElement> = document.querySelectorAll<HTMLElement>('.lm-rib')) {
  for (const rib of ribs) {
    rib.classList.toggle('lm-rib-dim', !!on);
    for (const seg of rib.querySelectorAll<HTMLElement>('.lm-rib-seg')) seg.classList.toggle('lm-on', !!on && on.has(seg.dataset.law!));
    for (const c of rib.querySelectorAll<HTMLElement>('[data-k]')) c.classList.toggle('lm-here', c.dataset.k === mark);
  }
}

/** 滑過任何帶 data-laws 的東西，就亮出那幾條；離開時回到這一頁的預設 */
let hovering: Element | null = null;
function track(e: Event) {
  const t = (e.target as Element | null)?.closest?.('[data-laws]') ?? null;
  if (t === hovering) return;
  hovering = t;
  const ids = t?.getAttribute('data-laws')?.split(' ').filter(Boolean);
  apply(ids?.length ? new Set(ids) : pinned ?? base);
}
document.addEventListener('pointerover', track);
document.addEventListener('focusin', track);
document.addEventListener('pointerleave', () => { hovering = null; apply(pinned ?? base); });

/** 有收律法的章數，給首頁說明用 */
export const chaptersWithLaws = () => new Set(laws.map((l) => `${l.book}${l.chapter}`)).size;
