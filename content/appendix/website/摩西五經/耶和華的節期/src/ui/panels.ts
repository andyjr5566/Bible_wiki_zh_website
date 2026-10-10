/**
 * 說明框裡就地展開的兩種面板：
 * - 「四家怎麼說」：註釋清單（出處＋原站名稱、引文、具名轉述、原站連結）
 * - 「原文」：原文字卡（STEP Bible 資料欄 + 網站自己的說明）
 * 文字全部來自 SITE，這裡只負責排版。
 */
import type { CommentaryNote, StepWord } from '../data/types';
import { SITE } from '../data/site';
import { ext, h } from './dom';

export const STEP_REPO = 'https://github.com/STEPBible/STEPBible-Data';

/**
 * 引文格式：
 * - 中文來源：「中文原句」
 * - 英文來源：「英文原句」（中譯）；中譯不放進「」
 */
export function noteItem(n: CommentaryNote): HTMLElement {
  const quote = n.quote ? (n.quoteZh ? `「${n.quote}」（${n.quoteZh}）` : `「${n.quote}」`) : null;
  return h(
    'li',
    { class: 'jf-note', 'data-source': n.source },
    h('p', { class: 'jf-note-head' },
      h('b', { class: 'jf-note-work' }, n.work),
      h('span', { class: 'jf-note-site' }, n.site),
      h('span', { class: 'jf-note-verse' }, n.verse)),
    quote ? h('p', { class: 'jf-note-quote', lang: n.quoteZh ? 'zh-Hant' : undefined }, quote) : null,
    n.paraphrase ? h('p', { class: 'jf-note-para' }, n.paraphrase) : null,
    h('p', { class: 'jf-note-link' }, ext(n.url, '原站')),
  );
}

export function notesPanelBody(ids: string[]): HTMLElement {
  const items = ids.map((id) => SITE.commentary[id]).filter((n): n is CommentaryNote => !!n);
  return h('ul', { class: 'jf-notes' }, items.map(noteItem));
}

function row(label: string, value: string | null | undefined, extra?: Node | null): HTMLElement | null {
  if (!value) return null;
  return h('div', { class: 'jf-dl-row' }, h('dt', null, label), h('dd', null, value, extra ?? null));
}

export function wordCard(w: StepWord): HTMLElement {
  return h(
    'article',
    { class: 'jf-word' },
    h('header', { class: 'jf-word-head' },
      h('span', { class: 'jf-word-label' }, w.label),
      h('span', { class: 'jf-word-ref' }, w.ref)),
    h('p', { class: 'jf-word-he', dir: 'rtl', lang: 'he' }, w.hebrew),
    h('p', { class: 'jf-word-tr', lang: 'und-Latn' }, w.translit),
    h('dl', { class: 'jf-dl' },
      row('本節譯義', w.gloss),
      row('詞形', w.morphText, h('code', { class: 'jf-code' }, w.morph)),
      row('字典義', w.lexicon),
      row('Strong 編號', w.strong)),
    w.note ? h('p', { class: 'jf-word-note' }, w.note) : null,
  );
}

export function wordsPanelBody(ids: string[]): HTMLElement {
  const words = ids.map((id) => SITE.step[id]).filter((w): w is StepWord => !!w);
  return h('div', { class: 'jf-words' },
    words.map(wordCard),
    h('p', { class: 'jf-step-credit' }, '原文資料：', ext(STEP_REPO, 'STEP Bible（CC BY 4.0）')));
}
