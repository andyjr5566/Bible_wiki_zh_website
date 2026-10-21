# 評估結果與證據（2026-10-21）

標記：**C**＝Claude 實測，**O**＝另一個 AI，**S**＝Codex gpt-6-sol。✔ 表示已從截圖、量測或程式碼確認。

## 1. 效能

| 觀察 | 來源 | 證據 |
|---|---|---|
| ✔ 第一次打開首頁約傳輸 16 MB | C | 無頭 Chrome 量測 |
| ✔ 亮色背景 `quartz/static/parchment.jpg` 9.15 MB；暗色 `dark_parchment.jpg` 7.24 MB；直接當作 body 背景 | C O S | `custom.scss:309` |
| ✔ `quartz/static/` 裡還有 `parchment - org.jpg`、`dark_parchment - org.jpg` 兩個備份，也會被發佈（沒有被載入，但佔部署空間） | C | `ls quartz/static` |
| ✔ `static/contentIndex.json` 原始 19.8 MB、gzip 7 MB，每頁第一次載入都會抓 | C | curl 標頭 |
| ✔ 關係圖每頁都從 CDN 載入 pixi.js（345 KB）與 d3，版本只寫 `pixi.js@8`，沒有鎖定 | C | 資源清單 |
| ✔ 創世記目錄頁一次嵌入 6 支 YouTube 影片 | C S | `content/01 創世記/全書目錄及綱要.md:22-30` |
| GitHub Pages 的 `Cache-Control: max-age=600` | C | 無法改；用帶雜湊的檔名可以避開 |

## 2. 第一次進站

| 觀察 | 來源 | 證據 |
|---|---|---|
| ✔ 首頁轉到序幕的條件是 `!seen（sessionStorage）|| 超過 24 小時`。sessionStorage 每個分頁各自一份，所以**每開一個新分頁都會再跳**。 | C S | `quartz/components/Head.tsx:447-456` |
| ✔ manifest `start_url: "../"` 指向首頁，所以從主畫面打開 App 每次都是新工作階段，會再跳序幕 | C | `quartz/static/manifest.json` |
| ✔ 手機進站約 1.8 秒後自動跳出「加入主畫面」面板，蓋住約一半畫面 | C S | `Head.tsx:411-418`；截圖 03、06 |
| ✔ 「第一次來嗎？」導覽卡會跟著換頁持續出現；桌機上蓋住右側目錄與反向連結；390px 手機模擬下卡片左邊被切掉 | C S | `plugins/wiki-tour`；截圖 04、29、30 |
| ✔ 序幕頁的 favicon 404：它去抓 github.io 根目錄的 `/favicon.ico` | C | console |

### 2.1 首頁內容（筆記庫的 index.md）

| 觀察 | 來源 | 證據 |
|---|---|---|
| ✔ 分頁標題、頁面大標題、og:title 都是「index」 | C O S | 首頁 HTML |
| ✔ 「使用方式」第 2 點寫「從上方『按主題查詢』進條目」，首頁沒有這一段 | C O S | `content/index.md:37` |
| ✔ **約書亞記 24 章全部都有章節檔**，但表格寫 12/24、50% | 查證 | `content/06 約書亞記/` 有 24 個章節檔 |
| ✔ 頁尾寫「共 187 章 · 2026-09-04」，只算了前五卷（實際六卷共 211 章） | O S | `content/index.md` 最後一行 |
| ✔ 「作者的話」說只做到申命記 | C O | `content/index.md` 作者的話一節 |
| ✔ 作者的話很長，放在首頁中間 | C O S | — |

### 2.2 為什麼建議改「加入主畫面」的出現時機（回答 Q-1）

- **現況**：手機第一次進站，依序會遇到：序幕 → 回到網站約 1.8 秒後，「加入主畫面」面板蓋住下半個畫面 → 同時還有「第一次來嗎？」導覽卡 → 左下「筆記」、右下「?」兩顆浮動按鈕。讀者一節經文都還沒讀到，就要先關掉兩、三個東西。
- **連結分享的情況**：從 LINE 收到某一章連結的人，一打開也會先看到這個面板。
- **為什麼要等**：安裝提示在讀者已經表現出興趣時比較有效，例如第二次回來、或讀了幾頁之後。第一次就跳出來，最常見的反應是直接關掉。
- **不改也可以**：如果使用者希望第一次就提示，可以只改成「不和導覽卡同時出現」，並把面板改小（例如底部一條細橫幅）。

## 3. 另一個 AI 的事實陳述查證（haiku 子代理）

| # | 陳述 | 結果 |
|---|---|---|
| 1 | `article table td { white-space: nowrap; }` 可能讓手機表格溢出 | ✔ 正確，`custom.scss:43-44`（只套在 article 的表格） |
| 2 | 手機內文 1.4rem、行高 1.8 | 部分正確，`custom.scss:429-433` 套在 `article p, article li` |
| 3 | 大量 `!important` | ✔ 54 個 |
| 4 | 搜尋無結果時顯示英文「No results.」「Try another search term?」 | ✔ `plugins/semantic-search/src/components/scripts/search.inline.ts:215,217`；`zh-TW.ts:6-7` 也是英文 |
| 4b | 語意結果標「AI 語意 NN%」；GitHub Pages 上呼叫 Vercel API | ✔ `search.inline.ts:243`、`:18`、`:35` |
| 4c | API 有逾時與退回機制 | ✘ 沒有逾時。失敗時會退回關鍵字結果，但 `await Promise.all`（`:402`）讓 API 卡住時，所有結果都跟著等 |
| 5 | Service Worker 網路優先；離線打開沒快取的頁面會退回首頁 | ✔ `quartz/static/sw.js:79-98`，`:86` 退回 ROOT_URL；沒有專用離線頁 |
| 6 | 筆記同步用 `drive.appdata`，雲端備份才申請 `drive.file` | ✔ `plugins/personal-notes/src/client/auth/gis.ts:9`、`:214-215`；申請過備份權限的帳號，之後續期會兩個一起要 |
| 7 | 有很多 E2E 腳本，但部署流程沒有跑 | ✔ `deploy.yml` 只有 build 和 `verse-check-report.mjs`（`continue-on-error`） |
| 8 | manifest `orientation: portrait` | ✔ `quartz/static/manifest.json:12` |
| 9 | 約書亞記只完成 12 章 | ✘ 24 章都在，是首頁的數字過時 |
| 10 | 有 Plausible | ✔ 只有 pageview，沒有自訂事件 |

**整體評價**：方向大致正確、偏產品藍圖。需要修正或保留意見的地方：

- 「約書亞記只完成 12 章」不對，是首頁數字過時。
- 「導讀」模式的分段導讀需要新內容。
- 首頁「互動學習：地圖、時間軸與遊戲」中的遊戲部分，依 U-2 不採用。
- 圖譜的語意連線需要內容端提供關係資料。

這幾點都依 README 延後或排除。

## 4. 閱讀、導覽、搜尋（三方對照）

| 項目 | 來源 | 證據與說明 |
|---|---|---|
| ✔ 每卷第 12 章的 `<title>` 都只叫「第12章」；meta description 開頭抓到「前一章回目錄下一章」；`<html lang="zh">` | C O | 章節頁 HTML |
| ✔ 桌機打開章節頁時被捲下約 287px，看不到標題與麵包屑 | C | `.quartz/plugins/explorer/src/components/scripts/explorer.inline.ts:297` 的 `activeElement.scrollIntoView({behavior:"smooth"})` 連整個視窗一起捲 |
| ✔ 每頁有兩個標題（article-title「第12章」＋內文 H1「出埃及記 第12章」），條目頁也一樣 | C S | 截圖 05、07 |
| ✔ 條目頁與懸停預覽顯示英文「Properties／aliases」表格（預覽裡的 aliases 是空的）、麵包屑，把「定義」擠到下面 | C | 截圖 07、28 |
| ✔ 經文連結：出埃及記 12 章有 220 個內部連結，粗體深紅加粉紅底；深色模式是亮黃粗體 | C | 截圖 04、09 |
| ✔ 註解段落直接夾著 Strong 編號（例如「H7716 搭配 H8549G, H2145」） | C | 截圖 24 |
| ✔ 「素」按鈕看不出用途（aria-label 是「切換素色黑白／古典紙質底色」），手機沒有提示文字；沒有字級設定 | C | — |
| ✔ 手機章節頁約 28,000px 長；右欄目錄在手機被排到頁面最底下 | C S | 截圖 06 |
| ✔ 手機選單預設全部展開、不記住狀態，要往下找目前章節 | S | `quartz.config.yaml:174`（`folderDefaultState: open`、`useSavedState: false`） |
| ✔ 右欄最上面的關係圖是一團沒有文字的點；目錄文字淡、對比不足，還擠在小捲動框裡 | C S | 截圖 04、22 |
| ✔ 左側選單露出 appendix、link_folder、INSTALL_*、README、專案流程說明；麵包屑是英文「Home」 | C | 截圖 22、07 |
| ✔ 頁尾連到 Quartz 的 GitHub 與 Discord | C O | `quartz.config.yaml` footer |
| ✔ 搜尋「逾越節」：第一名是「原文 逾越 (Pesach)」；精準比對把創世記 22 章排在出埃及記 12 章前面；結果清單只有標題 | C S | 截圖 27 |
| ✔ 搜尋程式把語意結果排在精準比對前面，而且兩者都完成才一起顯示 | S | `search.inline.ts:387,407` |
| ✔ 搜尋清單宣告了 listbox，但鍵盤上下鍵只改視覺 `.focus`，DOM 焦點沒有跟著移動 | S | `search.inline.ts:167,327` |
| 經文參照搜尋（「出12:3」「創世記 1:27」「Gen 1:27」）目前不支援 | O S | — |
| 章節頁沒有標示經文譯本與授權（需查證是哪個譯本） | S | — |
| ✔ `baseUrl` 寫 Vercel，靠 deploy.yml 的 sed 換成 github.io | C S | `quartz.config.yaml:10`、`deploy.yml` |
| Vercel 轉址是 307（`permanent: false`）。**可能是刻意的**（和 sw.js 的 rewrite 有關，見 D-43），改成永久前先查原因 | C | `vercel.json` |

## 5. 截圖與量測方法

- 用無頭 Chrome 加 Node 22 的 CDP 腳本（Node 22 內建 WebSocket，不需要 puppeteer）。Chrome 在 `C:/Program Files/Google/Chrome/Application/chrome.exe`。
- `--user-data-dir` 要用絕對路徑；第二次啟動時，相對路徑會失敗。
- 網站用了平滑捲動，`scrollTo` 之後立刻讀 `window.scrollY` 會是舊值，要等一下再截圖。
- 全頁截圖用 `Page.captureScreenshot` 的 `captureBeyondViewport: true` 加 `clip`；不要用把視窗調高的方式，會卡住。
- 深色模式：`Emulation.setEmulatedMedia` 設 `prefers-color-scheme: dark`。驗證動畫時要另外設 `prefers-reduced-motion: no-preference`，因為無頭 Chrome 預設 reduce。
- 首頁第一次會轉到序幕；測首頁本身用 `?skip=1`。
- 量傳輸量：`performance.getEntriesByType('resource')` 的 `transferSize` 加總，要在清掉快取的情況下量。
