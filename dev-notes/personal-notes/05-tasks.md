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
| P0-5 | 🙋 使用者同意後部署 PoC 到 GitHub Pages（需要 push；或先只推分支並用其他方式提供 HTTPS 頁面，由使用者決定） | U／C | [x] 2026-10-18 只推 PoC 頁到 main（`0f1b2559`），已上線 https://andyjr5566.github.io/Bible_wiki_zh_website/static/personal-notes-poc/ |
| P0-6 | 🙋 使用者實機測試：iPhone／iPad Safari、iPhone 主畫面 App、LINE 內建瀏覽器（含 `openExternalBrowser=1`）、Windows Chrome／Edge；依 06 §2 矩陣回報 | U | [x] 2026-10-18 Windows Chrome、iPhone Safari、iPhone 主畫面 App、iPhone LINE 皆完成（結果見 06） |
| P0-7 | 到 Cloud Console 觀察各 API 實際耗用配額單位（特別是 files.get?alt=media、files.create、changes.list） | U／C | [x] 延後（使用者 2026-10-18 決定）→ 併入 P1-18：試用期有真實用量時再比對 |
| P0-8 | 整理 PoC 結果寫入 06，並決定：MVP 的 iPhone 主畫面 App 策略、Token 服務是否提前（D-31） | C＋U | [x] 2026-10-18 結果寫入 06；新增決策 D-20～D-25（Token 服務不提前） |

**驗收**：06 §1 的 PoC 項目都有結果；01 新增依結果做出的決策。

---

## Phase 1：MVP（整章筆記＋同步）

| # | 任務 | 負責 | 完成 |
|---|---|---|---|
| P1-1 | plugin 骨架：package.json（多類別）、tsup、tsconfig、vitest；空元件可建置；quartz.config.yaml 加項目（先 `enabled: false` 驗證不影響網站）；deploy.yml 加複製步驟 | C | [x] 2026-10-18（多類別 emitter／pageType／component；deploy.yml 複製步驟；設定已啟用） |
| P1-2 | model：Record 型別與驗證、ULID、HLC、書卷代碼表（附錄 A）與章節頁 slug 解析；單元測試 | Cx（Luna） | [x] 2026-10-18（實作：Claude，D-28） |
| P1-3 | merge：純函式合併（03 §4.4–4.5）含衝突、墓碑、修剪、冪等／交換律測試；性質測試（隨機操作序列） | Cx（Sol）＋AG 審查 | [x] 2026-10-18（改用版本向量 D-26；Codex Sol 審查 7 項已處理；300 組隨機模擬） |
| P1-4 | store：IndexedDB（03 §6），帳號命名空間、匿名庫、outbox、meta；用 fake-indexeddb 測試 | Cx（Luna） | [x] 2026-10-18（含跨分頁條件式寫入） |
| P1-5 | adapter：SyncAdapter 介面＋GoogleDriveAppDataAdapter（list、generateIds、create、update、get、changes、delete、about）＋退避與限流；另做 InMemoryAdapter 供測試 | Cx（Luna）＋C 審查 | [x] 2026-10-18 |
| P1-6 | auth：GIS 延遲載入、token client、token 保存與到期、about.get、revoke、內建瀏覽器與 standalone 偵測 | C | [x] 2026-10-18 |
| P1-7 | sync 引擎：bootstrap、pull、push、outbox 去抖動、Web Locks 領導分頁、BroadcastChannel、雲端被清空偵測、schema 檢查、熔斷、遠端開關 config.json | C＋Cx（Sol） | [x] 2026-10-18（Codex Sol 審查中） |
| P1-8 | 「先同步再編輯」狀態機與 UI（03 §5）：同步中、需要重新連線、離線確認視窗（D-04 文案）、離線編輯提示、錯誤狀態 | C | [x] 2026-10-18（待實機確認） |
| P1-9 | 章節筆記面板（afterBody）：新增／編輯／刪除、手動節數、Markdown 預覽（DOMPurify）、衝突顯示與解決 | C／Cx（Luna） | [x] 2026-10-18（純文字顯示 D-27；待實機確認） |
| P1-10 | 工具列同步按鈕：登入、狀態、立即同步、登出（保留／清除本機）、中斷連線 | C | [x] 2026-10-18（MVP 併入章節面板狀態列與「我的筆記」頁，未另做工具列按鈕：一個 plugin 只能放一個版面位置） |
| P1-11 | 「我的筆記」虛擬頁：列表、依書卷篩選、標題與內文簡易搜尋、跳回章節、JSON 匯出、JSON 匯入、刪除全部雲端資料 | Cx（Luna）＋C | [x] 2026-10-18（待實機確認） |
| P1-12 | 首次登入併入匿名筆記的詢問流程（D-05） | C | [x] 2026-10-18 |
| P1-13 | sw.js 快取上限與 config.json 不快取；登入後 storage.persist() | C | [x] 2026-10-18（快取上限 400 筆） |
| P1-14 | 多裝置模擬整合測試（InMemoryAdapter，3 台裝置）：同時編輯、離線後合併、刪改衝突、時鐘偏差、重複上傳、上傳中斷、雲端清空、舊版 schema | Cx（Sol）＋AG 補案例 | [x] 2026-10-18（18 個引擎整合測試；共 52 個測試通過） |
| P1-15 | 文件：`content/教學/個人筆記使用說明.md`、隱私權政策頁；sync_content.ps1 首頁連結 | C＋AG 審文案 | [x] 2026-10-18（文案待 Antigravity 審閱） |
| P1-16 | `test_content` 建置通過；手動確認既有功能（wiki-tour、搜尋、SPA 換頁、PWA、深色模式、閱讀模式）未受影響 | C | [x] 2026-10-18（無頭 Chrome 自動檢查 15/15；部署後線上再檢查一次） |
| P1-17 | 移除 PoC 頁 | C | [x] 2026-10-18（合併到 main 時刪除，線上已 404） |
| P1-19 | SPA 換頁後面板停在「載入中」（Quartz 換頁沿用同一元素）：掛載時檢查容器與章節是否改變，必要時重新掛載；換頁時先存編輯中的文字 | C | [x] 2026-10-18（使用者實測發現；無頭 Chrome 驗證換頁後正常） |
| P1-20 | 未登入時不連到 Google（D-34）：按下「用 Google 同步」才載入 Google 元件；狀態列顯示目前帳號 | C | [x] 2026-10-18（使用者實測回饋；無頭 Chrome 驗證點擊前 0 筆 Google 請求） |
| P1-21 | 程式分層重構與架構規則測試（D-35、11）；session 流程測試 | C | [x] 2026-10-18（73 個測試通過） |
| P1-23 | 部署試用版到公開網站（使用者同意；push 前列出檔案經使用者確認） | C | [x] 2026-10-18（merge `e5f6bd9b`；線上回歸 15/15；未登入 0 筆 Google 請求） |
| P1-24 | 既有問題（非本功能造成）：網站 Service Worker 在線上從未註冊成功（sw.js 在 /static/，scope 為網站根目錄，GitHub Pages 無法送 Service-Worker-Allowed 標頭）→ 離線快取沒有作用。修法建議：把 sw.js 輸出到網站根目錄。**先問使用者是否要修** | C | [x] 2026-10-18（使用者選「修好並啟用」，D-36；子路徑模擬環境與線上皆驗證） |
| P1-27 | 網站既有問題：collapse-rules.json 路徑少了子路徑（12 B2）；首次造訪提示蓋住筆記按鈕（12 B3） | C | [x] 2026-10-18（已部署） |
| P1-25 | 三方檢查（Codex 畫面層 10 項、Antigravity 使用者體驗 18 項、Claude 黑箱測試線上網站）與修正；Codex 第二輪複審草稿機制 7 項 | C＋Cx＋AG | [x] 2026-10-18（93 個測試；本機修正檢查 11/11、回歸 15/15；待部署） |
| P1-26 | 教學整合：快速入門、熱鍵與功能速查、說明中心（延伸探索＋教學文章清單＋看我的筆記）、導覽完成畫面提到個人筆記 | C | [x] 2026-10-18 |
| P1-22 | Codex Sol 審查重構（前後對照）：9 項，修正 8 項並補回歸測試 | C＋Cx（Sol） | [x] 2026-10-18（80 個測試通過） |
| P1-18 | 🙋 （2026-10-18 開始，操作指南見 06 §2.1）使用者以 2–3 台裝置（iPhone／iPad＋Windows）在測試模式試用 2 週，回報問題；期間不可有任何筆記遺失；試用期間到 Cloud Console 比對實際配額單位（原 P0-7、V-05） | U | [ ] 2026-10-19 已改為正式版（D-44），這項改為「正式版的多裝置實際使用觀察」繼續進行（12 A1、A5） |

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
| P2-1 | 🙋 自訂網域決定（D-30）與設定 | U＋C | [x] 2026-10-19 使用者決定：先不買自訂網域，只用 GitHub Pages；Vercel 不再建置網站，只留語意搜尋 API（D-43） |
| P2-2 | Token 服務（Code model，無資料庫）＋前端改用：免點擊續期；iPhone 主畫面 App 改用 redirect 登入 | C＋Cx（Sol） | [ ] |
| P2-3 | 經節錨點（transformer 防禦式加 ID）＋點選經節建立筆記；**前提：章節格式已穩定，先問使用者** | C | [x] 2026-10-18 |
| P2-4 | 畫線與書籤（TextQuoteSelector＋textHash） | Cx | [x] 2026-10-18 |
| P2-5 | Markdown ZIP 匯出（Obsidian 相容） | Cx（Luna） | [x] 2026-10-18 |
| P2-6 | 全文搜尋與標籤（實作為多關鍵字＋#標籤篩選，未用搜尋函式庫；D-37） | Cx（Luna） | [x] 2026-10-18 |
| P2-7 | `[[` 自動完成（emitter 輸出精簡連結索引） | C | [x] 2026-10-18 |
| P2-8 | 裝置退役與分片收養 | Cx（Sol） | [x] 2026-10-18 |
| P2-9 | wiki-tour 新增筆記功能導覽 | C | [x] 2026-10-18 |
| P2-10 | 🙋 隱私權政策與首頁定稿、Search Console 網域驗證、品牌驗證、發佈為正式版（D-33） | U＋C | [x] 2026-10-19 使用者已發佈為正式版（D-44）；教學頁、隱私權政策已拿掉「試用」字樣（12 A4）。Search Console 網域驗證、品牌驗證沒有做：只用非敏感範圍，目前不需要；同意畫面若出現「尚未驗證」警告再處理（08） |
| P2-11 | 便條紙（12 N1） | C＋Cx | [x] 2026-10-19（D-41） |
| P2-12 | 知識庫條目加入書籤（12 N2） | C | [x] 2026-10-19 |
| P2-13 | 〈我的筆記〉頁為大量筆記重新整理 | C＋Cx（Luna） | [x] 2026-10-19（D-42） |

### 第三輪（12 F3～F7，規格見 13，決定 D-45～D-49）

負責欄的模型分級見 13 §8。

| # | 任務 | 負責 | 完成 |
|---|---|---|---|
| P2-14 | 準備：無頭 Chrome 檢查腳本搬進 `plugins/personal-notes/e2e/`（共用模組＋README＋`npm run e2e:*`）（13 §1） | Sub（Haiku） | [x] 2026-10-19（13 個腳本＋共用 lib＋README；回歸全部重跑通過） |
| P2-15 | 🙋 開工時請使用者在 Google Cloud 加 `drive.file` 範圍；08 補步驟（13 §2.3） | U＋C | [x] 2026-10-20 使用者回報已加（截圖：非機密範圍有 drive.file 與 drive.appdata） |
| P2-16 | F4a 經文清單規則抽成共用純函式；建置時檢查所有章節頁；CI 警告＋開／更新／關閉 Issue（13 §3.2） | Sub（Sonnet） | [x] 2026-10-19（`model/verseList.ts` 共用規則、emitter 檢查、CI 警告＋Issue；故意弄壞的章節被抓到、建置不失敗） |
| P2-17 | F4b 條目紀錄舊網址失效時用標題／別名／檔名找回並修正；找不到時標示（13 §3.3） | Cx（Luna low）＋C | [x] 2026-10-19（`model/nodeLocate.ts`、`repo/nodeHeal.ts`；entrycheck 4 項） |
| P2-18 | F5a 筆記可以掛在條目上：notes service、`update()` 保留錨點、草稿復原、〈我的筆記〉「知識庫條目」組、匯出（13 §4.3） | Sub（Sonnet）＋Cx（Sol 審查） | [x] 2026-10-19（`NotesPanel(target)`；Codex Sol＋Gemini 審查，4 點已修並補測試） |
| P2-19 | F5b 條目頁「我的筆記」面板與「我的相關筆記」兩組（13 §4.2） | Cx（Luna medium）＋C | [x] 2026-10-19（`related.ts`、`relatedList.ts`；entrycheck 15/15） |
| P2-20 | F6 引用到筆記：`features/quotes/`、事件擴充、插在游標位置（13 §5） | Cx（Luna medium）或 Sub（Sonnet） | [x] 2026-10-19（`features/quotes/`、`COMPOSE_QUOTE_EVENT`；quotecheck 11/11） |
| P2-21 | F3a 授權多權限、`adapter/http.ts` 共用、`adapter/driveFiles.ts`、session 備份編排、每週自動、保留 10 份、還原（13 §2.3） | Cx（Sol high）＋AG（Argon 審查） | [x] 2026-10-19（Codex Sol 實作、Gemini＋主導者審查，6 點修正；driveBackup 26 個測試） |
| P2-22 | F3b `features/backup/`：設定區塊（一行說明＋收合的「這是什麼？」）、〈我的筆記〉頂端提醒（含未登入） | Cx（Luna medium） | [x] 2026-10-19（`features/backup/`、`ui/backupFile.ts`；backupcheck 10/10；D-50 刪除時可勾選一起刪備份） |
| P2-23 | F7a 動畫筆記教學（8 段＋自己試沙盒）、外框 `addAction()`、`?tutorial=1`、網站導覽筆記站連結（13 §6） | Sub（Sonnet）＋C（美術） | [x] 2026-10-19（8 段動畫＋換你試試；tutorialcheck 10/10；網站導覽筆記站連過來） |
| P2-24 | F7b 章節筆記面板「?」文字版教學（最下面連到動畫教學） | Sub（Haiku）＋AG（flash 審文案） | [x] 2026-10-19（`helpGuide.ts`；helpcheck 8/8） |
| P2-25 | 教學頁（個人筆記使用說明、熱鍵速查）、隱私權政策（drive.file）、08 更新 | Sub（Haiku）＋AG（flash） | [x] 2026-10-19（使用說明、隱私權政策、速查；Gemini 審文案） |
| P2-26 | 🙋 部署（列檔案經使用者選「推送」）＋線上驗證；使用者實機確認一次存到 Drive 與還原 | C＋U | [ ] 2026-10-19 已部署（使用者選「推送」，`fdd94811..99787098`），線上檢查全部通過；**待使用者**加 drive.file 後實機試一次存到 Drive 與還原 |
| P2-27 | 第 3 級改動（F5a 條目筆記錨點、F3a 授權與 Drive 備份、D-50 刪除備份）補 Antigravity `gemini-4-argon-high` 交叉審查（13 §8 指定；2026-10-19 Argon 三個等級都 429，約 2026-10-24 重置，當時改用 gemini-3.8-flash-high 完成交叉審查） | AG（Argon）＋C | [x] 2026-10-19 使用者選「你也看一下」：由主導者（Claude，Anthropic 家族）做第三方審查代替 Argon，找到並修正 1 點（見 10） |

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
