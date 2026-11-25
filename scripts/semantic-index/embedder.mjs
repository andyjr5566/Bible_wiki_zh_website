// 用 Transformers.js（Node，onnxruntime-node）把文字嵌入成 512 維、已正規化的向量。
// 設定固定：q8、CLS pooling、normalize、查詢與頁面都不加前綴（README S-2）。
import { existsSync } from "node:fs"
import { join } from "node:path"
import { MODEL_ID } from "./lib/manifest.mjs"

// 瀏覽器端載入模型需要的檔案（相對於模型資料夾）；少一個就會 404
export const MODEL_FILES = [
  "config.json",
  "tokenizer.json",
  "tokenizer_config.json",
  "onnx/model_quantized.onnx",
]

export function modelCacheDir() {
  return process.env.SEMANTIC_MODEL_CACHE || ".semantic-model-cache"
}

let extractorPromise = null

/** 第一次呼叫會載入（必要時從 Hugging Face 下載到 modelCacheDir()）。 */
export function getExtractor() {
  extractorPromise ??= (async () => {
    const { pipeline, env } = await import("@huggingface/transformers")
    env.cacheDir = modelCacheDir()
    return pipeline("feature-extraction", MODEL_ID, { dtype: "q8" })
  })()
  return extractorPromise
}

/** 確保模型檔都在快取資料夾；缺檔就觸發一次載入（下載）。回傳模型資料夾路徑。 */
export async function ensureModelFiles() {
  const dir = join(modelCacheDir(), ...MODEL_ID.split("/"))
  if (!MODEL_FILES.every((f) => existsSync(join(dir, f)))) await getExtractor()
  const missing = MODEL_FILES.filter((f) => !existsSync(join(dir, f)))
  if (missing.length) throw new Error(`模型檔缺少：${missing.join(", ")}（${dir}）`)
  return dir
}

/** 依長度排序後分批嵌入（減少補齊），回傳與輸入同順序的 Float32Array[]。 */
export async function embedTexts(texts, { batchSize = 16, onProgress } = {}) {
  const extractor = await getExtractor()
  const order = texts.map((_, i) => i).sort((a, b) => texts[a].length - texts[b].length)
  const out = new Array(texts.length)
  for (let i = 0; i < order.length; i += batchSize) {
    const batch = order.slice(i, i + batchSize)
    const res = await extractor(
      batch.map((j) => texts[j]),
      { pooling: "cls", normalize: true },
    )
    const dim = res.dims[1]
    batch.forEach((j, k) => {
      out[j] = Float32Array.from(res.data.subarray(k * dim, (k + 1) * dim))
    })
    onProgress?.(Math.min(i + batchSize, order.length), order.length)
  }
  return out
}
