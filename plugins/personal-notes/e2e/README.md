# 個人筆記：瀏覽器檢查（e2e）

這個資料夾放的是以 headless Chrome 直接操作網站的檢查腳本。它們用來在真實瀏覽器裡確認筆記、便條、重點、導覽、Service Worker 等功能，不是單元測試。

**注意：這些腳本不屬於 `npm test`。** `npm test` 只跑 `test/` 底下的 vitest 單元測試。這裡的腳本需要一個已經建置並且在網路上提供的網站，所以要手動執行。

## 前置需求

- **Google Chrome**：預設路徑是 `C:/Program Files/Google/Chrome/Application/chrome.exe`。如果裝在別處，設定環境變數 `CHROME_PATH` 指向你的 `chrome.exe`。
- **Node.js**（腳本使用全域 `WebSocket` 與 `fetch`，請用較新的 LTS 版本；本次語法檢查是在 v22 上做的）。
- 依賴安裝：
  - 倉庫根目錄：`npm install`（`tsx` 與 `typescript` 宣告在根目錄的 devDependencies）。
  - 外掛資料夾：`cd plugins/personal-notes && npm install`（建置外掛與 `gen-backup.ts` 需要 `fake-indexeddb`）。

## 建置測試站

1. 建置外掛（會重新產生 `dist/`，`dist/` 已進版控）：

   ```bash
   cd plugins/personal-notes
   npm run build
   ```

2. 把外掛複製到 `.quartz/plugins/personal-notes`。這是 Quartz 實際載入的本機副本。CI 也會做同樣的事（見 `.github/workflows/deploy.yml` 的 "Setup local plugins" 步驟），所以改過外掛程式碼之後都要重新複製：

   ```bash
   cd ../..   # 回到倉庫根目錄
   rm -rf .quartz/plugins/personal-notes
   cp -r plugins/personal-notes .quartz/plugins/personal-notes
   rm -rf .quartz/plugins/personal-notes/node_modules
   ```

3. 在倉庫根目錄建置測試內容。輸出資料夾用 `test_public`（已列在 `.gitignore`）。
   **要模擬線上的子路徑**，建置前暫時把 `quartz.config.yaml` 的 baseUrl 改成 `localhost:8090/Bible_wiki_zh_website`，建完立刻還原（網站的基底路徑來自 baseUrl；不改的話 `links.json`、`config.json` 等會用錯路徑）：

   ```bash
   sed -i 's|baseUrl: bible-wiki-zh-website.vercel.app|baseUrl: localhost:8090/Bible_wiki_zh_website|' quartz.config.yaml
   npx quartz build -d test_content -o test_public
   git checkout quartz.config.yaml
   ```

4. 啟動子路徑伺服器，模擬 GitHub Pages 的專案站（網站掛在 `/Bible_wiki_zh_website/` 底下，且不送 `Service-Worker-Allowed`）：

   ```bash
   node plugins/personal-notes/e2e/subpath-server.mjs test_public 8090
   ```

   之後的 `siteRoot` 都是 `http://localhost:8090/Bible_wiki_zh_website`（結尾不加 `/`）。

## 執行單一腳本

所有腳本都從外掛資料夾執行（`npm run` 會自動在那裡執行）。第一個參數永遠是 `siteRoot`，第二個是 Chrome 的 user-data-dir（給一個空的或專用的資料夾，例如 `prof/sticky`；`prof/` 已列在 `.gitignore`）。其餘參數依各腳本而定，見下方表格。

```bash
cd plugins/personal-notes
npm run e2e:sticky -- http://localhost:8090/Bible_wiki_zh_website prof/sticky prof/shots
```

截圖資料夾（選填）要事先存在。腳本全部通過時結束碼為 0，有任何一項失敗時為 1。

## 對線上網站執行

把 `siteRoot` 換成正式站即可，不需要本機伺服器：

```bash
npm run e2e:node -- https://andyjr5566.github.io/Bible_wiki_zh_website prof/node-live
```

注意：

- 線上站只有在 `main` 部署完成之後，才會反映最新的外掛版本。
- 每次執行都用新的 profile 資料夾，避免上一次留下的筆記或便條影響結果。
- 腳本會在測試用的瀏覽器 profile 裡建立筆記、便條、重點，這些資料只存在這台電腦的瀏覽器，不會寫入 `content/`。

## 產生大量資料的備份檔（mynotescheck 用）

`mynotescheck.mjs` 需要一份含 400 則筆記、80 張便條、120 個重點、25 個書籤的備份檔，由 `gen-backup.ts` 產生。在外掛資料夾執行：

```bash
cd plugins/personal-notes
npx tsx e2e/gen-backup.ts prof/heavy-backup.json
```

如果 `npx` 在外掛資料夾找不到 `tsx`，先在倉庫根目錄執行 `npm install`，再改用根目錄的 `node_modules/.bin/tsx`（Windows 上是 `tsx.cmd`）執行同一個腳本。

## 腳本一覽

| 腳本 | npm 指令 | 檢查內容 | 參數 |
| --- | --- | --- | --- |
| `stickycheck.mjs` | `e2e:sticky` | 便條紙（12 N1）：選取經文時出現「便條」、打字自動存、換顏色、完成、在便條上選字不跳出畫重點工具列、畫重點仍正常、本章全部收起／展開、重新整理後還在、刪除與復原、空白便條不留下、換頁不殘留、設定「展開／收起」、手機版面 | `<siteRoot> <profile> [shotDir]` |
| `mynotescheck.mjs` | `e2e:mynotes` | 〈我的筆記〉新版面（D-42）：大量資料下的分頁與數量、最近 10 則、依書卷折疊、打開書卷與章、長筆記兩行預覽與展開、搜尋（找到 N 則、再顯示）、標籤篩選、便條與重點與書籤分頁、「設定與備份」、頁尾、手機版不左右捲 | `<siteRoot> <profile> <backup.json> [shotDir]` |
| `nodecheck.mjs` | `e2e:node` | 知識庫條目加入書籤（12 N2）：條目頁標題下方的按鈕、按下後狀態與提示、重新整理後仍在、資料夾頁與章節頁沒有這個按鈕、我的筆記頁列出條目、SPA 換頁後只有一個按鈕、取消書籤、手機版按鈕大小 | `<siteRoot> <profile>` |
| `p2check.mjs` | `e2e:p2` | Phase 2：未登入存檔提示、Markdown 顯示與 HTML 標籤只當文字、`[[條目]]` 連結與找不到時的虛線提示、`[[` 自動完成、標籤與標籤篩選、搜尋的 AND 規則、前往該章停在那一則、經節標上 📝、選取經文的工具列、寫筆記帶入節數與引文、畫重點（含跨節）、書籤、移除重點、`#v` 跳轉、SPA 換頁不殘留、Markdown 匯出成 ZIP | `<siteRoot> <profile> [only]`（`only` 含 `2`/`3`、`5`/`6`、`4` 可只跑對應段落） |
| `mobilecheck.mjs` | `e2e:mobile` | 手機尺寸（390x844、觸控、iPhone UA）：筆記輸入框高度 ≥ 44、有框線、字級 ≥ 16；我的筆記搜尋框整行寬 | `<siteRoot> <profile> [shotDir]`（不用無痕模式） |
| `fixcheck.mjs` | `e2e:fix` | 本輪修正：打字後 150ms 重新整理內容不遺失、節數填反自動對調、完成後焦點、刪除確認框預設焦點在「取消」、清空後完成不留空白筆記、登入說明視窗、說明中心的「看我的筆記」、匯出備份、「前往該章編輯」捲到筆記面板、搜尋可用書卷章節 | `<baseUrl> <profile> <downloadDir>`；環境變數 `INCOG=1` 改用無痕模式（無痕下改驗匯出的下載連結） |
| `regress.mjs` | `e2e:regress` | 既有功能回歸：首頁 wiki-tour 啟動與導覽泡泡、章節頁筆記面板、深色模式切換、閱讀模式已移除且「我的筆記」入口可見、搜尋有結果、SPA 換頁（主題保持、面板換章）與上一頁、PWA manifest 與 sw.js、我的筆記頁畫出內容、全程未登入不連到 Google、沒有 JavaScript 例外 | `<baseUrl> <profile> [shotDir]`；`INCOG=1` 同上 |
| `uicheck.mjs` | `e2e:ui` | 選取工具列：選取後點別處收起、按 Esc 收起、點已畫的重點只出現「移除這個重點」（沒有取消）、左上角「我的筆記」入口的位置與大小、點入口與文字按鈕進入我的筆記（只有一個入口、標示目前頁）、一般頁與資料夾頁有入口、手機版入口可見 | `<siteRoot> <profile> [shotFile]`：第三個參數是**截圖檔路徑**（不是資料夾），手機版截圖存在這裡，桌面版存成同名的 `-desktop.png` |
| `tourcheck.mjs` | `e2e:tour` | 導覽的「個人筆記」一站：導覽停在 `notes` 步驟、泡泡標題正確、框住的區域包含筆記面板標題。環境變數 `DELAY_APP=毫秒` 模擬筆記 App 晚載入 | `<siteRoot> <profile> <shotFile>`（截圖檔路徑） |
| `expcheck.mjs` | `e2e:exp` | 探索目錄：目前章節所在的資料夾展開時就有「全部收合」、按下後全部收起且按鈕消失、重新整理後收起的資料夾仍收著、再展開後按鈕回來、SPA 換頁後只有一個按鈕、收起時「探索」兩字完整、收起時看不到目錄、手機抽屜裡也能全部收合 | `<siteRoot> <profile> <shotFile>`（截圖檔路徑；手機版存成 `-mobile.png`） |
| `swcheck.mjs` | `e2e:sw` | Service Worker：註冊成功且管整個網站、頁面被接管、快取裡有看過的頁面與筆記 App、大圖（羊皮紙背景）沒進快取、其他網域沒進快取、`config.json` 沒進快取、離線時看過的頁面與筆記可用、沒看過的頁面顯示首頁、恢復連線後正常、沒有 Service Worker 相關錯誤 | `<siteRoot（結尾不加 /）> <profile>` |
| `subpath-server.mjs` | （不是檢查，直接用 `node` 執行） | 模擬 GitHub Pages 專案站的靜態伺服器：`/foo` 對應 `foo.html`、`/dir/` 對應 `dir/index.html`、不送 `Service-Worker-Allowed` | `<publicDir> <port>` |
| `gen-backup.ts` | （不是檢查，用 `npx tsx` 執行） | 產生重度使用者的備份 JSON（400 則筆記、80 張便條、120 個重點、25 個書籤、3 個知識庫條目書籤） | `<out.json>` |

## 共用程式：`lib.mjs`

各檢查腳本共用的啟動、CDP 連線、`check`、`finish` 等都在 `lib.mjs`。它匯出 `startBrowser({ root, profile, width, height, mobile, incognito, shotDir, userAgent, detailMax })`，回傳的物件含 `send`、`ev`、`check`、`go`、`errors`、`shot`、`saveShot`、`newNote`、`setViewport`、`openBrowserSocket`、`on`、`finish` 等。另外匯出 `ch1`、`setVal`、`clickText`、`selectIn`、`toolbarButtons`、`sleep`。

新增一支檢查時，只要寫自己的步驟，最後呼叫 `finish()`。


## 模擬觸控螢幕（`(pointer: coarse)`）

2026-10-20 在無頭 Chrome 實測（第四輪 F8 手機版教學要用）：

- **要用 `Emulation.setTouchEmulationEnabled { enabled: true, maxTouchPoints: 5 }`** 才會讓 `(pointer: coarse)`、`(hover: none)`、`(any-pointer: coarse)` 成立；`lib.mjs` 的 `setViewport(w, h, { touch: true })` 會送這個。立即生效，不用重新整理（只有 `'ontouchstart' in window` 要重新整理後才會變 true）。
- 只設手機尺寸（`setDeviceMetricsOverride` 的 `mobile: true`）**不會**變成 coarse。
- `Emulation.setEmulatedMedia` 的 `pointer`／`hover` 特性會被接受但**沒有效果**，不要用。
- 切回電腦（fine）：要明確送 `Emulation.setTouchEmulationEnabled { enabled: false }`。`setViewport(…, { touch: false })` 只是不送觸控設定，**不會關掉**已開的觸控模擬。
- 所有模擬設定都在同一個 CDP 連線上送（開第二條連線到同一頁時結果不一致）。

## 已知限制

- `fixcheck.mjs` 的「匯出備份」：這台電腦的無頭 Chrome 不會把下載真的寫到資料夾（2026-10-19 起，搬家前的版本也一樣），請用 `INCOG=1` 執行，改成攔截下載連結並讀取內容來驗證。
- `tourcheck.mjs`：導覽「個人筆記」那一站在出埃及記第 12 章，test_content 沒有這一章（會顯示「逛到別頁了」），請對完整內容的建置或線上網站執行。

## 條目檢查（F4b、F5）

```bash
npx tsx e2e/gen-entry-backup.ts <輸出資料夾>/entry.json
node e2e/entrycheck.mjs http://localhost:8090/Bible_wiki_zh_website <profile> <輸出資料夾>/entry.json [shotDir]
```

檢查：搬過資料夾的條目書籤在〈我的筆記〉連到新網址、找不到時標示；條目頁認得舊書籤並改成新網址；條目頁寫筆記；「我的相關筆記」兩組與排序；點卡片到那一章那一則；SPA 換頁；〈我的筆記〉「知識庫條目」組；手機。
