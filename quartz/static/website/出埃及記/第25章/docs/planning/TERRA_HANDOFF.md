# Terra Handoff — Core 3D Runtime

完成日期：2026-08-11  
狀態：PASS，交接 Sol 視覺／玩法整合前的高風險複核。

## 實作完成項目

- `DeferredAssetLoader` 已替換為真實 `GLTFAssetLoader`：stream progress、parse、in-flight/completed cache、AbortSignal cancellation、error state、validation、unload/dispose。
- `AssetRuntimeManager` 將 profile/load policy 與 Three mount 分離；components 只經 `AppPort` 取得狀態或提出請求。
- 實際載入 `tabernacle-main` 作 desktop hero；framework、六個 detail、manual lowpoly 各按 manifest policy 操作。
- 實作 source-to-world 校正、bounds、camera bounds target、location anchors；修正 east +Z / most-holy -Z 及 map projection 的舊反轉。
- 東門 spawn 的 yaw 改為 `0`，並使 PlayerController 的 WASD 遵循 yaw；W 從東門朝 `-Z` 進入會幕。
- 增加 3D loading/error UI port，沒有讓 UI 直接碰 Three scene。

## 實際 transforms / bounds

詳細數值在 [`WORLD_ALIGNMENT.md`](../architecture/WORLD_ALIGNMENT.md)。關鍵值：hero 為 Y `-90°`、scale `0.3`，world Z `[-20.031,+20.031]`；framework 為 rotation `0°`、scale `0.5`，world Z `[-8.506,+7.681]`。profiles 將兩者互斥安裝，不會重疊。

## Asset load plan

| profile | direct load | detail | prohibitions |
| --- | --- | --- | --- |
| `desktop-high` | `tabernacle-main` | none by default | no framework/lowpoly |
| `desktop-structural` | `tabernacle-framework` | six on-demand assets | no hero overlap |
| `fallback-low` | `tabernacle-lowpoly` | none | explicit user choice only |

人物、服飾、動物 library 保持 deferred；兩個大祭司和 goat reference-only asset 不可載入。

## 已知效能資料

- 初始 hero GLB：10,394,200 bytes，inventory 為 243,535 triangles / 137,945 vertices。
- Framework GLB：5,078,284 bytes；僅 structural profile。
- Lowpoly GLB：3,026,208 bytes；僅 manual fallback。
- Detail 不在 initial plan；避免啟動時併入六個獨立器具的 payload/VRAM。
- renderer 使用 pixel ratio 上限 2、PCF soft shadows；需要後續實機 GPU telemetry 才能設定 performance budget。

## Browser 驗證

測試 URL：`http://127.0.0.1:3002/`

- Hero：PASS，Browser 狀態為 `3D ready · 已載入：tabernacle-main`，主會幕實際可見。
- Structural：PASS，切換後狀態只列 `tabernacle-framework`；hero 已卸載，沒有錯誤重疊。
- Detail：PASS，在 structural profile 點選約櫃後狀態列出 framework + ark；其餘 five detail 共用相同 on-demand path。
- Fallback：PASS，點選「低模備援」後狀態只列 `tabernacle-lowpoly`。
- Error：PASS，dev-only `?assetFailure=tabernacle-main` 顯示清楚失敗訊息與「明確選擇低模備援」提示，不自動降階。
- Console/runtime：PASS，主／framework／detail／fallback 載入期間沒有 runtime error UI 或 Vite server error；DOM loading state 全程可見。

## 尚未解決的視覺問題／Sol 高風險複核

- Lowpoly asset 的 source bounds 與 hero 顯著不同，且屬明確備援；Sol 不可把它作為 Tour、地圖、美術或碰撞基準。
- Framework 是結構研究模型，與 hero 的 exact mesh hierarchy 不同；切換時雖已互斥，但 Sol 在做 cutaway/camera UX 前仍應再看實景鏡頭。
- Hero 內建器具與 detail model 都是重建資產；detail 必須持續只在 structural/inspection flow 使用，不能與 hero 同時常駐。
- 尚未建立 navmesh/collision、完整 Tour/Learning/Map UX 或人物／儀式動畫；這些不屬 Terra 本階段。
- addition_info 的人物、布幕、煙霧、飾紋只作氛圍研究，不可升格為歷史事實。

## 驗證結果

```text
npm run typecheck          PASS
npm run test               PASS — 11 files, 24 tests
npm run verify             PASS — 11 files, 24 tests; architecture 59 modules; 17 assets
npm run build              PASS — Vite production build, 58 modules transformed
Browser / HTTP 200         PASS on Vite dev server
```
