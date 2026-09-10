# 會幕互動導覽網站

以出埃及記的會幕、器物與供職規範為核心的繁體中文3D研讀網站。技術為 Vite、TypeScript、Three.js、Zod。用途為非商業教育與研讀，保留所有第三方素材歸屬。

## 本輪工作入口

目前依使用者要求回復分支前可用的體驗，保留來源與載入可靠性等修正。改動與驗證見 [體驗回復紀錄](docs/qa/restoration/RESTORE_EXPERIENCE.md)。

提供 3D 總覽、八幕自動運鏡、五站手動導覽、六件器物研讀及來源查閱。器物模式聚焦完整會幕裡的器物；完整經文與來源可展開閱讀。

新增程序、角色卡、五祭比較與細節模型入口已撤下；研究資料與 Blender 工作檔保留。整站擴張曾未通過 R24 驗收，歷史與未解問題仍見 [實作進度](docs/planning/REVAMP_PROGRESS.md)，不視為已完成功能。

## 本機啟動

在本目錄執行；首次安裝依 lockfile：

```powershell
npm ci
npm run dev
```

依終端實際網址開啟，預設 `http://127.0.0.1:3001/`。

```powershell
npm run build
npm run preview
```

build 包含 typecheck、tests、architecture、assets。單獨驗證可跑 `npm run verify`。指定 preview 埠遇到 npm/PowerShell 轉傳問題時，直接執行 `npx vite preview --host 127.0.0.1 --port 4173`。

## 原始資料與交付

- 經文字文使用庫根 `raw_scripture/`；本站來源流程依 [證據契約](docs/planning/REVAMP_EVIDENCE.md)。
- 已下載模型與歸屬：[ASSETS](docs/ASSETS.md)、[授權歷史](docs/assets/LICENSE_AUDIT.md)。原source不覆寫，Blender改造另產衍生。
- 使用者研究素材：[REFERENCE_MATERIAL](docs/REFERENCE_MATERIAL.md)；可供查核，不直接當歷史真相。
- 可部署產物是 `dist/`，不是原始 `index.html`。既有建置／匯出方式見 [DEPLOYMENT](docs/DEPLOYMENT.md)，本批只交付本機預覽與產物，不自動發布。
