import { BRIDGE_TERMS } from "../data/compatData";
import {
  EXCLUDED_STRONG_IDS,
  MAX_CARDS,
  MAX_CHIPS,
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  MIN_RENDERING_COUNT,
} from "./originalStudyConfig";
import { foldOne, type PreparedVerse } from "./verseSearch";
import { cleanSearchQuery } from "./textMatcher";

export interface OriginalEntryLink {
  readonly slug: string;
  readonly title: string;
  readonly isHeadword?: boolean;
}

export interface OriginalSense {
  readonly sid: string;
  /** 意思標籤，例如「赦免、饒恕」。 */
  readonly label: string;
  readonly total: number;
  /** 和合本沒有可單獨對應中文字的處數。 */
  readonly none: number;
  /** 依處數由多到少。 */
  readonly renderings: ReadonlyArray<readonly [rendering: string, count: number]>;
}

export interface OriginalIndex {
  readonly version: 2;
  readonly attribution?: string;
  readonly shards: number;
  readonly lexicon: Readonly<Record<string, readonly [lemma: string, translit: string]>>;
  readonly senses: Readonly<Record<string, OriginalSense>>;
  readonly entries?: Readonly<Record<string, OriginalEntryLink>>;
  readonly entryAliases?: Readonly<Record<string, readonly string[]>>;
}

/** 分片內容：senseKey -> [章節 slug, 節, 譯法]。 */
export type OriginalShard = Readonly<
  Record<string, ReadonlyArray<readonly [slug: string, verse: number, rendering: string]>>
>;

// ---------------------------------------------------------------------------
// 分片雜湊（建置端 quartz/util/verseIndex.ts 必須使用相同演算法）
// ---------------------------------------------------------------------------

/**
 * FNV-1a 32 位元，輸入是 senseKey 字串的 UTF-16 code unit（charCodeAt）。
 * 起始值 2166136261、質數 16777619；每一步 `hash ^= unit; hash = Math.imul(hash, prime) >>> 0`。
 */
export function stableHash(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function shardIndexFor(senseKey: string, shards: number): number {
  return shards > 0 ? stableHash(senseKey) % shards : 0;
}

export const shardPath = (n: number) => `static/verseOriginal/s-${n}.json`;

// ---------------------------------------------------------------------------
// 查詢入口：譯法 -> 意思
// ---------------------------------------------------------------------------

export interface OriginalLookup {
  /** 折疊後的譯法 -> 該譯法處數 ≥ 門檻的 senseKey。 */
  readonly byRendering: Map<string, Set<string>>;
  /** sid -> 該字的所有 senseKey，處數多的在前。 */
  readonly bySid: Map<string, string[]>;
}

const lookupCache = new WeakMap<OriginalIndex, OriginalLookup>();

export function buildOriginalLookup(index: OriginalIndex): OriginalLookup {
  const cached = lookupCache.get(index);
  if (cached) return cached;
  const byRendering = new Map<string, Set<string>>();
  const bySid = new Map<string, string[]>();
  for (const [key, sense] of Object.entries(index.senses)) {
    const list = bySid.get(sense.sid) ?? [];
    list.push(key);
    bySid.set(sense.sid, list);
    // 折疊後相同的不同寫法（異體字）合計處數
    const folded = new Map<string, number>();
    for (const [rendering, count] of sense.renderings) {
      const form = foldOne(rendering);
      if (form) folded.set(form, (folded.get(form) ?? 0) + count);
    }
    for (const [form, count] of folded) {
      if (count < MIN_RENDERING_COUNT) continue;
      const keys = byRendering.get(form) ?? new Set<string>();
      keys.add(key);
      byRendering.set(form, keys);
    }
  }
  for (const keys of bySid.values()) {
    keys.sort((a, b) => index.senses[b]!.total - index.senses[a]!.total || a.localeCompare(b));
  }
  const lookup = { byRendering, bySid };
  lookupCache.set(index, lookup);
  return lookup;
}

export interface OriginalCardPlan {
  readonly senseKey: string;
  readonly isForced: boolean;
}

/** 這個意思裡，和合本拿查詢詞（折疊後完全相同的譯法，不含「包含查詢詞」的）來翻的處數。 */
export function queryRenderingCount(sense: OriginalSense, foldedQuery: string): number {
  let count = 0;
  for (const [rendering, n] of sense.renderings) if (foldOne(rendering) === foldedQuery) count += n;
  return count;
}

/** 找出要顯示的卡片（一個意思一張）：依「查詢詞在這個意思裡的處數」由多到少，同數時依意思總處數。 */
export function findOriginalCardPlans(
  index: OriginalIndex,
  rawQuery: string,
  maxCards = MAX_CARDS,
): OriginalCardPlan[] {
  const query = cleanSearchQuery(rawQuery);
  const folded = query ? foldOne(query) : "";
  if (!folded) return [];
  const lookup = buildOriginalLookup(index);

  const forcedSids = new Set<string>();
  for (const bridge of BRIDGE_TERMS) {
    if (foldOne(bridge.query) === folded) for (const sid of bridge.strongIds) forcedSids.add(sid);
  }
  for (const value of index.entryAliases?.[query.toLowerCase()] ?? []) {
    forcedSids.add(value);
    for (const [sid, link] of Object.entries(index.entries ?? {})) {
      if (link.slug === value) forcedSids.add(sid);
    }
  }

  const matching = lookup.byRendering.get(folded) ?? new Set<string>();
  const plans = new Map<string, OriginalCardPlan>();
  for (const sid of forcedSids) {
    const senses = lookup.bySid.get(sid) ?? [];
    // 該字有一個意思的譯法就是查詢詞的話用那個，否則用處數最多的意思
    const key = senses.find((candidate) => matching.has(candidate)) ?? senses[0];
    if (key) plans.set(key, { senseKey: key, isForced: true });
  }
  const length = Array.from(query).length;
  if (length >= MIN_QUERY_LENGTH && length <= MAX_QUERY_LENGTH) {
    for (const key of matching) {
      if (EXCLUDED_STRONG_IDS.has(index.senses[key]!.sid) || plans.has(key)) continue;
      plans.set(key, { senseKey: key, isForced: false });
    }
  }
  const hitCount = (key: string) => queryRenderingCount(index.senses[key]!, folded);
  return [...plans.values()]
    .sort(
      (a, b) =>
        hitCount(b.senseKey) - hitCount(a.senseKey) ||
        index.senses[b.senseKey]!.total - index.senses[a.senseKey]!.total ||
        a.senseKey.localeCompare(b.senseKey),
    )
    .slice(0, maxCards);
}

// ---------------------------------------------------------------------------
// 卡片內容
// ---------------------------------------------------------------------------

export interface RenderingChip {
  /** 顯示文字（合併的是「其他」）。 */
  readonly label: string;
  readonly count: number;
  /** 這個標籤涵蓋的譯法。 */
  readonly renderings: readonly string[];
  /** 譯法含有查詢詞：經文已在 ① 直接命中列過，樣式用虛線。 */
  readonly containsQuery: boolean;
  readonly merged: boolean;
}

export interface BarSegment {
  readonly label: string;
  readonly count: number;
  readonly kind: "chip" | "none";
  readonly chipIndex?: number;
}

/** 譯法標籤：依處數由多到少，超過上限的併成「其他」。查詢詞含在譯法裡的標虛線。 */
export function buildRenderingChips(
  sense: OriginalSense,
  rawQuery: string,
  maxChips = MAX_CHIPS,
): RenderingChip[] {
  const query = foldOne(cleanSearchQuery(rawQuery));
  const rows = sense.renderings
    .filter(([rendering, count]) => rendering && count > 0)
    .map(([rendering, count], order) => ({ rendering, count, order }))
    .sort((a, b) => b.count - a.count || a.order - b.order);
  const toChip = (rendering: string, count: number): RenderingChip => ({
    label: rendering,
    count,
    renderings: [rendering],
    containsQuery: !!query && foldOne(rendering).includes(query),
    merged: false,
  });
  if (rows.length <= maxChips) return rows.map((row) => toChip(row.rendering, row.count));
  const head = rows.slice(0, maxChips - 1).map((row) => toChip(row.rendering, row.count));
  const rest = rows.slice(maxChips - 1);
  return [
    ...head,
    {
      label: "其他",
      count: rest.reduce((sum, row) => sum + row.count, 0),
      renderings: rest.map((row) => row.rendering),
      containsQuery: false,
      merged: true,
    },
  ];
}

/** 「另一種譯法」預設：處數最多、而且不含查詢詞的標籤；全都含查詢詞時取第一個。 */
/** 這個意思的所有譯法都含查詢詞：沒有「另一種譯法」可比。 */
export function allRenderingsContainQuery(chips: readonly RenderingChip[]): boolean {
  return chips.length > 0 && chips.every((chip) => chip.containsQuery);
}

export function defaultChipIndex(chips: readonly RenderingChip[]): number {
  const index = chips.findIndex((chip) => !chip.containsQuery);
  return index >= 0 ? index : 0;
}

export function buildBarSegments(
  sense: OriginalSense,
  chips: readonly RenderingChip[],
): BarSegment[] {
  const segments: BarSegment[] = chips.map((chip, chipIndex) => ({
    label: chip.label,
    count: chip.count,
    kind: "chip" as const,
    chipIndex,
  }));
  if (sense.none > 0) segments.push({ label: "未直接譯出", count: sense.none, kind: "none" });
  return segments;
}

/** 比例條的文字說明（螢幕閱讀器用，不靠顏色）。 */
export function describeBar(segments: readonly BarSegment[]): string {
  return segments.map((segment) => `${segment.label} ${segment.count} 處`).join("、");
}

export interface SenseVerse {
  readonly id: string;
  readonly slug: string;
  readonly verse: number;
  readonly rendering: string;
}

/** 分片裡這個意思的經文，同一節只留第一筆；經文索引裡沒有的節略過。 */
export function senseVerses(
  entries: OriginalShard[string] | undefined,
  verseMap: ReadonlyMap<string, PreparedVerse>,
): SenseVerse[] {
  const seen = new Set<string>();
  const result: SenseVerse[] = [];
  for (const [slug, verse, rendering] of entries ?? []) {
    const id = `${slug}#v${verse}`;
    if (seen.has(id) || !verseMap.has(id)) continue;
    seen.add(id);
    result.push({ id, slug, verse, rendering });
  }
  return result;
}

export function versesForChip(verses: readonly SenseVerse[], chip: RenderingChip): SenseVerse[] {
  const wanted = new Set(chip.renderings);
  return verses.filter((verse) => wanted.has(verse.rendering));
}

/** 「你找到的一處」：這個意思裡、已經在直接命中的經節（有的話優先挑譯法含查詢詞的）。 */
export function pickFoundVerse(
  verses: readonly SenseVerse[],
  directHitIds: ReadonlySet<string>,
  rawQuery: string,
): SenseVerse | null {
  const query = foldOne(cleanSearchQuery(rawQuery));
  const direct = verses.filter((verse) => directHitIds.has(verse.id));
  return (
    direct.find((verse) => query && foldOne(verse.rendering).includes(query)) ?? direct[0] ?? null
  );
}

/** 「另一種譯法」：輪替挑選，絕不和「你找到的一處」同一節；沒有別的節就回傳 null。 */
export function pickAlternateVerse(
  candidates: readonly SenseVerse[],
  found: SenseVerse | null,
  cycle: number,
): SenseVerse | null {
  const list = candidates.filter((verse) => verse.id !== found?.id);
  if (list.length === 0) return null;
  return list[((cycle % list.length) + list.length) % list.length]!;
}

export interface OtherSense {
  readonly senseKey: string;
  readonly label: string;
  readonly total: number;
}

/** 同一原文字的其他意思，處數多的在前。 */
export function otherSensesOf(index: OriginalIndex, senseKey: string): OtherSense[] {
  const sense = index.senses[senseKey];
  if (!sense) return [];
  return (buildOriginalLookup(index).bySid.get(sense.sid) ?? [])
    .filter((key) => key !== senseKey)
    .map((key) => ({
      senseKey: key,
      label: index.senses[key]!.label,
      total: index.senses[key]!.total,
    }));
}

/** 「創世記～約書亞記」：從經文索引（只含已上線章節）的書卷順序導出。 */
export function bookRangeLabel(verses: readonly PreparedVerse[]): string {
  if (verses.length === 0) return "";
  const first = verses[0]!.book;
  const last = verses[verses.length - 1]!.book;
  return first === last ? first : `${first}～${last}`;
}

/** index.json 裡一個意思的精簡寫法：[總處數, 未直接譯出處數, [[譯法, 處數], ...]]。 */
export type RawOriginalSense = readonly [
  total: number,
  none: number,
  renderings: ReadonlyArray<readonly [string, number]>,
];

/**
 * 意思標籤：取前兩個譯法，用「、」連起來。
 * 譯法若包含清單裡另一個較短（至少兩字）的譯法，例如「蒙赦免」含「赦免」，就略過，避免標籤重複；
 * 單字譯法（祝、時）太容易被包含，不拿來比。
 */
export function senseLabel(renderings: ReadonlyArray<readonly [string, number]>): string {
  const names = renderings.map(([rendering]) => rendering).filter(Boolean);
  return names
    .filter(
      (name) =>
        !names.some(
          (other) => other.length >= 2 && other.length < name.length && name.includes(other),
        ),
    )
    .slice(0, 2)
    .join("、");
}

/** 讀 index.json 的唯一入口：格式不對回傳 null；sid 取 senseKey 小數點前的部分，標籤由前端導出。 */
export function parseOriginalIndex(payload: unknown): OriginalIndex | null {
  const data = payload as {
    version?: number;
    shards?: unknown;
    lexicon?: OriginalIndex["lexicon"];
    senses?: Record<string, RawOriginalSense>;
    entries?: OriginalIndex["entries"];
    entryAliases?: OriginalIndex["entryAliases"];
    attribution?: string;
  } | null;
  if (
    !data ||
    data.version !== 2 ||
    typeof data.shards !== "number" ||
    !data.lexicon ||
    !data.senses
  ) {
    return null;
  }
  const senses: Record<string, OriginalSense> = {};
  for (const [key, raw] of Object.entries(data.senses)) {
    if (!Array.isArray(raw) || !Array.isArray(raw[2])) continue;
    const renderings = [...raw[2]].sort((x, y) => y[1] - x[1]);
    senses[key] = {
      sid: key.split(".")[0]!,
      label: senseLabel(renderings),
      total: raw[0],
      none: raw[1],
      renderings,
    };
  }
  return {
    version: 2,
    attribution: data.attribution,
    shards: data.shards,
    lexicon: data.lexicon,
    senses,
    entries: data.entries,
    entryAliases: data.entryAliases,
  };
}
