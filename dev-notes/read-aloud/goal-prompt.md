# /goal 提示詞：經文朗讀

用法：在 Claude Code 輸入 `/goal`，後面貼上下方程式碼區塊的全部內容。設計依據在 [README.md](README.md)。

```text
你是「聖經研讀知識庫」新增「經文朗讀」功能的主導者，負責拆任務、委派、審查、整合與測試，不要自己單幹。

【先讀】dev-notes/read-aloud/README.md（設計、任務表、驗收標準；有衝突以它為準）、dev-notes/personal-notes/07-agents.md（幫手規則與已知問題）、plugins/wiki-tour/（小型 plugin 範本）、quartz/static/website/全聖經/亞當到耶穌/src/ui/speech.ts 與 src/data/speech-fixes.ts（要移植的朗讀引擎）、plugins/personal-notes/src/client/model/verseList.ts（經文清單判斷規則）。

【目標】章節頁只朗讀「經文」：第一條分隔線之前的有序清單，一節一個 utterance，唸到哪節就標示並捲動到那節。功能僅限：播放／停止、從第幾節開始、語速、多音字修正。使用者明說其他都不要做：不朗讀導覽表、註解、本章整理、附錄、便條紙；不做音檔、逐字高亮、暫停、跨章續讀。想加功能先停下來問我。

【做法】新增 plugins/read-aloud（結構照 wiki-tour，dist/ 要提交）。speech.ts 與經文清單規則用「複製」，不跨專案 import、不依賴 personal-notes。送進語音的文字只能是經文，略過 .bwz-v-ui；認不出經文清單就完全不顯示朗讀列，不可報錯或讓建置失敗。換頁（nav 事件）與 pagehide 一律 stop。localStorage 讀寫包 try/catch。

【分工】依 README §4 的 T1～T8，並照 07-agents.md 分級：T1 Claude haiku；T2 Claude haiku；T3、T4 Codex gpt-6-luna，Luna 一律用 xhigh（使用者指示，不用 medium／low）（T4 備案 sonnet 子代理 worktree，先 git merge --ff-only main）；T5 sonnet 子代理；T7 Antigravity gemini-3.8-flash-high 交叉審查含中文文案；T6 部署設定由你親自做。Codex 沙箱寫檔失敗就改 stdin 模式。幫手一律寫任務包（目標、可改檔案、驗收標準），不得 commit／push、不得讀 .env。幫手整檔輸出常刪掉原註解，用 git diff -w 檢查刪除行。幫手成果由你審查 diff 並親自跑測試後才採用。每次委派在 dev-notes/read-aloud/progress.md 記一行（誰、做什麼、結果、是否採用）。

【硬性規則】在 feature/read-aloud 分支工作（不存在就從 main 建立），可本地 commit；不得 push、不得動 main，除非我明確同意。不修改 content/、C:\Obsidian\Hermes、.quartz/。部署要持久：quartz.config.yaml 加 plugin，deploy.yml 加 rm 與 cp 兩行。建置驗證用 npx quartz build -d test_content -o <scratch 目錄>。需要我做的事（實機聽、部署、決定）：停下來用選擇題問我，附建議與理由，不要猜。

【完成條件】全部成立才算完成：(a) README §5 驗收標準逐條驗證，結果與測試指令寫入 progress.md；(b) 單元測試、UI 測試、無頭 Chrome（stub speechSynthesis）全過，test_content 建置成功，wiki-tour、搜尋、SPA 換頁、個人筆記、深色模式沒有回歸；(c) 向我要求實機聽測（Windows 與 iPhone 或 Android），列出怎麼測、聽什麼；(d) 最後用繁體中文摘要：做了什麼、如何驗證、需要我做的事、限制（音質看裝置、iOS 鎖屏會斷）。
```
