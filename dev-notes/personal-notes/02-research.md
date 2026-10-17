# 02 可行性研究

研究日期：2026-10-18。Google 官方文件以當日版本為準（Drive usage limits 頁面標示 last updated 2026-09-11）。
標記：**[事實]** 官方文件或程式碼確認；**[建議]** 設計判斷；**[待驗證]** 需 PoC／實機。

---

## 1. 結論

**值得採用。** 定位是「本機優先（IndexedDB）＋ Drive appDataFolder 同步與備份」，不是「把 Drive 當資料庫」。

- 技術可行：`drive.appdata` 是非敏感權限，不需安全評估；Drive API 可從瀏覽器直接呼叫；MVP 不需後端。[事實]
- 可預見規模內免費：2026-05-01 起 Drive API 改用「配額單位」，每專案每日 4 億單位免費門檻；估算約 16 萬 DAU 才會碰到。[事實＋估算]
- 隱私最乾淨：網站不保管任何人的筆記。

代價：
1. 省錢優勢有限：同規模 Firestore 約 0–25 美元／月。真正價值是資料自主與零保管責任。
2. 同步引擎要自己寫：Drive v3 沒有條件式寫入 → 每台裝置只寫自己的檔（03 §3）。
3. 純前端登入有上限：token 約 1 小時、無 refresh token、續期需點擊；iPhone 主畫面 App 的彈窗登入可能失效 → Phase 2 加無資料庫 Token 服務。

政策風險 [事實]：Google 將在 2026 年稍晚（提前 90 天通知）對超過每日門檻的用量收費，單價未公布；申請提高配額也將需要啟用帳單。

---

## 2. Google OAuth 與 Drive API

| 問題 | 答案 |
|---|---|
| 登入後能另外取得 Drive 授權嗎？ | 可以。認證與授權分開；GIS token client 直接申請 `drive.appdata`，不必另做 Sign in with Google；可用 `include_granted_scopes`（預設 true）漸進加權限。[事實] |
| 能完全只靠前端嗎？ | 能，用 GIS Token model（彈窗）。Google 把它的使用者安全性評為「最低」、推薦需要後端換 token 的 Code model。[事實] 直接打 OAuth 端點的 redirect 隱式流程被標為「強烈不建議、僅供舊系統」。[事實] |
| 能 CRUD JSON 檔嗎？ | 可以：`files.create`／`files.get?alt=media`／`files.update`／`files.delete`；appDataFolder 用 `parents:['appDataFolder']` 建立、`spaces=appDataFolder` 列出。[事實] |
| 需要 App 驗證嗎？ | 非敏感權限 → 不需敏感／受限權限審查與安全評估。[事實] 仍需：發佈為正式版（測試中最多 100 位測試使用者）、首頁與隱私權政策放在已驗證網域、授權網域在 Search Console 驗證；要顯示 App 名稱與 Logo 需品牌驗證（自動檢查約數分鐘，人工約 2–3 個工作天）。[事實] |
| 使用者會只同意一部分嗎？ | 只申請一個非登入類權限時不顯示勾選框。[事實] 若同時申請 email/profile＋Drive，使用者可能取消勾選 Drive → 所以只申請 `drive.appdata`。 |
| 取得使用者名稱頭像？ | `about.get?fields=user(displayName,emailAddress,photoLink,permissionId)`，接受 `drive.appdata` 權限，`fields` 必填。[事實] |

### 2.1 `drive.appdata` vs `drive.file`

| | `drive.appdata` | `drive.file` |
|---|---|---|
| 敏感度 | 非敏感 [事實] | 非敏感 [事實] |
| 範圍 | 本 App 的隱藏資料夾 | 本 App 建立、或使用者指定給 App 的檔案 |
| 使用者看得到嗎 | 看不到，Drive 網頁也打不開 [事實] | 看得到 |
| 分享／移動／垃圾桶 | 都不支援（錯誤碼 `notSupportedForAppDataFolderFiles`）[事實] | 支援 |
| 怎麼被刪 | 使用者從「我的雲端硬碟」解除安裝 App 時刪除；使用者也可手動刪除 App 資料 [事實] | 使用者自行刪除（垃圾桶 30 天可救回） |
| 誤改風險 | 無 | 有（手動改 JSON、桌面版同步產生重複檔） |

### 2.2 Token 與登入持久性
- 存取權杖有效期以 `expires_in` 回傳（範例值 3600 秒）。[事實]
- Token model 續期必須由使用者手勢觸發 `requestAccessToken()`，即使先前已授權。[事實]
- `prompt` 可用值：`''`（只有第一次要求同意）、`none`、`consent`、`select_account`（預設）。`login_hint` 可跳過帳號選擇。[事實] 用 `prompt:''`＋`login_hint` 續期時彈窗是否會自動關閉 → [待驗證]。
- 錯誤回呼類型：`popup_failed_to_open`、`popup_closed`、`unknown`；使用者關掉彈窗時成功回呼不會被呼叫。[事實]
- `google.accounts.oauth2.revoke` 撤銷所有已授權範圍，需要有效 token。[事實]
- Code model：授權碼在後端換成 refresh token 與 access token；彈窗模式用 `X-Requested-With: XmlHttpRequest` 防 CSRF，redirect 模式用 `state`。[事實] Google 的「網頁應用程式」用戶端換 token 實務上需要 client secret（第三方測試，非官方明文）。
- Refresh token 失效條件：使用者撤銷、6 個月未使用、Gmail 範圍＋改密碼、超過每帳號每 client 100 個 refresh token（最舊的會被默默作廢）、限時授權到期、管理員限制、Cloud session 時長。測試中狀態的外部應用程式 refresh token 7 天過期。[事實]

### 2.3 iPhone、PWA、內建瀏覽器
- GIS token client 只有彈窗 UX；redirect 只有 code client 有。[事實]
- iOS 主畫面 App（standalone）的彈窗登入：多份社群回報會卡住、回不到 App（Firebase 案例），解法多為改用 redirect。[待驗證，需實機]
- 主畫面 App 與 Safari 的網站儲存互相獨立，要各自登入。[社群回報]
- WebKit：瀏覽器 App 的單一網域配額最多約磁碟 60%；以網域為單位整包清除，最近最少使用者先清；`navigator.storage.persist()` 依啟發式授予（例如是否以主畫面 App 開啟）。[事實] Safari 一般網站 7 天未互動可能清除 script 可寫入的儲存（2020 ITP 政策；主畫面 App 有自己的計數，但有回報仍被清）。
- LINE／FB／IG 內建瀏覽器：Google 拒絕嵌入式瀏覽器的 OAuth（`disallowed_useragent`）。[事實：Google 政策；需實測 LINE 行為] LINE 可在網址加 `openExternalBrowser=1` 強制外部瀏覽器開啟。[待驗證]

### 2.4 同步相關 API 事實
- Drive v3 的 File 沒有 `etag`（v2→v3 對照表標示 n/a），也沒有文件記載的 If-Match 條件式寫入；有 `version`（單調遞增，任何伺服器端變更都會增加）。[事實]
- `changes.getStartPageToken` → `changes.list(pageToken)` → 沒有 `nextPageToken` 時保存 `newStartPageToken`。`spaces` 支援 `drive` 與 `appDataFolder`；`changes.list` 接受 drive.appdata。[事實]
- 推播通知（`changes.watch`）需要伺服器接收 → 純前端只能輪詢。[事實＋推論]
- 批次請求：每批最多 100 個呼叫；**n 個呼叫照算 n 次配額**；**不支援內容上傳／下載**。[事實] → 批次無法省配額。
- `fields` 部分回應可減少流量；gzip 需 `Accept-Encoding: gzip`。[事實]
- 達到配額回 403 `User rate limit exceeded` 或 429；用截斷指數退避（2^n 秒＋最多 1000ms 隨機，上限 32 或 64 秒）。[事實]

---

## 3. Drive API 配額與計費（2026 新制）[事實]

適用：2026-05-01 之後建立的 Cloud 專案（2025-11～2026-04 有使用的舊專案沿用舊配額至少 60 天）。

| 項目 | 限制 |
|---|---|
| 每專案每分鐘 | 1,000,000 配額單位（所有使用者共用） |
| 每使用者每專案每分鐘 | 325,000 單位 |
| 每專案每日流出量 | 1 TB（超過才收費） |
| **每專案每日計費門檻** | **400,000,000 單位，不可申請提高** |

| 操作 | 單位 |
|---|---|
| 讀取（如 files.get） | 5 |
| 列表（如 files.list） | 100 |
| 下載（如 files.download） | 200 |
| 修改（如 files.update） | 50 |
| 其他（如 files.generateIds） | 5 |

- 「所有標準用量免費；超過配額預計 2026 年稍晚開始計入 Google Cloud 帳單。」完整計費細節將於 2026 年稍晚公布，至少提前 90 天通知。
- 2026 稍晚起：申請提高配額需啟用帳單；超過每日標準門檻會產生費用。Google 預期少於 1% 開發者需要超過標準層級。
- 只要不超過每分鐘配額，每日請求次數不限（但每日計費門檻另計）。
- [待驗證] `files.get?alt=media` 算讀取（5）還是下載（200）；`files.create`、`changes.list` 的歸類。PoC 時到 Cloud Console 觀察。
- 配額歸屬：**開發者的 Cloud 專案**，不是使用者。儲存空間才是使用者自己的（筆記很小，可忽略）。

---

## 4. 成本估算

### 4.1 每位活躍使用者每日用量（估算）

| 動作 | 單位 | 次數／日 | 小計 |
|---|---|---|---|
| 開啟時 changes.list | 100 | 1 | 100 |
| 輪詢與「先同步再編輯」的 changes.list | 100 | 約 15 | 1,500 |
| 下載其他裝置分片 | 5 或 200 | 約 2 | 10–400 |
| 上傳自己的分片 | 50 | 約 20 | 1,000 |
| 合計 | | | 一般約 2,600–3,000；重度約 7,000 |

輪詢是最大用量來源 → 頁面可見才輪詢、沒有變更就拉長間隔、「先同步」限 30 秒內不重複。

### 4.2 依規模推估（假設 DAU＝註冊數 15%，尖峰一分鐘 10% DAU 同時操作、每人約 150 單位／分）

| 註冊 | DAU | 每日單位（占門檻） | 尖峰每分鐘（占上限） | Firestore 對照 | CF D1 對照 |
|---|---|---|---|---|---|
| 100 | 15 | 約 4.5 萬（0.01%） | 0.02% | $0 | $0 |
| 1,000 | 150 | 約 45 萬（0.1%） | 0.2% | $0 | $0 |
| 10,000 | 1,500 | 約 450 萬（1.1%） | 2% | 約 $1.6／月 | $0 |
| 100,000 | 15,000 | 約 4,500 萬（11%） | 22% | 約 $25／月 | 約 $5／月 |

- 只讀網站、不登入的訪客耗用 0。影響用量的是「有在同步的 DAU」，不是註冊人數。
- 風險：集體同時使用（特會、小組同一時間存檔）、有 bug 的版本狂打 API（配額全專案共用，會讓所有人 403）、Google 政策變動。
- Firestore 估算假設每 DAU 每日 30 次寫入＋100 次讀取（附 Firestore 離線快取）。

---

## 5. 方案比較（成本以約 1.5 萬 DAU 估）

| | A. appDataFolder | B. 可見資料夾 drive.file | C. Firestore | D. Supabase | E. CF Workers＋D1 | F. 純本機＋匯出 |
|---|---|---|---|---|---|---|
| 每月成本 | $0 | $0 | 約 $25 | Pro $25 | 約 $5 | $0 |
| 誰保管筆記 | 使用者 | 使用者 | 開發者 | 開發者 | 開發者 | 使用者裝置 |
| 離線與同步 | 自己寫 | 自己寫＋處理外部修改 | SDK 內建 | 自己寫 | 自己寫 | 無跨裝置 |
| 開發量 | 中高 | 高 | 低中 | 中 | 中 | 低 |
| 主要風險 | Google 政策 | 使用者誤改 | 綁卡、帳單、個資責任 | 免費版限制 | 個資責任 | 換手機就沒了 |

採用 A＋F，同步層可抽換（D-18）。

官方價格 [事實]：
- Firestore 免費額度：儲存 1 GiB、讀取 5 萬／日、寫入 2 萬／日、刪除 2 萬／日、流出 10 GiB／月；us-central1 超額：讀取 $0.03／10 萬、寫入 $0.09／10 萬、刪除 $0.01／10 萬。
- Supabase 免費：資料庫 500 MB、5 萬 MAU、流出 5 GB、閒置 1 週暫停、最多 2 個專案；Pro 起 $25／月。
- Cloudflare D1 免費：讀取 500 萬列／日、寫入 10 萬列／日、5 GB；付費方案含 250 億讀／5,000 萬寫／月。Workers 免費 10 萬請求／日、每次 10ms CPU；KV 免費 10 萬讀／1,000 寫／日。
- Vercel Hobby：函式呼叫 100 萬次／月、Active CPU 4 小時，限個人非商業用途。

---

## 6. 儲存結構評估

| 方案 | 評估 |
|---|---|
| 全部一個 JSON | 容量沒問題（上千筆約 1–3 MB），但每次存檔上傳整份；所有裝置寫同一檔 → 無條件式寫入會互相覆蓋。❌ |
| 每章一檔＋manifest.json | 最多 1,189 檔，換裝置要下載上千檔；Drive 不是路徑式檔案系統（同名可重複、要逐層查）；manifest 是每次都改的熱點檔。❌ |
| 每筆一檔 | 不衝突，但檔案數爆炸、換裝置要上千次下載。❌ |
| **每裝置 × 每書卷一檔** | 每檔單一寫入者，不會互相覆蓋；寫入不必先讀；換裝置約 1 次列表＋數十次下載。✅ |

JSON 作為儲存格式即可；Markdown 作為匯出格式；不建議把 SQLite 檔整個存在 Drive（整檔衝突）。

---

## 7. 現有專案研究摘要

詳見 [04-repo-integration.md](04-repo-integration.md)。重點：Quartz v5 community plugin 管理、本地 plugin 模式（wiki-tour）、plugin 可同時是 transformer／emitter／pageType／component、SPA 用 micromorph 換 body、Service Worker 無快取上限、已有 Vercel serverless（api/search.js）、經節渲染為無 ID 的 `<li>`、content 仍在建置（目前 6 卷有章節，211 章）、contentIndex.json 約 19.7 MB。

---

## 8. 來源

Google Drive：
- API scopes：https://developers.google.com/workspace/drive/api/guides/api-specific-auth
- Usage limits：https://developers.google.com/workspace/drive/api/guides/limits
- Standardized model for agent tools and APIs：https://developers.google.com/workspace/tools-safety
- 2026-05 公告：https://workspaceupdates.googleblog.com/2026/05/agent-tools-and-security-updates-for-workspace-developers.html
- appDataFolder：https://developers.google.com/workspace/drive/api/guides/appdata
- Manage changes：https://developers.google.com/workspace/drive/api/guides/manage-changes
- changes.list：https://developers.google.com/workspace/drive/api/reference/rest/v3/changes/list
- about.get：https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get
- Performance／batch：https://developers.google.com/workspace/drive/api/guides/performance
- v2→v3 reference：https://developers.google.com/workspace/drive/api/guides/v2-to-v3-reference
- Files resource：https://developers.google.com/workspace/drive/api/reference/rest/v3/files

Google Identity：
- Token model：https://developers.google.com/identity/oauth2/web/guides/use-token-model
- Choose model：https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model
- Code model：https://developers.google.com/identity/oauth2/web/guides/use-code-model
- JS reference：https://developers.google.com/identity/oauth2/web/reference/js-reference
- Migration to GIS：https://developers.google.com/identity/oauth2/web/guides/migration-to-gis
- OAuth 2.0 overview：https://developers.google.com/identity/protocols/oauth2
- Implicit flow（警告）：https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow
- Granular permissions：https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions
- Verification requirements：https://support.google.com/cloud/answer/13464321
- Unverified apps：https://support.google.com/cloud/answer/7454865
- Brand verification：https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification

iOS／Safari：
- WebKit storage policy：https://webkit.org/blog/14403/updates-to-storage-policy/
- WebKit bug 237350：https://bugs.webkit.org/show_bug.cgi?id=237350
- PWA 彈窗卡住案例：https://github.com/SaharAga/SpotLi/pull/231
- firebase-js-sdk #77：https://github.com/firebase/firebase-js-sdk/issues/77
- Google PKCE 仍需 client_secret 測試：https://ktaka.blog.ccmp.jp/2025/07/oogle-oauth2-and-pkce-understanding.html

價格：
- Firestore：https://cloud.google.com/firestore/pricing
- Supabase：https://supabase.com/pricing
- Cloudflare D1：https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare Workers：https://developers.cloudflare.com/workers/platform/pricing/
- Vercel Hobby：https://vercel.com/docs/plans/hobby
