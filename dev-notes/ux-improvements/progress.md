# 進度與委派紀錄

每完成一個任務、每做一次委派，就在對應的批次下面記一行。格式：日期｜任務｜誰（模型、effort）｜做什麼｜結果｜是否採用｜主導者修了什麼。

## 規劃（2026-10-21）

- 2026-10-21｜評估｜Claude Opus｜無頭 Chrome 實測正式站並對照原始碼｜結果見 findings.md｜—
- 2026-10-21｜評估｜Codex gpt-6-sol xhigh（唯讀，stdin 附關鍵檔＋14 張截圖）｜同一問題的獨立建議｜13 條建議，分段導覽、搜尋先出精準結果、手機選單只展開目前書卷、譯本授權標示等已併入 batches.md｜採用
- 2026-10-21｜查證｜Claude haiku（Explore）｜查證另一個 AI 的 10 條事實陳述｜8 條正確或部分正確；「約書亞記只完成 12 章」錯誤（24 章都在）｜採用，見 findings.md §3
- 2026-10-21｜決策｜使用者｜回答 U-1～U-12（U-12：聽完理由後，加入主畫面維持第一次就提示，但不重疊）｜見 README

## 第 1 批：效能與基本資訊

分支 `feature/ux-b1-basics`（本地 commit，未 push）。2026-10-21 完成。

### 委派紀錄
- 2026-10-21｜B1-1、B1-3、B1-4、B1-5｜Claude haiku 子代理（worktree）｜背景圖轉 WebP 加 JPEG 備援、刪除 `* - org.jpg`（原檔移到 `C:\Obsidian\bwz-originals\`，git 歷史也有）、頁尾連結、baseUrl、刪掉 deploy.yml 的 sed、manifest `any`、序幕頁建置時注入 favicon｜全部達標｜採用；主導者沒有修改
- 2026-10-21｜B1-2｜Codex gpt-6-luna xhigh（`-s workspace-write`，在 worktree `C:\Obsidian\bwz-wt-b1-2` 直接寫檔成功）｜新增 `quartz/util/pageMeta.ts` 與測試，Head.tsx 改用新的 title／description，renderPage.tsx 改用 `htmlLang`｜4 個測試、23 個 assert 全過｜採用；主導者沒有修改。第一次執行沒跑起來：主導者的任務檔沒有寫出來，是主導者的錯，不是 Codex 的問題
- 2026-10-21｜B1-6｜Claude sonnet 子代理（worktree）｜麵包屑 rootName、explorer 的 `mapFn`（YAML 字串可以直接傳給外掛）加上同步腳本注入 frontmatter title、搜尋無結果中文化（i18n＋data 屬性）、note-properties 中文化（CSS＋`notePropertiesZh.inline.ts`，空列隱藏、預覽卡不顯示、預設收合）｜達標｜採用；主導者修了一處多刪的空白（`$items =@(`）
- 2026-10-21｜B1-6 文案｜Antigravity gemini-3.8-flash-high｜審中文用字｜採用 5 項：Obsidian 電腦版／手機版安裝說明（原本的名稱會被誤會成本站的使用說明）、本站簡介、條目資訊（原「屬性」）、簡介（原「描述」）、讀者意見回饋。沒採用的：「知識節點」改「知識條目」，因為每一章都有「本章知識節點」一節，只改資料夾名會前後不一致

### 驗收結果
- **B1-1**：亮色 `parchment.jpg` 9,153,440 B → `parchment.webp` 381,598 B（備援 JPEG 408,859 B）；暗色 7,236,372 B → 133,318 B（備援 178,575 B）；尺寸都維持 2346×1824。前後截圖（out5/51、52）肉眼看不出差異，亮色、深色都正常。
- **第一次載入量測**（完整內容建置，本機 subpath 伺服器，未壓縮）：
  - 首頁亮色 29,669 KB → 21,105 KB（少 8.4 MB）
  - 首頁深色 28,542 KB → 21,608 KB（少 6.9 MB）
  - 章節頁 28,763 KB → 22,082 KB
  - 剩下最大的是 `contentIndex.json` 19,341 KB（GitHub Pages 上 gzip 後約 7 MB），留給 B4-6。推估 GitHub Pages 上首頁第一次載入從約 16 MB 降到約 7.5 MB。
  - 深色模式少了 6.9 MB：整張暗色圖原本只有 7.2 MB，已經是能省的上限，所以「至少少 8 MB」只在亮色模式成立。
- **B1-2**：完整建置抽查都正確：
  - 創世記 1、50 章，利未記 16 章與全書目錄，約書亞記 24 章與書卷導論，亞伯拉罕，知識節點，快速入門，本站簡介
  - 首頁 `<title>` 是「聖經研讀知識庫」；`<html lang="zh-Hant-TW">`
  - 章節頁 description 從經文開始，首頁的進度條字元也不見了
  - 副作用（預期內）：zh-Hant 讓標點改成台灣的置中樣式
- **B1-3**：頁尾是「讀者意見回饋／隱私權政策／快速入門」（「Created with Quartz」那一行還在）。
- **B1-4**：og:url 是 `https://andyjr5566.github.io/Bible_wiki_zh_website/…`；deploy.yml 已經沒有 sed。本機建置現在也帶子路徑，所以 personal-notes e2e README 的 sed 和 read-aloud 的 e2e 伺服器都已更新。
- **B1-5**：序幕頁的 console 沒有 404；manifest 是 `"orientation": "any"`。
- **B1-6**：選單、麵包屑、搜尋無結果、條目頁、懸停預覽都沒有英文介面字（截圖 out3/40～47）。

### 測試
- `npx tsx --test quartz/util/*.test.ts`：68/68
- semantic-search 的 `vitest run`：9/9
- `npx quartz build -d test_content`：成功（212 個檔案）
- 完整內容建置：成功（10,293 個檔案、12 分鐘）
- 無頭 Chrome 檢查：`regress.mjs` 15/15（wiki-tour、筆記面板、深色、搜尋、SPA、PWA、我的筆記、沒有例外）、`expcheck.mjs` 9/9、`nodecheck.mjs` 11/11、read-aloud `check.mjs` 42/42（修正 e2e 伺服器的子路徑之前是 41/42）

### 發現但不在本批範圍
- **標題字型沒有載入**：`quartz.config.yaml` 的 header 字型寫成 `Noto Sans Traditional Chinese`，Google Fonts 回 HTTP 400（建置 log 每次都有這個警告）。Google Fonts 上的正確名稱是 `Noto Sans TC`。改了標題的外觀會變，所以要先問使用者。
- **本機的關係圖幾乎是空的**：本機的 `.quartz/plugins/graph` 是上游版本，不是 repo 的 `plugins/graph`（正式部署時 deploy.yml 會把 `plugins/graph` 複製過去）。改動前後的建置都一樣，不是本批造成的。本機測圖譜之前，要先把 `plugins/graph` 放進去。
- 首頁內文最上面還有「index」字樣：來自筆記庫 index.md 沒有 title，會在 B2-3 處理。

## 第 2 批：第一次進站與首頁

（尚未開始）

## 第 3 批：章節閱讀

（尚未開始）

## 第 4 批：搜尋與索引

（尚未開始）

## 第 5 批：離線與品質

（尚未開始）

## 第 6～9 批：大改版

（尚未開始）
