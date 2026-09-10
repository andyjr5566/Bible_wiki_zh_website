# Blender R07 隔離資產流程

這個入口只處理約櫃的可重現工作副本。它不會清空使用者場景，也不會在驗證前覆蓋 `public/models/`。預設根目錄由 `build_ark_detail.py` 的 `__file__` 推導，因此不依賴某位使用者的絕對路徑。

## 執行順序

請在網站根目錄 `appendix/website/出埃及記/第25章` 開啟終端機。先用乾淨的 Blender 背景程序執行：

```powershell
blender --background --factory-startup --python scripts/blender/build_ark_detail.py -- --config scripts/blender/config/ark.json
```

腳本會依序執行 `inspect → build → export-to-staging → glTF Transform optimize → reimport-check`，產生：

- `assets/staging/blender/r07/tabernacle-ark-alternative.staged.glb`
- `assets/staging/blender/r07/tabernacle-ark-alternative.optimized.glb`
- `assets/staging/blender/r07/tabernacle-ark-alternative.r07-manifest.json`
- `assets/staging/blender/r07/ark-alternative-r07.blend`

要檢查來源而不寫入任何 Blender 資料，可先執行：

```powershell
blender --background --factory-startup --python scripts/blender/build_ark_detail.py -- --inspect-only
```

只有確認 manifest 的 `buildMetrics` 與 `reimportMetrics` 一致後，才明確加入 `--promote`，把同一份已驗證的 optimized GLB 複製到 processed 與 public：

```powershell
blender --background --factory-startup --python scripts/blender/build_ark_detail.py -- --promote
```

`--input`、`--staging-dir`、`--config` 可覆寫輸入與輸出位置；所有相對路徑都以網站根目錄解析。若 glTF Transform CLI 不存在，流程會失敗並停止 promotion，不會退回舊的批次腳本。

## 可重跑與復原

腳本只刪除自己擁有的 `EX25_R07_Ark` collection，再以固定名稱建立物件、材質、四支相機和標準面積光。連續執行兩次不會產生 `.001`。manifest 保存來源 SHA-256、Blender 版本、units、軸向、原點、材質參數、bounds 與 promotion 清單；來源 GLB 永遠只讀。

若從 Blender MCP 操作，先取得目前檔案路徑與 dirty 狀態，並先保存使用者原檔。之後只在單一循序寫入者中開啟上述背景工作檔；不要對同一場景並行呼叫寫入。`ark-alternative-improved.blend` 是原場景保存點，R07 工作檔位於 staging，兩者可分開重新開啟。

## 目前限制

本專案沒有把新的壓縮 decoder 放進瀏覽器；流程沿用已安裝的 `@gltf-transform/cli` quantize optimize，並以 re-import metrics 驗證 hierarchy、mesh 數量和 bounds。任何新壓縮擴充套件都必須先同時交付 decoder 與比較報告，不能只改副檔名或參數。

## R10 五件 detail 資產

R10 沿用同一入口處理五件器物，config 位於 `scripts/blender/config/r10-*.json`。這些 config 的 `autoCameras` 會依來源 bounds 產生 Front、Side、Top、Close 四個取景；每件的 staging、blend 與 r10 manifest 放在 `assets/staging/blender/r10/<asset-id>/`。`stageId` 會讓 manifest 保留任務版本，避免把 R10 的驗證誤記成 R07。

R10 的 Blender 呼叫仍須逐件依序執行。只有該件的 reimport metrics 通過後，才可對該件使用 `--promote`；來源 GLB 與其他器物不會被清空或覆蓋。

## R12 全資產重現驗收

網站根目錄可執行：

```powershell
npm run verify:derived
```

這個驗證器逐一重新讀取 17 件 processed GLB，核對 source SHA-256、processed/runtime 位元組、mesh／三角面／材質／貼圖／動畫數量與既有 bounds。R07/R10 的 Blender stage manifest 會另外保留 build/reimport metrics；Blender 對重複使用的 mesh 會以物件實例計數，因此 sidecar 同時記錄 NodeIO 的唯一 mesh 計量，不把兩種計數混為一談。結果寫入 `assets/derived/r12-derived-assets.json` 及 `public/models/derived-manifest.json`；`src/data/assets.json` 與 `public/models/manifest.json` 的 `sha256` 仍只代表 sourceFile，`derivedHash` 代表 processedFile。
