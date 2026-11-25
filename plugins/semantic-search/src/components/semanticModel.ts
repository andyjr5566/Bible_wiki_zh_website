/**
 * 語意搜尋的載入與查詢：manifest、二元索引、模型（Transformers.js，執行時才動態載入）、Range 抓列。
 * 只有使用者開啟「語意搜尋」才會呼叫 prepare()；沒開就零下載。
 * 這個檔案不依賴 DOM，網路與路徑解析都由呼叫端注入，方便測試。
 */
import {
  bitRowBytes,
  binarize,
  coalesceRanges,
  parseManifest,
  rescoreRow,
  topKByHamming,
  type RowRange,
  type SemanticHit,
  type SemanticManifest,
} from "./semanticIndex";

/** 預設的 transformers 網頁版 ESM 檔名（@huggingface/transformers 3.x 的 dist/transformers.min.js）。manifest 有 vendorEntry 時以它為準。 */
export const DEFAULT_VENDOR_ENTRY = "transformers.min.js";
export const CANDIDATE_COUNT = 100;
export const MAX_GAP_ROWS = 8;
export const MAX_CONCURRENT_RANGES = 24;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** 把全部範圍分給最多 limit 個同時進行的工作，保持結果順序。 */
export async function runLimited<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index]!);
    }
  });
  await Promise.all(lanes);
  return results;
}

/**
 * 用 HTTP Range 抓區間；伺服器若忽略 Range 回 200 整個檔案，就自己切。
 * 回傳每個區間的位元組內容（與 ranges 同順序）。fullFile 可傳回已抓到的整檔以供重用。
 * 每個區間失敗會重試一次；仍失敗的區間回傳 null（讓呼叫端只用抓得到的列）；全部都失敗才丟錯。
 * 用 cache: "no-store" 跳過瀏覽器 HTTP 快取：區間很小、列已在記憶體快取，
 * 而 Chrome 對舊工作階段快取的 Range 項目偶爾會回 ERR_CACHE_OPERATION_NOT_SUPPORTED。
 */
export async function fetchByteRanges(
  url: string,
  ranges: readonly RowRange[],
  fetchImpl: FetchLike,
  cache: { full: Uint8Array | null } = { full: null },
): Promise<(Uint8Array | null)[]> {
  const slice = (full: Uint8Array, range: RowRange) => full.subarray(range.start, range.end + 1);
  if (cache.full) return ranges.map((range) => slice(cache.full!, range));
  const attempt = async (range: RowRange): Promise<Uint8Array> => {
    if (cache.full) return slice(cache.full, range);
    const response = await fetchImpl(url, {
      headers: { Range: `bytes=${range.start}-${range.end}` },
      cache: "no-store",
    });
    if (response.status === 206) {
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== range.end - range.start + 1) throw new Error("range length mismatch");
      return bytes;
    }
    if (response.status === 200) {
      cache.full = new Uint8Array(await response.arrayBuffer());
      return slice(cache.full, range);
    }
    throw new Error("range request failed: " + response.status);
  };
  const results = await runLimited(ranges, MAX_CONCURRENT_RANGES, async (range) => {
    for (let tries = 0; tries < 2; tries++) {
      try {
        return await attempt(range);
      } catch {
        // 重試一次；仍失敗就當作這個區間缺資料
      }
    }
    return null;
  });
  if (ranges.length > 0 && results.every((part) => part === null)) {
    throw new Error("all range requests failed");
  }
  return results;
}

type Extractor = (
  text: string,
  options: { pooling: "cls"; normalize: boolean },
) => Promise<{ data: ArrayLike<number> }>;

interface TransformersModule {
  env: {
    allowRemoteModels: boolean;
    allowLocalModels?: boolean;
    localModelPath: string;
    backends: {
      onnx: { wasm: { wasmPaths: string | { mjs: string; wasm: string }; numThreads: number } };
    };
  };
  pipeline: (
    task: string,
    model: string,
    options: { dtype: string; device?: string; progress_callback?: (event: ProgressEvent) => void },
  ) => Promise<Extractor>;
}

interface ProgressEvent {
  status?: string;
  file?: string;
  loaded?: number;
  total?: number;
}

export interface SemanticEngineOptions {
  /** 把相對於網站根的路徑（例如 static/semantic/manifest.json）轉成可 fetch 的網址。 */
  resolvePath: (path: string) => string;
  fetchImpl?: FetchLike;
  /** 測試用：取代動態載入 transformers。 */
  importModule?: (url: string) => Promise<unknown>;
}

export interface SemanticEngine {
  /** 讀 manifest；不存在或格式不對回傳 null（功能不可用）。結果會留著。 */
  loadManifest(): Promise<SemanticManifest | null>;
  /** 第一次開啟：下載索引與模型。失敗回傳 false，之後可重試。 */
  prepare(onProgress?: (percent: number) => void): Promise<boolean>;
  isReady(): boolean;
  /** 查詢；回傳前 100 名重新計分後的結果，已過期（isStale）時回傳 null。 */
  search(query: string, isStale?: () => boolean): Promise<SemanticHit[] | null>;
}

export function createSemanticEngine(options: SemanticEngineOptions): SemanticEngine {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const importModule = options.importModule ?? ((url: string) => import(/* @vite-ignore */ url));

  let manifestPromise: Promise<SemanticManifest | null> | null = null;
  let manifestUrl = "";
  let ids: string[] = [];
  let bits: Uint8Array | null = null;
  let extractor: Extractor | null = null;
  let preparing: Promise<boolean> | null = null;
  const progressListeners = new Set<(percent: number) => void>();
  let lastPercent = 0;
  // 抓過的列以 id 為鍵留在記憶體，同一個分頁不重抓
  const rowCache = new Map<number, Int8Array>();
  const fullRows = { full: null as Uint8Array | null };

  const fileUrl = (name: string) => new URL(name, manifestUrl).href;

  const loadManifest = () => {
    if (!manifestPromise) {
      manifestPromise = (async () => {
        try {
          manifestUrl = new URL(
            options.resolvePath("static/semantic/manifest.json"),
            typeof location !== "undefined" ? location.href : "http://localhost/",
          ).href;
          const response = await fetchImpl(manifestUrl);
          if (!response.ok) return null;
          return parseManifest(await response.json());
        } catch {
          return null;
        }
      })().then((manifest) => {
        // 找不到或失敗不留住，下次開啟可以再試
        if (!manifest) manifestPromise = null;
        return manifest;
      });
    }
    return manifestPromise;
  };

  const report = (percent: number) => {
    lastPercent = Math.max(lastPercent, Math.min(100, Math.round(percent)));
    for (const listener of progressListeners) listener(lastPercent);
  };

  const doPrepare = async (): Promise<boolean> => {
    const manifest = await loadManifest();
    if (!manifest) return false;
    try {
      const [idList, bitBuffer] = await Promise.all([
        fetchImpl(fileUrl(manifest.ids)).then((r) => {
          if (!r.ok) throw new Error("ids");
          return r.json() as Promise<string[]>;
        }),
        fetchImpl(fileUrl(manifest.bits)).then((r) => {
          if (!r.ok) throw new Error("bits");
          return r.arrayBuffer();
        }),
      ]);
      if (idList.length !== manifest.count) throw new Error("ids length");
      const bitBytes = new Uint8Array(bitBuffer);
      if (bitBytes.length !== manifest.count * bitRowBytes(manifest.dim)) {
        throw new Error("bits length");
      }
      ids = idList;
      bits = bitBytes;

      const vendorBase = fileUrl(manifest.vendorPath.replace(/\/?$/, "/"));
      const modelBase = fileUrl(manifest.modelPath.replace(/\/?$/, "/"));
      const entry = manifest.vendorEntry ?? DEFAULT_VENDOR_ENTRY;
      // 直接用網址載入，不經打包器：transformers 不能進搜尋腳本
      const transformers = (await importModule(
        new URL(entry, vendorBase).href,
      )) as TransformersModule;
      transformers.env.allowRemoteModels = false;
      transformers.env.allowLocalModels = true;
      // 要用相對網站根的路徑；絕對網址會讓分詞器載入失敗
      transformers.env.localModelPath = new URL(modelBase).pathname;
      // 不指定的話執行環境檔會跑去外部 CDN
      transformers.env.backends.onnx.wasm.wasmPaths = {
        mjs: new URL("ort-wasm-simd-threaded.mjs", vendorBase).href,
        wasm: new URL("ort-wasm-simd-threaded.wasm", vendorBase).href,
      };
      // GitHub Pages 沒有 cross-origin isolation，多執行緒用不了
      transformers.env.backends.onnx.wasm.numThreads = 1;

      const loadedByFile = new Map<string, number>();
      extractor = await transformers.pipeline("feature-extraction", manifest.model, {
        dtype: "q8",
        device: "wasm",
        progress_callback: (event) => {
          if (event.status !== "progress" || !event.file) return;
          loadedByFile.set(event.file, event.loaded ?? 0);
          let loaded = 0;
          for (const value of loadedByFile.values()) loaded += value;
          // 分母用 manifest 的檔案大小總和；先留 1% 給收尾
          report(Math.min(99, (loaded / Math.max(1, manifest.assetBytes)) * 100));
        },
      });
      report(100);
      return true;
    } catch {
      extractor = null;
      bits = null;
      return false;
    }
  };

  return {
    loadManifest,
    prepare(onProgress) {
      if (onProgress) {
        progressListeners.add(onProgress);
        onProgress(lastPercent);
      }
      if (extractor) return Promise.resolve(true);
      if (!preparing) {
        preparing = doPrepare().then((ok) => {
          if (!ok) {
            preparing = null;
            lastPercent = 0;
          }
          return ok;
        });
      }
      const current = preparing;
      void current.finally(() => {
        if (onProgress) progressListeners.delete(onProgress);
      });
      return current;
    },
    isReady: () => extractor !== null && bits !== null,
    async search(query, isStale = () => false) {
      const manifest = await loadManifest();
      if (!manifest || !extractor || !bits) throw new Error("semantic engine is not ready");
      const output = await extractor(query, { pooling: "cls", normalize: true });
      if (isStale()) return null;
      const vector = Float32Array.from(output.data);
      const candidates = topKByHamming(bits, binarize(vector), CANDIDATE_COUNT, manifest.count);
      const rowBytes = manifest.dim;
      const missing = candidates.map((hit) => hit.id).filter((id) => !rowCache.has(id));
      if (missing.length > 0) {
        const ranges = coalesceRanges(missing, rowBytes, MAX_GAP_ROWS);
        const buffers = await fetchByteRanges(fileUrl(manifest.rows), ranges, fetchImpl, fullRows);
        if (isStale()) return null;
        ranges.forEach((range, index) => {
          const buffer = buffers[index];
          if (!buffer) return; // 這段抓不到：略過，那些候選不參與重新計分
          for (let row = range.firstRow; row <= range.lastRow; row++) {
            const offset = (row - range.firstRow) * rowBytes;
            // 複製一份，不要讓小列拖住整個下載緩衝
            rowCache.set(
              row,
              new Int8Array(buffer.buffer, buffer.byteOffset + offset, rowBytes).slice(),
            );
          }
        });
      }
      return candidates
        .filter((hit) => rowCache.has(hit.id))
        .map((hit) => ({ slug: ids[hit.id]!, score: rescoreRow(rowCache.get(hit.id)!, vector) }))
        .filter((hit) => hit.slug)
        .sort((a, b) => b.score - a.score);
    },
  };
}
