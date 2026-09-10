# 現行入口：3D_PIPELINE

更新日期：2026-09-10。

Blender 與資產流程依 R07–R12，採 inspect → build → staging export → optimize → reimport → promote；五件 detail 與約櫃各自保留 recipe、工作檔、manifest、預覽與 hash。驗證命令為 `npm run verify:assets` 與 `npm run verify:derived`；舊 ModelLoader、test:assets 與自動手機低模指示已退役。

請讀 [整站現行規格](planning/REVAMP_TASKS.md)。本頁只作相容入口，不另發工作指示。

舊文已完整封存；原路徑與 SHA-256 見 [文件登記](planning/DOCUMENT_REGISTER.md)。封存的命令、狀態與連結僅屬歷史。
