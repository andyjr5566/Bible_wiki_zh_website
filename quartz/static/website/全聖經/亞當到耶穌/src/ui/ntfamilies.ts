import type { Family, GenealogyData, Person } from '../data/types';
import { buildGraph } from '../data/model';
import { h, svgEl } from './dom';

export interface FamilyGraphNode {
  person: Person;
  depth: number;
  x: number;
  y: number;
  width: number;
}

export interface FamilyGraphEdge { from: string; to: string }

export interface FamilyGraphLayout {
  nodes: FamilyGraphNode[];
  parentEdges: FamilyGraphEdge[];
  spouseEdges: FamilyGraphEdge[];
  width: number;
  height: number;
}

export interface FamilyPageController {
  el: HTMLElement;
  hasPerson(id: string): boolean;
  groupIdFor(id: string): string | null;
  focusPerson(id: string): void;
  highlightPerson(id: string | null): void;
}

export function createNTFamilies(data: GenealogyData, onPerson: (id: string, groupId: string) => void): FamilyPageController {
  const root = h('section', { className: 'ag-page ag-families-page' },
    h('div', { className: 'ag-page-heading' }, h('div', {}, h('p', { className: 'ag-eyebrow' }, '新約中的家族'), h('h1', {}, '新約家族')),
      h('p', {}, '每張小圖只展開資料明列的親屬關係。連得上主線的人可回到家譜樹查看。')));
  const families = data.ntFamilies ?? [];
  const groupIdByPerson = new Map<string, string>();
  if (!families.length) {
    root.append(h('div', { className: 'ag-empty-state' }, h('strong', {}, '目前沒有新約家族資料')));
    return { el: root, hasPerson: () => false, groupIdFor: () => null, focusPerson: () => {}, highlightPerson: () => {} };
  }
  const graph = buildGraph(data);
  for (const family of families) {
    const card = createFamilyCard(data, family, onPerson, graph);
    root.append(card);
    for (const id of family.members ?? family.roots ?? []) groupIdByPerson.set(id, family.id);
    for (const node of card.querySelectorAll<SVGGElement>('[data-family-person-id]')) {
      const id = node.dataset.familyPersonId;
      if (id) groupIdByPerson.set(id, family.id);
    }
  }
  const focusPerson = (id: string) => {
    const groupId = groupIdByPerson.get(id);
    const target = [...root.querySelectorAll<HTMLElement>('[data-family-card-id]')]
      .find((element) => element.dataset.familyCardId === groupId);
    if (!target) return;
    scrollFamilyNodeIntoView(target, id);
  };
  const highlightPerson = (id: string | null) => {
    const animate = document.documentElement.dataset.motion !== 'off';
    for (const node of root.querySelectorAll<HTMLElement>('[data-family-person-id]')) {
      const match = node.dataset.familyPersonId === id;
      node.classList.toggle('ag-family-node-highlighted', match);
      node.classList.toggle('ag-family-node-current', match && animate);
    }
  };
  return {
    el: root,
    hasPerson: (id) => groupIdByPerson.has(id),
    groupIdFor: (id) => groupIdByPerson.get(id) ?? null,
    focusPerson,
    highlightPerson,
  };
}

export function createFamilyCard(
  data: GenealogyData,
  family: Family,
  onPerson: (id: string, groupId: string) => void,
  graph = buildGraph(data),
): HTMLElement {
  const members = familyMembers(family, graph);
  const layout = layoutFamilyGraph([...members.values()]);
  const svg = svgEl('svg', {
    class: 'ag-family-svg', role: 'img', 'aria-label': `${family.title}家族圖`,
    width: layout.width, height: layout.height, viewBox: `0 0 ${layout.width} ${layout.height}`,
  });
  svg.style.width = `calc(${layout.width}px * var(--ag-fs))`;
  svg.style.height = `calc(${layout.height}px * var(--ag-fs))`;
  const edgeLayer = svgEl('g', { class: 'ag-family-edges' });
  const nodeLayer = svgEl('g', { class: 'ag-family-nodes' });
  const nodesById = new Map(layout.nodes.map((node) => [node.person.id, node]));
  for (const edge of layout.parentEdges) {
    const parent = nodesById.get(edge.from);
    const child = nodesById.get(edge.to);
    if (!parent || !child) continue;
    const startY = parent.y + 17;
    const endY = child.y - 17;
    const midY = (startY + endY) / 2;
    edgeLayer.append(svgEl('path', {
      class: 'ag-family-edge ag-family-parent-edge',
      'data-parent-id': edge.from, 'data-child-id': edge.to,
      d: `M${parent.x} ${startY} V${midY} H${child.x} V${endY}`,
    }));
  }
  for (const edge of layout.spouseEdges) {
    const first = nodesById.get(edge.from);
    const second = nodesById.get(edge.to);
    if (!first || !second || first.depth !== second.depth) continue;
    const left = first.x < second.x ? first : second;
    const right = left === first ? second : first;
    edgeLayer.append(svgEl('path', {
      class: 'ag-family-edge ag-family-spouse-edge',
      'data-spouse-a-id': edge.from, 'data-spouse-b-id': edge.to,
      d: `M${left.x + left.width / 2} ${left.y} H${right.x - right.width / 2}`,
    }));
  }
  for (const node of layout.nodes) {
    const person = node.person;
    const group = svgEl('g', { class: 'ag-family-node', transform: `translate(${node.x} ${node.y})`, tabindex: '0', role: 'button', 'aria-label': person.name, 'data-family-person-id': person.id });
    group.append(svgEl('rect', { x: -node.width / 2, y: -17, width: node.width, height: 34, rx: 7 }));
    const label = svgEl('text', { 'text-anchor': 'middle', 'dominant-baseline': 'central' }); label.textContent = person.name;
    group.append(label);
    group.addEventListener('click', () => onPerson(person.id, family.id));
    group.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onPerson(person.id, family.id); } });
    nodeLayer.append(group);
  }
  svg.append(edgeLayer, nodeLayer);
  const diagram = h('div', { className: 'ag-family-scroll', 'data-family-diagram': family.id }, svg);
  const card = h('article', { className: 'ag-family-card', 'data-family-card-id': family.id },
    h('header', {}, h('div', {}, h('p', { className: 'ag-eyebrow' }, `${members.size} 位人物`), h('h2', {}, family.title)),
      family.imported ? h('span', { className: 'ag-family-imported' }, '歷代志上族譜頁') : null,
      family.intro ? h('p', {}, family.intro) : null),
    diagram);
  const mainline = [...members.values()].filter((person) => graph.spineIds.has(person.id));
  if (mainline.length) {
    const shortcuts = h('div', { className: 'ag-chip-list' }, ...mainline.map((person) => {
      const action = h('button', { className: 'ag-person-link', type: 'button' }, person.name);
      action.addEventListener('click', () => onPerson(person.id, family.id));
      return action;
    }));
    card.append(shortcuts);
  }
  return card;
}

export function layoutFamilyGraph(people: Person[]): FamilyGraphLayout {
  const members = [...new Map(people.map((person) => [person.id, person])).values()];
  const memberIds = new Set(members.map((person) => person.id));
  const parents = new Map(members.map((person) => [person.id, [...new Set((person.parents ?? []).map((relation) => relation.id).filter((id) => memberIds.has(id)))]]));
  const depths = new Map<string, number>();
  const depthFor = (id: string, trail = new Set<string>()): number => {
    const known = depths.get(id);
    if (known !== undefined) return known;
    if (trail.has(id)) return -1;
    const nextTrail = new Set(trail).add(id);
    const parentDepths = (parents.get(id) ?? []).map((parentId) => depthFor(parentId, nextTrail));
    const depth = Math.max(-1, ...parentDepths) + 1;
    depths.set(id, depth);
    return depth;
  };
  for (const person of members) depthFor(person.id);

  const widths = new Map(members.map((person) => [person.id,
    Math.max(82, [...person.name].reduce((sum, char) => sum + (char.codePointAt(0)! > 0x2e80 ? 13 : 7.5), 0) + 28),
  ]));
  const depthGroups = new Map<number, Person[]>();
  for (const person of members) {
    const depth = depths.get(person.id) ?? 0;
    depthGroups.set(depth, [...(depthGroups.get(depth) ?? []), person]);
  }
  const positions = new Map<string, FamilyGraphNode>();
  let graphWidth = 0;
  const top = 38;
  const layerGap = 86;
  for (const [depth, layer] of [...depthGroups].sort(([a], [b]) => a - b)) {
    const layerIds = new Set(layer.map((person) => person.id));
    const parentPosition = (person: Person) => {
      const values = (parents.get(person.id) ?? []).map((parentId) => positions.get(parentId)?.x).filter((x): x is number => x !== undefined);
      return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    };
    const parentIndex = new Map(layer.map((person, index) => [person.id, index]));
    const clusterParent = new Map<string, string>();
    for (const person of layer) clusterParent.set(person.id, person.id);
    const find = (id: string): string => {
      const parent = clusterParent.get(id);
      if (!parent || parent === id) { clusterParent.set(id, id); return id; }
      const root = find(parent);
      clusterParent.set(id, root);
      return root;
    };
    const union = (a: string, b: string) => {
      const first = find(a);
      const second = find(b);
      if (first !== second) clusterParent.set(second, first);
    };
    for (const person of layer) {
      for (const spouse of person.spouses ?? []) if (layerIds.has(spouse.id)) union(person.id, spouse.id);
    }
    const clusters = new Map<string, Person[]>();
    for (const person of layer) {
      const key = find(person.id);
      clusters.set(key, [...(clusters.get(key) ?? []), person]);
    }
    const orderedClusters = [...clusters.values()].map((cluster) => cluster.sort((a, b) =>
      parentPosition(a) - parentPosition(b) || (parentIndex.get(a.id)! - parentIndex.get(b.id)!)))
      .sort((a, b) => a.reduce((sum, person) => sum + parentPosition(person), 0) / a.length - b.reduce((sum, person) => sum + parentPosition(person), 0) / b.length ||
        (parentIndex.get(a[0]!.id)! - parentIndex.get(b[0]!.id)!));

    let cursor = 28;
    for (const cluster of orderedClusters) {
      for (let index = 0; index < cluster.length; index += 1) {
        const person = cluster[index]!;
        const width = widths.get(person.id)!;
        positions.set(person.id, { person, depth, x: cursor + width / 2, y: top + depth * layerGap, width });
        cursor += width + (index < cluster.length - 1 ? 16 : 38);
      }
    }
    graphWidth = Math.max(graphWidth, cursor + 4);
  }

  const parentEdges: FamilyGraphEdge[] = [];
  const spouseEdges: FamilyGraphEdge[] = [];
  const spouseKeys = new Set<string>();
  for (const person of members) {
    for (const parentId of parents.get(person.id) ?? []) parentEdges.push({ from: parentId, to: person.id });
    for (const spouse of person.spouses ?? []) {
      if (!memberIds.has(spouse.id) || depths.get(spouse.id) !== depths.get(person.id)) continue;
      const key = [person.id, spouse.id].sort().join('\u0000');
      if (spouseKeys.has(key)) continue;
      spouseKeys.add(key);
      spouseEdges.push({ from: person.id, to: spouse.id });
    }
  }
  const maxDepth = Math.max(0, ...depths.values());
  return { nodes: [...positions.values()], parentEdges, spouseEdges, width: Math.max(96, graphWidth), height: top + maxDepth * layerGap + 56 };
}

export function scrollFamilyNodeIntoView(card: HTMLElement, id: string): void {
  const container = card.querySelector<HTMLElement>('.ag-family-scroll');
  const target = [...card.querySelectorAll<SVGGElement>('[data-family-person-id]')]
    .find((node) => node.dataset.familyPersonId === id);
  if (!container || !target) return;
  const viewport = container.getBoundingClientRect();
  const node = target.getBoundingClientRect();
  const margin = 24;
  let left = container.scrollLeft;
  let top = container.scrollTop;
  if (node.left < viewport.left + margin || node.right > viewport.right - margin) {
    left = node.left - viewport.left + container.scrollLeft - (container.clientWidth - node.width) / 2;
  }
  if (node.top < viewport.top + margin || node.bottom > viewport.bottom - margin) {
    top = node.top - viewport.top + container.scrollTop - (container.clientHeight - node.height) / 2;
  }
  if (left !== container.scrollLeft || top !== container.scrollTop) container.scrollTo({ left, top, behavior: 'smooth' });
}

function familyMembers(family: Family, graph: ReturnType<typeof buildGraph>): Map<string, Person> {
  if (family.members) {
    return new Map(family.members.map((id) => graph.byId.get(id)).filter((person): person is Person => Boolean(person)).map((person) => [person.id, person]));
  }
  const members = new Map<string, Person>();
  const queue = [...(family.roots ?? [])];
  const limit = Math.max(1, Math.min(120, Number(family.count ?? 60)));
  while (queue.length && members.size < limit) {
    const id = queue.shift()!;
    if (members.has(id)) continue;
    const person = graph.byId.get(id);
    if (!person) continue;
    members.set(id, person);
    queue.push(...(graph.children.get(id) ?? []));
  }
  return members;
}

