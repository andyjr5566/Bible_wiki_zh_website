# 11｜程式架構與擴充指南

> 對象：之後接手開發的人（Claude、Codex、Antigravity 或人類）。
> 目的：筆記功能日後會一直加東西（畫重點、書籤、節點筆記、搜尋…），這份文件規定程式要放在哪裡、誰可以依賴誰，讓新增功能時不用動到不相干的地方。
> 依據：D-35。規則由 `plugins/personal-notes/test/architecture.test.ts` 自動檢查，違反時測試失敗。

## 1. 分層總覽

```
plugins/personal-notes/src/
├── index.ts, shared.ts          Quartz 端（建置時執行）：emitter、my-notes 頁型、版本號
├── components/                  Quartz 元件：輸出「掛載點」<… data-bwz-notes="種類">、每頁的小型啟動腳本（也負責左上角「我的筆記」入口，D-40）
└── client/                      瀏覽器端 App（app.js，只有頁面上有掛載點時才載入）
    ├── app.ts                   組裝根：建立 Session、把掛載點交給功能模組（唯一可以 import 所有層的檔案）
    │
    ├── model/                   資料格式：紀錄、錨點、書卷代碼、ID、HLC、版本向量          ┐
    ├── merge/                   合併規則（純函式）                                       │ 資料層
    ├── store/                   IndexedDB                                                │ 不碰 DOM
    ├── repo/                    本機資料核心＋匯出入（與紀錄種類無關）                      ┘ Node 可測
    ├── adapter/                 雲端後端介面＋Drive／記憶體實作                            ┐ 同步層
    ├── sync/                    同步協定 syncer.ts（不碰 DOM）＋瀏覽器排程 scheduler.ts      ┘
    ├── auth/                    Google 登入（GIS），瀏覽器專用
    ├── session/                 帳號工作階段：切換帳號資料、登入登出、先同步再編輯（不碰 DOM）
    ├── ui/                      共用畫面元件：DOM 工具、對話框、狀態列、Prompts 實作、環境偵測
    └── features/                功能模組：每個功能一個資料夾（notes/、highlights/）
```

資料流（由下往上依賴，畫面永遠不直接碰 Google 或 IndexedDB）：

```
features/notes（畫面＋NotesService）
        │ 讀寫紀錄                    │ 登入、先同步再編輯
        ▼                             ▼
   repo/Repository  ◀──────────  session/Session ──▶ auth（TokenSource）
        │  ▲                          │
        ▼  │ 合併結果                  ▼
   store（IndexedDB）           sync/Syncer ──▶ adapter（Drive）
```

## 2. 依賴規則（自動檢查）

| 層 | 可以 import |
|---|---|
| model | （無） |
| merge | model |
| store | model |
| repo | model、merge、store |
| adapter | model |
| sync | model、merge、store、repo、adapter |
| auth | （無） |
| session | model、store、repo、adapter、sync、auth |
| ui | model、merge、repo、sync、session |
| features | model、merge、repo、session、ui |
| app.ts | 全部（組裝根） |

另外三條：

1. **功能模組彼此獨立**：`features/<名稱>/` 只能 import 自己的資料夾和 `features/types.ts`。兩個功能要共用的東西，往下移到 `repo/`（資料）或 `ui/`（畫面）。
2. **model、merge、store、repo、adapter、sync、session 不碰瀏覽器全域物件**（document、window、localStorage、location、navigator…）。例外只有 `sync/scheduler.ts`。需要瀏覽器能力時，由 `app.ts` 透過 `SessionDeps` 注入。
3. **使用者看得到的文字放在 ui/ 與 features/**。資料層與同步層只回報「種類」（例如 `SyncStatus` 的 `error: "storage-full"`、`Notice` 的 `type`），由 `ui/status.ts`、`ui/prompts.ts` 轉成中文。例外：寫進資料的內容（例如衝突另存時標題加「（另一個版本）」）。

## 3. 各層職責與主要介面

| 檔案 | 職責 | 重點 |
|---|---|---|
| `repo/repository.ts` | 本機資料核心 | `draft()` 產生新紀錄、`revise()` 產生新版本、`insert()`／`replace()`（CAS 寫入）、`remove()`、`resolveConflict()`、查詢 `visible()`／`inChapter()`／`get()`、事件 `onChange`／`onLocalWrite`；「同步層使用」一節的方法只給 syncer 與 backup 用 |
| `repo/backup.ts` | 匯出／匯入／認領匿名紀錄 | 走正常合併規則，重複匯入無害 |
| `sync/syncer.ts` | 同步協定 | `sync()`、`push()`、`ensureFresh()`、`reuploadAfterWipe()`、`acceptWipe()`、`deleteEverything()`；狀態 `SyncStatus`；裝置整理 `maybeRetireDevices()`、已移除快取處理 `rescueRemovedCaches()`（D-39） |
| `model/linkIndex.ts`、`model/zip.ts` | 建置用連結索引格式；自寫 ZIP（匯出用） | 純函式 |
| `ui/markdown.ts` | 安全 Markdown 渲染（D-37） | `parseMarkdown()`／`parseInline()` 純函式；`renderMarkdown()` 只用 DOM API，不用 innerHTML |
| `ui/myNotesShell.ts` | 〈我的筆記〉頁外框（D-42） | `shellFor(host, session)` 取得掛載點唯一的外框；`addTab({ id, label, unit, order, el, count, total, onQuery })`、`addSection({ id, title, order, render })`、`setNotice(id, el)`、`setQuery()`；destroy 時要 `removeTab`／`removeSection` |
| `ui/library.ts` | 〈我的筆記〉清單元件（D-42） | `Library`（最近 n 則＋依書卷→章折疊、章打開才畫、搜尋平鋪每次 20 則、記住打開狀態）；純函式 `byPlace`、`recent`、`matchesQuery`、`groupByBook` 有單元測試 |
| `ui/verses.ts` | 經節定位（D-38） | `annotateVerses()`、`selectionToVerses()`、`locateQuote()`、`wrapText()`／`unwrapAll()`、`textHash()` |
| `sync/scheduler.ts` | 何時同步 | 去抖動上傳、輪詢、Web Locks、BroadcastChannel |
| `session/session.ts` | 帳號工作階段 | `Workspace`（每個帳號一組 store＋repo＋syncer＋scheduler）、`signInFromClick()`、`gateEdit()`、`signOut()`…；依賴 `SessionDeps` 注入 |
| `session/prompts.ts` | session 要問使用者的事 | `Prompts` 介面＋`Notice` 型別；瀏覽器實作在 `ui/prompts.ts`，測試用假的 |
| `features/types.ts` | 功能模組介面＋跨功能事件 | `Feature { id, views: { 掛載點種類: (ctx) => View } }`；`COMPOSE_NOTE_EVENT`（畫重點工具列「寫筆記」→ 筆記模組開新筆記並帶入節數與引文） |
| `features/index.ts` | 功能模組清單 | `FEATURES`、`viewFactories(kind)` |
| `features/notes/` | 筆記功能 | `NotesService`（把輸入轉成 type "note" 的紀錄）、`NotesPanel`（`notesPanel.ts`；章節頁與知識庫條目頁共用，差別在 `PanelTarget`：`chapterTarget`／`entryTarget`；章節目標含經節 📝 標記，條目頁預留空容器 `.bwz-related-slot`）、`MyNotesPage`（搜尋、標籤、匯出）、`drafts.ts`（編輯中草稿的本機備份與補存）、`links.ts`＋`linkComplete.ts`（`[[` 解析與自動完成）、`markdownExport.ts`（Obsidian ZIP） |
| `features/stickies/` | 便條紙（D-41） | `StickiesService`（type "sticky"、color 欄位）、`chapterView.ts`（經節下方的紙箋、收起的小紙條與浮出視窗、儲存佇列、復原、衝突選擇）、`settings.ts`（每台裝置的展開／收起偏好）、`myNotesView.ts`（〈我的筆記〉最上方的 ⚙ 設定，用 `Feature.first`） |
| `features/highlights/` | 畫重點與書籤 | `HighlightsService`（type "highlight"／"bookmark"；條目書籤用 node 錨點）、`chapterView.ts`（選取工具列、螢光標示、本章重點與書籤列）、`nodeView.ts`（知識庫條目頁標題下方的「🔖 加入書籤」，掛載點種類 `node`）、`myNotesView.ts`（我的筆記頁清單） |

## 4. 怎麼新增一個功能（以「畫重點」為例，已照這個流程做成 `features/highlights/`）

1. **資料格式**：`model/record.ts` 的 `RecordType` 已預留 `highlight`、`bookmark`；錨點 `Anchor` 已有經節、引文（quote、textHash）、節點欄位。需要新欄位時加在紀錄上（看不懂的欄位會原樣保留，03 §4.7），**不要改 merge 與 sync**。
2. **資料操作**：新增 `features/highlights/highlights.ts`，仿照 `NotesService`：用 `repo.draft({ type: "highlight", anchor, ... })` 建立、`repo.revise()`＋`repo.replace()` 修改、`repo.remove()` 刪除；查詢時用 `type` 過濾（`repo.visible()` 會回傳所有種類）。
3. **畫面**：在同一資料夾寫 View 類別（實作 `destroy()`：解除事件、移除浮動元素、存檔）。共用的對話框、狀態列從 `ui/` 拿。
4. **登記**：`features/highlights/index.ts` 匯出 `Feature`，在 `features/index.ts` 的 `FEATURES` 加上它。同一種掛載點（例如 `chapter`）可以有多個功能，依登記順序各有一個容器。
5. **需要新的掛載點**（例如人物頁）：在 `src/components/` 輸出 `<div data-bwz-notes="node" data-slug=…>`，並把種類加進 `test/architecture.test.ts` 的掛載點清單。
6. **測試**：資料操作仿照 `test/sync.test.ts` 寫多裝置情境；跑 `npm test`（含架構規則）。

不需要動的：`merge/`、`store/`、`adapter/`、`sync/`、`session/`、其他功能的資料夾。

某個功能要排在掛載點最前面，在 Feature 加 `first: ["種類"]`（目前沒有功能使用；〈我的筆記〉頁改由外框統一排版）。

〈我的筆記〉頁新增一種內容時：在功能的 mynotes 畫面裡用 `shellFor(host, session)` 登記一個分頁（內容用 `ui/library.ts` 的 `Library`），需要設定就 `addSection`。不要在頁面上直接加按鈕或區塊，讓頁面維持短而整齊。

畫面裡的固定 SVG 圖示：`h()` 只用 textContent，不支援 HTML 字串；要用常數 SVG 時以 `new DOMParser().parseFromString(svg, "text/html")` 建立（不要用 XML 模式，沒有 xmlns 不會變成 SVG），只用於程式裡的常數，絕不用於使用者內容。

兩個功能需要互動時（例如畫重點工具列要開筆記編輯器），在 `features/types.ts` 定義事件名稱與資料型別，用 `document.dispatchEvent(new CustomEvent(...))` 傳遞，不要互相 import。

## 5. 其他慣例

- **掛載與換頁**：Quartz 換頁（micromorph）會沿用同一個元素、只換內容與屬性。`app.ts` 會檢查容器是否還在、掛載點的 `data-*` 是否改變，必要時呼叫 `destroy()` 再重新掛載。View 不要假設自己只會被建立一次。
- **編輯器不可遺失輸入**：自動儲存 600 毫秒；分頁隱藏／關閉時立刻存；每個編輯框另有 localStorage 草稿（`drafts.ts`），重新整理或關分頁後下次進章節頁補存（筆記已被別處改過就另存，不覆蓋）。儲存失敗時「完成」不會關閉編輯器。新功能若有編輯器，照同樣做法。
- **切換帳號**：`session.onBeforeSwitch(fn)` 讓畫面先把編輯中的內容存進原本的帳號；fn 丟出錯誤代表「現在切換會遺失資料」，session 就不切換並通知使用者。fn 必須可以重複呼叫。
- **對話框**：`ui/dom.ts` 的 `dialog()` 會在 SPA 換頁時自動關閉、把 Tab 焦點留在框內；危險操作用 `autofocus` 讓焦點停在「取消」。
- **開 Google 視窗**：必須在點擊事件中同步呼叫（不可先 await）。對話框按鈕用 `run`，並用 `waitFor` 在元件載入完成前停用按鈕。
- **Google 元件何時載入**（D-34）：未登入的人按下「用 Google 同步」才載入；曾在這台裝置登入過才在啟動時預先載入。不要在其他地方呼叫 `tokens.prepare()`。
- **測試分工**：model／merge／store 單元測試；`sync.test.ts` 多裝置同步（MemoryCloud）；`session.test.ts` 登入與「先同步再編輯」流程（假的 Prompts 與 TokenSource）；`architecture.test.ts` 架構規則。瀏覽器實際行為（彈窗、換頁、對外請求）用無頭 Chrome 驗證（10 進度日誌有紀錄方法）。
- **建置**：`npm run build` 產生 `dist/`（會提交）；本機測試前把 plugin 複製到 `.quartz/plugins/personal-notes`（不含 node_modules）。
