# Luna Handoff — Asset/Data Preparation

完成日期：2026-08-11  
狀態：PASS，交接 Terra

## 完成項目

- 讀取並依照 `ARCHITECTURE.md`、`REBUILD_PLAN.md`、`ASSET_STRATEGY.md`、`ASSETS.md`、`REFERENCE_MATERIAL.md`、`COMPLETION_AUDIT.md` 執行。
- 盤點 `assets/source`、`assets/processed`、`public/models`、`assets/references` 與 `docs/addition_info`。
- 確認 17 個已下載 GLB 存在於 source → processed → public 三層。
- 將 `src/data/assets.json` 更新為 version 2 typed manifest，共 17 筆，包含：id、author、sourceUrl、license、licenseUrl、downloadAvailable、downloadDate、SHA-256、triangle/vertex statistics、source/processed/runtime paths、quality tier、runtime policy、usage、historical status、transform 與 attribution。
- 保持 `public/models/manifest.json` 17 筆，並用 verifier 逐欄對照 typed manifest。
- 將 hero、structural、detail、library、fallback 分層固定。
- 將 `tabernacle-main` 設為唯一 desktop default hero。
- 將 `tabernacle-framework` 設為 structural/mode-only。
- 將 `tabernacle-lowpoly` 設為 manual-fallback，禁止 default。
- 將約櫃、燔祭壇、陳設餅桌、香壇、金燈臺、洗濯盆設為 detail/on-demand。
- 將法版、人物 base、服飾 base、sheep、cow、bull 設為 library/deferred。
- 對三個 reference-only／不可下載模型維持不下載、不處理、不加入 manifest。
- 沒有刪除或重新壓縮任何 source GLB。

## Live 複核結果

Sketchfab metadata API 在 2026-08-11 回傳 17 個已下載模型 `isDownloadable: true`。9 個會幕核心／細節與法版是 CC BY-NC；lowpoly、角色／服飾／動物 library 是 CC BY。Israelite High Priest、High priest / bibel-in-3d.de 與 Animated Goat 回傳 `isDownloadable: false` 且沒有可採用 license。

詳細結果在 [`docs/assets/LICENSE_AUDIT.md`](../assets/LICENSE_AUDIT.md)。

## Terra 可直接使用的 runtime assets

- Desktop hero：`tabernacle-main`
- Structural：`tabernacle-framework`
- Detail on-demand：`tabernacle-ark-alternative`、`tabernacle-burnt-altar-detail`、`tabernacle-table-shewbread-detail`、`tabernacle-incense-altar-detail`、`tabernacle-menorah-detail`、`tabernacle-laver-detail`
- Explicit fallback：`tabernacle-lowpoly`
- Deferred library：`tabernacle-law-tablets-library`、`priest-arab-man-library`、`priest-basic-human-library`、`priest-medieval-outfit-library`、`priest-tunic-library`、`sheep-library`、`cow-npc-library`、`bull-library`

所有 entry 的完整 path、hash 與 transform 在 `src/data/assets.json`。

## Terra 不可使用的 reference-only assets

- Israelite High Priest — `ca5c48e66e0249308a02bba19f9e2666`
- High priest / bibel-in-3d.de — `173a94b82478415bb56124e137dfa30c`
- Animated Goat: 2 Texture Variants — `9a5ce2b438304b46854d34d5cab25b70`

除非未來 live page 明確提供相容 license 與 download permission，否則不得下載、轉檔、散布或載入。

## 未確認／待 Terra 處理事項

- GLB 的真實 runtime loading、streaming、dispose 與 detail on-demand 尚未在此階段實作。
- 主模型與 framework 的 `sourceToWorld` 校正仍由 Terra 以 canonical frame 驗證；本 manifest transform 是目前已記錄的處理 transform，不是視覺驗收的替代品。
- 角色服飾尚未依出埃及記 28、29、39 章建立歷史重建 mesh；library asset 只可作 technical base。
- Cow 的動畫是否適合 runtime 需由下載檔案與 loader 再驗證。
- CC BY-NC Credits UI 尚未在此階段加入新 runtime shell。

## 驗證命令與結果

```text
npm run typecheck       PASS
npm run verify:assets   PASS — 17 assets across source, processed, runtime layers
npm run test            PASS — existing test suite
npm run build           PASS — verify、Vite production build；僅有 Three.js bundle >500 kB 的既知 warning
```

## 交接驗收

- [x] 所有 runtime asset ID 唯一。
- [x] 所有 public asset 檔案存在。
- [x] 所有 source/processed/runtime path 存在。
- [x] 所有 source SHA-256 通過。
- [x] typed/public manifest 逐欄一致。
- [x] Hero 是唯一 desktop default。
- [x] Framework 是 structural/mode-only。
- [x] Lowpoly 只能 manual fallback。
- [x] Reference-only 不在任何 manifest。
- [x] live author/license/download 狀態已記錄。
- [x] 非商業限制已記錄。
