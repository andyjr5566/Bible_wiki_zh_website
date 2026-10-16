import type { GenealogyData, ReadingData } from '../data/types';
import type { PersonGraph } from '../data/model';
import type { CanvasApi, ReadingMarks } from './canvas';
import { svgEl } from './dom';
import { type ReadingStage, type StageMarks } from './stage';

/** 縮影上主線的顏色 class（顏色在 reading.css） */
const LINE_CLASS: Record<string, string> = { '馬太': 'is-matthew', '路加': 'is-luke' };

/**
 * 妻子在丈夫家裡的那張「↗」卡（所生:丈夫:妻子）：娘家在別支的妻子（利亞、拉結、以掃的妻子……），
 * 讀到丈夫這一家時，鏡頭、亮名字、墨線都用丈夫家裡那張卡，順著「丈夫 → 妻子 → 兒女」往下走，不跳回娘家。
 * 沿著讀經路線依序決定每一節（每一段開頭重來），所以從哪一節打開、跳讀都一樣：
 * 1. 這一節提到丈夫，或提到他為丈夫生的孩子 → 丈夫家裡那張卡；
 * 2. 否則提到他的父母（講娘家）→ 本人；
 * 3. 都沒提（「耶和華見利亞失寵」「神顧念拉結」）→ 照這一段前面的決定接下去；前面沒有、他只嫁一位丈夫，就用丈夫家裡那張卡。
 * 回傳：經節 → （妻子 id → 卡的 id）
 */
export function householdAliasByVerse(reading: ReadingData, graph: PersonGraph): Map<string, Map<string, string>> {
  const slotsOfWife = new Map<string, Array<{ slot: string; husband: string }>>();
  for (const [slot, wife] of graph.bornOf) {
    // 卡的 id 是「所生:丈夫:妻子」；丈夫的 id 可能有冒號（撒督#9:11），所以從尾端扣掉妻子
    const husband = slot.slice('所生:'.length, slot.length - wife.length - 1);
    const list = slotsOfWife.get(wife) ?? [];
    list.push({ slot, husband });
    slotsOfWife.set(wife, list);
  }
  const parentsOf = (id: string) => new Set((graph.byId.get(id)?.parents ?? []).map((relation) => relation.id));
  const table = new Map<string, Map<string, string>>();
  for (const segment of reading.segments) {
    // 這一段前面的決定：丈夫家裡那張卡，或妻子本人的 id（講娘家）；沒有記錄＝還沒決定
    const sticky = new Map<string, string>();
    for (const chapter of segment.chapters) {
      for (const verse of chapter.verses) {
        const context = new Set<string>();
        for (const token of verse.t) {
          for (const id of [token.id, ...(token.from ?? []), ...(token.to ?? [])]) if (id) context.add(id);
        }
        const alias = new Map<string, string>();
        for (const wife of context) {
          const slots = slotsOfWife.get(wife);
          if (!slots) continue;
          const hit = slots.find(({ husband }) => context.has(husband)
            || [...context].some((other) => other !== wife && parentsOf(other).has(wife) && parentsOf(other).has(husband)));
          const ownFamily = [...parentsOf(wife)].some((parent) => context.has(parent));
          // 都沒提時：照這一段前面的決定；前面沒有、而且他只嫁一位丈夫，就用丈夫家裡那張卡
          const choice = hit ? hit.slot : ownFamily ? wife : sticky.get(wife) ?? (slots.length === 1 ? slots[0]!.slot : null);
          if (choice) sticky.set(wife, choice);
          if (choice && choice !== wife) alias.set(wife, choice);
        }
        if (alias.size) table.set(`${chapter.book}${chapter.n}:${verse.v}`, alias);
      }
    }
  }
  return table;
}

/**
 * 家譜樹的讀經舞台：包住現有的畫布（CanvasApi），把讀經程式給的標記轉成畫布認得的樣子。
 * 職位圖才有的 id（rid、role: 開頭）一律在這裡丟掉。
 */
export function createTreeStage(
  canvas: CanvasApi,
  data: GenealogyData,
  graph: PersonGraph,
  wrap: HTMLElement,
  reading?: ReadingData,
): ReadingStage {
  const onTree = (id: string) => !id.startsWith('role:') && graph.byId.has(id);

  // 圖上有哪些節點：版面重算過（打開了旁支）才重建
  let knownLayout: ReturnType<CanvasApi['layoutNow']> | null = null;
  let nodeIds = new Set<string>();
  function nodes() {
    const layout = canvas.layoutNow();
    if (layout !== knownLayout) {
      knownLayout = layout;
      nodeIds = new Set([...layout.nodes, ...layout.groups].map((node) => node.id));
    }
    return layout;
  }

  // 縮影的取景：主線所有節點的外框。locate 用同一個取景，小紅點才對得上縮影
  let frame: { x: number; y: number; width: number; height: number } | null = null;
  function spineBounds() {
    const layout = nodes();
    const spine = new Set(Object.values(data.spine.lines).flat());
    const list = layout.nodes.filter((node) => spine.has(node.id));
    const use = list.length ? list : layout.nodes;
    if (!use.length) return { x: 0, y: 0, width: 1, height: 1 };
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const node of use) {
      x0 = Math.min(x0, node.x - node.rectWidth / 2);
      x1 = Math.max(x1, node.x + node.rectWidth / 2);
      y0 = Math.min(y0, node.y - node.height / 2);
      y1 = Math.max(y1, node.y + node.height / 2);
    }
    // 旁支會往主線兩側伸出去：左右多留一些邊，旁支上的人才不會全擠在縮影的邊線上
    const width = Math.max(1, x1 - x0);
    const height = Math.max(1, y1 - y0);
    const padX = Math.max(width * 0.8, 600);
    const padY = height * 0.02;
    return { x: x0 - padX, y: y0 - padY, width: width + padX * 2, height: height + padY * 2 };
  }
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

  // 妻子要停在本人還是丈夫家裡那張卡：沿著讀經路線先算好每一節（見 householdAliasByVerse）
  const aliasTable = reading ? householdAliasByVerse(reading, graph) : new Map<string, Map<string, string>>();
  let alias = new Map<string, string>();
  let previousAlias = new Map<string, string>();
  const mapId = (id: string, table = alias) => table.get(id) ?? id;
  /** 讀到、已讀過的歸回連結指到的樹上祖先：讀過就留著淡淡的亮 */
  const linkedAncestors = (links: Set<number>): string[] => {
    const ids: string[] = [];
    for (const index of links) {
      for (const target of reading?.links[index]?.to ?? []) if (target.tree && onTree(target.tree)) ids.push(target.tree);
    }
    return ids;
  };

  return {
    id: 'tree',
    el: wrap,
    ready: () => Promise.resolve(),
    setReading(on) { canvas.setReading(on); },
    setVerse(key) {
      previousAlias = alias;
      alias = aliasTable.get(key) ?? new Map();
    },
    setMarks(marks: StageMarks) {
      const lit = new Set([...marks.lit].filter(onTree).map((id) => mapId(id)));
      // 上一節用丈夫家裡那張卡的，退淡時也退在那張卡上
      const trail = new Set([...marks.trail, ...linkedAncestors(marks.links)].filter(onTree)
        .map((id) => mapId(mapId(id), previousAlias)).filter((id) => !lit.has(id)));
      const next: ReadingMarks = {
        lit,
        trail,
        current: marks.current && onTree(marks.current) ? mapId(marks.current) : null,
        seals: marks.seals.filter((seal) => onTree(seal.id)).map((seal) => ({ ...seal, id: mapId(seal.id) })),
        ink: marks.ink.filter((line) => onTree(line.from) && onTree(line.to))
          .map((line) => ({ ...line, from: mapId(line.from), to: mapId(line.to) })),
        fresh: marks.fresh,
      };
      canvas.setReadingMarks(next);
    },
    reveal(ids) {
      const wanted = ids.filter(onTree);
      if (wanted.length) canvas.expandMany(wanted.map((id) => mapId(id)));
    },
    async flyTo(target, animate) {
      if (!onTree(target)) return;
      await canvas.flyTo(mapId(target), animate);
    },
    has(target) {
      if (!onTree(target)) return false;
      nodes();
      return nodeIds.has(mapId(target));
    },
    onUserCamera(listener) { canvas.onUserCamera(listener); },
    locate(target) {
      if (!onTree(target)) return null;
      nodes();
      const id = mapId(target);
      if (!nodeIds.has(id)) return null;
      const node = [...canvas.layoutNow().nodes, ...canvas.layoutNow().groups].find((item) => item.id === id);
      if (!node) return null;
      const box = frame ?? spineBounds();
      return { x: clamp01((node.x - box.x) / box.width), y: clamp01((node.y - box.y) / box.height) };
    },
    miniature() {
      const layout = nodes();
      frame = spineBounds();
      const box = frame;
      const position = new Map(layout.nodes.map((node) => [node.id, node]));
      // 座標換成 0–1，整張小圖拉到容器大小；只是主線的形狀，不求精細
      const svg = svgEl('svg', { class: 'ag-rd-mini-svg', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
      for (const [name, ids] of Object.entries(data.spine.lines)) {
        const points = ids.map((id) => position.get(id)).filter((node): node is NonNullable<typeof node> => Boolean(node));
        if (points.length < 2) continue;
        const d = points.map((node, index) => `${index ? 'L' : 'M'}${clamp01((node.x - box.x) / box.width).toFixed(4)} ${clamp01((node.y - box.y) / box.height).toFixed(4)}`).join('');
        svg.append(svgEl('path', { class: `ag-rd-mini-line ${LINE_CLASS[name] ?? ''}`.trim(), d }));
      }
      return svg;
    },
    saveView() { return canvas.getExpanded(); },
    restoreView(saved) { if (saved instanceof Set) canvas.setExpanded(saved as Set<string>); },
  };
}
