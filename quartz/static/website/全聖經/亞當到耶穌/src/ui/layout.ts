import { hierarchy, tree } from 'd3-hierarchy';
import { branchRoots, buildGraph, descendantCount as countUnder, firstReference, isPlacementNode } from '../data/model';
import type { GenealogyData, Person } from '../data/types';

export const MAIN_NODE_W = 96;
export const MAIN_NODE_H = 48;
export const SIDE_NODE_W = 96;
export const SIDE_NODE_H = 46;
export const ROW_H = 82;
export const COLUMN_W = 320;
const SIDE_GAP_X = 24;
const SIDE_LEVEL_GAP_X = 52;
const SIDE_ROW_STEP = 82;
const ROW_TREE_PADDING = 20;
/** 疊在妻子上面的祖先小卡：高度與間距 */
const CHIP_H = 26;
const CHIP_GAP = 16;
const CHIP_STEP = CHIP_H + CHIP_GAP;

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rectX: number;
  rectWidth: number;
  rectHeight: number;
  sideRoot?: string;
  mainline: boolean;
  collapsed?: boolean;
  expandedRoot?: boolean;
  descendantCount?: number;
  segment?: string;
  groupLabel?: string;
  groupKey?: string;
  groupMembers?: string[];
  groupLine?: string;
  groupParentId?: string;
  syntheticParent?: string;
  /** 疊在妻子上面的祖先小卡（亞米忽 → 達買 → 瑪迦） */
  chip?: boolean;
  /** 接到這一欄的線在哪裡轉彎（緊貼在這一欄前面，同一欄共用一條直線） */
  busX?: number;
}

export interface LayoutEdge {
  from: string;
  to: string;
  kind: 'parent' | 'mother' | 'descends' | 'list' | 'member' | 'kin';
  line: string;
  key: string;
  /** 不是父子的線，在靠近對方那頭標出關係（妻子、妹子、母親、後代……） */
  label?: string;
}

export interface CanvasLayout {
  nodes: LayoutNode[];
  groups: LayoutNode[];
  edges: LayoutEdge[];
  regions: Array<{ id: string; title: string; x0: number; y0: number; x1: number; y1: number }>;
  /** 夫妻、母子分在大圖兩處、沒畫線的：在 id 的名字上方標「妻子：某某」「母親：某某」，點了跳到 other */
  farLinks: Array<{ id: string; other: string; label: string }>;
  segments: Array<{ title: string; y0: number; y1: number; line: string; labelX: number }>;
  bounds: { x: number; y: number; width: number; height: number };
  durationMs: number;
}

interface BranchDatum {
  person: Person | null;
  rootId?: string;
  groupKey?: string;
  groupLabel?: string;
  groupMembers?: string[];
  groupLine?: string;
  groupParentId?: string;
  children: BranchDatum[];
}

interface BranchPlacement {
  person: Person | null;
  id: string;
  rootId: string;
  depth: number;
  vertical: number;
  collapsed: boolean;
  expandedRoot: boolean;
  descendantCount: number;
  groupLabel?: string;
  groupKey?: string;
  groupMembers?: string[];
  groupLine?: string;
  groupParentId?: string;
  inGroup?: boolean;
  chip?: boolean;
  /** 同一排並列的小卡，左右錯開的距離 */
  dx?: number;
  metrics: NodeMetrics;
}

interface NodeMetrics {
  width: number;
  height: number;
  rectX: number;
  rectWidth: number;
  rectHeight: number;
}

interface BranchForest {
  parentId: string;
  /** 第一層往外多推的距離（避開分岔處往下走的主線） */
  pushOut?: number;
  direction: -1 | 1;
  roots: string[];
  placements: BranchPlacement[];
  height: number;
  levelWidths: Map<number, number>;
  groupKey?: string;
  grouped?: boolean;
}

const lineColorKey = (person: Person): string => {
  const lines = person.lines ?? [];
  return lines.includes('common') ? 'common' : lines.includes('馬太') ? '馬太' : lines.includes('路加') ? '路加' : 'common';
};

function textWidth(text: string, fontSize: number): number {
  return Array.from(text).reduce((width, char) => width + (/[\u0000-\u00ff]/.test(char) ? fontSize * 0.58 : fontSize), 0);
}

function markText(person: Person): string {
  return (person.marks ?? []).map((item) => item.label).filter(Boolean).join('／');
}

function nodeMetrics(person: Person, mainline: boolean, control = false): NodeMetrics {
  const minWidth = mainline ? MAIN_NODE_W : SIDE_NODE_W;
  const rectHeight = mainline ? MAIN_NODE_H : SIDE_NODE_H;
  const subtitle = person.qualifier || firstReference(person) || '';
  const mark = markText(person);
  const labelWidth = Math.max(textWidth(person.name, 15), textWidth(subtitle, 11));
  const badgeWidth = mark ? textWidth(mark, 10) + 18 : 0;
  const rectWidth = Math.max(minWidth, Math.ceil(labelWidth + 28), Math.ceil(badgeWidth));
  const extraWidth = control ? 24 : 0;
  return {
    width: rectWidth + extraWidth,
    height: rectHeight + (mark ? 20 : 0),
    rectX: -((rectWidth + extraWidth) / 2),
    rectWidth,
    rectHeight,
  };
}

// 名單牌子與區域：標題較長，下面一行是經節範圍
function plaqueMetrics(person: Person, control: boolean): NodeMetrics {
  const rectWidth = Math.max(SIDE_NODE_W + 24, Math.ceil(Math.max(textWidth(person.name, 14), textWidth(person.qualifier ?? '', 11)) + 36));
  const rectHeight = person.kind === 'region' ? 54 : 48;
  const extraWidth = control ? 24 : 0;
  return { width: rectWidth + extraWidth, height: rectHeight, rectX: -((rectWidth + extraWidth) / 2), rectWidth, rectHeight };
}

function groupNodeMetrics(label: string): NodeMetrics {
  const rectWidth = Math.max(104, Math.ceil(textWidth(label, 12) + 28));
  const rectHeight = 34;
  return { width: rectWidth, height: rectHeight, rectX: -rectWidth / 2, rectWidth, rectHeight };
}

// 妻子的「↗」卡和一般人物卡同樣大小；「母親未記載」是膠囊
function metricsFor(person: Person, control: boolean): NodeMetrics {
  if (person.kind === 'no-mother') {
    const base = groupNodeMetrics(person.name);
    const extraWidth = control ? 24 : 0;
    return { ...base, width: base.rectWidth + extraWidth, rectX: -((base.rectWidth + extraWidth) / 2) };
  }
  return isPlacementNode(person) ? plaqueMetrics(person, control) : nodeMetrics(person, false, control);
}

function chipMetrics(person: Person): NodeMetrics {
  const rectWidth = Math.max(64, Math.ceil(textWidth(person.name, 13) + 22));
  return { width: rectWidth, height: CHIP_H, rectX: -rectWidth / 2, rectWidth, rectHeight: CHIP_H };
}

/** 這個人底下排成「妻子一欄 → 兒女一欄」 */
const hasColumn = (graph: ReturnType<typeof buildGraph>, id: string) => (graph.children.get(id) ?? []).some((child) => graph.wifeSlots.has(child) || graph.noMother.has(child));
const inColumn = (graph: ReturnType<typeof buildGraph>, id: string) => graph.wifeSlots.has(id) || graph.noMother.has(id);

function buildForests(
  data: GenealogyData,
  graph: ReturnType<typeof buildGraph>,
  mainIds: Set<string>,
  expanded: Set<string>,
): BranchForest[] {
  // 每位主線人物左右各一片旁支；真正的子女超過三位時收成一個「N 位子女」，
  // 大圖安置掛上來的（母親、妻子、名單牌子、區域）另外排在子女後面，不算進子女數。
  const groups = new Map<string, { parentId: string; direction: -1 | 1; roots: string[]; extras: string[] }>();
  const rootOwner = new Set<string>();
  const rootCounts = new Map<string, number>();
  const clearColumn = new Set<string>();
  for (const { parentId, rootId } of branchRoots(data, graph)) {
    if (rootOwner.has(rootId)) continue;
    const rootPerson = graph.byId.get(rootId);
    const parent = graph.byId.get(parentId);
    if (!rootPerson || !parent) continue;
    rootOwner.add(rootId);
    const placement = graph.placed.get(rootId);
    const route = lineColorKey(rootPerson) !== 'common' ? lineColorKey(rootPerson) : lineColorKey(parent);
    const outward: -1 | 1 = route === '馬太' ? -1 : 1;
    // 有妻子一欄的人：妻子欄放在外側，其他掛在他旁邊的（名單牌子、姊妹、親屬）放到另一側，免得混進妻子欄。
    // 其他人照舊：母親、妻子放在另一側；只有共同主線（畫面中央）那段的另一側是空的，馬太、路加兩欄往中間放會撞到對面那一欄
    const column = hasColumn(graph, parentId);
    const opposite = column ? !inColumn(graph, rootId) : placement?.side === 'opposite' && !(graph.children.get(rootId) ?? []).length;
    const direction: -1 | 1 = opposite && lineColorKey(parent) === 'common' ? (-outward as -1 | 1) : outward;
    const key = `${parentId}\u0000${direction}`;
    const group = groups.get(key) ?? { parentId, direction, roots: [], extras: [] };
    // 主線在這裡分成馬太、路加兩欄時（大衛），左邊有馬太線往下走：放在左邊的母親、妻子要整組推到線外面
    // 右邊有路加線往下走時（大衛的妻子欄）也一樣，整組推到那一欄外面
    const splitLine = direction === -1 ? '馬太' : '路加';
    if ((graph.children.get(parentId) ?? []).some((id) => graph.spineIds.has(id) && lineColorKey(graph.byId.get(id)!) === splitLine)) {
      clearColumn.add(key);
    }
    if (placement && !inColumn(graph, rootId)) group.extras.push(rootId);
    else {
      group.roots.push(rootId);
      rootCounts.set(parentId, (rootCounts.get(parentId) ?? 0) + 1);
    }
    groups.set(key, group);
  }

  const globallyAssigned = new Set<string>();
  const forests: BranchForest[] = [];
  for (const group of groups.values()) {
    const localAssigned = new Set<string>();
    const allRoots = [...group.roots, ...group.extras];
    const descendantCount = new Map(allRoots.map((id) => [id, countUnder(id, graph)]));
    // 有妻子一欄的人不再收成「N 位子女」：每位妻子（和「母親未記載」）各自收合
    const grouped = !hasColumn(graph, group.parentId) && (rootCounts.get(group.parentId) ?? 0) > 3 && group.roots.length > 1;
    const groupKey = `siblings:${group.parentId}:${group.direction}`;
    const groupOpen = grouped && (expanded.has(groupKey) || group.roots.every((id) => expanded.has(id)));
    const makeBranch = (id: string, rootId: string, includeChildren: boolean): BranchDatum | null => {
      if (mainIds.has(id) || globallyAssigned.has(id) || localAssigned.has(id)) return null;
      const person = graph.byId.get(id);
      if (!person) return null;
      localAssigned.add(id);
      // 名單牌子和區域各自展開收合：上一層打開了，牌子底下的人還是要再點牌子才出來
      const open = isPlacementNode(person) ? expanded.has(id) : includeChildren;
      // 直接掛在主線人物旁邊的妻子（和「母親未記載」）：打開時只露出兒女，每個兒女再各自展開
      const hubRoot = rootId === id && inColumn(graph, id);
      const children = open
        ? (graph.children.get(id) ?? []).map((childId) => hubRoot ? makeBranch(childId, childId, expanded.has(childId)) : makeBranch(childId, rootId, true))
          .filter((item): item is BranchDatum => Boolean(item))
        : [];
      return { person, rootId, children };
    };
    const members = groupOpen
      ? group.roots.map((rootId) => makeBranch(rootId, rootId, expanded.has(rootId))).filter((item): item is BranchDatum => Boolean(item))
      : [];
    const firstRoot = graph.byId.get(group.roots[0] ?? group.extras[0]!);
    const parentPerson = graph.byId.get(group.parentId)!;
    const line = firstRoot && lineColorKey(firstRoot) !== 'common' ? lineColorKey(firstRoot) : lineColorKey(parentPerson);
    const extraData = group.extras.map((rootId) => makeBranch(rootId, rootId, expanded.has(rootId))).filter((item): item is BranchDatum => Boolean(item));
    const rootData = grouped
      ? [{ person: null, rootId: group.parentId, groupKey, groupLabel: groupOpen ? `收合 ${group.roots.length} 位子女 −` : `${group.roots.length} 位子女 ＋`,
        groupMembers: group.roots, groupLine: line, groupParentId: group.parentId, children: members }, ...extraData]
      : [...group.roots.map((rootId) => makeBranch(rootId, rootId, expanded.has(rootId))).filter((item): item is BranchDatum => Boolean(item)), ...extraData];
    for (const id of localAssigned) globallyAssigned.add(id);
    if (!rootData.length) continue;
    const datum: BranchDatum = { person: null, children: rootData };
    const root = hierarchy(datum, (item) => item.children);
    // 妻子上面疊著祖先小卡的，和上一位之間多留那一疊的高度
    const chipsAbove = (item: { data: BranchDatum }) => (item.data.person ? graph.ancestry.get(item.data.person.id)?.length ?? 0 : 0) * CHIP_STEP;
    const chipsBelow = (item: { data: BranchDatum }) => (item.data.person ? graph.otherHusbands.get(item.data.person.id)?.length ?? 0 : 0) * CHIP_STEP;
    const laidOut = tree<BranchDatum>().nodeSize([SIDE_ROW_STEP, 1])
      // d3 呼叫時兩個參數的上下順序不固定，兩種順序取大的
      .separation((a, b) => (a.parent === b.parent ? 1 : 2) + Math.max(chipsAbove(b) + chipsBelow(a), chipsAbove(a) + chipsBelow(b)) / SIDE_ROW_STEP)(root);
    const visible = laidOut.descendants().filter((item) => item.data.person || item.data.groupLabel);
    const metricsOf = (item: typeof visible[number]) => item.data.groupLabel
      ? groupNodeMetrics(item.data.groupLabel)
      : isPlacementNode(item.data.person) || item.data.person?.kind === 'no-mother' ? metricsFor(item.data.person!, true)
        : nodeMetrics(item.data.person!, false, item.data.rootId === item.data.person!.id && expanded.has(item.data.rootId));
    const top = Math.min(...visible.map((item) => {
      return item.x - metricsOf(item).height / 2 - chipsAbove(item);
    }));
    const bottom = Math.max(...visible.map((item) => {
      return item.x + metricsOf(item).height / 2 + chipsBelow(item);
    }));
    const center = (top + bottom) / 2;
    const levelWidths = new Map<number, number>();
    const placements = visible.flatMap((item): BranchPlacement[] => [placementOf(item), ...chipsOf(item)]);
    // 妻子上面一排一排的祖先小卡（同一排並列），下面是他另一位丈夫的小卡
    function chipsOf(item: typeof visible[number]): BranchPlacement[] {
      const id = item.data.person?.id;
      if (!id) return [];
      const rows = graph.ancestry.get(id) ?? [];
      const below = graph.otherHusbands.get(id) ?? [];
      const cardTop = item.x - metricsOf(item).height / 2;
      const cardBottom = item.x + metricsOf(item).height / 2;
      const chip = (personId: string, vertical: number, dx = 0): BranchPlacement => {
        const person = graph.byId.get(personId)!;
        return { person, id: personId, rootId: item.data.rootId!, depth: item.depth, vertical: vertical - center, dx,
          collapsed: false, expandedRoot: false, descendantCount: 0, chip: true, metrics: chipMetrics(person) };
      };
      const above = rows.flatMap((row, index) => {
        const y = cardTop - CHIP_GAP - CHIP_H / 2 - (rows.length - 1 - index) * CHIP_STEP;
        const step = Math.max(...row.map((personId) => chipMetrics(graph.byId.get(personId)!).rectWidth)) + 10;
        return row.map((personId, column) => chip(personId, y, (column - (row.length - 1) / 2) * step));
      });
      return [...above, ...below.map((personId, index) => chip(personId, cardBottom + CHIP_GAP + CHIP_H / 2 + index * CHIP_STEP))];
    }
    function placementOf(item: typeof visible[number]): BranchPlacement {
      if (item.data.groupLabel && item.data.groupKey) {
        const metrics = groupNodeMetrics(item.data.groupLabel);
        levelWidths.set(item.depth, Math.max(levelWidths.get(item.depth) ?? 0, metrics.width));
        return {
          person: null, id: item.data.groupKey, rootId: group.parentId, depth: item.depth, vertical: item.x - center,
          collapsed: !groupOpen, expandedRoot: groupOpen, descendantCount: group.roots.length,
          groupLabel: item.data.groupLabel, groupKey: item.data.groupKey, groupMembers: item.data.groupMembers,
          groupLine: item.data.groupLine, groupParentId: item.data.groupParentId, metrics,
        };
      }
      const person = item.data.person!;
      const rootId = item.data.rootId!;
      const isRoot = rootId === person.id;
      // 旁支的根和名單牌子、區域都可以單獨展開收合
      const toggles = isRoot || isPlacementNode(person);
      const count = toggles ? (descendantCount.get(person.id) ?? countUnder(person.id, graph)) : 0;
      const isOpen = toggles && count > 0 && expanded.has(person.id);
      const hasControl = toggles && (isOpen || count > 0);
      const metrics = metricsFor(person, hasControl);
      levelWidths.set(item.depth, Math.max(levelWidths.get(item.depth) ?? 0, metrics.width));
      return {
        person,
        id: person.id,
        rootId,
        depth: item.depth,
        vertical: item.x - center,
        collapsed: toggles && !isOpen && count > 0,
        expandedRoot: isOpen,
        descendantCount: count,
        inGroup: Boolean(item.parent?.data.groupKey),
        metrics,
      };
    }
    forests.push({
      parentId: group.parentId,
      direction: group.direction,
      roots: group.roots,
      placements,
      height: bottom - top + ROW_TREE_PADDING,
      levelWidths,
      ...(grouped ? { groupKey } : {}),
      grouped,
      pushOut: clearColumn.has(`${group.parentId}\u0000${group.direction}`) ? COLUMN_W : 0,
    });
  }
  return forests;
}

function buildEdges(data: GenealogyData, graph: ReturnType<typeof buildGraph>, visibleIds: Set<string>, nodesById: Map<string, LayoutNode>, farLinks: CanvasLayout['farLinks'] = []): LayoutEdge[] {
  const result: LayoutEdge[] = [];
  const seen = new Set<string>();
  const witnessLines = new Map((data.witnesses ?? []).map((witness) => [witness.id, witness.line ?? 'common']));
  const add = (from: string, to: string, kind: LayoutEdge['kind'], line: string, label?: string) => {
    const key = `${from}\u0000${to}\u0000${kind}\u0000${line}`;
    if (seen.has(key) || !visibleIds.has(from) || !visibleIds.has(to)) return;
    seen.add(key);
    result.push({ from, to, kind, line, key, ...(label ? { label } : {}) });
  };
  const far = (id: string, other: string, label: string) => {
    if (visibleIds.has(id) && !farLinks.some((item) => item.id === id && item.other === other)) farLinks.push({ id, other, label });
  };
  const lineOf = (id: string) => { const person = graph.byId.get(id); return person ? lineColorKey(person) : 'common'; };
  for (const person of data.persons) {
    const line = lineColorKey(person);
    const tree = graph.treeParent.get(person.id);
    const parents = person.parents ?? [];
    const spine = graph.spineIds.has(person.id);
    // 掛在妻子欄底下的兒女（瑪迦 → 押沙龍、「母親未記載」→ 益轄）：線從那張卡畫過來；
    // 父親那一條由「父親 → 妻子欄」代表，母親就是那張卡，都不再另外拉線
    const slot = tree === undefined ? undefined : graph.wifeSlots.get(tree);
    const capsuleOf = tree === undefined ? undefined : graph.noMother.get(tree);
    if (slot || capsuleOf) add(tree!, person.id, 'parent', line);
    for (const parent of parents) {
      if (slot && (parent.id === slot.husband || parent.id === slot.wife)) continue;
      if (capsuleOf && parent.id === capsuleOf) continue;
      const childNode = nodesById.get(person.id);
      const groupingNode = childNode?.syntheticParent ? nodesById.get(childNode.syntheticParent) : undefined;
      if (groupingNode?.groupParentId === parent.id) continue;
      const kind = /母|mother/i.test(`${parent.role ?? ''} ${parent.type ?? ''}`) ? 'mother' : 'parent';
      // 只畫排在一起的父母線：主線上的父子、掛在父母底下的人、疊在妻子上面的祖先（亞米忽 → 達買 → 瑪迦）。
      // 其他（父母排在別處）不拉橫跨畫面的長線，改在名字上方標「父親：某某」「母親：某某」，點了跳過去
      const chip = graph.treeParent.get(parent.id) === person.id || (tree !== undefined && graph.treeParent.get(parent.id) === tree && (graph.ancestry.get(tree) ?? []).flat().includes(parent.id));
      const near = spine ? graph.spineIds.has(parent.id) : parent.id === tree || chip;
      if (!near) {
        far(person.id, parent.id, kind === 'mother' ? '母親' : '父親');
        continue;
      }
      const source = String(parent.witness ?? parent.source ?? '');
      const relationLine = String(parent.line ?? witnessLines.get(source) ?? '');
      const refLine = /^太/.test(parent.ref ?? '') ? '馬太' : /^路/.test(parent.ref ?? '') ? '路加' : '';
      const edgeLine = ['common', '馬太', '路加'].includes(relationLine) ? relationLine : refLine || line;
      add(parent.id, person.id, kind, edgeLine, kind === 'mother' ? '母親' : undefined);
    }
    for (const ancestor of person.descends ?? []) {
      // 掛在那位祖先底下的畫虛線；祖先排在別處的（西羅非哈和瑪吉、基列）標「祖先：某某」
      if (ancestor.id === tree) add(ancestor.id, person.id, 'descends', line, ancestor.rel === '子孫' ? '子孫' : '後代');
      else if (graph.byId.has(ancestor.id)) far(person.id, ancestor.id, '祖先');
    }
  }
  for (const node of nodesById.values()) {
    if (node.groupParentId && node.groupKey) add(node.groupParentId, node.id, 'parent', node.groupLine ?? 'common');
    if (node.syntheticParent) {
      const person = data.persons.find((candidate) => candidate.id === node.id);
      if (person) add(node.syntheticParent, node.id, 'parent', lineColorKey(person));
    }
    // 丈夫 → 妻子欄的每一張卡（本人、「↗」卡、「母親未記載」）；母親 → 兒女欄裡主線兒女的「↗」卡
    const up = graph.treeParent.get(node.id);
    if (up && inColumn(graph, node.id)) add(up, node.id, 'parent', lineOf(up));
    if (up && graph.childRefs.has(node.id)) add(up, node.id, 'parent', lineOf(graph.childRefs.get(node.id)!));
  }
  // 大圖安置：名單牌子用點線掛在支派底下，牌子到各家用細線；區域不畫連到主線的線；
  // 靠兄弟姊妹、親屬掛上來的一家，畫出那條經文關係（妻子已經排進妻子欄的不再畫）
  for (const node of data.placements?.nodes ?? []) {
    if (node.kind === 'list') add(node.under, node.id, 'list', lineOf(node.under));
  }
  for (const item of data.placements?.items ?? []) {
    const under = graph.byId.get(item.under);
    if (under && (under.kind === 'list' || under.kind === 'family')) add(item.under, item.root, 'member', lineOf(item.root));
    if (!item.via || !['spouse', 'sibling', 'kin'].includes(item.via.kind)) continue;
    if (graph.treeParent.get(item.root) !== item.under || inColumn(graph, item.root)) continue;
    add(item.via.to, item.via.from, 'kin', lineOf(item.via.from), relationLabel(graph, item.via.from, item.via.to, item.via.kind));
  }
  // 經文記載的夫妻：妻子已經在丈夫的妻子欄裡，就不用再標；其他排在兩處的，在名字上方標「妻子：某某」「丈夫：某某」
  const slotPairs = new Set([...graph.wifeSlots].map(([slot, item]) => `${item.husband}|${item.wife}|${slot === item.wife ? 'own' : 'card'}`));
  const linked = new Set(result.flatMap((edge) => [`${edge.from}|${edge.to}`, `${edge.to}|${edge.from}`]));
  const done = new Set<string>();
  for (const person of data.persons) {
    for (const spouse of person.spouses ?? []) {
      const pair = [person.id, spouse.id].sort().join('|');
      if (done.has(pair) || spouse.id === person.id || !graph.byId.has(spouse.id)) continue;
      done.add(pair);
      if (linked.has(`${person.id}|${spouse.id}`)) continue;
      const adjacent = graph.treeParent.get(spouse.id) === person.id || graph.treeParent.get(person.id) === spouse.id;
      if (adjacent) continue;
      for (const [a, b] of [[person.id, spouse.id], [spouse.id, person.id]] as const) {
        // a 是丈夫、妻子欄裡有 b（本人或「↗」卡）：丈夫這邊不標；b 本人就在妻子欄：b 那邊也不標
        if (slotPairs.has(`${a}|${b}|own`) || slotPairs.has(`${a}|${b}|card`) || slotPairs.has(`${b}|${a}|own`)) continue;
        far(a, b, relationLabel(graph, b, a, 'spouse'));
      }
    }
  }  return result;
}

/** 線上的關係字：說的是 member 對 other 是什麼人（「妻子」＝member 是 other 的妻子）。 */
function relationLabel(graph: ReturnType<typeof buildGraph>, member: string, other: string, kind: string): string {
  const person = graph.byId.get(member);
  if (kind === 'spouse') {
    // 沒記性別的（亞倫、俄陀聶）看對方：對方是妻子，這一位就是丈夫
    const sex = person?.sex ?? (graph.byId.get(other)?.sex === 'f' ? 'm' : graph.byId.get(other)?.sex === 'm' ? 'f' : undefined);
    return sex === 'f' ? '妻子' : sex === 'm' ? '丈夫' : '配偶';
  }
  const field = kind === 'sibling' ? 'siblings' : 'kin';
  // 記在 member 自己身上、指向 other 的那一筆，rel 就是 member 對 other 的稱呼（例如葉忒羅是摩西的岳父）
  const own = (person?.[field] as Array<{ id: string; rel?: string }> | undefined)?.find((relation) => relation.id === other)?.rel;
  if (own && own !== '親屬' && own !== '親族') return own;
  if (kind === 'sibling') return person?.sex === 'f' ? '姊妹' : '兄弟';
  return '親屬';
}

/** 展開的區域畫一個框，把區域裡各家框在一起。 */
function regionFrames(graph: ReturnType<typeof buildGraph>, nodesById: Map<string, LayoutNode>): CanvasLayout['regions'] {
  const frames: CanvasLayout['regions'] = [];
  for (const node of nodesById.values()) {
    const person = graph.byId.get(node.id);
    if (person?.kind !== 'region' || !node.expandedRoot) continue;
    const inside: LayoutNode[] = [node];
    const stack = [...(graph.children.get(node.id) ?? [])];
    while (stack.length) {
      const id = stack.pop()!;
      const child = nodesById.get(id);
      if (!child) continue;
      inside.push(child);
      stack.push(...(graph.children.get(id) ?? []));
    }
    const pad = 22;
    frames.push({
      id: node.id, title: person.name,
      x0: Math.min(...inside.map((item) => item.x - item.width / 2)) - pad,
      y0: Math.min(...inside.map((item) => item.y - item.height / 2)) - pad,
      x1: Math.max(...inside.map((item) => item.x + item.width / 2)) + pad,
      y1: Math.max(...inside.map((item) => item.y + item.height / 2)) + pad,
    });
  }
  return frames;
}

function routeX(id: string, line: string, sharedIds: Set<string>): number {
  if (sharedIds.has(id)) return 0;
  return line === '馬太' ? -COLUMN_W : line === '路加' ? COLUMN_W : 0;
}

function positionSpine(
  data: GenealogyData,
  graph: ReturnType<typeof buildGraph>,
  expanded: Set<string>,
): { nodes: Map<string, LayoutNode>; segments: Array<{ title: string; y0: number; y1: number; line: string; labelX: number }>; mainIds: Set<string> } {
  const nodes = new Map<string, LayoutNode>();
  const mainRoutes = Object.values(data.spine.lines ?? {});
  const mainIds = new Set(mainRoutes.flat());
  const sharedIds = new Set(mainRoutes.length > 1
    ? mainRoutes.slice(1).reduce((shared, route) => new Set([...shared].filter((id) => route.includes(id))), new Set(mainRoutes[0] ?? []))
    : []);
  const forests = buildForests(data, graph, graph.spineIds, expanded);
  const forestByParent = new Map<string, BranchForest[]>();
  for (const forest of forests) forestByParent.set(forest.parentId, [...(forestByParent.get(forest.parentId) ?? []), forest]);
  const mainMetrics = new Map<string, NodeMetrics>();
  for (const id of mainIds) {
    const person = graph.byId.get(id);
    if (person) mainMetrics.set(id, nodeMetrics(person, true));
  }
  const rowHeight = (id: string) => Math.max(
    ROW_H,
    mainMetrics.get(id)?.height ?? MAIN_NODE_H,
    ...((forestByParent.get(id) ?? []).map((forest) => forest.height + ROW_TREE_PADDING)),
  );
  const rowStep = (from: string, to: string) => Math.max(ROW_H, rowHeight(from), rowHeight(to));
  const segments: Array<{ title: string; y0: number; y1: number; line: string; labelX: number }> = [];
  let cursorY = 0;
  let previousEnds = new Set<string>();
  for (const segment of data.spine.segments ?? []) {
    const routes = Object.entries(segment.lines ?? {}).filter(([, route]) => route.length);
    const spans = routes.map(([, route]) => route.slice(0, -1).reduce((height, parentId, index) => height + rowStep(parentId, route[index + 1]!), 0));
    const targetSpan = Math.max(0, ...spans);
    const knownStarts = routes.map(([, route]) => nodes.get(route[0]!)?.y).filter((y): y is number => y !== undefined);
    let segmentStart = Math.max(cursorY, ...knownStarts);
    if (!knownStarts.length && previousEnds.size) {
      const starts = routes.map(([, route]) => route[0]!);
      const transitions = [...previousEnds].flatMap((parentId) => starts
        .filter((id) => (graph.children.get(parentId) ?? []).includes(id))
        .map((id) => rowStep(parentId, id)));
      segmentStart = cursorY + Math.max(ROW_H, ...transitions);
    }
    for (let routeIndex = 0; routeIndex < routes.length; routeIndex += 1) {
      const [line, route] = routes[routeIndex]!;
      const span = spans[routeIndex] ?? 0;
      const extraStep = route.length > 1 ? (targetSpan - span) / (route.length - 1) : 0;
      let y = nodes.get(route[0]!)?.y ?? segmentStart;
      const startPerson = graph.byId.get(route[0]!);
      const startMetric = mainMetrics.get(route[0]!);
      if (startPerson && startMetric && !nodes.has(startPerson.id)) {
        nodes.set(startPerson.id, {
          id: startPerson.id,
          x: routeX(startPerson.id, line, sharedIds), y,
          ...startMetric, mainline: true, segment: segment.title,
        });
      }
      for (let i = 1; i < route.length; i += 1) {
        const id = route[i]!;
        y += rowStep(route[i - 1]!, id) + extraStep;
        if (nodes.has(id)) continue;
        const person = graph.byId.get(id);
        const metrics = mainMetrics.get(id);
        if (!person || !metrics) continue;
        nodes.set(id, { id, x: routeX(id, line, sharedIds), y, ...metrics, mainline: true, segment: segment.title });
      }
    }
    const endY = segmentStart + targetSpan;
    for (const [line, route] of routes) {
      segments.push({ title: segment.title, y0: segmentStart, y1: Math.max(endY, segmentStart + ROW_H), line,
        labelX: routeX(route[0]!, line, sharedIds) - 120 });
    }
    cursorY = endY;
    previousEnds = new Set(routes.map(([, route]) => route.at(-1)!).filter(Boolean));
  }

  // Route arrays remain authoritative for partial segment fixtures.
  for (const [line, route] of Object.entries(data.spine.lines ?? {})) {
    for (let i = 0; i < route.length; i += 1) {
      const id = route[i]!;
      if (nodes.has(id)) continue;
      const person = graph.byId.get(id);
      const metrics = mainMetrics.get(id);
      if (!person || !metrics) continue;
      nodes.set(id, { id, x: routeX(id, line, sharedIds), y: i * ROW_H, ...metrics, mainline: true });
    }
  }

  for (const forest of forests) {
    const parent = nodes.get(forest.parentId);
    if (!parent) continue;
    const depthOffsets = new Map<number, number>();
    let previousDepth = 0;
    let previousWidth = parent.width;
    for (const depth of [...forest.levelWidths.keys()].sort((a, b) => a - b)) {
      const width = forest.levelWidths.get(depth)!;
      const offset = depth === 1
        ? parent.width / 2 + SIDE_GAP_X + width / 2 + (forest.pushOut ?? 0)
        : (depthOffsets.get(previousDepth) ?? 0) + previousWidth / 2 + SIDE_LEVEL_GAP_X + width / 2;
      depthOffsets.set(depth, offset);
      previousDepth = depth;
      previousWidth = width;
    }
    for (const branch of forest.placements) {
      const xOffset = depthOffsets.get(branch.depth);
      if (xOffset === undefined) continue;
      const { metrics } = branch;
      nodes.set(branch.id, {
        id: branch.id,
        x: parent.x + forest.direction * xOffset + (branch.dx ?? 0),
        busX: parent.x + forest.direction * (xOffset - (forest.levelWidths.get(branch.depth) ?? 0) / 2 - (branch.depth === 1 ? 12 : SIDE_LEVEL_GAP_X / 2)),
        y: parent.y + branch.vertical,
        ...metrics,
        sideRoot: branch.rootId,
        mainline: false,
        ...(branch.chip ? { chip: true } : {}),
        collapsed: branch.collapsed,
        expandedRoot: branch.expandedRoot,
        descendantCount: branch.descendantCount,
        segment: parent.segment,
        ...(branch.groupLabel ? {
          groupLabel: branch.groupLabel, groupKey: branch.groupKey, groupMembers: branch.groupMembers,
          groupLine: branch.groupLine, groupParentId: branch.groupParentId,
        } : {}),
        ...(forest.grouped && branch.inGroup && forest.groupKey ? { syntheticParent: forest.groupKey } : {}),
      });
    }
  }
  return { nodes, segments, mainIds };
}

export function computeLayout(data: GenealogyData, expanded = new Set<string>()): CanvasLayout {
  const started = performance.now();
  const graph = buildGraph(data);
  const { nodes: nodeMap, segments } = positionSpine(data, graph, expanded);
  const allNodes = [...nodeMap.values()];
  const nodes = allNodes.filter((node) => !node.groupLabel);
  const groups = allNodes.filter((node) => Boolean(node.groupLabel));
  const farLinks: CanvasLayout['farLinks'] = [];
  const edges = buildEdges(data, graph, new Set(nodeMap.keys()), nodeMap, farLinks);
  const regions = regionFrames(graph, nodeMap);
  const minX = Math.min(0, ...allNodes.map((node) => node.x - node.width / 2)) - 80;
  const maxX = Math.max(0, ...allNodes.map((node) => node.x + node.width / 2)) + 80;
  const minY = Math.min(0, ...allNodes.map((node) => node.y - node.height / 2)) - 80;
  const maxY = Math.max(0, ...allNodes.map((node) => node.y + node.height / 2)) + 80;
  return {
    nodes,
    groups,
    edges,
    regions,
    farLinks,
    segments,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    durationMs: performance.now() - started,
  };
}
