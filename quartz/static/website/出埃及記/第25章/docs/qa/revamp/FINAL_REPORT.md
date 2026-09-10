# R24 最終驗收：NEEDS_CHANGES

日期：2026-09-10（Asia/Taipei）。執行者：GPT-6 Astra 總控驗收代理；基準 `685da044`，分支 `feat/appendix-exodus25-revamp`。R24 已完成本輪審計，**整站未通過總控驗收，也未發布**。以下結論優先於後方保留的 R23 自驗歷史。

建置與磁碟一致性通過，但仍有來源語意錯置、五祭流程缺失、角色／衣裝未接入場景、跨模式播放殘留、部件映射缺漏。R23 的 PASS 不能代表這些 R24 要求已完成。精確檔案、重現路徑、正式經節、修正範圍與完成條件見 [R24 返工卡](R24_REWORK.md)。本輪沒有委派 Luna、修改網站程式或寫入 Blender；這些卡尚待實作與復驗。

## 本輪實測結果

- [build](r24-build.log)：`npm run build` exit 0，21 個測試檔／65 個測試、architecture 104 modules、assets 17，Vite build 成功。大 chunk 警告仍存在；PowerShell 將該 stderr 記成 NativeCommandError，程序實際 exit 0。
- [derived](r24-derived.log)：`npm run verify:derived` exit 0。僅 generatedAt 變動的兩份 sidecar 已還原，沒有混入網站修改。
- [靜態審計](r24-static-audit.json)：17 件 source 宣告符合；processed／public／dist GLB hash 全相同；27 筆正式經文來源臺帳 hash 不一致 0；9 段重新抽取經文忽略 generatedAt 後完全相同；dist 禁止檔案 0。這是機械 PASS，不能替代程序轉述語意審查。
- 真 Browser 經中文 `/驗收/` 路徑重載；六器物依序 ready，DOM 每次 selectedAsset 各異、activeAssetCount=2、profile=desktop-structural、正常 runtime errors／warnings=0。15 筆成功模型回應（9 種資源，含六 detail）的 SHA-256 全與 dist 相符。見 [ready](r24-detail-ready.json)、[HTTP 回應](r24-http-responses.jsonl)。缺少完整 activeAssetIds 與相機/FOV，且退出未還原，QA02 仍 FAIL。
- HTTP500 注入 hero／detail：明確選擇低模備援後 ready；燔祭壇 detail 失敗後改選約櫃 ready；文字仍可讀。這是故障子案例通過，不是 QA16 全通過。見 [故障](r24-fault-evidence.json)。
- 五站逐站 DOM 與來源覆層可用；Escape 關閉來源覆層後焦點回到「資料來源」。見 [五站](r24-tour-evidence.json)、[來源／鍵盤](r24-source-keyboard-evidence.json)。

## R24 QA01–QA18 判定

判定單位是完整 QA 規格；只完成其中子案例時，不標整項 PASS。共 **FAIL 8、UNVERIFIED 10、完整 QA PASS 0**。這不否認上方已通過的機械與操作子案例。

| ID | R24 狀態 | 證據、問題與下一步 |
| --- | --- | --- |
| QA01 啟動 | UNVERIFIED | [中文重載](r24-nested-startup.json) 與五入口可用、正常載入無錯；未完成完整冷啟動 cache／所有入口返回矩陣及正式主機配置。 |
| QA02 真 detail | FAIL | 六 GLB 真回應 hash 已補；[返回總覽](r24-detail-evidence.json) 仍 structural+ark、2資產，未恢復原 profile。完整 active IDs／camera 證據不足。P1-04、05。 |
| QA03 競態 | UNVERIFIED | 本輪 controlled promise 測試隨 build 通過；未做 A 延遲/B 先到的真實網路矩陣。HTTP500 不是競態注入。P1-07。 |
| QA04 空間／剖面 | FAIL | 17 可點部件中11缺映射、4 unresolved、2 verified；shell 尚有名稱猜測，十次完整恢復未驗。P1-05。 |
| QA05 取景 | UNVERIFIED | [手機矩形](r24-mobile-evidence.json) 已記，安全區算法有缺口；缺六器物各鏡位/FOV/本體與槓邊界，過渡截圖不能作充分裁切判定。P1-05。 |
| QA06 來源 | FAIL | 核准臺帳與 runtime 比較來源未接通、衣裝／動作具體來源入口不足，且程序已有語意錯置。P0-01、P1-06。 |
| QA07 經文 | UNVERIFIED | 9 段再抽取全量一致，27來源 hash 全符；未完整重做越界負例及多段／逐節閱讀操作矩陣。 |
| QA08 洗濯／香 | FAIL | 有洗濯與日常香步驟 DOM；幔內香仍綁聖所香壇位置與共用 cue，角色／區域未實作同步。P0-01、P1-02、04。 |
| QA09 燈／餅 | FAIL | 燈油供應者被錯標未詳；餅步驟漏乳香；七燈／十二餅文字不等於全契約完成。P0-01、P1-02。 |
| QA10 燔祭／五祭 | FAIL | 四祭流程不存在，燔祭分工錯置；比較表和牛羊鳥播放完成不足以通過。P0-01、P1-03。 |
| QA11 贖罪日 | FAIL | 14步文字可走查，但香／換衣位置、彈血次數表述與實際角色狀態有缺口；壇識別 U-R24-01 unresolved。P0-01、P1-02。 |
| QA12 角色／服飾 | FAIL | 獻祭者步顯示供職祭司卡、無四職責完整入口；CharacterSystem 未綁 scene hooks。P1-02。 |
| QA13 五站／自動 | UNVERIFIED | 五站逐站 DOM 成功；未重做速度／拖動暫停／退出 context 全矩陣；相關跨模式殘留已在 QA02／08 判 FAIL。P1-04。 |
| QA14 手機／鍵盤 | UNVERIFIED | R24 三視口與 drawer 走查、來源 Escape 焦點成功；未全鍵盤、200% 字體及其餘兩視口完整核心路徑。P1-07。 |
| QA15 氣氛／效果 | UNVERIFIED | 未做固定照明標樣、reduced-motion 開關、音效與動畫暫停完整實測；不沿用 R23 美觀判定。P1-07。 |
| QA16 失敗恢復 | UNVERIFIED | 真 hero/detail HTTP500 及恢復成功；離線、WebGL 不可用／context loss 未實測，且啟動前錯誤處理有缺口。P1-07。 |
| QA17 效能／洩漏 | UNVERIFIED | 無三次60秒、20次往返與真手機資料；firstUsefulFrame 記錄點不符定義，需先修量測。P1-08。 |
| QA18 可重現交付 | UNVERIFIED | source／derived／dist／response 一致性成功；未空目錄重建 Blender 全鏈，完整部件交付仍有缺口。P1-05、08。 |

## 限制、未決與交付

完整環境、截圖可能落後 DOM、工具限制及復驗條件詳見 [R24_REWORK](R24_REWORK.md)。沒有真手機 GPU、GPU timer、精確20Mbps／50ms RTT或真人新讀者數據。U-R24-01 壇的識別維持 unresolved，不由總控猜測。原始過渡／失敗截圖保留，不能靠檔名認定步驟已驗。

本輪只提交 QA 文件、可重現審計工具與 receipts，保留所有無關工作樹與六個 `.blend1`。驗收證據 commit `d58fec76` 已成功 push 至 `origin/feat/appendix-exodus25-revamp`（exit 0）；實際結果見 [收尾回執](r24-handoff.json)，此狀態補記另作後續提交。下一步先處理 P0-01，再依 P1 卡落地並重做受影響驗收；任何歷史自驗不自動升格為總控透過。

---

# R23 Production 自驗與 GPT-6 交接報告（歷史保留）

日期：2026-09-10（Asia/Taipei）
基準：R22 commit `a29adc94`，分支 `feat/appendix-exodus25-revamp`
執行：R23 由已授權的 `gpt-5.6-luna` 子代理進行 Browser／QA 走查；目前 session（GPT-5）負責整合、修正證據格式與交接。這份報告不是 GPT-6 的最終核准。

## 交付判定

R23 已完成 production preview、資料／來源靜態核對、學習路徑 scripted check 與交接包。R23 自驗透過，交由 R24 GPT-6 做最終整合與來源審查。這一輪沒有修改 raw_scripture、source GLB 或 Blender 場景，也沒有把六個既有 `.blend1` 備份納入提交。

目前可直接重現的工程結果如下：

- `npm run build` exit 0；包含 typecheck、21 個測試檔／65 個測試、architecture 104 modules、assets 17 assets，以及 Vite production build。完整輸出見 [r23-build.log](r23-build.log)。產出的主要 chunk 為 `index-CnRS8X9a.js`、`AppKernel-DWu7LItq.js` 與 `index-CALFD7l9.css`。
- `npm run verify:derived` exit 0；17 個資產的 source 宣告、processed／runtime 成對雜湊與歸屬欄位通過。對應 sidecar 為 [r12-derived-assets.json](../../../assets/derived/r12-derived-assets.json) 與 [derived-manifest.json](../../../public/models/derived-manifest.json)。source GLB 與 derived GLB 的雜湊本來就代表不同檔案，不能要求兩者相等。
- production Browser 走查涵蓋 1920×1080、1440×900、768×1024、390×844、360×800；這些是排版與互動證據，不等同真實手機 GPU 效能證明。截圖在 [screenshots](screenshots/)；各項 JSON receipt 在本資料夾。
- Browser 走查記錄的 runtime errors／warnings 均為 0。R23 沒有宣稱 GPU timer、離線／HTTP 500、WebGL context loss、長時間記憶體穩定性或 200% 文字縮放已通過。

## QA01–QA18

| ID | 狀態 | 本輪證據與限制 |
| --- | --- | --- |
| QA01 啟動 | PASS（範圍限制） | production build／preview、五種 viewport 截圖與頁面 DOM 可用；中文巢狀路徑未另做一次冷啟動重載記錄。 |
| QA02 真 detail | UNVERIFIED | 六器物名稱與面板可見於 [r23-detail-evidence.json](r23-detail-evidence.json)，但本輪 receipt 沒有逐件保存 activeAssetIds、response 與 resource hash，不能只用標題宣稱六次真 GLB detail 載入。 |
| QA03 競態 | UNVERIFIED | R21 的 controlled promise／取消／重試測試仍通過；R23 沒有再做一次真實網路延遲與 profile 切換注入。 |
| QA04 空間與剖面 | UNVERIFIED | 平面圖、框架剖面與回到成品的畫面可見，但沒有本輪十次循環的 bounds／part hash receipt。 |
| QA05 取景 | UNVERIFIED | 有桌面、平板、手機截圖；沒有逐一保存六器物固定鏡位、FOV、canvas／drawer 矩形量測。 |
| QA06 來源 | PASS | 器物面板、來源 drawer 與限制文字見 [r23-source-evidence.json](r23-source-evidence.json)；未核准外部主張不進入已核准來源。 |
| QA07 經文 | PASS | [r23-excerpts.json](r23-excerpts.json) 的 9 段摘錄可回到 `raw_scripture`，內容比對忽略 generatedAt 後一致，並保留 source hash。 |
| QA08 洗濯／香 | PASS | [r23-washing-evidence.json](r23-washing-evidence.json) 與 [r23-incense-evidence.json](r23-incense-evidence.json) 記錄步驟、返回與 runtime 0；日常香壇與贖罪日幔內用香仍分開。 |
| QA09 燈／餅 | PASS | [r23-lamp-bread-evidence.json](r23-lamp-bread-evidence.json) 記錄燈臺 3 步、陳設餅 4 步，以及七盞燈、十二個餅、安息日替換與聖處食用。 |
| QA10 燔祭／五祭 | PASS（本輪範圍） | [r23-offering-branches-evidence.json](r23-offering-branches-evidence.json) 完成牛、羊、鳥分支；羊的壇北邊規則沒有套到牛／鳥。五祭比較沿用 R15 產物。 |
| QA11 贖罪日 | PASS（本輪範圍） | [r23-atonement-evidence.json](r23-atonement-evidence.json) 記錄 14/14 完成、會幕空置、曠野、麻衣／換衣狀態；不把「一年一次」縮成唯一可見步驟。 |
| QA12 角色／服飾 | UNVERIFIED | R11／R21 已有角色與衣裝資料及單元測試；R23 scripted check 未在同一可見入口找到普通祭司、獻祭者、大祭司、利未人的完整學習路徑，見 [r23-scripted-learning.json](r23-scripted-learning.json) 問題 3。 |
| QA13 五站／自動 | PASS | [r23-tour-evidence.json](r23-tour-evidence.json) 記錄東門、燔祭壇、洗濯盆、聖所、至聖所五站；[r23-cinematic-evidence.json](r23-cinematic-evidence.json) 記錄暫停、下一幕、退出且 runtime 0。 |
| QA14 手機／鍵盤 | UNVERIFIED | 本輪有四種窄／寬 viewport 與 drawer 截圖；R19 的 ARIA、Escape、44px、reduced-motion 實作仍在，R23 沒有重新完成 200% 文字、全鍵盤與完整螢幕閱讀器檢查。 |
| QA15 氣氛／效果 | UNVERIFIED | R09／R19 已建立 cue policy 與 reduced-motion 行為；R23 沒有在固定鏡位重做完整照明、聲音與動畫矩陣，因此不把截圖美觀當成效果 PASS。 |
| QA16 失敗恢復 | UNVERIFIED | R21 負例與重試單元測試通過；瀏覽器真實離線、HTTP 500、WebGL 不可用與 context loss 注入尚未完成。 |
| QA17 效能／洩漏 | UNVERIFIED | R20 的 [PERFORMANCE.md](PERFORMANCE.md) 與 JSON API 已可匯出 rAF／renderer 指標；尚未完成每個情境三次、每次 60 秒、GPU profiler 與 repeated load／unload 的實機量測。 |
| QA18 可重現交付 | UNVERIFIED | build、derived verification、source／dist 靜態審計與文件已可重現；本輪沒有從乾淨目錄重新執行 Blender recipe→GLB→manifest 全鏈，因此保留未驗證。 |

## 初學者 scripted learning check

本輪使用代理走查，沒有冒充真人新讀者。結果見 [r23-scripted-learning.json](r23-scripted-learning.json)：

| 問題 | 狀態 | 說明 |
| --- | --- | --- |
| 外院／聖所／至聖所 | PASS | 平面圖可區分三個空間。 |
| 約櫃材料與出25引用 | PASS | 器物面板可找到材料／經文入口。 |
| 四種角色職責 | UNVERIFIED | 沒有在同一可見學習路徑找到四者入口。 |
| 牛／羊／鳥分支 | PASS | 三個分支可走完並保留羊北側差異。 |
| 日常香與贖罪日用香 | UNVERIFIED | 資料已分流，但本次狀態切換逾時。 |
| 贖罪日完整路徑 | PASS | 14 步完成，含空房、曠野與換衣。 |
| 尺寸未詳與肘換算 | PASS | 燈臺／洗濯盆未詳尺寸與肘單位被標示。 |
| 考古比較限制 | PASS | 面板沒有把未核准考古主張說成器物事實。 |

## R00–R23 交付索引

以下索引把每張任務卡連到已落地的主要證據；R00–R22 的細節仍以 [REVAMP_PROGRESS.md](../../planning/REVAMP_PROGRESS.md) 回執為準。

| 任務 | 主要交付／證據 |
| --- | --- |
| R00 | [BASELINE.md](BASELINE.md)、[BASELINE_ASSETS.json](BASELINE_ASSETS.json) |
| R01 | [SOURCES.md](../../research/SOURCES.md)、[CLAIMS.md](../../research/CLAIMS.md) |
| R02 | [RITUAL_STEPS.md](../../research/RITUAL_STEPS.md)、[ROLE_ACCESS.md](../../research/ROLE_ACCESS.md)、[GARMENTS.md](../../research/GARMENTS.md) |
| R03 | typed data、[scripture-excerpts.json](../../../src/data/scripture-excerpts.json)、ProjectData 測試 |
| R04 | UIStateManager／ModeNavigation 與單一入口狀態 |
| R05 | AssetRuntimeManager detail 生命週期與取消 |
| R06 | CameraManager、DimensionVisualizer、part map |
| R07 | Blender recipe／隔離工作檔與 [Blender README](../../../scripts/blender/README.md) |
| R08 | 約櫃 parts、材料與來源限制 |
| R09 | [R09_LIGHTING_POLICY.md](../../research/R09_LIGHTING_POLICY.md) |
| R10 | 五件器物 detail register 與 Blender configs |
| R11 | 角色、服飾、牲畜資料與 CharacterAppearanceResolver |
| R12 | 17 件 GLB derived sidecar 與 verify script |
| R13 | RitualPlaybackController、洗濯／日常香 |
| R14 | 燈臺與陳設餅程序 |
| R15 | 燔祭分支與五祭比較 |
| R16 | 贖罪日 14 步路徑 |
| R17 | 五站導覽、聖所三熱點、自動導覽 controller |
| R18 | 器物／part／source drawer、外部 URL 安全處理 |
| R19 | 響應式 drawer、ARIA、Escape、焦點、reduced-motion |
| R20 | 隱藏效能診斷 API與 [PERFORMANCE.md](PERFORMANCE.md) |
| R21 | 跨檔資料完整性驗證、回歸測試與失敗重試測試 |
| R22 | 文件／入口同步、清理審計與 [R22_CLEANUP.md](R22_CLEANUP.md) |
| R23 | 本報告、Browser receipts、五種 viewport 截圖、source／derived／dist 審計 |

## 靜態審計解讀

[r23-static-audit.json](r23-static-audit.json) 顯示 17 件資產、`allHashesMatch: true`、`attributionComplete: true`、`forbidden: []`。其中 `sourceSha256` 是原始 sourceFile，`processedSha256`／`runtimeSha256` 是衍生檔；三者不同是正常的轉換結果，應以 `sourceHashMatch` 與 `derivedPairMatch` 判讀。dist 沒有 source GLB、Blend 工作檔或 raw 檔案；source map 仍包含程式引用的 `raw_scripture` 字串，是否在正式部署關閉 sourcemap 留給 R24 判定。

## R24 交接事項

GPT-6 接手時先處理下列項目，並只在有新證據時改成 PASS：

1. 重新走查 QA02、QA03、QA04、QA05，保存每個 detail 的 activeAssetIds、載入 URL／衍生 hash、camera pose、FOV、part bounds 與回復結果。
2. 決定是否補一個可見的角色學習入口，讓普通祭司、獻祭者、大祭司、利未人職責能完成 QA12；同時重跑日常香／贖罪日用香的學習切換。
3. 補做 QA14–QA17 的 200% 文字、全鍵盤、reduced-motion／聲音、離線／500／WebGL context loss 與實機效能量測；GPU timer 不可用時要保留 UNVERIFIED。
4. 重做 QA18 的乾淨目錄重現，或明確保留 recipe 未重跑的限制；確認是否關閉 production sourcemap。
5. 檢查任何來源或架構衝突。若無法由來源、schema 或現有 receipt 判定，標記 `unresolved`，再交回總控，不猜測。

R23 結論：工程交付與自驗證據已備妥；整站成熟化與正式發布仍等待 GPT-6 R24 最終驗收。
