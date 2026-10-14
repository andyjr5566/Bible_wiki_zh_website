import type { GenealogyData, NoteScripture, NoteView, VerseMap } from '../data/types';
import { h, linkButton } from './dom';
import { verseText } from '../data/model';

export function createNotes(data: GenealogyData, verses: VerseMap, onPerson: (id: string) => void, onVerse: (ref: string) => void): HTMLElement {
  const root = h('section', { className: 'ag-page ag-notes-page' },
    h('div', { className: 'ag-page-heading' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '逐節並讀'), h('h1', {}, '經文不同的地方')),
      h('p', {}, '並列經文引句與來源說法；點人物名稱回到家譜畫布。')));
  const notes = data.notes ?? [];
  if (!notes.length) {
    root.append(h('div', { className: 'ag-empty-state' }, h('strong', {}, '目前沒有需要說明的差異')));
    return root;
  }
  for (const item of notes) {
    const article = h('article', { className: 'ag-note-card', id: `ag-note-${item.id}` },
      h('header', {}, h('p', { className: 'ag-eyebrow' }, item.id), h('h2', {}, item.title)));
    const scripture = h('div', { className: 'ag-scripture-pair' });
    for (const entry of (item.scripture ?? []) as NoteScripture[]) {
      const block = h('blockquote', {},
        entry.quote ? h('p', {}, `「${entry.quote}」`) : h('p', {}, verseText(entry.ref, verses) ?? '這節經文暫時沒有收錄。'),
        linkButton(entry.ref, () => onVerse(entry.ref)));
      scripture.append(block);
    }
    if (scripture.childElementCount) article.append(scripture);
    if (item.text) article.append(h('p', { className: 'ag-note-text' }, item.text));
    const views = item.views ?? [];
    if (views.length) {
      const section = h('div', { className: 'ag-views' });
      for (const view of views as NoteView[]) {
        const card = h('section', { className: 'ag-view-card' },
          view.source ? h('h3', {}, view.source) : h('h3', {}, '來源'),
          view.quote ? h('blockquote', {}, `「${view.quote}」`) : null,
          view.translation ? h('p', {}, view.translation) : null,
          view.paraphrase ? h('p', {}, view.paraphrase) : null,
          view.url ? h('a', { href: view.url, target: '_blank', rel: 'noopener noreferrer' }, '查看來源網址') : null);
        section.append(card);
      }
      article.append(section);
    }
    const attach = h('div', { className: 'ag-chip-list ag-note-attach' });
    for (const id of item.attach ?? []) {
      const person = data.persons.find((candidate) => candidate.id === id);
      const action = h('button', { className: 'ag-person-link', type: 'button' }, person?.name ?? id);
      action.addEventListener('click', () => onPerson(id));
      attach.append(action);
    }
    if (attach.childElementCount) article.append(h('p', {}, '相關人物'), attach);
    root.append(article);
  }
  return root;
}
