# 11｜程式架構與擴充指南

> 對象：之後接手開發的人（Claude、Codex、Antigravity 或人類）。
> 目的：筆記功能日後會一直加東西（畫重點、書籤、節點筆記、搜尋…），這份文件規定程式要放在哪裡、誰可以依賴誰，讓新增功能時不用動到不相干的地方。
> 依據：D-35。規則由 `plugins/personal-notes/test/architecture.test.ts` 自動檢查，違反時測試失敗。

## 1. 分層總覽

```
plugins/personal-notes/src/
├── index.ts, shared.ts          Quartz 端（建置時執行）：emitter、my-notes 頁型、版本號
├── components/                  Quartz 元件：輸出「掛載點」<… data-bwz-notes="種類">、每頁的小型啟動腳本
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
    └── features/                功能模組：每個功能一個資料夾（目前只有 notes/）
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
| `sync/syncer.ts` | 同步協定 | `sync()`、`push()`、`ensureFresh()`、`reuploadAfterWipe()`、`deleteEverything()`；狀態 `SyncStatus` |
| `sync/scheduler.ts` | 何時同步 | 去抖動上傳、輪詢、Web Locks、BroadcastChannel |
| `session/session.ts` | 帳號工作階段 | `Workspace`（每個帳號一組 store＋repo＋syncer＋scheduler）、`signInFromClick()`、`gateEdit()`、`signOut()`…；依賴 `SessionDeps` 注入 |
| `session/prompts.ts` | session 要問使用者的事 | `Prompts` 介面＋`Notice` 型別；瀏覽器實作在 `ui/prompts.ts`，測試用假的 |
| `features/types.ts` | 功能模組介面 | `Feature { id, views: { 掛載點種類: (ctx) => View } }` |
| `features/index.ts` | 功能模組清單 | `FEATURES`、`viewFactories(kind)` |
| `features/notes/` | 筆記功能 | `NotesService`（把輸入轉成 type "note" 的紀錄）、`ChapterPanel`、`MyNotesPage` |

## 4. 怎麼新增一個功能（以「畫重點」為例）

1. **資料格式**：`model/record.ts` 的 `RecordType` 已預留 `highlight`、`bookmark`；錨點 `Anchor` 已有經節、引文（quote、textHash）、節點欄位。需要新欄位時加在紀錄上（看不懂的欄位會原樣保留，03 §4.7），**不要改 merge 與 sync**。
2. **資料操作**：新增 `features/highlights/highlights.ts`，仿照 `NotesService`：用 `repo.draft({ type: "highlight", anchor, ... })` 建立、`repo.revise()`＋`repo.replace()` 修改、`repo.remove()` 刪除；查詢時用 `type` 過濾（`repo.visible()` 會回傳所有種類）。
3. **畫面**：在同一資料夾寫 View 類別（實作 `destroy()`：解除事件、移除浮動元素、存檔）。共用的對話框、狀態列從 `ui/` 拿。
4. **登記**：`features/highlights/index.ts` 匯出 `Feature`，在 `features/index.ts` 的 `FEATURES` 加上它。同一種掛載點（例如 `chapter`）可以有多個功能，依登記順序各有一個容器。
5. **需要新的掛載點**（例如人物頁）：在 `src/components/` 輸出 `<div data-bwz-notes="node" data-slug=…>`，並把種類加進 `test/architecture.test.ts` 的掛載點清單。
6. **測試**：資料操作仿照 `test/sync.test.ts` 寫多裝置情境；跑 `npm test`（含架構規則）。

不需要動的：`merge/`、`store/`、`adapter/`、`sync/`、`session/`、其他功能的資料夾。

## 5. 其他慣例

- **掛載與換頁**：Quartz 換頁（micromorph）會沿用同一個元素、只換內容與屬性。`app.ts` 會檢查容器是否還在、掛載點的 `data-*` 是否改變，必要時呼叫 `destroy()` 再重新掛載。View 不要假設自己只會被建立一次。
- **開 Google 視窗**：必須在點擊事件中同步呼叫（不可先 await）。對話框按鈕用 `run`，並用 `waitFor` 在元件載入完成前停用按鈕。
- **Google 元件何時載入**（D-34）：未登入的人按下「用 Google 同步」才載入；曾在這台裝置登入過才在啟動時預先載入。不要在其他地方呼叫 `tokens.prepare()`。
- **測試分工**：model／merge／store 單元測試；`sync.test.ts` 多裝置同步（MemoryCloud）；`session.test.ts` 登入與「先同步再編輯」流程（假的 Prompts 與 TokenSource）；`architecture.test.ts` 架構規則。瀏覽器實際行為（彈窗、換頁、對外請求）用無頭 Chrome 驗證（10 進度日誌有紀錄方法）。
- **建置**：`npm run build` 產生 `dist/`（會提交）；本機測試前把 plugin 複製到 `.quartz/plugins/personal-notes`（不含 node_modules）。
