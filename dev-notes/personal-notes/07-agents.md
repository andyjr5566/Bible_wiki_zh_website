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
