# 個人研經筆記功能：開發筆記

這個資料夾是「Google 帳號登入 + 個人 Google Drive 筆記同步」功能的**唯一開發依據**。
所有討論結論、研究資料、設計、階段任務、進度都記在這裡，讓開發可以分階段、跨多次對話、由多個幫手（Claude 子代理、Codex、Antigravity）接力進行。

- 建立日期：2026-10-18
- 目前狀態：**Phase 1 已部署到公開網站，兩週試用中（P1-18）**（見 [10-progress-log.md](10-progress-log.md)、試用指南 06 §2.1）
- 這個資料夾不會被發佈到網站（不在 `content/` 內，也不在 deploy.yml 的觸發路徑內）。

## 閱讀順序

| 檔案 | 內容 | 什麼時候讀 |
|---|---|---|
| [01-decisions.md](01-decisions.md) | 所有已定案與待決的決策，含理由。**與其他文件衝突時以此為準** | 每次開工前 |
| [02-research.md](02-research.md) | 可行性研究：Google OAuth、Drive API、配額與計費、iOS 限制、方案比較、成本估算、來源 | 需要查證事實時 |
| [03-architecture.md](03-architecture.md) | 整體架構、資料格式、同步演算法、「先同步再編輯」狀態機、UI 流程、安全隱私 | 實作前與實作中 |
| [04-repo-integration.md](04-repo-integration.md) | 現有 Quartz 專案的研究結果，以及要新增／修改哪些檔案 | 動手改程式前 |
| [05-tasks.md](05-tasks.md) | 分階段任務清單與驗收標準（勾選追蹤） | 每次開工前 |
| [06-verification-and-risks.md](06-verification-and-risks.md) | 待驗證事項、實機測試矩陣、風險與對策 | PoC 與測試時 |
| [07-agents.md](07-agents.md) | 幫手分工：Claude 子代理、Codex（Luna／Sol）、Antigravity 的用法與規則 | 要委派工作時 |
| [08-google-cloud-setup.md](08-google-cloud-setup.md) | 使用者要做的 Google Cloud 設定步驟 | Phase 0 |
| [09-goal-prompt.md](09-goal-prompt.md) | 給 `/goal` 用的提示詞（4000 字元以內） | 啟動每個階段時 |
| [10-progress-log.md](10-progress-log.md) | 進度日誌（只追加，不改寫） | 每次開工與收工 |
| [11-code-structure.md](11-code-structure.md) | 程式分層、依賴規則（有自動測試）、新增功能的步驟 | 改程式或加新功能前 |
| [12-backlog.md](12-backlog.md) | 待辦總表（討論過但還沒做的事）與下一步 `/goal` 提示詞 | 決定下一步要做什麼時 |

## 一句話摘要

本機優先（IndexedDB）＋ Google Drive 隱藏應用程式資料夾（`drive.appdata`）同步。
每台裝置只寫自己的分片檔，讀取時合併成**帳號層級的一份筆記**；登入狀態下**先同步再編輯**，無法同步時跳提示、確認後才可離線編輯。
程式封裝成獨立的 Quartz plugin `plugins/personal-notes/`，不改動經文內容與 vault。

## 文件慣例

- 標記：**[事實]** 已由官方文件或程式碼確認；**[建議]** 設計判斷；**[待驗證]** 需 PoC 或實機確認。
- 檔名用英文（方便 CLI 與各種代理工具處理），內容用繁體中文。
- 進度日誌只追加；決策變更時在 01 新增一條並標註取代哪一條，不刪舊紀錄。
