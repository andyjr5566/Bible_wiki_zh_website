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
   - （如果 Vercel 版也要能登入）`https://bible-wiki-zh-website.vercel.app`
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

## 之後（Phase 2，正式公開前）
- 隱私權政策頁、首頁連結填進「品牌塑造（Branding）」。
- 在 Google Search Console 驗證網域（`andyjr5566.github.io` 可能需要另建使用者站台，或改用自訂網域，見 D-30）。
- 品牌驗證（顯示 App 名稱與 Logo）。
- 目標對象 → **發布應用程式**（改為正式版），解除 100 位測試使用者限制。
