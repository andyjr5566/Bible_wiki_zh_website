# /goal 提示詞（分批）

用法：在 Claude Code 輸入 `/goal`，後面貼上該批程式碼區塊的全部內容。**一次只開一批**，前一批完成並經你確認（要不要 push 或合併）之後再開下一批。

- 細節都在 [batches.md](batches.md)，提示詞只負責指路、指定分工和規則，所以每段都在 4,000 字元以內（字數列在每批標題後）。
- 每段都要求主導者**用子代理和幫手分工，不要全部自己做**，分級照 [07-agents.md](../personal-notes/07-agents.md)：Luna 一律 xhigh、gemini-3.8-flash 一律 high、Sol 只用在第 3 級或嚴格審查。
- 修改提示詞之後，重新計算字數。

---

## 第 1 批：效能與基本資訊（1,309 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 1 批（效能與基本資訊）的主導者，負責拆任務、委派、審查、整合與測試。不要全部自己做：每個任務都交給子代理或幫手，你負責寫任務包、審查 diff、整合、親自驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（使用者決策 U-x、待決 Q-x、共通規則；有衝突以它為準）、batches.md「第 1 批」、findings.md（證據與截圖方法）、dev-notes/personal-notes/07-agents.md（幫手指令、沙箱問題與備案）。

【目標】完成 batches.md 的 B1-1～B1-6，每一條都達到驗收標準。不做其他批的事；想擴大範圍先問我。

【分工】照 batches.md 指定，不要每件事都用最強的模型：B1-1 轉檔交 Claude haiku 子代理，畫面比對你自己做；B1-2 交 Codex gpt-6-luna（effort 一律 xhigh）；B1-3、B1-4、B1-5 交 haiku 子代理；B1-6 交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b1-basics），中文文案交 Antigravity gemini-3.8-flash-high 審（flash 一律 high）。能平行的任務就平行派出。任務包要寫目標、可改檔案、驗收標準、禁止事項。幫手不得 commit／push、不得讀 .env；Codex 沙箱寫檔失敗就改 stdin 模式；幫手輸出整檔時常刪註解，用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行（誰、模型、做什麼、結果、是否採用、你修了什麼）。

【硬性規則】在 feature/ux-b1-basics 分支工作（不存在就從 main 建立），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/（CI 會重新 clone）。持久的修改只放在 quartz/、plugins/、quartz.config.yaml、deploy.yml。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我，附上建議與理由，不要猜。

【驗證】改動前後各拍一次無頭 Chrome 截圖（桌機 1440、手機 390、深色）；npx quartz build -d test_content -o <scratch 目錄> 要成功；用完整內容建置，量首頁與章節頁第一次載入的傳輸量；確認 wiki-tour、搜尋、SPA 換頁、個人筆記、朗讀、深色模式、PWA 沒有回歸。

【完成條件】(a) B1-1～B1-6 的驗收逐條通過，測試指令與結果寫進 progress.md；(b) 前後截圖與傳輸量對照寫進 progress.md；(c) 最後用繁體中文給我摘要：做了什麼、怎麼驗證、需要我做的事（例如要不要 push）、遺留問題。
```

---

## 第 2 批：第一次進站與首頁（1,513 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 2 批（第一次進站與首頁）的主導者，負責拆任務、委派、審查、整合與測試。不要全部自己做：每個任務都交給子代理或幫手，你負責任務包、審查 diff、整合、親自驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（決策 U-x、待決 Q-x、共通規則；有衝突以它為準）、batches.md「第 2 批」、findings.md（特別是 §2、§2.2）、progress.md（第 1 批結果）、dev-notes/personal-notes/07-agents.md、memory 的 content-sync-and-tour（同步腳本會注入首頁教學清單）。

【開工先問我】Q-3：首頁進度要不要改成自動計算。我回答之前不要動這件事。U-12 已決定：「加入主畫面」維持第一次造訪就提示，但等導覽卡關掉後才出現，面板改小。

【目標】完成 B2-1～B2-4 並達到驗收標準。

【分工】B2-1 交 Codex gpt-6-luna（effort 一律 xhigh）；B2-2 交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b2-onboarding），完成後交 Antigravity gemini-4-argon-high 附截圖審體驗（遇到 429 改用 gemini-3.8-flash-high；flash 一律 high）；B2-3 由你起草，中文交 gemini-3.8-flash-high 審；B2-4 交 Codex gpt-6-luna xhigh。能平行就平行。任務包寫清楚目標、可改檔案、驗收、禁止事項。幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查幫手刪掉的行。每次委派在 progress.md 記一行。

【筆記庫例外（U-5）】C:\Obsidian\Hermes 裡只可以改 scripture\index.md。流程：備份原檔到 scratch → 給我看完整的新內容與 diff → 我同意後才寫入 → 執行 sync_content.ps1 → 驗證網站首頁。內容只整理、不刪（作者的話移到後段）；不要重複寫同步腳本會注入的教學清單。不在筆記庫 commit。

【硬性規則】在 feature/ux-b2-onboarding 分支工作（不存在就從 main 建立；如果第 1 批還沒合併，先問我要不要從 feature/ux-b1-basics 分出去），可以本地 commit；不得 push、不得動 main，除非我明確同意。除了上面的例外，不改 content/、C:\Obsidian\Hermes、.quartz/。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我，附建議與理由。

【驗證】首訪流程截圖（手機 390、桌機 1440；清空 localStorage 和 sessionStorage）：任何時候畫面上最多一個提示；序幕情境（新分頁、重新整理、超過 24 小時、App 模式、?skip=1、?opening=1）逐一測試；test_content 建置成功；wiki-tour 導覽、搜尋、SPA、個人筆記、朗讀、深色模式沒有回歸。

【完成條件】(a) B2-1～B2-4 驗收逐條通過並寫進 progress.md；(b) 首頁新內容經過我確認並且已同步；(c) 繁體中文摘要：做了什麼、怎麼驗證、需要我做的事、遺留問題。
```

---

## 第 3 批：章節閱讀（1,490 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 3 批（章節閱讀）的主導者，負責拆任務、委派、審查、整合與測試。不要全部自己做：每個任務都交給子代理或幫手，你負責任務包、審查 diff、整合、親自驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（決策 U-x、待決 Q-x、共通規則）、batches.md「第 3 批」、findings.md §4、progress.md、dev-notes/personal-notes/07-agents.md、memory 的 quartz-plugin-durability。

【開工先問我】Q-2：explorer 捲動修正要 fork 外掛還是在本地覆寫（附上兩種做法的利弊）；Q-4：先查出經文譯本，再問我標示文字。B3-7a 做完樣稿就停下來問 Q-5，我選定之後才做 B3-7b。

【目標】完成 B3-1～B3-8 並達到驗收標準。重點：U-4 經文連結預設維持明顯樣式，面板可以切成低調或隱藏；U-9 預設字級不變；U-8 圖譜留在右欄原位。

【分工】B3-1 交 Codex gpt-6-luna（effort 一律 xhigh）；B3-2 交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b3-reading），文案交 Antigravity gemini-3.8-flash-high（一律 high），畫面交 gemini-4-argon-high 附截圖審（429 改用 flash-high）；B3-3、B3-6 交 haiku 子代理；B3-4 交 sonnet 子代理（worktree），完成後 argon 審；B3-5 交 luna xhigh；B3-7a 樣稿你自己做，argon 審；B3-7b 交 luna xhigh；B3-8 由 haiku 查證，你實作。能平行就平行。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【硬性規則】在 feature/ux-b3-reading 分支工作（不存在就從 main 建立；前面的批次還沒合併時先問我從哪裡分），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/。新增本地外掛（例如 plugins/site-ux）時，要在 quartz.config.yaml 加項目，並在 deploy.yml 加 rm 與 cp 兩行。localStorage 讀寫一律包 try/catch；偵測不到預期的內容結構時優雅退回，不可以讓建置失敗。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我。

【驗證】每項改動都拍前後截圖（桌機 1440、手機 390、深色；外觀面板拍各種設定的組合）；從首頁點進、直接開網址、SPA 換頁三種情況，window.scrollY 都是 0；test_content 建置成功；wiki-tour、搜尋、懸停預覽、個人筆記（畫重點、便條）、朗讀、深色模式沒有回歸。

【完成條件】(a) B3-1～B3-8 驗收逐條通過並寫進 progress.md；(b) 圖譜依我選定的樣稿完成；(c) 繁體中文摘要：做了什麼、怎麼驗證、需要我做的事、遺留問題。
```

---

## 第 4 批：搜尋與索引（1,294 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 4 批（搜尋與索引）的主導者，負責拆任務、委派、審查、整合與測試。不要全部自己做：每個任務都交給子代理或幫手，你負責任務包、審查 diff、整合、親自驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md、batches.md「第 4 批」、findings.md §3（4、4b、4c）與 §4、progress.md、dev-notes/personal-notes/07-agents.md、plugins/semantic-search/ 的 README 與 src。

【目標】完成 B4-1～B4-6 並達到驗收標準。B4-6 要先把調查結果和方案交給我看過，才開始實作。

【分工】B4-1、B4-2、B4-5 交 Codex gpt-6-luna（effort 一律 xhigh），都要附單元測試；B4-3 交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b4-search），文案交 Antigravity gemini-3.8-flash-high（一律 high）；B4-4 的解析器與縮寫表交 luna xhigh，接到搜尋介面交 sonnet 子代理；B4-6 先用 Plan 子代理（sonnet）調查哪些地方讀 contentIndex.json 並提出方案，你審過、我同意後交 luna xhigh 實作，最後交 gemini-3.8-flash-high 交叉審查。能平行就平行（B4-6 會影響圖譜與預覽，最後做）。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【硬性規則】在 feature/ux-b4-search 分支工作（不存在就從 main 建立；前面的批次還沒合併時先問我），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/。Vercel 只提供搜尋 API（U-6），不改 Vercel 部署設定；API 失敗時網站仍然要能用精準搜尋。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我。

【驗證】單元測試全過；人工查詢「逾越節」「摩西」「挪亞」「亞伯拉罕」「出12:3」「Gen 1:27」「士師記 3」（還沒有內容的書卷），結果截圖寫進 progress.md；模擬 API 很慢與失敗；只用鍵盤完成一次搜尋；量測非搜尋頁第一次載入的傳輸量（前後對照）；test_content 與完整內容建置都成功；圖譜、懸停預覽、個人筆記搜尋沒有回歸。

【完成條件】(a) B4-1～B4-6 驗收逐條通過並寫進 progress.md；(b) 傳輸量前後對照；(c) 繁體中文摘要：做了什麼、怎麼驗證、需要我做的事、遺留問題。
```

---

## 第 5 批：離線與品質（1,528 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 5 批（離線與品質）的主導者，負責拆任務、委派、審查、整合與測試。不要全部自己做：每個任務都交給子代理或幫手，你負責任務包、審查 diff、整合、親自驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（U-11：自動檢查先只警告、不擋部署）、batches.md「第 5 批」、findings.md、progress.md、dev-notes/personal-notes/07-agents.md、quartz/static/sw.js、.github/workflows/deploy.yml、plugins/personal-notes/e2e/、plugins/read-aloud/e2e/。

【目標】完成 B5-1～B5-5 並達到驗收標準。

【分工】B5-1 交 Codex gpt-6-luna（effort 一律 xhigh）實作，完成後交 Codex gpt-6-sol（high）唯讀審查（SW 出錯會讓讀者卡在舊版，屬於第 3 級）；B5-2 先由 haiku 子代理盤點現有的 e2e 腳本，再交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b5-quality）寫 workflow；B5-3 交 luna xhigh；B5-4 由 Antigravity gemini-3.8-flash-high（一律 high）列審查清單，luna xhigh 修；B5-5 交 sonnet 子代理（worktree），flash-high 審。能平行就平行（B5-5 動到全站樣式，放最後）。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【架構】程式要方便以後維護（共通規則 7）：一個檔案、一個函式只做一件事；判斷規則寫成可測的純函式並附單元測試，DOM、網路、儲存放在薄薄的外層；共用的值（顏色、門檻、名稱）只定義一次再引用，不要複製貼上；新功能放在合適的模組，不塞進不相干的檔案；中文註解寫「為什麼」。審查幫手的 diff 也照這個標準，不合格就退回或重構。

【硬性規則】在 feature/ux-b5-quality 分支工作（不存在就從 main 建立；前面的批次還沒合併時先問我），可以本地 commit；不得 push、不得開 PR、不得動 main，除非我明確同意（要在 GitHub 上試跑 workflow 之前先問我）。CI 檢查一律 continue-on-error: true。不改 content/、C:\Obsidian\Hermes、.quartz/。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我。

【驗證】SW：離線打開沒快取的頁面出現離線頁、上線後會更新到新版本、個人筆記資料不受影響；冒煙測試在本機全部可以跑；故意改錯首頁進度數字會出現警告；axe 檢查首頁、章節、條目沒有嚴重問題；CSS 整理前後截圖（首頁、章節、條目、目錄頁 × 亮、深 × 1440、390）沒有非預期差異；test_content 建置成功。

【完成條件】(a) B5-1～B5-5 驗收逐條通過並寫進 progress.md；(b) Sol 的審查意見都已處理或註明理由；(c) 繁體中文摘要：做了什麼、怎麼驗證、需要我做的事（例如在 GitHub 試跑 workflow）、遺留問題。
```

---

## 第 6 批：首頁入口與書卷選擇器（大改版，1,225 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 6 批（首頁入口與書卷選擇器，大改版）的主導者。不要全部自己做：調查、方案、實作、審查都交給子代理或幫手，你負責任務包、審查、整合、驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md、batches.md「第 6 批」、progress.md（前 5 批的結果）、dev-notes/personal-notes/07-agents.md。

【第一步：設計確認】用 Plan 子代理（sonnet）提出 2～3 個方案（首頁入口區塊的內容與排版、書卷章節選擇器在手機與桌機的位置、繼續閱讀要記什麼）。你做成實際的樣稿截圖（手機 390、桌機 1440、深色），交 Antigravity gemini-4-argon-high 附截圖審（429 改用 gemini-3.8-flash-high，flash 一律 high），然後停下來用選擇題問我。我選定之前不要實作。

【第二步：實作】照選定的方案做：入口區塊用本地元件，不靠 index.md；選擇器全站共用；66 卷書裡還沒有內容的要反灰。分工：介面交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b6-home）；「繼續閱讀」的儲存邏輯與測試交 Codex gpt-6-luna（effort 一律 xhigh）；文案交 gemini-3.8-flash-high。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【架構】程式要方便以後維護（共通規則 7）：一個檔案、一個函式只做一件事；判斷規則寫成可測的純函式並附單元測試，DOM、網路、儲存放在薄薄的外層；共用的值（顏色、門檻、名稱）只定義一次再引用，不要複製貼上；新功能放在合適的模組，不塞進不相干的檔案；中文註解寫「為什麼」。審查幫手的 diff 也照這個標準，不合格就退回或重構。

【硬性規則】在 feature/ux-b6-home 分支工作（從 main 建立；前面的批次還沒合併時先問我），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/。localStorage 讀寫包 try/catch。不做任何遊戲化設計（不做連續天數、進度獎勵）。需要我決定的事，停下來用選擇題問我。

【完成條件】(a) 樣稿經我選定；(b) 實作和樣稿一致，手機、桌機、深色截圖寫進 progress.md；(c) test_content 建置成功，wiki-tour、搜尋、序幕、個人筆記、朗讀沒有回歸；(d) 繁體中文摘要。
```

---

## 第 7 批：章節分段導覽與研讀切換（大改版，1,260 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 7 批（章節分段導覽與研讀切換，大改版）的主導者。不要全部自己做：調查、方案、實作、審查都交給子代理或幫手，你負責任務包、審查、整合、驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（「導讀」需要新內容，延後）、batches.md「第 7 批」、progress.md、dev-notes/personal-notes/07-agents.md、memory 的 content-is-work-in-progress（內容格式還會變）。

【第一步：設計確認】先由 haiku 子代理抽樣 6 卷書各 3 章，統計本章整理的 H3 格式（例如「年從救贖那天起算（v1-14）」）有多一致。再用 Plan 子代理（sonnet）提出 2～3 個方案：分段概要、回到剛才的經節、純經文／研讀切換、經節面板（選做）。你做成樣稿截圖，交 Antigravity gemini-4-argon-high 附截圖審（429 改用 gemini-3.8-flash-high，flash 一律 high），然後停下來用選擇題問我。

【第二步：實作】段落與錨點解析加單元測試交 Codex gpt-6-luna（effort 一律 xhigh）；介面交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b7-chapter）；文案交 gemini-3.8-flash-high。偵測不到預期結構時要優雅退回（不顯示該功能），不可以讓建置失敗；不以 DOM 結構當資料主鍵。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【架構】程式要方便以後維護（共通規則 7）：一個檔案、一個函式只做一件事；判斷規則寫成可測的純函式並附單元測試，DOM、網路、儲存放在薄薄的外層；共用的值（顏色、門檻、名稱）只定義一次再引用，不要複製貼上；新功能放在合適的模組，不塞進不相干的檔案；中文註解寫「為什麼」。審查幫手的 diff 也照這個標準，不合格就退回或重構。

【硬性規則】在 feature/ux-b7-chapter 分支工作（從 main 建立；前面的批次還沒合併時先問我），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/。和 Aa 外觀面板（U-4、U-9）、朗讀、個人筆記的畫重點與便條相容。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我。

【完成條件】(a) 方案經我選定；(b) 6 卷書抽樣都正常，認不出結構的章節會退回且沒有錯誤；(c) 截圖與測試結果寫進 progress.md；(d) 繁體中文摘要。
```

---

## 第 8 批：互動網站探索中心（大改版，1,307 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 8 批（互動網站探索中心，大改版）的主導者。不要全部自己做：調查、方案、實作、審查都交給子代理或幫手，你負責任務包、審查、整合、驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md（U-2 不做遊戲化、U-6 互動網站只在 GitHub Pages 能用）、batches.md「第 8 批」、progress.md、dev-notes/personal-notes/07-agents.md、quartz/static/website/ 與 content/appendix/website/ 的結構、sync_content.ps1 裡處理 website 的段落。

【第一步：設計確認】由 haiku 子代理盤點全部互動網站（名稱、入口、涵蓋的書卷章節、手機能不能用）。用 Plan 子代理（sonnet）提出描述資料格式（title、chapterRefs、topics、type、entryUrl、mobileFriendly、minutes）、資料放在哪裡（不能放在會被同步蓋掉的地方）、總入口頁與章節頁提示的樣子。你做成樣稿截圖，交 Antigravity gemini-3.8-flash-high（一律 high）審，然後停下來用選擇題問我。

【第二步：實作】產生器與測試交 Codex gpt-6-luna（effort 一律 xhigh）；頁面與章節提示交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b8-interactive）；文案交 gemini-3.8-flash-high。任務包寫目標、可改檔案、驗收、禁止事項；幫手不得 commit／push、不得讀 .env；用 git diff -w 檢查刪除行。每次委派在 progress.md 記一行。

【架構】程式要方便以後維護（共通規則 7）：一個檔案、一個函式只做一件事；判斷規則寫成可測的純函式並附單元測試，DOM、網路、儲存放在薄薄的外層；共用的值（顏色、門檻、名稱）只定義一次再引用，不要複製貼上；新功能放在合適的模組，不塞進不相干的檔案；中文註解寫「為什麼」。審查幫手的 diff 也照這個標準，不合格就退回或重構。

【硬性規則】在 feature/ux-b8-interactive 分支工作（從 main 建立；前面的批次還沒合併時先問我），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/，也不改互動網站本身的程式。不做遊戲化（不做完成徽章、積分）。需要我決定的事，停下來用選擇題問我。

【完成條件】(a) 方案經我選定；(b) 每個互動網站都有描述資料，總入口頁與相關章節的提示都正確，連結都指向 GitHub Pages；(c) 截圖寫進 progress.md，test_content 建置成功；(d) 繁體中文摘要。
```

---

## 第 9 批：研究工作區（大改版，第 3 級，1,460 字元）

```text
你是「聖經研讀知識庫」網站體驗改善第 9 批（研究工作區，大改版）的主導者。這一批會動到個人筆記的資料，屬於第 3 級。不要全部自己做：調查、方案、實作、審查都交給子代理或幫手，你負責任務包、審查、整合、驗證、和我溝通。

【先讀】dev-notes/ux-improvements/README.md、batches.md「第 9 批」、progress.md；dev-notes/personal-notes/ 的 README.md、01-decisions.md、03-architecture.md、07-agents.md、11-code-structure.md（分層與擴充規則；有衝突以 personal-notes/01 為準）。

【第一步：設計確認】用 Plan 子代理（sonnet）提出 2～3 個方案：「我的研經」首頁（最近閱讀、最近的條目、未整理的便條、收藏的經節）、研究主題筆記本（跨章節、跨條目、跨地圖集中）、需要的資料格式變更與遷移方式。資料格式只要有變更，就先寫成 personal-notes/01 的決策草案。你做樣稿截圖，交 Antigravity gemini-4-argon-high 附截圖審（429 改用 gemini-3.8-flash-high，flash 一律 high），然後停下來用選擇題問我。

【第二步：實作】介面交 sonnet 子代理（isolation: worktree，第一步 git merge --ff-only feature/ux-b9-workspace）；資料模型、遷移、和 merge／sync 有關的部分交 Codex gpt-6-sol（high）實作，再交 gemini-4-argon-high（或 flash-high）交叉審查，由你裁決；其他一般模組交 gpt-6-luna（effort 一律 xhigh）。新功能放在 plugins/personal-notes 的 features/ 資料夾，遵守 11 的分層，不改 merge／sync 核心，除非我同意。每次委派在 progress.md 與 personal-notes/10-progress-log.md 各記一行。

【架構】程式要方便以後維護（共通規則 7）：一個檔案、一個函式只做一件事；判斷規則寫成可測的純函式並附單元測試，DOM、網路、儲存放在薄薄的外層；共用的值（顏色、門檻、名稱）只定義一次再引用，不要複製貼上；新功能放在合適的模組，不塞進不相干的檔案；中文註解寫「為什麼」。審查幫手的 diff 也照這個標準，不合格就退回或重構。

【硬性規則】在 feature/ux-b9-workspace 分支工作（從 main 建立），可以本地 commit；不得 push、不得動 main，除非我明確同意。不改 content/、C:\Obsidian\Hermes、.quartz/。資料安全第一：任何可能遺失或覆蓋筆記的改動，都要先有自動化測試（含多裝置模擬）證明；舊資料要能自動遷移，也要能回復。不做任何遊戲化設計。需要我決定的事，停下來用選擇題問我。

【完成條件】(a) 方案與資料格式決策經我確認；(b) npm test（含架構規則測試）、多裝置模擬、遷移測試全過；(c) 截圖寫進 progress.md；(d) 繁體中文摘要：做了什麼、怎麼驗證、需要我做的事（實機測試 iPhone／iPad＋Windows）、風險。
```
