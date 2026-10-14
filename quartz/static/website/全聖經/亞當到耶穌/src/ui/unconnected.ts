import type { Family, GenealogyData, Person } from '../data/types';
import { buildGraph, firstReference } from '../data/model';
import { h } from './dom';
import { createFamilyCard, scrollFamilyNodeIntoView } from './ntfamilies';

interface FamilyGroup {
  root: Person;
  members: Person[];
}

export interface UnattachedGroups {
  people: Person[];
  families: FamilyGroup[];
  singles: Person[];
}

export interface UnconnectedFamiliesPage {
  el: HTMLElement;
  hasPerson(id: string): boolean;
  groupIdFor(id: string): string | null;
  focusPerson(id: string): void;
  highlightPerson(id: string | null): void;
}

export function groupUnattachedPeople(data: GenealogyData, graph = buildGraph(data)): UnattachedGroups {
  const people = (data.unattached ?? []).map((id) => graph.byId.get(id)).filter((person): person is Person => Boolean(person));
  const eligible = new Set(people.map((person) => person.id));
  const hasListedTreeParent = new Set<string>();
  for (const [parentId, childIds] of graph.children) {
    if (!eligible.has(parentId)) continue;
    for (const childId of childIds) if (eligible.has(childId)) hasListedTreeParent.add(childId);
  }

  const roots = people.filter((person) => !hasListedTreeParent.has(person.id));
  const assigned = new Set<string>();
  const families: FamilyGroup[] = [];
  const singles: Person[] = [];
  const collect = (root: Person): Person[] => {
    const members: Person[] = [];
    const visited = new Set<string>();
    const queue = [root.id];
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id) || assigned.has(id) || !eligible.has(id)) continue;
      visited.add(id);
      members.push(graph.byId.get(id)!);
      queue.push(...(graph.children.get(id) ?? []));
    }
    for (const person of members) assigned.add(person.id);
    return members;
  };

  const assignRoot = (root: Person) => {
    const members = collect(root);
    if (members.length > 1) families.push({ root, members });
    else if (members.length === 1) singles.push(root);
  };
  for (const root of roots) assignRoot(root);
  // Keep malformed or cyclic records visible, while still assigning each listed person once.
  for (const person of people) if (!assigned.has(person.id)) assignRoot(person);

  families.sort((a, b) => b.members.length - a.members.length || a.root.name.localeCompare(b.root.name, 'zh-Hant'));
  singles.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant') || firstReference(a).localeCompare(firstReference(b)));
  return { people, families, singles };
}

export function createUnconnectedFamilies(data: GenealogyData, onPerson: (id: string, groupId: string) => void): UnconnectedFamiliesPage {
  const graph = buildGraph(data);
  const unattached = groupUnattachedPeople(data, graph);
  const groupIdByPerson = new Map<string, string>();
  const page = h('section', { className: 'ag-page ag-unconnected-page' },
    h('div', { className: 'ag-page-heading' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '歷代志與其他支派名單'), h('h1', {}, '接不上主線的家族')),
      h('p', {}, '以下人物依資料中的家譜樹關係分組；沒有子女的源頭集中列在單獨記載的人物中。')),
    h('p', { className: 'ag-unconnected-count' }, `${unattached.people.length} 位人物 · ${unattached.families.length} 組家族`));

  for (let index = 0; index < unattached.families.length; index += 1) {
    const group = unattached.families[index]!;
    const id = `unconnected-${index}`;
    for (const person of group.members) groupIdByPerson.set(person.id, id);
    const family: Family = {
      id,
      title: `${group.root.name}（${firstReference(group.root) || '未見經節'}）`,
      roots: [group.root.id],
      members: group.members.map((person) => person.id),
      imported: group.root.imported,
    };
    const card = createFamilyCard(data, family, (personId) => onPerson(personId, id), graph);
    card.dataset.unconnectedGroup = id;
    page.append(card);
  }

  if (unattached.singles.length) {
    const id = 'unconnected-singles';
    for (const person of unattached.singles) groupIdByPerson.set(person.id, id);
    const list = h('div', { className: 'ag-unconnected-singles', 'data-unconnected-group': id },
      h('p', { className: 'ag-eyebrow' }, `${unattached.singles.length} 位人物`), h('h2', {}, '其他單獨記載的人'),
      h('ul', {}, ...unattached.singles.map((person) => {
        const ref = firstReference(person);
        const action = h('button', { className: 'ag-person-link', type: 'button', 'data-family-person-id': person.id }, `${person.name}${ref ? `（${ref}）` : ''}`);
        action.addEventListener('click', () => onPerson(person.id, id));
        return h('li', {}, action);
      })));
    page.append(list);
  }

  if (!unattached.people.length) page.append(h('div', { className: 'ag-empty-state' }, h('strong', {}, '目前沒有未接上主線的人物')));
  return {
    el: page,
    hasPerson: (id) => groupIdByPerson.has(id),
    groupIdFor: (id) => groupIdByPerson.get(id) ?? null,
    highlightPerson(id) {
      const animate = document.documentElement.dataset.motion !== 'off';
      for (const node of page.querySelectorAll<HTMLElement>('[data-family-person-id]')) {
        const match = node.dataset.familyPersonId === id;
        // 圖上的節點（SVG）和名單上的名字（HTML）用不同的標亮樣式；
        // 脈衝動畫的 transform 會蓋掉 SVG 節點的位置，所以不能混用
        if (node instanceof SVGElement) {
          node.classList.toggle('ag-family-node-highlighted', match);
          node.classList.toggle('ag-family-node-current', match && animate);
        } else {
          node.classList.toggle('ag-family-person-highlighted', match);
          node.classList.toggle('ag-family-person-current', match && animate);
        }
      }
    },
    focusPerson(id) {
      const groupId = groupIdByPerson.get(id);
      if (!groupId) return;
      const target = [...page.querySelectorAll<HTMLElement>('[data-unconnected-group]')]
        .find((element) => element.dataset.unconnectedGroup === groupId);
      if (!target) return;
      scrollFamilyNodeIntoView(target, id);
    },
  };
}
