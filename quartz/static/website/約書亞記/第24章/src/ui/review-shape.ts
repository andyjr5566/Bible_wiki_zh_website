import type { CuvSpanRef, SiteData } from '../data/types';
import type { StoryState } from '../story/state';
import { coachCustomFlags } from './coach';
import { h } from './dom';
import type { PeekController } from './peek';
import { cueForVerse, reviewJumpToCue } from './review-navigation';

export function createChapterShape(data: SiteData, state: StoryState, peek: PeekController, sync: () => void): HTMLElement {
  const controls = h('div', { className: 'jos-shape-controls', role: 'group', 'aria-label': '章節記號圖層' });
  const diagram = h('div', { className: 'jos-shape-diagram' });
  const ticks = h('div', { className: 'jos-shape-ticks' }, h('span', { className: 'jos-shape-label' }, '節'));
  const axis = h('div', { className: 'jos-shape-axis' });
  for (let verse = 1; verse <= 33; verse++) axis.append(h('span', null, String(verse)));
  ticks.append(axis); diagram.append(ticks);

  function open(verse: number, spans: CuvSpanRef[] = [], explicitCue?: string): void {
    const cue = explicitCue ?? cueForVerse(data, verse);
    peek.openVerse(`書24:${verse}`, { highlights: spans, onStory: cue ? () => reviewJumpToCue(cue, state, sync) : undefined });
    sync();
  }
  const addLayer = (id: string, label: string, count?: number) => {
    const row = h('div', { id: `jos-shape-${id}`, className: `jos-shape-row jos-shape-${id}` });
    const track = h('div', { className: 'jos-shape-track' });
    row.append(h('span', { className: 'jos-shape-label' }, label), track);
    diagram.append(row);
    const control = h('button', { type: 'button', className: 'jos-shape-switch', 'aria-pressed': 'true', 'aria-controls': row.id },
      label, count === undefined ? null : h('span', { className: 'jos-shape-count' }, String(count)));
    control.addEventListener('click', () => {
      const active = control.getAttribute('aria-pressed') !== 'true';
      control.setAttribute('aria-pressed', String(active));
      row.classList.toggle('jos-shape-muted', !active);
      track.inert = !active;
    });
    controls.append(control);
    return track;
  };
  const treaty = addLayer('treaty', '條約');
  for (const [start, end, label, lane] of [[1, 2, '前言', 1], [2, 13, '歷史序言', 2], [14, 24, '主要條款', 1], [25, 28, '抄寫存放', 1], [29, 33, '跋文', 1]] as const) {
    const button = h('button', { type: 'button', className: 'jos-shape-band', style: `grid-column:${start}/${end + 1};grid-row:${lane};`, 'aria-label': `${label}，第${start}至${end}節` }, label);
    button.addEventListener('click', () => open(start)); treaty.append(button);
  }
  const dialogue = addLayer('dialogue', '對話');
  for (const [start, end, speaker, part] of [[1, 15, '約書亞', ''], [16, 18, '百姓', ''], [19, 20, '約書亞', ''], [21, 21, '百姓', ''], [22, 22, '約書亞', '上'], [22, 22, '百姓', '下'], [23, 23, '約書亞', ''], [24, 24, '百姓', '']] as const) {
    const button = h('button', { type: 'button', className: `jos-shape-band jos-speaker-${speaker === '百姓' ? 'people' : 'joshua'}${part ? ` jos-half-${part === '上' ? 'left' : 'right'}` : ''}`,
      style: `grid-column:${start}/${end + 1};grid-row:1;`, title: `${speaker}，第${start}${part}${start !== end ? `至${end}節` : '節'}`, 'aria-label': `${speaker}，第${start}${part}節` }, end - start > 1 ? speaker : speaker === '百姓' ? '百' : '約');
    button.addEventListener('click', () => open(start)); dialogue.append(button);
  }
  const point = (track: HTMLElement, verse: number, spans: CuvSpanRef[], index: number, label: string) => {
    let cell = track.querySelector<HTMLElement>(`[data-verse="${verse}"]`);
    if (!cell) { cell = h('div', { className: 'jos-shape-cell', 'data-verse': String(verse), style: `grid-column:${verse};` }); track.append(cell); }
    const marker = h('button', { type: 'button', className: 'jos-shape-dot', 'aria-label': `${label}，書24:${verse}，第${index}個`, title: `${label}・書24:${verse}` });
    marker.append(h('span', { 'aria-hidden': 'true' }));
    marker.addEventListener('click', () => {
      if (label === '事奉') coachCustomFlags.clickedServeKnot = true;
      open(verse, spans, label === '立石' && verse === 26 ? 'raise' : undefined);
    }); cell.append(marker);
  };
  const iTrack = addLayer('i', '我', data.step.oneCsVerbCount);
  for (const word of data.step.oneCsVerbs) point(iTrack, word.verse, word.cuvSpans, word.index, '我');
  const giveTrack = addLayer('give', '給', data.step.giveCount);
  for (const word of data.step.gives) point(giveTrack, word.verse, word.cuvSpans, word.index, '給');
  const serveTrack = addLayer('serve', '事奉', data.step.serveVerbCount);
  const servantTrack = addLayer('servant', '為奴／僕人', data.step.servantNounCount);
  for (const word of data.step.serveKnots) point(word.baseStrong === 'H5647' ? serveTrack : servantTrack, word.verse,
    [{ text: word.cuvWord, occurrence: word.cuvOccurrence }], word.index, word.cuvWord);
  const stoneTrack = addLayer('stone', '立石');
  for (const verse of [26, 27]) point(stoneTrack, verse, [{ text: verse === 26 ? '大石頭' : '這石頭' }], verse - 25, '立石');

  const treatyLink = h('button', { type: 'button', className: 'jos-text-action' }, '宗主條約是什麼 ↗');
  treatyLink.addEventListener('click', () => peek.openEntry('背景/宗主條約'));
  const serveLink = h('button', { type: 'button', className: 'jos-text-action' }, '事奉、為奴、僕人 ↗');
  serveLink.addEventListener('click', () => peek.openEntry('原文/事奉與作奴僕同一字根（a.vad）'));
  return h('div', { className: 'jos-chapter-shape' }, h('div', { className: 'jos-shape-top' }, controls, h('div', { className: 'jos-shape-links' }, treatyLink, serveLink)), diagram,
    h('p', { className: 'jos-review-caption' }, '出處｜條約分段：GT《雷氏研讀本》《啟導本》《研經資料》；跋文：CT；對話的四個來回：GT《聖經精讀本》；原文的字：STEP Bible（CC BY 4.0）。'));
}
