import type { GenealogyData, Person } from '../data/types';
import { buildGraph, firstReference, personQualifier, searchNameForms, searchPeople } from '../data/model';
import { h } from './dom';

export interface SearchBox {
  el: HTMLElement;
  close(): void;
}

export function createSearch(data: GenealogyData, onChoose: (person: Person) => void): SearchBox {
  const graph = buildGraph(data);
  const input = h('input', {
    className: 'ag-search-input',
    type: 'search',
    placeholder: '搜尋人物名字',
    'aria-label': '搜尋家譜人物',
    autocomplete: 'off',
  });
  const list = h('div', { className: 'ag-search-results', role: 'listbox', hidden: true });
  const wrapper = h('div', { className: 'ag-search' }, input, list);
  const close = () => { list.hidden = true; list.replaceChildren(); };
  input.addEventListener('input', () => {
    const people = searchPeople(input.value, data, graph);
    list.replaceChildren();
    if (!input.value.trim() || !people.length) {
      list.hidden = !input.value.trim();
      if (input.value.trim()) list.append(h('p', { className: 'ag-search-empty' }, '找不到相符的人物'));
      return;
    }
    list.hidden = false;
    const duplicateNameCounts = new Map<string, number>();
    for (const candidate of data.persons) {
      const forms = new Set(searchNameForms(candidate, input.value).map((form) => form.toLocaleLowerCase()));
      for (const form of forms) duplicateNameCounts.set(form, (duplicateNameCounts.get(form) ?? 0) + 1);
    }
    for (const person of people) {
      const hasDuplicateName = searchNameForms(person, input.value)
        .some((form) => (duplicateNameCounts.get(form.toLocaleLowerCase()) ?? 0) > 1);
      const qualifier = hasDuplicateName ? personQualifier(person, graph) : '';
      const item = h('button', { className: 'ag-search-result', type: 'button', role: 'option' },
        h('strong', {}, person.name),
        qualifier ? h('span', { className: 'ag-search-qualifier' }, `（${qualifier}）`) : null,
        h('small', {}, firstReference(person) || '尚無經節'));
      item.addEventListener('click', () => {
        input.value = person.name;
        close();
        onChoose(person);
      });
      list.append(item);
    }
  });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowDown') list.querySelector<HTMLButtonElement>('button')?.focus();
  });
  wrapper.addEventListener('focusout', (event) => {
    if (!wrapper.contains(event.relatedTarget as Node | null)) window.setTimeout(close, 80);
  });
  return { el: wrapper, close };
}
