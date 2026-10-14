import type { GenealogyData, Person, VerseMap } from '../data/types';
import { buildGraph, verseText } from '../data/model';
import { h, svgEl } from './dom';

export function createAges(data: GenealogyData, verses: VerseMap, onPerson: (id: string) => void, onVerse: (ref: string) => void): HTMLElement {
  const people = data.ages.people.filter((item) => Number.isFinite(item.born) && Number.isFinite(item.died));
  const root = h('section', { className: 'ag-page ag-ages-page' },
    h('div', { className: 'ag-page-heading' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '創世後年份'), h('h1', {}, '年歲時間軸')),
      h('p', {}, '橫槓表示經文記載的生與死；點和經節標出父親生子的時間。')));
  if (!people.length) {
    root.append(h('div', { className: 'ag-empty-state' }, h('strong', {}, '目前沒有年歲資料')));
    return root;
  }
  const graph = buildGraph(data);
  const minYear = Math.min(0, ...people.map((item) => item.born));
  const maxYear = Math.ceil(Math.max(...people.map((item) => item.died)) / 200) * 200;
  // 手機寬度用精簡版：座標縮到 360 寬、名字放在橫槓上方、刻度每 800 年標一次，整張圖不用左右捲動
  const compact = window.matchMedia('(max-width: 520px)').matches;
  const width = compact ? 360 : 1120;
  const top = 72;
  const rowH = compact ? 44 : 48;
  const height = top + people.length * rowH + 48;
  const labelW = compact ? 8 : 224;
  const chartW = width - labelW - (compact ? 16 : 44);
  const xOf = (year: number) => labelW + ((year - minYear) / Math.max(1, maxYear - minYear)) * chartW;
  const svg = svgEl('svg', { class: 'ag-ages-svg', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': '家譜人物年歲時間軸' });
  for (let year = 200; year <= maxYear; year += 200) {
    const x = xOf(year);
    svg.append(svgEl('line', { class: 'ag-age-tick', x1: x, x2: x, y1: 48, y2: height - 26 }));
    if (year % (compact ? 800 : 400) === 0) {
      const text = svgEl('text', { class: 'ag-age-axis-label', x, y: 30, 'text-anchor': 'middle' });
      text.textContent = compact ? `${year} 年` : `創世後 ${year} 年`;
      svg.append(text);
    }
  }
  for (let i = 0; i < people.length; i += 1) {
    const item = people[i]!;
    const person = graph.byId.get(item.id);
    const y = top + i * rowH;
    const group = svgEl('g', { class: 'ag-age-row', 'data-id': item.id, tabindex: '0', role: 'button', 'aria-label': `${person?.name ?? item.id}，生於創世後第 ${item.born} 年，享年 ${item.total ?? item.died - item.born} 歲` });
    group.append(svgEl('line', { class: 'ag-age-guide', x1: labelW, x2: width - 24, y1: y, y2: y }));
    const desktopName = svgEl('text', { class: 'ag-age-name ag-age-name-desktop', x: 10, y: y + 4 });
    desktopName.textContent = person?.name ?? item.id;
    const mobileName = svgEl('text', { class: 'ag-age-name ag-age-name-mobile', x: compact ? Math.min(xOf(item.born), width - 70) : labelW + 2, y: y - 10 });
    mobileName.textContent = person?.name ?? item.id;
    const startX = xOf(item.born);
    const endX = xOf(item.died);
    group.append(desktopName, mobileName, svgEl('rect', { class: 'ag-age-bar', x: startX, y: y - 7, width: Math.max(2, endX - startX), height: 14, rx: 7 }));
    group.append(svgEl('circle', { class: 'ag-age-born', cx: startX, cy: y, r: 4.5 }), svgEl('circle', { class: 'ag-age-died', cx: endX, cy: y, r: 4.5 }));
    const title = svgEl('title');
    const refs = (item.refs ?? []).map((ref) => `${ref}${verseText(ref, verses) ? `：${verseText(ref, verses)}` : ''}`).join('\n');
    title.textContent = `${person?.name ?? item.id}：出生 ${item.born} 年，死亡 ${item.died} 年，年歲 ${item.total ?? item.died - item.born}${refs ? `\n${refs}` : ''}`;
    group.append(title);
    for (const child of childrenFor(item.id, graph.children, graph.byId)) {
      const childAge = people.find((candidate) => candidate.id === child.id);
      if (!childAge) continue;
      const eventX = xOf(childAge.born);
      group.append(svgEl('circle', { class: 'ag-age-child-point', cx: eventX, cy: y, r: 3.6 }));
    }
    group.addEventListener('click', () => onPerson(item.id));
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter') onPerson(item.id); });
    svg.append(group);
  }
  for (const event of data.ages.events ?? []) {
    const yearValue = event.year ?? event.at ?? event.value ?? event.am;
    const year = typeof yearValue === 'number' ? yearValue : Number(yearValue);
    if (!Number.isFinite(year)) continue;
    const x = xOf(year);
    const isFlood = String(event.id ?? event.title ?? event.name ?? '') === '洪水';
    svg.append(svgEl('line', { class: `ag-age-event-line${isFlood ? ' ag-age-flood' : ''}`, x1: x, x2: x, y1: 42, y2: height - 26 }));
    const label = svgEl('text', { class: `ag-age-event-label${isFlood ? ' ag-age-flood-label' : ''}`, x: x + 6, y: 56 });
    label.textContent = String(event.title ?? event.name ?? event.id ?? '事件');
    const title = svgEl('title'); title.textContent = `${label.textContent} ${year}${event.ref ? `／${String(event.ref)}` : ''}`; label.append(title);
    svg.append(label);
    if (event.ref) label.addEventListener('click', () => onVerse(String(event.ref)));
  }
  const axis = svgEl('text', { class: 'ag-age-axis-title', x: labelW + chartW / 2, y: height - 8, 'text-anchor': 'middle' });
  axis.textContent = '創世後年份';
  svg.append(axis);
  const notes = h('div', { className: 'ag-age-notes' }, h('h2', {}, '時間軸說明'));
  for (const note of data.ages.notes ?? []) {
    const text = typeof note === 'string' ? note : typeof note.text === 'string' ? note.text : '';
    if (text) notes.append(h('p', {}, text));
  }
  if (!data.ages.notes?.length) notes.append(h('p', { className: 'ag-muted' }, '沒有補充說明。'));
  const legend = h('div', { className: 'ag-age-legend' }, h('span', { className: 'ag-age-legend-born' }, '出生'), h('span', { className: 'ag-age-legend-child' }, '生子'), h('span', { className: 'ag-age-legend-died' }, '死亡'));
  root.append(legend, h('div', { className: 'ag-ages-scroll' }, svg), notes);
  return root;
}

function childrenFor(id: string, children: Map<string, string[]>, people: Map<string, Person>): Person[] {
  return (children.get(id) ?? []).map((childId) => people.get(childId)).filter((person): person is Person => Boolean(person));
}
