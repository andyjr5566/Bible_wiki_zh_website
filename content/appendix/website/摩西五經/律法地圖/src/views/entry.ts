import { books, cooccurring, DB, entryHref, lawsOfEntry } from '../data/db';
import { type Route } from '../router';
import { entryChip, lawCard, TYPE_PLAIN, typeKey } from '../ui/cards';
import { ext, h } from '../ui/dom';
import { egoGraph } from '../ui/graph';
import { setRibbonBase } from '../ui/ribbon';

/**
 * 人物、地方與觀念：條目本身只給名稱、類型、一句簡介和連結；
 * 主體是知識庫沒有的東西——五經律法裡哪些條文提到它。
 */
export function entryView(route: Route): HTMLElement {
  const title = route.params[0];
  const info = DB.entries[title];
  if (!info) return h('div', { class: 'lm-page' }, h('h1', null, title), h('p', null, '這裡收的律法沒有提到這個條目。'), h('a', { href: '#/' }, '回首頁'));
  const ls = lawsOfEntry(title);
  setRibbonBase(ls.map((l) => l.id));
  const co = cooccurring(title);
  return h('div', { class: `lm-page lm-entry-page lm-t-${typeKey(title)}` },
    h('header', { class: 'lm-page-head' },
      h('div', { class: 'lm-kicker' }, TYPE_PLAIN[info.type] ?? info.type),
      h('h1', null, title),
      info.gist ? h('p', { class: 'lm-lede' }, info.gist) : null,
      h('p', null, ext(entryHref(title), '查看完整條目（另開網頁）'))),
    h('h2', null, `提到它的律法（${ls.length} 條）`),
    ...books.filter((b) => ls.some((l) => l.book === b.name)).map((b) => h('section', { class: 'lm-bybook' }, h('h3', null, b.name),
      h('div', { class: 'lm-cards' }, ...ls.filter((l) => l.book === b.name).map((l) => lawCard(l))))),
    co.length
      ? h('section', null, h('h2', null, '在這些律法裡常一起出現的'), h('div', { class: 'lm-chips' }, ...co.map(([e, n]) => entryChip(e, `${e}（${n}）`))))
      : null,
    h('details', { class: 'lm-sub' }, h('summary', null, '關係圖'), egoGraph('entry', title, title)));
}
