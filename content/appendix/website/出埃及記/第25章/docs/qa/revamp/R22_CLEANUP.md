# R22 清理與交付面審計

日期：2026-09-10

## 審計結論

本輪沒有刪除程式、模型或來源檔。依目前入口與測試引用，直接刪除 `MiniMap`、輸入控制、碰撞、角色與地圖模組會改變既有入口或測試契約；它們因此保留。舊工作說明已在前一輪移到 `docs/planning/archive/2026-09-10/`，不再作為執行入口。

`src/main.ts` → `AppShell` → `AppKernel` 是目前唯一產品啟動鏈。`AppKernel` 會掛接資產、角色、儀式、導覽、學習、地圖與效能診斷；`AppShell` 會掛接 MiniMap 與所有 overlay。`verify:architecture` 會檢查 scene／component 邊界與退役的 God Object 名稱。

## 文件同步

- 根目錄 `README.md` 已改為描述目前 R00–R21 的實作狀態，並列出五站、六器物、六程序、五祭、來源抽屜與手機操作。
- `docs/ARCHITECTURE.md` 已說明 `AppKernel`、Zod 跨檔驗證、Scene／AssetRuntime 分層與 QA 效能收集邊界。
- `docs/RITUALS.md` 已改為六種程序與燔祭分支／五祭比較的現行說明。
- `docs/ASSET_STRATEGY.md` 已補上 17 件資產、detail 載入與 source／derived hash 語義。
- `docs/3D_PIPELINE.md` 已補上 inspect → build → staging → optimize → reimport → promote 流程及 `verify:derived`。
- `docs/DEPLOYMENT.md` 已說明 build 驗證與 R22–R24 收尾狀態；部署仍只取 `dist/`，本批不發布。

## 入口與檔案檢查

- 舊 `QA.md`、`QA_FINAL.md`、`REBUILD_PLAN.md` 與舊 Luna／Terra／Sol 工作入口維持刪除，未重新加入。
- `docs/planning/REVAMP_MASTER.md`、`REVAMP_TASKS.md`、`REVAMP_ACCEPTANCE.md`、`REVAMP_PROGRESS.md` 是本輪唯一活躍規格、任務、驗收與狀態入口。
- Blender recipe、R07／R10 staging manifest、17 件 public runtime 資產、source／processed hash 與必要 QA 截圖均保留。
- 六個既有 `.blend1` 復原備份未納入版控，未刪除使用者工作樹檔案。

## 驗證

```text
npm run build       -> exit 0
git diff --check    -> exit 0
```

本次 build 包含 typecheck、Vitest 21 files／65 tests、architecture 104 modules 與 assets 17 assets。未發現可安全刪除且不影響產品或測試契約的活躍檔案；R23 仍需依完整 QA 清單做 production preview 與學習走查。
