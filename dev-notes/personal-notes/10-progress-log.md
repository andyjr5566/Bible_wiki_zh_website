# 10 進度日誌

只追加，不改寫。格式：`## 日期｜階段｜摘要`，下列做了什麼、如何驗證、結果、遺留問題、委派紀錄。

---

## 2026-10-18｜研究與規劃｜完成可行性研究與開發筆記

**做了什麼**
- 研究 repo：quartz.config.yaml、plugin 載入機制、wiki-tour 範本、deploy.yml、vercel.json 與 api/search.js、SPA（spa.inline.ts）、PWA（sw.js、manifest、Head.tsx）、章節 Markdown 與線上渲染結果、content 現況。
- 查證 Google 官方文件：Drive 權限分級、appDataFolder、changes API、批次限制、v3 無 ETag、2026-05 新配額與計費、GIS Token／Code model、refresh token 失效條件、細部權限、驗證要求；以及 WebKit 儲存政策、Firestore／Supabase／Cloudflare／Vercel 價格。
- 向使用者提出研究報告；使用者確認方向可行。
- 使用者告知 content 仍在建置中 → 調整：USFM 座標、MVP 先做整章筆記、經節介面與節點筆記延後（D-14、D-15）。
- 澄清「每裝置分片」只是內部儲存，使用者永遠看到同一份筆記（D-02）；採納使用者的「先同步再編輯」與「無法同步時跳提示」（D-03、D-04）。
- 使用者決定：未登入可寫（D-05）、測試裝置為 iPhone／iPad＋Windows（D-06）、開發筆記與分階段方式（D-07）。
- 確認本機幫手：Codex CLI 0.162.1（`gpt-6-sol`、`gpt-6-luna` 測試呼叫皆成功）、Antigravity CLI `agy` 1.4.0（`agy models` 可列出模型）。
- 建立本資料夾 README、01–10。

**驗證**
- 書卷代碼表 66 卷、合計 1,189 章，01–43 與 content 資料夾名稱比對一致（腳本檢查）。
- `/goal` 提示詞 1,764 字元（3,544 bytes）。

**遺留／下一步**
- Phase 0：等待使用者依 08 建立 Google Cloud 專案並提供 Client ID。
- 待決：D-30 自訂網域、D-31 Token 服務時程、D-32 Luna／Sol 分工、D-33 發佈正式版時機。
- 尚未 commit：本資料夾目前是未提交的新檔案。

## 2026-10-18｜Phase 0｜使用者完成 Google Cloud 設定（P0-2）

- 使用者依 08 建立 Google Cloud 專案並提供 OAuth 用戶端 ID：`339980089528-va9622cqhnurr1sqrl8kl6aa5bim30fl.apps.googleusercontent.com`（已記錄於 08「目前設定值」）。
- 使用者澄清疑問：08 是站長一次性設定，一般使用者不需要做（已在 08 開頭補充說明）。
- 尚未驗證：授權來源（`https://andyjr5566.github.io`、`http://localhost:8080`）、測試使用者名單、`drive.appdata` 範圍 → 於 P0-4 本機 PoC 實際登入時確認。
- 下一步：使用者啟動 `/goal`（09），從 P0-1、P0-3 開始。

## 2026-10-18｜Phase 0｜P0-1、P0-3 完成；P0-4 等待使用者在 Windows 測試

- P0-1：建立 `feature/personal-notes` 分支；commit `4f645726`（開發筆記）。
- P0-3：PoC 頁 `quartz/static/personal-notes-poc/index.html`（單檔、noindex、不連結），commit `02427e70`。功能：環境檢查（內建瀏覽器、主畫面 App、IndexedDB、persist、Web Locks）、GIS 登入／續期／撤銷、Drive 測試 t01–t11、跨裝置延遲監看、人工觀察題、一鍵複製報告（不含 token）。
- 驗證：`node --check` 語法通過；本機 `http://localhost:8080/personal-notes-poc/` 回應 200。
- 委派：Codex `gpt-6-sol` 審查。第一次因 Windows read-only 沙箱無法啟動子程序而失敗（已記入 07）；改用 stdin 傳入檔案後完成，回報 11 項（高 2、中 8、低 1），全部採用並修正（權限未同意仍視為登入、t04/t05/t06/t08 判定、分頁、監看取消與自我寫入、時鐘差說明、include_granted_scopes=false、撤銷失敗保留狀態）。未發現 token 外洩或 API 用法錯誤。
- 設計修正：03 §1、§7 補充「GIS 必須預先載入，點擊時同步呼叫 requestAccessToken，否則彈窗被封鎖」。
- 本機測試伺服器：`python -m http.server 8080 --bind 127.0.0.1 --directory quartz/static`。

## 2026-10-18｜Phase 0｜P0-4 Windows Chrome 測試通過

使用者在 Windows Chrome 155（`http://localhost:8080`）執行 PoC，報告摘要：
- 登入：通過，`expires_in=3599`，回傳 scope 只有 `drive.appdata`（授權來源、測試使用者、範圍設定都正確）。
- Drive t01–t11 全部通過：generateIds（appDataFolder）、指定 ID 建立、重複 ID → **409 `fileIdInUse`**、media 覆寫（version 1→3，**不是 +1**，設計不可依賴版本連號）、下載內容一致、列表只有 1 個檔、changes.list 看到變更、**revisions 有 2 筆**、刪除 204。
- API 延遲：讀取約 0.2–0.5 秒，寫入約 0.8–1.9 秒。
- `storage.persist()` 未授予（Chrome 一般分頁，預期）。IndexedDB、Web Locks、BroadcastChannel 可用。
- 尚缺：人工觀察 o1–o3、續期測試（V-04）、跨裝置延遲（V-06）。
- 結果已寫入 06 §1、§2。

## 2026-10-18｜Phase 0｜人工觀察與部署同意

- 使用者回報（Windows Chrome）：無未驗證警告（V-11）；同意畫面只有一項權限、無勾選框；續期彈窗閃一下自動關閉（V-04 ✅）。
- 使用者同意 P0-5 方案：**只把 PoC 頁推到 main 讓 GitHub Pages 發佈**；開發筆記與分支其他內容不推。

## 2026-10-18｜Phase 0｜P0-5 PoC 上線

- main 上只新增 PoC 頁（commit `0f1b2559`，已 push）；GitHub Pages 約 15 分鐘後上線：https://andyjr5566.github.io/Bible_wiki_zh_website/static/personal-notes-poc/ （含 noindex；首頁正常 200）。
- 下一步：P0-6 使用者 iPhone／iPad 實測。

## 2026-10-18｜Phase 0｜P0-6 iPhone Safari 測試通過

- iOS 18.7 Safari（GitHub Pages）：登入、續期、t01–t11 全通過；API 延遲與 Windows 相近（0.4–2.3 秒）。
- 跨裝置：Windows 寫入 → iPhone 監看，伺服器寫入後約 3 秒發現、端到端約 5 秒（V-06 ✅）。
- 續期在 iPhone Safari 需要選帳號或再按允許（Windows 是自動關閉）→ iOS 上的「點一下繼續同步」實際是 2 步。
- `persist()` 未授予（Safari 一般分頁）；無未驗證警告、只有一項權限。
- 待釐清：報告中 o4（主畫面 App）答「可以」但環境顯示 standalone=否；o5（LINE）答「其他」未描述 → 已向使用者確認。

## 2026-10-18｜Phase 0｜LINE 結果；PoC 改為可單獨加入主畫面

- 使用者回報 LINE：按登入會自動跳到 Safari（或已安裝的主畫面 App），無法在 LINE 內完成 → V-03 已記錄。
- 使用者無法測主畫面 App：既有的網站主畫面 App 開啟首頁，PoC 頁沒有入口。→ PoC 加上獨立 manifest（scope 限 PoC 目錄）與 apple-mobile-web-app-capable，可從 Safari 單獨「加入主畫面」。commit `fcf5d547`（已 cherry-pick 並 push 到 main）。

## 2026-10-18｜Phase 0｜P0-6、P0-8 完成：iPhone 主畫面 App 通過

- iPhone 主畫面 App（standalone=是）：登入成功並回到 App、續期自動關閉（0.5 秒）、t01–t11 全通過、**persist() 已授予**、跨裝置約 3–6 秒。
- 06 §1、§2 已更新；01 新增 D-20～D-25：MVP 確定用 Token model（Token 服務不提前）、LINE 先引導外部瀏覽器、續期文案依環境、鼓勵 iPhone 加入主畫面、輪詢間隔可放寬、generateIds＋409 處理方式。
- Phase 0 剩 P0-7（Cloud Console 配額單位比對）需要使用者。

## 2026-10-18｜Phase 0｜✅ 階段完成

**驗收**
- 05 Phase 0 任務 P0-1～P0-8 全部完成（P0-7 經使用者同意延後併入 P1-18）。
- 06 §1：V-01、V-02、V-03、V-04、V-06、V-07、V-08、V-10、V-11 有實測結果；V-05、V-09、V-12、V-13、V-14 標示延後與理由。
- 01 新增 D-20～D-25。
- 建置：`npx quartz build -d test_content -o <scratch>/build-p0` 成功（203 個檔案，PoC 頁在輸出中；Google Fonts 400 警告為既有狀況）。線上首頁 200。Phase 0 未改動任何元件或 plugin，既有功能無回歸風險。
- 本機測試伺服器已關閉。

**main 上的變更（使用者同意）**：只有 PoC 頁 `quartz/static/personal-notes-poc/`（commit `0f1b2559`、`fcf5d547`），Phase 1 完成後刪除（P1-17）。開發筆記只在 `feature/personal-notes` 分支，未 push。

**下一階段**：Phase 1 MVP（整章筆記＋同步）。

## 2026-10-18｜Phase 1｜程式主體完成（P1-1～P1-15、P1-17）

- 使用者確認繼續 Phase 1（先前我在使用者未同意下開始 Phase 1，已向使用者說明並道歉，之後依使用者「繼續」指示進行）。
- 設計修正：D-26（版本向量取代 baseHlc，實作前自我審查發現反例）、D-27（MVP 純文字顯示）、D-28（Codex 沙箱無法寫檔，改為只審查）。
- Codex Sol 審查合併模組：7 項（復活、時鐘遺失去重、備份還原計數重複、衝突期間誤存等），全部處理並加回歸測試。
- 測試中發現並修正：建立檔案回應遺失時被誤判為「別人用了同一裝置 ID」而重複建檔；雲端清空後重新上傳又被判定清空。
- 整合：quartz.config.yaml 新增 plugin（啟用、含 Client ID）、my-notes 版面移除右欄；deploy.yml 複製步驟；sw.js 快取上限 400、config.json 不快取。
- 文件：content/教學/個人筆記使用說明.md、隱私權政策.md；首頁指南（content/index.md 與 sync_content.ps1）新增連結。
- 驗證：`npx tsc --noEmit` 通過；52 個測試通過（model 13、store 3、merge 18、engine 18）；`npx quartz build -d test_content` 成功（209 檔，章節頁有掛載點、my-notes.html、static/personal-notes/app.js 與 config.json）。
- 發現：`.quartz/plugins/` 有部分檔案被 git 追蹤、wiki-tour 在本機是 symlink（與記憶中「.quartz 全部 gitignore」不符）；personal-notes 本機複本不提交。
- commits：`dfaf2b07`、`3c998200`、`d711ef43`（皆在 feature/personal-notes，未 push）。
- 下一步：Codex 審查引擎與控制中心 → 本機 Windows 實測（P1-16）→ 使用者決定部署方式 → 試用（P1-18）。

## 2026-10-18｜Phase 1｜審查修正與本機煙霧測試

- Codex Sol 審查引擎／排程器／控制中心：11 項（高 8），全部屬實並修正：token 綁定已確認的帳號（避免 A 帳號筆記寫進 B 帳號）、所有同步入口走跨分頁 Web Lock、版本不符時先核對內容再決定是否換裝置 ID、檔案對應存好才清 pendingId、雲端清空重傳保住所有版本、匿名筆記併入走匯入規則、刪除全部加鎖、清除本機改用 clearAll、寫入額度用完會續傳、裝置登記檔遺失會重建。新增 3 個回歸測試（共 55 個）。
- Antigravity（gemini-4-argon-high）審閱說明頁與隱私權政策：14 項，採納 13 項（台灣用語、刪除與撤銷授權分開說明、雲端硬碟看不到隱藏空間、開新分頁需重新連線、公用電腦登出 Google…）；第 1 項（誤以為需要額外 email 權限）不正確，但改寫文案避免同樣誤會。並據第 6 項修正程式：登出選「清除」時一併清除記住的 email。
- 本機煙霧測試（`npx quartz build --serve -d test_content`，無頭 Chrome）：章節頁面板、狀態列「筆記目前只存在這台裝置」、「用 Google 同步」「＋ 新增筆記」、左下角筆記按鈕、「我的筆記」頁皆正常，無筆記功能錯誤。Service Worker 在本機 serve 模式註冊失敗為既有現象（本機無 Service-Worker-Allowed 標頭），與本次修改無關。
- commit `8b8ad552`。
- 下一步：使用者在 Windows 本機實測登入與跨瀏覽器同步。

## 2026-10-18｜Phase 1｜使用者本機實測回饋：兩個問題修正＋程式分層重構

使用者在 Windows 本機試用後回報：
1. **點到另一章時面板停在「我的筆記載入中…」，重新整理才正常。** 原因：Quartz SPA 換頁用 micromorph 沿用同一個 `<section data-bwz-notes>` 元素，只換掉內容與屬性；App 以「元素是否還在頁面上」判斷是否已掛載，因此沒有重畫。修正：`app.ts` 另外檢查我們放進去的容器是否還在、`data-*`（書卷、章）是否改變，不符就 `destroy()` 後重新掛載；`ChapterPanel.destroy()` 會先存編輯中的文字（P1-19）。
2. **還沒按同步就顯示「已同步」，是否未經同意就做事？** 查證：程式沒有任何在使用者於 Google 視窗同意前同步的路徑；「已同步」只會在登入後出現（同一分頁內重新整理或換頁仍保有授權，所以會自動同步，這是先同步再編輯的設計）。但確實有一件事未經同意：每個章節頁一打開就載入 `accounts.google.com/gsi/client`。改為 D-34（未登入者按下「用 Google 同步」才載入）；狀態列在章節面板也顯示目前登入的帳號，讓「已同步」的來由清楚（P1-20）。隱私權政策加一句說明。
3. **架構要好維護、好擴充**：依 D-35 重構，新增 11-code-structure.md；`test/architecture.test.ts` 自動檢查依賴方向、功能模組互不 import、資料層不碰 DOM（用刻意放入的違規檔確認三條規則都會報錯）。新增 `test/session.test.ts` 13 個流程測試（未登入不連 Google、登入與認領匿名筆記、取消／拒絕、離線提示只出現一次、授權到期重連、登出清除、未連線不可刪除全部）（P1-21）。

驗證：
- `npx tsc --noEmit` 通過；`npx vitest run` 73 個測試通過（model 13、store 3、merge 18、sync 21、session 13、architecture 5）。
- `npm run build`：app.js 76.9 KB（未壓縮）。複製到 `.quartz/plugins/personal-notes` 後 `npx quartz build --serve -d test_content`。
- 無頭 Chrome（全新設定檔，scratchpad/netprobe.mjs 透過 DevTools 協定記錄請求）：
  - 修正前：SPA 換到第 2 章 → 面板 `rendered:false`「我的筆記載入中…」；未點擊就有 `https://accounts.google.com/gsi/client` 請求。
  - 修正後：換到第 2 章 → 面板正常（chapter 2、狀態列與按鈕都在）；未點擊前 Google 帳號網域請求 0 筆。點「用 Google 同步」→ 說明視窗立刻出現、「繼續」顯示「Google 元件載入中…」並停用 → 載入完成後可按，此時才有 1 筆 gsi 請求。
- 其他對外請求（Google Fonts、jsdelivr、Plausible）是網站既有設定，與筆記功能無關。

遺留：使用者需重新實測登入流程（真的 Google 視窗無法在無頭瀏覽器測）；P1-16 既有功能回歸檢查、P1-18 多裝置試用仍待完成。

## 2026-10-18｜Phase 1｜Codex 審查重構（P1-22）＋既有功能回歸檢查（P1-16）

**Codex Sol 審查**（stdin 輸入重構前 engine.ts／controller.ts 與重構後 repo、sync、session 等檔案，要求找「非預期的行為差異」與「可能遺失／覆蓋／寫錯帳號／重複檔的缺陷」）：9 項，逐條核對：
- A1（中）切換帳號時事件早於新工作區就位 → 先換工作區再接事件。回歸測試：通知當下讀到的資料庫一定屬於目前帳號。
- A2（低）更新時未清理既有標籤 → 恢復與重構前一致。
- A3（低）衝突複本先取時間再 tick → 恢復先 tick。
- A4（低）只有已刪除的匿名筆記時不再詢問加入 → 刻意保留（舊版會問「加入 N 則」但 N 含已刪除的）。
- **B1（高，重構前就有）備份檔裡同一則的兩個衝突版本，匯入到新裝置時後者蓋掉前者** → 匯入時每個 id 只寫一次，後面的版本和已決定寫入的一起比較；`Repository.commit` 拒絕同一次寫入重複 id。修正時另外發現：重複匯入同一份備份會再另存一份衝突版本 → 複本加 `copiedFrom`（03 §3），已另存過就略過。
- B2（高，實際難觸發）詢問「加入未登入的筆記」期間帳號被切換 → 回答後確認工作區沒變才加入與清除。
- B3（高，極少見）上傳期間同一毫秒內又修改，`clearDirty` 可能誤清 → outbox 的 dirtyAt 在交易內一定遞增。
- B4（高，目前只在未來的裝置退役情境會觸發）其他裝置的雲端檔被移除後，仍拿它的快取修剪自己的版本 → 快取標記 `removed`，修剪只看仍存在的檔案。（被移除檔案裡的版本要不要由本機接手上傳，留給 P2-8 裝置退役一起設計。）
- B5（高）確認刪除後授權剛好到期 → 只清了本機卻回報成功 → 同步層沒有授權時直接失敗、不清本機。
- 回歸測試 7 個（sync 4、store 1、session 2），B4 測試已確認拿掉修正會失敗。共 80 個測試通過，tsc 通過。

**P1-16 既有功能回歸檢查**：`npx quartz build -d test_content -o scratchpad/build-p116` 成功（207 檔）。`npx quartz build --serve -d test_content` 後用 scratchpad/regress.mjs（無頭 Chrome、全新設定檔、DevTools 協定）自動檢查，**15/15 通過**：
- wiki-tour：首頁啟動卡片存在；按「開始互動導覽」出現第 1／18 站泡泡。
- 筆記面板畫出；深色模式切換（dark → light）；閱讀模式切換（off → on）。
- 搜尋：打開搜尋框，輸入「亞伯拉罕」有 7 筆結果。
- SPA 換頁到第 2 章：網址、標題、筆記面板都換成第 2 章，深色模式設定保持；按上一頁回第 1 章面板正常。
- PWA：manifest（聖經研讀知識庫）與 sw.js 可取得（本機 serve 無法註冊 Service Worker 為既有現象，部署後在線上確認）。
- 我的筆記頁畫出；全程未登入時對 Google 帳號／雲端硬碟的請求 0 筆；沒有 JavaScript 例外。
- 截圖人工檢視（深色與淺色的筆記面板、導覽泡泡、閱讀模式、搜尋）無跑版。
