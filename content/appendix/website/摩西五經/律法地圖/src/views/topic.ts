import { books, DB, entryHref, groupById, lawsOfGroup, lawsOfTopic, relatedTopics, topicById } from '../data/db';
import type { Law } from '../data/types';
import { href, type Route } from '../router';
import { lawCard, topicChip } from '../ui/cards';
import { ext, h, s } from '../ui/dom';
import { setRibbonBase } from '../ui/ribbon';

/**
 * 主題頁（大類或子題）：有收錄的書卷各一欄，條文依經文順序排；
 * 別卷又記了一次的條文之間畫一條線。上方律法帶同時亮出這個主題的律法在哪幾章。
 */
export function topicView(route: Route): HTMLElement {
  const id = route.params[0];
  const group = groupById.get(id);
  const topic = topicById.get(id);
  if (!group && !topic) return h('div', { class: 'lm-page' }, h('h1', null, '找不到這個主題'), h('a', { href: '#/' }, '回首頁'));
  const g = group ?? groupById.get(topic!.group)!;
  const ls = group ? lawsOfGroup(id) : lawsOfTopic(id);
  const used = books.filter((b) => ls.some((l) => l.book === b.name));
  setRibbonBase(ls.map((l) => l.id));
  const title = group ? group.name : topic!.plain;
  const formal = group ? null : topic!.name !== topic!.plain ? topic!.name : null;

  return h('div', { class: 'lm-page lm-topic-page', style: `--c: var(--g${g.color})` },
    h('nav', { class: 'lm-crumbs', 'aria-label': '位置' }, h('a', { href: '#/' }, '首頁'), group ? null : h('a', { href: href('topic', g.id) }, g.name)),
    h('header', { class: 'lm-page-head' },
      h('h1', null, title, formal ? h('small', null, formal) : null),
      h('p', { class: 'lm-lede' }, ls.length ? `${ls.length} 條，記在${used.map((b) => b.name).join('、')}。` : '這個主題還沒有收錄條文。'),
      topic?.entry ? h('p', null, `知識庫有「${topic.entry}」這個條目：`, ext(entryHref(topic.entry), '查看完整條目（另開網頁）')) : null),
    group ? h('nav', { class: 'lm-chips', 'aria-label': '這一類的主題' }, ...group.topics.map((t) => topicById.get(t)!).filter((t) => lawsOfTopic(t.id).length).map(topicChip)) : null,
    ls.length ? lanes(ls) : null,
    !group ? related(id) : null,
  );
}

/** 一欄先放幾張卡片；條文很多的主題，其餘按一下在原地補上（有連線的卡片一定先放） */
const LANE_FIRST = 12;

function lanes(ls: Law[]): HTMLElement {
  const used = books.filter((b) => ls.some((l) => l.book === b.name));
  const svg = s('svg', { class: 'lm-links', 'aria-hidden': 'true' });
  const ids = new Set(ls.map((l) => l.id));
  const linked = new Set(DB.relations.filter((r) => ids.has(r.from) && ids.has(r.to)).flatMap((r) => [r.from, r.to]));
  let draw = () => {};
  const wrap = h('div', { class: 'lm-lanes', style: `--n: ${used.length}` },
    ...used.map((b) => {
      const mine = ls.filter((l) => l.book === b.name);
      const cards = mine.map((l) => lawCard(l));
      let shown = 0;
      cards.forEach((c, i) => {
        if (i < LANE_FIRST || linked.has(mine[i].id)) shown++;
        else c.hidden = true;
      });
      const rest = mine.length - shown;
      const more = rest > 0
        ? h('button', { type: 'button', class: 'lm-btn lm-lane-more', onclick: (e: MouseEvent) => {
          cards.forEach((c) => { c.hidden = false; });
          (e.currentTarget as HTMLElement).remove();
          draw();
        } }, `再看 ${rest} 條`)
        : null;
      return h('section', { class: 'lm-lane' }, h('h2', { class: 'lm-lane-head' }, b.name, h('small', null, `${mine.length} 條`)), ...cards, more);
    }));
  const box = h('div', { class: 'lm-lanes-box' }, svg, wrap);
  draw = () => { if (box.isConnected) drawLinks(box, svg, ls); };
  // 卡片放進頁面、量得到位置之後才畫線；視窗或字級改變時重畫
  let tries = 0;
  const wait = () => (box.isConnected ? draw() : ++tries < 60 && requestAnimationFrame(wait));
  requestAnimationFrame(wait);
  new ResizeObserver(draw).observe(box);
  const hasLinks = DB.relations.some((r) => ls.some((l) => l.id === r.from) && ls.some((l) => l.id === r.to));
  return h('div', null, box, hasLinks ? h('p', { class: 'lm-note' }, '線連起來的兩條，是別卷又記了一次的同一件事；卡片下方的小字是另一卷的出處。') : null);
}

/** 在兩欄之間畫曲線：只畫兩端都在這一頁、而且不在同一欄的關聯；手機單欄時不畫 */
function drawLinks(box: HTMLElement, svg: SVGSVGElement, ls: Law[]) {
  svg.replaceChildren();
  const base = box.getBoundingClientRect();
  svg.setAttribute('width', String(base.width));
  svg.setAttribute('height', String(base.height));
  const ids = new Set(ls.map((l) => l.id));
  // 同一張卡片連出好幾條線時，起點上下錯開，免得疊成一條
  const used = new Map<string, number>();
  let arcs = 0;
  const slot = (id: string) => { const n = used.get(id) ?? 0; used.set(id, n + 1); return 22 + n * 12; };
  for (const r of DB.relations) {
    if (!ids.has(r.from) || !ids.has(r.to)) continue;
    const a = box.querySelector<HTMLElement>(`[data-law="${r.from}"]`)?.getBoundingClientRect();
    const b = box.querySelector<HTMLElement>(`[data-law="${r.to}"]`)?.getBoundingClientRect();
    if (!a || !b || !a.height || !b.height || Math.abs(a.left - b.left) < 20) continue;
    const [l, rr, lid, rid] = a.left < b.left ? [a, b, r.from, r.to] : [b, a, r.to, r.from];
    const x1 = l.right - base.left;
    const y1 = l.top + slot(lid) - base.top;
    const x2 = rr.left - base.left;
    const y2 = rr.top + slot(rid) - base.top;
    // 隔了一欄以上的關聯：從欄與欄之間的空隙往上，沿最上面那條留白走過去再下來，不從中間那一欄的卡片後面穿過
    const skips = [...box.querySelectorAll<HTMLElement>('.lm-lane')].filter((ln) => {
      const x = ln.getBoundingClientRect();
      return x.left > l.right && x.right < rr.left;
    }).length;
    const d = skips
      ? (() => {
        const top = 6 + (arcs++) * 7;
        const ax = x1 + 20;
        const bx = x2 - 20;
        return `M${x1},${y1} H${ax - 6} Q${ax},${y1} ${ax},${y1 - 6} V${top + 6} Q${ax},${top} ${ax + 6},${top} H${bx - 6} Q${bx},${top} ${bx},${top + 6} V${y2 - 6} Q${bx},${y2} ${bx + 6},${y2} H${x2}`;
      })()
      : `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    svg.append(
      s('path', { d, class: `lm-link lm-link-${r.type}` }),
      s('circle', { cx: x1, cy: y1, r: 3.5, class: 'lm-link-end' }),
      s('circle', { cx: x2, cy: y2, r: 3.5, class: 'lm-link-end' }));
  }
}

function related(id: string): HTMLElement | null {
  const rel = relatedTopics(id);
  if (!rel.length) return null;
  return h('section', { class: 'lm-related' }, h('h2', null, '同一批律法也標了這些主題'),
    h('div', { class: 'lm-chips' }, ...rel.map(([t, n]) => h('span', { class: 'lm-related-item' }, topicChip(t), h('small', null, ` ${n} 條`)))));
}
