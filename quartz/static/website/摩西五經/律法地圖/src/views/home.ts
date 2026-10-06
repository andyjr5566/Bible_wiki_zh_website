import { books, DB, groupById, lawById, laws, lawsOfGroup, lawsOfTopic, lawWhy, refText, relationClusters, relationsOf } from '../data/db';
import type { Law, Question } from '../data/types';
import { href } from '../router';
import { glossText, groupColor } from '../ui/cards';
import { startCoach } from '../ui/coach';
import { h } from '../ui/dom';
import { chaptersWithLaws, pinRibbon, ribbon } from '../ui/ribbon';
import { searchBox } from '../ui/searchbox';

/**
 * 首頁：先給問題，再給地圖。
 * 1. 搜尋＋常見主題 2. 生活問題卡（翻開就是條文的一句話）3. 五經律法帶 4. 別卷又記了一次的律法 5. 全部主題
 */
export function homeView(): HTMLElement {
  return h('div', { class: 'lm-home' },
    h('section', { class: 'lm-hero' },
      motto(),
      h('h1', null, '摩西五經的律法'),
      h('p', { class: 'lm-lede lm-lede-main' }, '律法是神給人的指引。'),
      h('p', { class: 'lm-lede lm-lede-hebrew' }, '希伯來文 ', h('span', { lang: 'he', dir: 'rtl' }, 'תּוֹרָה'), '（妥拉）的字義是指引、教導，字根 ', h('span', { lang: 'he', dir: 'rtl' }, 'יָרָה'), ' 也有射箭的意思。'),
      h('p', { class: 'lm-lede' }, '每一條附上和合本經文，經文自己交代的理由和別卷又記了一次的，都接在一起。'),
      searchBox(true),
      quickTopics(),
      h('p', { class: 'lm-hero-help' }, '第一次來？', h('button', { type: 'button', class: 'lm-link-btn', onclick: () => startCoach() }, '新手教學：跟著點幾下，三分鐘學會怎麼用'))),
    questions(),
    reasons(),
    where(),
    restated(),
    allTopics(),
  );
}

/** 標語：詩1:2 的和合本原句（build-data 逐字讀 raw_scripture） */
function motto(): HTMLElement {
  // 在逗號後面換行：直排時一個分句一行，像掛軸的寫法（字一個都不改）
  const clauses = DB.motto.text.split(/(?<=[，；])/).map((c) => h('span', { class: 'lm-motto-line' }, c));
  return h('blockquote', { class: 'lm-motto' }, h('p', null, ...clauses), h('cite', null, DB.motto.ref));
}

function quickTopics(): HTMLElement | null {
  const ts = DB.topics.map((t) => ({ t, n: lawsOfTopic(t.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 8);
  if (!ts.length) return null;
  return h('div', { class: 'lm-quick', 'aria-label': '常見主題' },
    h('span', { class: 'lm-quick-label' }, '常見主題'),
    ...ts.map(({ t }) => {
      const g = groupById.get(t.group)!;
      return h('a', { class: 'lm-quick-chip', href: href('topic', t.id), style: `--c: var(--g${g.color})`, 'data-laws': lawsOfTopic(t.id).map((l) => l.id).join(' ') }, t.plain);
    }));
}

// ---- 生活問題卡 ----

function questions(): HTMLElement | null {
  if (!DB.questions.length) return null;
  const cards = DB.questions.map(qCard);
  cards.slice(FIRST_QUESTIONS).forEach((c) => { c.hidden = true; });
  const rest = cards.length - FIRST_QUESTIONS;
  const more = rest > 0
    ? h('button', { type: 'button', class: 'lm-btn lm-more-q', onclick: (e: MouseEvent) => {
      cards.forEach((c) => { c.hidden = false; });
      (e.currentTarget as HTMLElement).remove();
    } }, `再看 ${rest} 個問題`)
    : null;
  return h('section', { class: 'lm-block lm-questions' },
    h('div', { class: 'lm-block-head' },
      h('h2', null, '律法怎麼說'),
      h('p', { class: 'lm-block-note' }, '點一個問題，看經文怎麼回答。')),
    h('div', { class: 'lm-qgrid' }, ...cards),
    more);
}

/** 首頁先放幾張，其餘按一下在原地補上（不換頁、不捲動） */
const FIRST_QUESTIONS = 6;

function qCard(q: Question, i: number): HTMLElement {
  const ls = q.laws.map((id) => lawById.get(id)!).filter(Boolean);
  const id = `lm-q-${i}`;
  const answer = h('div', { class: 'lm-q-answer', id, hidden: true },
    ...ls.map((l) => h('div', { class: 'lm-q-law' },
      h('p', { class: 'lm-q-sum' }, ...glossText(l.summary)),
      h('a', { class: 'lm-q-go', href: href('law', l.id) }, h('span', null, refText(l)), ' ', l.title, ' →'))),
    others(ls));
  const btn = h('button', { type: 'button', class: 'lm-q-btn', 'aria-expanded': 'false', 'aria-controls': id },
    h('span', { class: 'lm-q-text' }, q.q),
    h('span', { class: 'lm-q-refs' }, h('span', null, ls.map(refText).join('、')), h('span', { class: 'lm-q-hint' }, '看經文怎麼說')));
  const card = h('article', { class: 'lm-q', 'data-laws': ls.map((l) => l.id).join(' '), style: `--c: ${ls[0] ? groupColor(ls[0]) : 'var(--g0)'}` }, btn, answer);
  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', String(open));
    answer.hidden = !open;
    card.classList.toggle('lm-q-open', open);
    pinRibbon(open ? ls.map((l) => l.id) : null);
  });
  return card;
}

/** 答案下面一行：別卷也記了這一條 */
function others(ls: Law[]): HTMLElement | null {
  const shown = new Set(ls.map((l) => l.id));
  const rest = ls.flatMap((l) => relationsOf(l.id).map((r) => r.other)).filter((o) => !shown.has(o.id) && (shown.add(o.id), true));
  if (!rest.length) return null;
  return h('p', { class: 'lm-q-also' }, '別卷也記了：', ...rest.flatMap((o, k) => [k ? '、' : '', h('a', { href: href('law', o.id) }, refText(o))]));
}

// ---- 經文自己交代的理由 ----

/** 首頁先放幾條 */
const FIRST_REASONS = 6;

function reasonCard(l: Law): HTMLElement {
  return h('article', { class: 'lm-reason', style: `--c: ${groupColor(l)}`, 'data-laws': l.id },
    h('div', { class: 'lm-reason-quotes' }, ...lawWhy(l).map((w) => h('blockquote', null, h('p', null, w.text), h('cite', null, w.ref)))),
    h('a', { class: 'lm-reason-go', href: href('law', l.id) }, l.title, ' →'));
}

function reasons(): HTMLElement | null {
  const withWhy = laws.filter((l) => lawWhy(l).length);
  if (!withWhy.length) return null;
  // 先放的幾條輪流從各卷挑，不要全擠在創世記
  const perBook = books.map((b) => withWhy.filter((l) => l.book === b.name));
  const first: Law[] = [];
  for (let round = 0; first.length < FIRST_REASONS && round < FIRST_REASONS; round++) {
    for (const ls of perBook) if (ls[round * 3] && first.length < FIRST_REASONS) first.push(ls[round * 3]);
  }
  const sample = h('div', { class: 'lm-rgrid' }, ...first.map(reasonCard));
  const all = h('div', { class: 'lm-reasons-all', hidden: true }, ...books.map((b, i) => perBook[i].length
    ? h('details', { class: 'lm-reasons-book' },
      h('summary', null, b.name, h('small', null, ` ${perBook[i].length} 條`)),
      h('div', { class: 'lm-rgrid' }, ...perBook[i].map(reasonCard)))
    : null));
  const toggle = h('button', { type: 'button', class: 'lm-btn lm-more-q', 'aria-expanded': 'false' }, `看全部 ${withWhy.length} 條，依書卷分開`);
  toggle.addEventListener('click', () => {
    const open = all.hidden;
    all.hidden = !open;
    sample.hidden = open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.textContent = open ? '收起，只看幾條' : `看全部 ${withWhy.length} 條，依書卷分開`;
  });
  return h('section', { class: 'lm-block lm-reasons' },
    h('div', { class: 'lm-block-head' },
      h('h2', null, '經文自己交代的理由'),
      h('p', { class: 'lm-block-note' }, `${withWhy.length} 條律法的經文自己說了原因。下面是和合本的原句，點標題看整條律法。`)),
    toggle, sample, all);
}

// ---- 五經律法帶 ----

function where(): HTMLElement {
  return h('section', { class: 'lm-block lm-where' },
    h('div', { class: 'lm-block-head' },
      h('h2', null, '律法在五經的哪裡'),
      h('p', { class: 'lm-block-note' }, `一格是一章，柱子越高，那一章收的律法越多。目前收了 ${chaptersWithLaws()} 章、${laws.length} 條。`)),
    ribbon('big'),
    h('div', { class: 'lm-legend', 'aria-label': '顏色是律法的類別' }, ...DB.groups.map((g) => {
      const ls = lawsOfGroup(g.id);
      return h('a', { class: 'lm-legend-key', href: href('topic', g.id), style: `--c: var(--g${g.color})`, 'data-laws': ls.map((l) => l.id).join(' ') },
        h('span', { class: 'lm-legend-dot', 'aria-hidden': 'true' }), g.name, h('small', null, ls.length ? ` ${ls.length}` : ''));
    })));
}

// ---- 別卷又記了一次 ----

/** 首頁先放幾組，其餘按一下在原地補上 */
const FIRST_THREADS = 6;

function restated(): HTMLElement | null {
  // 記載最多卷的先放前面；同樣多的照經文順序
  const clusters = relationClusters().map((c, i) => ({ c, i })).sort((x, y) => new Set(y.c.map((l) => l.book)).size - new Set(x.c.map((l) => l.book)).size || x.i - y.i).map((x) => x.c);
  if (!clusters.length) return null;
  const rows = clusters.map((c, i) => h('li', { hidden: i >= FIRST_THREADS },
    h('a', { class: 'lm-thread', href: href('compare', c.map((l) => l.id).join(',')), 'data-laws': c.map((l) => l.id).join(' ') },
      h('span', { class: 'lm-thread-title' }, c[0].title),
      h('span', { class: 'lm-thread-line' }, ...books.filter((b) => c.some((l) => l.book === b.name)).map((b) =>
        h('span', { class: 'lm-thread-node', 'data-book': b.abbr }, h('b', null, b.name), c.filter((l) => l.book === b.name).map(refText).join('、')))))));
  const rest = clusters.length - FIRST_THREADS;
  const more = rest > 0
    ? h('button', { type: 'button', class: 'lm-btn lm-more-q', onclick: (e: MouseEvent) => {
      rows.forEach((r) => { r.hidden = false; });
      (e.currentTarget as HTMLElement).remove();
    } }, `再看 ${rest} 組`)
    : null;
  return h('section', { class: 'lm-block lm-restated' },
    h('div', { class: 'lm-block-head' },
      h('h2', null, '別卷又記了一次的律法'),
      h('p', { class: 'lm-block-note' }, '同一件事，出埃及記、利未記、申命記的說法常常不完全一樣。點一組，幾段經文並排看。')),
    h('ul', { class: 'lm-threads' }, ...rows),
    more,
    DB.tours.length
      ? h('p', { class: 'lm-tours' }, '照順序一段一段讀：', ...DB.tours.flatMap((t, k) => [k ? '　' : '', h('a', { href: href('tour', t.id, 0), 'data-laws': t.stops.join(' ') }, t.title)]))
      : null);
}

// ---- 全部主題 ----

function allTopics(): HTMLElement {
  return h('section', { class: 'lm-block lm-all' },
    h('div', { class: 'lm-block-head' }, h('h2', null, '全部主題'),
      h('p', { class: 'lm-block-note' }, '灰色的主題還沒有收錄條文。')),
    h('div', { class: 'lm-all-grid' }, ...DB.groups.map((g) => h('section', { class: 'lm-all-group', style: `--c: var(--g${g.color})` },
      h('h3', null, h('a', { href: href('topic', g.id), 'data-laws': lawsOfGroup(g.id).map((l) => l.id).join(' ') }, g.name)),
      h('ul', null, ...g.topics.map((tid) => {
        const t = DB.topics.find((x) => x.id === tid)!;
        const ls = lawsOfTopic(tid);
        return h('li', null, ls.length
          ? h('a', { href: href('topic', tid), 'data-laws': ls.map((l) => l.id).join(' ') }, t.plain, h('small', null, ` ${ls.length}`))
          : h('span', { class: 'lm-muted' }, t.plain));
      }))))),
    h('p', { class: 'lm-foot' }, '經文：和合本。人物、地方與觀念連到知識庫的條目。', h('a', { href: '#/about' }, '資料來源、收錄進度與下載 →')));
}
