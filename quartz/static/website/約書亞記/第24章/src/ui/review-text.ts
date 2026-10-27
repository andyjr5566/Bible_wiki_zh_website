import type { CuvSpanRef, SiteData } from '../data/types';
import { h } from './dom';
import type { PeekController } from './peek';

export function highlightedText(text: string, spans: CuvSpanRef[] = []): DocumentFragment {
  const ranges: [number, number][] = [];
  for (const span of spans) {
    let start = -1;
    for (let n = 0; n < (span.occurrence ?? 1); n++) start = text.indexOf(span.text, start + 1);
    if (start >= 0) ranges.push([start, start + span.text.length]);
  }
  const fragment = document.createDocumentFragment();
  let from = 0;
  for (const [start, end] of ranges.sort((a, b) => a[0] - b[0])) {
    if (start < from) continue;
    fragment.append(text.slice(from, start), h('mark', { className: 'jos-mark' }, text.slice(start, end)));
    from = end;
  }
  fragment.append(text.slice(from));
  return fragment;
}

export function verseBlock(data: SiteData, ref: string): HTMLElement {
  const block = data.verseBlocks[ref];
  const result = h('div', { className: 'jos-review-quote' });
  if (!block) return result; // Missing references are recorded in the handoff, never shown as internal copy.
  result.append(h('div', { className: 'jos-review-ref' }, block.ref));
  for (const line of block.lines) {
    result.append(h('p', { className: 'jos-verse-line' }, h('span', { className: 'jos-verse-num' }, String(line.v)), line.text));
  }
  return result;
}

export function linkedVerse(text: string, data: SiteData, peek: PeekController): DocumentFragment {
  const names = new Map<string, string>();
  for (const entry of Object.values(data.entries)) {
    if (entry.type === '人物' || entry.type === '地點') {
      const name = entry.title.replace(/（.*?）/g, '');
      if (text.includes(name)) names.set(name, entry.key);
    }
  }
  const serveKey = '原文/事奉與作奴僕同一字根（a.vad）';
  if (data.entries[serveKey]) for (const word of ['事奉', '為奴', '僕人']) names.set(word, serveKey);
  const candidates = [...names.keys()].sort((a, b) => b.length - a.length);
  const fragment = document.createDocumentFragment();
  let buffer = '';
  for (let i = 0; i < text.length;) {
    const name = candidates.find(value => text.startsWith(value, i));
    if (!name) { buffer += text[i++]; continue; }
    fragment.append(buffer);
    buffer = '';
    const button = h('button', { type: 'button', className: 'jos-scripture-link', 'aria-label': `查看${name}` }, name);
    button.addEventListener('click', () => peek.openEntry(names.get(name)!));
    fragment.append(button);
    i += name.length;
  }
  fragment.append(buffer);
  return fragment;
}
