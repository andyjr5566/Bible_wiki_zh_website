# Blender 改善任務與 Luna 交接

建立日期：2026-09-09。專案根目錄：`C:\Obsidian\Hermes\scripture\appendix\website\出埃及記\第25章`。以下相對路徑均以此為根。

本批目標是完成一件既有器具的視覺改善，交付可編輯 Blender 檔、可重現處理腳本、網站用模型及瀏覽器比較證據。預設先評估約櫃的既有 detail asset；先確認實際缺點再修改，已有正確細節保留。其他器具、人物、儀式動畫與整站重建留待後續批次。

## 模型分工與交接方式

GPT-6 Astra 已建立本文件；使用者接著手動切換至 GPT-5.6 Luna，讓 Luna 循序完成 T0–T5，再切回 GPT-6 Astra 執行 T6。這份文件是交接依據，不依賴模型記得先前對話。此輪未啟動任何 Luna 子代理，也未測試 Luna 的實際模型呼叫；不得將工具列提供該模型等同於已成功執行。

前一輪對話已成功呼叫 Blender MCP `get_scene_info`，當時場景只有 Cube、Light、Camera。Luna 接手時仍須重新確認連線及當前場景。所有 Blender 修改循序執行；若日後使用代理，只能有一個場景寫入者。Luna 負責實作與自驗；GPT-6 負責整合審查及最終驗收。

## 已確認的專案基線

磁碟上的 `package.json` 使用 Vite、strict TypeScript、Three.js、Zod 與 Vitest。現行入口依 `docs/QA_FINAL.md`、`docs/planning/SOL_COMPLETION_AUDIT.md` 為「場景總覽、五站導覽、器物與經文」，相機使用 OrbitControls。README 與早期完成紀錄有較舊的 skeleton／Walking／Map 描述，不能據此重建已移除功能。

vexp 索引曾回傳 `src/scene/TabernacleScene.js`，但 2026-09-09 定向磁碟檢查確認該檔不存在。程式導航仍先使用 `run_pipeline`，再核對目標檔案現況；不得恢復舊 JavaScript 場景。索引與磁碟不符時如實記錄，必要時回報工具問題。

已確認存在且讀取過的工程入口：

- `src/systems/assets/AssetManifest.ts`：選擇 profile 的載入清單。
- `src/systems/assets/AssetLoader.ts`：GLTF 載入、進度及診斷契約。
- `src/systems/assets/AssetRuntimeManager.ts`：profile/detail 掛載、切換及材質狀態。
- `src/data/loadProjectData.ts`：讀取 `src/data/assets.json` 等正式網站資料並驗證 schema。
- `scripts/verify-assets.mjs`：比較 typed/public manifests、三層資產檔案及來源 hash。
- `package.json`：`build` 已包含完整 `verify`，不必在最終 build 前再重跑一遍相同 verify。

上述閱讀只供規劃。本次未重跑 build、未開啟網站做視覺驗收、未檢查約櫃模型細節；舊 QA 的 PASS 數字不得當成本批結果。

## 工作邊界

遵守根目錄 `AGENTS.md`，並在修改子目錄前確認適用的局部指示。工程僅限本網站的資產、必要整合程式與交接紀錄。研經正文、正式經文、`link_folder/`、`raw_data/`、章節 `.tmp/` payload 維持內容工作流；本批不得順手改寫其語意。

採用清楚、克制的博物館教學模型方向。器具的尺寸、構造依正式來源；需核對經文時使用 `raw_scripture/`，註釋依章節 manifest 指定來源。既有 `reconstructed` 等標示與來源歸屬必須保留。未確定的造型只能作有標示的視覺重建；會改變經文主張的問題標記 `unresolved`，回報總控。

沿用 `docs/ASSET_STRATEGY.md` 的高品質桌面預設、detail 按需載入、framework 互斥與手動 fallback 政策。保留作者、來源及 CC BY／CC BY-NC 授權，不把修改後的模型宣稱為完全原創。保存來源原檔，衍生結果另存 processed 層；public 只放部署需要的產物。此批不發佈網站。

## 相依順序與狀態

`T0 → T1 → T2 → T3 → T4 → T5 → T6`

| 任務 | 負責模型 | 狀態 |
| --- | --- | --- |
| T0 環境與現況確認 | Luna | 完成 |
| T1 單件器具規格與基準 | Luna | 完成 |
| T2 Blender 修改與可重現腳本 | Luna | 完成 |
| T3 匯出與資產登記 | Luna | 完成 |
| T4 網站整合與功能回歸 | Luna | 完成 |
| T5 建置、視覺與效能自驗 | Luna | 待總控驗收 |
| T6 整合審查及最終驗收 | GPT-6 Astra | 待辦 |

狀態使用「待辦／進行中／完成／受阻／待總控驗收」。每完成一項便更新狀態及證據位置。單項受阻時記錄原因，繼續不依賴該項的工作；不得用假資料通過下一關。

## T0 — 環境與現況確認

範圍：只讀檢查工作樹、必要工具與網站現況，不修改 Blender 場景。輸入為本文件、根 AGENTS、現行 QA／架構／資產策略及 package scripts。

交付：新建 `docs/planning/BLENDER_LUNA_PROGRESS.md`，記錄起始 git 狀態、實際模型資訊（若介面提供）、Node/npm 版本、Blender MCP 連線結果、瀏覽器工具可用性及適用文件。無法自行辨識模型時明寫限制，不假稱已確認。執行 `npm run verify` 留存本次基準；依 lockfile 與既有安裝狀態處理依賴。

驗收：Blender 能讀取場景；網站可在本機啟動；基準驗證結果有命令與 exit code。既有失敗須與本批問題分開記錄。工具缺少時指出缺少項目及受影響任務。2026-09-09 起始根工作樹已有 AGENTS.md 修改及約書亞記第10章未追蹤產物，接手時重新確認並保留。

## T1 — 單件器具規格與基準

相依：T0。範圍：定位既有約櫃 detail asset，確認它在網站中的顯示方式，選出 1–3 個有比較證據的視覺改善點。輸入為 typed/public manifest、`docs/ASSETS.md`、既有 source/processed 模型及正式來源。

交付：在進度文件寫入精確 asset ID、來源／processed／runtime 路徑、作者與授權、節點名稱、尺寸與單位、現行 source-to-world transform。補上同一鏡位的修改前網頁截圖及改善規格；列出保留構造、允許調整的材質／幾何和未知事項。建議以倒角、可辨識的材質差異與近看輪廓作評估方向，具體項目由實景決定。

驗收：每個擬改項目有明確可見問題與預期結果；涉及史實者有正式來源位置。定義本件資產的大小、三角面數、貼圖與實測效能比較方式，於修改前記錄門檻。預設以同設備同鏡位三次量測的中位數比較，載入耗時及 frame time 增幅不超過 10%；若量測工具不足，標示未驗證並交 T6 決定。約櫃沒有值得修改的問題或來源不足時，回報證據及替代候選，不為交付而重做。

## T2 — Blender 修改與可重現腳本

相依：T1。範圍：只處理已選器具及其材質；在獨立工作檔／collection 操作，保留使用者原場景。輸入為 T1 規格和來源模型，不直接覆寫來源。

交付：在既有 processed 資產目錄中另存本批 `.blend`，於 `scripts/blender/` 保存本件器具的 Python 製作／處理腳本與執行說明；修改前先確認該路徑的局部指示。腳本使用明確輸入／輸出，重跑不重複累加物件。保存 Blender 正面、側面與近景比較圖。

驗收：規格中的改善可辨識；來源確定的尺寸與構造保留；節點命名、原點、尺度可供網站使用。重新開啟 .blend 後貼圖完整，腳本可在獨立場景重現結果。每次 MCP 程式呼叫分成可檢查的小步驟。新來源或架構衝突回報總控。

## T3 — 匯出與資產登記

相依：T2。範圍：匯出 GLB、核對材質、更新同一資產的衍生路徑與處理記錄。輸入為 .blend、腳本、既有 manifest 與資產 verifier。

交付：processed GLB、public runtime GLB／必要貼圖，並同步 `src/data/assets.json`、`public/models/manifest.json` 及 `docs/ASSETS.md` 中受影響欄位。沿用既有 ID，保留原來源歸屬。記錄產物大小、面數、材質數、貼圖數及處理命令；可另記衍生檔 hash。

驗收：GLB 可重新匯入，沒有遺失貼圖、尺度／軸向偏差或必需零件消失。`npm run verify:assets` exit 0。特別注意現行 `sha256` 驗證的是 sourceFile，不能填入修改後 GLB 的 hash。不得修改 verifier 或放寬 schema 來掩蓋不符；真實契約缺陷回報總控。

## T4 — 網站整合與功能回歸

相依：T3。範圍：將本件改善資產接入既有 detail 載入機制，必要時點狀調整 bounds／鏡位／節點對應。輸入為 T3 資產、AssetRuntimeManager 及既有相機／資料契約；精確實作檔先經 vexp 定位並確認磁碟現況。

交付：可在網站選取並觀看的改善器具，及必要的最小程式差異。若需要修改程式，記錄修改原因與相關驗證；不另造 loader、全域狀態或舊 TabernacleScene。

驗收：器具方向與比例符合 Y-up、公尺、東門 +Z／至聖所 -Z 的既有契約；特寫無裁切；框架下單件特寫及返回恢復正常；hero/framework/fallback 政策保留。經文對應、其他器物、三入口及五站手動導覽均正常。重要載入或生命週期修改使用既有相關測試驗證，有新失敗情境才追加必要測試。

## T5 — 建置、視覺與效能自驗

相依：T4。範圍：完成本批實測並交回 GPT-6。輸入為整合後程式、T1 基準與 `docs/QA_FINAL.md` 的現行體驗契約。

交付：在網站根目錄執行 `npm run build`（包含 typecheck、test、architecture、assets），再以 `npm run preview -- --port 4173` 啟動 production preview；埠占用時換可用埠並記錄。依可用 Browser 技能操作頁面，保存桌面及 390×844 手機 viewport 截圖、瀏覽器錯誤、網路資產失敗數、T1 效能比較及變更檔案清單。手機 viewport 模擬不宣稱為真實手機 GPU 測試。

驗收：build exit 0、資產請求失敗 0、無新增 runtime errors。比較截圖固定鏡位、光線與 viewport，逐項說明 T1 改善是否達成；以網頁結果驗收材質。驗證三入口往返、五站手動導覽、器具切換、框架特寫及手機控制層展收。效能門檻未達成時修正或明列未解決事項，不宣稱完全通過。完成後標為「待總控驗收」，停止擴充其他器具。

## T6 — GPT-6 整合審查及最終驗收

相依：T5；由使用者切回 GPT-6 後執行。範圍：核對變更、來源／授權、資產契約、比較證據與未解決問題。輸入為本文件、進度文件、git diff、Blender／網頁產物及檢查紀錄。

交付：GPT-6 在進度文件記錄驗收結論、必要修正與下一批建議。審查實際檔案和網站，必要時修正工程整合；若需 Luna 返工，寫出精確任務及受影響驗收。沒有新變更或未解疑慮時，不重複整套已通過測試。

驗收：T1–T5 的交付可追溯、可重現且實景改善成立；沒有跨入研經正文改寫；本批適用檢查全部通過、來源或契約問題已解決。尚未驗證事項明確保留。此時才可標示本批完成；提交須符合根 AGENTS 的適用 gates，本文件本身不執行部署。

## Luna 接手用提示詞

> 請讀取 `appendix/website/出埃及記/第25章/docs/planning/BLENDER_LUNA_TASKS.md`，依 T0–T5 循序實作。每項完成後更新任務狀態及進度文件，持續完成本批一件器具的交付。Blender 只有你一個寫入者。來源不明或架構衝突請記錄 unresolved 並回報總控；一般可逆工程決策自行處理。完成自驗後交回 GPT-6 執行 T6。

## GPT-6 收回用提示詞

> 請讀取 `appendix/website/出埃及記/第25章/docs/planning/BLENDER_LUNA_TASKS.md` 與 `BLENDER_LUNA_PROGRESS.md`，執行 T6。核對實際 diff、資產與來源記錄、建置及網頁比較證據，完成整合驗收並如實列出剩餘問題。
