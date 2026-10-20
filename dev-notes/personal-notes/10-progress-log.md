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

## 2026-10-18｜Phase 1｜部署試用版到公開網站（P1-23）

- 使用者同意部署並確認推送清單（71 檔：plugin、教學頁、隱私權政策、quartz.config.yaml、deploy.yml、sw.js、首頁指南一行、dev-notes；刪除 PoC 頁）。推送前檢查：無密鑰（只有研究筆記裡一個網址含 client_secret 字樣）、無 email；Client ID 為公開資訊。
- `main`：本機 `git merge --no-ff feature/personal-notes`，PoC 頁在 feature 分支是「先加後刪」，合併時另外 `git rm` 才真的移除 → merge commit `e5f6bd9b`，push `fcf5d547..e5f6bd9b`。
- GitHub Actions「Deploy Quartz to GitHub Pages」成功（約 18 分鐘；「Setup local plugins」「Install Quartz plugins」步驟正常）。
- 線上檢查：config.json、app.js（md5 與本機 dist 相同）、章節頁（掛載點 GEN／1）、my-notes、兩個教學頁皆 200；PoC 頁 404。
- 線上無頭 Chrome 回歸（regress.mjs）15/15 通過（wiki-tour、搜尋 503 筆、深色、閱讀模式、SPA 換頁與上一頁、PWA 檔案、我的筆記頁、無例外、未登入 0 筆 Google 帳號／雲端硬碟請求）。netprobe：點「用 Google 同步」前 gsi 請求 0 筆、點後 1 筆，說明視窗「繼續」在載入完成後才可按。
- 發現既有問題（P1-24，非本功能造成）：線上 Service Worker 註冊失敗（SecurityError：scope 不在 /static/ 底下）。Head.tsx 本分支未改動；網站離線快取一直沒有生效。筆記功能不依賴 Service Worker。待使用者決定是否修。
- 06 §2.1 新增試用操作指南（Windows、iPhone／iPad、8 個情境、回報方式、筆記不見時怎麼辦、配額檢查、緊急開關、通過條件）。
- 下一步：使用者開始 P1-18 兩週試用（需先把試用者 Gmail 加入 Google Cloud 測試使用者）。

## 2026-10-18｜Phase 1｜三方檢查與修正（P1-25）、教學整合（P1-26）

使用者要求「再檢查、請其他人一起驗證」，並把筆記功能寫進教學、整理未完成事項。

**檢查方式**（平行進行）：
- Codex Sol：畫面層與帳號流程程式碼（ui-review-input，12 個檔）→ 10 項。
- Antigravity（gemini-4-argon-high，plan 模式）：實際抓線上頁面＋程式碼，以台灣教會長輩為對象 → 18 項（高 5、中 10、低 3）。
- Claude 子代理：對線上網站做黑箱測試（無頭 Chrome，未登入）→ 10 組測試，找到 4 個錯誤與數個體驗問題。
- 修正後 Codex Sol 第二輪複審本輪 diff → 7 項（都在新加的草稿機制），已重新設計並修正。

**最重要的發現與修正**
- **匯出備份在線上壞了**（黑箱測試）：按下去分頁跳到 blob 網址顯示 JSON，不下載。原因：Quartz SPA 把同源的 blob 下載連結當成站內換頁攔截。修正：連結加 `data-router-ignore`；沒有筆記時不下載空檔。
- **輸入可能遺失的情況**（Codex 畫面 #1–#5、黑箱測試、Antigravity M-05）：儲存失敗按「完成」照樣關閉、衝突時丟掉草稿、切換帳號時寫錯資料庫、重新整理前 0.6 秒的字遺失、等待存檔時又打字被漏掉。修正：flush 迴圈存到沒有新輸入、失敗保留編輯器；衝突時鎖住輸入框、把最新內容另存成新筆記；`session.onBeforeSwitch` 先存再切換，存不進去又無法備份就不切換；visibilitychange／pagehide 立刻存；新增 `features/notes/drafts.ts` 每個編輯框一份 localStorage 草稿，記下 baseHlc，補存時筆記已被改過就另存不覆蓋，確定寫入才刪草稿（第二輪 #1–#7）。
- **「兩個都保留」在一刪一改時會把筆記刪掉**（Antigravity M-04）：改以有內容的版本為主；只有兩邊都有內容才顯示這個按鈕；版本卡片加節數、標籤、「這台裝置／其他裝置」。
- **選「先不要」或登出後筆記從畫面消失、沒有說明**（Antigravity H-01、H-02）：改寫對話框；「我的筆記」頁新增「這台裝置還有 N 則未登入時寫的筆記 → 加入這個帳號」。
- **試用期間未登記帳號按登入會看到英文錯誤**（H-04）：`access_denied` 改中文說明（提到「不在試用名單」）。`notice` 可顯示在登入說明視窗與我的筆記頁；原本設了試用公告，**使用者決定不顯示**（push 前確認時），維持空白。
- 其他：中斷連線在沒有有效授權時說明無法撤銷（H-03）；刪除全部先檢查連線再確認（M-03）；登出一律忘記帳號提示以便換帳號（M-09）；LINE 以外的內建瀏覽器改教「⋯ → 用瀏覽器開啟」（M-07）；提示文字拿掉 `[[人物]]`（H-05）；節數填反自動對調；刪除確認框焦點預設在「取消」；換頁時對話框自動關閉、Tab 焦點留在框內；手機觸控目標 44px、iPhone 輸入框 16px 防放大；狀態列「尚未連線」改成「筆記已存在這台裝置，點「繼續同步」連上雲端」；我的筆記頁可搜書卷章節與 #標籤、卡片加「前往該章編輯 →」並捲到面板、加使用說明與隱私權政策連結、未登入可一次清除本機筆記、iOS 加入主畫面提示未登入也顯示；提示訊息至少停留 5 秒；換到沒有筆記的頁面會清掉舊畫面。
- 沒有採用：Antigravity 建議 explainSignIn 在試用期寫死「試用」字樣 → 改用設定檔 `notice`，正式版時清空即可。

**教學整合（P1-26）**：快速入門（深入研讀＋下一步）、熱鍵與功能速查（畫面元件表加「我的筆記」）、說明中心（延伸探索加「我的筆記」：看我的筆記／怎麼用，教學文章清單加個人筆記使用說明）、導覽完成畫面一句話；個人筆記使用說明配合新文案。

**驗證**：tsc 通過；93 個測試通過（新增 drafts 6、session 8、sync 2）。本機 `quartz build --serve -d test_content`＋無頭 Chrome：fixcheck.mjs 11/11（重新整理前 150ms 打的字保留、節數對調、焦點、空白筆記、試用公告、說明中心連結、匯出真的下載且頁面不跳走、前往該章會捲到面板、搜尋書卷章節、無例外），regress.mjs 15/15。

**新發現的既有問題**（記在 12 的 B 組）：`/static/collapse-rules.json` 路徑少了 repo 名稱 → 404；首次造訪導覽卡與手機加入主畫面面板會蓋住筆記按鈕。

**待辦**：使用者確認後部署，部署後對線上重跑 fixcheck／regress，並請黑箱測試代理複測。新增 12-backlog.md（未完成事項總表與下一步提示詞）。

## 2026-10-18｜Phase 1｜部署後線上複測與手機版面修正

- 部署 `ca497cf4`（使用者確認推送，選擇不顯示試用公告：`notice` 清空、教學頁拿掉試用那一句）。線上 app.js 與本機相同後：fixcheck 11/11、regress 15/15。
- Claude 黑箱測試代理線上複測（新的瀏覽器設定檔）：匯出下載、重新整理／整頁跳轉後補存（新舊筆記 × 3 種延遲 × 2 種離開方式共 12 種，各剛好 1 份、無重複、無殘留草稿）、前往該章捲到面板、節數對調、刪除焦點、SPA 換到無筆記頁面無殘留按鈕，全部通過。
- 剩下手機版面：標題、標籤框沒有框線且只有 28px；起迄 36px；我的筆記搜尋框太窄。原因（cssprobe.mjs 以 DevTools CSS.getMatchedStylesForNode 查證）：網站主題的樣式在 `obsidian-theme` CSS layer，排在本外掛所在的 `quartz-base` 之後，會清掉 `input[type=text]` 的框線、背景、內距，與選擇器權重無關。修正：筆記輸入框這幾個屬性加 `!important`；觸控裝置輸入框與連結至少 44px；手機版搜尋框與書卷選單各佔一行。本機 mobilecheck.mjs 6/6（所有輸入框 44px、有框線、16px；搜尋框 342px）；93 個測試、regress 15/15。
- 待部署（需使用者確認）。新的低優先建議：「前往該章編輯 →」只捲到面板，未定位到那一則或直接開啟編輯器（記入 12 C10）。

## 2026-10-18｜網站既有問題 B1–B3（/goal：12 的 B 組）

- **子路徑測試環境**：線上網站在 `/Bible_wiki_zh_website/` 底下，本機 serve 的基底路徑是空的，重現不了路徑類問題。做法：暫時把 quartz.config.yaml 的 baseUrl 改成 `localhost:8090/Bible_wiki_zh_website` 建置到 scratchpad/build-sub（建完立刻 `git checkout` 還原），用 scratchpad/subpath-server.mjs 模擬 GitHub Pages（`/foo`→foo.html、不送 Service-Worker-Allowed）。
- **B2 collapse-rules.json**：`collapsible.inline.ts` 用絕對路徑 `/static/...` → 線上 404（b2check.mjs：線上 2 次 404）。改用 `document.body.dataset.basepath`。子路徑環境：200、收合區塊正常。（目前內建規則與檔案相同，所以使用者看不出差別；修正後改 config/collapse-rules.txt 才會生效。）
- **B3 首次造訪提示**：b3check.mjs 用 elementFromPoint 檢查每個筆記按鈕是否被蓋住。電腦 1280×900：「第一次來嗎？」卡片蓋住「刪除」→ 修正後全部可點；卡片在頁面上方仍照常出現、捲到底收起（b3extra.mjs）。手機：「加入主畫面」說明是一次性、按「知道了」就不再出現的提示，蓋住下方屬設計；修正為使用者正在輸入時延後跳出（b3extra.mjs：打字中不跳、停止後才出現）。
- **B1 Service Worker（使用者選「修好並啟用」，D-36）**：
  - 調查：sw.js 在 /static/，scope 要整個網站 → 瀏覽器拒絕（線上主控台 SecurityError）。策略本來就是先網路後快取、只處理本站網址、config.json 不快取。
  - 修改：`quartz/plugins/emitters/static.ts` 另外輸出 sw.js 到網站根目錄；Head.tsx 改註冊根目錄的 sw.js；sw.js 路徑以根目錄為準、只快取成功回應、超過 3 MB／3D 模型／影片不快取（沒有 Content-Length 時讀實際大小）、CACHE_NAME 改 v3、開頭註解寫緊急撤回版本。
  - 測試環境發現：這台電腦的無頭 Chrome 用磁碟設定檔時 Cache API 會出「Unexpected internal error」（連線上網站也一樣），加 `--incognito` 才正常 → 與網站無關，Service Worker 相關檢查都用無痕模式跑。
  - 驗證（子路徑環境、無痕無頭 Chrome）：swcheck.mjs 11/11（註冊成功且 scope 為網站根目錄、接管頁面、快取有看過的頁面與筆記 App、羊皮紙背景不進快取、其他網域不進快取、config.json 不進快取、離線可開看過的頁面、離線筆記面板與筆記都在、離線開沒看過的頁面顯示首頁、恢復連線正常、無錯誤）；killcheck.mjs 2/2（部署撤回版後 Service Worker 與快取都被移除）；regress.mjs 15/15、fixcheck.mjs 11/11（匯出在無痕模式改驗下載連結與內容，因無頭無痕不允許下載；對照組：沒有 Service Worker 的線上網站在無痕下也一樣無法下載）。
- 單元測試 93 個全過。commits：`c1b2bf98`（B2）、`8bda3e02`（B3）、`23e1d4bf`（B1），皆在本機 main，未 push。
- A4 未做：使用者回覆尚未把 Google 應用程式改為正式版。
- **部署**（使用者確認推送清單 13 檔）：`ecd9daaa..b73d3147`。線上 /sw.js 200 後檢查：swcheck 11/11（scope 為 https://andyjr5566.github.io/Bible_wiki_zh_website/，離線可開看過的頁面、筆記面板與筆記都在、大檔與其他網域不快取）、b2check 規則檔 200、regress 15/15（有 Service Worker）、fixcheck 11/11、b3check「刪除」可點、b3extra 4/4。

## 2026-10-18｜Phase 2（/goal：12-backlog 除了 C1 以外都做）

依 12 的建議順序 2–8 完成 C2–C10（C1 Token 服務需要伺服器端，依使用者指示不做）。每項本機 commit，未 push。

| 項目 | commit | 內容 |
|---|---|---|
| C9、C10 | `345b34a3` | 編輯器「已儲存」文字跟著同步狀態即時更新（「已儲存在這台裝置」→「已儲存並同步到雲端 ✓」）；我的筆記頁「前往該章編輯」連到 `#bwz-note-<id>`，章節頁捲到那一則並閃爍標示 |
| C5、C6 | `cf74345e` | D-37：自寫安全 Markdown 渲染（`ui/markdown.ts`）、建置時輸出 `links.json`、`[[條目]]` 可點＋找不到的灰色提示、輸入 `[[` 自動完成、我的筆記頁多關鍵字 AND 搜尋、`#標籤` 與標籤一覽 |
| C4 | `55b4d54b` | 匯出 Obsidian 相容 Markdown ZIP（`model/zip.ts` 自寫 ZIP、YAML 前言、`聖經筆記/01 創世記/第1章/…md`）；PowerShell Expand-Archive 解開驗證中文檔名與內容 |
| C2、C3 | `bc35ce01` | D-38：經節定位（`ui/verses.ts`）、經節 📝 標記、選取經文浮出工具列（畫重點／書籤／寫筆記）、新功能模組 `features/highlights/`、我的筆記頁列出書籤與重點 |
| C8 | `c631d4cc` | 互動導覽新增「個人筆記」一站（第 12 章，排在地圖之前，共 19 站） |
| C7 | 本次 | D-39：兩階段裝置整理、雲端清空三選一詢問 |

**C7 裝置整理的審查過程**：Codex Sol（stdin）四輪。第一輪 9 項 → 改為「接手→上傳→標記→等 14 天→刪除」兩階段、閒置時間改用雲端伺服器時間、讀不到分片不整理。第二輪 → 整理時只信任本機保存的版本、有並行版本就不整理（不自動另存）、只對有退役標記的裝置接手快取、雲端清空改為詢問使用者（新增「清除這台裝置上的筆記」）。第三輪 7 項 → 判定清空後立刻停止同步、重新上傳後清掉快取避免一直詢問、標記後又有寫入時重新標記（不會永遠卡住）、只剩已刪除紀錄時保留快取、自己的檔案被刪時補查標記。第四輪 → 上述都判定已解決或可接受；再修「雲端沒有任何筆記分片（只剩登記檔）也算清空」。
- 殘餘風險（寫入 D-39）：Drive 沒有條件式刪除，第二階段重新列檔與刪除之間的幾秒內若舊裝置剛好寫入，該雲端檔案會被刪，但資料仍在舊裝置本機、下次同步換新 ID 重傳。另：從已移除快取接手的墓碑若超過一年保存期限且雲端已無同 ID 版本，會依原本的墓碑修剪規則（03 §4.5）被修剪，與一般墓碑相同。
- Antigravity 額度用完（429，約 146 小時後恢復），本輪無法請它驗證。

**驗證**
- 單元測試 138 個全過、tsc 通過。新增：markdown 8、export 5、verses 4、highlights 4、retire 24（兩階段、等待期內不刪、每天同步的裝置不整理、衝突先不整理、兩階段之間回來、刪除後才回來、只上傳新章節先換 ID、標記後寫入→重新標記→最後整理、標記與刪除分批、時鐘快半年、分片壞掉、兩台同時整理、第二階段由別台執行、刪除全部→詢問→清除、清空時不上傳離線新筆記、只有快取的裝置選重新上傳後不再詢問、只剩墓碑不詢問、雲端只剩登記檔仍詢問、原因不明刪除不傳回、超過一年的墓碑、接手規則 4 個）。C7 每個修正都做了反向檢查：把修正拿掉，對應測試會失敗（mut7.py，6/6）。
- 無頭 Chrome（本機 `quartz build --serve`，test_content＋出埃及記第 12 章）：p2check.mjs 34/34（links.json、C9 已儲存文字、C5 Markdown 與 XSS、C6 連結／缺條目／自動完成、標籤與 AND 搜尋、C10 定位並標示、C2 節數／📝 標記／點標記跳筆記／工具列／寫筆記帶入節數與引文／#v12、C3 只標選取的字／跨三節／本章重點列表／章節書籤／移除重點／重新整理後還在／換頁不殘留／回來不重複／我的筆記頁書籤與重點、C4 ZIP 結構且頁面不跳走、無例外）；regress.mjs 15/15；fixcheck.mjs 11/11；mobilecheck.mjs 6/6；tourcheck.mjs 2/2（停在「個人筆記」站且框住筆記面板）。
- 教學：`content/教學/個人筆記使用說明.md` 加上點經文寫筆記、畫重點與書籤、格式與 [[連結]]、搜尋、匯出 Markdown、雲端被清空時的詢問、裝置自動整理。
- 使用者新想法「便條紙」記入 12 的 N1（建議貼在經節上而非螢幕位置），未排程。

**部署（使用者確認推送）**：`b73d3147..bf90e790`。線上 app.js 與本機相同、links.json 200 後：p2check 34/34、regress 15/15、fixcheck 11/11、mobilecheck 6/6、swcheck 11/11（第一次跑 10/11，重跑 11/11，屬首次快取時序）。**tourcheck 1/2**：「個人筆記」一站的框沒有框住面板（框高度 0、畫面沒捲過去）。原因：那一站只在出現時捲動一次，線上的筆記 App 晚一點才載入，當下找不到目標，之後也不會補捲。本機用 tourcheck.mjs 加 `DELAY_APP=3000`（攔截 app.js 延遲 3 秒）重現。修正：`tour.inline.ts` 記錄這一站是否已捲動，目標晚出現時在定期對位時補捲一次（所有站適用）。修正後本機延遲版 2/2、一般版 2/2、p2check 34/34、regress 15/15。

## 2026-10-18｜使用者回饋：選取工具列、取消鍵、左上角入口

使用者回饋三點＋一個追加：(1) 選取經文後的工具列點別處不會消失；(2)「移除這個重點」旁的「取消」按了沒反應；(3) 左上角書本圖示（閱讀模式）沒有實質效果，想換成〈我的筆記〉入口；(4) 圖示列下方再加一個文字的「我的筆記」按鈕（AskUserQuestion 確認位置：左側圖示列下面）。

- **(1)(2) 同一個原因**：`.bwz-h-toolbar` 的 CSS 設了 `display: flex`，蓋掉瀏覽器預設的 `[hidden] { display: none }`，程式設了 hidden 但畫面上仍顯示。p2check 只檢查 hidden 屬性所以沒抓到。修正：notes.scss 加通用規則 `[class*="bwz-"][hidden] { display: none !important }`；拿掉多餘的「取消」（點別處或按 Esc 就收起）；新增 Esc 收起。
- **(3)(4)**：D-40。
- **導覽「個人筆記」一站在線上偶爾沒框到面板**（上一筆修正後線上 tourcheck 仍約一半失敗）：tourprobe.mjs 記錄捲動位置，看到 3 秒時已捲到面板、6 秒又回到頂端；原因是測試用「重新整理」進入，線上頁面載入完成較晚，瀏覽器在載入完成時把捲動位置還原到重新整理前（頂端）。用一般換頁進入（tournav.mjs）5/5 通過。仍加上：導覽進行中 `history.scrollRestoration = "manual"`，結束時改回 auto，讓使用者在導覽中重新整理也不會被拉回頂端。
- **驗證**：138 個單元測試、tsc 通過。新增 uicheck.mjs（無頭 Chrome）：舊版 4/13（重現「點別處不消失」），新版 16/16（閱讀模式已移除、圖示在明暗模式後、文字按鈕在圖示列下方與探索上方、選取後點別處與 Esc 真的消失、點重點只有「移除這個重點」且點別處消失、點圖示與文字按鈕都打開我的筆記且標示目前頁、換頁回來不重複、教學頁與資料夾頁也有、手機版圖示看得到且不顯示文字按鈕、無例外）。regress.mjs 的閱讀模式檢查改為檢查入口，15/15；p2check 34/34、fixcheck 11/11、mobilecheck 6/6、tourcheck 2/2（含 DELAY_APP=3000）。
- 教學：快速入門、熱鍵與功能速查、個人筆記使用說明改寫工具列說明。
- **部署**（使用者確認推送）：`735a3c9f..d0d5c3bb`。線上 uicheck 16/16、p2check 34/34、regress 15/15、fixcheck 11/11、mobilecheck 6/6、swcheck 11/11、tourcheck 連跑 3 次皆 2/2（重新整理進入也通過）。

## 2026-10-18｜網站：探索目錄收起時標題被切、新增「全部收合」

使用者回饋：左側「探索」收起時字只顯示一半；希望有按鈕把展開的資料夾一次收起來。（不是筆記功能，但記在這裡方便追蹤。）

- **原因**（expmeasure.mjs 線上量測）：explorer 外掛收起時把高度固定為 1.2rem（19px），本站的「探索」標題約 25px，`overflow: hidden` 把下半部切掉。修正（custom.scss，電腦版）：收起時改為標題本身的高度、目錄內容 `display: none`。explorer 外掛在 `.quartz/`（CI 會重新下載），所以修正放在 repo 自己的 custom.scss。
- **全部收合**：新增 `quartz/components/scripts/explorerTools.inline.ts`（在 componentResources.ts 註冊，做法同「素／紙」按鈕）。有資料夾展開時，目錄最上方右側出現「全部收合」；按下後全部收起，並照 explorer 外掛的格式寫回 `localStorage.fileTree`，換頁、重新整理後仍收著（目前章節所在的資料夾照外掛原本設計會自動打開）。資料夾清單是外掛非同步畫出的，用 MutationObserver 監看變化決定按鈕顯示與否。手機版在抽屜裡同樣可用。
- **驗證**：expcheck.mjs（無頭 Chrome）線上舊版 2/9（重現標題被切 19px < 25px、沒有按鈕），本機新版 9/9；uicheck 16/16、p2check 34/34、regress 15/15、fixcheck 11/11、mobilecheck 6/6、tourcheck 2/2。tsc 沒有新增錯誤（既有錯誤只在 quartz/static/website 的互動網站原始碼）。
- **部署**（使用者確認推送）：`d0d5c3bb..a045fd3b`。線上 expcheck 9/9、uicheck 16/16、regress 15/15、mobilecheck 6/6、tourcheck 2/2。

## 2026-10-19｜A4：正式版後拿掉「試用」字樣（/goal：便條紙＋A4）

- 使用者已照 08 把 Google 應用程式改為正式版（A3）。
- 檢查範圍：外掛原始碼、content/教學（含隱私權政策）、quartz.config.yaml、wiki-tour。唯一的「試用」在 Google 授權被拒時的訊息（「還不在雲端同步的試用名單裡」）→ 抽成 `auth/gis.ts` 的 `tokenErrorMessage()`，改為「沒有完成 Google 授權（在授權視窗按了取消，或沒有勾選存取權限）。可以再按一次「用 Google 同步」重試。」`notice` 維持空白。
- 首頁 `content/index.md` 的「邀請大家一起試用」講的是整個網站，且是 vault 同步內容，不動。
- 驗證：新增 test/auth.test.ts 3 個（拒絕授權訊息不含試用且說明重試、其他錯誤沿用 Google 說明、src 內非註解的程式碼沒有「試用」字樣）；改回舊版時 3 個都失敗。全部 141 個測試通過、tsc 通過；dist/app.js 已無「試用名單」。

## 2026-10-19｜便條紙（12 N1、D-41）＋條目書籤（12 N2）

**設計確認**：先用 AskUserQuestion 給使用者三種位置（附示意圖）、內容豐富度、附加功能。使用者選：貼在經節下方＋收起時像小圖示點了浮出；〈我的筆記〉頁加「⚙ 設定」統一選展開或收起；短文字＋四色；本章一鍵收起／展開、Markdown 匯出、導覽與教學提到。另外提出「知識庫條目加入書籤」（N2）。

**委派（使用者要求「請 Codex 做，不要什麼事情都親力親為」「分配任務要分級」）**
- 主導者先把共用基礎 commit 到 `feature/stickies`（紀錄種類 sticky、未知種類保留、選取在 `.bwz-v-ui` 內不算選經文、toast 復原按鈕、`Feature.first`、StickiesService），再交給 Codex。
- 便條畫面（第 2 級）與條目書籤（第 1–2 級）：Codex 在 worktree 實作（當時尚未訂分級，用的是 config 預設 gpt-6-astra／medium），主導者審查 diff、修正（新便條在本次瀏覽保持展開、測試替身補 overrides）、合併。
- 使用者看到初版後說「超級醜」→ 主導者訂出「紙箋」視覺規格（網站的羊皮紙色、深紅與琥珀、霞鶩文楷、✤ 裝飾），交給 **gpt-6-luna／medium（第 2 級）**。
- **Codex 沙箱問題**：worktree 與獨立 clone 都出現 `setup refresh had errors`。查 `~/.codex/.sandbox/sandbox.*.log`：沙箱每次啟動要設定 `...\Codex
untimes\cua_node\...
ode_repl.exe` 的權限，但該檔案正被使用（os error 32），而 Codex 自己的 node_repl／cua_repl MCP 一啟動就會占用它。用 `-c mcp_servers.node_repl.enabled=false` 與關閉 computer-use 外掛都沒有解決（另有使用者的 Codex 桌面版也在用同一個執行環境）。改用 07 的 stdin 模式：把規格與現有檔案經 stdin 傳給 Luna（read-only、不執行指令），請它輸出完整新檔案，由主導者貼上、測試。
- Luna 產出的問題（主導者修正）：用了 `h()` 不支援的 `html:` 屬性（圖示與「本章 N 張便條」都變空白）、卡片 class 少了 `bwz-sticky`、`className` 覆蓋掉傾斜 class、進場動畫 `fill: both` 讓傾斜失效、`clip-path` 把陰影切掉、SVG 字串沒有 xmlns 用 XML 解析不會變成 SVG（改用 HTML 解析器）、SVG `fill="var(--paper)"` 屬性無效、浮出視窗按鈕被「滑鼠移上去才顯示」規則藏起來。主導者依截圖逐輪調整：右下角翹起的陰影改落在紙外、橫線只畫在文字下方、動作圖示改放右上角、設定按鈕加明顯框線。
- 便條的 🗒 一開始在無頭 Chrome 顯示成小方框（缺 emoji 變體選擇符）→ 加 U+FE0F；收起圖示後來改為 SVG 迷你紙條。

**驗證**
- 單元測試 155 個（新增 auth 3、stickies 9、highlights 條目書籤、model 未知種類、verses 選取排除、export 便條），tsc 通過。
- 無頭 Chrome：stickycheck.mjs 23/23（工具列有便條、空白便條聚焦、自動儲存＋換色、經文文字不受影響、在便條上選字不跳工具列、有便條的經節仍可畫重點、本章 N 張與全部收起／展開、🗒 浮出、Esc 關閉、展開、重新整理後還在、刪除＋復原、空白不留、編輯中自動存、換頁不殘留、回來只有一張、〈我的筆記〉最上方⚙設定、設定預設展開、設為收起後是小圖示、手機版在畫面內且按鈕 ≥44px、無例外）；nodecheck.mjs 10/10（條目標題下方有按鈕、加入／取消、重新整理後仍在、資料夾首頁與章節頁沒有、〈我的筆記〉列出 📚 條目並可回去、SPA 換頁不重複、手機 44px、無例外）；回歸 uicheck 16/16、p2check 34/34、regress 15/15、fixcheck 11/11、mobilecheck 6/6、tourcheck 2/2、expcheck 9/9。
- 視覺：stickyshots.mjs 亮色／暗色的卡片、滑鼠移上、編輯中、收起＋浮出、手機、設定視窗截圖逐一檢查。
- **部署**（使用者確認推送）：`a045fd3b..4a1e190e`。線上 stickycheck 23/23、nodecheck 11/11、uicheck 16/16、p2check 34/34、mobilecheck 6/6、tourcheck 2/2、expcheck 9/9、regress 15/15、fixcheck 11/11、swcheck 11/11。

## 2026-10-19｜〈我的筆記〉頁為大量筆記重新整理（D-42）

- **起因**：使用者問「用很久的人有很豐富的筆記，這個頁面是否有做好收納跟整理？」→ 原本確實是全部列出（沒有分頁、折疊、分批），筆記多時頁面會非常長；書籤、重點也全列在下方，帳號與備份夾在中間。
- **設計確認**（AskUserQuestion，附示意圖）：最近 10 則與依書卷**同時顯示**（使用者自訂）、分頁標籤、管理功能收進「⚙ 設定與備份」、兩行預覽。
- **分工**：Codex 沙箱仍因 node_repl.exe 被占用無法執行（07 §5 備案）。外框、清單元件、各分頁的程式由主導者寫（與現有架構緊密相關、Codex 不能跑測試時容易出整合錯誤）；樣式交給 gpt-6-luna／medium（第 2 級，stdin 模式），主導者依截圖修正：網站主題的 layer 會蓋掉 `<article>` 的底色與 `<p>` 的字級（迷你紙箋變暗、總覽字太大）、短筆記也套用淡出遮罩（改成只有 `.long` 才截斷，用 mask-image）、分頁列出現垂直捲軸、手機分頁擠不下、頁尾被後來加入的分頁擠到中間（改成每次更新都移到最後）。
- **另修**：重新整理後沒有停在上次的分頁——第一個登記的分頁把偏好覆蓋掉了；改為偏好與目前顯示分開記。
- **驗證**：
  - 單元測試 160 個（新增 test/library.test.ts 5 個：經文順序、最近 n 則、書卷→章分組與計數、AND／#標籤搜尋、1200 則分組不遺漏不重複）。tsc 通過。
  - 新增 gen-backup.ts（用外掛自己的程式產生 400 筆記、80 便條、120 重點、25 書籤共 625 筆的備份）與 mynotescheck.mjs（無頭 Chrome 透過頁面的「從備份匯入」匯入）：24/24——四個分頁與設定按鈕、空白說明、總覽一行與分頁數量、筆記分頁只畫 10 張卡片且 12 卷全部收起（頁高 2868px）、最近依時間排序、打開創世記列出各章且數量加總相符、打開章才畫卡片並有「前往該章」、兩行預覽與展開全文、重畫後打開的書卷維持打開、搜尋平鋪 20 則與再顯示、分頁數量變成符合數、點標籤篩選、便條分頁四色迷你紙箋、紙箋真的是紙色底、頁尾在最後、重點分頁、書籤分頁的知識庫條目分組、重新整理後停在上次分頁、設定面板四個區塊、備份按鈕只在設定裡、手機不左右捲且分頁與目錄列 ≥44px、無例外。
  - 舊的檢查腳本改用新選擇器（p2check 的我的筆記搜尋／標籤／書籤與重點分頁／匯出在設定裡、mobilecheck 的搜尋框、fixcheck 的匯出備份與前往該章）：p2check 34/34、mobilecheck 6/6、fixcheck 11/11；其餘 stickycheck 23/23、nodecheck 10/10、uicheck 16/16、tourcheck 2/2、expcheck 9/9、regress 15/15。
- 教學：個人筆記使用說明加「〈我的筆記〉頁的整理方式」，備份／登出／刪除的位置改成「⚙ 設定與備份」；隱私權政策的操作路徑同步更新。
- **部署**（使用者確認推送）：`4a1e190e..c2d131f0`。線上 mynotescheck 24/24（625 筆匯入）、p2check 34/34、mobilecheck 6/6、fixcheck 11/11、regress 15/15。
- **便條收起後點小紙條直接展開**（使用者：「還要按展開才會貼在字下面，請把繁瑣的步驟除掉」）：拿掉浮出視窗，點迷你小紙條就在經文下方展開那一張。stickycheck 改為「點小紙條：直接在第 3 節下方展開（不浮出視窗）」，本機 21/21。D-41、教學同步更新。
- **部署**（使用者確認推送）：`c2d131f0..cc205c4b`。線上 stickycheck 21/21、mynotescheck 24/24。（GitHub API 匿名查詢達到每小時上限，改用「線上 app.js 與本機相同」判斷部署完成。）

## 2026-10-19｜外部顧問檢查：查證與決定（12 F）

- **起因**：使用者把另一個 AI 對整個專案的診斷貼過來，要求「不要全盘接收，當顧問來討論」。
- **Claude 查證**（對照程式碼）：
  - 沒有 Web Locks 時直接同步、03 寫的 IndexedDB 租約沒做 → 屬實（`sync/scheduler.ts` `withLock`）。各瀏覽器 2022 年後都支援，實際上碰不到 → 03 §4.6 補註，列為暫不做。
  - 經節偵測依賴頁面上的 `<ol>` → 屬實，但資料本身存節數＋原文片段＋雜湊，找不到時會列出提示；真正風險是章節格式改了功能靜靜不出現 → 改做建置後檢查（F4）。
  - GitHub Pages 與 Vercel 並存 → 屬實，而且 Vercel 當天也部署了筆記功能（`/my-notes` 200）；GitHub 網站的語意搜尋依賴 Vercel 的 `/api/search`，Vercel 不能整個關掉。
  - README 還寫「測試模式試用中」、05 的 P2-10 沒勾 → 屬實。
  - 顧問沒提到的：appDataFolder 只有本站的 Google Cloud 專案讀得到，專案被停權／刪除時雲端那份拿不回來 → 支持做可見備份（F3）。
- **使用者決定**：F1–F6（見 12 F）；F1、F2 先做，F3–F6 先討論設計、用問題確認後再寫 goal 提示詞。
- **F1 文件狀態**：README 狀態改為「已公開、正式版」並指向 12 為唯一狀態總表；05 的 P1-18 改為正式版觀察、P2-1／P2-10 勾選、補 P2-11～13（便條、條目書籤、我的筆記整理）；01 新增 D-43（只用 GitHub Pages）、D-44（正式版，結案 D-33），D-30／D-33 加指向；03 §4.6 補註租約未實作；04、08 的 Vercel 說明加註。
- **F2 Vercel 不再建置網站**（D-43）：`vercel.json` 改為不跑 Quartz、輸出目錄 `vercel-static/`；`/api/*`、`/sw.js`、`/static/sw.js` 以外一律暫時轉址（307）到 GitHub Pages 同一路徑；`/static/sw.js` 改寫到 `/sw.js`，回傳自我移除的 Service Worker（清快取、移除自己、重新載入分頁）。
  - **驗證（本機）**：用 Vercel 同版的 path-to-regexp 6.1.0 測轉址規則 12/12（首頁、我的筆記、中文章節路徑、static 檔會轉；`/api/search`、`/sw.js`、`/static/sw.js` 不轉；`/sw.json`、`/apix` 等相似路徑照常轉）；vercel.json 為合法 JSON。
  - 線上驗證要等推送後 Vercel 重新部署（vercel.json 不在 deploy.yml 的觸發路徑內，GitHub Pages 不會重建）。
- 分工：使用者說可以請子代理做事 → 第 3～6 項的程式背景調查交給 3 個 Explore 子代理（唯讀）。
- **F2 部署**（使用者選「推送」）：`cc205c4b..fdd94811`（含上一輪只改文件的 `e9dc55f6`）。線上確認：`/`、`/my-notes`、中文章節路徑、`/static/manifest.json` 都 307 轉到 GitHub Pages 同一路徑（中文路徑編碼正確，目標頁 200）；`/sw.js` 與 `/static/sw.js` 回傳自我移除版本，後者帶 `Service-Worker-Allowed: /`；`/api/search` 從 GitHub 網址的預檢 204、查詢 200 且有結果。
- **第三輪設計確認**（三輪選擇題）：F3 每週自動＋手動、保留 10 份、只存 JSON、提醒在〈我的筆記〉頁頂端且未登入也提醒、用不雜亂的方式說明功能；F4 基本檢查、警告＋自動開 Issue；F5 條目頁也能寫筆記、相關筆記分「連到」與「提到」兩組；F6 有開著的筆記就插在游標位置；F7（使用者追加）動畫示範＋自己試，入口為〈我的筆記〉按鈕、網站導覽筆記站連結、章節面板「?」只開文字版。→ 01 D-45～D-49、規格 13、05 P2-14～P2-26、12 F 表與第三輪 `/goal` 提示詞（1,228 字元）。
- 子代理調查補充的重點（已寫進 13）：`notes.ts` 的 `update()` 會把非章節錨點重建成 `_FREE` 章節錨點（做條目筆記時必修）；`ComposeNoteDetail.verseStart` 必填；GIS token client `include_granted_scopes:false`、scope 寫死，加 drive.file 要兩個一起要；Drive 的 request／退避是 `drive.ts` 私有函式；vitest 沒有 DOM 環境；CI 沿用快取的 `public/` 且增量建置不清空 → 建置檢查改在 emitter 內做；Quartz 別名轉址只在網站根目錄產生，不會替舊的 `link_folder/` 路徑轉址。
- 使用者要求之後的 goal 檔都要寫明分工：Claude 子代理 Sonnet／Haiku、Codex Sol／Luna、Antigravity Gemini，依難度分派 → 07 新增「全部幫手的分級」表，13 §8 列第三輪的分派。

## 2026-10-19｜第三輪 F3–F7（/goal）：準備、F4、F5

- 開工：Google Cloud 加 `drive.file` 的步驟寫進 08 步驟 4b，並已用白話告訴使用者（P2-15，等使用者操作）。
- **委派紀錄**（任務｜給誰｜等級｜結果）：
  - P2-14 檢查腳本搬進 repo｜Claude 子代理 Haiku（worktree）｜1｜完成 13 個檔案＋共用 lib＋README＋npm scripts。主導者修：便條腳本漏了「先打開創世記第 1 章」（11/21 失敗的原因）；README 補「子路徑建置要暫時改 baseUrl」、fixcheck 匯出要用 `INCOG=1`、tourcheck 需要出埃及記 12 章。
  - P2-16 F4a 建置檢查＋CI｜Claude 子代理 Sonnet（worktree）｜2｜完成；查證 emitter 拿到的樹就是 `.markdown-preview-view` 的子節點、一般與增量建置都會檢查全部章節（`partialEmit` 只在 --watch）。主導者審查後無修改。
  - P2-17 F4b `relocateNode` 純函式＋測試｜Codex gpt-6-luna low（stdin、唯讀）｜1｜完成；主導者刪掉兩段沒用到的程式、修正一個寫錯的測試案例（slug 沒變應回傳 same）。接到條目書籤（`repo/nodeHeal.ts`、`ui/linkIndex.ts`、nodeView、我的筆記書籤分頁）由主導者寫。
  - P2-18 F5a 筆記掛在條目｜Claude 子代理 Sonnet（worktree）｜3｜完成：`ChapterPanel` 改成 `NotesPanel(target)`（章節／條目兩種目標）、`update()` 陷阱修正、草稿支援條目、匯出「知識庫條目」資料夾。
    - 第 3 級審查：Codex gpt-6-sol high（唯讀）列 5 點、結論「修正後可以合併」：①草稿只比標題內文 → 只改標籤／節數的草稿會被當成已存好而遺失；②跨種類輸入讓章節筆記掉進 `_FREE`、草稿補存沒核對紀錄是否還在原位置；③條目筆記每次編輯都重寫錨點標題；④章節筆記位置沒變也重建錨點（蓋掉 quote 等欄位）；⑤缺面板整合測試。主導者修 ①–④ 並各補回歸測試（drafts 3 個、entryNotes 3 個）；⑤沒有 DOM 測試環境，改由無頭 Chrome entrycheck 驗證。
    - 交叉審查：Antigravity gemini-4-argon-high 回 429（個人額度用完，122 小時後重置）→ 改用 gemini-3.8-flash-high。
  - P2-19 F5b 相關筆記比對純函式｜Codex gpt-6-luna low｜1｜完成；主導者修測試資料（筆記存的連結名稱已去掉 `#`、`|`）。
  - P2-19 F5b 相關筆記清單畫面｜Codex gpt-6-luna medium（唯讀，可讀原始碼）｜2｜完成；主導者修：帶節數的章節筆記錨點種類可能不是 chapter（改成「不是 node」）、說明文字、預覽字被網站主題加粗（`!important`）；接到條目面板由主導者寫。
- Codex 沙箱：`-s read-only` 現在可以讀檔（加 `-C` 指到外掛資料夾即可讓它自己讀原始碼）；`workspace-write` 仍是 `setup refresh had errors` → 實作一律「唯讀＋輸出完整檔案」。
- **驗證**：
  - `npm test` 235 個、typecheck 通過。
  - 建置檢查：test_content 副本故意把創世記 2 章的經文清單在第 3 節後插一段文字 → 建置成功（exit 0），摘要「2 章通過、1 章有問題：清單在第 3 節之後被分成兩段」，報告 JSON 正確；CI 腳本用無效權杖與不存在的 repo 執行 → 警告與步驟摘要正確、`gh` 失敗也 exit 0（本機沒有 gh；GitHub 執行環境內建）。正常 test_content：3 章通過。
  - 無頭 Chrome（子路徑模擬環境）：新增 entrycheck.mjs 15/15（舊網址條目書籤在〈我的筆記〉連到新網址、找不到的標示且無連結、條目頁認得舊書籤、擋掉 links.json 後仍認得＝紀錄已改成新網址、條目面板與按鈕文字、編輯框沒有節數、重新整理還在、相關筆記兩組與排序與合計、點卡片到創世記 2 章並捲到那一則、SPA 換頁到〈大衛〉只顯示大衛的筆記、〈我的筆記〉有「知識庫條目」組、手機不左右捲且 ≥44px、無例外）。回歸：stickycheck 21/21、nodecheck 10/10、p2check 34/34、mobilecheck 6/6、regress 15/15、uicheck 16/16、swcheck 11/11、expcheck 9/9、mynotescheck 24/24（625 筆）、fixcheck 11/11（INCOG=1）。tourcheck 需完整內容，部署後線上跑。
- F5a 交叉審查（Antigravity gemini-3.8-flash-high，讀審查資料包）：6 點，與 Sol 的 ①–⑤ 相同（另把「條目筆記每次存都改標題」列為次要），建議修法與主導者已做的修正一致 → 第 3 級「兩個不同家族」審查完成。F5 本機 commit `1e559e5e`。
- 委派：F3a（授權多權限、Drive 可見資料夾、備份編排）｜Codex gpt-6-sol high｜3｜第一次用 `-C` 讓它自己讀檔，唯讀沙箱這次啟動失敗、沒有產出 → 改 stdin 模式（規格＋10 個相關檔案共 82 KB）重跑。F6｜Claude 子代理 Sonnet（worktree，先 `git merge --ff-only main`）｜2。F7a 動畫教學｜Claude 子代理 Sonnet（worktree）｜2。

## 2026-10-19｜第三輪 F3–F7（續）：F6、F3、F7、文案

- **委派紀錄**（任務｜給誰｜等級｜結果）：
  - P2-20 F6 引用到筆記｜Claude 子代理 Sonnet（worktree）｜2｜完成（`features/quotes/`、`COMPOSE_QUOTE_EVENT`、`ui/textInsert.ts`）；主導者補充「可收合區塊的小標題沒有 id」（記憶裡的網站導覽筆記）→ 子代理改用 summary 文字當出處、連結退回最近有 id 的標題。主導者驗證時發現 p2check 把兩種工具列算在一起 → 改檢查腳本（兩種各一份）。
  - P2-21 F3a 授權多權限＋Drive 可見資料夾＋備份流程｜Codex gpt-6-sol high｜3｜第一次讀檔模式沙箱失敗 → stdin 模式（82 KB）完成 11 個檔案。主導者修：Sol 刪掉了 session.ts／gis.ts／app.ts／drive.ts 大量原有註解（改為保留原檔只套功能、或逐條補回）；「每週自動備份」只在第一次申請權限的裝置開啟 → 改成有權限就預設開（每台裝置可關）；補 `reminder()`／「之後再說」。
    - 測試：driveBackup.test.ts 由 Claude 子代理 Sonnet 寫（22＋主導者 4 個，含 10 份修剪只動本站檔、還原只合併、兩台裝置同時到期、切換帳號不寫錯工作區）。子代理另指出「修剪失敗會讓整次備份算失敗、之後重複上傳」。
    - 第 3 級交叉審查：Antigravity gemini-3.8-flash-high（Argon 仍是額度 429）｜8 點，主導者修 6 點：換分頁續期掉 drive.file（授權記錄也用 email 記）、在 Google 視窗選錯帳號時丟掉那個 token、修剪失敗不算備份失敗、NaN 排序、進行中的備份依帳號區分、切換後不寫舊工作區；「新使用者沿用上一位的授權記錄」不修（Google 同意畫面會明確列出，不是默默開啟，且換分頁續期需要）、「trash 每次都重列清單」不修（每次通常只移 1 份）。各補回歸測試。
  - D-50（13 沒寫到，選擇題問使用者 →「讓我勾選要不要一起刪」）：刪除全部筆記時可勾選一起把 Drive 備份移到垃圾桶｜主導者實作（第 3 級：刪 Drive 檔）＋session 測試 4 個（沒權限不提供、沒勾不動、勾了只在刪除成功後移、刪除失敗不動）。
  - P2-22 F3b 設定區塊與提醒｜Codex gpt-6-luna medium（stdin）｜2｜主導者修：Luna 刪掉了無關的 `clearLocal()`（改回原檔只套兩處）、features 不能 import adapter 的型別（改由 session 轉出）、「只下載過備份檔」時錯顯示 Drive 控制項、「這是什麼？」排在說明上面、按鈕與字級和網站不一致、下載後提醒沒有立刻消失。
  - P2-23 F7a 動畫教學｜Claude 子代理 Sonnet（worktree）｜2｜完成 8 段＋換你試試＋外框 `addAction()`＋網站導覽連結。主導者驗證時發現**無頭 Chrome 預設回報「減少動態效果」**，先前截圖都是靜態版 → 檢查腳本改成明確設定一般動態，並用對話框的 `data-mode`（demo／try）判斷每段真的播完。
  - P2-24 F7b「?」文字版教學｜Claude 子代理 Haiku（worktree）｜1｜完成。
  - P2-25 教學文件初稿｜Claude 子代理 Haiku（worktree）｜1｜完成；中文文案審閱｜Antigravity gemini-3.8-flash-medium｜25 點，套用 20 點（例如教學寫「上方跳出工具列」實際在下方、刪除確認只寫「所有筆記」其實也刪便條重點書籤、按鈕名稱不一致）由 Claude 子代理 Haiku 套用；「Google Drive 一律改成雲端硬碟」不採用（功能名稱是使用者確認的「存一份到我的 Google Drive」，只改成同一句不混用）；速查表「加入主畫面」連到 INSTALL_MOBILE 是這輪以前的問題，未改、列入報告。
- 其他修正：外框的設定按鈕加 `data-shell="settings"`（教學按鈕共用外觀，舊檢查腳本會點錯）。本機 Quartz 的 `.quartz/plugins/wiki-tour` 是指向 `plugins/wiki-tour` 的符號連結：主導者一次複製指令誤在 `plugins/wiki-tour/wiki-tour` 建了部分複本，已確認是自己剛建的、刪除，原始檔完好（git 只有預期的修改）。
- **驗證**（全部在子路徑模擬環境）：`npm test` 302 個、typecheck 通過；建置檢查 3 章通過。無頭 Chrome：stickycheck 21/21、nodecheck 10/10、p2check 34/34、mobilecheck 6/6、fixcheck 11/11（INCOG=1）、regress 15/15、uicheck 16/16、swcheck 11/11、expcheck 9/9、mynotescheck 24/24（625 筆）、entrycheck 15/15、**quotecheck 11/11**（註釋區選字只出現引用工具列、開新整章筆記、插在游標位置、經文選字只出現經文工具列、條目頁引用成條目筆記、筆記卡片裡不出現、手機 44px）、**backupcheck 10/10**（新筆記不提醒、設定區塊說明與收合、時間往後 40 天出現未登入提醒、之後再說 7 天、下載備份檔後立刻不再提醒、手機）、**helpcheck 8/8**、**tutorialcheck 10/10**（8 段真的播完進入換你試試、示範區不改真正的筆記數、鍵盤與焦點、減少動態效果、手機）。tourcheck 需要出埃及記 12 章，部署後線上跑。
- 未能在本機驗證：真正的 Google Drive 上傳、清單、還原、刪除時一起移備份（需要使用者在 Google Cloud 加 drive.file 後用自己的帳號實機試）。
- **部署**（使用者選「推送」；drive.file 使用者尚未加）：`fdd94811..99787098`（15 個 commit、113 個檔案）。GitHub Actions：build（含新的「Verse list check report」步驟）與 deploy 都成功；沒有經文清單警告、沒有「找不到報告」提示、沒有開 Issue → 線上內容所有章節都通過。
- **線上驗證**：tourcheck 2/2（網站導覽筆記站，含新連結）、stickycheck 21/21、nodecheck 11/11、p2check 34/34、mobilecheck 6/6、regress 15/15、swcheck 11/11、uicheck 16/16、expcheck 9/9、mynotescheck 24/24、entrycheck 15/15、quotecheck 11/11、backupcheck 10/10、helpcheck 8/8、tutorialcheck 10/10、fixcheck 11/11（INCOG=1）。
- 待使用者：08 步驟 4b 加 drive.file；之後實機試「存一份到我的 Google Drive」→ 到 Drive 看資料夾 →「從這份還原」。
- 收尾查核（goal 檢查提出兩個缺口）：①真正的 Google Drive 上傳／清單／還原／刪除時一起移備份，需要使用者先加 drive.file 再用自己的帳號實機測 → 05 P2-26 保持未勾；②13 §8 指定的 `gemini-4-argon-high` 交叉審查未做：重試 argon-high／medium／low 都回 429（約 120 小時後重置），第 3 級已由 Sol（OpenAI）＋gemini-3.8-flash-high（Google）兩個家族審過 → 新增 05 P2-27「額度恢復後補 Argon 審查」，請使用者決定是否接受 Flash 代替。
- **Argon 審查的處理**（使用者回答「你也看一下」）：主導者（Claude Opus，Anthropic，與 Sol／Gemini 不同家族）逐行審第 3 級程式：
  - `adapter/driveFiles.ts`：以 appProperties 找資料夾與備份（spaces=drive，drive.file 只看得到本站建立的檔）、trash／read 前重新核對是本站備份、multipart 中文內容編碼——無問題。
  - `auth/gis.ts`：**找到 1 點**——使用者開過 drive.file 後，在同意畫面取消勾選或到 Google 帳戶移除權限，本機「開過」記錄仍在，之後每次「繼續同步」都會再跳出要求 Drive 權限的同意畫面。修正：一起申請了 drive.file 卻沒拿到時忘掉記錄（`forgetBackupGrant`），補測試（續期沒拿到 → 同步照常、下次只申請 appdata）。
  - F5a 錨點與 D-50 刪除備份：維持 Sol／Gemini 審查後的修正，無新問題。
  - 測試 303 個通過。本機 commit，待與實機測試後的修正一起部署。
- **部署**（使用者選「推送」）：`99787098..c4dad889`（授權續期修正＋文件）。GitHub Actions 排隊較久，約 13 分鐘後線上 app.js 與本機一致。線上 backupcheck 10/10、regress 15/15、helpcheck 8/8、stickycheck 21/21。
- 等使用者加 drive.file 後依 13 §10 實機測試（P2-15、P2-26）。
- 2026-10-20：使用者在 Google Cloud 加好 `drive.file`（截圖：OAuth 同意畫面「非機密範圍」列出 `drive.file` 與 `drive.appdata`）→ 05 P2-15 勾選。已把 13 §10 實機測試步驟交給使用者；P2-26 等使用者回報結果。
- 2026-10-20 **實機測試第一次回報**（截圖）：存到 Google Drive 成功——「上次備份：今天（Google Drive）」、「每週自動備份（這台裝置）」已勾、「查看備份與還原」列出 2026/10/20 01:58、4 則。還原結果與 Drive 資料夾確認待回報。
- 同一張截圖看到**排版問題**：「每週自動備份」的勾選框蓋到「立即備份」按鈕。原因：網站主題替所有勾選框加負的左邊距（quartz-base 的 `margin-inline: -1.4rem`，以及排在外掛後面的 obsidian-theme 層 `-24px`），後者層級較後，選擇器再精確也贏不了。主導者修（美術調整，第 1 級）：`backup.scss` 對 `.bwz-backup-check`、`.bwz-n-check`（刪除全部視窗的 D-50 勾選）的勾選框用 `!important` 歸零。新增 `e2e/checkboxcheck.mjs`（用網站真正的 CSS 量勾選框與按鈕位置，電腦＋手機）：修正前 3/7（勾選框往左 24px、蓋到按鈕 9px），修正後 7/7；npm test 303、typecheck、backupcheck 10/10。本機 commit，待部署。
- 2026-10-20 **實機測試第二次回報**：使用者回覆「都宿」（理解為「都是」＝兩項都符合預期）——Google Drive 有「聖經知識庫筆記備份」資料夾與 .json 備份檔；「從這份還原」正常。13 §10 第 1～4 步全部通過 → 05 P2-26 勾選，12 F3 註記。第三輪 F3–F7 結案。
- **部署**（使用者選「推送」）：`c4dad889..b9df3d25`（勾選框排版修正＋文件）。線上 CSS 已含修正；線上 checkboxcheck 7/7、backupcheck 10/10。（註：Git Bash 裡沒有 `gh`，等待部署的迴圈改看線上 CSS 是否已更新。）
- 2026-10-20 **第四輪設計討論**（使用者：教學只有電腦版，手機呢？怎麼切換？）：主導者用 390×844 截圖確認手機看到的是電腦版縮小＋滑鼠游標；以選擇題確認四點（同 8 段改手機畫面、自動判斷＋「電腦｜手機」切換、「?」依裝置換說法、手機也能換你試試）→ D-51、規格 14、05 P2-28～P2-36、12 F8 與第四輪 /goal 提示詞（完成條件寫明：交出手機實機測試清單即可結束，不必等使用者回報）。
- 2026-10-20 使用者追加：網站導覽講到筆記時也帶讀者點筆記本圖示進〈我的筆記〉→ 14 §8（新站 notes-entry 換你操作＋mynotes 站，再回第 12 章）、D-51 ⑤、05 P2-37、12 F8 與提示詞更新。

### 第四輪 F8（2026-10-20 開工）
- 委派 P2-28＋P2-32（第 1 級）→ Codex `gpt-6-luna` **low**（stdin 模式）：第一次輸出到 dialog.ts 中途停掉（dialog.ts 空、helpGuide 與測試沒交），補交一次才完整。採用 env.ts `primaryInput()`、`features/tutorial/device.ts`（網址 > 記住 > 自動；網址參數不記住）、index.ts（`?device=` 一起從網址拿掉）、helpGuide 兩種說法＋`helpLines()`、test/device.test.ts、helpGuide 與 tutorial 測試更新；沒有刪掉原有註解。主導者：dialog.ts 收 `device`（存欄位、`data-device`）、補檔頭與函式註解、修 Python 寫檔造成的 CRLF。npm test 314、typecheck 過。
- 使用者：「Luna efforts 太低了」→ 07、14 改成 Luna 第 1 級 medium、第 2 級 high（不再用 low），記憶同步。
- 委派 P2-37（第 2 級）→ Sonnet 子代理（worktree）：網站導覽新增「點筆記本圖示」與〈我的筆記〉兩站＋舊進度位移、tourcheck 擴充（進行中）。
- 委派 P2-33 初稿（第 1 級）→ Haiku 子代理：8 段手機版 caption／steps／tryText／say 初稿完成（存 scratchpad r4/copy-draft.md），待 Flash 審。
- 委派 CDP `(pointer: coarse)` 模擬調查（第 1 級）→ Haiku 子代理（進行中）。
