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
| 獨立驗收 | Claude sonnet 子代理（沒有參與實作，自己寫腳本、會 gzip 的伺服器，照 findings §5 量） | 在完整建置上逐條量測 B4-1～B4-6 | B4-1、2、3、5、6 通過；**B4-4 不通過**：「出12:3」「出 12」同時有全文結果時，經文卡片排第一但選取落在第一筆全文結果，按 Enter 跳錯頁。另指出 790 KB 的量法沒算到外部資源，照 §5 應是 1,431 KB | 採用 | 原因是經文卡片晚出現（要先查小索引），重畫時「保留選取」把選取留在第一筆全文結果。改成只保留使用者自己移過的選取（`selectionTouched`）。重新完整建置後，用驗收員的 `b44.mjs` 重跑：9 個案例全部正確；`b45.mjs` 淺色、深色 axe 0；`b41.mjs` API 慢、失敗各 3 次全新設定檔，24 個值最大 248 ms |
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
  - 排序（與原本行為不同，需要讓使用者知道）：語意結果接在完全相符的結果後面，不和它們混排。完全相符的結果一定先出現，語意相關的結果在後面補上。
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

### 逐條驗收判定（2026-10-22，最後一次完整建置 `a4edc008`）

量測環境：
- 這台電腦（Windows 11，ARM64）上的無頭 Chrome，每次都用全新的設定檔，並清空快取（`Network.setCacheDisabled`）。
- 網站是完整內容建置（3,756 個檔、3,789 筆索引），用 `subpath-server.mjs` 在 `/Bible_wiki_zh_website/` 子路徑提供，和正式站的路徑一樣。
- 語意 API 的「慢」與「失敗」用 CDP 的 Fetch 攔截模擬：慢 6 秒、回 500。
- 傳輸量是頁面實際抓的檔案，從建置輸出讀檔後 gzip 加總（正式站 GitHub Pages 會 gzip）。

**B4-1～B4-6（batches.md 的驗收欄）**

| 編號 | 驗收標準 | 證據 | 判定 |
|---|---|---|---|
| B4-1 | 模擬 API 很慢或失敗時，精準結果在 300 ms 內出現（獨立驗收：兩種情況各 5 次、每次全新設定檔、共 40 個量測值，最大 287 ms） | 頁內 MutationObserver 量（含 100 ms debounce），全新 Chrome 連跑 3 次：逾越節 227–234、摩西 185–198、亞伯拉罕 153–160、挪亞 146–154 ms。API 慢 6 秒時精準結果約 261 ms 出現，4.25 秒出現提示；API 回 500 時約 253 ms 出現（後兩項是每 100 ms 輪詢一次的外部量測，數字偏大） | 通過 |
| B4-1 | 單元測試 | `searchFlow`（逾時、取消、失敗、成功、去重、結果組合、索引重試）在 57 個 vitest 裡 | 通過 |
| B4-2 | 「逾越節」「摩西」「挪亞」「亞伯拉罕」前 5 名由主導者人工檢查合理 | 完整站前 5 名見上面「驗收結果」，主導者逐一檢查都合理（標題完全相同的排第一） | 通過 |
| B4-2 | 單元測試 | `rankExactMatches`、`getSlugKind`（分層、次數、交錯合併、穩定、逾越節案例） | 通過 |
| B4-3 | 截圖；類型篩選可用；手機版面正常 | 截圖在 scratchpad `b4/shots-final`；篩選「人物 78」等可用（`kbcheck` 用 Tab 進入篩選列）；手機 390 寬 `scrollWidth` = 390 | 通過 |
| B4-4 | 縮寫表單元測試 ≥ 66 卷 | `scriptureRef.test.ts` 用迴圈測 66 卷的全名、中文縮寫、英文名 | 通過 |
| B4-4 | 10 個人工案例都正確 | 第一次判定有誤：獨立驗收員實際按 Enter，發現「出12:3」「出 12」跳錯頁（主導者先前只在沒有其他結果的情況下按過 Enter）。修正後重新完整建置，用驗收員的腳本重跑：出12:3、出埃及記 12:3、出 12、Exod 12:3、Gen 1:27、創 2:7、民數記 3:5-7 按 Enter 都跳到正確的章並標出正確的節（例如出12:3 標出「你們吩咐以色列全會眾說…」）；士師記 3 是整理中卡片、不可選；逾越節沒有經文卡片。創 99:1（目錄卡片）在 tc-graph 小站驗過 | 通過（修正後） |
| B4-5 | 只用鍵盤可以完成一次搜尋 | `kbcheck.mjs` 用真的按鍵事件：Ctrl+K → 打字 → ↓↓↑ → Tab 到篩選 → 焦點循環 → Enter 開啟（換到〈摩西的代求〉）→ Esc 焦點回到按鈕 | 通過 |
| B4-5 | axe 檢查沒有嚴重問題 | axe 4.10.2，搜尋視窗打開且有結果，頁面分別以淺色、深色載入：0 個問題（不只是沒有嚴重問題） | 通過 |
| B4-6 | 非搜尋頁第一次載入不下載完整內文索引 | `lazycheck`：載入後只有 `contentIndex.slim.json`；滑鼠移到搜尋按鈕後才有 `contentIndex.json` | 通過 |
| B4-6 | 圖譜、搜尋、預覽功能都正常 | 圖譜有扇區與分類清單；左側選單 3,775 個連結；懸停預覽出現；搜尋見 B4-1～B4-5；`regress.mjs` 15/15、`nodecheck.mjs` 11/11 | 通過 |
| B4-6 | 傳輸量前後對照寫進 progress.md | 見下一節：7,787 KB → 1,431 KB（−82%，照 §5 量法） | 通過 |

**goal-prompts.md 第 4 批的【驗證】**

| 項目 | 證據 | 判定 |
|---|---|---|
| 單元測試全過 | semantic-search vitest 57/57（5 個檔）；`quartz` 的 slimContentIndex＋renderPage 15/15 | 通過 |
| 人工查詢 7 個並截圖寫進 progress.md | 逾越節、摩西、挪亞、亞伯拉罕、出12:3、Gen 1:27、士師記 3：結果見「驗收結果」，截圖在 scratchpad `b4/shots-final` | 通過 |
| 模擬 API 很慢與失敗 | 見 B4-1 | 通過 |
| 只用鍵盤完成一次搜尋 | 見 B4-5 | 通過 |
| 量測非搜尋頁第一次載入的傳輸量（前後對照） | 見下一節 | 通過 |
| test_content 與完整內容建置都成功 | tc-graph／test_content 小站建置多次成功；完整內容建置成功（7 分鐘、3,756 個檔），`checkContentIndex` 3,789 筆一致 | 通過 |
| 圖譜、懸停預覽、個人筆記搜尋沒有回歸 | 見 B4-6；個人筆記的條目連結用 `links.json`，`nodecheck` 11/11 | 通過 |

**完成條件**
- (a) B4-1～B4-6 逐條通過，已寫進本檔（上表）。
- (b) 傳輸量前後對照，見下一節。
- (c) 繁體中文摘要已給使用者。

### 傳輸量前後對照（出埃及記 12 章第一次載入）

| | 改動前（正式站實測傳輸量） | 改動後（完整建置） |
|---|---|---|
| 全部 | 7,787 KB | **1,431 KB（−82%）**：獨立驗收員照 findings §5 量，用會 gzip 的伺服器加 `transferSize` 加總，含導覽那一筆 |
| 內容索引 | `contentIndex.json` 6,906 KB | `contentIndex.slim.json` 315 KB |

- 同樣方法：首頁 `?skip=1` 1,171 KB；條目頁（人物／摩西）1,356 KB。
- 主導者先前寫的 790 KB（−90%）是「本站檔案 gzip 後加總」，沒算到背景圖 parchment.webp、Google Fonts 的 CSS、jsDelivr 的 d3 等外部或另計的資源，所以偏樂觀。以獨立驗收員照 §5 量的 1,431 KB 為準。
- 最後一次完整建置後重跑：`regress.mjs` 15/15；延後載入、API 慢／失敗、索引慢、鍵盤流程都通過；axe 淺色、深色都是 0。
- 索引檔：完整 19,804,980 bytes（gzip 7,009,857）；小索引 1,841,096 bytes（gzip 322,929）。
- 小索引小於 service worker 的 3 MB 上限，所以會被離線快取，離線時關係圖和左側選單也能用。

### 推上 main 之後的修正（2026-10-22，分支 `feature/ux-b4-polish`）

第四批推上 main（`17e06af2`）後，使用者用手機截圖回報「預覽文字」有問題，並要求拿掉大關係圖的分類文字；另外請 Sonnet 子代理在正式站做了一輪瀏覽器量測（原始資料在 scratchpad `live/results.json`）。

| 問題 | 原因 | 修正 | 驗證 |
|---|---|---|---|
| 搜尋結果摘要和搜尋詞無關：看到文末的參考資料網址、沒有標示命中 | `highlight()` 只把「以搜尋詞開頭的詞」算命中；中文的命中多半在詞中間，沒有任何視窗得分，結果取到文件最後一段 | 新增 `snippet.ts`：先在全文找搜尋詞實際位置，取前後的字；流程圖原始碼、網址、「來源依據」行當雜訊 | 用正式站索引（3,789 筆）：「守約」54 筆全部有標示、含網址 0、含轉義符號 0；摩西／逾越節／亞伯拉罕／耶和華／出埃及／申命記，含網址從約 1% 降到 0～1 筆（只剩搜尋詞只出現在來源行的情況）；vitest 13 個新測試 |
| 摘要顯示 `&lt;br/&gt;`、`--&gt;`（Mermaid 流程圖原始碼） | 157 筆內容含流程圖，索引裡已轉義，顯示時又轉義一次 | 還原 `&lt; &gt; &amp;` 與 `<br/>`，跳過流程圖行 | 同上 |
| 摘要從句子中間開始 | 以空白切詞、取固定詞數的視窗 | 從命中前最近的句末標點之後開始，30 字內找不到才加「...」 | 同上；本機 test_content 瀏覽器：摩西 13／13、亞伯拉罕 7／7、逾越節 8／8、立約 5／5 張卡片都有標示 |
| 大關係圖有分類文字（U-19） | `renderCategorizedModalGraph` 畫 `graph-modal-cluster-label` | 拿掉分類文字與它的位置計算和樣式 | 完整站：摩西條目 258 節點、出埃及記 13 章（桌機、手機 390 寬）都是 0 個分類文字，圖例還在，右側小圖標籤保留，無 JS 例外 |
| 篩選列折成 6 行（180 px）、1200 寬 7 行（208 px） | `flex-wrap: wrap` 在窄的結果欄 | 一行、橫向捲動，滑鼠滾輪可捲，桌機顯示細捲軸 | tc-graph 小站：1440／1200 寬都是 48 px，手機 38 px；滾輪 160 → `scrollLeft` 160；手機沒有橫向頁面捲軸。桌機頁面本來就比可視區寬 15 px（頁面用滿 100% 寬度，右邊又有 15 px 的垂直捲軸），正式站舊版相同，開搜尋前後不變，不是這次造成的 |
| 螢幕閱讀器在還有結果時說「找不到相符的結果」（正式站 6 次中 3 次） | 精準結果 0 筆就公告「找不到」，但語意結果還在路上、畫面上也有經文卡片 | 精準 0 筆改說「沒有完全相符的結果」；全部來源都結束、沒有卡片才說「找不到相符的結果」；「整理中」卡片也念出來 | 本機瀏覽器，模擬語意 API 失敗與 1.5 秒後回 1 筆：士師記 3 與不存在的詞都沒有誤說「找不到」 |
| 「士師記 3」在完全沒有結果時有兩張卡片（整理中＋找不到） | 「整理中」卡片出現時仍補一張 no-match 卡片 | 有經文卡片就不補 | 本機瀏覽器：卡片只有 1 張；正式站有語意結果時本來就沒有雙卡 |
| B4-1 餘裕太薄（正式站量到 235–288 ms，上限估計 312 ms） | 等待 100 ms ＋ 精準比對與排序約 30 ms（Node 量）＋ 瀏覽器繪製 | 「停止輸入後才搜尋」由 100 ms 降到 60 ms | 完整站（本輪建置）API 很慢與失敗各 3 次、全新 Chrome：24 個值最小 105、最大 **181 ms**（上一輪最大 248 ms），每次都是 30 張完全相符卡片 |

完整站（`content/`，3,756 個檔、約 7.5 分鐘，兩份索引都是 3,789 筆）上重跑：

- B4-1：如上，24 個值全部 < 300 ms。
- B4-4：9 個案例 Enter 都到正確的章（出12:3 標示第 3 節，出 12、士師記 3 不標示）；節的標示與上一輪逐項相同。
- B4-5：axe 淺色、深色都是 0 筆違規；只用鍵盤完成搜尋，Esc 後焦點回到搜尋按鈕。
- B4-6：出埃及記 12 章第一次載入 1,432 KB（上一輪 1,431 KB），只下載小索引；滑鼠移到搜尋按鈕才下載完整索引；關係圖、左側選單、懸停預覽正常。
- personal-notes `regress.mjs` 15／15、`nodecheck.mjs` 11／11；`npx tsx --test …` 15／15；semantic-search vitest 72／72（6 個檔）；graph vitest 17／17。

正式站量測（子代理，修正前的版本）沒有改、也沒有證實問題的項目：

- 離線（頁面載入後斷線）：沒有 JS 例外；索引與 API 都連不上時只顯示「搜尋暫時無法使用，請稍後再試。」；恢復上線後要重打一次查詢才會恢復（不會自動重試）。已有索引時離線，精準結果照常，並提示語意搜尋沒有回應。這次沒有改。
- axe `incomplete` 的 color-contrast 950 個節點（elmPartiallyObscured 945）：axe 判不出背景；搜尋結果卡片的徽章、標題用疊背景色估算都在門檻以上；估算低於門檻的 12 個節點是預覽區的麵包屑分隔符號「❯」（淺色 2.3:1、深色 2.97:1）、預覽區被標示的詞（淺 3.6:1、深 3.12:1）、「首頁」麵包屑連結（淺 4.26:1），都不是搜尋結果卡片，屬於主題層，這次沒有改。估算值不能當通過或不通過的證據。
- 「其他」類型名稱：關係圖圖例也叫「其他」，U-17 規定一致，沒有改名。

### 撤掉反向連結清單（U-21，2026-10-22，分支 `feature/ux-b4-polish`）

使用者問：關係圖譜是不是就是反向連結？如果是，能不能撤掉反向連結，讓圖譜空間拓寬。

**查證（用正式站完整索引與瀏覽器）**

- 3,789 頁裡，**沒有任何一頁**的反向連結不在圖譜的相連條目裡；圖譜在 3,154 頁多出「這頁連出去、對方沒連回來」的條目，594 頁兩者完全相同。出埃及記 4 章：反向連結 35、圖譜相連 35，同一批；出埃及記 13 章 46 對 48；摩西 255 對 257。
- 瀏覽器實際畫面：圖譜分類清單裡的每個連結都在反向連結裡（兩頁的 `inGlNotBl` 都是空的）。圖譜清單每類先列 4 個，其餘按「＋N」展開（出埃及記 4 章先顯示 23／35）。
- 差別：圖譜不分方向（誰連到這裡／這裡連到誰），反向連結只有前者。

**做了什麼**

| 項目 | 改動 |
|---|---|
| 外掛 | `quartz.config.yaml` 的 backlinks 改成 `enabled: false`（保留 `quartz.lock.json`，想恢復改回 `true`）；建置少輸出 2 個檔（該外掛的 CSS 與腳本），其餘只是雜湊檔名順移 |
| 版面 | `custom.scss` 拿掉桌機右欄對 `.backlinks` 的高度與捲動規則，並更新註解 |
| 導覽 | 「誰提到了它」改成「誰和它相連」，框住關係圖譜（站數不變：桌機 21、手機 20）；技能名稱「反向連結」→「相關條目」，既有進度（已掌握、已略過）載入時轉成新名稱；說明中心的技能清單同步 |
| 說明頁（repo 自己維護的 `content/教學/`） | 快速入門、如何查一個主題（方法 4 改成「關係圖譜」）、熱鍵與功能速查、如何跨書卷找相關條目 |
| 首頁連結文字 | `sync_content.ps1` 注入的那一行拿掉「反向連結」；用 `sync_content.ps1 -NoPush` 套用，`content/` 只多動 `index.md` 那一行 |
| 沒動 | `content/README.md`、`content/專案流程說明.md`（Obsidian 同步來的，而且講的是 Obsidian 本身的反向連結功能）；`quartz/plugins/loader/conditions.ts` 的 `has-backlinks` 條件（通用機制，沒有人使用） |

**驗證**

- 右欄版面（`link_folder/人物/亞倫`，tc-graph 改前改後；完整站 `02-出埃及記/第4章`、`摩西` 改後）：

  | 視窗寬 | 圖譜寬（改前 → 改後） | 備註 |
  |---|---|---|
  | 390（手機） | 149 → 342 px | 改前與反向連結並排各半；改後佔滿整行 |
  | 700 | 304 → 652 px | 同上 |
  | 1000（平板） | 292 → 627 px | 同上 |
  | 1440（桌機） | 246 → 246 px | 右欄固定寬度；少了 246×292 的反向連結區塊，目錄多出空間 |

  頁面橫向溢出量（桌機 15 px，是垂直捲軸寬度）改前改後相同，沒有 JS 例外。
- 完整站（`content/`，10,294 個檔、約 7.3 分鐘，兩份索引都是 3,789 筆；改前 10,296 個）：
  - 三個樣本頁（章節、條目、首頁）都沒有反向連結的標記；
  - 導覽新站：標題、文字正確，桌機框住右欄圖譜、手機框住頁面下方的圖譜；舊進度 `skills: ["反向連結","搜尋"]`、`skipped: ["反向連結"]` 按「下一步」存回後變成 `["相關條目","搜尋"]`、`["相關條目"]`；
  - `regress.mjs` 15／15、`nodecheck.mjs` 11／11；
  - `tourcheck.mjs`：桌機 20／20 每次都過；手機 24／24，新版 5 次有 1 次 23／24、舊版（改前）3 次有 1 次 23／24，失敗的是**同一項**（手機導覽框住筆記面板，框只有 3 px 高、落在畫面最底），所以是既有的間歇性問題，不是這次造成的，這次沒處理。

**取捨與尚未做的**

- 失去方向資訊（誰連到這裡 vs. 這裡連到誰）。如果以後需要，可以在圖譜清單裡加標記，或把 `enabled` 改回 `true`。
- 桌機的圖譜寬度沒變（右欄固定 246 px）；要在桌機拓寬需要改整頁的格線欄寬，這次沒做。

### 測試

- vitest：semantic-search 57/57（5 個檔）。
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
- 重建 `plugins/graph/dist`：`plugins/graph/node_modules` 是指向 `C:\Obsidian\bwz-graph-node_modules` 的 junction，目錄名不是 `node_modules`，Node／esbuild 依真實路徑解析會找不到套件，`npm run build` 會失敗，而且 tsup 已先清空 `dist/`（要 `git checkout -- plugins/graph/dist` 還原）。做法：把外掛原始碼複製到 repo 外的資料夾（例如 `C:\Obsidian\bwz-gb\graph`），連同 `node_modules` 做一份真正的副本，在那裡建置，再把 `dist/` 複製回來。
- 本機 `.quartz/plugins/graph` 是上游版本（git 子模組）；部署時 CI 會把 `plugins/graph/dist/*` 複製過去。本機要測關係圖，先把 `plugins/graph/dist/*` 複製進 `.quartz/plugins/graph/dist/`（該目錄被忽略，不會進 commit）。


## 第 5 批：離線與品質

分支 `feature/ux-b5-quality`，從 main（`3e667893`，第 1～4 批與撤掉反向連結都已合併）建立。開工時使用者決定：冒煙測試另開 `smoke.yml`，用 test_content 建小站跑，和部署分開（不拖慢上線）。

### 改動前基準（test_content 小站，`3e667893`）

- axe（wcag2a/aa、wcag21a/aa、best-practice）首頁／章節／條目 × 淺深 × 1440／390：critical 2 種（`.toc-header` 的 `aria-controls` 指向不存在的 id；手機 `.explorer` 的 `aria-expanded`）、serious 4 種（導覽按鈕白字在 `#8a5cf5` 上 4.25:1；圖譜分類連結深色 2.1:1；圖譜 SVG `nested-interactive`；手機表格容器不能用鍵盤聚焦）。
- 390 px 首頁兩個表格寬 645、504 px（容器 342 px），每格 nowrap。
- 截圖 20 張（首頁、章節、條目、分類目錄、全書目錄 × 淺深 × 1440／390），scratchpad `b5/shots-base/`。

### 委派紀錄

| 任務 | 給誰（模型、等級） | 做什麼 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|---|
| B5-1 | Codex gpt-6-luna xhigh（第 3 級實作；workspace-write 成功） | 離線頁、SW v4、安裝說明、swcheck | 5 個檔，語法檢查通過 | 採用（`7cc1a95a`） | 修剪快取會刪掉最早存的項目，正好是預先存的離線頁與首頁 → 改成不刪；離線頁排序改數字順序（第2章在第10章前）、分類目錄頁顯示名稱 |
| B5-1 測試 | 主導者 | 跑 swcheck | 發現**舊的 swcheck 從來沒有真的測到離線**：`Network.emulateNetworkConditions` 只管分頁，SW 是另一個目標，照樣連得到網路 | — | swcheck 接上每個 SW 目標一起設離線（同一目標沿用同一 session，否則離線狀態留著）；離線前確認挑的頁真的不在快取；羊皮紙那項改成「超過 3 MB 的檔不進快取」（第 1 批已把背景壓到 0.4 MB 以下）（`f0979bc2`） |
| B5-1 審查 | Codex gpt-6-sol high（唯讀，stdin 模式） | 第 3 級審查 | 11 點：高 2、中 4、低 5 | 修 7 點（`df303b0b`） | 存檔交給 `event.waitUntil`；只讀本版快取；舊快取刪完才 `clients.claim`；整個網域超過 200 MB 先刪最舊 50 筆；緊急撤回範例只刪本站快取；離線頁直接打開時的根路徑、只列 HTML、恢復連線先確認連得到本站才重新整理。不改：升級清掉 v3（規格要求；代價是升級前讀過的頁面要重讀才能離線）、`ignoreSearch`（靜態站查詢字串不影響內容）、安裝全有或全無（Sol 也認為合理） |
| B5-2 盤點 | Claude Explore 子代理（haiku，第 1 級） | 盤點 e2e 腳本能不能拿來當冒煙測試 | regress.mjs 涵蓋首頁、搜尋、筆記；缺上一章／下一章（test_content 沒有章節導覽表格）與手機整頁橫向捲動；lib.mjs 寫死 Windows Chrome 路徑、沒有 `--no-sandbox` | 採用 | |
| B5-3 | Codex gpt-6-luna xhigh：workspace-write 失敗（`setup refresh had errors`），改 stdin 模式 | 首頁進度與壞連結檢查、單元測試、deploy.yml 一步 | 12 個測試 11 過（一個斷言字串是它自己留的佔位文字） | 採用（`77163b32`） | 修測試字串；書卷資料夾是連結（junction）時也要算；加檔頭說明 |
| B5-4 清單 | Antigravity gemini-3.8-flash-high（唯讀） | 無障礙審查清單 | 23 項（高 6、中 13、低 4） | 大部分採用 | 任務包寫「維持紫色系」不精確：執行時主題把強調色換成紫色（#8a5cf5），文章連結則是 custom.scss 的紅／琥珀 → 改成「保留各元素原本的色相」；圖譜 SVG 不能用 `aria-hidden`（裡面有可聚焦節點）；landmark、h1 屬主題外掛的 moderate 項目，這次不修 |
| B5-4 修正 | Codex gpt-6-luna xhigh：workspace-write 失敗，改 stdin 模式，拆兩次（A：選單、圖譜、修補腳本、表格；B：樣式、PWA 面板、筆記），輸出「搜尋／取代區塊」而不是整檔（避免刪註解） | 照篩過的清單修 | A 24 塊、B 17 塊，全部能精準套用 | 採用（`3944a703`） | 「全部收合」沒有同步新按鈕的 `aria-expanded`；hover 規則優先權太低淡底出不來；搜尋框焦點樣式被主題層蓋掉（移到 custom.scss）；筆記面板與筆記教學的紫色主按鈕也是 4.25:1；主題給表格每格 `min-width: 75px`，手機上要拿掉；「出埃及記」被拆兩行（改 `word-break: keep-all`）、進度條斷兩截（方塊包成 `aria-hidden` 的 span，手機縮成細條）。依使用者要求重構：無障礙修補從外觀面板腳本搬到 `site-ux/src/lib/a11yPatches.ts`（純函式＋8 個測試）；`#7048e8` 從 4 處改成 custom.scss 的 `--bwz-accent-strong` 一處定義 |
| B5-2 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b5-smoke` | smoke.mjs、smoke.yml、lib.mjs 的 `CHROME_FLAGS`、test_content 加章節導覽表格 | smoke 19/19、regress 15/15、swcheck 13/13、朗讀 42/42；故意弄壞搜尋會 FAIL | 採用（`87a689c6`） | 手機橫向檢查它改成固定比 390（模擬手機時頁面太寬會把 innerWidth 一起撐寬），合理；swcheck 恢復連線改成最多重新整理 4 次（它量到約一半機率第一次還是離線頁）。「準備外掛」三步在 deploy.yml 與 smoke.yml 各抄一份 → 抽成 `.github/scripts/prepare-plugins.sh` 共用（假 npx 模擬跑過） |
| B5-3 補強 | 主導者 | 完整建置上跑內容檢查 | 506 個壞連結裡 49 個是 `static/website/…/dist/` 的互動網站連結（建置後才複製進去，正式站是好的） | 採用（`17e5a0a5`） | 解析後落在 `static/` 的連結不算，另列「不計入」數量；補 2 個測試 |
| B5-4 補強 | 主導者 | 完整建置抽樣 | 長文字表格在手機仍 454～698 px：`word-break: keep-all` 讓整句中文不能斷 | 採用（`eb770c56`） | keep-all 只套在「由短詞組成」的儲存格（腳本標 `data-short-cell`） |
| B5-5 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b5-smoke` | 整理 custom.scss | `!important` 68 → 7、1,236 → 1,196 行、亂碼註解還原；做完改動後卡在驗證約 45 分鐘沒有進展 | 採用（`547136fe`） | 主導者停掉它、接手驗證：先用 HEAD 重拍「整理前」，和整理後比對 20 張整頁截圖＋14 張狀態截圖（搜尋結果、Aa 面板、純色底、手機選單）全部 0%（第一次有一張 0.24%，重拍為 0%，是繪製雜訊）；它的表格整理和 `eb770c56` 衝突，用它的檔案再手動補回那兩處 |
| B5-5 審查 | Antigravity gemini-3.8-flash-high（唯讀） | 審 CSS 整理會不會改到截圖測不到的情境 | 第一次在 plan 模式只產出計畫、停在等批准；重跑要求直接出報告。結論：沒有功能或外觀風險，拿掉的 `!important` 都不會輸給主題（主題只有 2 個 `!important`，屬性不重疊）、合併順序正確；5 項低嚴重度整潔建議（面板底色 RGB 抽變數、`div.sidebar.left/right` 與 `.section-li` 重複選擇器、`//` 與 `/* */` 註解混用、`@media all and` 寫法不一） | 結論採用；5 項建議列為後續（改選擇器會動到優先權，要重新驗證，不在這批做） | | | |

### 逐條驗收判定（最後一次完整建置 `547136fe`：3,756 頁、10,295 個檔、約 8 分鐘；外加 test_content 小站）

- **B5-1 離線頁 ✔**：swcheck 13/13（SW 目標也設成離線）：離線開沒快取的頁面 → 離線頁、網址不變、清單有已讀頁、重試可用；有快取的頁照常；恢復連線正常載入。升級測試 4/4：同網址先放改動前的站（v3）寫筆記，換成新站後只剩 v4 快取、離線頁已預存、筆記還在。離線頁 axe 0、手機無橫向捲動。安裝說明（加入主畫面面板、說明中心）改成「讀過的頁面沒有網路也能打開」。Sol 的 11 點已處理或註明理由（見委派紀錄）。
- **B5-2 冒煙測試 ✔（本機）**：smoke 19/19、regress 15/15、swcheck 13/13、朗讀 42/42；故意弄壞搜尋關鍵字 → FAIL、退出碼 1；`CHROME_FLAGS="--no-sandbox"` 有效；workflow YAML 解析通過。**還沒在 GitHub 上跑過**（要先問使用者）。
- **B5-3 內容檢查 ✔**：完整內容首頁進度「一致：211 個章節檔」；故意把出埃及記改成 39 → 3 個 `::warning`（完成數、✓、百分比），`--strict` 退出碼 1、預設 0；壞連結 457 個、166 頁（另有 49 個 static/ 連結不計入）。單元測試 14/14。
- **B5-4 無障礙 ✔**：axe（wcag2a/aa、wcag21a/aa、best-practice）小站首頁／章節／條目 × 淺深 × 1440／390、完整站首頁／出埃及記 12 章／書卷導論／逾越節羔羊：critical、serious 都是 0（改動前 critical 2 種、serious 4 種）。鍵盤 12/12（選單資料夾鈕、抽屜、目錄 aria-controls、圖譜節點焦點、搜尋框外框、減少動態）。手機表格：首頁 645 → 342 px（放得進畫面）；完整站抽樣 11 個表格 10 個放得進，1 個 378 px（4 欄長句，在可用鍵盤捲動的框裡）。桌機表格外觀不變。
- **B5-5 CSS 整理 ✔**：`!important` 68 → 7、1,236 → 1,196 行；20 張整頁截圖＋14 張狀態截圖前後 0% 差異。

### 測試

- 單元測試：semantic-search 72/72、personal-notes 328/328、site-ux 27/27（暫存資料夾補裝 jsdom 才跑得到經文清單測試）、explorer 4/4、graph 17/17、`quartz/**` 的 tsx 測試全過（含 checkContent 14/14）；`tsc --noEmit` 錯誤數改動前後相同（171 個都是舊有的互動網站與型別問題）。
- 無頭 Chrome（小站）：smoke 19/19、regress 15/15、nodecheck 10/10、swcheck 13/13、朗讀 42/42；自寫 `kb54.mjs` 12/12、`upgrade.mjs` 4/4。腳本在 scratchpad `b5/`。

### 注意

- **Chrome 的離線模擬只管分頁**：Service Worker 是另一個 CDP 目標，要另外接上設離線，而且同一目標要沿用同一個 session（新 session 設的條件會疊在舊的上面）。swcheck 已改。
- **瀏覽器設定檔不要放在含短檔名（`ANDYJ_~1`）的路徑**：非無痕模式下 Cache Storage 會壞，SW 註冊後立刻消失，看起來像網站的問題。用 `C:\Obsidian\...` 這類一般路徑。
- **截圖時主題偶爾被切換**：模擬的配色偏好在換頁後遺失，網站主題腳本就跟著系統（這台是深色）切換。`b5/shots.mjs` 每頁重設並確認，不對就修正重拍。同一個站拍兩次，章節頁 1440 仍有約 0.5～1.4% 的繪製雜訊（經文區），比對時要看差異圖。
- **主題的 CSS 在 cascade layer 裡，外掛的 CSS 在更低的 quartz-base 層**：外掛裡寫的焦點樣式會被主題的 `outline: none` 蓋掉（搜尋框就是），要寫在 custom.scss。
- **外掛的 node_modules 是 junction**（explorer、graph），而且 explorer 的依賴裡沒有 tsup：建置用 scratchpad `b5/build-plugin.ps1`（複製到 `C:\Obsidian\bwz-gb\<名稱>` 建置，再把 dist 複製回來），explorer 要再補 graph 的依賴。在暫存資料夾 `npm install` 會把其他套件清掉，裝完要補回。
- Codex 沙箱這一輪三次失敗、一次成功；stdin 模式改成輸出「搜尋／取代區塊」很好用（不會刪註解），套用腳本 `b5/apply-edits.mjs`（同樣文字出現兩次時依序套用）。
- **內容的壞連結（筆記庫的問題，不在這次範圍）**：附錄〈亞當到耶穌的家譜〉有 159 個連結指向 `appendix/website/全聖經/亞當到耶穌/dist/`，正式站上是 404（互動網站實際在 `static/website/…`）。其餘多數是連到還沒寫的章節。

### 推上 main 之後（2026-10-22，`e9102873`）

- 部署成功；冒煙測試第一次在 GitHub（ubuntu-latest）上跑：smoke、regress、swcheck 全部通過（沒有任何「冒煙測試」警告；預裝 Chrome＋`--no-sandbox` 可用）。部署的內容檢查也在 GitHub 上運作：首頁進度一致、壞連結 451 個（警告）。
- 正式站：SW 是 v4、離線頁可取得、手機首頁表格 342 px、導覽按鈕是加深的紫色；axe（首頁、出埃及記 12 章、逾越節羔羊 × 淺深 × 1440／390）critical、serious 都是 0。
- 補問使用者（規則是不確定就問，這幾件當初是主導者自己決定的）：
  - Sol 沒採用的 3 點（升級清掉舊快取、`ignoreSearch`、安裝全有或全無）：使用者同意照目前做法。
  - 子代理卡住時：使用者要「砍掉，叫同等級的子代理接手」，不要主導者自己接手（已寫進 07-agents 與記憶）。
  - 遺留項目：做 Gemini 的 5 個 CSS 整潔建議；補地標（讓螢幕閱讀器一個手勢跳到經文）（主導者一度誤把使用者的「確認理解」當成開工，停掉子代理、沒有留下改動；使用者問清楚手勢會不會誤觸連結後才同意）；手機寬表格改成「擠得進就擠（每欄至少約 4 個字寬），擠不進就在框裡左右滑＋右側陰影提示」。分支 `feature/ux-b5-followup`。

### 後續（分支 `feature/ux-b5-followup`）

| 任務 | 給誰 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|
| CSS 整潔＋手機寬表格 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b5f-css` | Gemini 5 項全做；手機上 4 欄以上的表格每欄至少 4em、能縮就縮（出埃及記 12 章 378 → 342 px）；還是放不下的（創世記 5 章家譜表 462 px、附錄家譜 536／666 px）在框裡左右滑，有內容的那一邊有淡陰影（純 CSS，只套在 a11yPatches 標成可捲動的框）；小站 20＋14 張截圖不變、完整站首頁不變、`!important` 仍 7 | 採用（`5c3c5fb7`） | 看過淺深兩張陰影截圖；沒有修改。已知限制：表頭那一列看不到陰影（表頭有實色底） |
| 地標 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b5f-landmark` | `.center` → main、左側欄 → navigation「網站導覽」、右側欄 → complementary「本頁相關」；只加 role／aria-label；純函式 `planLandmarks`＋21 個測試；axe `landmark-one-main` 1 → 0、`region` 6～32 → 0、沒有新違規；SPA 換頁不重複、空側欄會收回；截圖 20 張 0% | 採用（`d892ba46`） | 沒有修改。沒補 banner（網站名稱和選單同在左側欄，地標不能巢狀）；麵包屑的 `aria-label="breadcrumbs"` 是主題的英文；**還沒有實機螢幕閱讀器測試** |
| 麵包屑標籤 | Claude haiku 子代理（第 1 級，只改兩個檔） | 主題的 `aria-label="breadcrumbs"` 改成「目前位置」（使用者選的）；4 個測試 | 採用 | 主導者建置、跑測試 43/43、瀏覽器確認、smoke 19/19、regress 15/15 |
| 合併後驗證 | 主導者 | 小站 axe 只剩 1 個 minor（測試資料第 1 章導覽表格故意留空的表頭）；鍵盤 12/12、smoke 19/19、regress 15/15、nodecheck 10/10、swcheck 13/13。完整內容（`d892ba46`，7 分鐘）：首頁、出埃及記 12 章、創世記 5 章、逾越節羔羊 × 淺深 × 1440／390，axe 沒有 moderate 以上（只剩出埃及記 12 章內容裡一格空表頭，minor，原本就有）；手機表格全部 342 px，只有創世記 5 章家譜表 462 px（7 欄，照設計在框裡左右滑＋陰影）；兩份索引一致 | | |

### 家譜附錄的壞連結（2026-10-22，`096dd954`，已上線）

- 原因：筆記庫裡互動網站在 `appendix/website/…/dist/`，〈亞當到耶穌的家譜〉照這個位置寫了 159 個連結（Obsidian 裡可點）；同步時互動網站搬到 `static/website/…`，而 `sync_content.ps1` 的轉換規則不認得 Obsidian 的角括號寫法 `](<…>)`，所以沒轉換，網站上 404。
- 修法（使用者選「同步腳本自動轉換」，筆記庫不動）：規則支援角括號；帶 `#` 的連結（`#p=`、`#family=`）寫成完整網址（從 `quartz.config.yaml` 的 baseUrl 組），因為 Quartz 會把相對連結 `#` 後面 slug 化（`#p=%E4%BF%9D%E7%BE%85` → `#p保羅`），互動網站只認 `#p=`；加 `class="bwz-site-link"`，custom.scss 藏起外部連結箭頭。代價：本機預覽時這些連結開正式站。haiku 子代理兩次（第 1 級），主導者同步、建置、實測。
- 驗證：正式站 159 個連結（1 個開畫布、134 個 `#p=`、24 個 `#family=`）、箭頭 0 個可見；點「在網站上看這一段」直接開「亞當」的人物卡（舊寫法只顯示「選一個名字」）。部署的壞連結警告 451 → 292（剩下的多半連到還沒寫的章節或條目）。

## 第 6 批：首頁入口與書卷選擇器

分支 `feature/ux-b6-home`，從 main（`561db44f`）建立。使用者要求：大改動，每個細節都先用問題討論。

### 改動前基準（正式站 `561db44f`）

- 首頁、出埃及記 12 章 × 淺深 × 1440／390 的首屏與首頁整頁截圖，scratchpad `b6/shots-base/`。

### 委派紀錄

| 任務 | 給誰（模型、等級） | 做什麼 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|---|
| 設計方案 | Claude Plan 子代理（sonnet，第 2 級，唯讀） | 現況盤點＋3 個方案＋12 題待決 | A 彈出式選擇器（與探索並存）、B 左欄常駐取代探索的書卷、C 不彈出連回首頁；推薦 A。發現書卷表已有 4 份（同步腳本、contentChecks、personal-notes、scriptureRef） | 方案與題目拿來做樣稿、問使用者 | 核對書卷表與 collapse-rules 屬實 |
| 樣稿 | 主導者 | 把樣稿 HTML 注入正式站後截圖（`b6/mock.mjs`、`gen.mjs`），20 張 | 首頁入口 × 淺深 × 1440／390、格子全名／簡稱／手機收合、A 的手機面板與桌機彈出方塊、章末章號格、B 左欄、C 連結 | | 深色實心按鈕白字太淡改深色字；桌機按鈕文字換行；手機搜尋提示縮短 |
| 樣稿審查 | Antigravity gemini-4-argon-high → 429（額度用完，約 49 小時後重置），依規則改 gemini-3.8-flash-high（唯讀） | 附 20 張截圖審體驗 | 推薦 A，否決 B（左欄塞滿、要兩層捲動）與 C（換卷要離開閱讀頁）。高：新訪客第一屏看不到網站介紹與導覽卡；手機首頁建議格子收成按鈕；灰色書卷點了沒反應。中：簡稱對初學者像密碼；深色次要連結對比；入口的教學按鈕和導覽卡重複。低：375 px 手機工具列可能太擠；桌機彈出方塊點外面要能關；章末加「下一章」 | 待使用者決定 | 「前一章／下一章」表格與筆記提示條的深色配色是既有內容，不在本批範圍；章末「下一章」已有內容的導覽表格，不另加 |
| 方案細節 | 主導者 | 使用者選了 B，補拍 B 的細節樣稿 8 張（左欄看頁面收合、全名／簡稱、首頁兩份格子、手機抽屜），分五輪問完（決定見 README U-22） | 使用者回「開工 做完push」 | | |
| 文案審查 | Antigravity gemini-3.8-flash-high（唯讀） | 審本批新增文案 | 區塊名稱「快速開始」和「快速入門」太像 → 改「讀經入口」；灰色書卷的說明要避免讓人以為聖經缺卷；「繼續 ›」補螢幕閱讀器名稱 | 大部分採用；使用者確認定稿（scratchpad `b6/copy/copy-final.md`） | 「研讀頁」維持（首頁介紹用同一個詞）；「互動網站與附錄」維持（它建議的「網站導覽」不對，按鈕連的是互動網站） |
| L1 資料層 | Codex gpt-6-luna xhigh（workspace-write 成功，worktree `bwz-wt-b6-data`） | `config/bible-books.json`、`bibleBooks.ts`、`bookCatalog.ts`、`readingPosition.ts`＋測試；contentChecks 改讀共用檔 | quartz/util 測試 131/131；改過的檔 tsc 0 錯（worktree 多出的 66 個錯是少了 .quartz 外掛與互動網站檔，和改動無關） | 採用（`6269f1e5`） | 三個檔開頭有 BOM → 拿掉；兩個檔各有一份網址解碼 → 合併成 `canonicalSlugPath`；`scrollFromRatio` 的 topOffset 拿掉（記錄和還原同一公式，扣工具列高度反而會偏）；補「為什麼」註解 |
| S1a 選擇器 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b6-picker` | plugins/book-picker、探索濾掉書卷、手機抽屜、快捷列、手機章末 | 外掛 vitest 31/31、quartz/util 131/131；自寫 e2e 94/94（1440／390／375、淺深、axe 0 critical／serious、鍵盤、SPA、localStorage 被封鎖）；加料站（詩篇 150 章、只有目錄的士師記、馬太福音）13/13；smoke 23/23（＋4）、regress 15/15、site-ux 117/117、朗讀 42/42、expcheck 9/9（第一項改成「一開始沒有資料夾展開」，因為書卷已不在探索） | 採用（`28063acf`） | 審過：外掛 scss 的 `!important` 是外掛 CSS 在最低層的既有慣例（筆記 124、教學 135），檔頭有說明；`explorerTools` 的「全部收合」改放清單正上方（不在清單內但合理）；快捷列按鈕改 `--bwz-accent-strong`（原本 4.25:1）。`.quartz/plugins/book-picker` 在主 repo 換成 junction＋skip-worktree。已知取捨：條目頁打開手機抽屜時停在最上面的選擇器，不再把目前條目捲到中間 |
| S1b 首頁入口 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b6-hub` | plugins/home-hub、繼續閱讀、順序、進度表收合、導覽第一站 | vitest 33/33；hubcheck 49/49（無紀錄時 75 幀取樣都是導覽卡在上、不跳動；繼續後回到 0.49～0.50；SPA、整頁、鍵盤、手機；儲存被封鎖照常）、hubaxe 18/18、smoke 23/23、regress 15/15、朗讀 42/42；完整站 hubcheck、hubaxe、tourcheck 20/20＋24/24 | 採用（`31f4e94a`，合併 `0957b23c`） | 記錄放在 home-hub 自己的腳本（腳本每頁載入，實測章節頁有記到），主導者同意；合併時 prepare-plugins 與 smoke 衝突，兩邊都留；收合規則的備援清單（collapsible.inline.ts）補「按書卷研讀」；home-hub 的 dist 打包了舊版格子樣式 → 合併後重建（`ae91bd7a`）。它中途用 `taskkill /IM chrome.exe` 清瀏覽器，會關掉使用者的 Chrome（已告知使用者）。退回全書目錄時的卡片文案（「上次讀過這一卷」）使用者確認 |
| 同步腳本 | Claude haiku 子代理（第 1 級），worktree `bwz-wt-b6-ps1` | `Update-HomeProgress` 改讀 bible-books.json，新舊函式 5 個情境比對 | 9 個情境新舊輸出逐位元組相同（含 LF／CRLF／BOM、加士師記 2 章 → 213 章、沒有標記、JSON 不存在或損毀只警告）；自己抓到並修了「JSON 不存在時 try/catch 接不住」 | 採用（`b18303da`） | L1 的一致性測試原本從腳本讀 `$bookSpec` → 改成檢查腳本讀共用檔、沒有再寫死清單 |

### 合併後驗收（主導者，`ae91bd7a`）

- 單元測試：quartz/util 131/131、book-picker 31/31、home-hub 33/33。
- test_content 小站（子路徑 /Bible_wiki_zh_website/）：smoke 27/27（原 19＋選擇器 4＋首頁入口 4）、regress 15/15、swcheck 13/13、nodecheck 10/10、expcheck 9/9、book-picker check 94/94（含 axe 淺深 8 個狀態 0 critical／serious）、hubcheck 49/49、hubaxe 18/18、朗讀 42/42。
- 完整內容建置（3,756 頁、10,299 個檔、7 分鐘）：tourcheck 桌機 20/20、手機 24/24（第一站指向首頁格子）；首頁進度「一致：211 個章節檔」；壞連結 298（上一次部署 292；新元件裡 0 個，內容自 `096dd954` 沒變，推上後看部署的檢查確認）。
- 截圖 22 張（首頁無紀錄／有紀錄／整頁、出埃及記 12 章、條目、手機抽屜 × 淺深 × 1440／390），scratchpad `b6/shots-final/`：都沒有橫向捲動、沒有 JS 例外；和使用者選定的樣稿一致。
- 沒跑：site-ux `check.mjs`（要一個「沒有 site-ux」的基準站；本批沒動 site-ux，home-hub 子代理用同程式關掉 home-hub 的站比對，文章區截圖相同）。沒有實機與螢幕閱讀器測試。

### 推上 main 之後（2026-10-23，`cbc2ebdc`）

- 部署成功；GitHub 上的冒煙測試（smoke、regress、swcheck）全部通過。部署的內容檢查：首頁進度一致、壞連結 292 個（和上一次部署相同，本機的 298 是環境差異）。
- 正式站實測（1440、390）：首頁入口有 66 卷（6 卷可點）、沒有紀錄時導覽卡在上、進度表預設收合；出埃及記 12 章左欄 40 個章號、目前第 12 章、探索沒有書卷資料夾、手機章末有章號格；捲到一半回首頁，卡片「出埃及記 第 12 章／上次讀到這一章的中段 · 剛剛」、入口移到導覽卡上面；沒有 JS 例外。

### 上線後修正：左欄要能捲動（分支 `fix/ux-b6-sidebar-scroll`）

- 使用者提出左欄也要有上下滑桿。主導者實測正式站：條目頁（或章節頁按「換卷」後）66 卷格子排到 1022 px，「探索」被擠到 1054 px、只剩約 19 px 高，畫面 900 px 時看不到，左欄又不能捲（`overflow-y: visible`）→ 讀者到不了知識節點、附錄、教學。合併驗收只看了截圖上半部，沒量到左欄底部，是漏掉的地方。
- 使用者選「整個左欄一起滑」（探索維持自己的捲動框，兩層）。

| 任務 | 給誰 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|
| 左欄整欄捲動 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b6-sidebar` | 只改 custom.scss 27 行：桌機左欄 `overflow-y: auto`、欄內區塊不縮、只有探索可縮且最小 `max(16rem, 35vh)`；不加 `overscroll-behavior: contain`（加了左欄放得下時滾輪捲不動整頁）。test_content：1440×900／768、1280×720 × 淺深都能捲、捲到底探索完整；smoke 27/27、expcheck 9/9、book-picker 94/94、hubcheck 49/49、axe（scrollable-region-focusable 等）0 | 採用（`afe6fc04`） | 主導者把同一段 CSS 注入正式站（完整探索樹）實測：條目頁 900 高可捲 540 px、捲到底探索 553→868、清單 282 px 可捲；720 高清單 223 px；首頁放得下不出現捲動；主內容 scrollY 不受影響 |

- 推上 main（`bc533be4`）：部署與冒煙測試成功；正式站條目頁左欄 `overflow-y: auto`、可捲 540 px、捲到底探索 553→868。

### 上線後修正：首頁標題要在最上面（分支 `fix/ux-b6-home-order`）

- 使用者回報首頁順序怪：標題在中間。正式站實測（新訪客）：導覽卡 120 → 入口 261（高 720）→ 標題 h1 在 1029（手機 1546）。原因：標題和介紹在 index.md（article 裡），入口和導覽卡在 article 上面的 beforeBody。
- 主導者定的順序：標題＋兩行介紹永遠第一，接著照 U-22（沒有紀錄：導覽卡、入口；有紀錄：入口、導覽卡），再來是其餘內容。做法：home-hub 在建置時從內容樹取出第一個 h1 和緊接的引言畫成刊頭（單一來源仍是 index.md），原本那份只在取出時隱藏。

| 任務 | 給誰 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|
| 首頁刊頭 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b6-order` | `plugins/home-hub/src/lib/masthead.ts`（純函式）＋`Masthead.tsx`＋`masthead.scss`；custom.scss 讓刊頭套用文章樣式。新訪客順序：刊頭 112 → 導覽卡 394 → 入口 536（舊版標題在 1029）。vitest 67/67、ordercheck 154/154（12 個狀態每幀順序正確、只有一個可見 h1、外觀與原件一致）、hubcheck 49/49、hubaxe 18/18、smoke 27/27、regress 15/15、tourcheck 20/20＋24/24（完整內容） | 採用（`bbd968e9`，併入第 7 批分支 `e65f86e4`，使用者選「等第 7 批一起 push」） | 主導者追加兩點（同一子代理續做）：刊頭 h1 帶原件 id，讓右欄目錄第一項能捲到刊頭（原件 display:none，沒有 aria 指向它）；放寬規則為「第一個是 h1 就搬，引言與 hr 可選」 |

### 注意

- 外掛 import `quartz/util`（共用資料層），建置外掛要保留相對位置：用 scratchpad `b6/build-plugin-mirror.ps1`（`-Name home-hub -Extra @("plugins\book-picker")`）。home-hub 的 dist 打包了 book-picker 的格子，**改 book-picker 的 BookGrid／樣式後要重建 home-hub**。
- 新本地外掛的 `.quartz/plugins/<名稱>` 是 git 的 symlink 項目，這台電腦 checkout 會變成文字檔：換成 junction 再 `git update-index --skip-worktree`。
- 子代理不要用 `taskkill /IM chrome.exe`（會關掉使用者的 Chrome），只殺自己的 PID。
- 主導者寫檔時不要把含反引號的文字放進 bash 的雙引號（`node -e "..."`）：反引號會被當成指令執行（這次差點執行 taskkill，因參數被改壞而沒執行）。用 Edit 工具或單引號 heredoc。

## 第 7 批：章節分段導覽與研讀切換

分支 `feature/ux-b7-chapter`，從 main（`bc533be4`，含第 6 批與左欄捲動修正）建立。使用者要求：動工前把每個要改動的細節用問題討論；規則改成「整個完工就 push」（goal-prompts 第 7 批，`1825bf38`）。

### 委派紀錄

| 任務 | 給誰（模型、等級） | 做什麼 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|---|
| 結構抽樣 | Claude haiku 子代理（第 1 級，唯讀） | 6 卷各 3 章抽樣＋全 211 章統計「本章整理」H3 格式、建置後 HTML 結構 | 1,234 個 H3：`（v1-14）` 678、`（vN）` 40、`（1-6節）` 265（創世記 216）、列舉 33、無範圍 217（含「經文大綱」「關鍵神學點」等樣板）；嚴格格式只有 58%，含變體約 82% 有範圍。範圍覆蓋：無缺口無重疊 140 章、缺口 17、重疊 58。H3 id 由標題文字產生（改標題就變）；經文 `<li>` 沒有任何 id；54 章的本章整理另有有序清單；33 個 md 有 BOM。腳本在 scratchpad `audit7/` | 拿來寫方案任務包 | |
| 設計方案 | Claude Plan 子代理（sonnet，第 2 級，唯讀） | 2～3 個方案＋待決題目 | A 純執行時（晚出現、會位移，不推薦）、B 建置時加節錨點 `#v12`／段錨點（以經節範圍為鍵，不動既有 H3 id）＋插入概要，執行時新外掛處理互動（推薦）、C 經文裡的段落小標（可當 B 之後的加碼）；經節面板建議這批不做（節號是 ::marker，要動朗讀、筆記選取、畫重點）；17 題待決。查到 personal-notes 已在執行時加 `id="v節"`、`#vN` 已被筆記連結使用；「引用到筆記」會存 H3 的 Quartz id，所以不能改 H3 id | 拿來做樣稿、問使用者 | 核對 personal-notes 的 `id="v節"` 與 renderPage 的 `wrapStrongNumbers` 先例屬實 |
| 樣稿 | 主導者 | 注入正式站出埃及記 12 章，16 張（`b7/mock.mjs`、`gen.mjs`） | 概要收合／展開、點段落標示經文、↑回經文、回到經節膠囊、純經文、快捷列「分段」與底部清單、方案 C 段落小標、經節面板 | | 純經文誤留本章整理裡的表格 → 只留導覽表格；段落小標和節號重疊 → 改成小標在上方；快捷列改名沒生效 → 重拍 |
| 樣稿審查 | gemini-4-argon-high → 429（約 45 小時後重置），改 gemini-3.8-flash-high（唯讀） | 附 18 張截圖審體驗 | 高：範圍紫線蓋到節號（樣稿 CSS 錯，已修）、左下膠囊蓋內文與桌機左欄、深色段落小標太暗；中：概要預設收合、「整理↓」用詞、純經文弱化連結；推薦方案 C 一起做、經節面板暫緩 | 修了紫線；回到經節另拍頂端橫條與底部置中兩種位置給使用者選 | |
| 問使用者 | 主導者 | 五輪 | 使用者看不懂「分段」的用途 → 主導者用示意圖重講後，使用者決定這批不做分段；其餘決定見 README U-23（純經文先選「記住」，後來改成「只在這個分頁有效」）。最後回「要做」 | | |
| 文案審查 | gemini-3.8-flash-high（唯讀） | 按鈕、Aa 新項目文案 | 建議「回」→「返回」、「閱讀內容」→「閱讀模式」、× 改成清楚的名稱 | 採用這三點；使用者確認定稿 | 沒採用「本章整理」縮成「章整理」（網站用詞是本章整理）、說明小字太文言 → 主導者改寫 |
| 純邏輯 | Codex gpt-6-luna xhigh（workspace-write 成功） | `returnPoint.ts`、`chapterRegions.ts`＋測試 | quartz/util 148/148；LF、無 BOM | 採用（`f5cddf15`） | 按鈕文字改成定稿「↩ 返回」；chapterRegions 補檔頭說明（`8b64cfa0`）。主導者第一次用編輯工具改 worktree 的檔失敗（沒先讀檔）但 commit 照樣送出，所以修正另成一個 commit |
| 介面 | Claude sonnet 子代理（第 2 級），worktree `bwz-wt-b7-ui` | plugins/verse-return（回到經節）、site-ux 純經文 | 做到一半碰到 Sonnet 用量上限（03:2x，05:30 重置），05:21 由同一子代理續做。verse-return 外掛（36 個單元測試）、site-ux 純經文（63）、共用 `chapterDom.ts`／`revealEvent.ts`、restorePlan 搬到 quartz/util；e2e：verse-return check 92/92（要用 `e2e/make-content.mjs` 產生有條目的內容站）、axe 20/20 | 採用（`8b4aaa79`、`6d030175`） | 主導者審查時抓到 `selectStudyRegion` 的 `/s+/` 少了反斜線（會刪掉字母 s 而不是空白）→ 兩處共用 `normalizedHeading()`，補「📝 本章　整理」測試。按返回不捲動的根因：`jump.ts` 在桌機也把整條 sticky 左欄當成頂端遮擋，可見範圍算成 0 → 只在手機計入 |
| 純經文 e2e | Codex gpt-6-luna xhigh：workspace-write 失敗（`setup refresh had errors`），改 stdin 模式 | `plugins/site-ux/e2e/purecheck.mjs` | 腳本產出；主導者跑起來 21/50 → 查出腳本的選擇器引號寫錯（雙引號包雙引號）、點下一章前沒捲進畫面 → 修好後 51/51；手動驗證純經文功能正常 | 採用 | 兩處腳本修正 |
| 主導者驗證 | 主導者 | test_content 站（合併首頁刊頭修正後） | smoke 27/27、regress 15/15、hubcheck 49/49、book-picker 94/94、purecheck 51/51；verse-return e2e 83/91：修了三處腳本的測試資料假設（test_content 的條目沒有再連出去的連結 → 改用 SPA 換頁）與點不到元素就當掉；**剩下真的問題：按「返回」後沒有捲到那一節／那個標題、之後一般換頁 scrollY 1500**，另有懸停預覽、儲存封鎖時的例外要查 | 子代理修好（見上一列） | |
| 合併後驗收第一輪 | 主導者 | 主 repo 建 test_content 站、make-content 站、關掉 site-ux 的真基準站 | 4 個重現的失敗交回同一子代理：① 研讀模式也在 `<html>` 設 `data-ux-marked`，和改動前不同（site-ux check 對真基準站 114/118；子代理之前拿同一站自己比自己，沒驗到）→ 只在純經文設；② 按鈕出現時從手機位置滑到桌機位置（`bottom` 有過渡動畫）→ 先擺好位置再放進頁面；③④ purecheck、ordercheck 在平滑捲動途中量座標 → 改 instant | 採用（`6d030175`） | |
| 6 卷抽樣 | Codex gpt-6-luna xhigh（stdin 模式） | `plugins/verse-return/e2e/booksample.mjs`：6 卷 × 首中末章＋手機 2 章，研讀／純經文／回到經節／JS 例外 | 腳本產出，但 Codex 用猜的 API（啟動 Chrome、waitFor 吃函式、s.go 傳完整網址、網址編碼不一致、找不到 Aa 鈕） | 採用 | 主導者改成 helpers 的 `open()`、自己輪詢、相對路徑、解碼比對、`.site-ux-btn`；研讀模式沒有屬性要當 study；經文連結折成兩行時點第一行；點擊前把滑鼠移開 |
| 手機導覽 23/24 | 同一子代理 | 完整內容站手機導覽「框起來的位置包含筆記面板標題」每次失敗（正式站 24/24） | 根因不在本批外掛：導覽每站只捲一次，但長章節在字型載入後重新換行、頁高長約 2,000 px，筆記面板下移，聚光圈落到畫面外；舊測試是碰巧通過（字型延遲 0／1200／2500 ms 三種結果不同），本批改變了腳本載入順序才露出來 | 採用（`5dd968c1`） | 導覽改成：目標在文件裡的位置變動超過 8 px 就重捲（每站最多 4 次；讀者自己捲不會改變文件位置，所以不搶捲動），規則在 `quartz/util/tourShift.ts`＋測試；主導者把 import 移到檔頭說明之後 |

### 合併後驗收（主導者，`5dd968c1`）

- 單元測試：quartz/util 156/156、verse-return 36/36、site-ux 63/63、home-hub 67/67。
- test_content 站：smoke 27/27、regress 15/15、swcheck 13/13、nodecheck 10/10、stickycheck 21/21、expcheck 9/9、site-ux check 118/118（對關掉 site-ux 的真基準站）、purecheck 51/51、朗讀 42/42、hubcheck 49/49、hubaxe 18/18、ordercheck 142/142、book-picker 94/94。make-content 站：verse-return check 92/92、axe 20/20。
- 完整內容建置（3,756 頁、10,301 個檔、7 分鐘；經文清單檢查 211 章通過）：tourcheck 桌機 20/20、手機 24/24；purecheck 51/51；hubcheck 49/49；axe 20/20；6 卷抽樣 280/280（每章研讀不藏、純經文藏對區塊且經文與前後章表格可見、沒有橫向捲動、經文連結到條目再按「↩ 返回」回到那一節在畫面中間）。
- 截圖（出埃及記 12 章純經文章末、條目頁的按鈕、返回後 × 淺深 × 1440／390），scratchpad `b7/final/shots/`：沒有 JS 例外、沒有橫向捲動；返回後第 6 節在畫面中間。
- 發現但不在本批範圍：
  - 內容：創世記 50、民數記 36 的 Mermaid 時間軸語法錯誤（`Parse error on line 3`），圖畫不出來（content/ 不由網站程式改）。
  - 既有問題（正式站也有）：SPA 換頁時滑鼠停著，新頁同位置的連結觸發的懸停預覽不會自己收起（Quartz popover 的 mouseleave 沒觸發）；預覽 z-index 999 高於按鈕的 880，卡住時可能蓋住「↩ 返回」。
- 沒做：實機與螢幕閱讀器測試。

### 推上 main 之後（2026-10-23，`8e4dd513`，含第 6 批的首頁刊頭修正）

- 部署成功；GitHub 上的冒煙測試通過。
- 正式站實測：首頁有刊頭（`data-bwz-masthead`）；6 卷抽樣 280/280（純經文、回到經節都在真實章節上正常）；手機導覽 24/24。

### 第 7 批後續（分支 `fix/mermaid-and-entry-landing`，2026-10-23）

使用者回報兩件事：創世記 50、民數記 36 的 Mermaid 圖畫不出來；點知識節點（後來補充：地圖也是）有時落在新頁最底部。落點設計討論後使用者選「停在頂端＋標題下一顆『↓ 出埃及記 12 的相關內容』」、三種來源都一樣、按下展開＋捲到＋短暫標示，回「要做」。

| 任務 | 給誰 | 結果 | 採用 | 主導者修了什麼 |
|---|---|---|---|---|
| Mermaid | Claude sonnet 子代理 | 照站上流程（mermaid 11.4.0、先 `innerHTML = innerText` 再解析）的檢查器 `scratchpad/mermaid/check-mermaid.mjs`：vault 282 個圖、9 個 timeline 壞（時期文字裡的半形 `:`；`&#58;` 會被站上的渲染還原成 `:`）→ 在 vault 改成全形 `：`（使用者同意先改 vault 再同步；先備份），`sync_content.ps1 -NoPush` 後只有這 9 檔有內容變更；完整建置 9 頁都是 SVG | 採用（`88fb5fe1`） | 3 個只差行尾的檔案還原、不提交 |
| 落底根因 | Claude sonnet 子代理（只調查） | `spa.inline.ts` 先 micromorph（短頁被夾到底）再平滑 `scrollTo(0)`，動畫晚 0.3～3 秒才動，期間任何捲動都會打斷；地圖頁同因。自然操作 0/217 落底，換頁後送一個方向鍵 8/10 落底；條目結構：3,381 個條目都有「按書卷累積」，每章一個 `h4 > a[data-slug]` | 拿來設計與修 | |
| 落底修正＋e2e | Codex gpt-6-luna xhigh（沙箱壞了，改成把檔案全文放進提示詞） | 換內容之前就 instant 回頁首；有錨點時換頁後 instant 定位。`landingcheck.mjs`：修正前完整站「換頁後閃到底」最高 scrollY 7,471，修正後 0 | 採用（`a4664495`） | 手動套用（diff 行號不符）、改寫註解 |
| 相關內容按鈕 | Codex gpt-6-luna xhigh（同上） | `quartz/util/entryLanding.ts`（記錄格式、要不要顯示、按鈕文字）＋測試、verse-return 的 `relatedButton.ts`、recorder／store／inline | 採用（`a4664495`） | Codex 刪了既有的「為什麼」註解 → 補回；`jump.ts` 只留 `export topObstruction`；標示計時兩處各設一次 → 只留呼叫端；寫死的顏色 → 改用站台強調色變數（照左欄「換卷」膠囊） |
| 按鈕 e2e | Codex gpt-6-luna xhigh | `relatedcheck.mjs`（經文／本章知識節點／本章整理、直接開、重新整理、條目跳條目、儲存封鎖、手機深色） | 採用 | 腳本挑到標題錨點（`#主題`）→ 排除 role=anchor 與同頁連結；「約書亞記 3 → 比利洗人」主導者原以為沒有該章段落（只數了 accumulation 註解），實際 h4 在 → 改成「沒有註解也要有按鈕」 |

- 驗收（`a4664495`＋測試腳本）：quartz/util 161/161、verse-return 40/40；test_content 站 smoke 27/27、regress 15/15、swcheck 13/13、nodecheck 10/10、stickycheck 21/21、expcheck 9/9、site-ux 118/118、purecheck 51/51、朗讀 42/42、hubcheck 49/49、hubaxe 18/18、ordercheck 142/142、book-picker 94/94、verse-return 92/92、axe 20/20；完整內容站 tourcheck 20/20＋24/24、purecheck 51/51、hubcheck 49/49、axe 20/20、6 卷抽樣 280/280、relatedcheck 33/33＋4/4＋17/17、landingcheck 4/4（手機兩項因底部找不到連結略過）。
- 截圖：scratchpad `el/btnshots/`（按鈕在標題下、淺深 × 1440／390）、`el/rel/`（按下後第12章在畫面上方並標示）。
- 推上 main（`a2ce8565`）：部署、冒煙測試、Pinecone 同步都成功；正式站 relatedcheck 33/33＋4/4＋17/17、landingcheck 4/4，創世記 50 已是 `創50：25`。
- 注意：Codex 這天的沙箱連唯讀指令都無法執行（`setup refresh had errors`）；改法是把需要的檔案全文放進 stdin、要它輸出完整檔案。

## 第 8～9 批：大改版

（尚未開始）
