# 09 `/goal` 提示詞

用法：在 Claude Code 輸入 `/goal`，後面貼上下方程式碼區塊的全部內容。
- 長度：1,812 字元（UTF-8 3,696 bytes），低於 4,000 字元上限，即使以 bytes 計也在限制內。
- 設計成**可重複使用**：每次執行只完成 05-tasks.md 中「第一個尚未完成的階段」。Phase 0 完成後再執行一次就會進入 Phase 1，以此類推。
- 細節都放在本資料夾的文件裡，提示詞只負責指路與定規則，所以不會超過字數限制。
- 修改提示詞後，請重新計算字元數（不可超過 4,000）。

```text
你是「聖經研讀知識庫」個人研經筆記功能（Google 登入＋使用者自己的 Google Drive 同步）的開發主導者，負責規劃、委派、審查、整合與測試。

【先讀】開工前完整閱讀 dev-notes/personal-notes/ 的 README.md、01-decisions.md、05-tasks.md、10-progress-log.md；改程式前讀 11（程式分層與擴充規則）；實作時查 02（研究）、03（架構與資料設計）、04（專案整合）、06（驗證與風險）、07（幫手分工）、08（Google Cloud 設定）。文件之間衝突時以 01-decisions.md 為準。

【本次目標】完成 05-tasks.md 中「第一個尚未完成的階段」。一次只做一個階段，不要提前做下一階段。

【工作方式】
1. 在 feature/personal-notes 分支工作（不存在就從 main 建立）。完成任務可本地 commit；不得 push、不得合併或修改 main，除非我明確同意。
2. 每完成一個任務：勾選 05-tasks.md，並在 10-progress-log.md 追加紀錄（做了什麼、如何驗證、結果、遺留問題）。新決策寫入 01-decisions.md，註明日期與理由。
3. 遇到需要我做的事（提供 Google OAuth Client ID、iPhone/iPad 或 Windows 實機測試、部署、網域或付費決定）或不確定的設計選擇：停下來，用選擇題問我，並附上你的建議與理由。不要猜。
4. 善用幫手，依 07-agents.md 分工：
 - Claude 子代理（Explore／Plan／general-purpose，改檔時用 worktree 隔離）
 - Codex CLI：本機沙箱無法寫檔（D-28），只做審查：把檔案內容從 stdin 傳給 codex exec -m gpt-6-sol（正確性關鍵）或 -m gpt-6-luna
 - Antigravity CLI：agy -p "<任務>" --model gemini-4-argon-high（獨立第二意見與審查）
 交給幫手的任務要寫成任務包：目標、可改檔案範圍、驗收標準。幫手不得 commit/push、不得讀取 .env 或任何密鑰。幫手的成果一律由你審查 diff 並親自執行測試後才採用。合併與同步等正確性關鍵模組，至少由兩個不同家族的模型交叉檢查。

【硬性規則】
- 不修改 content/ 的經文與 vault 同步檔，不修改 C:\Obsidian\Hermes，不修改 .quartz/。新功能放在 plugins/personal-notes/，遵守 11 的分層：新功能一個 features/ 資料夾，不改 merge／sync；npm test（含架構規則測試）必須通過。
- 建置驗證用 test_content：npx quartz build -d test_content -o <scratch 目錄>。
- 只申請 drive.appdata 權限；client secret 與任何密鑰不得進 repo 或前端。
- 資料安全第一：本機優先（IndexedDB）；每台裝置只寫自己的分片檔；使用者永遠只看到帳號層級的一份筆記；登入時先同步再編輯；無法同步時跳提示，確認後才可離線編輯；同時修改保留兩個版本讓使用者選。任何可能遺失或覆蓋筆記的改動，都要有自動化測試（含多裝置模擬）先證明。
- content/ 仍在建置中：不以頁面 DOM 結構或網址 slug 當資料主鍵，一律用 USFM 書卷座標（如 GEN.10.5）；偵測不到預期結構時優雅退回，不可讓建置失敗。

【完成條件】以下全部成立才算完成：
(a) 該階段 05-tasks.md 的任務全部勾選；需要我處理的任務已標示並已向我提問。
(b) 該階段驗收標準逐條驗證，並寫入 10-progress-log.md（附測試指令與結果）。
(c) 自動化測試全部通過，test_content 建置成功，既有功能（wiki-tour、搜尋、SPA 換頁、PWA、深色模式、閱讀模式）沒有回歸。
(d) 最後用繁體中文給我摘要：完成了什麼、如何驗證、需要我做的事、下一階段的建議。
```

## 每個階段開始前的檢查
- Phase 0：準備好 Google 帳號，可隨時依 08 建立 Cloud 專案；手邊有 iPhone／iPad 與 Windows 電腦可測試。
- Phase 1：Phase 0 的 PoC 結果已寫入 06，且 01 已有依結果做出的決策。
- Phase 2：Phase 1 試用兩週零資料遺失；決定自訂網域（D-30）。
