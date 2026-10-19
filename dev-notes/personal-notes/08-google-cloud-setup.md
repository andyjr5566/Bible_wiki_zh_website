# 08 Google Cloud 設定指南（使用者操作）

> **這是站長只需要做一次的設定，網站的一般使用者完全不用做。** 一般使用者只會按「用 Google 同步」→ 在 Google 畫面按「允許」，就完成了。

這些步驟需要用你自己的 Google 帳號完成，我（Claude）無法代勞。完成後只要把 **用戶端 ID（Client ID）** 告訴我。
Google Cloud Console 的介面名稱偶爾會改，若找不到對應按鈕，截圖給我一起看。

> 全程**不需要**綁信用卡或啟用帳單。

---

## 步驟 1：建立專案
1. 開啟 https://console.cloud.google.com/ ，用你要管理這個網站的 Google 帳號登入。
2. 左上角專案選單 → **新增專案** → 名稱例如 `bible-wiki-notes` → 建立。
3. 確認左上角已切換到這個新專案。

## 步驟 2：啟用 Google Drive API
1. 左側選單 → **API 和服務** → **程式庫**。
2. 搜尋 `Google Drive API` → 點進去 → **啟用**。

## 步驟 3：設定 Google Auth Platform（舊稱「OAuth 同意畫面」）
1. 左側選單 → **Google Auth Platform**（或 API 和服務 → OAuth 同意畫面）→ **開始使用**。
2. **應用程式資訊**：
   - 應用程式名稱：`聖經研讀知識庫`
   - 使用者支援電子郵件：你的信箱
3. **目標對象**：選 **外部（External）**。
4. **聯絡資訊**：你的信箱。
5. 同意政策 → 建立。

## 步驟 4：設定資料存取範圍
1. Google Auth Platform → **資料存取（Data Access）** → **新增或移除範圍**。
2. 在手動輸入欄貼上：`https://www.googleapis.com/auth/drive.appdata` → 加入 → 更新 → **儲存**。
3. 確認它出現在「非機密範圍」區。**不要**加入其他 Drive 範圍。

### 步驟 4b（2026-10-19 第三輪新增，D-45）：加上 `drive.file`
「存一份到我的 Google Drive」要用。只能碰本站自己建立的檔案，看不到使用者 Drive 裡的其他東西；Google 歸類為非機密範圍，不需要審查。
1. 打開 https://console.cloud.google.com/ ，左上角確認是本站的專案。
2. 左側選單 → **Google Auth Platform** →（左側）**資料存取（Data Access）**。
3. 按 **新增或移除範圍（Add or remove scopes）**。
4. 拉到最下面「手動新增範圍」，貼上：`https://www.googleapis.com/auth/drive.file` → **加到表格** → **更新**。
5. 回到資料存取頁，確認「非機密範圍」裡有 `drive.appdata` 和 `drive.file` 兩個 → 按頁面最下面的 **儲存（Save）**。
6. 其他都不用動（用戶端 ID、授權來源不變）。做完跟 Claude 說一聲即可。

## 步驟 5：測試使用者
1. Google Auth Platform → **目標對象（Audience）**。
2. 發布狀態保持 **測試中（Testing）**。
3. **測試使用者** → 新增：你自己，以及要幫忙試用的人的 Gmail（最多 100 位）。

## 步驟 6：建立網頁用戶端
1. Google Auth Platform → **用戶端（Clients）** → **建立用戶端**。
2. 應用程式類型：**網頁應用程式（Web application）**；名稱：`bible-wiki-web`。
3. **已授權的 JavaScript 來源**，新增：
   - `https://andyjr5566.github.io`
   - `http://localhost:8080`（本機測試用）
   - ~~（如果 Vercel 版也要能登入）`https://bible-wiki-zh-website.vercel.app`~~ 2026-10-19 起不需要：Vercel 不再提供網站（D-43）。之前若加過可以留著，也可以刪掉。
4. **已授權的重新導向 URI**：第一階段不用填。
5. 建立 → 畫面會顯示 **用戶端 ID**（長得像 `123456789-abc...apps.googleusercontent.com`）。

## 步驟 7：交給我
- ✅ 把 **用戶端 ID** 貼給我。它本來就會出現在網頁原始碼裡，是公開資訊。
- ❌ **用戶端密鑰（Client secret）不要給我，也不要放進 repo 或任何網頁**。第一階段完全用不到；第二階段的 Token 服務會放在伺服器環境變數裡，到時候再一起設定。

---

## 目前設定值（已完成）

| 項目 | 值 | 日期 |
|---|---|---|
| OAuth 用戶端 ID（公開資訊） | `339980089528-va9622cqhnurr1sqrl8kl6aa5bim30fl.apps.googleusercontent.com` | 2026-10-18 |
| 專案編號（取自用戶端 ID 前綴） | `339980089528` | 2026-10-18 |

授權來源、測試使用者、drive.appdata 範圍是否都設定正確，會在 Phase 0 的 PoC（P0-4）實際登入時驗證。

---

## 開放給所有人（改為正式版，D-33）

目前是「測試中」：只有測試使用者名單裡的 Gmail 能同步。改成正式版後任何 Google 帳號都能用，**程式不用改**。
本站只申請 `drive.appdata`（Google 歸類為非敏感範圍），預期**不需要**送 Google 做安全審查；若主控台要求驗證，依畫面指示處理，或回報給 Claude 一起看。

1. 開 <https://console.cloud.google.com/>，上方選本專案（專案編號 `339980089528`）。
2. 左側選單 →「Google Auth Platform」→「品牌塑造（Branding）」，確認或填寫：
   - 應用程式名稱：`聖經研讀知識庫`（使用者在 Google 同意畫面看到的名字）
   - 使用者支援電子郵件：你的 Gmail
   - 應用程式首頁：`https://andyjr5566.github.io/Bible_wiki_zh_website/`
   - 隱私權政策連結：`https://andyjr5566.github.io/Bible_wiki_zh_website/教學/隱私權政策`
   - 授權網域：`andyjr5566.github.io`
   - 開發人員聯絡資訊：你的 Gmail
   - **先不要上傳 Logo**：上傳 Logo 會觸發「品牌驗證」，需要數天審核；沒有 Logo 也能正常使用。
   - 按「儲存」。
3. 左側 →「目標對象（Audience）」→ 發布狀態「測試中」旁按 **「發布應用程式」** → 確認。狀態變成「正式版（In production）」就完成了。
4. 用一個**不在測試使用者名單裡**的 Gmail 試登入：應該能看到同意畫面並成功同步。
   - 若同意畫面出現「Google 尚未驗證這個應用程式」的警告：代表 Google 要求品牌或網域驗證。可以先按「進階 → 前往（不安全）」繼續用；要拿掉警告需在 Google Search Console 驗證 `andyjr5566.github.io`（Claude 可以替網站加上驗證檔），或改用自訂網域（D-30）。
5. 完成後告訴 Claude：會把網站上「試用名單」字樣（登入被拒時的說明）改掉，並在 01 記錄 D-33 定案（12 的 A4）。

**可以隨時改回來**：在「目標對象」按「返回測試」即可恢復成只有測試使用者能登入。已存在使用者雲端硬碟裡的筆記不受影響。
