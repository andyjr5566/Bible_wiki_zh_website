import { bookByAbbr, chapterHref, DB, lawById } from '../data/db';
import type { Book, Section } from '../data/types';
import { href, type Route } from '../router';
import { lawCard } from '../ui/cards';
import { ext, h } from '../ui/dom';
import { setRibbonBase } from '../ui/ribbon';

/** #/book/出：依法典段落 → 章 → 律法段落 → 條文 */
export function bookView(route: Route): HTMLElement {
  const b = bookByAbbr.get(route.params[0]);
  if (!b) return notFound();
  setRibbonBase(DB.laws.filter((l) => l.book === b.name).map((l) => l.id), b.abbr);
  const groups = codesOf(b);
  return h('div', { class: 'lm-page lm-book-page' },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' }, h('a', { href: '#/' }, '首頁')),
    h('header', { class: 'lm-page-head' }, h('h1', null, b.name),
      h('p', { class: 'lm-lede' }, groups.length ? '這一卷收錄的律法，依全書目錄的段落和章排列。' : '這一卷還沒有收錄條文。')),
    groups.length ? h('div', { class: 'lm-book-tools' },
      h('button', { type: 'button', class: 'lm-btn', onclick: () => toggleAll(true) }, '全部展開'),
      h('button', { type: 'button', class: 'lm-btn', onclick: () => toggleAll(false) }, '全部收起')) : null,
    ...groups.map(({ title, sections }) => h('section', { class: 'lm-code' },
      title ? h('h2', null, title) : null,
      ...chapters(sections).map(([ch, secs]) => chapterBlock(b.abbr, ch, secs)))));
}

/** 一章一個可收合的區塊：先看到章號、條數和段落標題，要看條文再點開（原生 details，不換頁、不捲動） */
function chapterBlock(abbr: string, ch: number, secs: Section[]): HTMLElement {
  const n = secs.reduce((sum, s) => sum + s.laws.length, 0);
  return h('details', { class: 'lm-chapter' },
    h('summary', null,
      h('span', { class: 'lm-chapter-no' }, `第${ch}章`),
      h('span', { class: 'lm-chapter-n' }, `${n} 條`),
      h('span', { class: 'lm-chapter-secs' }, secs.map((s) => s.title).join('、'))),
    h('p', { class: 'lm-chapter-link' }, h('a', { href: href('ref', `${abbr}${ch}`) }, `只看第${ch}章 →`)),
    ...secs.map(sectionBlock));
}

function toggleAll(open: boolean) {
  document.querySelectorAll<HTMLDetailsElement>('.lm-book-page details.lm-chapter').forEach((d) => { d.open = open; });
}

/** #/ref/出21：從章節附錄連過來時落在這裡 */
export function refView(route: Route): HTMLElement {
  const m = /^(創|出|利|民|申)(\d+)$/.exec(route.params[0] ?? '');
  const b = m ? bookByAbbr.get(m[1]) : undefined;
  if (!m || !b) return notFound();
  const ch = Number(m[2]);
  const secs = DB.sections.filter((s) => s.book === b.name && s.chapter === ch);
  setRibbonBase(secs.flatMap((s) => s.laws), `${b.abbr}${ch}`);
  return h('div', { class: 'lm-page lm-book-page' },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' }, h('a', { href: '#/' }, '首頁'), h('a', { href: href('book', b.abbr) }, b.name)),
    h('h1', null, `${b.name}第${ch}章的律法`),
    secs.length ? secs.map(sectionBlock) : h('p', null, '這一章還沒有收錄律法。'),
    h('p', null, ext(chapterHref(b.name, ch), `讀${b.name}第${ch}章全文與本章整理（另開網頁）`)));
}

function sectionBlock(s: Section): HTMLElement {
  return h('section', { class: 'lm-section' }, h('h4', null, s.title, h('small', null, ` 第${s.from}-${s.to}節`)),
    h('div', { class: 'lm-cards' }, ...s.laws.map((id) => lawById.get(id)!).map((l) => lawCard(l))),
    s.laws.length ? null : h('p', { class: 'lm-muted' }, '還沒有整理成條文。'));
}

function codesOf(b: Book): { title: string | null; sections: Section[] }[] {
  const secs = DB.sections.filter((s) => s.book === b.name).sort((x, y) => x.chapter - y.chapter || x.from - y.from);
  const out: { title: string | null; sections: Section[] }[] = [];
  for (const s of secs) {
    const title = s.code ?? null;
    const last = out[out.length - 1];
    if (last && last.title === title) last.sections.push(s);
    else out.push({ title, sections: [s] });
  }
  return out;
}

function chapters(secs: Section[]): [number, Section[]][] {
  const m = new Map<number, Section[]>();
  for (const s of secs) m.set(s.chapter, [...(m.get(s.chapter) ?? []), s]);
  return [...m.entries()];
}

const notFound = () => h('div', { class: 'lm-page' }, h('h1', null, '找不到這一卷或這一章'), h('a', { href: '#/' }, '回首頁'));
