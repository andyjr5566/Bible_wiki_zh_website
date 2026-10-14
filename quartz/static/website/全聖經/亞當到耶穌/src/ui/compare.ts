import type { GenealogyData, Person, WitnessEntry } from '../data/types';
import { h } from './dom';

const shownName = (entry: WitnessEntry, fallback: Person | undefined) => String(entry.as ?? entry.name ?? fallback?.name ?? entry.id ?? '');

export function createCompare(data: GenealogyData, onPerson: (id: string) => void): HTMLElement {
  const graph = new Map(data.persons.map((person) => [person.id, person]));
  const root = h('section', { className: 'ag-page ag-compare-page' },
    h('div', { className: 'ag-page-heading' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '見證並排'), h('h1', {}, '兩條線對照')),
      h('p', {}, '按人物所在段落排列。空白表示這份見證沒有列出該人。')));
  const scroll = h('div', { className: 'ag-table-scroll', tabindex: '0', 'aria-label': '可水平捲動的家譜見證表格' });
  const table = h('table', { className: 'ag-compare-table' });
  const head = h('thead');
  const row = h('tr');
  row.append(h('th', { scope: 'col' }, '家譜人物'));
  for (const witness of data.witnesses) row.append(h('th', { scope: 'col' }, h('span', {}, witness.title), witness.ref ? h('small', {}, witness.ref) : null));
  head.append(row);
  const body = h('tbody');
  const witnessEntries = data.witnesses.map((witness) => new Map((witness.entries ?? []).map((entry) => [entry.id ?? '', entry])));
  for (const segment of data.spine.segments) {
    body.append(h('tr', { className: 'ag-table-segment' }, h('th', { colspan: data.witnesses.length + 1, scope: 'rowgroup' }, segment.title)));
    const ids = [...new Set(Object.values(segment.lines).flat())];
    for (const id of ids) {
      const person = graph.get(id);
      if (!person) continue;
      const tr = h('tr');
      const name = h('button', { className: 'ag-person-link', type: 'button' }, person.name);
      name.addEventListener('click', () => onPerson(id));
      tr.append(h('th', { scope: 'row' }, name, person.qualifier ? h('small', {}, person.qualifier) : null));
      for (let i = 0; i < data.witnesses.length; i += 1) {
        const witness = data.witnesses[i]!;
        const entry = witnessEntries[i]!.get(id);
        const mark = person.marks?.find((item) => item.witness === witness.id);
        const cell = h('td', { className: mark ? 'ag-cell-marked' : '' }, entry
          ? h('button', { className: 'ag-compare-person', type: 'button' }, shownName(entry, person))
          : h('span', { className: 'ag-cell-empty' }, '—'));
        if (entry) cell.querySelector('button')?.addEventListener('click', () => onPerson(id));
        if (mark) cell.title = mark.label;
        tr.append(cell);
      }
      body.append(tr);
    }
  }
  table.append(head, body);
  scroll.append(table);
  root.append(scroll);
  return root;
}
