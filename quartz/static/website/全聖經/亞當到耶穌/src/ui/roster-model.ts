import type { ReadingLink, Roster, RosterFamily, RosterName, RosterRow, RosterSection } from '../data/types';

/**
 * 歸回的名冊：不碰 DOM 的純函式（讀到哪寫到哪、冊上有名的判定、子母畫面的卡片截斷、縮圖排版）。
 * roster.ts 負責畫面，這裡的每個規則都有 roster.test.ts 保護。
 */

// ── 文字 ─────────────────────────────────────────────

/** 2172 → 「2,172」 */
export function formatCount(n: number): string {
  return n.toLocaleString('en-US');
}

/** 「代上9:12」→「代上 9:12」（書卷和章之間加一個空格）；已經有空格的照舊 */
export function refLabel(ref: string): string {
  const text = ref.trim();
  const match = /^(\D+?)\s*(\d.*)$/.exec(text);
  return match ? `${match[1]} ${match[2]}` : text;
}

/** 數字加量詞：「2,172 名」「150 人」；經文沒有量詞（unit 空字串或沒給）就只有數字「200」 */
export function countText(count: number, unit?: string): string {
  return unit ? `${formatCount(count)} ${unit}` : formatCount(count);
}

/** 小計、總數那句「共 N 名」後面接的量詞：沒給 unit 沿用「名」，空字串＝經文沒有量詞 */
export function totalUnitText(unit?: string): string {
  return unit === undefined ? ' 名' : unit ? ` ${unit}` : '';
}

/** 好幾個出處用頓號連起來 */
export function refsText(refs: string[]): string {
  return refs.map(refLabel).join('、');
}

// ── 讀到哪寫到哪 ─────────────────────────────────────

/** 這一節在名冊的經節清單裡排第幾（不在就 -1） */
export function verseIndex(roster: Pick<Roster, 'verses'>, key: string): number {
  return roster.verses.indexOf(key);
}

/**
 * 經文裡 at 這個位置讀到了嗎。cur＝目前這一節在名冊經節清單的位置，idx＝這一行所在節的位置，
 * chars＝目前這一節讀到第幾個字。前面的節整節都算讀過；這一節要讀到那個字才算；後面的節還沒讀。
 */
export function reached(cur: number, idx: number, chars: number, at: number): boolean {
  if (cur < 0 || idx < 0) return false;
  return idx < cur || (idx === cur && chars >= at);
}

export interface RowState {
  /** 這一行出現了 */
  visible: boolean;
  /** 人數條伸滿、數字出現（沒有 n 的行跟著行出現） */
  filled: boolean;
  /** 已經出現的名字有幾個 */
  namesShown: number;
  /** 這一行的引句出現了 */
  quoteShown: boolean;
}

export function nameShown(name: RosterName, cur: number, idx: number, chars: number): boolean {
  return reached(cur, idx, chars, name.s);
}

/**
 * numLen＝經文裡那串中文數字的字數（numberLength 算的）。數字唸完（chars ≥ n + numLen）人數條才算伸滿、阿拉伯數字才出現；
 * 不給就在唸到第一個字時算伸滿。
 */
export function rowState(row: RosterRow, cur: number, idx: number, chars: number, numLen = 0): RowState {
  const visible = reached(cur, idx, chars, row.s);
  return {
    visible,
    filled: visible && reached(cur, idx, chars, (row.n ?? row.s) + numLen),
    namesShown: (row.names ?? []).filter((name) => nameShown(name, cur, idx, chars)).length,
    quoteShown: row.quote ? reached(cur, idx, chars, row.quote.s) : false,
  };
}

/** 經文裡的中文數字用到的字 */
export const CN_DIGITS = '零〇一二三四五六七八九十百千萬兩';

/** 從 text 的第 n 個字（字元位置）往後數，連續的中文數字有幾個字（「一千二百五十四名」從「一」起算是 7） */
export function numberLength(text: string, n: number): number {
  const chars = Array.from(text);
  let length = 0;
  while (n + length < chars.length && CN_DIGITS.includes(chars[n + length]!)) length += 1;
  return length;
}

/**
 * 一段文字（從經文第 start 個字起、共 len 個字）讀到現在出現了幾個字：
 * 前面的節整段都出現；後面的節一個字都還沒有；這一節讀到第 i 個字（chars ≥ start + i）那個字就出現。
 */
export function charsShown(start: number, len: number, cur: number, idx: number, chars: number): number {
  if (cur < 0 || idx < 0 || len <= 0) return 0;
  if (idx < cur) return len;
  if (idx > cur) return 0;
  return Math.max(0, Math.min(len, Math.floor(chars - start + 1)));
}

/** 人數條跟著唸數字的那幾個字伸長：0（還沒唸到數字）→ 1（唸完），前面的節是 1、後面的節是 0 */
export function barProgress(n: number, len: number, cur: number, idx: number, chars: number): number {
  if (cur < 0 || idx < 0 || idx > cur) return 0;
  if (idx < cur) return 1;
  if (len <= 0) return chars >= n ? 1 : 0;
  return Math.max(0, Math.min(1, (chars - n) / len));
}

/** 人數條現在的寬度比例：（人數 ÷ 最大的一行）× 唸到哪 */
export function barWidth(count: number, max: number, progress: number): number {
  return barFraction(count, max) * Math.max(0, Math.min(1, progress));
}

/** 這一行要不要畫人數條：有人數、而且行或分區沒有說不畫 */
export function hasBar(section: Pick<RosterSection, 'bars'>, row: RosterRow): boolean {
  if (row.count === undefined) return false;
  if (row.total || row.big || row.names?.length) return false;
  return (row.bar ?? section.bars ?? true) !== false;
}

/**
 * 名字行（家族標籤＋一兩個領頭的名字）也有人數時，標籤旁邊畫人數條（拉 8:3–14「屬巴錄的後裔……男丁一百五十人」）；
 * 沒有標籤的名字行（拉 2:42 的守門的）照舊只在底下寫小計。
 */
export function namesBar(section: Pick<RosterSection, 'bars'>, row: RosterRow): boolean {
  if (row.count === undefined || !row.names?.length || row.total || row.big || !row.label) return false;
  return (row.bar ?? section.bars ?? true) !== false;
}

export type RowKind = 'big' | 'total' | 'names' | 'bar' | 'plain' | 'quote';

/** 這一行用哪一種版面 */
export function rowKind(section: Pick<RosterSection, 'bars'>, row: RosterRow): RowKind {
  if (row.big) return 'big';
  if (row.total) return 'total';
  if (row.names?.length) return 'names';
  if (hasBar(section, row)) return 'bar';
  return row.label !== undefined || row.count !== undefined ? 'plain' : 'quote';
}

/** 分區有標題才畫標題（拉 10:44 那句引句所在的分區沒有標題） */
export function sectionHasTitle(section: Pick<RosterSection, 'title'>): boolean {
  return section.title.trim() !== '';
}

/** 口氣中性的名冊（拉 10）：不加金色、不蓋「冊上有名」、不開子母畫面 */
export function isPlain(roster: Pick<Roster, 'tone'>): boolean {
  return roster.tone === 'plain';
}

const NO_MARK: LinkMark = { kind: null, refs: [] };

/** 這份名冊裡一行（或一個名字）的標記：中性的名冊永遠沒有標記 */
export function rosterMark(roster: Pick<Roster, 'tone'>, links: ReadingLink[], indices: number[], read: ReadonlySet<number>): LinkMark {
  return isPlain(roster) ? NO_MARK : linkMark(links, indices, read);
}

/** 這份名冊要不要開子母畫面 */
export function pipAllowed(roster: Pick<Roster, 'tone'>): boolean {
  return !isPlain(roster);
}

/** 整份名冊最外層的 class */
export function rosterClassName(roster: Pick<Roster, 'tone' | 'seal'>): string {
  return `ag-rs${isPlain(roster) ? ' is-tone-plain' : ''}${roster.seal ? ' is-seal' : ''}`;
}

/** 名字牌的 class：簽名蓋印的名冊（尼 10）每個名字牌都像蓋上去的一枚印 */
export function tileClassName(roster: Pick<Roster, 'seal'>): string {
  return `ag-rs-tile${roster.seal ? ' is-seal' : ''}`;
}

/** 蓋印的名字牌微微歪一點，每個歪的角度不同（固定，不隨機） */
const TILTS = [-1.6, 1.1, -0.7, 1.7, -1.2, 0.8, -0.4, 1.4];
export function sealTilt(index: number): number {
  return TILTS[((index % TILTS.length) + TILTS.length) % TILTS.length]!;
}

/** 人數條的長度：人數 ÷ 這份名冊最大的一行 */
export function barFraction(count: number, max: number): number {
  if (!(max > 0) || !(count > 0)) return 0;
  return Math.min(1, count / max);
}

export interface FlatRow {
  section: RosterSection;
  /** 第幾個分區 */
  si: number;
  row: RosterRow;
  /** 這一行所在節在名冊經節清單的位置 */
  idx: number;
}

/** 全部的行，照經文順序攤平 */
export function flattenRows(roster: Roster): FlatRow[] {
  const flat: FlatRow[] = [];
  roster.sections.forEach((section, si) => {
    for (const row of section.rows) flat.push({ section, si, row, idx: verseIndex(roster, row.at) });
  });
  return flat;
}

/** 目前讀到的那一行：已經出現的最後一行（沒有就 -1） */
export function currentRowIndex(flat: FlatRow[], cur: number, chars: number): number {
  let found = -1;
  flat.forEach((item, i) => {
    if (rowState(item.row, cur, item.idx, chars).visible) found = i;
  });
  return found;
}

// ── 冊上有名、家譜裡有這座城 ─────────────────────────

export interface LinkMark {
  kind: 'named' | 'town' | null;
  refs: string[];
}

const unique = (items: string[]) => [...new Set(items)];

/**
 * 一行（或一個名字）的連結裡，已經讀到的：
 * returned／link → 冊上有名（金色＋朱印）；town → 家譜裡有這座城（較淡的標記）；lost 不加金色。
 * 兩種都讀到時冊上有名優先，出處只列優先那一種的。
 */
export function linkMark(links: ReadingLink[], indices: number[], read: ReadonlySet<number>): LinkMark {
  const named: string[] = [];
  const town: string[] = [];
  let hasNamed = false;
  let hasTown = false;
  for (const i of indices) {
    const link = links[i];
    if (!link || !read.has(i)) continue;
    if (link.effect === 'returned' || link.effect === 'link') { hasNamed = true; named.push(...link.refs); }
    else if (link.effect === 'town') { hasTown = true; town.push(...link.refs); }
  }
  if (hasNamed) return { kind: 'named', refs: unique(named) };
  if (hasTown) return { kind: 'town', refs: unique(town) };
  return { kind: null, refs: [] };
}

/** 好幾個標記的出處合在一起（名字行：每個名字各自的連結，出處寫在方格下面） */
export function mergeMarks(marks: LinkMark[]): LinkMark {
  const named = marks.filter((mark) => mark.kind === 'named');
  const town = marks.filter((mark) => mark.kind === 'town');
  if (named.length) return { kind: 'named', refs: unique(named.flatMap((mark) => mark.refs)) };
  if (town.length) return { kind: 'town', refs: unique(town.flatMap((mark) => mark.refs)) };
  return { kind: null, refs: [] };
}

/** 名字行底下的出處：同樣出處的名字併成一行（沙龍、達們、亞谷　代上 9:17） */
export function refGroups(items: Array<{ label: string; refs: string[] }>): Array<{ labels: string[]; refs: string }> {
  const groups = new Map<string, string[]>();
  for (const item of items) {
    if (!item.refs.length) continue;
    const refs = refsText(item.refs);
    groups.set(refs, [...(groups.get(refs) ?? []), item.label]);
  }
  return [...groups].map(([refs, labels]) => ({ labels, refs }));
}


// ── 家族軌跡 ─────────────────────────────────────────

export interface FamilyTag {
  /** 要跳到的那一節，例如「拉10:25」 */
  at: string;
  /** 小籤上的經節：「拉 10:25」 */
  ref: string;
  /** 那一處的人數加量詞：「2,172 名」「150 人」「200」；沒有人數是空字串 */
  count: string;
  /** 小籤整句：「拉 10:25」「尼 7:8 2,172 名」 */
  text: string;
  /** 家族名稱：當 title／讀屏的說明 */
  family: string;
}

/**
 * 一行（或一個名字）的家族軌跡小籤：fam 是 RosterData.families 的索引；
 * 這份名冊自己的那幾處（place.seg === segment）不列；同一節只列一次。
 */
export function familyTags(families: RosterFamily[] | undefined, fam: number[] | undefined, segment: string): FamilyTag[] {
  const tags: FamilyTag[] = [];
  for (const index of fam ?? []) {
    const family = families?.[index];
    if (!family) continue;
    for (const place of family.places) {
      if (place.seg === segment || tags.some((tag) => tag.at === place.at)) continue;
      const ref = refLabel(place.at);
      const count = place.count === undefined ? '' : countText(place.count, place.unit);
      tags.push({ at: place.at, ref, count, text: count ? `${ref} ${count}` : ref, family: family.name });
    }
  }
  return tags;
}

/**
 * 一排小籤開頭那句：「也在」。家族名和這一行的標籤、這個名字相同（或被它們包含）就不重複寫；
 * 不同的（小籤掛在「某某的兒子」那個名字上）把家族名寫出來，讀者才知道別處出現的是哪一家。
 * 名字層的小籤（name）開頭先寫那個名字；家族名已經包著這個名字的，只寫家族名。
 */
export function familyLead(tags: FamilyTag[], contexts: Array<string | undefined>, name?: string): string {
  const own = contexts.filter((text): text is string => Boolean(text));
  const unrelated = [...new Set(tags.map((tag) => tag.family))].filter((family) => !own.some((text) => text.includes(family)));
  // 家族名本來就包著這個名字（利未人耶書亞）：只寫家族名，不重複寫名字
  const names = unrelated.join('、');
  const who = !unrelated.length ? name ?? '' : !name || unrelated.every((family) => family.includes(name)) ? names : `${name}（${names}）`;
  return who ? `${who}　也在` : '也在';
}

// ── 子母畫面 ─────────────────────────────────────────

/** 目前這一節、已經讀到、而且連到家譜樹上的人的連結（lost 不算；沒有 tree 的不算） */
export function pickPipLinks(links: ReadingLink[], key: string, read: ReadonlySet<number>, onTree: (id: string) => boolean): number[] {
  const picked: number[] = [];
  links.forEach((link, i) => {
    if (link.at !== key || !read.has(i) || link.effect === 'lost') return;
    if (link.to.some((to) => to.tree !== undefined && onTree(to.tree))) picked.push(i);
  });
  return picked;
}

/** 小窗要畫的人：不重複，最多三位 */
export function pipPeople(links: ReadingLink[], indices: number[], onTree: (id: string) => boolean, max = 3): string[] {
  const people: string[] = [];
  for (const i of indices) {
    for (const to of links[i]?.to ?? []) {
      if (to.tree !== undefined && onTree(to.tree) && !people.includes(to.tree)) people.push(to.tree);
    }
  }
  return people.slice(0, max);
}

/**
 * 小窗上方那一行的名字：連結有 pip（例如「伯利恆之祖薩瑪」）就用 pip，沒有就用連到的人的名字。
 * 好幾個連結各自取，不重複，用頓號接起來。
 */
export function pipNames(links: ReadingLink[], indices: number[], onTree: (id: string) => boolean, nameOf: (id: string) => string): string[] {
  const names: string[] = [];
  for (const i of indices) {
    const link = links[i];
    if (!link) continue;
    const own = link.pip ? [link.pip] : link.to.filter((to) => to.tree !== undefined && onTree(to.tree)).map((to) => nameOf(to.tree!));
    for (const name of own) if (!names.includes(name)) names.push(name);
  }
  return names;
}

export const pipTitle = (names: string[]): string => `家譜樹上的${names.join('、')}`;

export type PipItem = { id: string } | { gap: true };

/** 小窗最多畫幾張卡（含那個人自己；不含「⋮」） */
export const PIP_MAX_CARDS = 5;
/** 手機上的小窗：最上面那位、「⋮」、那個人 */
export const PIP_COMPACT_CARDS = 3;
/** 祖先鏈的盡頭（pathToFirstAncestor 一路走到這裡）；沒遇到讀者認得的人時停在他前面一位 */
export const PIP_ROOT_ID = '亞當';
/** 讀者認得的人：大衛、亞倫、以色列，以及以色列（雅各）的兒子 */
export const PIP_LANDMARKS = ['大衛', '亞倫', '以色列'];

/** parentIds＝這個人的父母的 id */
export function isLandmark(id: string, parentIds: string[]): boolean {
  return PIP_LANDMARKS.includes(id) || parentIds.includes('以色列');
}

/**
 * 家譜樹的一小角：ids 是 pathToFirstAncestor 給的，從那個人往上到亞當。
 * 沿著往上走，停在第一位讀者認得的人（isAnchor：大衛、亞倫、雅各的兒子）；
 * 那個人自己就是認得的人時，再多帶他的父親一層；一路都沒遇到，停在亞當前面的最後一位。
 * 超過 maxCards 張：最上面一位＋「⋮」＋離那個人最近的（maxCards－2）位。回傳由上往下排，最後一個是那個人。
 */
export function pipChain(ids: string[], isAnchor: (id: string) => boolean, maxCards = PIP_MAX_CARDS): PipItem[] {
  if (!ids.length) return [];
  let end = -1;
  if (isAnchor(ids[0]!)) end = Math.min(1, ids.length - 1);
  else {
    for (let i = 1; i < ids.length; i += 1) {
      if (isAnchor(ids[i]!)) { end = i; break; }
    }
  }
  if (end < 0) {
    end = ids.length - 1;
    if (end > 0 && ids[end] === PIP_ROOT_ID) end -= 1;
  }
  const kept = ids.slice(0, end + 1);
  if (kept.length <= maxCards) return kept.reverse().map((id) => ({ id }));
  const top = kept[kept.length - 1]!;
  const near = kept.slice(0, Math.max(1, maxCards - 2)).reverse();
  return [{ id: top }, { gap: true }, ...near.map((id) => ({ id }))];
}

// ── 縮圖 ─────────────────────────────────────────────

export interface MiniLine {
  kind: 'head' | 'label' | 'bar' | 'num' | 'name' | 'total' | 'big' | 'quote';
  x1: number;
  x2: number;
  y: number;
}

export interface MiniLayout {
  lines: MiniLine[];
  /** 每一行（照 flattenRows 的順序）在縮圖上的位置 */
  rowPos: Array<{ x: number; y: number }>;
}

/** 名冊的縮影：每個分區一條短標題線，每一行幾條短橫線；座標在 0–1 之間 */
export function miniLayout(roster: Roster): MiniLayout {
  type Draft = { u: number; lines: Array<Omit<MiniLine, 'y'>>; x: number };
  const drafts: Draft[] = [];
  const heads: Array<{ u: number }> = [];
  let u = 0;
  const flat = flattenRows(roster);
  let lastSection = -1;
  const rowDraft = new Map<number, Draft>();
  flat.forEach((item, i) => {
    const { row, section, si } = item;
    if (si !== lastSection) {
      if (lastSection >= 0) u += 0.9;
      heads.push({ u: u + 0.5 });
      u += 1.4;
      lastSection = si;
    }
    const lines: Draft['lines'] = [];
    let height = 1;
    let x = 0.5;
    if (row.names?.length) {
      const count = Math.min(8, row.names.length);
      lines.push({ kind: 'name', x1: 0.08, x2: 0.08 + 0.1 * Math.min(count, 4) });
      lines.push({ kind: 'name', x1: 0.08, x2: 0.08 + 0.1 * Math.max(1, count - 4) });
      height = 1.7;
      x = 0.25;
    } else if (row.big) {
      lines.push({ kind: 'big', x1: 0.34, x2: 0.66 });
      height = 1.6;
    } else if (row.total) {
      lines.push({ kind: 'total', x1: 0.5, x2: 0.92 });
    } else if (row.label === undefined && row.count === undefined) {
      lines.push({ kind: 'quote', x1: 0.12, x2: 0.8 });
    } else {
      lines.push({ kind: 'label', x1: 0.08, x2: 0.08 + Math.min(0.2, 0.034 * Array.from(row.label ?? '').length) });
      if (hasBar(section, row)) {
        const frac = barFraction(row.count ?? 0, roster.max);
        lines.push({ kind: 'bar', x1: 0.34, x2: 0.34 + Math.max(0.02, 0.46 * frac) });
        x = 0.34 + Math.max(0.02, 0.46 * frac) / 2;
      } else {
        x = 0.3;
      }
      if (row.count !== undefined) lines.push({ kind: 'num', x1: 0.84, x2: 0.93 });
    }
    const draft: Draft = { u: u + height / 2, lines, x };
    drafts.push(draft);
    rowDraft.set(i, draft);
    u += height;
  });
  const pad = 0.05;
  const scale = (value: number) => pad + (u > 0 ? value / u : 0) * (1 - pad * 2);
  const lines: MiniLine[] = [];
  heads.forEach((head) => lines.push({ kind: 'head', x1: 0.08, x2: 0.4, y: scale(head.u) }));
  for (const draft of drafts) {
    draft.lines.forEach((line, i) => {
      const offset = draft.lines.length > 1 && line.kind === 'name' ? (i === 0 ? -0.35 : 0.35) : 0;
      lines.push({ ...line, y: scale(draft.u + offset) });
    });
  }
  const rowPos = flat.map((_, i) => {
    const draft = rowDraft.get(i)!;
    return { x: draft.x, y: scale(draft.u) };
  });
  return { lines, rowPos };
}
