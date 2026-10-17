# 05 階段任務

規則：
- 一次只做一個階段；前一階段驗收通過才進下一階段。
- 每完成一個任務：勾選、在 [10-progress-log.md](10-progress-log.md) 追加紀錄。
- 「負責」欄：**C**＝Claude（主導整合）、**Cx**＝Codex、**AG**＝Antigravity、**Sub**＝Claude 子代理、**U**＝使用者。委派規則見 07。
- 需要使用者的任務標 🙋，做到這裡要停下來提問。

---

## Phase 0：準備與 PoC 驗證

目標：在寫正式程式前，確認最不確定的事（iPhone、LINE、token 續期、配額單位）。

| # | 任務 | 負責 | 完成 |
|---|---|---|---|
| P0-1 | 建立 `feature/personal-notes` 分支 | C | [x] 2026-10-18 |
| P0-2 | 🙋 使用者依 08 建立 Google Cloud 專案、啟用 Drive API、設定同意畫面（測試中）、建立網頁用戶端，提供 **Client ID**（不要提供 client secret） | U | [x] 2026-10-18（Client ID 見 08；設定是否正確於 P0-4 驗證） |
| P0-3 | 撰寫 PoC 頁 `quartz/static/personal-notes-poc/index.html`（單檔、無框架、noindex）：GIS 登入、about.get、generateIds＋建立、上傳、下載、列表、changes.list、刪除、revoke；顯示每步結果與耗時；偵測內建瀏覽器與 standalone；呼叫 storage.persist() 並顯示結果；Web Locks 支援檢查 | C／Cx | [x] 2026-10-18（Codex Sol 審查 11 項全數修正） |
| P0-4 | 本機（localhost:8080）在 Windows Chrome／Edge 跑通 PoC | C | [x] 2026-10-18 Windows Chrome 全通過（Edge 未測，非必要） |
| P0-5 | 🙋 使用者同意後部署 PoC 到 GitHub Pages（需要 push；或先只推分支並用其他方式提供 HTTPS 頁面，由使用者決定） | U／C | [ ] |
| P0-6 | 🙋 使用者實機測試：iPhone／iPad Safari、iPhone 主畫面 App、LINE 內建瀏覽器（含 `openExternalBrowser=1`）、Windows Chrome／Edge；依 06 §2 矩陣回報 | U | [ ] |
| P0-7 | 到 Cloud Console 觀察各 API 實際耗用配額單位（特別是 files.get?alt=media、files.create、changes.list） | U／C | [ ] |
| P0-8 | 整理 PoC 結果寫入 06，並決定：MVP 的 iPhone 主畫面 App 策略、Token 服務是否提前（D-31） | C＋U | [ ] |

**驗收**：06 §1 的 PoC 項目都有結果；01 新增依結果做出的決策。

---

## Phase 1：MVP（整章筆記＋同步）

| # | 任務 | 負責 | 完成 |
|---|---|---|---|
| P1-1 | plugin 骨架：package.json（多類別）、tsup、tsconfig、vitest；空元件可建置；quartz.config.yaml 加項目（先 `enabled: false` 驗證不影響網站）；deploy.yml 加複製步驟 | C | [ ] |
| P1-2 | model：Record 型別與驗證、ULID、HLC、書卷代碼表（附錄 A）與章節頁 slug 解析；單元測試 | Cx（Luna） | [ ] |
| P1-3 | merge：純函式合併（03 §4.4–4.5）含衝突、墓碑、修剪、冪等／交換律測試；性質測試（隨機操作序列） | Cx（Sol）＋AG 審查 | [ ] |
| P1-4 | store：IndexedDB（03 §6），帳號命名空間、匿名庫、outbox、meta；用 fake-indexeddb 測試 | Cx（Luna） | [ ] |
| P1-5 | adapter：SyncAdapter 介面＋GoogleDriveAppDataAdapter（list、generateIds、create、update、get、changes、delete、about）＋退避與限流；另做 InMemoryAdapter 供測試 | Cx（Luna）＋C 審查 | [ ] |
| P1-6 | auth：GIS 延遲載入、token client、token 保存與到期、about.get、revoke、內建瀏覽器與 standalone 偵測 | C | [ ] |
| P1-7 | sync 引擎：bootstrap、pull、push、outbox 去抖動、Web Locks 領導分頁、BroadcastChannel、雲端被清空偵測、schema 檢查、熔斷、遠端開關 config.json | C＋Cx（Sol） | [ ] |
| P1-8 | 「先同步再編輯」狀態機與 UI（03 §5）：同步中、需要重新連線、離線確認視窗（D-04 文案）、離線編輯提示、錯誤狀態 | C | [ ] |
| P1-9 | 章節筆記面板（afterBody）：新增／編輯／刪除、手動節數、Markdown 預覽（DOMPurify）、衝突顯示與解決 | C／Cx（Luna） | [ ] |
| P1-10 | 工具列同步按鈕：登入、狀態、立即同步、登出（保留／清除本機）、中斷連線 | C | [ ] |
| P1-11 | 「我的筆記」虛擬頁：列表、依書卷篩選、標題與內文簡易搜尋、跳回章節、JSON 匯出、JSON 匯入、刪除全部雲端資料 | Cx（Luna）＋C | [ ] |
| P1-12 | 首次登入併入匿名筆記的詢問流程（D-05） | C | [ ] |
| P1-13 | sw.js 快取上限與 config.json 不快取；登入後 storage.persist() | C | [ ] |
| P1-14 | 多裝置模擬整合測試（InMemoryAdapter，3 台裝置）：同時編輯、離線後合併、刪改衝突、時鐘偏差、重複上傳、上傳中斷、雲端清空、舊版 schema | Cx（Sol）＋AG 補案例 | [ ] |
| P1-15 | 文件：`content/教學/個人筆記使用說明.md`、隱私權政策頁；sync_content.ps1 首頁連結 | C＋AG 審文案 | [ ] |
| P1-16 | `test_content` 建置通過；手動確認既有功能（wiki-tour、搜尋、SPA 換頁、PWA、深色模式、閱讀模式）未受影響 | C | [ ] |
| P1-17 | 移除 PoC 頁 | C | [ ] |
| P1-18 | 🙋 使用者以 2–3 台裝置（iPhone／iPad＋Windows）在測試模式試用 2 週，回報問題；期間不可有任何筆記遺失 | U | [ ] |

**驗收**：
1. 全部自動化測試通過（含 P1-14 的所有情境）。
2. 同帳號在 Windows 與 iPhone 看到同一份筆記；離線編輯後恢復連線自動合併；同時修改產生兩個版本可選擇。
3. 無法同步時一定出現 D-04 提示；確認前不可編輯。
4. 未登入可寫；首次登入詢問併入。
5. 既有網站功能無回歸。
6. P1-18 試用期間零資料遺失。

---

## Phase 2：體驗升級

| # | 任務 | 負責 | 完成 |
|---|---|---|---|
| P2-1 | 🙋 自訂網域決定（D-30）與設定 | U＋C | [ ] |
| P2-2 | Token 服務（Code model，無資料庫）＋前端改用：免點擊續期；iPhone 主畫面 App 改用 redirect 登入 | C＋Cx（Sol） | [ ] |
| P2-3 | 經節錨點（transformer 防禦式加 ID）＋點選經節建立筆記；**前提：章節格式已穩定，先問使用者** | C | [ ] |
| P2-4 | 畫線與書籤（TextQuoteSelector＋textHash） | Cx | [ ] |
| P2-5 | Markdown ZIP 匯出（Obsidian 相容） | Cx（Luna） | [ ] |
| P2-6 | 全文搜尋（MiniSearch／FlexSearch）與標籤 | Cx（Luna） | [ ] |
| P2-7 | `[[` 自動完成（emitter 輸出精簡連結索引） | C | [ ] |
| P2-8 | 裝置退役與分片收養 | Cx（Sol） | [ ] |
| P2-9 | wiki-tour 新增筆記功能導覽 | C | [ ] |
| P2-10 | 🙋 隱私權政策與首頁定稿、Search Console 網域驗證、品牌驗證、發佈為正式版（D-33） | U＋C | [ ] |

---

## Phase 3：長期擴充

| # | 任務 | 完成 |
|---|---|---|
| P3-1 | 人物／地點／主題節點筆記與「我的相關筆記」個人反向連結（前提：節點命名穩定） | [ ] |
| P3-2 | `drive.file` 可見 Markdown 備份（漸進授權） | [ ] |
| P3-3 | Obsidian Markdown 匯入 | [ ] |
| P3-4 | 選配瀏覽器端加密 | [ ] |
| P3-5 | 互動網站整合（同網域共用引擎） | [ ] |
| P3-6 | 讀經計畫、其他同步後端（Dropbox／OneDrive／CF D1） | [ ] |
