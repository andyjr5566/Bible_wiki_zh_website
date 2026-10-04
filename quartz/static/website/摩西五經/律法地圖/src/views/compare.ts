import { lawById, lawVerses, refText, relationBetween, relationSentence } from '../data/db';
import type { Law } from '../data/types';
import { charDiff, similarity } from '../lib/diff';
import { href, type Route } from '../router';
import { evidenceLine, groupColor, scripture, whyBlock } from '../ui/cards';
import { h } from '../ui/dom';
import { setRibbonBase } from '../ui/ribbon';

/** 並排：2–4 段經文。差在哪裡的完整說明在知識庫的互文條目，這裡只放關係、出處和逐字比較。 */
export function compareView(route: Route): HTMLElement {
  const ls = (route.params[0] ?? '').split(',').map((id) => lawById.get(id)).filter((l): l is Law => !!l).slice(0, 4);
  if (ls.length < 2) {
    return h('div', { class: 'lm-page' }, h('h1', null, '並排看'),
      h('p', null, '在條文頁打開「別卷」那一層，按「這幾段並排」，就會來到這裡。'));
  }
  setRibbonBase(ls.map((l) => l.id));
  const text = (l: Law) => lawVerses(l).map((v) => v.text).join('');
  const pairs: [Law, Law][] = [];
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) pairs.push([ls[i], ls[j]]);
  const rels = pairs.map(([a, b]) => ({ a, b, rel: relationBetween(a.id, b.id) })).filter((x) => x.rel);

  return h('div', { class: 'lm-page lm-compare-page' },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' }, h('a', { href: '#/' }, '首頁'), h('a', { href: href('law', ls[0].id) }, ls[0].title)),
    h('h1', null, ls.map((l) => refText(l)).join('　')),
    h('div', { class: 'lm-compare-cols', style: `--n: ${ls.length}` }, ...ls.map((l) => h('section', { class: 'lm-compare-col', style: `--c: ${groupColor(l)}`, 'data-laws': l.id },
      h('h2', null, h('a', { href: href('law', l.id) }, l.title), h('small', null, refText(l))),
      h('p', { class: 'lm-other-sum' }, l.summary),
      whyBlock(l),
      scripture(l)))),
    rels.length
      ? h('section', null, h('h2', null, '這幾段的關係'),
        h('ul', { class: 'lm-plain-list' }, ...rels.map(({ rel }) => h('li', null, `${relationSentence(rel!)}。`, evidenceLine(rel!.evidence)))))
      : h('p', { class: 'lm-note' }, '這幾段之間目前沒有找到出處說明它們的關係，可能只是主題相同。'),
    ...ls.slice(1).map((l, i) => h('details', { class: 'lm-sub', open: i === 0 },
      h('summary', null, `逐字比較 ${refText(ls[i])} 和 ${refText(l)}`), diffBlock(ls[i], l, text))));
}

function diffBlock(a: Law, b: Law, text: (l: Law) => string): HTMLElement {
  const parts = charDiff(text(a), text(b));
  return h('div', null,
    h('p', { class: 'lm-note' }, `刪除線是只在 ${refText(a)} 的字，底色是只在 ${refText(b)} 的字。只比字面，不判斷意思；相同的字約佔 ${Math.round(similarity(parts) * 100)}%。`),
    h('p', { class: 'lm-diff' }, ...parts.map((p) => (p.kind === 'same' ? p.text : h(p.kind === 'a' ? 'del' : 'ins', null, p.text)))));
}
