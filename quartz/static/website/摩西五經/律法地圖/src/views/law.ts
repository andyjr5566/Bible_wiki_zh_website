import { abbrOf, bookByName, chapterHref, DB, entryHref, lawById, lawEntries, laws, refText, relationLabel, relationsOf, sectionOf, topicsOf } from '../data/db';
import type { Law } from '../data/types';
import { href, type Route } from '../router';
import { store, type Layer } from '../store';
import { entryChip, evidenceLine, glossText, groupColor, scripture, scripturePreview, topicChip, TYPE_PLAIN, whyBlock } from '../ui/cards';
import { ext, h, type Child } from '../ui/dom';
import { egoGraph } from '../ui/graph';
import { setRibbonBase } from '../ui/ribbon';

/**
 * 條文頁：同一個順序由淺到深，左邊一條線把四層串起來。
 *   一句話（永遠開著）→ 經文 → 別卷怎麼記 → 出處與相關條目
 * 每一層的收合列先預告裡面有什麼（經文開頭幾個字、別卷的出處、條目數），讀者自己決定往下打開幾層。
 */
export function lawView(route: Route): HTMLElement {
  const l = lawById.get(route.params[0]);
  if (!l) return h('div', { class: 'lm-page' }, h('h1', null, '找不到這條律法'), h('a', { href: '#/' }, '回首頁'));
  const sec = sectionOf(l);
  const book = bookByName.get(l.book)!;
  const rels = relationsOf(l.id);
  setRibbonBase([l.id, ...rels.map((r) => r.other.id)], `${book.abbr}${l.chapter}`);

  const layers = [
    layer('text', '經文', [h('span', { class: 'lm-ref' }, refText(l)), h('span', { class: 'lm-preview' }, `「${scripturePreview(l)}」`)], textLayer(l)),
    rels.length
      ? layer('others', '別卷', [h('span', null, rels.map((r) => refText(r.other)).join('、'), ' 也記了')], othersLayer(l))
      : h('div', { class: 'lm-layer lm-layer-none' }, h('div', { class: 'lm-layer-row' }, h('span', { class: 'lm-layer-name' }, '別卷'), h('span', { class: 'lm-muted' }, '目前沒有找到別卷記載這一條的出處'))),
    layer('sources', '出處', [h('span', null, sourcesSummary(l))], sourcesLayer(l)),
  ];
  const toggleAll = h('button', { type: 'button', class: 'lm-link-btn', onclick: () => {
    const ds = [...document.querySelectorAll<HTMLDetailsElement>('.lm-ladder details.lm-layer')];
    const open = ds.some((d) => !d.open);
    ds.forEach((d) => { d.open = open; });
    toggleAll.textContent = open ? '全部收起' : '全部打開';
  } }, '全部打開');

  return h('div', { class: 'lm-page lm-law-page', style: `--c: ${groupColor(l)}` },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' },
      h('a', { href: href('book', book.abbr) }, l.book),
      h('a', { href: href('ref', `${book.abbr}${l.chapter}`) }, `第${l.chapter}章`),
      sec ? h('span', null, sec.title) : null),
    h('article', { class: 'lm-ladder' },
      h('header', { class: 'lm-layer lm-layer-top' },
        h('span', { class: 'lm-layer-name' }, '一句話'),
        h('h1', null, l.title),
        h('p', { class: 'lm-say' }, ...glossText(l.summary)),
        whyBlock(l),
        h('div', { class: 'lm-law-meta' },
          h('span', { class: 'lm-ref' }, `依據${abbrOf(l.book)}${l.chapter}:${l.basis.join('、')}`),
          ...topicsOf(l).map(topicChip),
          toggleAll)),
      ...layers),
    neighbors(l),
  );
}

/** 一層：原生 <details>，打開不換頁、不捲動；記住讀者打開過哪幾層 */
function layer(key: Layer, name: string, preview: Child[], body: HTMLElement): HTMLDetailsElement {
  const d = h('details', { class: 'lm-layer', 'data-layer': key },
    h('summary', { class: 'lm-layer-row' }, h('span', { class: 'lm-layer-name' }, name), h('span', { class: 'lm-layer-preview' }, ...preview)),
    h('div', { class: 'lm-layer-body' }, body));
  d.open = store.layers.has(key);
  d.addEventListener('toggle', () => store.setLayer(key, d.open));
  return d;
}

// ---- 經文 ----
function textLayer(l: Law): HTMLElement {
  return h('div', null,
    scripture(l, { basis: true }),
    h('p', { class: 'lm-note' }, '和合本。底色淡的節是上面那句話的依據；劃線的字是知識庫裡的人物、地方與觀念，點了看簡介。'),
    h('p', null, ext(chapterHref(l.book, l.chapter), `讀${l.book}第${l.chapter}章全文與本章整理（另開網頁）`)));
}

// ---- 別卷 ----
function othersLayer(l: Law): HTMLElement {
  const rels = relationsOf(l.id);
  return h('div', null,
    h('div', { class: 'lm-others' }, ...rels.map(({ rel, other, outgoing }) => h('section', { class: 'lm-other', style: `--c: ${groupColor(other)}`, 'data-laws': other.id },
      h('div', { class: 'lm-other-tag' }, relationLabel(rel.type, outgoing)),
      h('h3', null, h('a', { href: href('law', other.id) }, other.title), h('small', null, refText(other))),
      h('p', { class: 'lm-other-sum' }, other.summary),
      scripture(other, { links: false }),
      evidenceLine(rel.evidence, false)))),
    h('p', null, h('a', { class: 'lm-btn', href: href('compare', [l.id, ...rels.map((r) => r.other.id)].join(',')) }, '這幾段並排，逐字比較 →')));
}

// ---- 出處與相關條目 ----
function sourcesSummary(l: Law): string {
  const parts: string[] = [];
  const nRel = relationsOf(l.id).length;
  const nEnt = lawEntries(l).length;
  if (l.entries.length) parts.push(`知識庫條目 ${l.entries.length} 個`);
  if (nEnt) parts.push(`經文裡的人物、地方與觀念 ${nEnt} 個`);
  if (nRel) parts.push(`關聯出處 ${nRel} 條`);
  parts.push('段落與收錄資料');
  return parts.join('、');
}

function sourcesLayer(l: Law): HTMLElement {
  const ents = lawEntries(l);
  const rels = relationsOf(l.id);
  const byType = new Map<string, string[]>();
  for (const e of ents) {
    const t = DB.entries[e]?.type ?? '其他';
    byType.set(t, [...(byType.get(t) ?? []), e]);
  }
  const sec = sectionOf(l);
  return h('div', { class: 'lm-sources' },
    l.entries.length
      ? h('section', null, h('h4', null, '知識庫裡寫這條律法的條目'),
        h('ul', { class: 'lm-plain-list' }, ...l.entries.map((e) => h('li', null, e, '　', ext(entryHref(e), '查看完整條目（另開網頁）')))))
      : null,
    ents.length
      ? h('section', null, h('h4', null, '經文裡的人物、地方與觀念'),
        ...[...byType.entries()].map(([type, list]) => h('div', { class: 'lm-entry-group' }, h('span', { class: 'lm-entry-type' }, TYPE_PLAIN[type] ?? type), ...list.map((e) => entryChip(e)))))
      : null,
    rels.length
      ? h('section', null, h('h4', null, '為什麼說別卷也記了'),
        h('p', { class: 'lm-note' }, '每一條關聯都要有知識庫裡的出處，下面是出處的原句。'),
        h('ul', { class: 'lm-plain-list' }, ...rels.map(({ rel, other }) => h('li', null, h('a', { href: href('law', other.id) }, refText(other)), evidenceLine(rel.evidence)))))
      : null,
    h('section', null, h('h4', null, '段落與收錄'),
      h('dl', { class: 'lm-dl' },
        sec?.code ? [h('dt', null, '法典段落'), h('dd', null, `${sec.code}（取自${l.book}全書目錄）`)] : null,
        sec ? [h('dt', null, '律法段落'), h('dd', null, `${sec.title}（${abbrOf(l.book)}${l.chapter}:${sec.from}-${sec.to}）`)] : null,
        coverageLine(l),
        h('dt', null, '條文代號'), h('dd', null, h('code', null, l.id)))),
    h('details', { class: 'lm-sub' }, h('summary', null, '關係圖：這條律法連到的主題、律法與條目'), egoGraph('law', l.id, l.title)));
}

function coverageLine(l: Law): Child {
  const c = DB.coverage.find((x) => x.book === l.book && x.chapter === l.chapter);
  if (!c) return null;
  return [h('dt', null, '本章收錄'), h('dd', null, `${abbrOf(l.book)}${l.chapter} 共 ${c.total} 節，已收 ${c.covered} 節，不收 ${c.excluded} 節${c.missing.length ? `，還沒整理 ${c.missing.map(([a, b]) => (a === b ? a : `${a}-${b}`)).join('、')}` : ''}`)];
}

/** 同一卷的前後條文 */
function neighbors(l: Law): HTMLElement | null {
  const same = laws.filter((x) => x.book === l.book);
  const i = same.findIndex((x) => x.id === l.id);
  const prev = same[i - 1];
  const next = same[i + 1];
  if (!prev && !next) return null;
  return h('nav', { class: 'lm-prevnext', 'aria-label': '同一卷的前後條文' },
    prev ? h('a', { href: href('law', prev.id), 'data-laws': prev.id }, h('small', null, `← ${refText(prev)}`), h('span', null, prev.title)) : h('span'),
    next ? h('a', { href: href('law', next.id), 'data-laws': next.id }, h('small', null, `${refText(next)} →`), h('span', null, next.title)) : h('span'));
}
