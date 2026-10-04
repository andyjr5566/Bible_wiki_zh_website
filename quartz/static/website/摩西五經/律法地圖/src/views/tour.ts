import { DB, lawById, refText, relationBetween, relationSentence } from '../data/db';
import { href, type Route } from '../router';
import { evidenceLine, glossText, groupColor, scripture, whyBlock } from '../ui/cards';
import { h } from '../ui/dom';
import { setRibbonBase } from '../ui/ribbon';

/** 照順序讀：一段一條律法。段與段的關係直接用 relations.yaml 的關聯與出處，不另寫。 */
export function tourView(route: Route): HTMLElement {
  const tour = DB.tours.find((t) => t.id === route.params[0]);
  if (!tour) return h('div', { class: 'lm-page' }, h('h1', null, '找不到這條路線'), h('a', { href: '#/' }, '回首頁'));
  const i = Math.min(Math.max(Number(route.params[1] ?? 0) || 0, 0), tour.stops.length - 1);
  const l = lawById.get(tour.stops[i])!;
  const prev = i > 0 ? lawById.get(tour.stops[i - 1]) : undefined;
  const rel = prev ? relationBetween(prev.id, l.id) : undefined;
  const last = i === tour.stops.length - 1;
  setRibbonBase(tour.stops, `${refText(l).split(':')[0]}`);

  return h('div', { class: 'lm-page lm-tour-page' },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' }, h('a', { href: '#/' }, '首頁')),
    h('header', { class: 'lm-page-head' },
      h('h1', null, tour.title),
      i === 0 ? h('p', { class: 'lm-lede' }, ...glossText(tour.intro)) : null,
      h('ol', { class: 'lm-steps', 'aria-label': '第幾段' }, ...tour.stops.map((id, k) => h('li', { 'aria-current': k === i ? 'step' : null },
        h('a', { href: href('tour', tour.id, k), 'data-laws': id }, refText(lawById.get(id)!)))))),
    h('article', { class: 'lm-stop', style: `--c: ${groupColor(l)}` },
      h('div', { class: 'lm-stop-n' }, `第 ${i + 1} 段，共 ${tour.stops.length} 段`),
      h('h2', null, l.title, h('small', null, refText(l))),
      rel && prev ? h('div', { class: 'lm-stop-rel' }, `${relationSentence(rel)}。`, evidenceLine(rel.evidence, false)) : null,
      h('p', { class: 'lm-say' }, ...glossText(l.summary)),
      whyBlock(l),
      scripture(l),
      h('p', null, h('a', { href: href('law', l.id) }, '這一條的出處與相關條目 →'))),
    h('nav', { class: 'lm-tour-nav' },
      i > 0 ? h('a', { class: 'lm-btn', href: href('tour', tour.id, i - 1) }, '← 上一段') : h('span'),
      last
        ? h('a', { class: 'lm-btn lm-btn-primary', href: href('compare', tour.stops.join(',')) }, '幾段並排看 →')
        : h('a', { class: 'lm-btn lm-btn-primary', href: href('tour', tour.id, i + 1) }, '下一段 →')));
}
