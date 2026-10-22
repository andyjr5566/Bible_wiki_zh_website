# 07 幫手分工與委派規則

Claude Code（主導者）負責：架構與決策、任務切分、審查所有產出、整合與測試、和使用者溝通。幫手的產出一律經主導者審查 diff 並親自執行測試後才採用，**不可只相信幫手的自我回報**。

---

## 1. 可用幫手（2026-10-18 已在本機確認）

### 1.1 Claude 子代理（Agent 工具）
- `Explore`：大範圍搜尋程式碼、找出位置。
- `Plan`：設計審查、實作計畫。
- `general-purpose`：可平行的小型研究或實作；改檔案時用 `isolation: "worktree"` 隔離。

### 1.2 Codex CLI（OpenAI）
- 版本：`codex-cli 0.162.1`，路徑 `C:\Users\andyj_adknr2z\AppData\Local\hermes\node\codex`。
- 模型：`gpt-6-sol`（Sol）、`gpt-6-luna`（Luna，config 預設）。2026-10-18 兩者都通過測試呼叫。
- **注意：`~/.codex/config.toml` 預設 `sandbox_mode = "danger-full-access"`、`approval_policy = "never"`。委派時一律覆寫沙箱並限定工作目錄。**
- 非互動執行範本（PowerShell 或 Bash 皆可）：

```bash
codex exec -m gpt-6-sol -s workspace-write -C "<worktree 路徑>" \
  -c model_reasoning_effort="high" - < task.md
```

- **已知問題（2026-10-18）**：在這台 Windows 上 `-s read-only` 沙箱無法啟動任何子程序（`helper_unknown_error: setup refresh had errors`），Codex 讀不到檔案。只讀審查的替代做法：把檔案內容用 stdin 傳進去，提示詞放在參數（stdin 會附加成 `<stdin>` 區塊）：
  `codex exec -m gpt-6-sol -s read-only --skip-git-repo-check "<審查提示>" < 目標檔案`
  `workspace-write` 沙箱是否正常，第一次委派實作時要先驗證。
- 程式碼審查：`codex exec review`（或 `codex review`）在 worktree 中執行。
- 建議在獨立 git worktree 執行（例如 `git worktree add ../bwz-wt-p1-3 feature/personal-notes`），完成後由主導者審查並 cherry-pick。

### 1.3 Antigravity CLI（`agy`）
- 版本：`1.4.0`，路徑 `C:\Users\andyj_adknr2z\AppData\Local\agy\bin\agy`。
- 可用模型（`agy models`）：`gemini-4-argon-{low,medium,high}`、`gemini-3.8-flash-{low,medium,high}`、`claude-opus-5-5-*`、`claude-sonnet-5-5-*`、`gpt-oss-120b-medium`。
- 非互動執行範本：

```bash
agy -p "$(cat task.md)" --model gemini-4-argon-high --mode plan --sandbox
```

- `--mode plan` 適合只讀審查；需要改檔時用 `--mode accept-edits` 並限定在 worktree（`--add-dir`）。

---

## 2. 分工（暫定，待使用者確認 D-32）

| 幫手 | 適合的工作 | 例子 |
|---|---|---|
| Codex Sol（gpt-6-sol） | 複雜、正確性關鍵的實作與嚴格審查 | 合併引擎、同步狀態機、多裝置模擬測試、Token 服務 |
| Codex Luna（gpt-6-luna） | 範圍清楚的實作 | IndexedDB 封裝、Drive adapter、UI 元件、匯出入、單元測試 |
| Antigravity（Gemini 4 Argon High） | 不同模型家族的獨立第二意見 | 審查合併規則與測試案例、找邊界情況、中文介面文案與說明文件審閱 |
| Claude 子代理 | 搜尋、規劃、平行小任務 | 找 Quartz 內部 API 用法、比對 plugin 範例 |

### 任務分級（使用者 2026-10-19 要求「分配任務要分級」）

每次委派先判斷等級，用 `-m` 與 `-c model_reasoning_effort=` 明確指定，不要依賴 config 預設值（使用者的 config 預設已改為 gpt-6-astra／medium）：

| 等級 | 什麼樣的任務 | 模型與思考程度 | 例子 |
|---|---|---|---|
| 第 1 級 | 範圍清楚的小改動 | `gpt-6-luna`、`xhigh`（使用者 2026-10-20：Luna 以後一律 xhigh） | 文字、樣式、小按鈕、補單元測試、文件 |
| 第 2 級 | 一般功能實作 | `gpt-6-luna`、`xhigh` | 新畫面模組、匯出、設定頁、條目書籤 |
| 第 3 級 | 出錯會掉資料或有安全疑慮 | `gpt-6-sol`、`high` | merge、sync、裝置整理、Token 服務、安全審查 |

審查也分級：第 3 級的實作一定再用另一個模型（或 Sol 唯讀）審查一次；第 1、2 級由主導者審查 diff＋測試＋無頭 Chrome 即可。

**全部幫手的分級（使用者 2026-10-19 要求：用子代理做事，適當分派 Sonnet／Haiku、Codex Sol／Luna、Antigravity Gemini；不要自己單幹，也不要每件事都用最強的）**

| 等級 | Claude 子代理（Agent 工具 `model`） | Codex | Antigravity（`agy --model`） |
|---|---|---|---|
| 第 1 級 | `haiku`：搜尋（`Explore`）、機械性修改、檢查腳本、文件勾選、文案初稿 | `gpt-6-luna` xhigh | `gemini-3.8-flash-high`：中文文案、教學審閱（使用者 2026-10-20：3.8 flash 一律 high） |
| 第 2 級 | `sonnet`：跨多檔的一般實作、規劃（`Plan`）、動畫或畫面骨架；改檔用 `isolation: "worktree"` | `gpt-6-luna` xhigh | `gemini-4-argon-high`：使用體驗審查（附截圖與流程） |
| 第 3 級 | `sonnet` 實作也可以，但一定要有第 3 級審查 | `gpt-6-sol` high（實作或唯讀審查） | `gemini-4-argon-high`：交叉審查（`--mode plan`） |

- 主導者（Opus）保留：拆任務、任務包、審查 diff、整合、親自跑測試與無頭 Chrome、美術調整、和使用者溝通、最後報告。不用 Opus 子代理做一般工作。
- 每次委派都在 10 記一行：任務、給誰（模型與等級）、結果、主導者修了什麼。
- 第三輪的具體分派表見 13 §8。

**沙箱失效時的備案（2026-10-19）**：若 `codex exec -s workspace-write` 出現 `setup refresh had errors`，看 `~/.codex/.sandbox/sandbox.<日期>.log`。這台電腦的原因是沙箱要改 `Codex
untimes\cua_node\...
ode_repl.exe` 的權限時檔案正被使用（Codex 自己的 node_repl／cua_repl MCP 或使用者的 Codex 桌面版）。不要改用 danger-full-access；改成 stdin 模式：規格＋現有檔案經 stdin 傳入（`-s read-only`，叮嚀不要執行指令），請它用 `===FILE 名稱===`／`===END===` 輸出完整檔案，由主導者貼上並測試。注意：Codex 不能自己跑測試時，要特別檢查它有沒有用了專案 helper 不支援的寫法（例如本專案的 `h()` 不支援 `html:`）。

原則：正確性關鍵的模組（merge、sync）至少由兩個不同家族的模型交叉檢查（例如 Sol 實作、Argon 審查、主導者裁決）。

---

## 3. 委派規則（硬性）

1. 每個委派任務寫成任務包（見 §4），包含目標、可改檔案範圍、驗收標準、輸出格式。
2. 幫手**不得**：commit、push、改 main、讀取或輸出 `.env`（內有 NVIDIA／PINECONE 金鑰）與任何密鑰、修改 `content/` 經文與 vault 同步檔、修改 `C:\Obsidian\Hermes`、修改 `.quartz/`。
3. 幫手只在指定 worktree 或指定檔案內工作。
4. 主導者審查 diff、執行測試、確認符合 01 決策後才整合；不符合就退回並附具體原因。
5. 每次委派與結果在 10-progress-log.md 記一行（誰、做什麼、結果、是否採用）。
6. 不把使用者的 Google Client Secret、token 或任何個資交給幫手。Client ID 可以（它本來就是公開的）。

---

## 4. 任務包範本

```markdown
# 任務：<編號與名稱>（例：P1-3 merge 純函式）

## 背景
- 專案：Quartz 靜態站上的個人研經筆記功能。設計依據：dev-notes/personal-notes/03-architecture.md §<章節>。
- 相關決策：01-decisions.md D-xx、D-yy。

## 目標
<要完成什麼，一兩句話>

## 可修改的檔案
- plugins/personal-notes/src/client/merge/**
- plugins/personal-notes/test/merge/**
（其他檔案一律不可改）

## 規格
<逐條列出規則；直接引用 03 的內容>

## 驗收標準
- [ ] `npx vitest run test/merge` 全部通過
- [ ] 涵蓋案例：<列出>
- [ ] 無新增依賴（或列出允許的依賴）

## 禁止
不可 commit／push；不可讀 .env；不可改清單外的檔案。

## 回報格式
1. 改了哪些檔案（清單）
2. 測試指令與輸出摘要
3. 尚未處理或有疑慮的地方
```

## 5. 本機實測限制（2026-10-18）

- Codex `-s workspace-write` 也無法在這台 Windows 上執行（在 git worktree 中要求建立檔案，結果沒有產生檔案；與 read-only 同樣是沙箱無法啟動子程序）。
- 因此**目前 Codex 只用於審查**（檔案內容經 stdin 傳入）；實作由 Claude 主導者完成。不使用 `--dangerously-bypass-approvals-and-sandbox`（違反 §3 規則）。
- 若日後要讓 Codex 實作，需先排除沙箱問題（例如 `codex doctor`、更新 Codex，或由使用者在 Codex 桌面版中處理），並在 worktree 中重新驗證。
- **2026-10-19 更新**：Codex CLI 0.162.1 的 `-s workspace-write` 已可寫檔（在 scratchpad 的測試 repo 建立 hello.txt 成功）。使用者要求「請 Codex 做，不要什麼都親力親為」→ 便條紙（12 N1）改由 Codex 實作：主導者先把共用基礎 commit 到 `feature/stickies`，再開 worktree `C:\Obsidianwz-codex-stickies`（分支 `codex/stickies`，plugin 的 node_modules 用 junction 指回主 repo），任務包經 stdin 傳入（`codex exec -s workspace-write -C <worktree>`）。主導者審查 diff、跑測試與無頭 Chrome 後才整合。

## 第三輪的經驗（2026-10-19）

- **Codex**：`-s read-only` 加 `-C <外掛資料夾>` 有時能自己讀檔、有時沙箱啟動失敗（同一天兩種都遇到）；`workspace-write` 仍失敗。可靠做法仍是 stdin 模式（規格＋相關檔案整包，80 KB 左右沒問題）。**Sol 與 Luna 輸出完整檔案時會刪掉原有註解、甚至刪掉無關的方法**（這輪 session.ts、gis.ts、app.ts、myNotesPage.ts 都發生）→ 整合時一律看 `git diff -w` 的刪除行，必要時還原原檔只套功能改動。
- **Antigravity**：`agy -p` 的提示太長會「Argument list too long」→ 把任務寫成檔案，提示只寫「請閱讀檔案…」並加 `--add-dir`。`gemini-4-argon-high` 回 429（個人額度用完，約 5 天後重置）→ 用 `gemini-3.8-flash-high` 做交叉審查、`gemini-3.8-flash-medium` 審文案，品質足夠（F5a 的 6 點與 Sol 一致）。
- **Claude 子代理的 worktree** 從線上版本（origin/main）分出去，**不含本機 commit** → 任務包第一步請它 `git merge --ff-only main`；主導者要先把它需要的改動 commit。子代理不 commit，主導者用 `git add -A && git diff --cached`（排除 dist）做成 patch，`git apply -3` 套回主目錄。
- 無頭 Chrome 預設 `prefers-reduced-motion: reduce`：驗證動畫要先 `Emulation.setEmulatedMedia` 設成 `no-preference`。


## 第四輪的經驗（2026-10-20）

- **Luna 不用 low**：`gpt-6-luna` low 第一次交件在第 4 個檔案中途停掉（dialog.ts 空白、後面 4 個檔沒輸出），要補交一次。使用者：「Luna efforts 太低了」→ 第 1 級改用 luna **medium**；使用者又說「Luna 最高層級用 xhigh」→ 第 2 級（Luna 的最高一級）用 luna **xhigh**（上面兩張表已更新）。
- Python 在 Windows 用文字模式寫檔會把換行改成 CRLF；改檔用 `open(p, "w", encoding="utf-8", newline="")`，或寫完 `sed -i 's/\r$//'`。

## 第五輪的經驗（2026-10-21，UX 第 1、2 批）

- **Codex 不要同時跑兩個**：兩個 `codex exec -s workspace-write` 同時執行時，晚開的那個會出現 `setup refresh had errors`，而且之後在同一個 worktree 重跑也一樣失敗。單獨跑的時候 workspace-write 可以正常寫檔（B1-2、B2-4 都成功）。失敗時照舊改用 stdin 模式（`===FILE===` 輸出，由主導者貼上）。
- **Agent 工具的 worktree 隔離**可能因為工作目錄的磁碟代號大小寫（`c:` 與 `C:`）被拒絕建立。遇到時就自己 `git worktree add C:\Obsidian\bwz-wt-<名稱>`，叫子代理只在那個路徑工作。
- 刪 worktree 前，先把裡面的 junction（`node_modules`）用 `[IO.Directory]::Delete` 拿掉；路徑太長刪不掉時，用 `Remove-Item -LiteralPath "\?\<路徑>"`。
- Git Bash 把參數傳給 `node -e` 時會吃掉反斜線（`\|` 變成 `|`），而且 `sed -i` 會把 CRLF 改成 LF。需要精確處理時，把腳本寫成檔案再執行。
- Antigravity 的 `gemini-4-argon-high` 額度用完時（429）改用 `gemini-3.8-flash-high`，它也能看圖審截圖。

## 第六輪的經驗（2026-10-22，UX 第 4 批）

- **Codex workspace-write 時好時壞**：同一天有一次成功、兩次部分寫入、兩次完全失敗（`node_repl.exe` 被佔用）。給 Codex 的任務，如果需要它自己建置或跑測試，失敗率很高。比較穩的做法：
  1. 先試 workspace-write；
  2. 交件後一定要用 `git status` 確認檔案真的改了（有一次它回報改了兩個檔，其實沒寫進去）；
  3. 失敗就改用 stdin 模式（附上現有檔案全文，要它輸出完整檔案），由主導者貼上、跑測試。
- **Codex 沙箱連不到 GitHub**：Quartz 建置要載入社群外掛時會失敗，所以建置與瀏覽器驗證一律由主導者做。
- **手動建的 worktree 要先處理才能建置**：
  - `.quartz/plugins/<本地外掛>` 換成 junction；
  - 每個社群外掛的 `node_modules`、`dist`（被 `.gitignore` 忽略）也用 junction 連回主 repo。
  - 少了 `node_modules`，建置會卡在安裝外掛；少了 `dist`，頁面型別外掛載入失敗，章節頁不會產生，但建置仍然回報成功。
- worktree 裡 `.quartz/` 會出現大量換行雜訊（CRLF），讓 `git rebase` 拒絕執行。改用：在 worktree 提交，主 repo `git cherry-pick`，worktree 再用 `git reset --keep` 回到本批分支。
- **交叉審查值得做**：Gemini flash high 在 B4-6 找到兩個真的高嚴重度問題（失敗的 Promise 被永久快取，重試失效；兩邊都失敗時提示自相矛盾）。文案審查也抓到「士師記還沒有內容」這種可能被讀成「聖經書卷沒有內容」的說法。

## 第七輪的經驗（2026-10-22，UX 第 5 批）

- **子代理卡住時：砍掉，改派同等級的子代理接手**（使用者要求；主導者不要自己接手）。判斷卡住：它的 worktree 檔案很久沒有變動（這批 B5-5 的 sonnet 在驗證步驟卡了約 45 分鐘）。交接時附上它已完成的 diff、已驗證的部分、剩下的步驟。任務包也寫明「同一個驗證步驟超過 15 分鐘就停下來回報」。
- Codex stdin 模式改成輸出「搜尋／取代區塊」（不是整檔），不會刪掉原有註解；套用腳本見 UX progress.md 第 5 批「注意」。
- Antigravity `--mode plan` 有時只產出計畫、停在等批准；提示裡寫明「已批准、不要建立計畫、直接輸出報告」。
