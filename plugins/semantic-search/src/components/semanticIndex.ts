/**
 * 瀏覽器端語意搜尋的純函式：解析 manifest、二元向量的漢明距離、Range 區間合併、int8 重新計分、結果合併。
 * 檔案格式見 dev-notes/semantic-search/README.md；這裡不碰網路與 DOM，方便測試。
 */
import { getKnowledgeSearchCategory } from "./searchLogic";

export interface SemanticManifest {
  version: 1;
  model: string;
  dim: number;
  count: number;
  bits: string;
  rows: string;
  ids: string;
  /** 模型與執行環境檔案大小總和，用在「第一次需下載約 X MB」。 */
  assetBytes: number;
  modelPath: string;
  vendorPath: string;
  /** 選填：vendor 目錄裡 transformers 的 ESM 檔名。 */
  vendorEntry?: string;
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

/** 驗證 manifest；格式不對一律回傳 null（當作功能不可用）。 */
export function parseManifest(raw: unknown): SemanticManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (m.version !== 1) return null;
  if (!isNonEmptyString(m.model)) return null;
  if (!Number.isInteger(m.dim) || (m.dim as number) <= 0 || (m.dim as number) % 8 !== 0)
    return null;
  if (!Number.isInteger(m.count) || (m.count as number) < 0) return null;
  if (!isNonEmptyString(m.bits) || !isNonEmptyString(m.rows) || !isNonEmptyString(m.ids)) {
    return null;
  }
  if (typeof m.assetBytes !== "number" || !Number.isFinite(m.assetBytes) || m.assetBytes < 0) {
    return null;
  }
  if (!isNonEmptyString(m.modelPath) || !isNonEmptyString(m.vendorPath)) return null;
  if (m.vendorEntry !== undefined && !isNonEmptyString(m.vendorEntry)) return null;
  return {
    version: 1,
    model: m.model,
    dim: m.dim as number,
    count: m.count as number,
    bits: m.bits,
    rows: m.rows,
    ids: m.ids,
    assetBytes: m.assetBytes,
    modelPath: m.modelPath,
    vendorPath: m.vendorPath,
    ...(m.vendorEntry ? { vendorEntry: m.vendorEntry } : {}),
  };
}

/** 二元列每列位元組數（dim / 8）。 */
export const bitRowBytes = (dim: number): number => dim >> 3;

/**
 * 二元化：第 j 維 v[j] > 0 為 1，放在 byte j>>3 的 bit j&7（LSB first）。
 */
export function binarize(vector: ArrayLike<number>): Uint8Array {
  const out = new Uint8Array(vector.length >> 3);
  for (let j = 0; j < vector.length; j++) {
    if (vector[j]! > 0) out[j >> 3]! |= 1 << (j & 7);
  }
  return out;
}

/** int8 量化：round(v * 127)，夾在 ±127。 */
export function quantizeInt8(vector: ArrayLike<number>): Int8Array {
  const out = new Int8Array(vector.length);
  for (let j = 0; j < vector.length; j++) {
    out[j] = Math.max(-127, Math.min(127, Math.round(vector[j]! * 127)));
  }
  return out;
}

const POPCOUNT = new Uint8Array(256);
for (let i = 1; i < 256; i++) POPCOUNT[i] = (POPCOUNT[i >> 1]! + (i & 1)) as number;

/** 第 row 列與查詢的漢明距離。 */
export function hamming(
  bits: Uint8Array,
  row: number,
  query: Uint8Array,
  rowBytes = query.length,
): number {
  const base = row * rowBytes;
  let distance = 0;
  for (let i = 0; i < rowBytes; i++) distance += POPCOUNT[bits[base + i]! ^ query[i]!]!;
  return distance;
}

export interface BitHit {
  id: number;
  distance: number;
}

/**
 * 漢明距離最小的前 k 列，距離相同時 id 小的在前。
 * 距離只有 0..位元數，用直方圖找門檻，不排序全部列，只排序入選的 k 列。
 */
export function topKByHamming(
  bits: Uint8Array,
  query: Uint8Array,
  k = 100,
  count = Math.floor(bits.length / Math.max(1, query.length)),
): BitHit[] {
  const rowBytes = query.length;
  if (k <= 0 || count <= 0 || rowBytes === 0) return [];
  const maxDistance = rowBytes * 8;
  const distances = new Uint16Array(count);
  const histogram = new Uint32Array(maxDistance + 1);
  for (let row = 0; row < count; row++) {
    const distance = hamming(bits, row, query, rowBytes);
    distances[row] = distance;
    histogram[distance]!++;
  }
  // 門檻：累計到至少 k 列的最小距離；小於門檻的全收，等於門檻的依 id 順序補滿
  let threshold = maxDistance;
  let below = 0;
  for (let d = 0; d <= maxDistance; d++) {
    if (below + histogram[d]! >= k) {
      threshold = d;
      break;
    }
    below += histogram[d]!;
  }
  let ties = Math.max(0, k - below);
  const hits: BitHit[] = [];
  for (let row = 0; row < count; row++) {
    const distance = distances[row]!;
    if (distance < threshold) hits.push({ id: row, distance });
    else if (distance === threshold && ties > 0) {
      ties--;
      hits.push({ id: row, distance });
    }
  }
  return hits.sort((a, b) => a.distance - b.distance || a.id - b.id);
}

export interface RowRange {
  /** 第一列與最後一列的 id（含）。 */
  firstRow: number;
  lastRow: number;
  /** Range 標頭用的位元組範圍（含頭含尾）。 */
  start: number;
  end: number;
}

/** 候選 id 排序去重後，把間隔 <= maxGapRows 列的合併成一個位元組區間。 */
export function coalesceRanges(
  ids: readonly number[],
  rowBytes: number,
  maxGapRows = 8,
): RowRange[] {
  const sorted = Array.from(new Set(ids)).sort((a, b) => a - b);
  const ranges: RowRange[] = [];
  let first = -1;
  let last = -1;
  const flush = () => {
    if (first < 0) return;
    ranges.push({
      firstRow: first,
      lastRow: last,
      start: first * rowBytes,
      end: (last + 1) * rowBytes - 1,
    });
  };
  for (const id of sorted) {
    if (first >= 0 && id - last - 1 <= maxGapRows) {
      last = id;
      continue;
    }
    flush();
    first = id;
    last = id;
  }
  flush();
  return ranges;
}

/** int8 列與已正規化查詢向量的內積，除以 127 還原。 */
export function rescoreRow(row: ArrayLike<number>, query: ArrayLike<number>): number {
  let sum = 0;
  for (let j = 0; j < query.length; j++) sum += row[j]! * query[j]!;
  return sum / 127;
}

export function rescore(rows: readonly ArrayLike<number>[], query: ArrayLike<number>): number[] {
  return rows.map((row) => rescoreRow(row, query));
}

export interface SemanticHit {
  slug: string;
  score: number;
}

/**
 * 語意分數（內積，0..1）低於此值的結果不顯示。
 * 依據：2026-11-25 用 155 題（答案存在、答不出、模糊短查詢）與 Codex／Gemini 兩位評審標註前 10 名，
 * 0.60 時有相關結果的 65 題全部仍顯示至少一筆相關，答不出的 45 題有 29 題變成 0 筆。
 * 詳見 dev-notes/semantic-search/README.md S-10。
 */
export const SEMANTIC_MIN_SCORE = 0.6;

/** 只留分數 >= minScore 的結果，順序不變。要在取前 limit 名之前呼叫。 */
export function filterByRelevance<T extends { score: number }>(
  hits: readonly T[],
  minScore: number = SEMANTIC_MIN_SCORE,
): T[] {
  return hits.filter((hit) => hit.score >= minScore);
}

export interface MergedSemanticResult extends SemanticHit {
  category: string;
}

/**
 * 語意結果排在字面結果之後：去掉已在字面結果的頁面與重複 slug，
 * 遵守知識類型篩選（沒有類型的頁面不收），依分數取前 limit 名。
 */
export function mergeSemanticResults(
  semanticHits: readonly SemanticHit[],
  literalSlugs: Iterable<string>,
  selectedCategories: ReadonlySet<string> | null,
  limit = 20,
  getCategory: (slug: string) => string | null = getKnowledgeSearchCategory,
): MergedSemanticResult[] {
  const seen = new Set(literalSlugs);
  const merged: MergedSemanticResult[] = [];
  const sorted = [...semanticHits].sort((a, b) => b.score - a.score);
  for (const hit of sorted) {
    if (merged.length >= limit) break;
    if (!hit.slug || seen.has(hit.slug)) continue;
    const category = getCategory(hit.slug);
    if (category === null) continue;
    if (selectedCategories && !selectedCategories.has(category)) continue;
    seen.add(hit.slug);
    merged.push({ ...hit, category });
  }
  return merged;
}

/** 「第一次使用需要下載約 X MB」用：四捨五入成整數 MB，至少 1。 */
export function formatMegabytes(bytes: number): number {
  return Math.max(1, Math.round(bytes / (1024 * 1024)));
}
