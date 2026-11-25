# 知識庫語意搜尋（瀏覽器端）

狀態：實作中（2026-11-25 決定）。取代舊的 NVIDIA embedding + Pinecone + Vercel `/api/search`（前端已於 `131d361f` 停用）。

## 決定

| # | 決定 | 理由 |
|---|---|---|
| S-1 | 只用在「知識庫進階」分頁；經文搜尋不做語意比對。 | 經文已有字面＋相容規則；使用者要求。 |
| S-2 | 模型 `Xenova/bge-small-zh-v1.5`（q8 ONNX，約 23 MB），CLS pooling、normalize，**查詢與頁面都不加前綴**。 | 2026-11-25 實驗：13 題 hit@1 8、hit@5 10；`multilingual-e5-small` 5/9 且模型 113 MB。 |
| S-3 | 每頁一個向量：`title + "\n" + 內文前 400 字`（換行改空白）。內文去掉空白後少於 10 字的條目不收（保險用，知識庫還在寫）。 | 切段只多中 1 題，檔案大 4 倍。沒有內文的頁面只剩標題，短查詢會把它們排到前面、點進去卻是空的（2026-11-25 正式站「我是誰」）。 |
| S-4 | 模型在讀者瀏覽器跑（Transformers.js + onnxruntime-web WASM），所有檔案放本站 GitHub Pages，`allowRemoteModels = false`。不送查詢字到任何外部服務。 | 只靠 GitHub Pages；隱私；不需金鑰。 |
| S-5 | 索引格式：二元向量（每頁 64 bytes）一次下載＋漢明距離取前 100 名，再用 HTTP Range 只抓這 100 頁的 int8 向量重新計分。**不用 IVF 分群。** | 規模實驗：IVF 在這份資料分群不明顯，recall 0.77–0.92 且要下載數 MB；二元＋int8 重算 recall@10 0.93–0.95。4 萬頁時二元檔 2.56 MB（< 服務工作者 3 MB 上限），每次查詢約 51 KB。GitHub Pages 對 `.bin` 支援 Range（已驗證 206）。 |
| S-6 | 規模目標：全本聖經 1,189 章，估 2–4 萬頁。發布時向量要**增量計算**（以內容雜湊快取）。 | 現在 3,520 頁約 75 秒；4 萬頁全算約 15 分鐘。 |
| S-7 | 介面：知識類型面板右上角「語意搜尋」勾選，**預設關、不跨次記住**。字面結果 0 筆且未開啟時，高亮該選項並在結果區問「要開啟語意搜尋嗎？」。開啟後語意結果排在字面結果之後、去重、遵守知識類型篩選，標「意思相近」。 | 使用者指定。 |
| S-8 | 第一次開啟才下載模型與執行環境，提示大約大小（由 manifest 的檔案大小加總），顯示準備進度。之後由瀏覽器快取。 | 預設關閉＝沒勾就零下載。 |
| S-9 | 上線驗證後才停 Pinecone 同步、移除 `api/`、`vercel.json`、`scripts/generate_embeddings.js`（另一批）。 | 避免空窗。 |

## 檔案格式（`public/static/semantic/`）

```
manifest.json
  {
    "version": 1,
    "model": "Xenova/bge-small-zh-v1.5",
    "dim": 512,
    "count": N,
    "bits": "bits.<hash8>.bin",      // N × 64 bytes
    "rows": "rows.<hash8>.bin",      // N × 512 bytes int8
    "ids": "ids.<hash8>.json",       // string[N]：第 i 個向量對應的 slug
    "assetBytes": <模型＋執行環境檔案大小總和>,   // 給「第一次需下載約 X MB」用
    "modelPath": "model/",           // 相對 manifest 的路徑：model/Xenova/bge-small-zh-v1.5/...
    "vendorPath": "vendor/"          // transformers.js ESM 與 ort wasm
  }
```

- **int8 列：** `q = clamp(round(v * 127), -127, 127)`，`v` 為已正規化的 float32。
- **二元位元：** 第 j 維 `v[j] > 0` 為 1；第 j 位放在 byte `j >> 3` 的 bit `j & 7`（LSB first）。
- **id 順序：** 寫檔前用便宜的分群（例如 k-means 64 群，固定種子）把相近頁面排在一起，讓重算時要抓的列比較集中、Range 可以合併。這是可選的最佳化，要量過合併後請求數才保留。
- **檔名帶內容雜湊：** manifest 一律走網路，`.bin` 與 ids 可以長期快取。
- **哪些頁面收錄：** 只收知識庫本身，也就是 `link_folder/`（含日後新增的資料夾）與 `appendix/`，並且要 `getKnowledgeSearchCategory(slug) !== null`（排除規則沿用 `searchLogic.ts`）。標籤索引頁、「我的筆記」、教學與網站說明頁不收，字面搜尋照舊找得到它們。規則在 `scripts/semantic-index/lib/pages.mjs` 的 `isKnowledgeContentSlug`。2026-11-25 改：原本收全部知識搜尋頁面，正式站查「我是誰」時排上了沒有內文的標籤頁。

### 查詢流程（瀏覽器）

1. 讀 manifest、ids、bits（bits 可被服務工作者快取）。
2. 嵌入查詢文字，得到 512 維向量 `q`，算出 `qbits`。
3. 對全部 N 頁算漢明距離，取前 K=100 名，用部分排序，不要整個排序。
4. 把候選 id 排序後合併成 Range 區間（間隔 ≤ 8 列就合併），同時最多 6 個請求，抓 `rows`。
5. 用 int8 列與 `q` 做內積（除以 127）重新計分，套知識類型篩選，剔除已在字面結果的頁面，取前 20 名。
6. 抓過的列以 id 為鍵留在記憶體，同一個分頁裡不重抓。

## 服務工作者（`quartz/static/sw.js`）

- 帶 `Range` 標頭的請求不要碰（直接放行），回應碼 206 也不要存快取，否則 `cache.put` 會丟錯。
- `static/semantic/model/` 與 `static/semantic/vendor/` 放行不快取，交給 Transformers.js 自己的 Cache API 快取。超過 3 MB 的檔案本來就不會被存。
- 改了 sw.js 要遞增 `CACHE_NAME`，並跑 `plugins/personal-notes/e2e/swcheck.mjs`。

## 建置（CI）

- **`scripts/semantic-index/`**：Node ESM，邏輯寫成純函式並附測試，例如 `buildIndex.mjs` 與 `lib/*.mjs`。
  - 輸入：建置後的 `public/static/contentIndex.json`（與知識庫字面搜尋同一份文字與 slug）。
  - 增量快取：`.semantic-cache/`，以 `sha256(model + text)` 為鍵存 int8 列，由 `actions/cache` 還原。
  - 模型與 vendor：
    - 執行時從 `@huggingface/transformers` 的套件檔案複製。版本要固定，加進根目錄 `package.json` 的 devDependencies。
    - 模型檔在 CI 從 Hugging Face 下載一次後用 `actions/cache` 快取。
  - 輸出到 `public/static/semantic/`。
- **`deploy.yml`**：
  - 在 `Build Quartz` 之後、`Upload artifact` 之前執行。
  - 失敗時不擋部署（`continue-on-error`），網站照常上線，只是沒有語意搜尋，前端要能處理 manifest 不存在的情況。
- **`smoke.yml`**：同樣對 test_content 產生索引，讓前端可以被測。

## 前端（`plugins/semantic-search`）

- **純函式模組** `src/components/semanticIndex.ts`，附 vitest 測試：解析 manifest、`hamming`、`topKByHamming`、`coalesceRanges`、`rescore`、`mergeSemanticResults`（去重與類型篩選）。
- **載入模組** `src/components/semanticModel.ts`：
  - 用 `import(/* runtime URL */)` 動態載入 `static/semantic/vendor/` 的 transformers ESM，不打包進搜尋腳本。
  - 設定 `env.localModelPath`、`env.allowRemoteModels = false`、`env.backends.onnx.wasm.wasmPaths`、`numThreads = 1`（GitHub Pages 沒有 cross-origin isolation）。
  - 回報下載進度。
- **介面** `Search.tsx`、`search.inline.ts`、`search.scss`：照 S-7、S-8 實作，淺色與深色模式都要好看，手機 390 寬不能橫向捲動。
- **改了 `src/` 一定要 `npm --prefix plugins/semantic-search run build` 並提交 `dist/`**，CI 有檢查。

## 讀者看得到的文字（zh-TW）

讀者看得到的文字不能出現模型名、檔名、欄位名、Strong 編號，也不能有「向量」「embedding」這類工程詞。

- 勾選：「語意搜尋」，說明（title 或小字）：「找意思相近的內容，不必完全相同的字」
- 第一次開啟：「第一次使用需要下載約 {X} MB，之後會留在這個瀏覽器裡。」準備中：「正在準備語意搜尋…{p}%」
- 查無字面結果：「找不到完全相符的內容。要開啟語意搜尋，找意思相近的內容嗎？」按鈕「開啟語意搜尋」
- 結果分隔：「意思相近的內容」；結果標籤「意思相近」
- 無法使用：「語意搜尋暫時無法使用，目前只顯示完全相符的結果。」

## 限制（照舊）

- 本機建置只能 `npx quartz build -d test_content -o <暫存資料夾>`，不要建 content；不要跑 `.github/scripts/prepare-plugins.sh`。
- 不得修改 `c:\Obsidian\Hermes\scripture`。repo 是公開的：不要寫入個人路徑或識別資訊。不要讀或用 `.env`。
- 本機 Windows 應用程式控制會擋部分原生二進位（rollup、numpy）；遇到時改用純 JS 或 WASM，不要硬試。
- 不要 commit 或 push。

## 分工

| 工作 | 負責 |
|---|---|
| A：建置端（`scripts/semantic-index/`、`deploy.yml`、`smoke.yml`、`sw.js`、根目錄 `package.json`） | Sonnet 子代理 |
| B：前端（`plugins/semantic-search/src`、`dist`） | Sonnet 子代理 |
| 整合測試（test_content 建置＋無頭瀏覽器實測） | Sonnet 子代理，A、B 完成後 |
| 審查與驗收 | lead |

A、B 同時進行，只改自己清單內的檔案；共用的只有上面的檔案格式。
