# 互動式會幕：重建架構

> 2026-08-11 易用性修訂：目前 production 體驗已取消 Walking 與 Map，只保留 Overview、Tour、Learning；相機改用 OrbitControls。本文後段若提及 player、WASD、碰撞或 Walking round-trip，屬較早架構階段的設計記錄，現況以 `docs/QA_FINAL.md` 與 `docs/planning/SOL_COMPLETION_AUDIT.md` 為準。

更新日期：2026-08-11  
狀態：Phase 2 架構基線  
用途：非商業、教育與聖經研讀

## 1. 架構目標

這次重建以「桌面高品質 3D 會幕學習體驗」為核心，不延續舊版的大型類別與隱式模式切換。系統必須讓場景、輸入、相機、角色、儀式、經文、地圖、導覽與 UI 可以分開演進，並以型別化資料及清楚的介面互相連接。

核心原則：

- 單一狀態來源：目前體驗模式只由 `UIStateManager` 管理。
- 明確模式轉換：Walking、Overview、Tour、Learning、Map 透過命令切換，不由 `flyTo` 或面板開關暗中改變。
- 輸入與玩法分離：桌面、觸控、未來手把都輸出相同的 `InputState`。
- 資料驅動：會幕物件、人物、儀式、經文與地點由 JSON + Zod schema 驗證。
- 經文可追溯：Bible reference 與 3D entity 是雙向關聯。
- 資產可追溯：每個 runtime asset 有作者、來源、授權、下載日期、用途與品質層級。
- 高品質優先：桌面預設使用完整主模型及獨立細節模型；低模只保留為明確 fallback，不參與核心設計決策。
- 非商業限制可見：CC BY-NC 資產使整體體驗只能作非商業使用，署名不可移除。

## 2. 舊架構稽核

### 2.1 已確認的主要問題

1. `src/app/TabernacleApp.js` 約 959 行，直接抓取大量 DOM 節點，同時管理地圖、Tour、自動播放、人物、經文、儀式、面板、公告與相機模式。
2. `src/scene/TabernacleScene.js` 約 1,096 行，同時建立 Three.js world、相機、光線、procedural geometry、模型載入、角色、碰撞、輸入、first-person、overview、raycast 與 render loop。
3. 模式狀態至少分散在 `TabernacleApp` 的按鈕／面板狀態、`TabernacleScene.viewMode`、Tour 播放狀態，以及 `resumeFirstPersonOnClose` 等旗標。
4. `flyTo()` 同時具有「移動相機」和「退出走路模式」的副作用；地圖、導覽、人物或儀式只要聚焦物件，便可能使走路模式無法一致恢復。
5. 地圖座標、world layout、模型 rotation/scale 與相機方位分散在資料、manifest 與程式碼，缺乏共同的世界座標契約。
6. `tabernacle.js` 與 `tabernacle.json` 重複描述內容，造成資料來源不唯一。
7. JavaScript 沒有編譯期型別，JSON 也沒有 runtime schema 驗證；跨系統 ID 可寫錯而不會被發現。
8. 測試是針對舊實作的個別 Node script，缺少架構邊界、狀態轉換、registry、資料引用完整性等契約測試。
9. runtime、source、processed 與 reference asset 雖已有部分目錄，舊 loader 仍直接以條件旗標篩 manifest，沒有獨立的品質策略與載入方案。

### 2.2 可保留的內容

- `public/models` 內已下載及處理的 GLB。
- `assets/source`、`assets/processed` 的原始與處理後資產。
- `docs/addition_info` 的使用者設計參考圖、PDF 與簡報。
- `docs/ASSETS.md` 內的來源與署名紀錄；重建後由新 manifest 持續維護。
- 已確認的 Sketchfab URL、作者、授權與下載日期。

以上內容是資料與資產，不代表沿用舊 runtime 架構。

## 3. 模組邊界

```text
app/          組裝依賴、啟動與生命週期；不實作玩法
components/   純 UI 元件；透過 ports/store 溝通，不直接操作 Three scene
scene/        Three.js scene、renderer、camera 與 world root
systems/      互動、導覽、學習、地圖等跨領域 orchestration
controls/     InputState、輸入 adapter、PlayerController port
characters/   人物 registry、角色 runtime 與服飾/動畫 hooks
rituals/      儀式 registry、步驟與播放控制
scripture/    經文 registry、解析及 Bible ↔ 3D 雙向映射
data/         JSON、Zod schemas 與資料載入器
ui/           UI state、模式狀態機與 UI ports
hooks/        可重用生命週期/訂閱 hooks
utils/        無領域副作用的工具
types/        跨模組穩定型別與 ports
config/       runtime、資產、品質與環境設定
```

依賴方向：

```text
data/types/config/utils
        ↑
domain registries (characters/rituals/scripture)
        ↑
scene + controls + systems
        ↑
app composition root
        ↓
ui/components via typed ports and store snapshots
```

禁止事項：

- `scene` 不可 import `ui` 或直接修改 DOM。
- `components` 不可 import Three.js scene 的具體類別。
- 輸入 adapter 不可直接移動 camera/player。
- Registry 不可依賴 renderer 或 DOM。
- 相機移動不得隱式改變體驗模式。
- JSON 資料進入 runtime 前必須通過 schema。

## 4. 模式狀態機

唯一模式型別為：

```ts
type ExperienceMode = 'walking' | 'overview' | 'tour' | 'learning' | 'map';
```

`UIStateManager.transitionTo(mode, reason)` 是唯一寫入入口，並保留 `previousMode`。模式管理器只回應轉換結果：

- `CameraManager` 套用對應 camera rig。
- `InputManager` 根據模式啟用或停用 movement/look。
- `TourManager` 只管理導覽 index/playback，不直接改 DOM 或 camera。
- `MapModeManager` 管理 world ↔ map 投影，不持有 player/controller。
- `LearningModeManager` 管理選取的物件、儀式與經文脈絡。

從任何模式切回 Walking 都走同一條命令：

```text
UI command → UIStateManager.transitionTo('walking')
           → CameraManager.enterWalking(previous pose or spawn)
           → InputManager.setContext('walking')
           → UI render(snapshot)
```

Tour 聚焦只呼叫 `CameraManager.focus(target)`；它不改變模式。關閉 Tour 則明確轉回 `previousMode`，若 previous mode 不可用則回 Overview。

## 5. 輸入契約

所有輸入來源每幀寫入同一份 `InputState`：

```ts
interface InputState {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
  interact: boolean;
  jump: boolean;
  sprint: boolean;
  toggleMap: boolean;
  toggleTour: boolean;
}
```

Desktop adapter 將 WASD/方向鍵、滑鼠與 E/Space/Shift/M/T 映射到該結構。Mobile adapter 僅負責同樣的映射。Player controller 只讀 snapshot，不知道事件來自鍵盤或觸控。

## 6. 世界座標契約

- Three.js 世界：Y-up，公尺為邏輯單位。
- 會幕入口／東方定義為 `+Z`；至聖所／西方為 `-Z`。
- `locations.json` 是地點位置、朝向、邊界、map projection 的唯一資料來源。
- 模型自身的校正 rotation/scale 放在 asset manifest；安裝後轉成統一 world frame。
- `MapModeManager.worldToMap()` 與 `mapToWorld()` 使用同一個 bounds/config，禁止手寫百分比 pin。
- Tour stop 只引用 `locationId` 或 `objectId`，不自行保存另一套座標。

## 7. 核心 ports

- `SceneBootstrap`: 建立 renderer/scene/world root 並提供 start/stop/dispose。
- `CameraManager`: camera rig、pose、focus 與 walking/overview transitions。
- `InputManager`: adapter lifecycle、context、frame snapshot/edge consumption。
- `PlayerController`: `spawn/update/teleport/getPose/setEnabled/dispose`。
- `InteractionSystem`: candidate query、focus、trigger 與 interaction event。
- `ObjectRegistry`: 會幕物件定義及 runtime object handle。
- `CharacterRegistry`: 人物定義、角色 runtime handle 與 animation hooks。
- `RitualRegistry` / `RitualPlaybackController`: 儀式資料與播放狀態。
- `ScriptureRegistry` / `ScriptureMappingService`: reference 與 3D entity 雙向查詢。
- `TourManager`, `LearningModeManager`, `MapModeManager`: 各模式本身的狀態，不擁有全域模式。
- `AssetManifest`: 資產品質、授權、用途與載入選擇。

## 8. 資料與 schema

必要資料檔：

- `tabernacle.json`: 3D 物件、區域與內容語意。
- `characters.json`: Priest、High Priest、Levite/Helper 與 garment slots。
- `rituals.json`: 儀式步驟、觸發、信心等級、相關實體。
- `scriptures.json`: Bible passage 與 object/ritual/location/character links。
- `locations.json`: 世界座標、方位、bounds、spawn、map projection。

所有跨檔引用在測試中驗證；找不到的 ID 使 build pipeline 失敗。

## 9. 人物、儀式與經文

### 人物

Character role 必須包含 `Priest`、`HighPriest`、`LeviteHelper`。每個角色有 navigation、animation hooks、scripture references 與 garment slots。大祭司 slots 至少包括：`Ephod`、`Breastpiece`、`TurbanMiter`、`Robe`、`Tunic`、`GoldPlate`。

通用 Arab man、basic male、medieval tunic/outfit 只能作 technical base，不得宣稱為經歷史驗證的以色列祭司服飾。重建依據為出埃及記 28、29、39 章，並標示文字直接描述與視覺推定的差異。

### 儀式

每個儀式有 type、ordered steps、confidence、trigger、playback hooks、UI hooks，以及相關 object/character/location/scripture IDs。第一批命名儀式包括：祭司洗濯、燔祭、獻香、整理燈臺、陳設餅、贖罪日進入至聖所（教學重建）。

### 經文

經文資料以標準 reference ID 為主鍵。使用者可由經文查找 3D 物件／儀式／地點／人物，也可由任何 3D entity 回查所有相關經文。經文書卷至少預留 Exodus、Leviticus、Numbers、Hebrews。

## 10. 驗證策略

- TypeScript `strict` typecheck。
- Zod runtime schema tests。
- registry duplicate/missing ID tests。
- 模式狀態機 round-trip：Walking → 任一模式 → Walking。
- InputState edge/reset tests。
- Bible ↔ 3D 雙向映射 tests。
- world ↔ map round-trip tests。
- asset manifest license/source/runtime file tests。
- module boundary script。
- Vite production build。
- 實際啟動本機 server 並以 Browser 驗證 skeleton 畫面與 console。

## 11. 備份與可還原性

重建前完整備份：

`C:\Obsidian\Hermes\scripture\appendix\website\出埃及記\第25章_backup_20260811_132842`

驗證結果：來源與備份均為 5,988 個檔案、557,081,708 bytes；檔案數及總位元組完全一致。舊 runtime 僅存在於該可還原備份，不會被複製到新架構。
