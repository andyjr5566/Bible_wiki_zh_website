# 高品質資產策略

更新日期：2026-08-11  
授權範圍：非商業使用

## 1. 品質方向

Desktop 是主要目標。主體驗預設載入高品質完整會幕，並視使用情境串流獨立器具、人物與儀式資產。約 3k triangles 的 `tabernacle-lowpoly.glb` 僅是使用者明確選擇或裝置失敗時的 fallback，不是構圖、方位、碰撞、導覽或美術品質的基準。

品質層級：

1. `hero`：完整主會幕與主要環境；desktop 預設。
2. `detail`：約櫃、壇、桌、燈臺、洗濯盆等獨立細節；按區域或互動串流。
3. `structural`：框架/剖面模式專用；不與主模型重疊常駐。
4. `library`：人物基底、服飾 geometry、動物；需完成適配才可進 runtime。
5. `fallback`：低模完整會幕；只有明確性能策略觸發。
6. `reference-only`：不可下載或未確認相容授權，只可供視覺研究。

## 2. 資產生命週期

```text
live source page
  → verify download + author + current license
  → assets/source/<provider>/<slug>/
  → immutable provenance record
  → assets/processed/<provider>/<slug>/
  → validation / transforms / texture policy
  → public/models|textures|audio|fonts
  → public manifest
  → runtime selection plan
```

規則：

- 每次下載都重新檢查 live page，不依賴過去文字中的授權印象。
- 記錄 author、source URL、license、download date、hash。
- 原始檔不直接由網站 runtime 載入。
- processed 檔保留處理命令或文字紀錄。
- public 只放部署必需檔案。
- `docs/ASSETS.md` 保留人可閱讀署名；manifest 保留機器可驗證 metadata。
- 禁止移除 CC BY / CC BY-NC attribution。

## 3. 已保留的 runtime 候選

### Hero / structural / fallback

| ID | 檔案 | 角色 | 授權 | runtime 規則 |
|---|---|---|---|---|
| tabernacle-main | `tabernacle-main.glb` | 高品質完整會幕 | CC BY-NC | desktop default hero |
| tabernacle-framework | `tabernacle-framework.glb` | 框架／剖面 | CC BY-NC | structural mode 才載入 |
| tabernacle-lowpoly | `tabernacle-lowpoly.glb` | 低模完整會幕 | CC BY | reserved fallback only |

### Detail

已下載的約櫃、燔祭壇、陳設餅桌、香壇、金燈臺、洗濯盆與十誡法版保留。它們不在 architecture skeleton 一開始全部常駐；由 `AssetManifest` 依地點、選取及儀式需求建立 load plan。

### Library

Arab Man rig、Basic Human Male、Medieval Peasant Outfit、medieval tunic、sheep、cow 與 bull 是 library assets。通用人物與中古服飾只可作 topology/rig/geometry 起點，不是經歷史驗證的祭司造型。

Goat 仍列為待處理資產；在 live page 授權與下載狀態重新確認前不得加入 runtime manifest。

## 4. Reference-only

以下模型只作視覺研究，除非 live page 明確提供下載與相容授權：

- Israelite High Priest — 研究以弗得、胸牌、十二寶石、肩帶、藍袍、冠冕與金牌。
- High Priest / bibel-in-3d.de — 研究 Aaron/high-priest/ephod 視覺語彙。

聖經文字的 source of truth 是出埃及記 28、29、39 章。reference model 不能取代文本，也不能在沒有權利的情況下下載、重製或散布。

## 5. Manifest v2 契約

每個 entry 至少包含：

- `id`, `kind`, `qualityTier`, `runtimePolicy`。
- `url`, `sourceFile`, `processedFile`。
- `author`, `sourceUrl`, `license`, `commercialUse`, `downloadDate`, `sha256`。
- `transform`（position/rotation/scale）及統一世界方位註記。
- `usage`（world/detail/structural/library/fallback/reference）。
- `historicalStatus`（textual/reconstructed/technical-base/not-applicable）。
- `attribution`。

Loader 不自行猜測 mobile/desktop。`AssetManifest.createLoadPlan(profile)` 根據明確的 profile 決定：

- `desktop-high`：hero + 當前需要的 detail。
- `desktop-structural`：framework + 需要的 detail。
- `fallback-low`：lowpoly；不自動因 user-agent 觸發。

## 6. 高品質 WebGL 實作準則

- 保留主模型階層與 mesh names，方便定位與互動；未驗證前不 flatten/join。
- 使用 KTX2/Basis 與 Meshopt/Draco 需有明確 decode 與畫質比較，不以檔案最小為唯一目標。
- Hero texture 允許 2K–4K；細節器具依螢幕佔比決定，不全域硬壓成同一尺寸。
- 以 streaming、preload hints、GPU memory budget 和 reversible LOD 控制效能。
- 陰影只由必要 mesh 投射；高品質 profile 仍需 frame budget telemetry。
- 角色和服飾在進 runtime 前要完成 rig/animation/scale/grounding 檢查。
- 所有模型要通過 orientation、unit scale、bounding box、materials、missing textures、animations 與 attribution 檢查。

## 7. 方位與校正

目前 manifest 中主模型帶有 `-90° Y` 校正，而 framework 使用零旋轉；這是舊版地圖與場景方位不一致的高風險來源。新 pipeline 要先以參考圖和入口方位建立 canonical frame，再為每個資產儲存 `sourceToWorld` transform。

驗收基準：

- 東門為 `+Z`，至聖所為 `-Z`。
- 主模型、framework、獨立器具、locations 及 map projection 共用該 frame。
- 校正以測試 fixture 與 reference screenshot 記錄，不靠 UI pin 人工補償。

## 8. 授權與非商業限制

主模型與多數會幕器具是 CC BY-NC，因此此專案與其部署版本標示為「非商業使用」。CC BY 資產仍需署名。若未來要商業化，必須先替換所有 NC 資產或取得另行授權，不能只改網站文字。

每次 build 的 asset verification 應拒絕：

- 缺 author/source/license/downloadDate/hash 的 runtime entry。
- `commercialUse: true` 卻引用 NC 資產。
- public model 檔不存在。
- fallback 被設定為 desktop default。
- reference-only 資產出現在 runtime load plan。
