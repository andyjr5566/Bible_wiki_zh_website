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
