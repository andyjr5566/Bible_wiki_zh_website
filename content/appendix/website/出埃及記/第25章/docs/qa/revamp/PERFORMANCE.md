# R20 效能、載入與診斷

日期：2026-09-10（Asia/Taipei）
範圍：網站 runtime 的可重現量測介面、資產來源記錄與故障觀測。沒有修改 Blender 場景、GLB、`raw_scripture/` 或 production scripture。

## 使用方式

開發者工具的 Console 輸入下列指令。診斷面板不會出現在一般介面；只有呼叫 `start` 才開始收集。

```js
const qa = window.__TABERNACLE_PERFORMANCE__;
qa.start('hero');                 // 或 detail-ark、detail-menorah、atonement
qa.markUsefulFrame();             // 內容可讀且模型已就緒時呼叫
// 讓場景運作 60 秒，再停止
const report = qa.stop();
copy(qa.exportJson());
```

`AppKernel` 在資產 runtime 進入 `ready` 時自動記下 load 與 first-useful-frame。多次測量請每個情境重新呼叫 `start()`，並維持相同視口、DPR、資產 profile、快取與網路設定。`exportJson()` 會保留 build hash、視口／DPR、browser、profile、WebGL 字串、資產 runtime URL、source／processed URL 與 SHA-256，以及 active asset IDs。

## 指標邊界

- `frameIntervalsMs.median/p95` 是 render loop 的 `requestAnimationFrame` 相鄰時間差，不能當成 GPU 真實耗時。
- Three.js `renderer.info` 提供最後一個 render 的 calls、triangles、points、lines，以及目前 memory 中的 geometries／textures；它不是 GPU profiler。
- 本環境沒有可由 recorder 確認的 `EXT_disjoint_timer_query` GPU 計時，因此報告固定寫 `gpuTiming: unavailable without EXT_disjoint_timer_query`。若需要 GPU wall time，另用瀏覽器廠商 profiler 測量。
- `PerformanceObserver('longtask')` 若瀏覽器支援才記錄；不支援時不冒稱為零。

## R20 檢查結果

| 項目 | 結果 |
| --- | --- |
| bundle／lazy load | build 仍有 `AppKernel` 約 807 kB（gzip 約 222 kB）警告；現有 library asset 仍由 deferred policy 控制，尚未宣稱達標 |
| pixel ratio／shadows | `SceneBootstrap` 的 high／medium／low profile 分別使用上限 2、1、0.85；low 關閉陰影；尚未在同一裝置完成三次對照 |
| texture／geometry／dispose | recorder 可讀 `renderer.info.memory`；`AssetLoader.disposeObject3D` 釋放 geometry、material、texture，需以 browser repeated load/unload 量測確認無增長 |
| GLB 延遲／失敗／備援 | `AssetRuntimeManager` 保留 generation cancellation、錯誤狀態與明確 fallback；既有 unit fixtures 覆蓋 forced failure／並行 detail 競爭；真實網路重試數據待 browser run |
| browser GPU profiler | 未驗證；本產物不把 rAF 間隔冒稱 GPU 時間 |

## 原始量測產物

- [r20-performance.json](r20-performance.json) 是本輪可重現格式與環境欄位的原始產物。尚未以指定裝置與瀏覽器完成 hero、六 detail、贖罪日 60 秒測量，對應 scenario 明確標記 `unverified`，不宣稱效能 PASS。
- build 驗證時的產物 hash 由 `dist/index.html` 載入 URL 取得；每次 build hash 改變後需重新匯出報告。

## 驗證命令

```text
npm run build
```

本輪結果：typecheck PASS、Vitest `21 files / 60 tests` PASS、architecture `103 TypeScript modules` PASS、assets `17` PASS、Vite build PASS。瀏覽器的 runtime errors/warnings 與真實 GPU 資源仍需在同一台裝置依上方指令補測。
