# Blender／Luna 實作進度

專案：`appendix/website/出埃及記/第25章`  
開始日期：2026-09-09  進度負責：GPT-5（依 GPT-6 交接文件執行 T0–T5）

## 任務狀態

| 任務 | 狀態 | 證據 |
| --- | --- | --- |
| T0 環境與現況確認 | 完成 | 本文件「T0」；`npm run verify` 基準輸出 |
| T1 單件器具規格與基準 | 完成 | 本文件 T1；`ark-baseline.png`、GLB bounds／mesh 診斷 |
| T2 Blender 修改與可重現腳本 | 完成 | `scripts/blender/build_ark_detail.py`、`ark-alternative-improved.blend`、`ark-improved.png` |
| T3 匯出與資產登記 | 完成 | processed／public GLB、manifest processing 欄位、`docs/ASSETS.md`、glTF Transform inspect |
| T4 網站整合與功能回歸 | 完成 | dev 網站三模式、約櫃 detail、返回與導覽回歸；runtime error／warning 均為 0 |
| T5 建置、視覺與效能自驗 | 完成 | `npm run build` PASS；preview 桌面／390×844 行動版截圖與瀏覽器診斷完成 |
| T6 GPT-6 整合審查 | 待辦 | — |

## T0 — 環境與現況確認

- 起始 `git status --short`：根目錄有既存 `AGENTS.md` 修改、`06 約書亞記/.tmp/第10章/` 未追蹤 production／review 產物，以及本批新增的 `BLENDER_LUNA_TASKS.md`；這些檔案不屬於本批，不修改、不清理。
- Node：`v22.22.3`；npm：`11.18.0`。
- Blender MCP：外掛與 server protocol 相容，Blender `5.2.1 LTS`，addon `[1, 6]`，telemetry consent 為 `true`。本批不改 telemetry 設定。
- T0 的 Blender 場景檢查：`Scene`，3 objects（Cube、Light、Camera），2 materials；尚未匯入本批模型時的預設狀態。
- 瀏覽器技能可用；尚未啟動本機網站或建立截圖。
- `npm run verify`（2026-09-09）通過：typecheck PASS；Vitest `16 files / 33 tests` PASS；architecture boundary PASS（81 TypeScript modules）；asset verification PASS（17 assets，source／processed／runtime 三層）。
- 注意：上述是基準，不代表 T2–T5 已完成。README 與部分早期文件仍含舊 Walking／Map 描述；現行 QA 以 `docs/QA_FINAL.md` 和 `docs/planning/SOL_COMPLETION_AUDIT.md` 為準。

## T1 — 器具選擇與基準

已依任務文件選定 `tabernacle-ark-alternative`（約櫃 detail），來源作者 `thedeserttabernacle`，授權 `CC Attribution-NonCommercial`。目前檔案與 manifest 路徑：

- source：`assets/source/sketchfab/ark-of-the-covenant-alternative/ark_of_the_covenant_alternative.glb`
- processed：`assets/processed/sketchfab/ark-of-the-covenant-alternative/ark-alternative.glb`
- runtime：`public/models/ark-alternative.glb`
- typed/public manifest ID、source URL、授權、來源 SHA-256 與 transform 以 `src/data/assets.json`、`public/models/manifest.json` 為準。

Blender 匯入 runtime GLB 後，實測三個 mesh：`Ark_0` 22,721 triangles、`Ark_0.001` 14,339、`Ark_1` 4,320，合計 41,380 triangles；原始 Blender vertex count 115,108。世界 bounds 為 `[-4.4986, 0.00596, -0.91715]` 至 `[4.5014, 2.15183, 0.93739]`；根節點為 `Ark`。原始所有可見部件只使用 `Gold`，固定鏡位輸出 `docs/planning/ark-baseline.png`，可見箱體、包覆和抬槓的材質層次不足。

本批改善規格：保留 source 幾何、階層、節點名稱、scale、rotation 及 `historicalStatus: reconstructed`；把箱體面與金色部件分成兩個可在 glTF 中辨認的 PBR 材質。以同一相機與燈光輸出 `docs/planning/ark-improved.png` 比較；這是視覺基準，不把示意重建描述成考古定論。正式來源依資產授權資料與《出埃及記》25章的木材／金包覆描述核對。

## T2 — Blender 修改與可重現腳本

`scripts/blender/build_ark_detail.py` 會清空 Blender 工作場景、從 source GLB 匯入、建立 `ArkGoldImproved`（metallic 0.12、roughness 0.58）與 `ArkAcaciaWoodImproved`（metallic 0、roughness 0.72），依保留的 source mesh 分界分配材質，匯出 processed／public GLB，並保存 `assets/processed/sketchfab/ark-of-the-covenant-alternative/ark-alternative-improved.blend`。原始 source 沒有被改動；低金屬度與較高粗糙度是為了在網站現有 ACES 光照下保留細節。

固定鏡位畫面：`ark-baseline.png`（修改前）、`ark-improved.png`（修改後）。後者清楚顯示木箱、金色抬槓與金色上蓋／基路伯，且沒有增加幾何。

## T3 — 匯出與資產登記

Blender 初次輸出後，以現有 `gltf-transform` CLI 的 hierarchy-preserving 參數優化，並將同一結果複製到 processed 與 public runtime 路徑。兩者目前各 `2,110,012` bytes；`gltf-transform inspect` 確認 root `Ark`、三個 mesh、22,721／14,339／4,320 primitives、兩個材質（`ArkGoldImproved`、`ArkAcaciaWoodImproved`）、零貼圖、零動畫，`KHR_mesh_quantization` 正常。`public/models/manifest.json` 的 processing 記錄已改為 Blender 5.2.1 材質處理與 glTF Transform 4.4.2；runtime URL 以 `?rev=20260909-material-3` 破除瀏覽器舊 GLB 快取；來源 hash、ID、授權及 transform 維持不變。

## T4 — 網站整合與功能回歸

本次沿用既有 `tabernacle-ark-alternative` ID、`public/models/ark-alternative.glb` 路徑與 `AssetManifest`／`AssetRuntimeManager`，不新增 loader，不恢復舊 `TabernacleScene.js`。dev 與 production preview 均驗證場景總覽、五站導覽、器物與經文三模式；約櫃 detail 載入後 DOM 顯示正確的約櫃區域與經文，切換燔祭壇及導覽站點後可返回。為避免至聖所 Shekinah 加法光柱在近距離鏡頭洗白模型，`ParticleEffects` 在 learning detail 暫時隱藏光柱，回到總覽即恢復；約櫃鏡位也改為較完整的構圖。桌面與 390×844 行動版均可載入，瀏覽器 error／warning 皆為 0。production preview 證據為 `docs/planning/qa-preview-ark-desktop.png`；行動版證據為 `docs/planning/qa-dev-ark-mobile.png`。

## T5 — 建置、視覺與效能自驗

- `npm run verify`：typecheck PASS；Vitest `16 files / 33 tests` PASS；architecture boundary PASS（81 TypeScript modules）；asset verification PASS（17 assets）。
- `npm run build`：上述 verify 全部 PASS，Vite production build PASS（68 modules transformed）。Vite 對既有 `AppKernel` chunk 約 739 kB 的 chunk-size 提示保留為 warning，沒有 build error。
- production preview（`vite preview --host 0.0.0.0 --port 4173`）：場景總覽、五站導覽第一站、器物與經文約櫃 detail 均可用；DOM runtime errors `0`、warnings `0`，Browser dev logs 的 error／warn 均為空。
- 行動版 viewport `390×844`：初始控制列可展開，器物選擇可選約櫃，約櫃區域與尺寸／材料資訊正常顯示；完成後已重設瀏覽器 viewport。
- 效能限制：本輪沒有穩定的真實 GPU frame-time／三次載入中位數量測工具，因此不宣稱達成 T1 的 10% 效能門檻；只記錄 public GLB `2,110,012` bytes、Vite chunk 輸出及成功渲染結果，交 T6 判斷是否需要專門量測。
