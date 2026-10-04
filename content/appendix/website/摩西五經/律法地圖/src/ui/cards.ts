import { DB, chapterHref, entryHref, groupOfLaw, groupOfTopic, lawsOfEntry, lawVerses, lawWhy, refText, relationLabel, relationsOf } from '../data/db';
import type { Evidence, Law, Topic } from '../data/types';
import { href } from '../router';
import { ext, h, type Child } from './dom';
import { openPeek } from './peek';

/** 條目類型 → CSS 用的英文代號（顏色在 styles.css） */
export const TYPE_KEY: Record<string, string> = {
  人物: 'person', 地點: 'place', 事件: 'event', 主題: 'topic', 神學: 'theology', 背景: 'background',
  文化: 'culture', 歷史: 'history', 原文: 'original', 互文: 'intertext', 解經爭議: 'debate',
};
/** 類型的白話名稱 */
export const TYPE_PLAIN: Record<string, string> = {
  人物: '人物', 地點: '地方', 事件: '事件', 主題: '主題', 神學: '信仰觀念', 背景: '時代背景',
  文化: '當時的文化', 歷史: '歷史', 原文: '原文字詞', 互文: '經文對照', 解經爭議: '各家看法不同',
};
export const typeKey = (title: string) => TYPE_KEY[DB.entries[title]?.type ?? ''] ?? 'topic';

/** 條目小卡：名稱、類型、一句簡介、本站的反查、連到完整條目。不搬條目內容。 */
export function entryPeekContent(title: string): Child[] {
  const info = DB.entries[title];
  const n = lawsOfEntry(title).length;
  return [
    h('div', { class: `lm-peek-type lm-t-${typeKey(title)}` }, TYPE_PLAIN[info?.type ?? ''] ?? info?.type ?? ''),
    h('h3', { class: 'lm-peek-title' }, title),
    info?.gist ? h('p', { class: 'lm-peek-gist' }, info.gist) : null,
    h('div', { class: 'lm-peek-actions' },
      n ? h('a', { href: href('entry', title) }, `提到它的律法（${n} 條）`) : null,
      ext(entryHref(title), '查看完整條目（另開網頁）')),
  ];
}

/** 文字中間可點的字：行內 span＋role=button，Enter／空白鍵也能按 */
function inlineButton(cls: string, text: string, onActivate: () => void): HTMLSpanElement {
  const el = h('span', { class: cls, role: 'button', tabindex: '0' }, text);
  el.addEventListener('click', onActivate);
  el.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onActivate(); }
  });
  return el;
}

/** 條目按鈕：點了開小卡 */
export function entryChip(title: string, label: Child = title): HTMLButtonElement {
  const b = h('button', { type: 'button', class: `lm-chip lm-entry lm-t-${typeKey(title)}` }, label);
  b.addEventListener('click', () => openPeek(b, ...entryPeekContent(title)));
  return b;
}

/** 把文字裡的術語（glossary.yaml）包成可點的虛線字，點了開條目小卡 */
export function glossText(text: string): Child[] {
  if (!DB.glossary.length) return [text];
  const terms = DB.glossary.map((g) => g.term).sort((a, b) => b.length - a.length);
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
  return text.split(re).map((part, i) => {
    if (i % 2 === 0) return part;
    const entry = DB.glossary.find((g) => g.term === part)!.entry;
    const b = inlineButton('lm-term', part, () => openPeek(b, ...entryPeekContent(entry)));
    return b;
  });
}

export const groupColor = (l: Law) => `var(--g${groupOfLaw(l)?.color ?? 0})`;

export function topicChip(t: Topic): HTMLAnchorElement {
  const g = groupOfTopic(t.id);
  return h('a', { class: 'lm-chip lm-topic', href: href('topic', t.id), style: `--c: var(--g${g?.color ?? 0})`, 'data-laws': lawIdsOfTopic(t.id) }, t.plain);
}
const lawIdsOfTopic = (id: string) => DB.laws.filter((l) => l.topics.includes(id)).map((l) => l.id).join(' ');

/** 經文自己交代的理由：只放和合本原句與節號，網站不另寫理由。compact 給卡片用，字小、不放標籤的大字。 */
export function whyBlock(l: Law, compact = false): HTMLElement | null {
  const ws = lawWhy(l);
  if (!ws.length) return null;
  return h('div', { class: `lm-why${compact ? ' lm-why-compact' : ''}` },
    h('span', { class: 'lm-why-label' }, '經文給的理由'),
    ...ws.map((w) => h('blockquote', { class: 'lm-why-q' }, h('p', null, w.text), h('cite', null, w.ref))));
}

/** 條文卡（主題頁、書卷頁）：標題、出處、一句話；有別卷重述就標出來 */
export function lawCard(l: Law): HTMLElement {
  const rels = relationsOf(l.id);
  return h('article', { class: 'lm-card', style: `--c: ${groupColor(l)}`, 'data-law': l.id, 'data-laws': l.id },
    h('a', { class: 'lm-card-link', href: href('law', l.id) },
      h('span', { class: 'lm-card-ref' }, refText(l)),
      h('span', { class: 'lm-card-title' }, l.title)),
    h('p', { class: 'lm-card-sum' }, l.summary),
    whyBlock(l, true),
    rels.length
      ? h('div', { class: 'lm-card-rels' }, ...rels.map(({ rel, other, outgoing }) =>
        h('a', { class: 'lm-rel', href: href('law', other.id), title: relationLabel(rel.type, outgoing) }, refText(other))))
      : null,
  );
}

/** 證據：出處連結（條目或章節的公開網頁）＋逐字引句 */
export function evidenceLine(ev: Evidence, withQuote = true): HTMLElement {
  const link = ev.kind === 'entry'
    ? ext(entryHref(ev.title), `知識庫條目「${ev.title}」`)
    : ext(chapterHref(ev.book, ev.chapter), `${ev.book}第${ev.chapter}章的本章整理`);
  return h('div', { class: 'lm-evidence' },
    h('span', { class: 'lm-evidence-src' }, '出處：', link),
    withQuote ? h('q', { class: 'lm-quote' }, ev.quote) : null);
}

/** 經文（和合本），verse_links 的片語劃線，點了開條目小卡 */
export function scripture(l: Law, opts: { links?: boolean; basis?: boolean } = {}): HTMLOListElement {
  return h('ol', { class: 'lm-verses' }, ...lawVerses(l).map((v) => {
    const parts: Child[] = [];
    let at0 = 0;
    for (const k of opts.links === false ? [] : v.links) {
      if (k.s > at0) parts.push(v.text.slice(at0, k.s));
      // 用行內的 span 而不是 button：button 在窄欄裡會整塊換行，把經文斷開
      const b = inlineButton(`lm-phrase lm-t-${typeKey(k.target)}`, v.text.slice(k.s, k.e), () => openPeek(b, ...entryPeekContent(k.target)));
      b.title = k.target;
      parts.push(b);
      at0 = k.e;
    }
    parts.push(v.text.slice(at0));
    return h('li', { value: String(v.n), class: opts.basis && l.basis.includes(v.n) ? 'lm-basis-verse' : null }, ...parts);
  }));
}

/** 經文開頭幾個字，給收合列當預告 */
export function scripturePreview(l: Law, n = 26): string {
  const t = lawVerses(l).map((v) => v.text).join('');
  return [...t].length > n ? `${[...t].slice(0, n).join('')}……` : t;
}
