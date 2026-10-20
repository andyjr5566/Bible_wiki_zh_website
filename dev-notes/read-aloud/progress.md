# 經文朗讀 進度紀錄

格式：日期｜任務｜給誰（模型與等級）｜結果｜主導者修了什麼

- 2026-10-20｜設計、任務包、/goal 提示詞｜主導者｜完成（README、goal-prompt）｜—
- 2026-10-20｜T1 plugin 骨架｜Claude haiku（第 1 級）｜完成，`npm install`／`npm run build` 通過，採用｜補 `vitest.config.ts`、加 `jsdom` devDependency、tsconfig include 加 test。haiku 發現 inline script 不能是空檔（tsup loader 會報錯），骨架暫放一行 console.debug，T4 取代。
- 2026-10-20｜Codex 沙箱探測｜主導者｜`workspace-write` 仍失敗（`helper_unknown_error: setup refresh had errors`）→ Codex 一律走 stdin 模式（07 §1.2）｜—
- 2026-10-20｜T3 `verses.ts`＋測試｜Codex gpt-6-luna **medium**（stdin）→ 使用者此時指示 Luna 一律 xhigh → 捨棄 medium 版，改 **xhigh** 重跑｜xhigh 版 15 個測試通過、tsc 乾淨，採用｜測試檔第一行 `// @vitest-environment jsdom` 前多一個空格，已修。
- 2026-10-20｜T4 `player.ts`＋朗讀列 inline script＋scss＋player 測試｜Codex gpt-6-luna **xhigh**（stdin）｜完成，6 個 player 測試通過，採用｜主導者修：(1) 加 `pageshow`（persisted）重建朗讀列——從 bfcache 還原時 `pagehide` 已拆掉朗讀列但不會再有 `nav`；(2) 刪掉永遠為 false 的 `navReceived` 死程式碼；(3) scss 重複的 `&:focus-visible` 選擇器。
- 2026-10-20｜T6 部署設定｜主導者｜`quartz.config.yaml` 加 `./plugins/read-aloud`（beforeBody、priority 6）；`deploy.yml` 的 rm／cp 各加 read-aloud；本機用 junction `.quartz/plugins/read-aloud` → `plugins/read-aloud`（未提交，CI 會自己 cp）。`npx quartz build -d test_content` 成功，朗讀腳本已進 `static/scripts/script-*.js`。已 commit（6bc212b3）。
- 2026-10-20｜T5 無頭 Chrome e2e｜Claude sonnet（第 2 級）｜進行中｜—
- 2026-10-20｜T7 交叉審查｜Antigravity gemini-3.8-flash-high（`--mode plan`）｜進行中｜—
- 2026-10-20｜T8 多音字候選清單（唯讀掃描）｜Claude haiku（第 1 級）｜完成：6 卷 6510 節，列出 20 個候選詞（示、便、撒、和、都、單）→ 存成 listening-test.md 供使用者實機聽測｜加上聽測用法與建議先聽的章節；唸法未逐一查字典，不直接寫進 speech-fixes.ts，等使用者聽過回報再補。「示巴尼」在這六卷沒有出現，現有修正目前不會觸發。
- 2026-10-20｜T2 移植 `speech.ts`／`speech.test.ts`／`speech-fixes.ts`｜Claude haiku（第 1 級）｜完成，speech.ts 與來源逐位元組相同，13 個測試通過，採用｜主導者重跑全部測試確認。
