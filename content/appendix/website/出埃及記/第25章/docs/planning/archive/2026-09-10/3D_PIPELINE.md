# 3D 資產處理管線

目前已從 Sketchfab 下載 17 個原始 GLB 並保留在 `assets/source/sketchfab/`，再以 glTF-Transform 產生最佳化副本並接入 runtime manifest。本文件記錄可重現的處理、選擇與 fallback 流程；逐檔 checksum 與授權見 `ADDITIONAL_DOWNLOADS.md`。

```text
已確認授權與下載權限的原始模型
  → assets/source/sketchfab/<asset-id>/
  → Blender：檢查 scale、rotation、origin、hierarchy、material
  → assets/processed/<asset-id>/
  → GLB：Draco 或 Meshopt、適當紋理壓縮
  → public/models/<name>.glb
  → public/models/manifest.json（核准、歸屬與 transform）
  → ModelLoader 與 ASSETS.md
```

## 必要驗收

- 不直接改寫 `assets/source/` 的原始檔。
- 修正模型單位、面向與原點，並記錄 Blender 版本與操作。
- 刪除未使用的材質、mesh、動畫和大尺寸紋理。
- 檢查 `KHR_draco_mesh_compression` 或 Meshopt 在目標瀏覽器的相容性。
- 以 GLTF Viewer／Three.js 實測材質、比例、陰影和載入錯誤。
- 評估三角形數、紋理記憶體與載入大小，必要時建立 LOD。
- 更新 `docs/ASSETS.md`、Credits UI 和載入失敗時的 fallback。

## Runtime manifest 門檻

`public/models/manifest.json` 是唯一可讓 GLB 進入 runtime 的入口。每一個 entry 必須具有：

- `approval: "approved"`、唯一 `id`、`target`、`.glb` 的 `url`，以及位置／旋轉／縮放。
- `author`、`sourceUrl`、`license`、`attribution`，且須與 `ASSETS.md` 相符。
- 實際存在於 `public/models/` 的處理後檔案。

`ModelLoader` 只會讀取這些已核准 entry；載入失敗、缺少清冊或未核准項目時，會保留程序化 fallback。`npm run test:assets` 會驗證清冊與檔案存在性，避免未記錄的第三方資產被誤發佈。

## 完整會幕主模型與剖面模式

已核准的完整會幕 GLB 以 `target: "world"` 寫入 manifest 時，runtime 會在正常模式顯示它，依包圍盒自動取景，並隱藏本專案的程序化會幕 fallback，以避免兩個完整會幕重疊。來源模型的長軸原本在 X，manifest 以 Y 軸 -90° 旋轉、scale 0.3 對齊共用的 Z 軸平面；因此 Tour、地圖 pin、第一人稱碰撞與模型器具使用同一套方向。`sectionOnly` 的框架 GLB 在「剖面」顯示；若該檔案失敗，才顯示可互動的程序化結構層與法版研究標記。窄螢幕／觸控裝置由 `ModelLoader.selectRuntimeModels` 只選取 `mobileOnly` 的低模，以控制下載量與 GPU 壓力。

這個設計只處理**已核准且已處理**的模型。完整會幕與獨立器具若在同一份 manifest 同時採用，必須在資產審核時確認 hierarchy、使用目的與可見性，避免重複呈現同一器具。

## 目前 fallback

`src/scene/TabernacleScene.js` 使用可重新產生的 Three.js 幾何作為展示層。它不等同於任何候選 Sketchfab 模型，也不會取代所需的授權與 Attribution。
