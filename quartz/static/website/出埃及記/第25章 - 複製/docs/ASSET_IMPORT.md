# Sketchfab 資產匯入程序

本網站的使用範圍已於 2026-08-11 確認為**非商業使用**。候選模型採用 CC BY-NC，仍必須保留作者、原始連結、授權與 attribution，且不得把第三方模型說成專案自行製作。

## 已核對、可下載的候選

| Source folder | Sketchfab model ID | 用途 |
| --- | --- | --- |
| `biblical-tabernacle-mishkan/` | `41d3c771c13a4cbcbc10353536ffec91` | 優先檢視完整會幕 hierarchy |
| `framework-of-tabernacle-tent/` | `13cc215d3f404c4c85d2adb037626517` | 剖面／結構模式研究；不可直接當 mobile fallback |
| `tabernacle-jamethy-lowpoly/` | `2c9627a1b3334e0c8fb48078376b94c9` | 手機 low／fallback 候選 |
| `altar-incense/` | `18632101cc3744c7a6202be9ee1bf1e2` | 僅在完整模型缺少獨立 hierarchy 時使用 |
| `table-shewbread/` | `8464709d407f49f49c55415e246b6fe5` | 同上 |
| `altar-burnt-offering/` | `bf23feae192b4cd6a4e8d7ca74417099` | 同上 |
| `menorah/` | `5a3ae34b9f744163bb63222577f5e238` | 同上 |
| `law-tablets/` | `69674e1002a94efc8452581836814849` | 研究用法版資料標記 |

## 取得原始檔

1. 在已登入的 Sketchfab 帳戶開啟候選模型的原始頁，使用其 `Download 3D Model` 功能。
2. 不變更下載壓縮檔，直接放入對應的 `assets/source/sketchfab/<folder>/`。
3. 為每個來源檔記錄下載日期、檔名、SHA-256、原始 URL、作者、CC BY-NC 與頁面顯示的模型統計到 `ASSETS.md`。
4. 只有確認壓縮檔可讀、授權資料一致後，才可解壓並用 Blender / glTF 工具處理到 `assets/processed/sketchfab/`。

## 匯入 runtime 前的門檻

處理後的 `.glb` 必須：

1. 通過比例、面向、材質、三角形數與瀏覽器載入檢查。
2. 寫入 `public/models/`，並在 `public/models/manifest.json` 建立具有 `approved`、作者、來源、授權、attribution 和 transform 的 entry。
3. 通過 `npm run test:assets`，並同步更新 Credits UI 與 `ASSETS.md`。

目前 17 個來源 GLB 已保存至 `assets/source/sketchfab/`，並以 glTF-Transform 完成 quantize／texture-size 2048 最佳化與 glTF 驗證。主模型另在 manifest 以 Y 軸 -90°、scale 0.3 對齊 Tour／地圖／第一人稱座標；`public/models/manifest.json` 已核准主模型、框架剖面、器具特寫與手機低模，角色／衣物／動物則以 deferred asset library 方式保留，避免啟動時一次載入近百 MB。載入失敗仍回退程序化 `reconstructed` 場景。每個 entry 的 source checksum、處理檔案與 attribution 必須持續和 `ASSETS.md`、`ADDITIONAL_DOWNLOADS.md`、Credits UI 同步。
