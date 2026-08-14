# 最終 QA

執行日期：2026-08-11  
測試網站：`http://127.0.0.1:3001/`（dev）、`http://127.0.0.1:4173/`（production preview）

## 目前體驗契約

- 走路、WASD、pointer lock、碰撞、玩家座標與地圖入口已從 App runtime 移除。
- 使用者只有三個主入口：場景總覽、五站導覽、器物與經文。
- 3D 畫面使用受限 Orbit controls：左鍵拖曳旋轉、滾輪縮放；平移與游標中心縮放已停用，避免場景被拖離畫面。
- 再按目前所在的主頁籤會重設該模式視角；五站導覽只由使用者按上一站／下一站推進，不再自動跳站。
- 介面只在狀態真的改變時更新，避免按鈕在點擊期間被週期性重建；手機版採用可上下收合的底部資訊層，使用者可自行選擇全景或半景，詳細說明與經文按需展開。
- 首頁直接提供快速操作說明與兩個主要行動，不要求使用者先理解「模式」概念。

## 自動驗證

| Command | 結果 |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run test` | PASS：15 files／29 tests |
| `npm run verify:architecture` | PASS：70 TypeScript modules |
| `npm run verify:assets` | PASS：17 assets／三層檔案 |
| `npm run build` | PASS：58 Vite modules transformed |

## In-app Browser 實測

| 測試 | 實際結果 |
| --- | --- |
| 首頁理解 | PASS；首屏可直接讀到「拖曳畫面，就能環視會幕」、拖曳／滾輪／選器物三步與兩個主要入口。 |
| 走路移除 | PASS；可見 DOM 沒有走路、WASD、E、玩家座標或地圖入口。 |
| 主導覽 | PASS；只有場景總覽、五站導覽、器物與經文三個入口。 |
| 五站導覽 | PASS；五個按鈕依序顯示東門、燔祭壇、洗濯盆、香壇、約櫃；第 1 站上一站停用，第 5 站下一站停用，不再首尾循環或自動跳站。 |
| 特別視角 | PASS；燔祭壇、洗濯盆、香壇、金燈臺、陳設餅桌與約櫃六個按鈕均對到器物；燈臺／餅桌改依實際 GLB 節點座標，約櫃改由未遮擋側取景。 |
| 框架器物特寫 | PASS；框架剖面下選器物會暫時隱藏框架，只保留單一 detail asset 並按實際 bounds 構圖；回總覽／導覽後框架恢復。 |
| 室內透視 | PASS；器物與經文模式會將會幕帷幕、罩棚、院幔與支架降至近乎透明（保留極淡輪廓），約櫃／燈臺等內部器物保持清晰；離開學習模式後外觀恢復。 |
| 器物預設 | PASS；首次進入器物與經文時選取燔祭壇，符合由外向內的空間順序。 |
| 多重經文 | PASS；燔祭壇 6、洗濯盆 4、香壇 6、金燈臺 6、陳設餅桌 5、約櫃 9 則可見註解；每則可再展開對應和合本（UNV）原文。 |
| 註解層次 | PASS；每則標示製作指示／實作記錄／空間配置／事奉規範／後世回顧之一；介面不再顯示「閱讀線上經文」。 |
| 模式返回 | PASS；總覽 → 導覽 → 器物與經文 → 總覽可完成，首頁內容恢復。 |
| Runtime diagnostics | PASS；production errors `0`、warnings `0`。 |
| 手機 390×844 | PASS；預設顯示「↑ 展開控制」並保留完整全景；點擊後顯示半景控制層，再點「↓ 收合控制」回到全景；器物說明／經文按需展開且可捲動。 |

## Production payload

```text
dist/index.html                      0.47 kB  gzip 0.37 kB
dist/assets/index-*.css             13.81 kB  gzip 4.09 kB
dist/assets/index-*.js              14.85 kB  gzip 6.72 kB
dist/assets/AppKernel-*.js         695.78 kB  gzip 181.56 kB
```

AppKernel chunk 保持 dynamic import；Three.js、OrbitControls 與 GLTF loader 位於 deferred 3D chunk。Vite 的 500 kB 提示仍是已記錄的效能警告，不影響 build。

經文註解來源、摘要規則與線上核對記錄見 `docs/SCRIPTURE_RESEARCH.md`。
