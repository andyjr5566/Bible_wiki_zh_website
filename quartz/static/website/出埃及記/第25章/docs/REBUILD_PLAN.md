# 重建計畫與完成定義

更新日期：2026-08-11  
範圍：`appendix/website/出埃及記/第25章`

## 原則

本計畫是從乾淨架構重新開始，不是繼續修補舊版 UI 或 `TabernacleApp` / `TabernacleScene`。現有高品質 3D 資產、來源檔、署名紀錄與參考文件保留；舊 runtime component structure 不保留。

第一個交付是可編譯、可測試、可啟動的 architecture skeleton。它刻意不做低模型 UI polish，也不在核心骨架尚未穩定前實作完整沉浸體驗。

## 階段與 gate

### Phase 0 — 安全備份（完成）

- 建立 timestamped sibling backup。
- 比對來源／備份檔案數與總大小。
- 確認 backup 不在 project 內，避免後續清理誤傷。

Gate：5,988 files、557,081,708 bytes，兩邊一致。

### Phase 1 — 舊架構稽核（完成）

- 列出程式、資料、測試、文件及資產。
- 確認 God Objects、重複資料、隱式模式變更與 world/map 不一致來源。
- 分類「可保留的資料／資產」及「不可沿用的 runtime architecture」。

Gate：稽核結論寫入 `ARCHITECTURE.md`。

### Phase 2 — 先設計再編碼

- 完成 `ARCHITECTURE.md`。
- 完成 `REBUILD_PLAN.md`。
- 完成 `ASSET_STRATEGY.md`。
- 固定模組邊界、模式狀態機、座標契約、資料 schema 與驗證策略。

Gate：三份文件可獨立回答為何舊版模式會壞、哪些資產會保留、何時才可進入功能實作。

### Phase 3 — 清除舊 runtime

- 移除舊 `src` JavaScript app/scene/control/ritual/audio/character runtime。
- 移除依賴舊實作細節的測試 scripts。
- 保留資產、reference docs 及授權紀錄。

Gate：新 source tree 不 import 舊檔、不保留 TabernacleApp/TabernacleScene God Object。

### Phase 4 — 新專案骨架

- Vite + TypeScript strict。
- 建立 `app/components/scene/systems/controls/characters/rituals/scripture/data/ui/hooks/utils/types/config`。
- 建立 `public/models/textures/audio/fonts`。
- 建立 `assets/source/processed/references`。
- 建立 `docs/architecture/assets/planning`。
- 建立最小 app shell，只顯示啟動、模式與資料/資產載入狀態。

Gate：`npm run typecheck` 與基本 dev server 成功。

### Phase 5 — 型別、schema 與資料

- 定義 InputState、mode、asset、tabernacle、character、ritual、scripture、location 型別。
- 建立 Zod schemas。
- 建立五個必要 JSON skeleton。
- 驗證 ID 唯一性及所有 cross-reference。

Gate：invalid fixture 會被 test 拒絕，正式資料全部通過。

### Phase 6 — 核心系統 skeleton

- SceneBootstrap、CameraManager。
- InputManager + Desktop/Mobile adapters。
- PlayerController interface/basic controller。
- InteractionSystem。
- Object/Character/Ritual/Scripture registries。
- RitualPlaybackController。
- UIStateManager + 明確模式 transitions。
- Tour/Learning/Map managers。
- AssetManifest / AssetLoader contract。
- AppKernel composition root。

Gate：各模組透過 typed interface 組裝；Walking → 其他模式 → Walking 測試全部通過。

### Phase 7 — 驗證

- architecture boundary check。
- data/schema/cross-reference tests。
- unit tests。
- typecheck。
- production build。
- dev/preview server 實際 HTTP 驗證。
- Browser 檢查畫面、模式往返及 console。

Gate：所有命令 exit 0，網站實際可開啟。

## 這一輪刻意不做

- 完整視覺 polish 或 responsive design。
- 完整 3D 場景佈置與所有獨立 props 安裝。
- 完整人物服飾建模、retarget 與動畫。
- 完整儀式視效、音效、粒子與旁白。
- 為手機低規裝置犧牲桌面主場景品質。

這些工作在架構骨架驗收後進入後續 milestones。

## 後續 milestones

1. World alignment：校正主模型東西方、地圖 bounds、spawn、colliders 與 camera rigs。
2. High-fidelity environment：PBR、燈光、陰影、沙漠環境、LOD/streaming。
3. Sacred objects：獨立器具模型、互動 hit areas 與 Scripture links。
4. Character pipeline：base rig、經文服飾重建、導航、動畫狀態機。
5. Ritual playback：儀式 timeline、教學解說、信心標籤與可暫停步驟。
6. Learning UX：Tour、Map、Scripture、object inspector 以相同 mode/state 契約整合。
7. QA/performance/accessibility：鍵盤、字幕、降動態、GPU profiles、fallback 手動選項。

## 完成稽核清單

- [x] 備份路徑及驗證結果存在於文件。
- [x] 舊 runtime God Objects 已移除。
- [x] 三份架構文件存在。
- [x] 指定 source/public/assets/docs folders 存在。
- [x] TypeScript strict 開啟。
- [x] 五個必要 JSON 存在且通過 schema。
- [x] InputState 包含九個指定欄位。
- [x] 指定核心系統與 registries 存在。
- [x] 角色 roles、garment slots 與 hooks 存在。
- [x] 儀式 type/step/confidence/trigger/playback/UI hooks 存在。
- [x] Bible ↔ 3D 雙向 mapping 存在。
- [x] 高品質資產為 desktop default；低模只作 fallback。
- [x] architecture test、unit tests、typecheck、build 全部成功。
- [x] server 可啟動並實際回應。
