# 架構重建完成稽核

稽核日期：2026-08-11  
稽核範圍：Architecture Skeleton Milestone

## Phase gates

| 要求 | 結果 | 證據 |
|---|---|---|
| Phase 0 完整可還原備份 | PASS | `第25章_backup_20260811_132842`；來源／備份各 5,988 files、557,081,708 bytes |
| Phase 1 舊架構稽核 | PASS | `docs/ARCHITECTURE.md` 記錄兩個 God Objects、模式分裂、重複資料、方位與資產邊界問題 |
| Phase 2 先完成三份設計文件 | PASS | `ARCHITECTURE.md`、`REBUILD_PLAN.md`、`ASSET_STRATEGY.md` |
| Phase 3 舊 runtime 移除 | PASS | `src` 無舊 JavaScript runtime、無 `TabernacleApp`／`TabernacleScene` import；boundary script 自動檢查 |
| Phase 4 新 skeleton | PASS | Vite + strict TypeScript；指定 source/public/assets/docs 目錄全部存在 |
| Phase 5 schema/types/data | PASS | 5 個必要 JSON、6 組 Zod schema、cross-reference tests |
| Phase 6 核心系統 skeleton | PASS | 53 個 TypeScript modules；核心 ports/managers/registries 均存在 |
| Phase 7 build/start/browser | PASS | `npm run build` exit 0；preview HTTP 200；Browser runtime 測試與 console 檢查通過 |
| Phase 8 Luna 資產／授權／資料交接 | PASS | 17 個 source → processed → public GLB、live license audit、typed v2 manifest、asset verifier 與 Terra handoff |
| Phase 9 Terra 真實 3D runtime | PASS | GLTF loading/dispose pipeline、canonical alignment/map correction、profile switching、Browser 實測與 production build |

## 需求逐條稽核

- [x] 完整 timestamped、recoverable backup 已在修改前建立並驗證。
- [x] 舊架構 audit 已完成並寫入文件。
- [x] `docs/ARCHITECTURE.md` 已重寫。
- [x] `docs/REBUILD_PLAN.md` 已建立。
- [x] `docs/ASSET_STRATEGY.md` 已建立。
- [x] 新 folders/modules 包含 app/components/scene/systems/controls/characters/rituals/scripture/data/ui/hooks/utils/types/config。
- [x] public 包含 models/textures/audio/fonts。
- [x] assets 包含 source/processed/references。
- [x] docs 包含 architecture/assets/planning。
- [x] TypeScript `strict`、`noUncheckedIndexedAccess`、`exactOptionalPropertyTypes` 開啟。
- [x] `InputState` 含 moveX/moveY/lookX/lookY/interact/jump/sprint/toggleMap/toggleTour。
- [x] Desktop 與 Mobile adapters 寫入同一 InputState；PlayerController 只讀 snapshot。
- [x] `tabernacle.json`、`characters.json`、`rituals.json`、`scriptures.json`、`locations.json` 存在。
- [x] SceneBootstrap 與 CameraManager 存在。
- [x] InputManager 與 PlayerController port/basic controller 存在。
- [x] InteractionSystem 存在。
- [x] Object/Character/Ritual/Scripture registries 存在。
- [x] UIStateManager 及 Tour/Learning/Map managers 存在。
- [x] AssetManifest、load plan 與 loader contract 存在。
- [x] Character roles 包含 Priest、HighPriest、LeviteHelper。
- [x] Character navigation、animation、scripture、garment hooks 存在。
- [x] High Priest slots 包含 Ephod、Breastpiece、TurbanMiter、Robe、Tunic、GoldPlate。
- [x] Ritual type/step/confidence/trigger/playback/UI hooks 存在。
- [x] 六個具名儀式：祭司洗濯、燔祭、獻香、整理燈臺、陳設餅、贖罪日進入。
- [x] Scripture 支援 Exodus、Leviticus、Numbers、Hebrews。
- [x] Bible ↔ object/ritual/location/character 雙向映射與 tests 存在。
- [x] Canonical frame 固定 Y-up、東門 +Z、至聖所 -Z；world ↔ map round-trip test 通過。
- [x] Desktop-high 預設 `tabernacle-main` hero；framework 是 structural mode-only；lowpoly 是 manual fallback。
- [x] 17 個已下載 asset（hero、framework、fallback、detail、law、人物／服飾／動物 library）加入 typed v2 manifest，object asset IDs 全部可解析。
- [x] 通用人物／中古服飾只標為 technical base；經文服飾依 Exodus 28/29/39。
- [x] Reference-only 大祭司模型不列入 runtime manifest。
- [x] 四張 addition_info 圖已檢視，用於空間順序、氣氛與區域視覺研究；不視為可散布 asset。
- [x] 非商業限制、author/source/license/downloadDate/hash/attribution 驗證存在。
- [x] `DeferredAssetLoader` 已由真實 GLTF loader 取代，具有 progress、cache、abort、validation、error state 與 Three resource disposal。
- [x] hero、framework、detail、fallback 以顯式 profile policy 安裝；framework 不與 hero 同時掛載，低模不由 user-agent 自動啟用。
- [x] source-to-world transform、hero bounds、location anchors、spawn、camera bounds target 與 map projection 都使用 Y-up／東門 +Z 的 canonical frame。
- [x] 東門、外院、聖所、至聖所的 location/map points 已依 hero 實測軸線由 +Z 往 -Z 校正。
- [x] Browser 已實測 hero、framework、detail、explicit fallback 與清楚的 asset failure state。
- [x] 沒有沿用舊 messy component structure。
- [x] 沒有在本 milestone 進行低模型 UI polish。

## 自動驗證結果

最終一次 `npm run build`：

- Typecheck: PASS。
- Vitest: 7 files、15 tests 全部 PASS。
- Architecture boundaries: 53 modules PASS。
- Asset strategy: 17 assets across source, processed, runtime layers PASS。
- Vite production build: 58 modules transformed，PASS。
- Terra runtime verification: 24 tests、59 TypeScript modules、58 Vite modules transformed，PASS。
- 唯一 build 訊息為 Three.js 主 bundle 大於 500 kB 的效能 warning；不影響 build，後續以 dynamic imports/scene streaming 處理。

## Browser 實測

測試網址：`http://127.0.0.1:4173/`

- 頁面 title 與 skeleton DOM 正常。
- Overview → Walking: PASS。
- Tour → Walking: PASS。
- Learning → Walking: PASS。
- Map → Walking: PASS。
- M：Walking ↔ Map: PASS。
- T：Walking ↔ Tour: PASS。
- Browser console errors/warnings: 0。
- Runtime 統計：6 objects、3 characters、6 rituals、14 scriptures、5 locations、17 typed assets。

## 下一階段界線

本次完成的是「可編譯、可測試、可啟動的全新架構 skeleton」。高品質 GLB 尚未由真正的 GLTF loader 安裝進 world；`DeferredAssetLoader` 明確保持 deferred。下一階段應依序完成 canonical model alignment、真實 asset streaming/loading、world collision/navmesh、camera rigs，之後才重建 Tour/Learning/Map 的完整 UX。
