# 語意搜尋索引建置

設計與檔案格式見 `dev-notes/semantic-search/README.md`。這裡只記怎麼跑。

## 用法

先建好網站（`public/static/contentIndex.json` 要存在），再：

```
npx tsx scripts/semantic-index/buildIndex.mjs [--out public] [--cache .semantic-cache] [--cluster] [--no-prune]
```

- 一定要用 `tsx`：收錄規則直接 import `plugins/semantic-search/src/components/searchLogic.ts` 的 `getKnowledgeSearchCategory`，不另寫一套。
- `--out`：建置輸出資料夾，讀 `<out>/static/contentIndex.json`，寫 `<out>/static/semantic/`。
- `--cache`：向量快取資料夾（預設 `.semantic-cache/`，已列入 `.gitignore`）。以 `sha256(模型 + "\n" + 文字)` 為鍵，每筆 576 bytes（64 位元 + 512 int8）。結束時會刪掉這次沒用到的項目（`--no-prune` 關掉）。
- 環境變數 `SEMANTIC_MODEL_CACHE`：Transformers.js 下載模型的資料夾（預設 `.semantic-model-cache/`，已列入 `.gitignore`）。CI 用 `actions/cache` 快取它。模型不在時會從 Hugging Face 下載。
- `--cluster`：用固定種子 k-means（64 群）重排頁面順序。預設關閉：量測（3,520 頁、200 次查詢、前 100 名、間隔 ≤ 8 列合併）請求數 55.8 → 41.8，但要抓的列 210 → 235，效益不明顯，所以維持依 slug 排序。

輸出（`<out>/static/semantic/`）：`manifest.json`、`bits.<hash8>.bin`、`rows.<hash8>.bin`、`ids.<hash8>.json`、`model/Xenova/bge-small-zh-v1.5/`（`config.json`、`tokenizer.json`、`tokenizer_config.json`、`onnx/model_quantized.onnx`）、`vendor/`（`transformers.min.js`、`ort-wasm-simd-threaded.mjs`、`ort-wasm-simd-threaded.wasm`）。`manifest.assetBytes` 是 model + vendor 的位元組總和。

執行結束會印「新嵌入 N、沿用快取 M」。第二次跑同樣內容應該是新嵌入 0。

## 瀏覽器端怎麼載入（transformers 4.3.2，已實測）

- 用自給自足的 `vendor/transformers.min.js`（已內含 onnxruntime-web 的 JS）。`transformers.web.js` 不能直接用，它有裸模組 import（`onnxruntime-web/webgpu`）。
- `env.allowRemoteModels = false`、`env.allowLocalModels = true`。
- `env.localModelPath` 要設成**以 `/` 開頭的路徑**（例如 `new URL("model/", manifestUrl).pathname`）。給完整 `http://…` 網址時，tokenizer 不會被載入，會出現 `this.tokenizer is not a function`。
- `env.backends.onnx.wasm.wasmPaths = { mjs: <vendor>/ort-wasm-simd-threaded.mjs, wasm: <vendor>/ort-wasm-simd-threaded.wasm }`，`numThreads = 1`，`pipeline("feature-extraction", "Xenova/bge-small-zh-v1.5", { dtype: "q8", device: "wasm" })`，呼叫時 `{ pooling: "cls", normalize: true }`。
- 預設的 wasm 路徑會指向 jsdelivr CDN，所以一定要自己設 `wasmPaths`。

## 檔案

- `buildIndex.mjs`：命令列主程式。
- `embedder.mjs`：Transformers.js（Node）嵌入，q8、CLS、normalize、不加前綴。
- `lib/`：純函式（`text`、`quant`、`naming`、`cache`、`pages`、`assemble`、`manifest`、`ranges`、`cluster`），各有 `*.test.mjs`。

## 測試

```
npx tsx --test scripts/semantic-index/lib/*.test.mjs
```

（根目錄的 `npm test` 也會一併跑到。）
