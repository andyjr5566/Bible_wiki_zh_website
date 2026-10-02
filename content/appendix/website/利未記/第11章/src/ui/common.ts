import VERSES from '../data/verses.json';
import { h, svg } from './dom';
import { ICONS } from './icons';

const verses = VERSES as Record<string, string>;

/** 一層內容：標題＋說明＋內容 */
export const layer = (title: string, hint: string | null, ...body: (HTMLElement | null)[]) =>
  h('section', { class: 'layer' }, h('h2', { class: 'layer-title' }, title, hint ? h('small', null, hint) : null), ...body);

/** 可展開的細節：第一次打開才建 */
export function more(title: string, hint: string, body: HTMLElement | (() => HTMLElement), cls = ''): HTMLDetailsElement {
  const d = h('details', { class: `more card ${cls}` },
    h('summary', null, h('span', null, h('b', null, title), h('small', null, hint)), h('span', { class: 'chev' }, svg(ICONS.chev))));
  let built = false;
  d.addEventListener('toggle', () => {
    if (!d.open || built) return;
    built = true;
    d.append(h('div', { class: 'more-body' }, typeof body === 'function' ? body() : body));
  });
  return d;
}

/** 「讀經文」：整段和合本，節號小字 */
export function readingMore(read: { book?: string; ch: number; from: number; to: number; title: string }[]): HTMLDetailsElement {
  const body = () => h('div', { class: 'reading' }, ...read.map((r) => {
    const b = r.book ?? '利';
    const ps: HTMLElement[] = [];
    for (let v = r.from; v <= r.to; v++) {
      const t = verses[`${b}${r.ch}:${v}`];
      if (t) ps.push(h('span', { class: 'rverse' }, h('sup', null, `${r.ch}:${v}`), t));
    }
    return h('section', null, h('h4', null, r.title), h('p', null, ...ps));
  }));
  return more('讀經文', read.map((r) => `${r.book ?? '利'}${r.ch}:${r.from}-${r.to}`).join('、'), body);
}

/**
 * 故事人物的回答：接在 3D 故事下面，用虛線連到下面的重點。
 * 故事演完時重播一次進場動畫（不捲動頁面、不移動鏡頭）；沒看故事的人，內容一直都在。
 */
export function answerBridge(who: { id: string; label: string }, text: string, reelEl: HTMLElement, keys: HTMLElement): HTMLElement {
  const el = h('div', { class: 'bridge', style: `--who:var(--who-${who.id})` },
    h('div', { class: 'bridge-bubble' },
      h('span', { class: 'bridge-who' }, h('span', { class: `cast-dot who-${who.id}` }), who.label, h('span', { class: 'story-tag' }, svg(ICONS.family), '示意情境')),
      h('p', null, text)),
    h('span', { class: 'bridge-line', 'aria-hidden': 'true' }));
  keys.classList.add('answer-keys');
  reelEl.addEventListener('reel-end', () => {
    for (const x of [el, keys]) {
      x.classList.remove('replay');
      void x.offsetWidth;
      x.classList.add('replay');
    }
  });
  return el;
}

/** 新約裡的一句話 */
export const ntCard = (...lines: HTMLElement[]) =>
  h('div', { class: 'nt card' }, h('span', { class: 'nt-tag' }, '新約'), h('div', { class: 'nt-body' }, ...lines));

/** 往「各家怎麼讀」的連結 */
export const voicesLink = (title: string, hint: string, topic?: string) => h('a', { class: 'voices-link card', href: topic ? `#/voices/${topic}` : '#/voices' },
  svg(ICONS.scale), h('span', null, h('b', null, title), h('small', null, hint), h('small', null, '全部集中在最後一幕「各家怎麼讀」')),
  svg(ICONS.next));

/** 切換研經模式（全站）：顯示原文、詞義和更細的註釋 */
export function toggleStudy(on?: boolean) {
  const root = document.documentElement;
  root.dataset.study = (on ?? root.dataset.study !== '1') ? '1' : '0';
  try { localStorage.setItem('lev-purity:study', root.dataset.study); } catch { /* 不保存也能用 */ }
  document.querySelectorAll<HTMLButtonElement>('.iconbtn[aria-label^="研經模式"]').forEach((b) => b.setAttribute('aria-pressed', String(root.dataset.study === '1')));
}

/** 研經層：研經模式關著的時候，只露出一個「打開」的按鈕 */
export const study = (label: string, ...body: (HTMLElement | null)[]) => h('div', { class: 'study-wrap' },
  h('button', { class: 'study-open', type: 'button', onclick: () => toggleStudy(true) }, svg(ICONS.scroll), `研經：${label}`),
  h('div', { class: 'study' }, h('div', { class: 'study-head' }, h('span', { class: 'study-tag' }, svg(ICONS.scroll), '研經'), h('b', null, label),
    h('button', { class: 'study-close', type: 'button', onclick: () => toggleStudy(false) }, '收起研經模式')), ...body));
