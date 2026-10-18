# 03 架構與資料設計

本文件是實作規格。改動設計時同步更新本文件並在 01 新增決策。

---

## 1. 架構總覽

```
┌──────── 瀏覽器（GitHub Pages 靜態站，Quartz 不動）────────────┐
│ Quartz SPA 頁面                                               │
│  ├ personal-notes 元件（建置時注入）：同步狀態按鈕、章節筆記掛載點 │
│  └ 延遲載入 notes-app.js（使用者第一次互動才下載）             │
│                                                               │
│ 筆記 App（單一實例，SPA 換頁持續存在；分層詳見 11）            │
│  ├ model/ merge/ store/ repo/  資料格式、合併、IndexedDB、本機核心 │
│  ├ adapter/ sync/   Drive 介面、同步協定、排程與 Web Locks        │
│  ├ auth/ session/   GIS（drive.appdata）、帳號與先同步再編輯      │
│  └ ui/ features/    共用畫面元件、功能模組（目前：筆記）          │
└────────┬───────────────────────────────┬─────────────────────┘
         │ HTTPS + Bearer token           │（Phase 2）
         ▼                                ▼
  Google Drive API v3               Token 服務（無資料庫）
  使用者自己的 appDataFolder         Code model 換發 access token
```

原則：
- UI 只讀寫 IndexedDB；同步在背景。
- 一般讀者不下載任何筆記程式碼；GIS script（`https://accounts.google.com/gsi/client`）在筆記面板或同步按鈕**出現時**預先載入，**不可等到按下按鈕才載入**：點擊後再非同步等待 script，瀏覽器會失去「使用者手勢」，登入彈窗會被封鎖（2026-10-18 撰寫 PoC 時確認的設計限制）。
- 引擎掛在 `window.__bwzNotes`，Quartz SPA 換頁（`nav` 事件）不重建；UI 掛載點每次 `nav` 重新掛載並用 `window.addCleanup` 清理。
- 同步層實作 `SyncAdapter` 介面，可抽換（D-18）。

---

## 2. 雲端資料配置（appDataFolder）

```
appDataFolder/                      （使用者看不到）
├── device.d_7F3K9QX2.json          裝置登記：顯示名稱、最後上線、程式版本
├── notes.GEN.d_7F3K9QX2.json       裝置 7F3K9QX2 負責保存的創世記紀錄
├── notes.GEN.d_Q2M9ZP4A.json       另一台裝置的創世記紀錄
├── notes.MRK.d_7F3K9QX2.json
├── notes._NODE.d_7F3K9QX2.json     （Phase 3）人物／地點／主題節點筆記
└── notes._META.d_7F3K9QX2.json     設定、標籤顏色等
```

- 分片鍵：66 卷書的 USFM 三碼（附錄 A）＋保留鍵 `_NODE`、`_META`、`_FREE`（不掛經文的筆記）。
- 每個檔案的 `appProperties`：`{ app: "bwz-notes", kind: "shard"|"device", shard: "GEN", device: "d_7F3K9QX2", schema: "1" }`。用 `q=appProperties has { key='app' and value='bwz-notes' }` 過濾。
- 建立檔案前先用 `files.generateIds?space=appDataFolder&count=N` 取得 ID（5 單位），建立時帶入 `id` → 網路逾時重試時不會產生重複檔（重複建立同 ID 會失敗而非多一個檔）。[待驗證於 PoC]
- 本裝置自己的檔案 ID 快取在 IndexedDB `meta.ownFiles[shard]`。
- 不需要 manifest：檔案清單＋`changes.list` 就是索引。

---

## 3. 資料格式

### 3.1 分片檔

```json
{
  "schema": 1,
  "kind": "shard",
  "app": "bwz-notes",
  "shard": "GEN",
  "device": "d_7F3K9QX2",
  "writtenAt": "2026-10-18T02:20:11.402Z",
  "records": [ { ...Record }, { ...Record } ]
}
```

### 3.2 Record（一筆筆記的一個版本）

```json
{
  "id": "n_01JA8Z6Q3K9V7M2T4R5S6Y8X0W",
  "type": "note",
  "anchor": {
    "kind": "chapter",
    "ref": "GEN.10",
    "book": "GEN",
    "chapter": 10,
    "verseStart": 5,
    "verseEnd": 7,
    "endRef": null,
    "quote": null,
    "textHash": null,
    "node": null
  },
  "title": "列國的分散",
  "body": "Markdown 內文，可寫 [[寧錄]]",
  "tags": ["列國表"],
  "links": ["寧錄"],
  "createdAt": "2026-10-18T02:15:30.000Z",
  "updatedAt": "2026-10-18T02:20:11.000Z",
  "hlc": "0001760753611000:0000:d_7F3K9QX2",
  "vv": { "d_Q2M9ZP4A": 2, "d_7F3K9QX2": 1 },
  "author": "d_7F3K9QX2",
  "deleted": false
}
```

欄位規則：
- `id`：`n_`＋ULID（26 字元，時間可排序，離線產生）。畫線 `h_`、書籤 `b_`（Phase 2）。
- `type`：`note`（MVP）、`highlight`、`bookmark`（Phase 2）。
- `anchor.kind`：`chapter`（MVP）、`verse`（Phase 2，經節介面）、`node`（Phase 3）、`free`。
- `anchor.ref`：`BOOK.章` 或 `BOOK.章.節`；跨章用 `endRef`（如 `GEN.1.1` → `GEN.2.3`）。`verseStart/verseEnd` 可由使用者手動輸入（MVP）。
- `quote`／`textHash`：Phase 2 畫線用（W3C Web Annotation TextQuoteSelector：`{exact, prefix, suffix}`；`textHash` 為建立時該節經文正規化後的短雜湊，用於偵測經文措辭改變）。
- `node`：Phase 3，`{ slug, title }`；解析失敗列入「失聯筆記」。
- `links`：從 body 抽出的 `[[…]]` 目標（衍生資料，用於個人反向連結）。
- `hlc`：見 3.3，用於在「同時修改」的版本之間決定畫面顯示哪一個（最後寫入者優先）。
- `vv`（version vector，版本向量）：每台裝置對這則筆記編輯過幾次。編輯時取「目前看到的所有版本的 vv 逐項最大值」，再把自己那一項 +1。用來判斷誰看過誰（見 4.4）。
  （2026-10-18 修正：原設計用 `baseHlc >= V.hlc` 判斷「看過」是錯的——HLC 大小不代表因果，兩台裝置各自編輯時，後者的 base 時間仍可能大於前者，會把真正的衝突誤判為已取代。改用 vv，見 D-26。）
- `author`：寫出這個版本的裝置。
- `deleted: true`：墓碑；body 可清空，保留 id／anchor／hlc。
- `copiedFrom: { id, hlc }`（選用）：這則是從哪個版本另存來的（衝突「兩個都保留」、匯入衝突、雲端清空後搶救）。重複匯入同一份備份時用來認出「已經另存過」，避免重複（2026-10-18，Codex 重構審查）。
- body 上限建議 100 KB（超過提示使用者）；單一分片檔不設硬上限，但超過 2 MB 時記錄警告（Phase 2 再考慮分割）。

### 3.3 HLC（混合邏輯時鐘）

字串格式：`{wallMs 16 位補零}:{counter 4 位補零}:{deviceId}`，可直接字串比較大小。
- 本地產生：`wall = max(now, last.wall)`；若 `wall == last.wall` 則 `counter+1`，否則 `counter=0`。
- 收到遠端紀錄時：`last = max(last, remote)`（之後本地產生的 hlc 必大於所有已見過的版本）。
- 目的：手機與電腦時鐘不準時，新版也不會被舊版蓋掉。

### 3.4 裝置 ID 與命名空間
- 裝置 ID：首次啟動產生 `d_`＋8 碼 Crockford Base32，存在該帳號命名空間的 IndexedDB。
- iPhone 的 Safari 與主畫面 App 儲存分開 → 視為兩台裝置（正常）。
- 清除網站資料後會產生新的裝置 ID；舊裝置的分片仍在雲端，照常參與合併。

---

## 4. 同步演算法

### 4.1 首次在某裝置登入（bootstrap）
1. `changes.getStartPageToken` → 暫存 token（先取 token 再列表，避免遺漏中間變更；重複套用無害，因為合併是冪等的）。
2. `files.list(spaces=appDataFolder, q=appProperties…, fields=files(id,name,appProperties,version), pageSize=1000)`。
3. 下載所有分片（`files.get?alt=media`），併發數 ≤ 4。
4. 合併進本機（4.4）；記錄每個外部檔案已處理的 `version`。
5. 若本機有未登入時的匿名筆記 → 詢問是否加入此帳號（D-05）；加入則改寫為本裝置作者、產生新 hlc，標記相關分片待上傳。
6. 寫入本裝置 `device.d_xxx.json`。
7. 保存 start page token，進入 `ready`。

### 4.2 拉取（pull）
觸發：開啟網站、開啟筆記面板／我的筆記頁／開始編輯（距上次 pull > 30 秒，D-03）、視窗取得焦點（節流 30 秒）、頁面可見時定期（3 分鐘起，連續無變更逐步拉長到 10 分鐘）、上傳前（距上次 pull > 30 秒）。頁面隱藏時停止定期輪詢。
步驟：`changes.list(pageToken, spaces=appDataFolder, includeRemoved=true, fields=nextPageToken,newStartPageToken,changes(fileId,removed,file(name,appProperties,version)))` → 篩掉本裝置自己的檔案 → 對 `version` 比已處理更新的外部分片下載 → 合併 → 保存新 token。
`removed` 的外部檔案：只記錄，不刪除本機紀錄（避免使用者誤刪 App 資料時連帶清空本機，見 4.7）。

### 4.3 上傳（push）
- 本機每次儲存（輸入停頓 0.5 秒）→ 寫 IndexedDB → 該分片加入 outbox。
- 送出時機：停止輸入 5 秒、連續輸入滿 60 秒、`visibilitychange` 變 hidden、SPA `prenav`、手動「立即同步」。
- 送出內容：本裝置對該分片「負責保存」的所有紀錄（4.5）整份覆寫（`PATCH upload/drive/v3/files/{id}?uploadType=media`）；尚無檔案則 multipart 建立（帶 generateIds 取得的 id、`parents:["appDataFolder"]`、appProperties）。
- 成功後才把 outbox 項目移除；失敗保留並退避重試。
- 單一寫入者 → 寫入前不需要讀取自己的檔案；上傳前的 pull 是為了讓畫面最新（D-03），不是為了正確性。

### 4.4 合併規則（純函式，必須有完整單元測試）
對每個筆記 `id`，收集本機與所有分片中的版本（每個分片最多一個版本；相同 hlc 視為同一版本）：
1. **被取代**：若存在另一版本 X 使 `V.vv ≤ X.vv`（逐項小於等於）且 X ≠ V → V 已被 X 取代（X 是看過 V 之後寫的），丟棄 V。
2. 剩下的版本彼此都是**同時修改**（沒有誰看過誰）。**勝出版本 W** = 其中 `hlc` 最大者，畫面顯示 W。
3. 其餘未被取代的版本 V：若內容（title/body/tags/anchor/deleted）與 W 不同 → 衝突，列出讓使用者選擇；內容相同 → 視為一致。
4. **每次寫入**的新版本 vv = 前緣所有版本 vv 的逐項最大值，再把自己那項 +1 → 自動取代前緣全部版本，不需額外儲存衝突狀態。
   因此**有衝突的筆記必須先讓使用者選定**（保留這個／保留另一個／兩個都保留＝另存一則新筆記），才能繼續編輯；不提供「只以勝出版本為基礎繼續編輯」，因為那會讓本裝置計數倒退，造成默默取代自己的衝突版本、或讓第三台裝置的版本被誤判為看過它（2026-10-18 實作時以測試反例確認）。
5. 刪除 vs 修改同時發生 → 衝突（「另一台裝置刪除了這則筆記，但這台有修改」）。
6. 合併必須冪等、可交換、可結合（同樣輸入順序不同結果相同）。

### 4.5 本裝置「負責保存」哪些紀錄、何時修剪
- 本裝置分片包含：本裝置寫出的每則筆記的最新版本。
- 修剪：若某則筆記本裝置的版本已被其他裝置的版本取代（規則 4.4-1，vv 被支配），下次寫入時可從本裝置分片移除（取代者仍保存在對方分片）。
- 墓碑保留至少 365 天才可修剪。
- 裝置退役與分片收養（長期未上線裝置的檔案整併）→ Phase 2（3 個月未上線的裝置，由其他裝置先複製其未被取代的紀錄再刪除檔案）。

### 4.6 多分頁
- 用 `navigator.locks.request("bwz-notes-sync-<permissionId>")` 選出唯一同步分頁；其他分頁只寫 IndexedDB 並透過 `BroadcastChannel("bwz-notes")` 通知與接收更新。
- 不支援 Web Locks 的瀏覽器 → 以 IndexedDB 租約（lease，含到期時間）退而求其次。

### 4.7 保護機制
- **雲端被清空偵測**：本裝置曾成功同步、本機有資料，但雲端列表為空 → 停止自動同步，詢問「雲端資料似乎被刪除了（可能是在 Google 雲端硬碟中移除了本站的應用程式資料），要用這台裝置的資料重新上傳嗎？」
- **Schema 版本**：遠端檔案 `schema` 大於本程式支援 → 停止寫入該帳號、提示更新網頁；讀取時忽略看不懂的欄位但寫回時保留（unknown fields pass-through）。
- **退避**：403／429／5xx → 截斷指數退避（1、2、4…最多 64 秒＋≤1000ms 隨機）；連續失敗 5 次 → 熔斷 5 分鐘並顯示錯誤狀態。
- **客戶端限流**：每分頁 Drive 呼叫一般 ≤ 20 次／分，硬上限 60 次／分；寫入 ≤ 6 次／分。
- **遠端緊急開關**：`static/personal-notes/config.json`（`{ syncEnabled, minPollSeconds, maxWritesPerMinute, notice }`），啟動時讀取（快取 1 小時）；改值需重新部署（約數分鐘）。
- **雲端硬碟已滿**（`storageQuotaExceeded`）→ 明確提示，資料保留本機。
- **管理員封鎖**（`admin_policy_enforced`，學校／公司帳號）→ 提示並退回本機模式。

---

## 5. 「先同步再編輯」狀態機（D-03、D-04、D-05）

| 狀態 | 條件 | 可否編輯 | 畫面 |
|---|---|---|---|
| `local-only` | 從未登入 | 可以 | 提示條：「筆記目前只存在這台裝置。登入 Google 可跨裝置同步。」 |
| `syncing` | 已登入且有有效 token，正在拉取 | 暫停（顯示轉圈，逾時 8 秒） | 「同步中…」 |
| `ready` | 拉取完成 | 可以 | 狀態：「已同步 10:32」；背景上傳中顯示「同步中」 |
| `needs-reconnect` | 曾登入，但 token 不存在或過期（MVP 關閉瀏覽器後必然出現） | 暫停 | 〔連線 Google 同步〕〔先離線編輯〕 |
| `offline-confirm` | `syncing` 逾時／失敗，或使用者選「先離線編輯」 | 暫停 | D-04 提示視窗：〔重試同步〕〔我知道了，繼續編輯〕 |
| `offline-editing` | 使用者確認後 | 可以 | 常駐小提示：「離線編輯中，恢復連線後自動合併」 |
| `error` | 熔斷、雲端已滿、管理員封鎖、雲端被清空 | 依情況（本機可編輯） | 對應錯誤說明與處理按鈕 |

轉換重點：
- `offline-editing` 偵測到恢復連線（`online` 事件或定期探測）且有 token → 自動 pull＋push → `ready`；若沒有 token → 顯示「點一下恢復同步」（MVP 需使用者手勢）。
- 同一工作階段內已確認過離線提示，不要每開一則筆記就再跳一次；狀態回到 `ready` 後再次失敗才重新提示。
- 編輯中 token 過期：不打斷輸入；完成的修改照常存本機與 outbox，狀態改顯示「點一下繼續同步」。

---

## 6. 本機儲存（IndexedDB）

- 資料庫：`bwz-notes-anon`（未登入）與 `bwz-notes-<permissionId>`（每個 Google 帳號一個）。切換帳號不混資料。
- Object stores：`records`（keyPath `id`，索引 `book`、`ref`、`updatedAt`、`tags`）、`outbox`（shard → 待上傳）、`remote`（外部分片 id → 已處理 version、內容快取）、`meta`（deviceId、ownFiles、startPageToken、lastPullAt、hlcLast、email 用於 login_hint）。
- 建議使用 `idb`（約 1 KB）而非大型框架。
- 登入後呼叫 `navigator.storage.persist()`；記錄結果供除錯。
- 登出：選擇〔保留此裝置上的筆記〕或〔清除此裝置上的筆記（公用電腦請選這個）〕；有 outbox 未送出時先警告。

---

## 7. 授權模組（MVP：GIS Token model）

- `google.accounts.oauth2.initTokenClient({ client_id, scope: "https://www.googleapis.com/auth/drive.appdata", prompt: "", login_hint, callback, error_callback })`。
- GIS 預先載入並 `initTokenClient`，使點擊處理函式能**同步**呼叫 `requestAccessToken()`（中間不可有 `await`），否則彈窗會被封鎖。
- 第一次：使用者點「用 Google 同步」→ 先顯示說明：「本站只能存取它自己建立的隱藏筆記資料夾，看不到你雲端硬碟的任何其他檔案。」→ 使用者在說明視窗按「繼續」時（新的使用者手勢）呼叫 `requestAccessToken()`。
- Token 只放記憶體＋同分頁 `sessionStorage`（含到期時間，提前 5 分鐘視為過期）；不放 localStorage、不放網址。
- 取得 token 後呼叫 `about.get` 取得 displayName、emailAddress、photoLink、permissionId。
- 續期：只能在使用者點擊中呼叫；UI 提供「連線同步」「點一下繼續同步」按鈕。
- 偵測內建瀏覽器（UA 含 `Line/`、`FBAN`、`FBAV`、`Instagram` 等）→ 不嘗試登入，顯示「請用 Safari／Chrome 開啟」並提供複製連結；LINE 可試 `openExternalBrowser=1`。
- 偵測 standalone（`display-mode: standalone` 或 `navigator.standalone`）→ PoC 結果決定 MVP 行為（可能顯示「請在 Safari 中登入同步」）。
- 撤銷：設定中的「中斷與 Google 的連線」→ `google.accounts.oauth2.revoke(token)`。
- 收到 401 → 視為 token 失效 → `needs-reconnect`。

---

## 8. 使用者操作流程

1. **未登入**：章節頁底部「我的筆記」面板 → 新增筆記（可填節數）→ 存本機 → 提示可登入同步。
2. **首次登入**：內建瀏覽器檢查 → 權限說明 → Google 同意畫面（只有一項權限）→ bootstrap → 詢問是否併入匿名筆記 → `ready`。
3. **日常**：開啟面板先同步（≤30 秒內不重複）→ 編輯 → 自動存本機 → 自動上傳。
4. **換裝置**：登入同一帳號 → 下載合併 → 所有筆記出現。
5. **衝突**：該筆記顯示「有兩個版本」→ 並排比較 → 選一個或合併編輯。
6. **登出**：保留或清除本機資料。
7. **刪除雲端資料**：先提示匯出 → 二次確認 → 刪除 appDataFolder 中本 App 的所有檔案。

---

## 9. 安全與隱私

- 最小授權：只有 `drive.appdata`。
- XSS：筆記 Markdown 渲染一律經 DOMPurify；匯入檔案視為不可信；筆記程式不從第三方 CDN 載入 script（GIS 除外，且只在登入時載入）。
- 同源風險：目前 `andyjr5566.github.io` 下所有 GitHub Pages 專案站同源（共用 IndexedDB 與 OAuth 授權來源）→ 正式公開前考慮自訂網域（D-30）。
- 隱私權政策（Phase 1 撰寫）：網站不保存、不經手筆記；筆記存在使用者自己的 Google Drive 隱藏資料夾；Plausible 分析不含筆記內容；筆記 ID 不放進網址參數。
- 資料刪除：App 內刪除；或 Google 雲端硬碟 → 設定 → 管理應用程式 → 刪除隱藏的應用程式資料；或 Google 帳戶 → 第三方連線 → 移除存取權。
- 選配（Phase 3）：瀏覽器端密語加密（WebCrypto），忘記密語無法救回。

---

## 10. 匯出、匯入與 Obsidian

- **JSON 完整備份**（MVP）：`{ app, schema, exportedAt, records[] }`，可再匯入（匯入走正常合併規則，重複匯入無害）。
- **Markdown ZIP**（Phase 2）：每筆一檔，YAML 開頭區塊（id、ref、tags、created、updated、source: bible-wiki-zh），內文保留 `[[寧錄]]`、`[[01 創世記/第10章]]` 這類與 vault 同名的連結，放進 Obsidian 即可連到既有知識節點。
- **Obsidian 匯入**（Phase 3）；雙向同步不做。

---

## 11. Phase 2 以後的設計備忘

- **Token 服務**：GIS Code model（彈窗或 redirect）→ 後端用 client secret 換 refresh token → 存 HttpOnly、Secure、SameSite cookie（需要與網站同站 → 自訂網域＋子網域）→ `/token` 回傳新 access token。無資料庫。彈窗模式驗 `X-Requested-With`，redirect 模式驗 `state`。若無自訂網域只能把加密後的 refresh token 存在瀏覽器（較弱）。
- **經節錨點**：plugin transformer 只在章節頁替經文有序列表的 `<li>` 加 `id="v5" data-v="5"`；必須防禦式偵測（認不出就不加、不讓建置失敗）；章節格式穩定後才做。
- **畫線**：TextQuoteSelector＋TextPositionSelector＋textHash；經文改變時嘗試重新定位，失敗則標示。
- **知識節點筆記與個人反向連結**：筆記中的 `[[寧錄]]` 讓節點頁出現「我的相關筆記」；自動完成用 plugin 輸出的精簡連結索引（不要載入 19.7 MB 的 contentIndex.json）。
- **裝置退役與分片收養**、**`drive.file` 可見 Markdown 備份**、**其他同步後端**。

---

## 附錄 A：書卷代碼表（USFM 三碼）

資料夾編號即 content 的書卷資料夾前綴（如 `01 創世記`）。章數用於驗證輸入。

| 編號 | 書卷 | 代碼 | 章數 |
|---|---|---|---|
| 01 | 創世記 | GEN | 50 |
| 02 | 出埃及記 | EXO | 40 |
| 03 | 利未記 | LEV | 27 |
| 04 | 民數記 | NUM | 36 |
| 05 | 申命記 | DEU | 34 |
| 06 | 約書亞記 | JOS | 24 |
| 07 | 士師記 | JDG | 21 |
| 08 | 路得記 | RUT | 4 |
| 09 | 撒母耳記上 | 1SA | 31 |
| 10 | 撒母耳記下 | 2SA | 24 |
| 11 | 列王紀上 | 1KI | 22 |
| 12 | 列王紀下 | 2KI | 25 |
| 13 | 歷代志上 | 1CH | 29 |
| 14 | 歷代志下 | 2CH | 36 |
| 15 | 以斯拉記 | EZR | 10 |
| 16 | 尼希米記 | NEH | 13 |
| 17 | 以斯帖記 | EST | 10 |
| 18 | 約伯記 | JOB | 42 |
| 19 | 詩篇 | PSA | 150 |
| 20 | 箴言 | PRO | 31 |
| 21 | 傳道書 | ECC | 12 |
| 22 | 雅歌 | SNG | 8 |
| 23 | 以賽亞書 | ISA | 66 |
| 24 | 耶利米書 | JER | 52 |
| 25 | 耶利米哀歌 | LAM | 5 |
| 26 | 以西結書 | EZK | 48 |
| 27 | 但以理書 | DAN | 12 |
| 28 | 何西阿書 | HOS | 14 |
| 29 | 約珥書 | JOL | 3 |
| 30 | 阿摩司書 | AMO | 9 |
| 31 | 俄巴底亞書 | OBA | 1 |
| 32 | 約拿書 | JON | 4 |
| 33 | 彌迦書 | MIC | 7 |
| 34 | 那鴻書 | NAM | 3 |
| 35 | 哈巴谷書 | HAB | 3 |
| 36 | 西番雅書 | ZEP | 3 |
| 37 | 哈該書 | HAG | 2 |
| 38 | 撒迦利亞書 | ZEC | 14 |
| 39 | 瑪拉基書 | MAL | 4 |
| 40 | 馬太福音 | MAT | 28 |
| 41 | 馬可福音 | MRK | 16 |
| 42 | 路加福音 | LUK | 24 |
| 43 | 約翰福音 | JHN | 21 |
| 44 | 使徒行傳 | ACT | 28 |
| 45 | 羅馬書 | ROM | 16 |
| 46 | 哥林多前書 | 1CO | 16 |
| 47 | 哥林多後書 | 2CO | 13 |
| 48 | 加拉太書 | GAL | 6 |
| 49 | 以弗所書 | EPH | 6 |
| 50 | 腓立比書 | PHP | 4 |
| 51 | 歌羅西書 | COL | 4 |
| 52 | 帖撒羅尼迦前書 | 1TH | 5 |
| 53 | 帖撒羅尼迦後書 | 2TH | 3 |
| 54 | 提摩太前書 | 1TI | 6 |
| 55 | 提摩太後書 | 2TI | 4 |
| 56 | 提多書 | TIT | 3 |
| 57 | 腓利門書 | PHM | 1 |
| 58 | 希伯來書 | HEB | 13 |
| 59 | 雅各書 | JAS | 5 |
| 60 | 彼得前書 | 1PE | 5 |
| 61 | 彼得後書 | 2PE | 3 |
| 62 | 約翰一書 | 1JN | 5 |
| 63 | 約翰二書 | 2JN | 1 |
| 64 | 約翰三書 | 3JN | 1 |
| 65 | 猶大書 | JUD | 1 |
| 66 | 啟示錄 | REV | 22 |

合計 1,189 章。content 目前的資料夾名稱已核對 01–43 與上表一致（2026-10-18）；44–66 尚未建立資料夾，實作時以編號對應，名稱僅供顯示。
