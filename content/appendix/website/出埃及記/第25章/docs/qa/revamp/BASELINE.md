# R00 基線紀錄

日期：2026-09-10（Asia/Taipei）  
執行者：目前 Codex session（模型名稱由介面提供；本輪未啟動 Luna 子代理）  
工作樹：`feat/appendix-exodus25-revamp`，起始 HEAD `c0aefae8`  
範圍：只記錄基線與測試證據，不修改 runtime、原始 GLB 或 Blender 場景。

## 工作樹與工具

- `git status --short` 在基線開始時沒有本站 tracked 差異；本輪新增的 `docs/qa/` 是 R00 證據產物。根目錄仍有其他使用者工作，未 reset、清理或納入本任務。
- Node `v22.22.3`、npm `11.18.0`。
- `node_modules` 與 `package-lock.json` 已存在，沒有重灌。
- 系統 PATH 沒有 `blender` 命令；Blender MCP 唯讀連線成功，回報 Blender `5.2.1 LTS`、addon `1.6`、protocol `5`、up-to-date。
- Browser 以本機 production preview 連線成功。頁面 console 在首頁、器物模式、五站與電影播放器操作後沒有 error/warn。

## Build／preview

執行於網站根目錄：

```text
npm run build
```

結果：exit code `0`。包含 `typecheck`、Vitest `16 files / 33 tests passed`、architecture `81 TypeScript modules`、assets `17 assets`，最後 Vite production build 成功。產物包含 `dist/index.html`、`index-BbdSLYI4.js`、`AppKernel-DOhGRTL4.js` 與 CSS；Vite 對約 739 kB 的 AppKernel chunk 發出 code-splitting warning。

`npm run preview -- --port 4173` 受到 npm 11 參數轉送行為影響，錯誤地把埠號當 positional argument，且找不到 dist。依 R00 規格改用：

```text
npx vite preview --host 127.0.0.1 --port 4173
```

結果：本機 `http://127.0.0.1:4173/` 成功啟動。這是命令使用紀錄，不是產品缺陷；後續文件應使用直接 Vite 指令或修正 npm script 的傳參方式。

## Browser 畫面證據

| 證據 | 視口／狀態 | 觀察 |
| --- | --- | --- |
| [首頁桌面](screenshots/r00-overview-desktop.png) | 1920×945，DPR 1 | 完整會幕與沙漠場景可見；左側導覽面板覆蓋畫布，約櫃在 hero 場景內，尚不能作為獨立 detail 載入證據。 |
| [器物桌面](screenshots/r00-items-desktop.png) | 1920×945，器物模式 | 六個器物按鈕存在；初始燔祭壇資訊含肘換算、希伯來字串與多段 hard-coded 文案，待 R01–R03 來源臺帳與資料契約接管。 |
| [五站桌面](screenshots/r00-stations-desktop.png) | 1920×945，五站模式 | 第一站由東門進入可操作，顯示 1/5、下一站與退出；其餘站點尚未逐站驗收。 |
| [電影導覽桌面](screenshots/r00-tour-desktop.png) | 1920×945，播放器開啟 | 顯示第一幕與 1/8，字幕以省略號摘要呈現；目前不能視為六種完整服事程序。 |
| [首頁手機](screenshots/r00-overview-mobile-390x844.png) | 390×844，DPR 1 | body 沒有水平溢位，但主要會幕在此視口沒有穩定落入可讀取景，控制列／導覽層占用明顯畫面，列為 R06/R19 缺口。 |

DOM 可確認的入口：場景總覽、五站導覽、器物與經文、電影級逐節導覽、出25章研讀、平面圖、資料來源。DOM 文字與按鈕存在不等於 3D 資產、角色或程序已完整交付；R00 之後需用 runtime 診斷與畫面證據補強。

## Blender 唯讀基線

`get_scene_info` 回報目前 scene 名稱為 `Scene`，24 個物件、5 個材質；可見根物件包含 `Sketchfab_model` 與 `Root`，另有多個 `Sphere.*` 物件。工具沒有回報目前檔案路徑或 dirty／已儲存狀態，因此沒有清空、另存或執行寫入。R07 以前不得把這個使用者場景當成可重建工作檔；後續需先建立隔離副本並記錄路徑。

## 資產計量

[BASELINE_ASSETS.json](BASELINE_ASSETS.json) 記錄目前 `assets/processed/sketchfab` 的 17 個 GLB：bytes、三角面估算、材質數、貼圖數與 glTF scene bounds。三角面由索引數除以 3 計算；bounds 是 glTF scene 的幾何 bounds，不代表聖經尺寸，也不代表瀏覽器已載入。source GLB 的授權、來源與 hash 仍由既有資產文件管理。

## R00 結論

網站可建置、可啟動 preview、Browser 可檢查主要入口；Blender MCP 可唯讀取得 scene。基線證據已連到確切 commit、視口與資產計量。尚未驗證獨立 detail 的實際 GLB 載入、六種完整服事程序、GPU frame 指標與 Blender 可重現匯出；這些保留給 R01 之後的任務，不以本基線宣稱成熟化。
