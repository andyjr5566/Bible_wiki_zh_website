# 檔案權威與清理登記

日期：2026-09-10。當前唯一入口是 [REVAMP_MASTER.md](REVAMP_MASTER.md)；執行只更新 [REVAMP_PROGRESS.md](REVAMP_PROGRESS.md)。本輪移除活躍檔案中的舊流程正文，保留精簡導向頁避免舊連結誤導；原文按位元儲存於封存。

## 封存核對

| 原 docs 相對路徑 | 儲存位置 | 原文 SHA-256 | 處理 |
| --- | --- | --- | --- |
| `ARCHITECTURE.md` | [封存副本](archive/2026-09-10/ARCHITECTURE.md) | `5f04423f8382f53b87d4d2bdd941510b46f9d0176b28c0069083824d5451ccb2` | 舊指示移出；原路徑保留導向頁 |
| `3D_PIPELINE.md` | [封存副本](archive/2026-09-10/3D_PIPELINE.md) | `e2a005475c4ccada15620d188a5c26d023969d8549943273dcd6f1cf7d401d90` | 舊指示移出；原路徑保留導向頁 |
| `ASSET_IMPORT.md` | [封存副本](archive/2026-09-10/ASSET_IMPORT.md) | `f58ccab848c9ab236b1b0944fd525e4f31fb47cb249a6dd1b1fb9e11ebd2a229` | 舊指示移出；原路徑保留導向頁 |
| `RITUALS.md` | [封存副本](archive/2026-09-10/RITUALS.md) | `80677d54c69066035d962e40fd0cc7e182ed20924638358e6945630ca4b6dc9e` | 舊指示移出；原路徑保留導向頁 |
| `ASSET_STRATEGY.md` | [封存副本](archive/2026-09-10/ASSET_STRATEGY.md) | `eb715df3d1b6041aa70c63dea5eb30149ab6ee59a19cf1f4b7cad9a9ce882cb9` | 舊指示移出；原路徑保留導向頁 |
| `planning/BLENDER_LUNA_TASKS.md` | [封存副本](archive/2026-09-10/planning/BLENDER_LUNA_TASKS.md) | `4cc7f15b92311254b0cc24f26f955d14b10f9319dc5a8e0fde5261464cf32e5d` | 舊指示移出；原路徑保留導向頁 |
| `planning/BLENDER_LUNA_PROGRESS.md` | [封存副本](archive/2026-09-10/planning/BLENDER_LUNA_PROGRESS.md) | `337b69d6a230a0499931614ee1f4fd1c2ba58bef163e9aceea0c0ba147dd03cf` | 舊指示移出；原路徑保留導向頁 |
| `planning/LUNA_HANDOFF.md` | [封存副本](archive/2026-09-10/planning/LUNA_HANDOFF.md) | `059879fafac32cf9203ad0870f40de4fb01c0db38fc6d68e96587a7ffd997439` | 舊指示移出；原路徑保留導向頁 |
| `planning/COMPLETION_AUDIT.md` | [封存副本](archive/2026-09-10/planning/COMPLETION_AUDIT.md) | `484b440a853e68c4cb6081ec339497d10179707a15862d18e8e92f8e75e16c9f` | 舊指示移出；原路徑保留導向頁 |
| `planning/SOL_COMPLETION_AUDIT.md` | [封存副本](archive/2026-09-10/planning/SOL_COMPLETION_AUDIT.md) | `1e9efd1135e0fbdd3f4593670832cdab3a3a3075293fb1990c45bb5f22ff7543` | 舊指示移出；原路徑保留導向頁 |

## 使用者已刪除，維持刪除

`QA.md`、`QA_FINAL.md`、`REBUILD_PLAN.md`、`planning/TERRA_HANDOFF.md` 在本輪起始即為 Git deleted。本輪未還原；新任務與驗收規格取代其工作入口。

## 保留的資料

`ASSETS.md`、`ADDITIONAL_DOWNLOADS.md`、`REFERENCE_MATERIAL.md`、`SCRIPTURE_RESEARCH.md`、`assets/`、`addition_info/` 保留研究／授權／資產歷史；R01逐項核對後才構成新主張證據。舊圖片保留在 planning，僅作歷史比較；新截圖必有新receipt。

## 檔案權威

根 AGENTS 管全庫不變條件；REVAMP_MASTER 管本輪產品與工作範圍；REVAMP_EVIDENCE 管來源界線；REVAMP_TASKS 管實作；REVAMP_ACCEPTANCE 管驗收；REVAMP_PROGRESS 管狀態。其他現存資料說明可查，但與實際型別／新規格有差異須記入缺口，不讀舊PASS跳過驗收。

## 實作清理延後

runtime未用檔、舊特效、舊硬編碼內容與重複資產處理由R22依引用與驗證清理。本規劃輪沒有刪程式、GLB、原來源或使用者的未提交工作。
