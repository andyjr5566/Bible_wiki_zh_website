# 經文朗讀：設計與分工

> 2026-10-20 研究整理。需求（使用者原話：「只要能夠朗讀經文的部分，其他都不要做」）：在章節頁用瀏覽器內建語音朗讀經文，效果比照「亞當到耶穌」互動網站的朗讀。

## 1. 範圍

**做**
- 章節頁（`content/NN 書卷/第N章.md`）上，只朗讀「經文清單」：導覽表之後、第一條分隔線之前的有序清單（每個 `<li>` 一節）。
- 播放／停止、語速、從第幾節開始；唸到哪一節就把那一節標示出來並捲動到可見處；唸完最後一節自動停止。
- 朗讀用的多音字修正表（只改送給語音的文字，畫面不變）。

**不做**（使用者要求；要加都另外談）
- 導覽表、註解、〈本章整理〉、知識節點、附錄、便條紙／筆記的朗讀。
- 預錄音檔、雲端 TTS、逐字高亮、暫停／繼續、跨章自動續讀、英文或其他語言、朗讀設定同步到 Google Drive。

## 2. 研究結果

**現成的朗讀引擎**：`quartz/static/website/全聖經/亞當到耶穌/src/ui/speech.ts`（Web Speech API 的包裝）與 `src/data/speech-fixes.ts`。
- 挑中文語音：zh-TW → zh-HK → 任何 zh；等語音載入最多 1.5 秒；找不到就回報不可用。
- `speak(text, { rate, onEnd })`、`stop()`、語速夾在 0.5–2。
- `buildSpokenText` 套用多音字替換，並保留「朗讀字元位置 → 原文位置」對照。
- 互動網站 `reader.ts` 也是「一次只唸一段（`speech.speak(item.verse.text…)`），唸完再接下一段」，可避開 Chrome 在長文約 15 秒後無預警停止的問題。本功能沿用這個作法：**一節一個 utterance**。
- 它是獨立檔案（只依賴瀏覽器的 `speechSynthesis`），但屬於另一個 Vite 專案，不能直接 import → **複製**進新 plugin，不要跨專案引用。

**章節頁的經文結構**（已核對 `content/02 出埃及記/第12章.md`，目前只有 6 本書有章節：創世記～約書亞記）
- 檔案開頭是 `# 標題`、章節導覽表，然後是 `1. …` `2. …` 的有序清單，清單後有 `---`，再來才是本章整理、知識節點等。
- 經節文字裡有 `[[連結|顯示字]]`，渲染成 `<a>`；取 `textContent` 即可得到正確的朗讀文字。
- 個人筆記 plugin 已有同一套判斷規則：`plugins/personal-notes/src/client/model/verseList.ts` 的 `findVerseList`（分隔線之前的第一個 `<ol>`；1–200 節；`start` 屬性為起始節數）。**複製這份規則（約 15 行）到新 plugin，不要依賴 personal-notes**（它可能被關閉）。
- 個人筆記 plugin 會在 `<li>` 裡加 `.bwz-v-ui` 元素（📝 標記、便條紙），並把畫重點的文字包成 `<mark>`。取朗讀文字時：**略過 `.bwz-v-ui`**，其餘文字照取（`<mark>` 內的字仍是經文）。`ui/verses.ts` 的 `textNodes()` 就是這個作法。
- content 仍在建置中（見記憶「content-is-work-in-progress」），不要把頁面結構當定案：**認不出經文清單就完全不顯示朗讀列**，不報錯、不影響其他功能。

**放在哪裡**：新 plugin `plugins/read-aloud`（照 `plugins/wiki-tour` 的結構：`src/components/*.tsx` + `scripts/*.inline.ts` + `styles/*.scss`，`tsup` 建置，`dist/` 要提交）。需要改三個地方，才不會被 CI 洗掉（見記憶「quartz-plugin-durability」）：
1. `quartz.config.yaml` 加 `- source: ./plugins/read-aloud`（`layout.position: beforeBody`，priority 要排在 wiki-tour 之後、personal-notes 之前，實際值看建置結果調整）。
2. `.github/workflows/deploy.yml` 的 `rm -rf` 那行加 `.quartz/plugins/read-aloud`，並加 `cp -r plugins/read-aloud .quartz/plugins/read-aloud`（第 78–83 行附近）。
3. 本機建置時自己複製到 `.quartz/plugins/`。

## 3. 設計

**介面**：經文清單正上方插入一條小列：`🔊 朗讀　從第 [1▾] 節　語速 [1.0×▾]　[▶ 播放]`；播放中變成 `[■ 停止]`，列改為 `position: sticky; top: 0`，捲到哪裡都能停止。手機寬度下自動折行。顏色用站上主題變數，深色模式正常。沒有 `speechSynthesis`，或 1.5 秒內找不到中文語音：整列不顯示（或只顯示一行「此瀏覽器沒有中文語音」，由實作時擇一，預設不顯示）。

**流程**：
1. 頁面載入與 Quartz SPA 換頁（`nav` 事件）時：先 `stop()`、清掉舊的列，再找經文清單，找不到就結束。
2. 播放：從選定的節開始，取該節文字 → `speech.speak(text, { rate, onEnd })` → `onEnd` 時標示並唸下一節；最後一節唸完回到待命。
3. 標示：被唸的 `<li>` 加 class `bwz-ra-now`（淡色背景＋左邊線），並 `scrollIntoView({ block: "center", behavior: reduced-motion ? "auto" : "smooth" })`；停止或換頁時移除。
4. 語速：0.75／1.0／1.25／1.5／1.75／2.0（引擎上限 2 倍；使用者 2026-10-21 要求加到 2 倍），存 `localStorage`（讀寫都包 try/catch）。播放中改語速：從當前節重新開始。
5. 換頁、關分頁、`pagehide` 時一律 `stop()`。

**不變式**：只有 `<ol>` 的 `<li>` 文字會被送進語音；導覽表、`.bwz-v-ui`、隱藏元素的文字都不能出現在朗讀文字裡（有單元測試）。

**多音字**：`src/data/speech-fixes.ts`，從互動網站帶過來「示巴尼 → 士巴尼」。其餘靠使用者實際聽過再補（見任務 T8），不要憑空猜。

## 4. 任務與分工

依 `dev-notes/personal-notes/07-agents.md` 的分級（**使用者 2026-10-20 指示：Luna 以後一律 xhigh、Gemini 3.8 flash 一律 high**，覆蓋 07 表格裡的 medium；Codex `workspace-write` 失敗時改 stdin 模式；Claude 子代理用 worktree 時先 `git merge --ff-only main`；幫手不 commit／push、不碰 `.env`、`content/`、`.quartz/`）。

| # | 任務 | 等級 | 給誰 |
|---|---|---|---|
| T1 | 從 `plugins/wiki-tour` 複製出 `plugins/read-aloud` 骨架（package.json、tsup、tsconfig、index.ts、空元件、空 scss），改名；`npm install && npm run build` 通過 | 1 | Claude 子代理 `haiku` |
| T2 | 複製 `speech.ts`、`speech.test.ts`、`speech-fixes.ts` 到新 plugin，修 import 路徑，`vitest` 通過（不改邏輯） | 1 | Haiku 子代理（Codex Luna 一律 xhigh，不值得為純複製動用） |
| T3 | `verses.ts`：複製 `findVerseList` 規則＋`verseTexts(root)`（略過 `.bwz-v-ui`、隱藏元素）＋單元測試（有／沒有清單、超過 200 節、`start≠1`、含連結、含 `<mark>`、含 `.bwz-v-ui`） | 1 | Codex `gpt-6-luna` xhigh |
| T4 | UI 模組：朗讀列、逐節佇列、標示與捲動、語速存取、SPA 換頁與 `pagehide` 清理、scss（含深色、手機） | 2 | Codex `gpt-6-luna` xhigh（備案：`sonnet` worktree） |
| T5 | 以假的 `speechSynthesis` 寫 UI 層測試（逐節順序、最後一節自動停止、換頁停止、改語速重唸）；無頭 Chrome 腳本（stub `speechSynthesis`，驗證 `speak` 收到的文字只有經文） | 2 | Claude 子代理 `sonnet` |
| T6 | `quartz.config.yaml`、`deploy.yml` 修改；`npm run build` 並提交 `dist/`；`npx quartz build -d test_content -o <scratch>` 驗證；既有功能（wiki-tour、搜尋、SPA、個人筆記標記、深色模式）沒有回歸 | 2 | 主導者親自做（改部署流程，不外包） |
| T7 | 交叉審查：diff 與朗讀列的繁體中文文字（按鈕、提示） | 1–2 | Antigravity `gemini-3.8-flash-high`（`gemini-4-argon-high` 額度用完時） |
| T8 | 多音字清單：請使用者在 Windows、iPhone、Android 實際聽創世記～約書亞記的幾章，回報唸錯的詞；主導者補進 `speech-fixes.ts`。另可請 `haiku` 掃 6 本書列出「容易唸錯的專有名詞」候選供聽測時參考 | 1 | 使用者＋`haiku` |

主導者保留：拆任務與任務包、審查每個幫手的 diff（特別注意幫手整檔輸出時刪掉原有註解）、整合、親自跑所有測試與無頭 Chrome、最後回報。沒有資料遺失或安全疑慮，所以不需要 Sol。

## 5. 驗收標準

- [x] 6 本有章節的書，任一章：朗讀列出現在經文上方；播放後每節依序被唸、被標示、捲動到可見處；唸完最後一節自動回到待命。（驗證範圍：6 本書 211 章 6510 節的 markdown 經文清單都從第 1 節連續編號；e2e 實際跑在 test_content 的創世記 1、2、6 章）
- [x] 送進語音的文字只有經文（測試證明沒有導覽表、`.bwz-v-ui`、本章整理的文字）。
- [x] 非章節頁（首頁、導論、全書目錄、附錄）沒有朗讀列。
- [x] SPA 換頁、關分頁時語音立刻停止；沒有殘留標示。
- [x] 瀏覽器沒有中文語音時不報錯、不留空殼。（單元測試涵蓋 `ready()` 回傳 false；e2e 沒有模擬無語音的瀏覽器）
- [x] 深色模式、手機寬度（375px）排版正常；個人筆記的畫重點與便條紙照常運作。
- [x] `npm test`、`test_content` 建置、既有功能無回歸。
- [x] 使用者在至少兩種裝置（Windows 加 iPhone 或 Android）聽過並確認可用。（2026-10-21 使用者回覆「我覺得可以了」，並表示不必再重建完整站；他沒有說明聽測用了幾種裝置，所以這一項是依使用者的確認勾選，不是我逐裝置驗證的。自動驗證的部分：本機 Windows＋Chrome＋Microsoft Hanhan，真人滑鼠點擊後逐節前進與停止正常；聽感、iPhone、Android 尚未驗證）

## 6. 已知限制（要先告訴使用者）

- 音質取決於裝置：Windows 的 Hanhan 較機械，iOS／Android 通常自然得多。
- iOS Safari 鎖屏或切到背景時通常會中斷，無法靠網頁解決。
- 無頭 Chrome 沒有真的聲音，只能驗證邏輯；「唸得對不對、順不順」一定要靠使用者實機聽。
