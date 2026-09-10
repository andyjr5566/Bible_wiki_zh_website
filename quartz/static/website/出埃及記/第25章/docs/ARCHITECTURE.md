# 現行入口：ARCHITECTURE

更新日期：2026-09-10。

現行程式採 TypeScript、Three.js、Zod。`AppKernel` 統一模式、選取、資產與播放狀態；資料由 Zod schema 載入並經跨檔完整性驗證；`SceneBootstrap`、`AssetRuntimeManager`、各 controller 與元件維持分層。效能資料只在 QA 明確啟用時收集。

請讀 [整站現行規格](planning/REVAMP_MASTER.md)。本頁只作相容入口，不另發工作指示。

舊文已完整封存；原路徑與 SHA-256 見 [文件登記](planning/DOCUMENT_REGISTER.md)。封存的命令、狀態與連結僅屬歷史。
