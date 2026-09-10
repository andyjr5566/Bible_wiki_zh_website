# 現況核對與必修缺口

2026-09-10，GPT-6 規劃階段直接讀取磁碟檔案、指定程式與原始經文，並檢視既有截圖。這不是本日瀏覽器實測或重跑 build；舊測試數字只作歷史記錄。vexp `run_pipeline` 與 `get_skeleton` 均回報 daily limit 8/8；以下依具名檔案現況記錄，未採用過期索引結果。

## 已確認的工程入口

| 功能 | 現存入口 | R 任務應如何使用 |
| --- | --- | --- |
| 啟動與組裝 | `src/main.ts`、`src/app/AppKernel.ts` | 保留組裝根；清理硬編碼內容、整理播放生命週期 |
| UI | `src/components/ExperiencePanel.ts`、`src/components/AppShell.ts` | 面板已有 data attributes；改用 typed 資料與統一狀態 |
| 模式 | `src/types/ui.ts`、`src/ui/UIStateManager.ts` | 當前只有 overview／tour／learning；新增 ritual 明確 mode，map／credits 作 overlay |
| 自動導覽 | `src/systems/CinematicTourController.ts` | 八幕資料與截短經文內嵌在控制器；R03/R17 移出 |
| 3D | `src/scene/SceneBootstrap.ts`、`CameraManager.ts`、`WorldAlignment.ts` | 保留 renderer 與座標轉換；重新校準模型、相機與剖面 |
| 光線與效果 | `src/scene/DesertEnvironment.ts`、`ParticleEffects.ts` | 舊約櫃改動牽涉全域性燈光與 learning 隱藏光柱；須重新驗收不同場景 |
| 資產 | `src/systems/assets/AssetManifest.ts`、`AssetLoader.ts`、`AssetRuntimeManager.ts` | 所有資產由此載入；修復 detail 選取、過期請求、原材質回復 |
| 儀式 | `src/data/rituals.json`、`src/rituals/RitualPlaybackController.ts`、`RitualVisualSystem.ts` | 目前六序列各一個 step，視覺僅洗濯環／香煙 |
| 角色 | `src/data/characters.json`、`src/characters/CharacterSystem.ts` | baseAssetId 皆 null；角色存在於資料不等於場景有服事人物 |
| 經文 | `src/data/scriptures.json`、`src/data/schemas/scriptures.ts`、`src/scripture/ScriptureMappingService.ts` | 既有經文與註解需逐項對來源；schema 非空檢查不證明文字正確 |
| 正式資料 | `src/data/loadProjectData.ts`、`src/data/schemas/`、`src/types/` | schema 與 type 同步變更，新增資料須接入 loader 才算完成 |
| 測試 | `src/data/ProjectData.test.ts`、各領域 `.test.ts`、`scripts/verify-assets.mjs` | 先核對覆蓋內容，再訂新增回歸；不能拿舊綠燈證明歷史正確 |
| 資產處理 | `scripts/process-sketchfab-assets.mjs`、`scripts/blender/build_ark_detail.py` | 舊腳本重跑可能覆蓋已處理材質；R07/R12 統一可重現流程 |

## 已看見的問題及對應任務

| ID | 證據與判定 | 修復任務 |
| --- | --- | --- |
| B01 | README 說 skeleton／Walking／Map，實際型別是三模式，另有自動運鏡；舊 QA_FINAL 等已被刪除 | 檔案整理、本輪已改入口；R22 最後更新 |
| B02 | `rituals.json` 六種程序各一個 step；`AppKernel.startRitual` 只接受 washing／incense；ExperiencePanel 只列兩個 launcher | R02、R13–R16 |
| B03 | `characters.json` 三個 baseAssetId 全 null；`getExperienceState` 固定 character status omitted | R02、R11、R13–R16 |
| B04 | ExperiencePanel 的 `objectMeta` 直接含希伯來文、肘長換算／重量；香壇字串含漢字「特」混入原文字母 | R01、R03、R18：來源不明先停用該欄，不補猜字 |
| B05 | `CINEMATIC_ACTS` 在控制器內直接儲存含省略號的 scriptureText；必須分辨摘要和完整經文 | R03、R17 |
| B06 | `DimensionVisualizer` 自訂燈臺 1.8×1.6×0.6 肘並硬寫 45cm；未見該尺寸 evidence 關聯 | R01、R03、R10：展示模型 bounds 不能當經文尺寸 |
| B07 | 舊 `build_ark_detail.py` 把可見櫃面指定木材；已查庫根 `raw_scripture/出埃及記/第25章.txt` 第10–15行，櫃與槓應按經文包金。裸木外觀不能當成完成狀態 | R08：成品包金；木芯只可出現在有標示的剖面 |
| B08 | 腳本硬寫本機絕對路徑且 `clear_scene` 直接刪除當前所有物件；另將未量化匯出直接寫 public，後續最佳化無單一入口 | R07/R12 |
| B09 | `runtimeConfig` 預設 desktop-high，`openLearningObject` 只在 desktop-structural 呼叫 loadDetail。舊 QA 截圖呈現主會幕內約櫃，缺少 activeAssetIds／網路證據，不能證明衍生 GLB 已展示 | R00、R05、R20、R23 |
| B10 | 舊手機截圖中約櫃左側被截切且資訊抽屜遮下半部；舊桌面與 Blender 比較光線／模型脈絡不一致 | R06、R19、R23 |
| B11 | `AssetRuntimeManager.loadDetail` 使用 profile revision，沒有獨立 detail selection token。快選 A→B 而 A 較晚返回，程式存在掛回 A 的風險；此為靜態疑慮，待受控測試 | R05 |
| B12 | `isShellNode` 用 plane／tube 等名稱片段隱藏節點，`isShellMaterial` 模糊匹配；誤藏器物風險需以真 mesh map 測試 | R06/R09 |
| B13 | `setLearningDetailFocus` 隱藏整個 shekinahGroup，包含 light；註解卻說只隱藏效果。另 DesertEnvironment 同時降低聖所與至聖所照明 | R09：原因與實際作用一致，不沿用「只動約櫃」舊敘述 |
| B14 | `ProjectData.test.ts` 先把 IDs 放入 Set 再 assertUnique，無法偵測原列表重複；step 引文也未見完整正反向與分支覆蓋驗證 | R03/R21 |
| B15 | 舊 docs/3D_PIPELINE、ASSET_IMPORT 寫不存在的 test:assets／ModelLoader／mobileOnly，RITUALS 描述不存在的舊 schema | 本輪退役其舊指示；R22 僅保留現行契約 |

## 可保留的素材與資料

typed manifest 現有 17 個模型，R00 必須重新驗證檔案與 hash，不依表中舊面數當真實 runtime 數。確切原路徑由 `src/data/assets.json` 讀取：

| 類別 | asset ID |
| --- | --- |
| 完整／框架／備援 | tabernacle-main、tabernacle-framework、tabernacle-lowpoly |
| 六件器物 | tabernacle-ark-alternative、tabernacle-burnt-altar-detail、tabernacle-laver-detail、tabernacle-incense-altar-detail、tabernacle-menorah-detail、tabernacle-table-shewbread-detail |
| 法版 | tabernacle-law-tablets-library |
| 人物／服飾技術基底 | priest-arab-man-library、priest-basic-human-library、priest-medieval-outfit-library、priest-tunic-library |
| 動物技術基底 | sheep-library、cow-npc-library、bull-library |

主會幕與核心器物的既有授權紀錄為 CC BY-NC；其他素材仍逐筆保留原歸屬。不能因已下載就相信服飾、牲畜性別、燈臺造型或基路伯姿態符合文字。未下載的山羊／大祭司 reference 不可擷取重製，R11 依來源重新處理可用幾何或採有標示的符號。

既有 `docs/addition_info/` 的三份 PDF/PPTX 及四張 JPG 保留；前 AI 的圖片、簡報、現代重建只作線索，不能直接證明聖經時代的外觀。`docs/SCRIPTURE_RESEARCH.md`、`REFERENCE_MATERIAL.md`、`assets/LICENSE_AUDIT.md` 是研究／素材歷史，不是逐條已審核臺帳。

## 本輪工作樹邊界

起始時網站已有未提交 GLB、Blender 腳本、材質、相機與效果修改；根 AGENTS 及約書亞記第11章 production 產物另有變更。本輪規劃不改這些實作。`docs/QA.md`、`QA_FINAL.md`、`REBUILD_PLAN.md`、`planning/TERRA_HANDOFF.md` 已呈 deleted，未擅自還原；新檔案直接取代其入口，Git 保留歷史。

舊約櫃改造未獲 GPT-6 最終驗收。原 `.blend`、圖片與程序仍保留供 Luna 複核；本組計畫明確把 B07–B13 視為待修／待驗證，不能讀舊 PASS 就跳過。
