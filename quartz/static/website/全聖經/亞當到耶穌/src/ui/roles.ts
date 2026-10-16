import type { CompareRow, GenealogyData, Person, ReadingData, RoleBox, RoleCategory, RoleMember, RolePerson, RolesData } from '../data/types';
import { h, svgEl } from './dom';
import { refLabel, refsText } from './roster-model';
import { emptyMarks, type ReadingStage, type StageMarks } from './stage';
import './roles.css';

/**
 * 「大衛立的職位」：組織圖。同一個元件兩種用法：
 * - 分頁（工具列的「大衛立的職位」）：讀者自己看，點樹上有的人跳到家譜樹。
 * - 讀經的舞台（ReadingStage）：讀到誰，誰的職位方塊亮起來。
 *
 * 畫法：大衛在最上面，底下四類；每類是幾個職位方塊，方塊裡是人名小卡。
 * 二十四班畫成二十四格的環，十二班軍隊畫成十二個月的輪盤，投奔大衛的人依支派分組。
 * 「從大衛到所羅門」：一個職位一列，左大衛時、右所羅門時（同一人金框橫跨、換職位紅框）；十二個官吏是十二張名牌。
 */
export interface RolesView extends ReadingStage {
  /** 分頁用的元素（和 el 是同一個；分頁與舞台共用一份畫面） */
  page: HTMLElement;
  /** 分頁打開時呼叫（第一次會載入資料） */
  showPage(): void;
  /** 捲到某個方塊並短暫標亮（家譜樹上的職位印點下去時用） */
  focusBox(boxId: string, memberKey?: string): void;
}

export interface RolesOptions {
  /** 載入 roles.json（動態 import，分頁打開或讀到時才載入） */
  load(): Promise<RolesData>;
  data: GenealogyData;
  reading: ReadingData;
  /** 點了家譜樹上有的人 */
  onTreePerson(id: string): void;
}

// ── 純函式（可單獨測試） ─────────────────────────────────────────────

export interface RefRange { book: string; ch: number; v1: number; v2: number }

/** 「代上12:1-7」「代上12:24」→ 書卷、章、起訖節。跨章或寫法不認得時回 null */
export function parseRef(ref: string): RefRange | null {
  const match = /^(.+?)(\d+):(\d+)(?:[-–－—](\d+))?$/.exec(ref.trim());
  if (!match) return null;
  const v1 = Number(match[3]);
  return { book: match[1]!, ch: Number(match[2]), v1, v2: match[4] ? Number(match[4]) : v1 };
}

/** ref 這一節（或這一段）整個落在 range 的範圍裡 */
export function refInRange(ref: string, range: string): boolean {
  const a = parseRef(ref);
  const b = parseRef(range);
  if (!a || !b) return false;
  return a.book === b.book && a.ch === b.ch && a.v1 >= b.v1 && a.v2 <= b.v2;
}

/** roles.json 的出處用「, 」分隔；畫面上用頓號 */
export function refText(ref: string): string {
  return ref.split(/\s*[,，]\s*/).filter(Boolean).join('、');
}

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 1–99 的中文數字：十二、二十四 */
export function chineseNumber(n: number): string {
  if (n < 10) return DIGITS[n]!;
  if (n < 20) return `十${n % 10 ? DIGITS[n % 10] : ''}`;
  if (n < 100) return `${DIGITS[Math.floor(n / 10)]}十${n % 10 ? DIGITS[n % 10] : ''}`;
  return String(n);
}

/** 十二個月：正月、二月……十二月 */
export function monthLabel(order: number): string {
  return order === 1 ? '正月' : `${chineseNumber(order)}月`;
}

/** 圓上的點：角度從正上方起算、順時針 */
export function polar(cx: number, cy: number, r: number, deg: number): { x: number; y: number } {
  const rad = deg * Math.PI / 180;
  return { x: Math.round((cx + r * Math.sin(rad)) * 100) / 100, y: Math.round((cy - r * Math.cos(rad)) * 100) / 100 };
}

/** 環的一格（圓環的一段扇形）：內半徑 r0、外半徑 r1，角度 a0 到 a1（度） */
export function sectorPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r0, a1);
  const p3 = polar(cx, cy, r0, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${p0.x} ${p0.y}A${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}L${p2.x} ${p2.y}A${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y}Z`;
}

/** 歸回連結指到的那一格：「role:<方塊 id>:<成員 key>」。成員 key 裡可能有冒號，只切第一個 */
export function roleTarget(target: string): { box: string; key: string } | null {
  if (!target.startsWith('role:')) return null;
  const rest = target.slice(5);
  const cut = rest.indexOf(':');
  if (cut <= 0) return null;
  return { box: rest.slice(0, cut), key: rest.slice(cut + 1) };
}

export const cellKey = (boxId: string, memberKey: string) => `${boxId}:${memberKey}`;

/** 一位成員在職位圖上的身分：家譜樹上的人用 id，只在職位圖上的人用 rid */
export const pidOf = (member: RoleMember): string => member.id ?? member.rid ?? member.key;

/** 這個格子這一刻要不要亮：讀到這個人（家譜樹 id 或職位圖 rid），或歸回連結直接指到這一格 */
export function cellIsLit(lit: ReadonlySet<string>, pid: string, boxId: string, memberKey: string): boolean {
  return lit.has(pid) || lit.has(`role:${cellKey(boxId, memberKey)}`);
}

/** 這一節（例如「王上4:12」）落在成員出處（可多處，逗號分隔）裡：播放時這張卡開始「呼吸」 */
export function refCoversVerse(ref: string, verse: string): boolean {
  return ref.split(/\s*[,，]\s*/).some((part) => part && refInRange(verse, part));
}

/** 成員卡要不要呼吸：他的名字已經讀到（亮著），而且出處含目前這一節 */
export function shouldBreathe(lit: boolean, ref: string, verse: string | null): boolean {
  return lit && verse !== null && refCoversVerse(ref, verse);
}

/** 人名旁的限定詞（亞希律的兒子）：家譜樹人物或職位圖人物的 qualifier；detail 已經寫到的（「撒督」對「撒督的兒子」）不重複寫 */
export function qualifierOf(
  who: { id?: string; rid?: string; detail?: string },
  people: ReadonlyMap<string, RolePerson>,
  tree: (id: string) => Person | undefined,
): string {
  const text = (who.rid ? people.get(who.rid)?.qualifier : undefined) || (who.id ? (tree(who.id)?.qualifier as string | undefined) : undefined) || '';
  return text && !(who.detail ?? '').includes(text) ? text : '';
}

export type SolKind = 'plain' | 'same' | 'moved';
export interface SolCard {
  member: RoleMember;
  kind: SolKind;
  /** 換了職位的人：原本的職位 */
  from?: string;
  /** 同一人：大衛時那邊的經節（人物資料裡不是「王上」開頭的出處） */
  davidRefs: string[];
}
export interface CompareRowModel {
  office: string;
  david: CompareRow['david'];
  /** 同一個人：一張金框卡橫跨兩欄（這時兩欄不再各畫一份） */
  same?: SolCard;
  solomon: SolCard[];
}

/** 從大衛到所羅門：每一列要畫哪些卡。沒有寫 same 的人，哪怕兩欄同名，也不合併 */
export function compareModel(box: RoleBox, people: ReadonlyMap<string, RolePerson>): CompareRowModel[] {
  const byKey = new Map(box.members.map((member) => [member.key, member]));
  return (box.rows ?? []).map((row) => {
    const out: CompareRowModel = { office: row.office, david: row.david, solomon: [] };
    if (row.same) {
      const member = byKey.get(row.same);
      if (member) {
        const person = people.get(pidOf(member));
        let refs = (person?.refs ?? []).filter((ref) => !ref.startsWith('王上'));
        if (!refs.length) refs = row.david.filter((entry) => (entry.id ?? entry.rid) === pidOf(member)).map((entry) => entry.ref);
        out.same = { member, kind: 'same', davidRefs: [...new Set(refs)] };
        return out;
      }
    }
    for (const key of row.solomon) {
      const member = byKey.get(key);
      if (!member) continue;
      const moved = row.moved?.key === key;
      out.solomon.push({ member, kind: moved ? 'moved' : 'plain', from: moved ? row.moved!.from : undefined, davidRefs: [] });
    }
    return out;
  });
}

export interface Placement { box: RoleBox; category: RoleCategory; member: RoleMember }
export interface RolesIndex {
  /** 人（id 或 rid）→ 他出現的每一個位置，照圖上由上到下、由左到右的順序 */
  byPid: Map<string, Placement[]>;
  /** 「方塊 id:成員 key」→ 位置 */
  byCell: Map<string, Placement>;
  boxes: Map<string, { box: RoleBox; category: RoleCategory }>;
  people: Map<string, RolePerson>;
}

export function buildRolesIndex(data: RolesData): RolesIndex {
  const index: RolesIndex = { byPid: new Map(), byCell: new Map(), boxes: new Map(), people: new Map() };
  for (const person of data.people) index.people.set(person.rid, person);
  for (const category of data.categories) {
    for (const box of category.boxes) {
      index.boxes.set(box.id, { box, category });
      for (const member of box.members) {
        const place: Placement = { box, category, member };
        index.byCell.set(cellKey(box.id, member.key), place);
        const pid = pidOf(member);
        const list = index.byPid.get(pid) ?? [];
        list.push(place);
        index.byPid.set(pid, list);
      }
    }
  }
  return index;
}

export interface FigureGroup { title: string; ref: string; members: RoleMember[]; figures: NonNullable<RoleBox['figures']> }
/** 投奔大衛的人：每一組的成員，和落在那一組經文範圍裡的人數（人數照字串原樣）。沒有對到任何一組的人數放在 rest */
export function groupLayout(box: RoleBox): { groups: FigureGroup[]; rest: NonNullable<RoleBox['figures']> } {
  const byKey = new Map(box.members.map((member) => [member.key, member]));
  const figures = box.figures ?? [];
  const used = new Set<number>();
  const groups = (box.groups ?? []).map((group) => {
    const own: NonNullable<RoleBox['figures']> = [];
    figures.forEach((figure, i) => {
      if (!used.has(i) && refInRange(figure.ref, group.ref)) { own.push(figure); used.add(i); }
    });
    return {
      title: group.title,
      ref: group.ref,
      members: group.keys.map((key) => byKey.get(key)).filter((member): member is RoleMember => Boolean(member)),
      figures: own,
    };
  });
  return { groups, rest: figures.filter((_, i) => !used.has(i)) };
}

// ── 小縮影（讀經的小地圖）：大衛牌子＋四欄小方塊的示意 ───────────────

export const MINI_W = 120;
export const MINI_H = 90;
export interface MiniRect { x: number; y: number; w: number; h: number }

/** 方塊在畫面上大約有多高（只用來決定縮影裡每個方塊的比例） */
export function estimateBoxHeight(box: RoleBox): number {
  const head = 36 + (box.note ? 16 : 0);
  const figures = (box.figures?.length ?? 0) * 18;
  if (box.kind === 'ring24' || box.kind === 'wheel12') return head + 280;
  if (box.kind === 'compare') return head + (box.rows?.length ?? 0) * 44 + 24;
  if (box.kind === 'tiles') return head + 24 + Math.ceil(box.members.length / 4) * 56;
  const rows = Math.ceil(box.members.length / 3) * 26;
  if (box.kind === 'groups') return head + (box.groups?.length ?? 0) * 34 + rows + figures;
  return head + rows + figures;
}

export function miniLayout(data: RolesData): { plaque: MiniRect; boxes: Map<string, MiniRect & { kind: RoleBox['kind'] }> } {
  const margin = 3;
  const gap = 4;
  const top = 21;
  // 「從大衛到所羅門」橫跨整個版面，排在四欄底下；其他類各一欄
  const columnsOf = data.categories.filter((category) => category.id !== 'solomon');
  const bandBoxes = data.categories.filter((category) => category.id === 'solomon').flatMap((category) => category.boxes);
  const count = Math.max(1, columnsOf.length);
  const colW = (MINI_W - margin * 2 - gap * (count - 1)) / count;
  const boxGap = 1.6;
  const plaque: MiniRect = { x: MINI_W / 2 - 22, y: 3, w: 44, h: 10 };
  const bandHeights = bandBoxes.map((box) => (box.kind === 'compare' ? 6.5 : 3.8));
  const bandH = bandBoxes.length ? bandHeights.reduce((sum, height) => sum + height, 0) + (bandBoxes.length - 1) * boxGap : 0;
  const bandTop = MINI_H - 2 - bandH;
  const avail = (bandBoxes.length ? bandTop - 3.5 : MINI_H - 2) - top;
  const minHeight = 2;
  const heightsAt = (scale: number) => columnsOf.map((category) => category.boxes.map((box) => Math.max(minHeight, estimateBoxHeight(box) * scale)));
  const fits = (scale: number) => heightsAt(scale).every((column) => column.reduce((sum, height) => sum + height, 0) + Math.max(0, column.length - 1) * boxGap <= avail);
  // 最高的那一欄剛好排滿；其他欄照同一個比例（小方塊有下限，下限會讓欄變高，所以一路縮到全部放得下）
  let scale = 0.1;
  for (let i = 0; i < 200 && !fits(scale); i += 1) scale *= 0.97;
  const boxes = new Map<string, MiniRect & { kind: RoleBox['kind'] }>();
  const heights = heightsAt(scale);
  columnsOf.forEach((category, c) => {
    let y = top;
    category.boxes.forEach((box, i) => {
      const height = heights[c]![i]!;
      boxes.set(box.id, { x: margin + c * (colW + gap), y, w: colW, h: height, kind: box.kind });
      y += height + boxGap;
    });
  });
  let bandY = bandTop;
  bandBoxes.forEach((box, i) => {
    boxes.set(box.id, { x: margin, y: bandY, w: MINI_W - margin * 2, h: bandHeights[i]!, kind: box.kind });
    bandY += bandHeights[i]! + boxGap;
  });
  return { plaque, boxes };
}

// ── 元件 ─────────────────────────────────────────────────────────────

interface Cell {
  el: Element;
  place: Placement;
  /** 蓋印的位置（只有畫在 SVG 裡的格子用得到） */
  anchor?: { x: number; y: number };
  /** 環裡的格子：環的圖例在這個群組裡 */
  ring?: SVGGElement;
}

const activate = (el: Element, run: () => void) => {
  el.addEventListener('click', run);
  el.addEventListener('keydown', (event) => {
    const key = (event as KeyboardEvent).key;
    if (key === 'Enter' || key === ' ') { event.preventDefault(); run(); }
  });
};

export function createRoles(options: RolesOptions): RolesView {
  let roles: RolesData | null = null;
  let index: RolesIndex | null = null;
  let loading: Promise<void> | null = null;
  let reading = false;
  let marks: StageMarks = emptyMarks();
  let previousCurrent: string | null = null;
  let verseKey: string | null = null;

  const personById = new Map<string, Person>();
  for (const person of options.data.persons) personById.set(person.id, person);

  const floats = h('div', { className: 'ag-ro-floats' });
  const chart = h('div', { className: 'ag-ro-chart' }, h('p', { className: 'ag-ro-empty' }, '載入中…'));
  const el = h('section', { className: 'ag-roles', 'aria-label': '大衛立的職位' }, floats, chart);

  // 畫出來的東西
  const cells: Cell[] = [];
  const cellsByPid = new Map<string, Cell[]>();
  const cellsByRole = new Map<string, Cell[]>();
  const boxEls = new Map<string, HTMLElement>();
  const boxTags = new Map<string, HTMLElement>();
  const ringLegends = new Map<string, SVGGElement>();

  // ── 載入 ──
  const ready = (): Promise<void> => {
    loading ??= options.load().then((value) => {
      roles = value;
      index = buildRolesIndex(value);
      render();
      measure();
    }).catch((error: unknown) => {
      loading = null;
      chart.replaceChildren(h('p', { className: 'ag-ro-empty' }, '職位圖暫時打不開，請稍後再試。'));
      throw error;
    });
    return loading;
  };

  // ── 畫面 ──
  function render() {
    if (!roles) return;
    cells.length = 0;
    cellsByPid.clear();
    cellsByRole.clear();
    boxEls.clear();
    boxTags.clear();
    ringLegends.clear();
    const king = h('div', { className: 'ag-ro-king' },
      h('strong', {}, '大衛王'),
      h('span', {}, '代上18:14'));
    const cats = h('div', { className: 'ag-ro-cats' });
    for (const category of roles.categories) {
      const column = h('section', { className: `ag-ro-cat ag-ro-cat-${category.id}`, 'data-cat': category.id },
        h('h3', { className: 'ag-ro-cat-title' }, category.title));
      const list = h('div', { className: 'ag-ro-boxes' });
      for (const box of category.boxes) list.append(renderBox(box, category));
      column.append(list);
      cats.append(column);
    }
    chart.replaceChildren(king, cats);
    applyMarks();
  }

  function register(cell: Cell) {
    cells.push(cell);
    const pid = pidOf(cell.place.member);
    cellsByPid.set(pid, [...(cellsByPid.get(pid) ?? []), cell]);
    const key = cellKey(cell.place.box.id, cell.place.member.key);
    cellsByRole.set(key, [...(cellsByRole.get(key) ?? []), cell]);
  }

  function renderBox(box: RoleBox, category: RoleCategory): HTMLElement {
    const tag = h('span', { className: 'ag-ro-box-tag', hidden: true }, '子孫歸回');
    boxTags.set(box.id, tag);
    const article = h('article', { className: `ag-ro-box ag-ro-kind-${box.kind}`, 'data-box': box.id },
      h('header', { className: 'ag-ro-box-head' },
        h('h4', { className: 'ag-ro-box-title' }, box.title, tag),
        h('span', { className: 'ag-ro-box-ref' }, refText(box.ref))));
    boxEls.set(box.id, article);
    if (box.note) article.append(h('p', { className: 'ag-ro-box-note' }, box.note));
    const placeOf = (member: RoleMember): Placement => ({ box, category, member });
    if (box.quote) {
      article.append(h('p', { className: 'ag-ro-quote' }, `「${box.quote.text}」`, h('cite', {}, refLabel(box.quote.ref))));
    }
    if (box.kind === 'ring24') article.append(renderRing(box, placeOf));
    else if (box.kind === 'wheel12') article.append(renderWheel(box, placeOf));
    else if (box.kind === 'compare') article.append(renderCompare(box, placeOf));
    else if (box.kind === 'tiles') article.append(renderTiles(box, placeOf));
    else if (box.kind === 'groups') {
      const { groups, rest } = groupLayout(box);
      for (const group of groups) {
        const section = h('section', { className: 'ag-ro-group' },
          h('h5', { className: 'ag-ro-group-title' }, group.title, h('span', {}, refText(group.ref))));
        if (group.members.length) section.append(h('div', { className: 'ag-ro-members' }, ...group.members.map((member) => chip(placeOf(member)))));
        if (group.figures.length) section.append(figuresList(group.figures));
        article.append(section);
      }
      if (rest.length) article.append(figuresList(rest));
    } else {
      if (box.members.length) article.append(h('div', { className: 'ag-ro-members' }, ...box.members.map((member) => chip(placeOf(member)))));
      if (box.figures?.length) article.append(figuresList(box.figures));
    }
    return article;
  }

  function figuresList(figures: NonNullable<RoleBox['figures']>): HTMLElement {
    const list = h('dl', { className: 'ag-ro-figures' });
    for (const figure of figures) {
      list.append(h('div', { className: 'ag-ro-figure', title: figure.ref },
        h('dt', {}, figure.label),
        h('dd', {}, figure.count)));
    }
    return list;
  }

  /** 人名小卡：名字、補充（哈律人）、有 id 的帶「樹」字 */
  function chip(place: Placement): HTMLElement {
    const { member } = place;
    const main = h('button', { className: 'ag-ro-chip-main', type: 'button', 'aria-label': `${member.name}${member.detail ? `，${member.detail}` : ''}，看他的職位` },
      h('span', { className: 'ag-ro-chip-name' }, member.name),
      member.detail ? h('small', {}, member.detail) : null);
    main.addEventListener('click', () => openPerson(pidOf(member), 'manual'));
    const root = h('span', { className: `ag-ro-chip${member.id ? ' has-tree' : ''}`, 'data-pid': pidOf(member) }, main);
    if (member.id) {
      const id = member.id;
      const tree = h('button', { className: 'ag-ro-tree', type: 'button', title: '在家譜樹上看', 'aria-label': `${member.name}，在家譜樹上看` }, '樹');
      tree.addEventListener('click', () => options.onTreePerson(id));
      root.append(tree);
    }
    register({ el: root, place });
    return root;
  }

  const treeOf = (id: string) => personById.get(id);

  /** 從大衛到所羅門、十二個官吏的人名卡：名字、限定詞、補充、出處；樹上有的人帶「樹」字 */
  function solCard(place: Placement, kind: SolKind, extra: { from?: string; refs?: string; spouse?: boolean; tile?: boolean }): HTMLElement {
    const { member } = place;
    const qualifier = qualifierOf(member, index?.people ?? new Map(), treeOf);
    const label = [member.name, qualifier, member.detail].filter(Boolean).join('，');
    const nameLine = h('span', { className: 'ag-ro-sc-line' },
      h('span', { className: 'ag-ro-sc-name' }, member.name),
      qualifier ? h('small', { className: 'ag-ro-sc-q' }, qualifier) : null,
      kind === 'same' ? h('small', { className: 'ag-ro-sc-same' }, '同一人') : null);
    const main = h('button', { className: 'ag-ro-sc-main', type: 'button', 'aria-label': `${label}，看他的職位` },
      nameLine,
      member.detail ? h('small', { className: 'ag-ro-sc-detail' }, member.detail) : null,
      extra.from ? h('small', { className: 'ag-ro-sc-from' }, `原本：${extra.from}`) : null,
      extra.refs ? h('small', { className: 'ag-ro-sc-ref' }, extra.refs) : null);
    main.addEventListener('click', () => openPerson(pidOf(member), 'manual'));
    const root = h('div', {
      className: `ag-ro-sc is-cell is-${kind}${extra.tile ? ' is-tile' : ''}${member.id ? ' has-tree' : ''}`,
      'data-pid': pidOf(member), 'data-key': member.key, title: extra.tile ? member.ref : undefined,
    }, main);
    if (member.id) {
      const id = member.id;
      const tree = h('button', { className: 'ag-ro-tree', type: 'button', title: '在家譜樹上看', 'aria-label': `${member.name}，在家譜樹上看` }, '樹');
      tree.addEventListener('click', () => options.onTreePerson(id));
      root.append(tree);
    }
    if (extra.spouse && member.spouse) {
      const spouse = member.spouse;
      const go = h('button', { className: 'ag-ro-sc-spouse', type: 'button', 'aria-label': `${member.name}的妻子${spouse.name}，在家譜樹上看` }, `妻子${spouse.name}`);
      go.addEventListener('click', () => options.onTreePerson(spouse.id));
      root.append(h('span', { className: 'ag-ro-sc-foot' }, go));
    }
    register({ el: root, place });
    return root;
  }

  /** 大衛時的人：只顯示，不跟著讀經亮（樹上有的人帶「樹」字） */
  function davidCard(entry: CompareRow['david'][number]): HTMLElement {
    const qualifier = qualifierOf(entry, index?.people ?? new Map(), treeOf);
    const main = h('span', { className: 'ag-ro-sc-main' },
      h('span', { className: 'ag-ro-sc-line' },
        h('span', { className: 'ag-ro-sc-name' }, entry.name),
        qualifier ? h('small', { className: 'ag-ro-sc-q' }, qualifier) : null),
      entry.detail ? h('small', { className: 'ag-ro-sc-detail' }, entry.detail) : null,
      h('small', { className: 'ag-ro-sc-ref' }, refsText([entry.ref])));
    const root = h('div', { className: `ag-ro-sc is-ref${entry.id ? ' has-tree' : ''}` }, main);
    if (entry.id) {
      const id = entry.id;
      const tree = h('button', { className: 'ag-ro-tree', type: 'button', title: '在家譜樹上看', 'aria-label': `${entry.name}，在家譜樹上看` }, '樹');
      tree.addEventListener('click', () => options.onTreePerson(id));
      root.append(tree);
    }
    return root;
  }

  // 從大衛到所羅門：三欄（職位｜大衛時｜所羅門時），一個職位一列
  function renderCompare(box: RoleBox, placeOf: (member: RoleMember) => Placement): HTMLElement {
    const wrap = h('div', { className: 'ag-ro-cmp' },
      h('div', { className: 'ag-ro-cmp-row ag-ro-cmp-head', 'aria-hidden': 'true' },
        h('span', {}, '職位'), h('span', {}, '大衛時'), h('span', {}, '所羅門時')));
    for (const row of compareModel(box, index?.people ?? new Map())) {
      const line = h('div', { className: `ag-ro-cmp-row${row.same ? ' has-same' : ''}` }, h('div', { className: 'ag-ro-cmp-office' }, row.office));
      if (row.same) {
        const refs = [refsText(row.same.davidRefs), refsText([row.same.member.ref])].filter(Boolean);
        const spanCard = solCard(placeOf(row.same.member), 'same', {});
        // 兩邊的出處：大衛時 ｜ 所羅門時
        const main = spanCard.querySelector('.ag-ro-sc-main')!;
        main.append(h('small', { className: 'ag-ro-sc-ref' }, ...refs.flatMap((text, i) => (i ? [h('i', { className: 'ag-ro-sc-bar', 'aria-hidden': 'true' }), text] : [text]))));
        line.append(h('div', { className: 'ag-ro-cmp-span' }, spanCard));
      } else {
        const left = h('div', { className: 'ag-ro-cmp-col is-david' }, h('span', { className: 'ag-ro-cmp-lab' }, '大衛時'));
        if (row.david.length) left.append(...row.david.map(davidCard));
        else left.append(h('span', { className: 'ag-ro-cmp-none' }, '—'));
        const right = h('div', { className: 'ag-ro-cmp-col is-solomon' }, h('span', { className: 'ag-ro-cmp-lab' }, '所羅門時'));
        if (row.solomon.length) {
          right.append(...row.solomon.map((card) => solCard(placeOf(card.member), card.kind, { from: card.from, refs: refsText([card.member.ref]) })));
        } else right.append(h('span', { className: 'ag-ro-cmp-none' }, '王上 4 沒有寫'));
        line.append(left, right);
      }
      wrap.append(line);
    }
    return wrap;
  }

  // 十二個官吏：十二張名牌，不編號、不排月份
  function renderTiles(box: RoleBox, placeOf: (member: RoleMember) => Placement): HTMLElement {
    return h('div', { className: 'ag-ro-tiles' },
      ...box.members.map((member) => solCard(placeOf(member), 'plain', { tile: true, spouse: true })));
  }

  // 二十四格的環：每格一個序號、一個名字（沿著半徑寫）
  function renderRing(box: RoleBox, placeOf: (member: RoleMember) => Placement): SVGSVGElement {
    const size = 360;
    const c = size / 2;
    const rOut = 172;
    const rIn = 78;
    const svg = svgEl('svg', { class: 'ag-ro-ring', viewBox: `0 0 ${size} ${size}`, role: 'group', 'aria-label': box.title });
    const legend = svgEl('g', { class: 'ag-ro-legend' });
    const title = svgEl('text', { class: 'ag-ro-ring-title', x: c, y: c - 4, 'text-anchor': 'middle' });
    title.textContent = box.title;
    const l1 = svgEl('text', { class: 'ag-ro-legend-text is-returned', x: c, y: c + 20, 'text-anchor': 'middle' });
    l1.textContent = '紅：子孫歸回';
    const l2 = svgEl('text', { class: 'ag-ro-legend-text is-lost', x: c, y: c + 38, 'text-anchor': 'middle' });
    l2.textContent = '虛線：族譜尋不著';
    legend.append(l1, l2);
    legend.style.display = 'none';
    ringLegends.set(box.id, legend);
    const total = Math.max(24, ...box.members.map((member) => member.order ?? 0));
    const step = 360 / total;
    for (const member of box.members) {
      const order = member.order ?? 1;
      const a0 = (order - 1) * step;
      const a1 = order * step;
      const mid = (a0 + a1) / 2;
      const hasTree = Boolean(member.id);
      const g = svgEl('g', {
        class: `ag-ro-cell${order % 2 ? '' : ' is-alt'}`, role: 'button', tabindex: '0', 'data-pid': pidOf(member),
        'aria-label': `第${chineseNumber(order)}班${member.name ? `，${member.name}` : ''}`,
      });
      g.append(svgEl('path', { d: sectorPath(c, c, rIn, rOut, a0 + 0.35, a1 - 0.35) }));
      // 右半邊由內往外讀，左半邊翻過來由外往內讀，字才不會倒
      const right = mid < 180;
      const turn = right ? mid - 90 : mid + 90;
      const sign = right ? 1 : -1;
      const label = svgEl('g', { class: 'ag-ro-cell-label', transform: `translate(${c} ${c}) rotate(${turn})` });
      const num = svgEl('text', { class: 'ag-ro-cell-no', x: sign * (rOut - 11), y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      num.textContent = String(order);
      const room = (rOut - 22) - (rIn + 6) - (hasTree ? 10 : 0);
      const nameLen = Array.from(member.name).length;
      const nameSize = Math.min(13.5, room / Math.max(1, nameLen));
      const nameMid = (rIn + 6 + (hasTree ? 10 : 0) + (rOut - 22)) / 2;
      const name = svgEl('text', { class: 'ag-ro-cell-name', x: sign * nameMid, y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': nameSize });
      name.textContent = member.name;
      label.append(num, name);
      if (hasTree) {
        const mark = svgEl('text', { class: 'ag-ro-cell-tree', x: sign * (rIn + 9), y: 0, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
        mark.textContent = '樹';
        label.append(mark);
      }
      g.append(label);
      activate(g, () => openPerson(pidOf(member), 'manual'));
      svg.append(g);
      register({ el: g, place: placeOf(member), anchor: polar(c, c, rOut - 2, mid), ring: legend });
    }
    svg.append(title, legend);
    return svg;
  }

  // 十二個月的輪盤：每格一個月、一位班長（同一個月有兩位時小字並列）
  function renderWheel(box: RoleBox, placeOf: (member: RoleMember) => Placement): SVGSVGElement {
    const size = 360;
    const c = size / 2;
    const rOut = 170;
    const rIn = 62;
    const svg = svgEl('svg', { class: 'ag-ro-ring ag-ro-wheel', viewBox: `0 0 ${size} ${size}`, role: 'group', 'aria-label': box.title });
    const title = svgEl('text', { class: 'ag-ro-ring-title', x: c, y: c, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
    title.textContent = box.title;
    const byOrder = new Map<number, RoleMember[]>();
    for (const member of box.members) byOrder.set(member.order ?? 0, [...(byOrder.get(member.order ?? 0) ?? []), member]);
    for (const [order, members] of [...byOrder].sort((a, b) => a[0] - b[0])) {
      if (!order) continue;
      const a0 = (order - 1) * 30;
      const a1 = order * 30;
      const mid = (a0 + a1) / 2;
      const g = svgEl('g', {
        class: `ag-ro-cell${order % 2 ? '' : ' is-alt'}`, role: 'button', tabindex: '0',
        'data-pid': members.map(pidOf).join(' '), 'aria-label': `${monthLabel(order)}，${members.map((member) => member.name).join('、')}`,
      });
      g.append(svgEl('path', { d: sectorPath(c, c, rIn, rOut, a0 + 0.6, a1 - 0.6) }));
      const centre = polar(c, c, (rIn + rOut) / 2 + 2, mid);
      const lines = members.length;
      const top = centre.y - (lines > 1 ? 13 : 8);
      const month = svgEl('text', { class: 'ag-ro-cell-no', x: centre.x, y: top, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      month.textContent = monthLabel(order);
      g.append(month);
      members.forEach((member, i) => {
        const len = Array.from(member.name).length;
        const text = svgEl('text', {
          class: `ag-ro-cell-name${i ? ' is-second' : ''}`, x: centre.x, y: top + 15 + i * 14, 'text-anchor': 'middle', 'dominant-baseline': 'central',
          'font-size': i ? Math.min(11, 56 / len) : Math.min(14, 58 / len),
        });
        text.textContent = member.name;
        if (i) text.addEventListener('click', (event) => { event.stopPropagation(); openPerson(pidOf(member), 'manual'); });
        g.append(text);
      });
      activate(g, () => openPerson(pidOf(members[0]!), 'manual'));
      svg.append(g);
      for (const member of members) register({ el: g, place: placeOf(member), anchor: polar(c, c, rOut - 4, mid) });
    }
    svg.append(title);
    return svg;
  }

  // ── 讀經的標記 ──
  type Effect = 'returned' | 'lost' | 'link';
  const EFFECT_RANK: Record<Effect, number> = { returned: 3, lost: 2, link: 1 };
  const EFFECT_TAG: Record<Effect, string> = { returned: '子孫歸回', lost: '族譜尋不著', link: '子孫歸回' };

  function linkEffects(): { cells: Map<string, Effect>; boxes: Set<string> } {
    const result = new Map<string, Effect>();
    const boxes = new Set<string>();
    for (const i of marks.links) {
      const link = options.reading.links[i];
      // 城的連結（家譜裡有這座城）只在名冊上，不連到職位圖
      if (!link || link.effect === 'town') continue;
      const effect: Effect = link.effect;
      for (const to of link.to) {
        if (!to.role) continue;
        if (!to.member) { boxes.add(to.role); continue; }
        const key = cellKey(to.role, to.member);
        const known = result.get(key);
        if (!known || EFFECT_RANK[effect] > EFFECT_RANK[known]) result.set(key, effect);
      }
    }
    return { cells: result, boxes };
  }

  function stampOn(node: Element, anchor: { x: number; y: number } | undefined, text: string, animate: boolean) {
    const cls = `ag-ro-stamp${animate ? ' is-fresh' : ''}`;
    if (node instanceof SVGElement) {
      if (!anchor) return;
      const width = Array.from(text).length * 10 + 7;
      const g = svgEl('g', { class: `${cls} is-svg`, transform: `translate(${anchor.x - width / 2} ${anchor.y - 9}) rotate(-5)` });
      // 蓋印的動畫放在內層：外層的 transform 管位置
      const body = svgEl('g', { class: 'ag-ro-stamp-body' });
      body.append(svgEl('rect', { x: 0, y: 0, width, height: 15, rx: 2 }));
      const label = svgEl('text', { x: width / 2, y: 7.8, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      label.textContent = text;
      body.append(label);
      g.append(body);
      node.append(g);
    } else {
      node.append(h('span', { className: cls, 'aria-hidden': 'true' }, text));
    }
  }

  interface CellState {
    boxId: string;
    anchor?: { x: number; y: number };
    lit: boolean;
    trail: boolean;
    current: boolean;
    breathe: boolean;
    effect?: Effect;
    stamp?: { text: string; fresh: boolean };
  }

  function applyMarks() {
    if (!roles || !index) return;
    el.classList.toggle('is-reading', reading);
    const current = marks.current;
    const currentRole = current ? roleTarget(current) : null;
    const currentKey = currentRole ? cellKey(currentRole.box, currentRole.key) : null;
    // 換了正在讀的人：他的印要蓋一次
    const isNew = current !== previousCurrent;
    previousCurrent = current;
    const effects = reading ? linkEffects() : { cells: new Map<string, Effect>(), boxes: new Set<string>() };
    const seals = new Map<string, Array<{ label: string; fresh: boolean }>>();
    if (reading) {
      for (const seal of marks.seals) {
        seals.set(seal.id, [...(seals.get(seal.id) ?? []), { label: seal.label, fresh: marks.fresh.has(seal.key) }]);
      }
    }
    // 同一個輪盤格裡有兩位時，一格只畫一次：把裡面每位的狀態合起來
    const states = new Map<Element, CellState>();
    for (const cell of cells) {
      const { box, member } = cell.place;
      const pid = pidOf(member);
      const key = cellKey(box.id, member.key);
      const roleKey = `role:${key}`;
      const isCurrent = reading && (current === pid || (currentKey !== null && currentKey === key));
      const lit = reading && (cellIsLit(marks.lit, pid, box.id, member.key) || isCurrent);
      const trail = reading && !lit && (marks.trail.has(pid) || marks.trail.has(roleKey));
      const state = states.get(cell.el) ?? { boxId: box.id, anchor: cell.anchor, lit: false, trail: false, current: false, breathe: false };
      state.lit ||= lit;
      state.trail ||= trail;
      state.current ||= isCurrent;
      state.breathe ||= reading && shouldBreathe(lit, member.ref, verseKey);
      const effect = effects.cells.get(key);
      if (effect && (!state.effect || EFFECT_RANK[effect] > EFFECT_RANK[state.effect])) state.effect = effect;
      if (!state.stamp) {
        const own = seals.get(pid)?.find((item) => box.seal === item.label || box.title.includes(item.label) || item.label.includes(box.seal));
        if (own) state.stamp = { text: own.label, fresh: own.fresh };
        else if (isCurrent) state.stamp = { text: box.seal, fresh: isNew };
      }
      states.set(cell.el, state);
    }
    const activeBoxes = new Set<string>();
    const legendBoxes = new Set<string>();
    for (const [node, state] of states) {
      node.querySelectorAll(':scope > .ag-ro-stamp, :scope > .ag-ro-chip-tag').forEach((child) => child.remove());
      node.classList.toggle('is-lit', state.lit);
      node.classList.toggle('is-trail', state.trail);
      node.classList.toggle('is-current', state.current);
      node.classList.toggle('is-breathe', state.breathe);
      node.classList.toggle('is-returned', state.effect === 'returned');
      node.classList.toggle('is-lost', state.effect === 'lost');
      node.classList.toggle('is-linked', state.effect === 'link');
      if (state.lit || state.trail) activeBoxes.add(state.boxId);
      if (state.effect === 'returned' || state.effect === 'lost') legendBoxes.add(state.boxId);
      if (state.effect && !(node instanceof SVGElement)) node.append(h('span', { className: `ag-ro-chip-tag is-${state.effect}` }, EFFECT_TAG[state.effect]));
      if (state.stamp) stampOn(node, state.anchor, state.stamp.text, state.stamp.fresh);
    }
    for (const [id, box] of boxEls) {
      box.classList.toggle('is-lit', reading && marks.boxes.has(id));
      box.classList.toggle('is-active', reading && !marks.boxes.has(id) && activeBoxes.has(id));
      const tag = boxTags.get(id);
      if (tag) tag.hidden = !(reading && effects.boxes.has(id));
    }
    for (const [id, legend] of ringLegends) legend.style.display = legendBoxes.has(id) ? '' : 'none';
  }

  // ── 人名小卡 ──
  let cardEl: HTMLElement | null = null;
  let cardSource: 'auto' | 'manual' | null = null;
  let cardPid: string | null = null;
  let dismissedAuto: string | null = null;
  let lastAutoPid: string | null = null;

  function closeCard() {
    cardEl?.remove();
    cardEl = null;
    cardSource = null;
    cardPid = null;
  }

  function personInfo(places: Placement[]): { name: string; qualifier: string; treeId: string | null } {
    const first = places[0]!.member;
    const tree = first.id ? personById.get(first.id) : undefined;
    const role = first.rid ? index?.people.get(first.rid) : undefined;
    return {
      name: tree?.name ?? role?.name ?? first.name,
      qualifier: (tree?.qualifier as string | undefined) || role?.qualifier || '',
      treeId: first.id ?? (tree ? tree.id : null),
    };
  }

  function placeLine(place: Placement): HTMLElement {
    const { box, member } = place;
    const extra = member.detail ?? (member.order && (box.kind === 'ring24') ? `第${chineseNumber(member.order)}班` : '');
    return h('li', {},
      h('b', {}, box.title),
      extra ? h('span', { className: 'ag-ro-card-detail' }, extra) : null,
      h('small', {}, refText(member.ref)));
  }

  function openPerson(pid: string, source: 'auto' | 'manual') {
    if (!index) return;
    const places = index.byPid.get(pid);
    if (!places?.length) return;
    if (source === 'auto' && cardSource === 'manual') return;
    if (cardEl && cardPid === pid && cardSource === source) return;
    const info = personInfo(places);
    const close = h('button', { className: 'ag-ro-card-x', type: 'button', 'aria-label': '關閉' }, '×');
    close.addEventListener('click', () => {
      if (cardSource === 'auto') dismissedAuto = cardPid;
      closeCard();
    });
    const card = h('aside', { className: `ag-ro-card${source === 'auto' ? ' is-auto' : ''}`, 'aria-label': `${info.name}的職位` },
      close,
      h('h4', {}, info.name, info.qualifier ? h('small', {}, info.qualifier) : null),
      h('ul', { className: 'ag-ro-card-roles' }, ...places.map(placeLine)));
    if (info.treeId) {
      const treeId = info.treeId;
      const go = h('button', { className: 'ag-ro-card-tree', type: 'button' }, '在家譜樹上看');
      go.addEventListener('click', () => options.onTreePerson(treeId));
      card.append(go);
    }
    cardEl?.remove();
    cardEl = card;
    cardSource = source;
    cardPid = pid;
    floats.append(card);
  }

  // Esc、點外面關掉手動打開的小卡（讀經時 Esc 先關小卡，不順便離開讀經）
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || cardSource !== 'manual' || !cardEl) return;
    event.stopPropagation();
    event.preventDefault();
    closeCard();
  }, true);
  document.addEventListener('pointerdown', (event) => {
    if (cardSource !== 'manual' || !cardEl) return;
    const target = event.target as Node | null;
    if (target && (cardEl.contains(target) || (target instanceof Element && target.closest('.ag-ro-chip-main, .ag-ro-sc-main, .ag-ro-cell')))) return;
    closeCard();
  }, true);

  // ── 鏡頭（只捲動自己的容器） ──
  let userListener: (() => void) | null = null;
  let anim = 0;
  let lastTop = 0;
  let lastLeft = 0;
  let pending: { target: string; animate: boolean } | null = null;

  function setScroll(top: number, left: number) {
    el.scrollTop = top;
    el.scrollLeft = left;
    lastTop = el.scrollTop;
    lastLeft = el.scrollLeft;
  }
  const stopScroll = () => { cancelAnimationFrame(anim); anim = 0; };
  const motionOn = () => document.documentElement.dataset.motion !== 'off';
  const notifyUser = () => { stopScroll(); userListener?.(); };
  el.addEventListener('scroll', () => {
    if (Math.abs(el.scrollTop - lastTop) <= 1 && Math.abs(el.scrollLeft - lastLeft) <= 1) return;
    lastTop = el.scrollTop;
    lastLeft = el.scrollLeft;
    notifyUser();
  }, { passive: true });
  el.addEventListener('wheel', notifyUser, { passive: true });
  el.addEventListener('touchmove', notifyUser, { passive: true });
  el.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) notifyUser();
  });

  /** 容器真正看得到的那一塊（讀經時下方或右側被經文欄蓋住的部分不算） */
  function viewSize(): { w: number; h: number } {
    const style = getComputedStyle(el);
    return {
      w: Math.max(1, el.clientWidth - (parseFloat(style.paddingRight) || 0) - (parseFloat(style.paddingLeft) || 0)),
      h: Math.max(1, el.clientHeight - (parseFloat(style.paddingBottom) || 0) - (parseFloat(style.paddingTop) || 0)),
    };
  }
  function measure() {
    const view = viewSize();
    el.style.setProperty('--ag-ro-vh', `${Math.round(view.h)}px`);
    if (pending && el.clientHeight > 0) {
      const next = pending;
      pending = null;
      void flyTo(next.target, false);
    }
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(el);

  function targetElement(target: string): Element | null {
    if (!index) return null;
    const role = roleTarget(target);
    if (role) return cellsByRole.get(cellKey(role.box, role.key))?.[0]?.el ?? boxEls.get(role.box) ?? null;
    const own = cellOf(target);
    if (own) return own.el;
    return boxEls.get(target) ?? null;
  }

  /** 一個人在好幾個方塊裡時，先取這一節所屬的方塊（例如代上 27:5 的比拿雅取「十二班軍隊」，不取護衛長） */
  function cellOf(target: string): Cell | undefined {
    const cells = cellsByPid.get(target);
    if (!cells?.length) return undefined;
    return cells.find((cell) => marks.boxes.has(cell.place.box.id)) ?? cells[0];
  }

  function has(target: string): boolean {
    if (!index) return false;
    const role = roleTarget(target);
    if (role) return index.byCell.has(cellKey(role.box, role.key));
    return index.byPid.has(target) || index.people.has(target) || index.boxes.has(target);
  }

  function flyTo(target: string, animate: boolean): Promise<void> {
    stopScroll();
    const node = targetElement(target);
    if (!node) return Promise.resolve();
    if (el.clientHeight === 0) { pending = { target, animate }; return Promise.resolve(); }
    // 換畫面時容器正在縮放浮上來（transform），量到的位置是縮放後的；等動畫結束再定位
    if (getComputedStyle(el).transform !== 'none') {
      pending = { target, animate };
      window.setTimeout(measure, 160);
      return Promise.resolve();
    }
    const view = viewSize();
    const style = getComputedStyle(el);
    const padTop = parseFloat(style.paddingTop) || 0;
    const er = node.getBoundingClientRect();
    const cr = el.getBoundingClientRect();
    const relTop = er.top - cr.top - padTop;
    const relBottom = er.bottom - cr.top - padTop;
    const relLeft = er.left - cr.left;
    const relRight = er.right - cr.left;
    const fits = relTop >= view.h * 0.1 && relBottom <= view.h * 0.9 && relLeft >= 0 && relRight <= view.w;
    // 已經在舒適的範圍內就不捲；太高的方塊（整個放不下）只要它的上緣看得到
    const tall = er.height > view.h * 0.7;
    if (fits || (tall && relTop >= 0 && relTop <= view.h * 0.5)) return Promise.resolve();
    const contentTop = er.top - cr.top + el.scrollTop;
    const contentLeft = er.left - cr.left + el.scrollLeft;
    let top = tall ? contentTop - view.h * 0.12 : contentTop + er.height / 2 - view.h * 0.4;
    let left = el.scrollLeft;
    if (relLeft < 0 || relRight > view.w) left = contentLeft + er.width / 2 - view.w / 2;
    top = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, top));
    left = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, left));
    if (!animate || !motionOn()) { setScroll(top, left); return Promise.resolve(); }
    const from = { top: el.scrollTop, left: el.scrollLeft };
    const start = performance.now();
    const duration = Math.min(760, 360 + Math.abs(top - from.top) * 0.25);
    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        const eased = 1 - (1 - t) ** 3;
        setScroll(from.top + (top - from.top) * eased, from.left + (left - from.left) * eased);
        if (t < 1) anim = requestAnimationFrame(tick);
        else { anim = 0; resolve(); }
      };
      anim = requestAnimationFrame(tick);
    });
  }

  function locate(target: string): { x: number; y: number } | null {
    if (!roles || !index) return null;
    const layout = miniLayout(roles);
    const role = roleTarget(target);
    const boxId = role ? role.box : cellOf(target)?.place.box.id ?? (index.boxes.has(target) ? target : null);
    const rect = boxId ? layout.boxes.get(boxId) : undefined;
    if (!rect) return null;
    return { x: (rect.x + rect.w / 2) / MINI_W, y: (rect.y + rect.h / 2) / MINI_H };
  }

  function miniature(): SVGElement {
    const svg = svgEl('svg', { class: 'ag-ro-mini', viewBox: `0 0 ${MINI_W} ${MINI_H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    if (!roles) {
      svg.append(svgEl('rect', { class: 'ag-ro-mini-plaque', x: MINI_W / 2 - 22, y: 3, width: 44, height: 10, rx: 1.5 }));
      return svg;
    }
    const layout = miniLayout(roles);
    const { plaque } = layout;
    const stem = svgEl('path', { class: 'ag-ro-mini-line', d: `M${MINI_W / 2} ${plaque.y + plaque.h}V17H${3 + (MINI_W - 6 - 12) / 8}M${MINI_W / 2} 17H${MINI_W - 3 - (MINI_W - 6 - 12) / 8}` });
    svg.append(stem, svgEl('rect', { class: 'ag-ro-mini-plaque', x: plaque.x, y: plaque.y, width: plaque.w, height: plaque.h, rx: 1.5 }));
    for (const [id, rect] of layout.boxes) {
      const round = rect.kind === 'ring24' || rect.kind === 'wheel12';
      svg.append(svgEl('rect', { class: `ag-ro-mini-box${round ? ' is-round' : ''}`, 'data-box': id, x: rect.x, y: rect.y, width: rect.w, height: rect.h, rx: 1.2 }));
    }
    return svg;
  }

  // 家譜樹上的職位印點過來：捲到方塊、閃一下
  let flashTimer = 0;
  function focusBox(boxId: string, memberKey?: string) {
    void ready().then(() => {
      const box = boxEls.get(boxId);
      if (!box) return;
      const cell = memberKey ? cellsByRole.get(cellKey(boxId, memberKey))?.[0]?.el : undefined;
      const aim = cell ?? box;
      // 分頁剛打開的那一刻版面還沒量好，等一個畫面再捲
      requestAnimationFrame(() => {
        void flyTo(cell ? `role:${cellKey(boxId, memberKey!)}` : boxId, true);
        el.querySelectorAll('.is-flash').forEach((node) => node.classList.remove('is-flash'));
        aim.getBoundingClientRect();
        aim.classList.add('is-flash');
        window.clearTimeout(flashTimer);
        flashTimer = window.setTimeout(() => aim.classList.remove('is-flash'), 1900);
      });
    }).catch(() => undefined);
  }

  /** current（人或 role: 格子）在這張圖上的人；用來決定要不要自動出小卡 */
  function currentPid(): string | null {
    const current = marks.current;
    if (!current || !index) return null;
    const role = roleTarget(current);
    if (role) {
      const place = index.byCell.get(cellKey(role.box, role.key));
      return place ? pidOf(place.member) : null;
    }
    return index.byPid.has(current) ? current : null;
  }

  return {
    id: 'roles',
    el,
    page: el,
    ready,
    showPage() { void ready().then(measure).catch(() => undefined); },
    focusBox,
    setReading(on) {
      reading = on;
      if (!on) {
        marks = emptyMarks();
        verseKey = null;
        previousCurrent = null;
        dismissedAuto = null;
        lastAutoPid = null;
        closeCard();
        stopScroll();
      }
      el.classList.toggle('is-reading', on);
      applyMarks();
    },
    setVerse(key) {
      verseKey = key;
    },
    setMarks(next) {
      marks = next;
      applyMarks();
      const pid = currentPid();
      if (pid !== lastAutoPid) { dismissedAuto = null; lastAutoPid = pid; }
      if (pid !== cardPid && cardSource === 'auto') closeCard();
      if (pid && pid !== dismissedAuto) openPerson(pid, 'auto');
    },
    reveal() { /* 組織圖沒有收合的地方 */ },
    flyTo,
    has,
    onUserCamera(listener) { userListener = listener; },
    locate,
    miniature,
    saveView() { return { top: el.scrollTop, left: el.scrollLeft }; },
    restoreView(saved) {
      const view = saved as { top?: number; left?: number } | null;
      if (view && typeof view.top === 'number') setScroll(view.top, view.left ?? 0);
    },
  };
}
