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

分支 `feature/ux-b2-onboarding`（本地 commit，未 push）。2026-10-21 完成。Q-3 已由使用者決定（U-13：同步時自動計算進度）。

### 委派紀錄
- 2026-10-21｜B2-1 序幕頻率｜Codex gpt-6-luna xhigh｜`openingGate.ts`（純函式＋11 個測試），Head.tsx 只用 localStorage 判斷 24 小時，主畫面 App 模式不轉址｜採用。前兩次 `-s workspace-write` 都因 `setup refresh had errors` 寫不了檔（第一次和 B2-4 同時跑），第三次改用 stdin 模式成功，由主導者貼上，並修了兩行多出的縮排
- 2026-10-21｜B2-4 影片縮圖｜Codex gpt-6-luna xhigh（workspace-write 成功）｜建置時把 YouTube iframe 換成縮圖＋播放鍵，點了才載入 youtube-nocookie｜採用。Codex 的沙箱建不了測試站，由主導者建置驗證。主導者另外做了兩處修改：沒有影片的頁面跳過整棵樹的複製（全站約 3,700 頁，只有 6 頁有影片）；字幕在 `<br>` 後面也抓得到（加了第 8 個測試）
- 2026-10-21｜B2-2 提示排隊｜Claude sonnet 子代理（worktree）｜`<html data-bwz-prompt>` 讓「加入主畫面」等導覽卡；細橫幅＋「怎麼加入」展開；手機導覽卡被切掉的問題（box-sizing）；桌機卡片移到內文欄底部；首頁導覽卡加「觀看序幕」｜採用
- 2026-10-21｜B2-2 體驗審查｜Antigravity gemini-4-argon-high 回 429（額度用完，約 79 小時後重置），依規則改用 gemini-3.8-flash-high｜採用 5 項：首頁橫幅不可和導覽卡同時出現、橫幅蓋住「?」與「筆記」、深色對比、孤字換行、觸控大小。沒採用 3 項：Android 步驟（程式本來就有 Android 分支和原生安裝鈕，截圖是 iPhone UA）、首頁的「index」（B2-3 已修，截圖是在同步之前拍的）、桌機卡片位置（可以關掉，原本是蓋住目錄）
- 2026-10-21｜B2-2 修正｜同一個 sonnet 子代理（SendMessage 續用）｜上面 5 項｜採用
- 2026-10-21｜B2-3 首頁｜主導者起草；gemini-3.8-flash-high 審文案，全部 OK；**使用者確認後**才寫入筆記庫 `C:\Obsidian\Hermes\scripture\index.md`（原檔備份在 scratchpad `b2-3/index.vault-backup-*.md`，筆記庫沒有 commit）。用 `sync_content.ps1 -NoPush` 同步｜採用。注意：同步腳本預設會 `git add -A`、commit，並 push 到 main，**只能用 `-NoPush` 跑**
- 2026-10-21｜B2-3 自動進度｜Claude sonnet 子代理（主導者手動建的 worktree；Agent 的 worktree 隔離因為磁碟代號大小寫 `c:`／`C:` 拒絕建立）｜`Update-HomeProgress` 依章節檔數改寫標記之間的內容｜5 個情境全過（沒有變化時不改檔；加了士師記 2 章時更新成 213 章；沒有標記時只警告；LF／CRLF／BOM 都保留）｜採用

### 驗收結果
- **B2-1**：瀏覽器實測：第一次來會轉到序幕；同一分頁或新分頁再來不轉；超過 25 小時會轉；`?skip=1` 不轉，而且之後也不轉；`?opening=1` 會強制轉。主畫面 App 模式也在瀏覽器實測：在頁面載入前注入 `navigator.standalone = true`（iPhone 主畫面的訊號），第一次啟動和隔了 25 小時都停在首頁，也沒有記錄時間；一般瀏覽器的對照組會轉到序幕。Android／桌面 PWA 那一支的實測見下方「最終版本複驗」。序幕頁的「翻開」「跳過序幕」本來就會記錄時間，不會被彈回序幕。
- **B2-2**（sonnet 子代理的 CDP 腳本，主導者看過截圖）：
  - 手機第一次進站，每 0.5 秒取樣一次，導覽卡和橫幅從來沒有同時出現。
  - 首頁上下捲動時，導覽卡在的時候橫幅都不出現。
  - 橫幅出現時，「?」和「筆記」都抬到橫幅上方，而且點得到。
  - 手機導覽卡在畫面內（l=16、r=374）；桌機卡片不碰到目錄和反向連結。
  - 深色對比都 ≥ 4.5:1；「不再提示」與 ✕ 的觸控範圍 ≥ 44px。
  - `tourcheck.mjs` 在完整內容建置上：桌機 20/20、手機 24/24。
- **B2-3**：完整建置的首頁 `<title>` 與頁首都是「聖經研讀知識庫」，總數是 211 章，「按主題查詢」不見了，HTML 註解標記不會顯示。BOM 加 frontmatter 可以正常解析（有實測）。
- **B2-4**：完整建置的 16 支影片全部變成縮圖，頁面上 0 個 YouTube iframe。aria-label 帶有影片標題；點擊後載入 `youtube-nocookie.com/embed/…?autoplay=1`。手機 390 不會左右捲。建置時間沒有變慢（12 分鐘）。

### 測試
- `npx tsx --test quartz/util/*.test.ts`：87/87
- `npx quartz build -d test_content`：成功
- 完整內容建置：成功（10,294 個檔案）
- 無頭 Chrome 檢查：`regress.mjs` 15/15、`expcheck.mjs` 9/9、read-aloud `check.mjs` 42/42、`tourcheck.mjs`（完整內容）20/20＋24/24

### 最終版本複驗（2026-10-21，在 HEAD 建出的 test_content 上）
- `uxcheck2`（修正後的規則）：30 項全部 PASS。
  - 首頁上下捲動取樣，導覽卡在的時候橫幅都不出現。
  - 橫幅出現時，「?」和「筆記」不交疊，而且點得到；toast 不交疊。
  - 對比：深色 8.13／6.19、淺色 6.69／6.33；觸控範圍 ≥ 44px；沒有孤字。
  - 桌機卡片不碰到目錄和反向連結。
  - 沒有 JS 例外。
- `uxcheck`（第一版）：第一次進站每 0.5 秒取樣 8 秒（`-- -- -- W- W- …`），從來沒有同時出現，其餘也都 PASS。只有 1 項 FAIL：「首頁捲過導覽卡後出現橫幅」，這是舊規則，已經依審查意見刻意改掉，新規則由 `uxcheck2` 驗證。
- 主畫面 App 模式的兩條路都在瀏覽器實測：iPhone 用 `navigator.standalone`；Android／桌面 PWA 用 `matchMedia('(display-mode: standalone)')` 覆寫，因為無頭 Chrome 的 display-mode 模擬無效。兩條路的第一次啟動和 25 小時後都停在首頁、不記錄時間；一般瀏覽器的對照組會轉到序幕。
- gemini-3.8-flash-high 複審最終截圖（14 張）：上一輪 5 項都已修好，沒有新問題，結論是可以上線。

### 注意
- test_content 的章節頁經文連結會變淡，因為連結的條目頁不在 test_content 裡（會被標成 `broken`），不是回歸。
- 這一批的同步也帶進筆記庫裡其他正在進行的檔案，但它們只有換行符號不同，git 正規化之後沒有實際變更，所以沒有 commit。

## 第 3 批：章節閱讀

分支 `feature/ux-b3-reading`。開工時問了 Q-2、Q-4、Q-5，使用者決定 U-14（explorer 複製成本地外掛）、U-15（不標示譯本，B3-8 不做）、U-16（圖譜＝B 的扇形圖加上 C 的分類清單）。使用者要求：動手之前先說要做什麼；問題要用白話解釋。

### 委派紀錄
- 2026-10-21｜B3-8 查證｜Claude haiku（Explore）｜查經文譯本｜和合本（神版），專案沒有寫版本和授權｜使用者決定不標示
- 2026-10-21｜B3-1 選單捲動｜Codex gpt-6-luna xhigh（workspace-write 成功）｜主導者先把上游 explorer 複製到 `plugins/explorer`；Codex 把 `scrollIntoView` 改成只捲清單本身，並改了 config 和 deploy.yml｜採用。主導者修了兩處：上游 `.gitignore` 會忽略 `dist/`（拿掉）；`.quartz/plugins/explorer` 改成和 read-aloud 一樣的連結（120000 項目加本機 junction，加 `skip-worktree`，因為這台建 symlink 要系統管理員權限）
- 2026-10-21｜B3-5 Strong 編號｜Codex gpt-6-luna xhigh｜workspace-write 又出現 `setup refresh had errors`，改用 stdin 模式；建置時把編號包成 `.strong-no`｜採用。出埃及記 12 章 33/33 個編號都包到；95 個單元測試全過
- 2026-10-21｜B3-3、B3-6｜Claude haiku 子代理｜只改 CSS：內文以 h1 開頭時隱藏 article-title；預覽卡拿掉麵包屑和重複標題；右側目錄對比 2.1 → 15.2（淺色）、2.6 → 11.6（深色）｜採用。主導者拿掉「首頁例外」：首頁同步後也有同名 h1，不拿掉會出現兩個標題
- 2026-10-21｜B3-4 手機導覽｜Claude sonnet 子代理｜`folderDefaultState: collapsed`（只展開目前這卷）；手機版的章節快捷列 `chapterQuickBar.inline.ts`（書卷章名、上一章、下一章、本章整理、回到頂端；朗讀列會排在它下方；桌機不顯示）｜採用。regress 15/15、expcheck 9/9、朗讀 42/42。子代理回報「桌機 scrollY = 383」：那是它的副本裡還沒有 B3-1 的修正，要在整合後驗證
- 2026-10-21｜B3-7a 圖譜樣稿｜主導者用出埃及記 12 章的真實資料（68 個鄰居）做 A／B／C 三種樣稿；gemini-3.8-flash-high 審查推薦 C｜使用者選 B 的圖加上 C 的清單
- 2026-10-21｜B3-7b 圖譜實作｜Codex gpt-6-luna xhigh（workspace-write 成功）｜本頁小圖改成固定扇區（不跑 force），下方加分類清單（每類 4 個，「＋N」展開，滑過名稱時高亮節點）；放大 modal 維持原樣｜8 個測試全過；瀏覽器驗證放在最後的完整建置
- 2026-10-21｜B3-2 Aa 外觀面板｜Claude sonnet 子代理（做到一半碰到用量上限；19:01 用 SendMessage 續做，保有原本的脈絡）｜新外掛 `plugins/site-ux`：底色（沿用 `theme-bg`，舊設定會延續）、字級（中＝原本大小）、經文連結（明顯＝預設／低調／隱藏，只影響經文清單）；首次繪製前就套用設定；鍵盤、44px｜採用。外掛自己的 e2e 117/117、vitest 18/18
- 2026-10-21｜整合修正（主導者）｜以下幾項：
  - 手機工具列是 sticky 貼頂的，快捷列原本 `top:0` 會蓋住它，改成排在工具列下面。
  - 朗讀外掛用 inline style 設 top，蓋過了樣式表的規則；改成快捷列顯示時由 `html.bwz-cqb-on` 加 `!important` 讓朗讀列排在兩者下面。read-aloud check 原本 41/42，修正後 42/42。
  - 手機工具列加 backdrop blur。
  - `.quartz/plugins/site-ux` 改成連結（同 explorer 的做法）。
- 2026-10-21｜收尾｜Claude haiku 子代理｜導覽「舒適閱讀」那一站改指向 Aa 按鈕，文案更新；刪除死掉的 `.puremode` CSS｜採用。主導者另外把 personal-notes `uicheck.mjs` 和 notes.scss 註解裡的 `.puremode` 改成 `.site-ux-btn`
- 2026-10-21｜截圖體驗審查｜gemini-3.8-flash-high（14 張）｜它列的「嚴重問題」查證後多半不成立：
  - 「創世記沒回到頁首」：截圖是 site-ux 測試自己捲動過的畫面，實測 scrollY = 0。
  - 「首章快捷列沒有下一章」：test_content 沒有導覽表，完整內容是有的。
  - 「抽屜書名被切」：那是清單捲到中間的正常畫面。
  - 「深色神學標籤看不清」：截圖裡是黃字，看得清楚。
  - 「條目頁文字重疊」：其實是首訪導覽卡蓋在上面。
  - 「恢復預設太小」：本來就有 min-height 44px。

  採用的：扇形標籤 11 → 12px（13px 會讓小扇區的標籤相撞）、快捷列按鈕間距 2 → 6px。沒有處理（原本就存在、不在範圍內）：手機浮動按鈕會蓋住內文、深色模式的經文連結底色（讀者可以在 Aa 面板改成低調）

### 驗收結果（完整內容建置，7 分鐘，10,296 個檔案；外加 test_content 建置）
- **B3-1**：出埃及記 12 章、逾越節羔羊條目、創世記 40 章（50 章的測試站），scrollY 都是 0；左側清單自己捲到目前章節。
- **B3-2**：預設的計算樣式和沒加面板的版本一樣；各種設定組合、重新整理與 SPA 換頁後保留、本章整理的 46 個連結不受影響、鍵盤、手機 390、舊「素」設定延續，全部 PASS（117/117）。
- **B3-3／B3-6**：每頁只有一個可見 h1（章節、條目、首頁）；預覽卡第一屏就看到「定義」；目錄對比淺色 15.2、深色 11.6。
- **B3-4**：手機抽屜只展開「02 出埃及記」，第 12 章在畫面內；快捷列在工具列下方（76–121px），Aa 點得到；按鈕是上一章、下一章、本章整理、↑；沒有橫向捲動；播放朗讀時，朗讀列在快捷列下面。
- **B3-5**：出埃及記 12 章 33/33 個 `.strong-no`；淺色、深色都可讀。
- **B3-7**：出埃及記 12 章有 7 個扇區、68 個節點，清單每類 4 個加「＋11」等；展開後 15 個全部顯示；滑過名稱時節點高亮；點「摩西」用 SPA 換頁，換頁後清單沒有重複；放大 modal 維持原樣。
- **B3-8**：依 U-15 不做。

### 測試
- `quartz/util/*.test.ts`：95/95
- vitest：semantic-search 9/9、graph 8/8、site-ux 18/18、explorer 4/4
- 無頭 Chrome（完整內容）：`regress.mjs` 15/15、`expcheck.mjs` 9/9、`nodecheck.mjs` 11/11、`uicheck.mjs` 16/16、`tourcheck.mjs` 20/20＋24/24
- 無頭 Chrome（test_content）：read-aloud `check.mjs` 42/42、site-ux `check.mjs` 117/117

### 注意
- 使用者反映電腦變慢：當時有 4 個幫手同時建置、跑無頭 Chrome。之後改成一次只跑一個重的工作。另外看到 4 個 vite preview（筆記庫的「亞當到耶穌」互動網站）和 9 個 vexp MCP server，都不是這個工作開的，沒有動。
- 在 worktree 裡 `npx quartz build` 會解析到錯的套件而卡住，改用 `node quartz/bootstrap-cli.mjs build`。
- `plugins/graph` 沒有 node_modules；這次在 worktree 裡執行 `npm ci` 才能建置。部署時只會把 `plugins/graph/dist` 複製過去，所以 dist 一定要提交。

## 第 4 批：搜尋與索引

分支 `feature/ux-b4-search`，從 main（`f7cb697e`，含右欄修正）建立。開工時使用者決定：先推右欄修正再開工；類型標籤用和關係圖一樣的分類（U-17）。

### 改動前基準（正式站 `f7cb697e`，2026-10-22，無頭 Chrome 全新設定檔）

- 出埃及記 12 章第一次載入：全部傳輸 7,787 KB，其中 `contentIndex.json` 6,906 KB（解壓後 19,335 KB）。
- 搜尋「逾越節」：第一筆結果在輸入後 1.3～2.0 秒出現。前 8 名：語意「原文 逾越（Pesach）」「歷史 逾越節」「解經爭議 逾越節與無酵節的名稱重疊」，接著精準比對的創世記 22 章、出埃及記全書目錄、創世記 8 章、出埃及記書卷導論、出埃及記 11 章（出埃及記 12 章不在前 8 名）。

### 委派紀錄

| 任務 | 給誰（模型、等級） | 做什麼 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|---|
| B4-6 調查 | Claude Plan 子代理（sonnet，第 2 級） | 找出誰讀 contentIndex.json，提出拆分方案 | 讀取點只有圖譜、檔案總管、搜尋（404 頁只用 key）；沒有社群外掛讀 content；搜尋的 FlexSearch 索引從沒被查詢；小索引估計約 1.4 MB（gzip 約 0.25 MB） | 採用方案 A（U-18） | 抽查 renderPage、explorer、graph、sw.js 的行號屬實 |
| B4-1＋B4-2 | Codex gpt-6-luna xhigh（第 2 級），worktree `bwz-wt-b4-codex`（workspace-write 成功） | 精準先出、語意後補、4 秒逾時；精準結果排序 | 19 個測試全過、tsc 0 錯誤 | 採用（`1405a602`） | 語意 API 回傳裡有一筆格式不對時原本整包丟掉，改成只略過那一筆 |
| B4-4 解析器 | Codex gpt-6-luna xhigh（第 2 級）：workspace-write 沙箱失敗（`setup refresh had errors`，node_repl.exe 被上一個 Codex 佔用），改用 stdin 模式 | 66 卷中英文縮寫表、經文參照解析 | 27 個測試全過；tsc 1 個錯誤 | 採用（`62e3598e`） | 修 tsc 錯誤；「Jud」同時給士師記和猶大書，拿掉士師記的；補 7 個案例（Jude、約一、民 3:5-7…）；加檔頭說明 |
| B4-6 第一部分 | Codex gpt-6-luna xhigh（第 2 級；workspace-write 部分可寫，但沙箱連不到 GitHub、建置拿不到社群外掛） | 建置時產生小索引、`fetchData` 改讀小索引、`fetchFullContentIndex()`、部署檢查腳本 | 15 個測試全過；搜尋外掛的兩處改動其實沒寫進去 | 採用（`745f0a4d`） | 補上搜尋外掛 `fetchContentIndex` 改讀完整索引與型別宣告；在 worktree 實際建置：小索引 63,230 bytes（完整 875,825；gzip 10,206 對 311,593），檢查腳本通過（141 筆）；圖譜與左側選單用小索引正常 |
| B4-3 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b4-ui` | 類型標籤、摘要、類型篩選 | 24 個測試全過；截圖 8 張；手機 scrollWidth 390 | 採用（`a6a99fd6`） | 發現搜尋視窗從以前就是透明的（主題外掛把 `.search-space > *` 設透明），結果和頁面文字疊在一起；外掛的 CSS 在最低的 quartz-base 層贏不了主題，改在 custom.scss 給結果區不透明底色、背景壓暗，並在搜尋打開時藏起導覽卡與浮動按鈕 |
| B4-4 介面 | Claude sonnet 子代理（第 2 級，續用同一個） | 經文跳轉卡片、換頁後標出經節 | 41 個測試全過；10 個人工查詢全部符合（出 40:1 在測試資料裡沒有出埃及記目錄，所以是「還沒有內容」卡片；另用「創 99:1」驗證了「先看全書目錄」卡片） | 採用（`644b56ac`） | 審查截圖與程式碼，沒有修改 |
| B4-6 第二部分 | Codex gpt-6-luna xhigh（第 2 級；沙箱有 8 次錯誤但仍寫進檔案） | 搜尋延後載入完整索引、拿掉 FlexSearch | 47 個測試全過、tsc 0 錯誤 | 採用（`805a5de6`） | 套用文案審查的修改；另外把精準比對的正規化全文做成快取（`bae0e167`），完整站 20 MB 文字不必每次查詢都重算 |
| B4-5 | Codex gpt-6-luna xhigh（第 2 級）：workspace-write 完全失敗（17 次 `setup refresh had errors`，沒有改到檔案），改用 stdin 模式 | 鍵盤、aria、公告、篩選列移出 listbox | 52 個測試全過；刪除行都是有意的改動，沒有刪註解 | 採用（`a20f4347`） | axe 找到 2 個 serious：深色模式命中字對比 4.15（字改白，約 5:1）、標籤的 `<ul>` 直接放文字（包成 `<li>`，原本就有的問題）；修完深色、淺色都是 0 |
| B4-6 交叉審查 | Antigravity gemini-3.8-flash-high | 審 B4-6 三個提交 | 高 2、中 1：完整索引下載失敗後永久快取失敗的 Promise，重試失效；兩邊都失敗時提示自相矛盾；檢查腳本與小索引對非物件條目的規則不一致 | 三點都屬實、都修（`27776274`） | |
| B4-1 補強 | Codex gpt-6-luna xhigh（第 2 級，stdin 模式） | 完整站量到「摩西」1,043 ms：1,263 筆每筆都算摘要、建卡片。改成摘要延後計算、一次先畫 60 筆加「再顯示 60 筆」，篩選改重畫 | 57 個測試全過；註解行數不變 | 採用（`df5cd62f`） | 索引一到就先算好正規化全文；debounce 150→100 ms；一次先畫的筆數 60→30；「再顯示」按鈕在 listbox 裡，axe 報 critical，加 `role="option"` |
| 導覽文字 | 主導者 | wiki-tour 的搜尋步驟還寫「AI 語意」「精準比對」，改成新名稱並教用「章節」篩選（`d179c4cc`） | | | |
| B4-3／B4-4 文案 | Antigravity gemini-3.8-flash-high | 搜尋框 19 條中文介面文字審查 | 10 條建議修改；最重要：「士師記還沒有內容」可能被讀成聖經書卷沒有內容，改成「研讀頁還在整理中」；去掉「索引」等技術用語；「精準比對／語意相關」詞性不對稱 | 大部分採用（徽章改「完全相符」；跳到…保留） | 等 B4-6 第二部分整合後一起改字 |

### 驗收結果（完整內容建置，3,756 個檔、約 7 分鐘；外加 test_content 與 tc-graph 小站）

- **B4-1**：精準結果先出、語意後補。用 CDP 攔截模擬：
  - API 慢 6 秒：精準 60 筆約 0.3 秒出現，4.3 秒出現「語意搜尋暫時沒有回應」；
  - API 回 500：精準結果出現後馬上有同一句提示；
  - 完整索引慢 3 秒：先出語意結果加「正在尋找完全相符的結果…」，3.2 秒補上精準結果。
  - 完整站從輸入到精準結果（含 100 ms debounce，頁內 MutationObserver 量；最後一次完整建置、全新的 Chrome 設定檔，連跑 3 次）：逾越節 227–234 ms（第一次查詢）、摩西 185–198 ms、亞伯拉罕 153–160 ms、挪亞 146–154 ms。全部在 300 ms 內。
  - 過程：一次先畫 60 張卡片時，第一次查詢在全新瀏覽器量到 301 ms，所以改成一次先畫 30 張（「再顯示 30 筆」）。
  - 徽章改成「語意相關」，不顯示百分比。
- **B4-2**：完整站前 5 名，主導者人工檢查都合理：
  - 逾越節：歷史〈逾越節〉、解經爭議〈逾越節與無酵節的名稱重疊〉、神學〈基督預表（逾越節羔羊）〉、解經爭議〈三位祭司能否宰殺所有逾越節羊羔〉、〈二月逾越節是否只有一天〉。標題含「逾越節」的條目排在前面；出埃及記 12 章排第 13，可以按「章節」篩選。
  - 摩西：人物〈摩西〉、神學〈摩西的代求〉、事件〈摩西不得進入應許之地〉…
  - 挪亞：人物〈挪亞〉第一。
  - 亞伯拉罕：人物〈亞伯拉罕〉、神學〈亞伯拉罕之約〉、附錄〈創圖四〉亞伯拉罕的生平…
- **B4-3**：每筆有類型標籤（關係圖的顏色）與摘要（桌機 1 行、手機 2 行）。篩選列例如「全部 1263／人物 78／地點 75…」，可用。手機 390 寬沒有橫向捲動。截圖在 scratchpad `b4/shots-final`。
- **B4-4**：解析器 27 個測試涵蓋 66 卷。人工案例全部正確：
  - 出12:3、出埃及記 12:3、出 12、Exod 12:3、Gen 1:27、創 2:7、民數記 3:5-7 都跳到該章並標出該節；
  - 創 99:1 顯示「先看目錄與綱要」卡片；
  - 士師記 3 顯示「士師記的研讀頁還在整理中」；
  - 逾越節、摩西不出現經文卡片。
- **B4-5**：只用鍵盤完成一次搜尋：
  1. Ctrl+K 打開；
  2. 打字，公告「找到 1263 筆結果」；
  3. ↓↓↑ 移動，`aria-activedescendant` 與 `aria-selected` 同步；
  4. Tab 到篩選鈕，焦點在 dialog 內循環；
  5. Enter 開啟；
  6. Esc 關閉，焦點回到搜尋按鈕。
  
  axe（4.10.2，搜尋視窗打開且有結果，頁面分別以淺色、深色載入）：0 個問題。
- **B4-6**：非搜尋頁第一次載入只抓 `contentIndex.slim.json`；滑鼠移到搜尋按鈕後才抓 `contentIndex.json`。部署檢查腳本：3,789 筆的 key 與欄位一致。圖譜（扇區與分類清單）、左側選單（3,775 個連結）、懸停預覽都正常。

### 傳輸量前後對照（出埃及記 12 章第一次載入）

| | 改動前（正式站實測傳輸量） | 改動後（完整建置，頁面實際抓的檔案 gzip 後加總；GitHub Pages 會 gzip） |
|---|---|---|
| 全部 | 7,787 KB | 790 KB（−90%） |
| 內容索引 | `contentIndex.json` 6,906 KB | `contentIndex.slim.json` 315 KB |

- 首頁 707 KB；條目頁（人物／摩西）892 KB。
- 最後一次完整建置後重跑：`regress.mjs` 15/15；延後載入、API 慢／失敗、索引慢、鍵盤流程都通過；axe 淺色、深色都是 0。
- 索引檔：完整 19,804,980 bytes（gzip 7,009,857）；小索引 1,841,096 bytes（gzip 322,929）。
- 小索引小於 service worker 的 3 MB 上限，所以會被離線快取，離線時關係圖和左側選單也能用。

### 測試

- vitest：semantic-search 57/57（7 個檔）。
- `npx tsx --test quartz/util/slimContentIndex.test.ts quartz/components/renderPage.test.ts`：15/15。
- 無頭 Chrome（完整內容）：
  - personal-notes `regress.mjs` 15/15（wiki-tour、搜尋、SPA、深色、筆記面板、PWA、無例外）；
  - `nodecheck.mjs` 11/11；
  - 自寫的 `lazycheck.mjs`（延後載入、API 慢或失敗、索引慢）、`kbcheck.mjs`（鍵盤流程）、`axecheck.mjs`（axe）、`measure.mjs`（傳輸量）都通過。腳本在 scratchpad `b4/`。

### 注意

- Codex 沙箱這一輪多次 `setup refresh had errors`：B4-4 解析器、B4-5、B4-1 補強改用 stdin 模式；B4-6 第一部分在沙箱裡連不到 GitHub，建置由主導者做。
- 手動建的 worktree 要建置，要把 `.quartz/plugins/<本地外掛>` 換成 junction，並把每個社群外掛的 `node_modules` 與 `dist`（被 .gitignore 忽略）也用 junction 連回主 repo，否則建置會卡在安裝外掛，或章節頁不會產生。腳本：scratchpad `b4/setup-wt.ps1`。
- 搜尋外掛的 CSS 在最低的 `quartz-base` 層，贏不了主題外掛；網站層的覆寫要寫在 `quartz/styles/custom.scss`。
- 在 Git Bash 傳以 `/` 開頭的網址路徑給 node 時要加 `MSYS_NO_PATHCONV=1`，否則會被改成 `C:/Program Files/Git/...`。
- 測試站的 service worker 會攔下同網域請求，讓 CDP 的 Fetch 攔截看不到；測試時用 `Network.setBypassServiceWorker`。


## 第 5 批：離線與品質

（尚未開始）

## 第 6～9 批：大改版

（尚未開始）
