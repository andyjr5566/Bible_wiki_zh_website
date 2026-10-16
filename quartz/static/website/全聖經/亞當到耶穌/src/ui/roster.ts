import { pathToFirstAncestor, type PersonGraph } from '../data/model';
import type { GenealogyData, ReadingData, Roster, RosterData, RosterFamily, RosterName, RosterSection } from '../data/types';
import { h, svgEl } from './dom';
import {
  PIP_COMPACT_CARDS, PIP_MAX_CARDS, barProgress, barWidth, charsShown, familyLead, familyTags, flattenRows, numberLength, formatCount, isLandmark, mergeMarks, miniLayout, namesBar, pickPipLinks,
  pipAllowed, pipChain, pipNames, pipPeople, pipTitle, refGroups, refLabel, refsText, rosterClassName, rosterMark, rowKind, rowState, sealTilt, sectionHasTitle, tileClassName, totalUnitText,
  verseIndex, type FamilyTag, type FlatRow, type LinkMark,
} from './roster-model';
import { emptyMarks, type ReadingStage, type StageMarks } from './stage';
import '../roster.css';

/**
 * 名冊（拉 2、拉 8、拉 10、尼 7、尼 10）：讀經的第三個舞台，疊在畫布上。
 * 讀到哪寫到哪：這一行、這個名字、人數條都在朗讀唸到的那一刻才出現；
 * 前面的家譜裡記過的家族變金色、蓋「冊上有名」，旁邊開一個小窗，畫家譜樹的一小角。
 */
export interface RosterOptions {
  /** 第一次 ready() 才呼叫（動態 import roster.json） */
  load(): Promise<RosterData>;
  reading: ReadingData;
  data: GenealogyData;
  graph: PersonGraph;
  /** 點子母畫面：讀經程式換到家譜樹看這個人 */
  onTreePerson(id: string): void;
  /** 點家族軌跡的小籤：讀經程式跳到那一節（例如「拉10:25」）讀 */
  onJump?(key: string): void;
}

const PIP_MIN_OPEN_MS = 2500;
const PIP_EDGE = 14;
const PIP_GAP = 6;
const NOT_PLACED = -1;

const motionOn = () => document.documentElement.dataset.motion !== 'off';

/** 一段文字拆成一個個字，讀到哪個字哪個字才出現 */
interface Written {
  chars: HTMLElement[];
  /** 經文裡第一個字的位置 */
  start: number;
  /** 現在出現了幾個字 */
  shown: number;
}

interface TileView {
  name: RosterName;
  el: HTMLElement;
  slot: HTMLElement;
  text: Written;
  shown: boolean;
  markKey: string;
  /** 名字牌的框線畫出來了幾成（0–1） */
  ink: number;
}

/** 一行（或一個名字）底下的一排家族軌跡小籤：那一行（那個名字）出現才一起出現 */
interface FamLine {
  el: HTMLElement;
  /** 屬於哪個名字；整行的家族是 null */
  tile: TileView | null;
  shown: boolean;
}

interface RowView {
  flat: FlatRow;
  el: HTMLElement;
  /** 標籤旁邊放朱印的地方 */
  slot: HTMLElement | null;
  label: HTMLElement | null;
  /** 標籤一個字一個字寫上去 */
  labelText: Written | null;
  /** 經文裡那串中文數字的字數 */
  numLen: number;
  /** 這一行所在那一節的字數；目前那一行底下的「讀到哪」用 */
  verseLen: number;
  /** 目前那一行底下已經讀過的比例（百分比），不是目前那一行就是 -1 */
  read: number;
  fill: HTMLElement | null;
  /** 人數條現在的寬度（比例，0–1） */
  width: number;
  num: HTMLElement | null;
  noteEl: HTMLElement;
  famEl: HTMLElement;
  famLines: FamLine[];
  quoteEl: HTMLElement | null;
  subtotal: HTMLElement | null;
  tiles: TileView[];
  visible: boolean;
  filled: boolean;
  quoteShown: boolean;
  subtotalShown: boolean;
  markKey: string;
}

interface SectionView {
  section: RosterSection;
  el: HTMLElement;
  on: boolean;
  /** 分區小標也是經文裡讀出來的字（「尼提寧（就是殿役）」）：一個字一個字寫上去 */
  title: Written;
  /** 小標在第一行那一節裡的位置；找不到就跟著第一行一起出現 */
  titleStart: number;
  /** 第一行所在那一節在名冊經節清單的位置 */
  idx: number;
}

interface RosterView {
  roster: Roster;
  root: HTMLElement;
  flat: FlatRow[];
  rows: RowView[];
  sections: SectionView[];
  nowRow: number;
  nowEl: HTMLElement | null;
  progress: number;
}

const OFF = 'ag-rs-off';

export function createRoster(options: RosterOptions): ReadingStage {
  let rosters: RosterData | null = null;
  let loading: Promise<void> | null = null;
  let reading = false;
  let marks: StageMarks = emptyMarks();
  let key = '';
  let chars = 0;
  let jumped = false;
  const views: RosterView[] = [];
  let active: RosterView | null = null;
  /** 目前這一節在 active 名冊裡的位置；不在名冊裡 -1（保持上一份、不畫新東西） */
  let cur = NOT_PLACED;

  const floats = h('div', { className: 'ag-rs-floats' });
  const book = h('div', { className: 'ag-rs-book' }, h('p', { className: 'ag-rs-empty' }, '載入中…'));
  const el = h('section', { className: 'ag-roster', 'aria-label': '歸回的名冊' }, floats, book);

  // ── 載入與畫面 ──
  const ready = (): Promise<void> => {
    loading ??= options.load().then((value) => {
      rosters = value;
      build();
      measure();
      applyVerse();
      repaint();
    }).catch((error: unknown) => {
      loading = null;
      book.replaceChildren(h('p', { className: 'ag-rs-empty' }, '名冊暫時打不開，請稍後再試。'));
      throw error;
    });
    return loading;
  };

  function build() {
    if (!rosters) return;
    views.length = 0;
    book.replaceChildren();
    for (const roster of rosters.rosters) {
      const view = buildRoster(roster);
      views.push(view);
      book.append(view.root);
    }
  }

  function segmentRange(roster: Roster): string {
    return options.reading.segments.find((segment) => segment.id === roster.segment)?.range ?? '';
  }

  function buildRoster(roster: Roster): RosterView {
    const flat = flattenRows(roster);
    const range = segmentRange(roster);
    const families = rosters?.families;
    const head = h('header', { className: 'ag-rs-head' },
      h('span', { className: 'ag-rs-title-seal', 'aria-hidden': 'true' }, '名冊'),
      h('div', { className: 'ag-rs-head-text' },
        h('h2', { className: 'ag-rs-title' }, roster.title),
        range ? h('p', { className: 'ag-rs-range' }, range) : null));
    if (roster.quote) {
      head.append(h('p', { className: 'ag-rs-head-quote' },
        `「${roster.quote.text}」`,
        h('cite', {}, refLabel(roster.quote.ref))));
    }
    const sheet = h('div', { className: 'ag-rs-sheet' }, head);
    const rows: RowView[] = [];
    const sections: SectionView[] = [];
    roster.sections.forEach((section, si) => {
      const titleText = written(section.title, 0);
      // 沒有標題的分區（拉 10:44 那句引句）不畫標題
      const titled = sectionHasTitle(section);
      const sectionEl = h('section', { className: `ag-rs-section ${OFF}${section.lost ? ' is-lost' : ''}${titled ? '' : ' is-untitled'}` },
        titled ? h('h3', { className: 'ag-rs-section-title' }, h('span', { className: 'ag-rs-section-text' }, ...titleText.nodes)) : null);
      const firstRow = section.rows[0];
      const titleStart = firstRow && titled ? verseText(firstRow.at).indexOf(section.title) : -1;
      titleText.written.start = Math.max(0, titleStart);
      let previousWho: string | undefined;
      for (const item of flat.filter((entry) => entry.si === si)) {
        const rv = buildRow(item, previousWho, roster, families);
        previousWho = item.row.who;
        rows.push(rv);
        sectionEl.append(rv.el);
      }
      sections.push({ section, el: sectionEl, on: false, title: titleText.written, titleStart, idx: firstRow ? verseIndex(roster, firstRow.at) : -1 });
      sheet.append(sectionEl);
    });
    // 讀到最後一行時，名冊底下留一些空，捲動才有地方放
    sheet.append(h('div', { className: 'ag-rs-foot', 'aria-hidden': 'true' }));
    const root = h('div', { className: `${rosterClassName(roster)} ${OFF}`, 'data-segment': roster.segment }, sheet);
    return { roster, root, flat, rows, sections, nowRow: -1, nowEl: null, progress: -1 };
  }

  const verseTexts = new Map<string, string>();
  function verseText(at: string): string {
    if (!verseTexts.size) {
      for (const segment of options.reading.segments) {
        for (const chapter of segment.chapters) {
          for (const verse of chapter.verses) verseTexts.set(`${chapter.book}${chapter.n}:${verse.v}`, verse.text);
        }
      }
    }
    return verseTexts.get(at) ?? '';
  }

  /** 一段文字拆成一個個字：start 是它在經文那一節裡第一個字的位置 */
  function written(text: string, start: number): { nodes: HTMLElement[]; written: Written } {
    const nodes = Array.from(text).map((char) => h('span', { className: 'ag-rs-ch' }, char));
    return { nodes, written: { chars: nodes, start, shown: 0 } };
  }

  /** 讀到的字亮起來（淡入、由淡墨到濃墨），沒讀到的藏起來；跳讀、跳回前面也是同一個函式 */
  function writeChars(text: Written, count: number, animate = false) {
    if (count === text.shown) return;
    const lo = Math.min(count, text.shown);
    const hi = Math.max(count, text.shown);
    for (let i = lo; i < hi; i += 1) {
      const node = text.chars[i]!;
      const on = i < count;
      node.classList.toggle('is-on', on);
      // 新寫上去的字：墨暈暈開一下
      node.classList.toggle('is-new', on && animate);
    }
    text.shown = count;
  }

  function setInk(tile: TileView, ink: number) {
    if (Math.abs(ink - tile.ink) < 0.001) return;
    tile.ink = ink;
    tile.el.style.setProperty('--rs-ink', ink.toFixed(3));
  }

  /** 一排家族軌跡小籤：開頭小字「也在」，後面每一處一個可以點的小籤 */
  function famLine(tags: FamilyTag[], lead: string): HTMLElement {
    const line = h('div', { className: `ag-rs-fam-line ${OFF}` }, h('span', { className: 'ag-rs-fam-lead' }, lead));
    for (const tag of tags) {
      const button = h('button', {
        className: 'ag-rs-fam-tag', type: 'button', title: tag.family,
        'aria-label': `${tag.family}也在${tag.text}，跳到那一節讀`,
      }, h('span', { className: 'ag-rs-fam-ref' }, tag.ref), tag.count ? h('span', { className: 'ag-rs-fam-cnt' }, tag.count) : null);
      button.addEventListener('click', () => options.onJump?.(tag.at));
      line.append(button);
    }
    return line;
  }

  function buildRow(flat: FlatRow, previousWho: string | undefined, roster: Roster, families: RosterFamily[] | undefined): RowView {
    const { row, section } = flat;
    const kind = rowKind(section, row);
    const barred = namesBar(section, row);
    const el = h('div', { className: `ag-rs-row is-${kind}${barred ? ' has-bar' : ''} ${OFF}${row.differs ? ' is-differs' : ''}` });
    const rv: RowView = {
      flat, el, slot: null, label: null, labelText: null, verseLen: Array.from(verseText(row.at)).length, read: -1, numLen: row.n !== undefined ? numberLength(verseText(row.at), row.n) : 0, fill: null, width: 0, num: null, quoteEl: null, subtotal: null, tiles: [],
      noteEl: h('div', { className: 'ag-rs-note' }),
      famEl: h('div', { className: `ag-rs-fam ${OFF}` }), famLines: [],
      visible: false, filled: false, quoteShown: false, subtotalShown: false, markKey: '',
    };
    if (row.who && row.who !== previousWho) el.append(h('p', { className: 'ag-rs-who' }, row.who));
    const unit = row.unit ? h('small', {}, row.unit) : null;
    const count = row.count !== undefined ? formatCount(row.count) : '';
    const totalUnit = totalUnitText(row.unit);

    const labelStart = row.ls ?? row.s;
    /** 標籤＋人數條＋數字那一排（有標籤的名字行也用它） */
    const mainLine = () => {
      rv.slot = h('span', { className: 'ag-rs-slot' });
      const text = written(row.label ?? '', labelStart);
      rv.labelText = text.written;
      rv.label = h('span', { className: 'ag-rs-label' }, h('span', { className: 'ag-rs-label-text' }, ...text.nodes), rv.slot);
      rv.num = h('span', { className: 'ag-rs-num ag-rs-hide' }, h('b', {}, count), unit);
      let middle: HTMLElement;
      if (kind === 'bar' || barred) {
        rv.fill = h('span', { className: 'ag-rs-fill' });
        rv.fill.style.setProperty('--rs-w', '0%');
        middle = h('span', { className: 'ag-rs-bar' }, rv.fill);
      } else {
        middle = h('span', { className: 'ag-rs-leader' });
      }
      if (row.count === undefined) return h('div', { className: 'ag-rs-main is-label-only' }, rv.label);
      return h('div', { className: 'ag-rs-main' }, rv.label, middle, rv.num);
    };
    if (kind === 'big') {
      const text = written(row.label ?? '', labelStart);
      rv.labelText = text.written;
      rv.label = row.label ? h('span', { className: 'ag-rs-big-label' }, ...text.nodes) : null;
      rv.num = h('span', { className: 'ag-rs-big-num ag-rs-hide' }, h('b', {}, count), unit);
      el.append(h('div', { className: 'ag-rs-bigbox' }, rv.label, rv.num));
    } else if (kind === 'total') {
      const text = written(row.label ?? '', labelStart);
      rv.labelText = text.written;
      rv.label = h('span', { className: 'ag-rs-label' }, h('span', { className: 'ag-rs-label-text' }, ...text.nodes));
      rv.num = h('span', { className: 'ag-rs-num ag-rs-hide' }, '共 ', h('b', {}, count), totalUnit);
      el.append(h('div', { className: 'ag-rs-totalbox' }, rv.label, rv.num));
    } else if (kind === 'names') {
      if (barred) {
        el.append(mainLine());
      } else if (row.label) {
        rv.slot = h('span', { className: 'ag-rs-slot' });
        const text = written(row.label, labelStart);
        rv.labelText = text.written;
        rv.label = h('span', { className: 'ag-rs-label' }, h('span', { className: 'ag-rs-label-text' }, ...text.nodes));
        el.append(h('div', { className: 'ag-rs-caption' }, rv.label, rv.slot));
      }
      const tiles = h('div', { className: 'ag-rs-tiles' });
      (row.names ?? []).forEach((name, ni) => {
        const slot = h('span', { className: 'ag-rs-slot' });
        const text = written(name.t, name.s);
        const tile = h('span', { className: `${tileClassName(roster)} ${OFF}` }, h('span', { className: 'ag-rs-tile-name' }, ...text.nodes), slot);
        tile.style.setProperty('--rs-ink', '0');
        if (roster.seal) tile.style.setProperty('--rs-tilt', `${sealTilt(ni)}deg`);
        rv.tiles.push({ name, el: tile, slot, text: text.written, shown: false, markKey: '', ink: 0 });
        tiles.append(tile);
      });
      el.append(tiles);
      if (row.count !== undefined && !barred) {
        rv.subtotal = h('p', { className: `ag-rs-subtotal ag-rs-hide` }, '共 ', h('b', {}, count), totalUnit);
        el.append(rv.subtotal);
      }
    } else if (kind === 'bar' || kind === 'plain') {
      el.append(mainLine());
    }
    el.append(rv.noteEl);
    // 家族軌跡：整行的家族，再來是各個名字的家族
    const rowTags = familyTags(families, row.fam, roster.segment);
    if (rowTags.length) {
      const line = famLine(rowTags, familyLead(rowTags, [row.label]));
      rv.famLines.push({ el: line, tile: null, shown: false });
      rv.famEl.append(line);
    }
    rv.tiles.forEach((tile) => {
      const tags = familyTags(families, tile.name.fam, roster.segment);
      if (!tags.length) return;
      const line = famLine(tags, familyLead(tags, [tile.name.t, row.label], tile.name.t));
      rv.famLines.push({ el: line, tile, shown: false });
      rv.famEl.append(line);
    });
    if (rv.famLines.length) el.append(rv.famEl);
    if (row.quote) {
      rv.quoteEl = h('p', { className: `ag-rs-quote ${OFF}` }, `「${row.quote.t}」`);
      el.append(rv.quoteEl);
    }
    return rv;
  }

  // ── 畫出目前的狀態 ──
  const read = () => marks.links;

  function stampNode(text: string, fresh: boolean, small = false): HTMLElement {
    return h('span', { className: `ag-rs-seal${small ? ' is-small' : ''}${fresh ? ' is-fresh' : ''}`, 'aria-label': text }, text);
  }

  function markKeyOf(mark: LinkMark): string {
    return `${mark.kind ?? ''}|${mark.refs.join(',')}`;
  }

  function setMarkOn(target: HTMLElement, slot: HTMLElement | null, mark: LinkMark, previous: string, animate: boolean, small: boolean) {
    target.classList.toggle('is-named', mark.kind === 'named');
    target.classList.toggle('is-town', mark.kind === 'town');
    if (!slot) return;
    const was = previous.split('|')[0];
    slot.replaceChildren();
    if (mark.kind === 'named') slot.append(stampNode('冊上有名', animate && was !== 'named', small));
  }

  function paintNote(rv: RowView, mark: LinkMark, groups: ReturnType<typeof refGroups>) {
    const note = rv.noteEl;
    note.replaceChildren();
    if (rv.tiles.length) {
      // 名字行：每個連到前面家譜的名字，出處併成一行
      for (const group of groups) note.append(h('p', { className: 'ag-rs-refs' }, h('span', {}, group.labels.join('、')), group.refs));
      note.classList.toggle(OFF, !groups.length);
      return;
    }
    if (mark.kind === null) { note.classList.add(OFF); return; }
    note.classList.remove(OFF);
    if (mark.kind === 'town') note.append(h('span', { className: 'ag-rs-town-tag' }, '家譜裡有這座城'));
    if (mark.refs.length) note.append(h('span', { className: 'ag-rs-refs' }, refsText(mark.refs)));
  }

  /** 把 view 畫成「讀到 (cur, chars)」的樣子。animate＝新出現的東西要播動畫 */
  function paint(view: RosterView, animate: boolean) {
    const links = options.reading.links;
    let progress = 0;
    let nowRow = -1;
    let nowEl: HTMLElement | null = null;
    let changed = false;
    view.rows.forEach((rv, i) => {
      const { row } = rv.flat;
      // 動畫關閉：唸到數字就直接畫滿、數字同時出現（不跟著數字的字慢慢伸長）
      const numLen = motionOn() ? rv.numLen : 0;
      const state = rowState(row, cur, rv.flat.idx, chars, numLen);
      const el = rv.el;
      // 這一行出現／消失
      if (state.visible !== rv.visible) {
        changed = true;
        rv.visible = state.visible;
        el.classList.toggle(OFF, !state.visible);
        el.classList.remove('is-fresh');
        if (state.visible && animate) el.classList.add('is-fresh');
        if (!state.visible) {
          rv.filled = false;
          rv.quoteShown = false;
          rv.subtotalShown = false;
          rv.markKey = '';
          rv.fill?.style.setProperty('--rs-w', '0%');
          rv.width = 0;
          if (rv.labelText) writeChars(rv.labelText, 0);
          rv.num?.classList.add('ag-rs-hide');
          rv.subtotal?.classList.add('ag-rs-hide');
          rv.quoteEl?.classList.add(OFF);
          el.classList.remove('is-now', 'is-named', 'is-town');
          rv.slot?.replaceChildren();
          rv.noteEl.replaceChildren();
          for (const tile of rv.tiles) {
            tile.shown = false; tile.markKey = ''; tile.el.classList.add(OFF); tile.el.classList.remove('is-named', 'is-town', 'is-fresh'); tile.slot.replaceChildren();
            writeChars(tile.text, 0); setInk(tile, 0);
          }
          for (const line of rv.famLines) { line.shown = false; line.el.classList.add(OFF); line.el.classList.remove('is-fresh'); }
          rv.famEl.classList.add(OFF);
        }
      }
      if (!state.visible) return;
      progress += 1;
      // 標籤一個字一個字寫上去
      if (rv.labelText) writeChars(rv.labelText, charsShown(rv.labelText.start, rv.labelText.chars.length, cur, rv.flat.idx, chars), animate);
      // 人數條跟著唸數字的字伸長
      if (rv.fill) {
        const width = barWidth(row.count ?? 0, view.roster.max, barProgress(row.n ?? row.s, numLen, cur, rv.flat.idx, chars));
        if (Math.abs(width - rv.width) > 0.0005) {
          rv.width = width;
          rv.fill.style.setProperty('--rs-w', `${(width * 100).toFixed(2)}%`);
        }
      }
      // 數字（等條伸滿才出現）
      if (state.filled !== rv.filled) {
        rv.filled = state.filled;
        changed = true;
        rv.num?.classList.toggle('ag-rs-hide', !state.filled);
        rv.num?.classList.remove('is-fresh');
        if (state.filled && animate) rv.num?.classList.add('is-fresh');
      }
      // 引句
      if (state.quoteShown !== rv.quoteShown) {
        rv.quoteShown = state.quoteShown;
        changed = true;
        rv.quoteEl?.classList.toggle(OFF, !state.quoteShown);
        rv.quoteEl?.classList.remove('is-fresh');
        if (state.quoteShown && animate) rv.quoteEl?.classList.add('is-fresh');
      }
      if (state.quoteShown) progress += 1;
      // 名字一個個落下
      let lastTile: HTMLElement | null = null;
      const tileMarks: Array<{ label: string; mark: LinkMark }> = [];
      for (const tile of rv.tiles) {
        const typed = charsShown(tile.text.start, tile.text.chars.length, cur, rv.flat.idx, chars);
        const shown = typed > 0;
        if (shown !== tile.shown) {
          tile.shown = shown;
          changed = true;
          tile.el.classList.toggle(OFF, !shown);
          tile.el.classList.remove('is-fresh');
          if (shown && animate) tile.el.classList.add('is-fresh');
          if (!shown) { tile.markKey = ''; tile.slot.replaceChildren(); tile.el.classList.remove('is-named', 'is-town'); }
        }
        if (!shown) continue;
        progress += 1;
        lastTile = tile.el;
        // 名字一個字一個字寫上去，名字牌的框線跟著畫出來
        writeChars(tile.text, typed, animate);
        setInk(tile, typed / tile.text.chars.length);
        const mark = tile.name.link === undefined ? { kind: null, refs: [] } as LinkMark : rosterMark(view.roster, links, [tile.name.link], read());
        const markKey = markKeyOf(mark);
        if (markKey !== tile.markKey) {
          changed = true;
          setMarkOn(tile.el, tile.slot, mark, tile.markKey, animate, true);
          tile.markKey = markKey;
        }
        if (mark.kind) tileMarks.push({ label: tile.name.t, mark });
      }
      // 名字行的小計
      if (rv.subtotal) {
        const total = row.names?.length ?? 0;
        const show = row.n !== undefined ? state.filled : total > 0 && state.namesShown === total;
        if (show !== rv.subtotalShown) {
          rv.subtotalShown = show;
          changed = true;
          rv.subtotal.classList.toggle('ag-rs-hide', !show);
          rv.subtotal.classList.remove('is-fresh');
          if (show && animate) rv.subtotal.classList.add('is-fresh');
        }
      }
      // 家族軌跡小籤：這一行（這個名字）出現了才一起出現
      if (rv.famLines.length) {
        let any = false;
        for (const line of rv.famLines) {
          // 整行的小籤等標籤寫完才出現；名字的小籤等那個名字寫完才出現
          const written = line.tile ? line.tile.text : rv.labelText;
          const show = !written || written.chars.length === 0 || written.shown >= written.chars.length;
          if (show !== line.shown) {
            line.shown = show;
            changed = true;
            line.el.classList.toggle(OFF, !show);
            line.el.classList.remove('is-fresh');
            if (show && animate) line.el.classList.add('is-fresh');
          }
          if (show) any = true;
        }
        rv.famEl.classList.toggle(OFF, !any);
      }
      // 冊上有名／家譜裡有這座城（整行）
      const rowMark = rosterMark(view.roster, links, row.links ?? [], read());
      const merged = rv.tiles.length ? mergeMarks([rowMark, ...tileMarks.map((item) => item.mark)]) : rowMark;
      const markKey = `${markKeyOf(merged)}#${tileMarks.map((item) => `${item.label}:${markKeyOf(item.mark)}`).join(';')}`;
      if (markKey !== rv.markKey) {
        changed = true;
        const previous = rv.markKey;
        rv.markKey = markKey;
        if (rv.tiles.length) {
          const groups = refGroups([
            ...(rowMark.refs.length ? [{ label: row.label ?? '', refs: rowMark.refs }] : []),
            ...tileMarks.map((item) => ({ label: item.label, refs: item.mark.refs })),
          ].filter((item) => item.label));
          paintNote(rv, merged, groups);
          setMarkOn(el, rv.slot, rowMark, previous, animate, false);
          el.classList.toggle('is-named', false);
          el.classList.toggle('is-town', false);
        } else {
          setMarkOn(el, rv.slot, merged, previous, animate, false);
          paintNote(rv, merged, []);
        }
      }
      nowRow = i;
      nowEl = lastTile ?? el;
    });
    // 分區：有一行出現才顯示
    view.sections.forEach((section, si) => {
      const anyRow = view.rows.some((rv) => rv.flat.si === si && rv.visible);
      const length = section.title.chars.length;
      // 小標在經文裡讀出來的時候就一個字一個字寫上去；經文沒有這串字，就跟著第一行一起出現
      const typed = anyRow ? length : section.titleStart >= 0 ? charsShown(section.titleStart, length, cur, section.idx, chars) : 0;
      const on = anyRow || typed > 0;
      if (on !== section.on) { section.on = on; section.el.classList.toggle(OFF, !on); changed = true; }
      writeChars(section.title, typed, animate);
    });
    // 目前讀到的那一行
    if (nowRow !== view.nowRow) {
      const old = view.nowRow >= 0 ? view.rows[view.nowRow] : undefined;
      if (old) { old.el.classList.remove('is-now'); old.el.style.removeProperty('--rs-read'); old.read = -1; }
      if (nowRow >= 0) {
        const next = view.rows[nowRow]!.el;
        // 呼吸的節拍跟著全頁同一個時鐘（每 2 秒一圈），換到新的一行也不會重新起拍
        next.style.setProperty('--rs-breath-delay', `${-(performance.now() % 2000).toFixed(0)}ms`);
        next.classList.add('is-now');
      }
      view.nowRow = nowRow;
    }
    // 目前那一行底下一道淡淡的朱紅，跟著朗讀由左往右染過去（前面的節整行染滿）
    const nowView = nowRow >= 0 ? view.rows[nowRow] : undefined;
    if (nowView) {
      const pct = nowView.flat.idx < cur || nowView.verseLen <= 0 ? 100 : Math.min(100, (chars / nowView.verseLen) * 100);
      const rounded = Math.round(pct * 2) / 2;
      if (rounded !== nowView.read) { nowView.read = rounded; nowView.el.style.setProperty('--rs-read', `${rounded}%`); }
    }
    const moved = nowEl !== view.nowEl || progress !== view.progress;
    view.nowEl = nowEl;
    view.progress = progress;
    // 版面改過：記下現在的捲動位置，瀏覽器因內容縮短而夾回來的捲動不當成使用者的動作
    if (changed) lastTop = el.scrollTop;
    if (moved) {
      if (autoScroll) void follow(animate);
      else placePip();
    }
  }

  function clearAnimations(view: RosterView) {
    view.root.querySelectorAll('.is-fresh, .is-grow, .is-new').forEach((node) => node.classList.remove('is-fresh', 'is-grow', 'is-new'));
    if (pip) { pip.el.classList.remove('is-enter'); pip.fresh = false; }
  }

  function repaint() {
    if (!active || cur < 0) return;
    paint(active, !jumped && motionOn());
  }

  /** 這一節屬於哪一份名冊：換上去；不在任何名冊裡就保持上一份 */
  function applyVerse() {
    if (!views.length) return;
    const found = views.find((view) => verseIndex(view.roster, key) >= 0);
    if (found) {
      if (found !== active) {
        if (active) active.root.classList.add(OFF);
        active = found;
        active.root.classList.remove(OFF);
        setScroll(0, 0);
      }
      cur = verseIndex(found.roster, key);
    } else {
      cur = NOT_PLACED;
    }
  }

  // ── 子母畫面 ──
  interface Pip {
    el: HTMLButtonElement;
    sig: string;
    openedAt: number;
    fresh: boolean;
  }
  let pip: Pip | null = null;
  let pipTimer = 0;
  let pipLeave = 0;
  const pathCache = new Map<string, string[]>();
  const onTree = (id: string) => options.graph.byId.has(id);
  const nameOf = (id: string) => options.graph.byId.get(id)?.name ?? id;

  /** 讀者認得的人：大衛、亞倫、雅各（以色列）的兒子 */
  function isAnchor(id: string): boolean {
    const person = options.graph.byId.get(id);
    return isLandmark(id, (person?.parents ?? []).map((parent) => parent.id));
  }

  function pathOf(id: string): string[] {
    let ids = pathCache.get(id);
    if (!ids) {
      ids = pathToFirstAncestor(id, options.data, options.graph)?.ids ?? [id];
      pathCache.set(id, ids);
    }
    return ids;
  }

  function buildPip(indices: number[]): HTMLButtonElement {
    const links = options.reading.links;
    const people = pipPeople(links, indices, onTree);
    const names = pipNames(links, indices, onTree, nameOf);
    const title = pipTitle(names);
    const tree = h('span', { className: 'ag-rs-pip-tree' });
    // 手機上的小窗精簡：最多 3 張卡、不寫 card 文字，只留出處
    const compact = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 520px)').matches;
    for (const id of people) {
      const chain = h('span', { className: 'ag-rs-chain' });
      pipChain(pathOf(id), isAnchor, compact ? PIP_COMPACT_CARDS : PIP_MAX_CARDS).forEach((item, i) => {
        if (i > 0) chain.append(h('span', { className: 'ag-rs-pline', 'aria-hidden': 'true' }));
        if ('gap' in item) chain.append(h('span', { className: 'ag-rs-pgap', 'aria-hidden': 'true' }, '⋮'));
        else chain.append(h('span', { className: `ag-rs-pcard${item.id === id ? ' is-me' : ''}` }, nameOf(item.id)));
      });
      tree.append(chain);
    }
    const cards = [...new Set(indices.map((i) => links[i]?.card).filter((text): text is string => Boolean(text)))];
    const refs = [...new Set(indices.flatMap((i) => links[i]?.refs ?? []))];
    const foot = h('span', { className: 'ag-rs-pip-foot' },
      cards.length && !compact ? h('span', { className: 'ag-rs-pip-card' }, cards.join('')) : null,
      refs.length ? h('span', { className: 'ag-rs-pip-refs' }, refsText(refs)) : null);
    const button = h('button', { className: 'ag-rs-pip', type: 'button', 'aria-label': `在家譜樹上看${names.join('、')}` },
      h('span', { className: 'ag-rs-pip-title' }, title), h('span', { className: 'ag-rs-pip-go', 'aria-hidden': 'true' }, '›'), tree, foot);
    const first = people[0];
    if (first) button.addEventListener('click', () => options.onTreePerson(first));
    return button;
  }

  function openPip(indices: number[], sig: string) {
    window.clearTimeout(pipLeave);
    pip?.el.remove();
    const button = buildPip(indices);
    const animate = !jumped && motionOn();
    if (animate) button.classList.add('is-enter');
    floats.append(button);
    pip = { el: button, sig, openedAt: performance.now(), fresh: animate };
    // 小窗占了右下角：目前這一行要留在它上面；放不下就換邊、縮成小籤
    if (autoScroll) void follow(animate);
    else placePip();
  }

  function closePip(immediately: boolean) {
    window.clearTimeout(pipTimer);
    pipTimer = 0;
    const closing = pip;
    pip = null;
    if (!closing) return;
    if (immediately || !motionOn()) { closing.el.remove(); return; }
    closing.el.classList.remove('is-enter');
    closing.el.classList.add('is-leave');
    closing.el.disabled = true;
    pipLeave = window.setTimeout(() => closing.el.remove(), 260);
  }

  function syncPip() {
    const want = reading && cur >= 0 && active && pipAllowed(active.roster) ? pickPipLinks(options.reading.links, key, read(), onTree) : [];
    if (want.length) {
      window.clearTimeout(pipTimer);
      pipTimer = 0;
      const sig = want.join(',');
      if (!pip || pip.sig !== sig) openPip(want, sig);
      return;
    }
    if (!pip || pipTimer) return;
    const wait = Math.max(0, pip.openedAt + PIP_MIN_OPEN_MS - performance.now());
    pipTimer = window.setTimeout(() => closePip(false), wait);
  }

  // ── 鏡頭（只捲動自己的容器） ──
  let userListener: (() => void) | null = null;
  let anim = 0;
  let lastTop = 0;
  /** 使用者自己捲過之後不再自動捲，直到下一次 flyTo */
  let autoScroll = true;
  let pendingScroll: { animate: boolean } | null = null;

  function setScroll(top: number, _left = 0) {
    el.scrollTop = top;
    lastTop = el.scrollTop;
  }
  const stopScroll = () => { cancelAnimationFrame(anim); anim = 0; };
  const notifyUser = () => { stopScroll(); autoScroll = false; pendingScroll = null; userListener?.(); };
  el.addEventListener('scroll', () => {
    if (Math.abs(el.scrollTop - lastTop) <= 1) return;
    lastTop = el.scrollTop;
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
    el.style.setProperty('--ag-rs-vh', `${Math.round(view.h)}px`);
    if (pendingScroll && el.clientHeight > 0) {
      const next = pendingScroll;
      pendingScroll = null;
      void follow(next.animate);
    } else placePip();
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(measure).observe(el);

  /** 讓目前這一行留在看得到的範圍的上方 25%–70% 之間；已經在範圍內就不動 */
  function ensureVisible(animate: boolean): Promise<void> {
    stopScroll();
    const node = active?.nowEl;
    if (!node) return Promise.resolve();
    if (el.clientHeight === 0) { pendingScroll = { animate }; return Promise.resolve(); }
    // 換畫面時容器正在縮放浮上來（transform），量到的位置是縮放後的；等動畫結束再定位
    if (getComputedStyle(el).transform !== 'none') {
      pendingScroll = { animate };
      window.setTimeout(measure, 160);
      return Promise.resolve();
    }
    const view = viewSize();
    const style = getComputedStyle(el);
    const padTop = parseFloat(style.paddingTop) || 0;
    const er = followRect(node);
    const cr = el.getBoundingClientRect();
    const relTop = er.top - cr.top - padTop;
    const relBottom = er.bottom - cr.top - padTop;
    let zoneTop = view.h * 0.25;
    let zoneBottom = view.h * 0.7;
    if (pip) {
      // 小窗完整的高度（縮成小籤之前）：目前這一行要留在它上面
      pip.el.classList.remove('is-tag');
      zoneBottom = Math.min(zoneBottom, view.h - (pip.el.offsetHeight || 190) - PIP_EDGE - PIP_GAP);
    }
    // 小窗占掉很多地方時（手機）：這一行寧可靠上，也不要被小窗蓋住
    zoneBottom = Math.max(zoneBottom, Math.min(er.height + 4, view.h * 0.9));
    zoneTop = Math.min(zoneTop, Math.max(0, zoneBottom - er.height));
    const inside = relBottom <= zoneBottom + 0.5 && (relTop >= zoneTop - 0.5 || el.scrollTop <= 1);
    if (inside) return Promise.resolve();
    const contentTop = er.top - cr.top + el.scrollTop - padTop;
    const want = Math.max(zoneTop, Math.min(view.h * 0.42, zoneBottom - er.height - 4));
    const top = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, contentTop - want));
    if (Math.abs(top - el.scrollTop) < 2) return Promise.resolve();
    if (!animate || !motionOn()) { setScroll(top); return Promise.resolve(); }
    const from = el.scrollTop;
    const start = performance.now();
    const duration = Math.min(640, 300 + Math.abs(top - from) * 0.25);
    return new Promise<void>((resolve) => {
      const tick = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / duration));
        setScroll(from + (top - from) * (1 - (1 - t) ** 3));
        if (t < 1) anim = requestAnimationFrame(tick);
        else { anim = 0; resolve(); }
      };
      anim = requestAnimationFrame(tick);
    });
  }

  // ── 子母畫面放在哪裡：量了再放 ──
  interface Box { top: number; bottom: number; left: number; right: number; height: number }

  /** 目前這一行要跟著捲的範圍：最新出現的那個東西，加上它底下的出處 */
  function followRect(node: HTMLElement): Box {
    const rects = [node.getBoundingClientRect()];
    const row = active?.rows[active.nowRow];
    if (row && row.tiles.length && !row.noteEl.classList.contains(OFF)) {
      for (const child of Array.from(row.noteEl.children)) rects.push(child.getBoundingClientRect());
    }
    if (row && row.tiles.length) for (const line of row.famLines) if (line.shown) rects.push(line.el.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return { top, bottom, left: Math.min(...rects.map((r) => r.left)), right: Math.max(...rects.map((r) => r.right)), height: bottom - top };
  }

  /** 目前這一行上有東西的地方（名字行是每個名字牌和出處，其他行是整行）；小窗不能蓋住它們 */
  function protectedRects(): DOMRect[] {
    const row = active?.rows[active.nowRow];
    if (!row) return [];
    if (!row.tiles.length) return [row.el.getBoundingClientRect()];
    const rects: DOMRect[] = [];
    for (const tile of row.tiles) if (tile.shown) rects.push(tile.el.getBoundingClientRect());
    if (!row.noteEl.classList.contains(OFF)) for (const child of Array.from(row.noteEl.children)) rects.push(child.getBoundingClientRect());
    if (row.label) rects.push(row.label.getBoundingClientRect());
    for (const line of row.famLines) if (line.shown) rects.push(line.el.getBoundingClientRect());
    return rects;
  }

  /** 小窗現在的位置（不受進出場動畫的位移影響） */
  function pipRect(node: HTMLElement): { left: number; top: number; right: number; bottom: number } {
    const origin = floats.getBoundingClientRect();
    const left = origin.left + node.offsetLeft;
    const top = origin.top + node.offsetTop - node.offsetHeight;
    return { left, top, right: left + node.offsetWidth, bottom: top + node.offsetHeight };
  }

  /** 先放右下角；蓋到目前那一行就換左下角；左右都蓋到就縮成一條小籤（還是點得到） */
  function placePip() {
    if (!pip || el.clientHeight === 0) return;
    const node = pip.el;
    node.classList.remove('is-left', 'is-tag');
    const rects = protectedRects();
    if (!rects.length) return;
    const hits = () => {
      const p = pipRect(node);
      return rects.some((r) => r.width > 0 && r.height > 0 && p.left < r.right + 4 && p.right > r.left - 4 && p.top < r.bottom + 4 && p.bottom > r.top - 4);
    };
    if (!hits()) return;
    node.classList.add('is-left');
    if (!hits()) return;
    node.classList.add('is-tag');
    if (!hits()) return;
    node.classList.remove('is-left');
  }

  /** 讓目前這一行留在看得到的地方，捲完再決定小窗放哪裡 */
  function follow(animate: boolean): Promise<void> {
    return ensureVisible(animate).then(placePip);
  }
  el.addEventListener('scroll', () => { if (pip) requestAnimationFrame(placePip); }, { passive: true });

  // ── 縮圖 ──
  function miniature(): SVGElement {
    const svg = svgEl('svg', { class: 'ag-rs-mini', viewBox: '0 0 1 1', preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    const view = active ?? views[0];
    svg.append(svgEl('rect', { class: 'ag-rs-mini-sheet', x: 0.04, y: 0.02, width: 0.92, height: 0.96 }));
    if (!view) return svg;
    for (const line of miniLayout(view.roster).lines) {
      svg.append(svgEl('path', { class: `ag-rs-mini-line is-${line.kind}`, d: `M${line.x1.toFixed(3)} ${line.y.toFixed(3)}H${line.x2.toFixed(3)}` }));
    }
    return svg;
  }

  function locate(): { x: number; y: number } | null {
    if (!active || cur < 0 || active.nowRow < 0) return null;
    return miniLayout(active.roster).rowPos[active.nowRow] ?? null;
  }

  return {
    id: 'roster',
    el,
    ready,
    setReading(on) {
      reading = on;
      if (!on) {
        marks = emptyMarks();
        stopScroll();
        closePip(true);
        window.clearTimeout(pipLeave);
        pendingScroll = null;
        autoScroll = true;
        key = '';
        cur = NOT_PLACED;
      }
      el.classList.toggle('is-reading', on);
    },
    setVerse(next) {
      key = next;
      chars = 0;
      jumped = false;
      applyVerse();
    },
    setCursor(next, wasJumped) {
      chars = next;
      jumped = wasJumped;
      if (!active || cur < 0) return;
      if (!wasJumped) { paint(active, motionOn()); return; }
      // 跳讀、打開：整個直接畫好，連字的淡入、人數條的伸長都不播
      active.root.classList.add('is-still');
      paint(active, false);
      clearAnimations(active);
      void active.root.offsetWidth;
      active.root.classList.remove('is-still');
    },
    reveal() { /* 名冊沒有收合的地方 */ },
    setMarks(next) {
      marks = next;
      repaint();
      syncPip();
    },
    flyTo(_target, animate) {
      autoScroll = true;
      return follow(animate);
    },
    has() {
      return rosters !== null && active !== null && cur >= 0;
    },
    onUserCamera(listener) { userListener = listener; },
    locate,
    miniature,
    saveView() { return { top: el.scrollTop }; },
    restoreView(saved) {
      const view = saved as { top?: number } | null;
      if (view && typeof view.top === 'number') setScroll(view.top);
    },
  };
}
